import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from '@/pages/LoginPage';
import { AuthProvider } from '@/contexts/AuthContext';

function renderLogin() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('LoginPage', () => {
  it('shows a dropdown when players load', async () => {
    vi.stubGlobal('fetch', (url: string) => {
      if (url.includes('/api/v1/players/names')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              { id: '1', display_name: 'Alice' },
              { id: '2', display_name: 'Bob' },
            ]),
        });
      }
      return Promise.reject(new Error('unexpected fetch'));
    });

    renderLogin();
    await waitFor(() => {
      expect(screen.getByDisplayValue('Alice')).toBeTruthy();
    });
  });

  it('falls back to text input when API fails', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve({ ok: false }));
    renderLogin();
    // Wait for fetch to settle
    await new Promise((r) => setTimeout(r, 50));
    const nameInput = screen.getByLabelText(/name/i) as HTMLInputElement;
    expect(nameInput.tagName).toBe('INPUT');
  });

  it('shows lockout message on 429 response', async () => {
    vi.stubGlobal('fetch', (url: string) => {
      if (url.includes('/api/v1/players/names')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ id: '1', display_name: 'Alice' }]),
        });
      }
      // login call
      return Promise.resolve({
        ok: false,
        json: () =>
          Promise.resolve({ detail: 'Account temporarily locked — try again later' }),
      });
    });

    const { getByRole, findByText } = renderLogin();
    await waitFor(() => screen.getByDisplayValue('Alice'));

    const { fireEvent } = await import('@testing-library/react');
    fireEvent.change(screen.getByLabelText(/pin/i), { target: { value: '1234' } });
    fireEvent.click(getByRole('button', { name: /sign in/i }));

    await findByText(/account locked/i);
  });
});
