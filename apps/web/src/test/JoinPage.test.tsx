import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { JoinPage } from '@/pages/JoinPage';
import { AuthProvider } from '@/contexts/AuthContext';

function renderJoin(token: string) {
  return render(
    <MemoryRouter initialEntries={[`/join/${token}`]}>
      <AuthProvider>
        <Routes>
          <Route path="/join/:token" element={<JoinPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

function fillPin(group: HTMLElement, digits: string) {
  for (let i = 0; i < digits.length; i++) {
    fireEvent.change(within(group).getByLabelText(`PIN digit ${i + 1}`), {
      target: { value: digits[i] },
    });
  }
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('JoinPage', () => {
  it('shows loading state initially', () => {
    vi.stubGlobal('fetch', () => new Promise(() => {}));
    renderJoin('abc');
    expect(screen.getByText(/checking invite/i)).toBeTruthy();
  });

  it('shows error when invite is invalid', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ detail: 'Invalid invite token' }),
      }),
    );
    renderJoin('badtoken');
    await waitFor(() => {
      expect(screen.getByText(/invalid invite token/i)).toBeTruthy();
    });
  });

  it('shows join form when invite is valid', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ display_name_hint: 'Craig' }),
      }),
    );
    renderJoin('goodtoken');
    await waitFor(() => {
      expect(screen.getByLabelText(/display name/i)).toBeTruthy();
    });
    // Pre-fills name hint
    const nameInput = screen.getByLabelText(/display name/i) as HTMLInputElement;
    expect(nameInput.value).toBe('Craig');
    // PIN entry and confirm groups are present
    expect(screen.getByRole('group', { name: 'PIN' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Confirm PIN' })).toBeTruthy();
  });

  it('shows PIN mismatch error on submit', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ display_name_hint: null }),
      }),
    );
    renderJoin('tok');
    await waitFor(() => screen.getByLabelText(/display name/i));

    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Test' } });
    fillPin(screen.getByRole('group', { name: 'PIN' }), '1234');
    fillPin(screen.getByRole('group', { name: 'Confirm PIN' }), '5678');
    fireEvent.click(screen.getByRole('button', { name: /join league/i }));

    await waitFor(() => {
      expect(screen.getByText(/pins do not match/i)).toBeTruthy();
    });
  });
});
