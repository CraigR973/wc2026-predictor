import { cn } from '@/lib/utils';
import { brand } from '@/theme/tokens';

interface BrandProps {
  variant?: 'splash' | 'compact' | 'mono';
  className?: string;
}

/**
 * "The Steele Spreadsheet System" wordmark.
 *
 * Unified JetBrains Mono uppercase treatment. Single font + single size per
 * variant — leans into the "Spreadsheet System" gag and matches the mono caps
 * eyebrow language used throughout the app.
 */
export function Brand({ variant = 'splash', className }: BrandProps) {
  if (variant === 'mono') {
    return (
      <span
        className={cn(
          'font-mono font-semibold tracking-[0.3em] text-steele text-sm uppercase',
          className,
        )}
        aria-label={brand.full}
      >
        {brand.short}
      </span>
    );
  }

  if (variant === 'compact') {
    return (
      <span
        className={cn(
          'inline-block font-mono font-semibold uppercase tracking-[0.2em] text-[11px] leading-none text-steele-h whitespace-nowrap select-none',
          className,
        )}
        aria-label={brand.full}
      >
        STEELE&nbsp;SPREADSHEET&nbsp;SYSTEM
      </span>
    );
  }

  return (
    <div
      className={cn('flex flex-col items-center text-center select-none gap-1.5', className)}
      aria-label={brand.full}
    >
      <p className="font-mono font-semibold uppercase tracking-[0.22em] text-lg sm:text-xl leading-none text-steele">
        THE&nbsp;STEELE
      </p>
      <p className="font-mono font-semibold uppercase tracking-[0.22em] text-lg sm:text-xl leading-none text-steele">
        SPREADSHEET&nbsp;SYSTEM
      </p>
    </div>
  );
}
