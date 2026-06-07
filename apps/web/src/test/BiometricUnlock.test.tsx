import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';

const FAKE_JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJwMSIsImV4cCI6OTk5OTk5OTk5OX0.fake';
const STORED_PLAYER = JSON.stringify({
  id: 'p1',
  displayName: 'Alice',
  role: 'player',
  timezone: 'UTC',
});
const STORED_BIOMETRIC = JSON.stringify({
  playerId: 'p1',
  credentialId: 'AQIDBA',
  enrolledAt: '2026-06-07T00:00:00.000Z',
});

function makeStorage() {
  const values = new Map([
    ['wc2026_player', STORED_PLAYER],
    ['wc2026_access', FAKE_JWT],
    ['wc2026_refresh', 'refresh-token'],
    ['wc2026_biometric_unlock', STORED_BIOMETRIC],
  ]);

  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
    clear: vi.fn(() => {
      values.clear();
    }),
  };
}

function mockWebAuthn(get: () => Promise<Credential | { type: string } | null>) {
  const PublicKeyCredentialMock = {
    isUserVerifyingPlatformAuthenticatorAvailable: vi.fn(() => Promise.resolve(true)),
  };
  Object.defineProperty(window, 'PublicKeyCredential', {
    value: PublicKeyCredentialMock,
    configurable: true,
  });
  vi.stubGlobal('PublicKeyCredential', PublicKeyCredentialMock);
  Object.defineProperty(navigator, 'credentials', {
    value: { create: vi.fn(), get: vi.fn(get) },
    configurable: true,
  });
}

function renderProtectedApp() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <AuthProvider>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<div>Authed content</div>} />
          </Route>
          <Route path="/login" element={<div>PIN login</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal('localStorage', makeStorage());
});

describe('biometric unlock gate', () => {
  it('keeps authed content hidden until biometric unlock succeeds', async () => {
    mockWebAuthn(() => Promise.resolve({ type: 'public-key' }));
    renderProtectedApp();

    expect(screen.queryByText('Authed content')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /unlock with face id/i }));

    await waitFor(() => {
      expect(screen.getByText('Authed content')).toBeInTheDocument();
    });
  });

  it('falls back to PIN when biometric unlock fails', async () => {
    mockWebAuthn(() => Promise.reject(new DOMException('Cancelled', 'NotAllowedError')));
    renderProtectedApp();

    fireEvent.click(screen.getByRole('button', { name: /unlock with face id/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/sign in with your pin/i);
      expect(screen.queryByText('Authed content')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /use pin instead/i }));
    expect(screen.getByText('PIN login')).toBeInTheDocument();
  });
});
