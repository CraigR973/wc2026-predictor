import { StoredPlayer } from './tokens';

const STORAGE_KEY = 'wc2026_biometric_unlock';
const CHALLENGE_BYTES = 32;
const CEREMONY_TIMEOUT_MS = 60_000;

interface BiometricUnlockEnrollment {
  playerId: string;
  credentialId: string;
  enrolledAt: string;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function randomChallenge(): ArrayBuffer {
  const challenge = new Uint8Array(CHALLENGE_BYTES);
  crypto.getRandomValues(challenge);
  return toArrayBuffer(challenge);
}

function getStoredEnrollment(): BiometricUnlockEnrollment | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<BiometricUnlockEnrollment>;
    if (!parsed.playerId || !parsed.credentialId || !parsed.enrolledAt) return null;
    return parsed as BiometricUnlockEnrollment;
  } catch {
    return null;
  }
}

function storeEnrollment(enrollment: BiometricUnlockEnrollment): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(enrollment));
}

export function getBiometricUnlockEnrollment(playerId: string): BiometricUnlockEnrollment | null {
  const enrollment = getStoredEnrollment();
  if (!enrollment || enrollment.playerId !== playerId) return null;
  return enrollment;
}

export function isBiometricUnlockEnabled(playerId: string): boolean {
  return getBiometricUnlockEnrollment(playerId) !== null;
}

export function disableBiometricUnlock(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export async function hasPlatformAuthenticator(): Promise<boolean> {
  if (
    typeof window === 'undefined' ||
    typeof navigator === 'undefined' ||
    !window.PublicKeyCredential ||
    !navigator.credentials?.create ||
    !navigator.credentials?.get ||
    !PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable
  ) {
    return false;
  }

  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export async function enrollBiometricUnlock(player: StoredPlayer): Promise<void> {
  if (!(await hasPlatformAuthenticator())) {
    throw new Error('Biometric unlock is not available on this device.');
  }

  const userId = toArrayBuffer(new TextEncoder().encode(player.id));
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: randomChallenge(),
      rp: { name: 'Calcio' },
      user: {
        id: userId,
        name: player.displayName,
        displayName: player.displayName,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'discouraged',
        requireResidentKey: false,
        userVerification: 'required',
      },
      attestation: 'none',
      timeout: CEREMONY_TIMEOUT_MS,
    },
  });

  if (!credential || !('rawId' in credential)) {
    throw new Error('Biometric enrollment was cancelled.');
  }

  const publicKeyCredential = credential as PublicKeyCredential;

  storeEnrollment({
    playerId: player.id,
    credentialId: bytesToBase64Url(new Uint8Array(publicKeyCredential.rawId)),
    enrolledAt: new Date().toISOString(),
  });
}

export async function verifyBiometricUnlock(playerId: string): Promise<void> {
  const enrollment = getBiometricUnlockEnrollment(playerId);
  if (!enrollment) {
    throw new Error('Biometric unlock is not enabled.');
  }

  if (!(await hasPlatformAuthenticator())) {
    throw new Error('Biometric unlock is not available on this device.');
  }

  const credential = await navigator.credentials.get({
    publicKey: {
      challenge: randomChallenge(),
      allowCredentials: [
        {
          id: toArrayBuffer(base64UrlToBytes(enrollment.credentialId)),
          type: 'public-key',
          transports: ['internal'],
        },
      ],
      userVerification: 'required',
      timeout: CEREMONY_TIMEOUT_MS,
    },
  });

  if (!credential || credential.type !== 'public-key') {
    throw new Error('Biometric unlock was cancelled.');
  }
}
