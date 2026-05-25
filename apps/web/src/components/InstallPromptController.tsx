import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { IosSafariOverlay } from './IosSafariOverlay';
import { AndroidInstallBanner } from './AndroidInstallBanner';

/**
 * Mounts the right install-prompt UI for the current platform:
 * - iOS Safari → tutorial overlay (shown once, persisted in localStorage)
 * - Android Chrome/Edge → banner driven by beforeinstallprompt (7-day cooldown on dismiss)
 * - Standalone (already installed) → nothing
 * - Desktop → nothing
 */
export function InstallPromptController() {
  const {
    isInstalled,
    showIosOverlay,
    dismissIosOverlay,
    showAndroidBanner,
    dismissAndroidBanner,
    prompt,
  } = useInstallPrompt();

  if (isInstalled) return null;
  if (showIosOverlay) return <IosSafariOverlay onDismiss={dismissIosOverlay} />;
  if (showAndroidBanner) return <AndroidInstallBanner onInstall={prompt} onDismiss={dismissAndroidBanner} />;
  return null;
}
