import { Download, Smartphone } from 'lucide-react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { IosSafariOverlay } from './IosSafariOverlay';

/**
 * Mandatory install gate — renders a full-screen blocking overlay whenever
 * the app is not running in standalone mode on a mobile device.
 *
 * - Already installed (standalone)  → renders nothing
 * - Desktop                         → renders nothing (desktop use is fine without install)
 * - iOS Safari                      → IosSafariOverlay (3-step manual instructions)
 * - iOS other browser               → prompt to open in Safari
 * - Android/Chrome/Edge/Samsung     → native install prompt button
 * - Android other browser           → generic "use browser menu" instructions
 *
 * There is no dismiss/close. The only exit is installing the app and reopening
 * in standalone mode, at which point `isInstalled` becomes true and the gate
 * returns null.
 */
export function InstallPromptController() {
  const { isInstalled, isIos, isIosSafari, isAndroid, isMobile, canInstall, prompt } =
    useInstallPrompt();

  // Already installed or desktop — nothing to show
  if (isInstalled || !isMobile) return null;

  // iOS Safari — show step-by-step tutorial
  if (isIosSafari) return <IosSafariOverlay />;

  // iOS but not Safari — can't install; direct them to Safari
  if (isIos) {
    return (
      <InstallGate
        title="Open in Safari to install"
        body="The Steele Spreadsheet System can only be added to your home screen from Safari. Copy the URL and paste it into Safari, then follow the instructions there."
        icon={<Smartphone className="h-8 w-8 text-primary" aria-hidden />}
      />
    );
  }

  // Android with a native install prompt available
  if (isAndroid && canInstall) {
    return (
      <InstallGate
        title="Install the app"
        body="Add The Steele Spreadsheet System to your home screen for the best experience. You'll need it to access the league."
        icon={<Download className="h-8 w-8 text-primary" aria-hidden />}
        action={
          <button
            onClick={() => void prompt()}
            className="w-full py-3 rounded-xl bg-primary text-white text-sm font-sans font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            Install app
          </button>
        }
      />
    );
  }

  // Android without beforeinstallprompt (Firefox, older browsers, etc.)
  if (isAndroid) {
    return (
      <InstallGate
        title="Add to Home Screen"
        body="Open your browser menu (usually the three-dot icon) and choose 'Add to Home Screen' or 'Install app'. Then reopen from your home screen."
        icon={<Download className="h-8 w-8 text-primary" aria-hidden />}
      />
    );
  }

  return null;
}

// ── Shared gate shell ─────────────────────────────────────────────────────────

function InstallGate({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Install required"
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-bg/95 backdrop-blur-sm px-6"
    >
      <div className="w-full max-w-sm rounded-2xl bg-surface border border-border shadow-sheet px-6 py-8 flex flex-col items-center text-center gap-5 animate-in fade-in zoom-in-95 duration-300">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          {icon}
        </div>
        <div>
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-text-muted mb-2">
            Required
          </p>
          <h2 className="text-xl font-semibold text-text-primary font-sans mb-2">{title}</h2>
          <p className="text-sm text-text-secondary font-sans leading-relaxed">{body}</p>
        </div>
        {action}
      </div>
    </div>
  );
}
