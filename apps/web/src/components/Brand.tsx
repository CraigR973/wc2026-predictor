import { cn } from '@/lib/utils';
import { brand } from '@/theme/tokens';

interface BrandProps {
  variant?: 'splash' | 'compact' | 'mono';
  className?: string;
}

/**
 * "The Steele Spreadsheet System" wordmark.
 *
 * - `splash` — large two-line hero (login, join, install splash).
 * - `compact` — single small line for sticky headers / nav bars.
 * - `mono` — just the JetBrains-Mono "SSS" badge (used in tight chrome spots).
 *
 * The serif-italic "The Steele" gets a metallic-slate gradient fill; the
 * "Spreadsheet System" tagline sits below in mono caps.
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
      <span className={cn('inline-flex items-baseline gap-2 select-none', className)} aria-label={brand.full}>
        <span className="font-wordmark text-2xl leading-none text-steele-h">
          {brand.wordmarkTop}
        </span>
        <span className="font-mono text-[10px] tracking-[0.25em] text-text-muted uppercase">
          {brand.wordmarkBottom}
        </span>
      </span>
    );
  }

  return (
    <div className={cn('flex flex-col items-center text-center select-none', className)}>
      <h1
        className="font-wordmark text-6xl sm:text-7xl leading-none text-steele"
        aria-label={brand.full}
      >
        {brand.wordmarkTop}
      </h1>
      <p className="font-mono text-[11px] sm:text-xs tracking-[0.4em] text-text-muted uppercase mt-3">
        {brand.wordmarkBottom}
      </p>
    </div>
  );
}
