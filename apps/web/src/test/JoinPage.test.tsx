import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { JoinPage } from '@/pages/JoinPage';

function renderJoin(token: string) {
  return render(
    <MemoryRouter initialEntries={[`/join/${token}`]}>
      <Routes>
        <Route path="/join/:token" element={<JoinPage />} />
      </Routes>
    </MemoryRouter>,
  );
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
  });

  it('shows PIN mismatch error on submit', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ display_name_hint: null }),
      }),
    );
    const { getByLabelText, getByRole, getByText } = renderJoin('tok');
    await waitFor(() => getByLabelText(/display name/i));

    // Fill form with mismatched PINs
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.change(getByLabelText(/display name/i), { target: { value: 'Test' } });
    fireEvent.change(getByLabelText(/choose a pin/i), { target: { value: '1234' } });
    fireEvent.change(getByLabelText(/confirm pin/i), { target: { value: '5678' } });
    fireEvent.click(getByRole('button', { name: /join league/i }));

    await waitFor(() => {
      expect(getByText(/pins do not match/i)).toBeTruthy();
    });
  });
});
