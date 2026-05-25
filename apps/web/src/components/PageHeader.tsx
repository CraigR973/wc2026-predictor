import { type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: ReactNode;
  /** Optional kicker / pre-title (e.g. "Round of 16"). */
  eyebrow?: ReactNode;
  /** When true, shows a back chevron that calls navigate(-1). */
  showBack?: boolean;
  /** Optional right-aligned action slot. */
  action?: ReactNode;
  className?: string;
}

/**
 * Per-page header. Pages render this as their first child. Replaces the
 * default page h1; mirrors the native-app pattern of a contextual title
 * + back affordance + right action.
 */
export function PageHeader({ title, eyebrow, showBack, action, className }: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className={cn('flex items-start gap-3 mb-5', className)}>
      {showBack && (
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="tap-target -ml-2 inline-flex items-center justify-center rounded-md text-text-secondary hover:text-text-primary press-down focus-visible:outline-none focus-visible:shadow-glow"
        >
          <ChevronLeft className="h-6 w-6" aria-hidden />
        </button>
      )}
      <div className="flex-1 min-w-0">
        {eyebrow && (
          <>
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-text-muted mb-1.5">
              {eyebrow}
            </p>
            <div className="border-t border-accent/30 mb-2" aria-hidden />
          </>
        )}
        <h1 className="text-2xl sm:text-3xl font-semibold text-text-primary tracking-tight font-sans leading-tight">
          {title}
        </h1>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
