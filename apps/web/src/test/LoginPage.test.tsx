import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
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
  it('shows an email input field', () => {
    renderLogin();
    expect(screen.getByLabelText(/email/i)).toBeTruthy();
  });

  it('shows a PIN input', () => {
    renderLogin();
    expect(screen.getByLabelText(/pin digit 1/i)).toBeTruthy();
  });

  it('shows a sign up link', () => {
    renderLogin();
    expect(screen.getByRole('link', { name: /create account/i })).toBeTruthy();
  });

  it('shows lockout message on locked account response', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve({
        ok: false,
        json: () =>
          Promise.resolve({ detail: 'Account temporarily locked — try again later' }),
      }),
    );

    renderLogin();
    const emailInput = screen.getByLabelText(/email/i);
    fireEvent.change(emailInput, { target: { value: 'alice@example.com' } });
    fireEvent.change(screen.getByLabelText('PIN digit 1'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
    expect(screen.getByRole('alert').textContent).toMatch(/account locked/i);
  });

  it('shows generic error on invalid credentials', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ detail: 'INVALID_CREDENTIALS' }),
      }),
    );

    renderLogin();
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'alice@example.com' } });
    fireEvent.change(screen.getByLabelText('PIN digit 1'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/invalid email or pin/i);
    });
  });
});
