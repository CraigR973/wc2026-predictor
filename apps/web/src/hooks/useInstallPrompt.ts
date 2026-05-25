import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallPromptState {
  /** Android/desktop: native install prompt is available. */
  canInstall: boolean;
  /** Running in standalone PWA mode — never show install UI. */
  isInstalled: boolean;
  /** iOS Safari — show the manual overlay instead of a native prompt. */
  isIosSafari: boolean;
  /** iOS: should show the tutorial overlay (first visit, not yet dismissed). */
  showIosOverlay: boolean;
  /** iOS: user dismissed the overlay — persist via localStorage. */
  dismissIosOverlay: () => void;
  /** Android/desktop: show the install banner (with 7-day cooldown respected). */
  showAndroidBanner: boolean;
  /** Android: user dismissed banner — persist 7-day cooldown. */
  dismissAndroidBanner: () => void;
  /** Call `.prompt()` on the deferred event (Android/desktop only). */
  prompt: () => Promise<void>;
}

const IOS_DISMISSED_KEY = 'sss_ios_install_dismissed';
const ANDROID_SNOOZED_KEY = 'sss_android_install_snoozed_until';
const ANDROID_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function detectIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isSafari = /safari/i.test(ua) && !/criOS|fxiOS/i.test(ua);
  return isIos && isSafari;
}

export function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true)
  );
}

function iosDismissed(): boolean {
  try {
    return localStorage.getItem(IOS_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function androidSnoozed(): boolean {
  try {
    const until = localStorage.getItem(ANDROID_SNOOZED_KEY);
    if (!until) return false;
    return Date.now() < parseInt(until, 10);
  } catch {
    return false;
  }
}

export function useInstallPrompt(): InstallPromptState {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(detectStandalone);
  const [iosOverlayDismissed, setIosOverlayDismissed] = useState(iosDismissed);
  const [androidSnoozedState, setAndroidSnoozedState] = useState(androidSnoozed);

  const isIosSafari = detectIosSafari();

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const prompt = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === 'dismissed') {
      // Snooze banner after explicit dismissal from the native prompt
      try {
        localStorage.setItem(ANDROID_SNOOZED_KEY, String(Date.now() + ANDROID_COOLDOWN_MS));
      } catch { /* ignore */ }
      setAndroidSnoozedState(true);
    }
  }, [deferredPrompt]);

  const dismissIosOverlay = useCallback(() => {
    try {
      localStorage.setItem(IOS_DISMISSED_KEY, '1');
    } catch { /* ignore */ }
    setIosOverlayDismissed(true);
  }, []);

  const dismissAndroidBanner = useCallback(() => {
    try {
      localStorage.setItem(ANDROID_SNOOZED_KEY, String(Date.now() + ANDROID_COOLDOWN_MS));
    } catch { /* ignore */ }
    setAndroidSnoozedState(true);
  }, []);

  const canInstall = !isInstalled && deferredPrompt !== null;

  return {
    canInstall,
    isInstalled,
    isIosSafari,
    showIosOverlay: isIosSafari && !isInstalled && !iosOverlayDismissed,
    dismissIosOverlay,
    showAndroidBanner: canInstall && !androidSnoozedState,
    dismissAndroidBanner,
    prompt,
  };
}
