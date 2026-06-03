import { useLocation } from 'react-router-dom';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { BrowserOnboarding } from './BrowserOnboarding';

// Routes that manage their own onboarding experience (e.g. /join/:token renders
// BrowserOnboarding itself and should not be double-rendered by this controller).
const SELF_MANAGED = ['/join/', '/welcome'];

/**
 * Global mobile browser gate. For any uninstalled mobile visitor on a route
 * that doesn't manage its own onboarding, renders BrowserOnboarding as a
 * full-screen overlay — covering the underlying route and replacing the old
 * "Install required" blocker with the full app description + install steps.
 *
 * Already installed (standalone) → null
 * Desktop → null
 * Self-managed route → null (the route handles it)
 * Everything else on mobile browser → BrowserOnboarding
 */
export function InstallPromptController() {
  const { pathname } = useLocation();
  const { isInstalled, isMobile } = useInstallPrompt();

  if (isInstalled || !isMobile) return null;
  if (SELF_MANAGED.some((prefix) => pathname.startsWith(prefix))) return null;

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-bg">
      <BrowserOnboarding />
    </div>
  );
}
