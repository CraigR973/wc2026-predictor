import { cn } from '@/lib/utils';
import { brand } from '@/theme/tokens';

interface BrandProps {
  variant?: 'splash' | 'compact' | 'mono' | 'lockup' | 'mark';
  /** Size in px for the `mark` variant (16 | 24 | 32). Defaults to 32. */
  size?: 16 | 24 | 32;
  className?: string;
}

/** Concept 3 letterform mark — bold S with pentagon panel — as an inline SVG. */
function MarkSvg({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      focusable={false}
    >
      <rect width="512" height="512" rx="96" ry="96" fill="#0B0E13" />
      <path
        d="M 380 158 C 380 110, 322 96, 256 96 C 188 96, 134 142, 134 200 C 134 252, 178 282, 230 282 L 282 282 C 334 282, 378 312, 378 364 C 378 422, 324 466, 256 466 C 190 466, 132 446, 132 402"
        fill="none"
        stroke="#D4A24A"
        strokeWidth="56"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 256 218 L 226 244 L 238 282 L 274 282 L 286 244 Z"
        fill="#0B0E13"
        stroke="#0B0E13"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M 256 218 L 226 244 L 238 282 L 274 282 L 286 244 Z"
        fill="none"
        stroke="#D4A24A"
        strokeWidth="6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * "Calcio" wordmark.
 *
 * variants:
 *   splash  — single-line wordmark (default, used on login splash)
 *   lockup  — mark left + wordmark right on one line (login splash with new logo)
 *   compact — single-line all-caps mono (TopBar)
 *   mono    — short name in mono (misc)
 *   mark    — just the letterform mark at 16/24/32 px
 */
export function Brand({ variant = 'splash', size = 32, className }: BrandProps) {
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
        CALCIO
      </span>
    );
  }

  if (variant === 'mark') {
    return (
      <span
        className={cn('inline-flex shrink-0 select-none', className)}
        aria-label={brand.full}
        role="img"
      >
        <MarkSvg size={size} />
      </span>
    );
  }

  if (variant === 'lockup') {
    return (
      <div
        className={cn('flex items-center gap-4 select-none', className)}
        aria-label={brand.full}
      >
        <MarkSvg size={64} />
        <p className="font-mono font-semibold uppercase tracking-[0.18em] text-2xl sm:text-3xl leading-none text-wordmark">
          CALCIO
        </p>
      </div>
    );
  }

  // splash — default single-line layout
  return (
    <div
      className={cn('flex flex-col items-center text-center select-none gap-2', className)}
      aria-label={brand.full}
    >
      <p className="font-mono font-semibold uppercase tracking-[0.18em] text-3xl sm:text-4xl leading-none text-wordmark">
        CALCIO
      </p>
    </div>
  );
}
