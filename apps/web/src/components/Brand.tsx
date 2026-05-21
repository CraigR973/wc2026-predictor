import { cn } from '@/lib/utils';
import { brand } from '@/theme/tokens';

interface BrandProps {
  variant?: 'splash' | 'compact' | 'mono';
  className?: string;
}

/**
 * "The Steele Spreadsheet System" wordmark.
 *
 * JetBrains Mono uppercase, brass-gold gradient fill via `.text-wordmark`.
 * Three sizes; same font + same gradient.
 */
export function Brand({ variant = 'splash', className }: BrandProps) {
  if (variant === 'mono') {
    return (
      <span
        className={cn(
          'font-mono font-semibold tracking-[0.3em] text-wordmark text-sm uppercase',
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
          'inline-block font-mono font-semibold uppercase tracking-[0.2em] text-[11px] leading-none text-wordmark-h whitespace-nowrap select-none',
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
      className={cn('flex flex-col items-center text-center select-none gap-2', className)}
      aria-label={brand.full}
    >
      <p className="font-mono font-semibold uppercase tracking-[0.18em] text-3xl sm:text-4xl leading-none text-wordmark">
        THE&nbsp;STEELE
      </p>
      <p className="font-mono font-medium uppercase tracking-[0.3em] text-[11px] sm:text-xs leading-none text-wordmark opacity-90">
        SPREADSHEET&nbsp;SYSTEM
      </p>
    </div>
  );
}
