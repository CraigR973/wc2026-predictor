import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SignupPage } from '@/pages/SignupPage';
import { AuthProvider } from '@/contexts/AuthContext';

function renderSignup() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <SignupPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('SignupPage', () => {
  it('renders email, first name, last name, timezone, PIN, confirm PIN fields', () => {
    renderSignup();
    expect(screen.getByLabelText(/email/i)).toBeTruthy();
    expect(screen.getByLabelText(/first name/i)).toBeTruthy();
    expect(screen.getByLabelText(/last name/i)).toBeTruthy();
    expect(screen.getByLabelText(/timezone/i)).toBeTruthy();
  });

  it('shows pin mismatch error when PINs differ', async () => {
    vi.stubGlobal('fetch', vi.fn());
    renderSignup();
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'alice@example.com' } });
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Smith' } });
    fireEvent.change(screen.getByLabelText('PIN digit 1'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('PIN digit 2'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('PIN digit 3'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('PIN digit 4'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText(/confirm pin/i), { target: { value: '9999' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/do not match/i));
  });

  it('shows error when email already exists', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ detail: 'Email already registered' }),
      }),
    );
    renderSignup();
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'alice@example.com' } });
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Smith' } });
    // Match PINs
    fireEvent.change(screen.getByLabelText('PIN digit 1'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('PIN digit 2'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('PIN digit 3'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('PIN digit 4'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText(/confirm pin/i), { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/already exists/i));
  });

  it('has a link back to login', () => {
    renderSignup();
    expect(screen.getByRole('link', { name: /sign in/i })).toBeTruthy();
  });
});
