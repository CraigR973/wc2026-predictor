import { useId } from 'react';
import { cn } from '@/lib/utils';
import { brand } from '@/theme/tokens';

interface BrandProps {
  variant?: 'splash' | 'compact' | 'mono' | 'lockup' | 'mark';
  /** Size in px for the `mark` variant (16 | 24 | 32). Defaults to 32. */
  size?: 16 | 24 | 32;
  className?: string;
}

/**
 * Concept 6 "Calcio C" mark — a geometric monoline C (open centre-circle ring)
 * cradling a football in its mouth, in the brass-gold wordmark gradient. Kept in
 * sync with the rasterised PWA icons by apps/web/generate-icons.mjs.
 */
function MarkSvg({ size }: { size: number }) {
  // Unique gradient id so multiple marks on one page stay valid SVG.
  const gradId = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      focusable={false}
    >
      <defs>
        <linearGradient
          id={gradId}
          gradientUnits="userSpaceOnUse"
          x1="256"
          y1="90"
          x2="256"
          y2="430"
        >
          <stop offset="0" stopColor="#F0DDA6" />
          <stop offset="0.55" stopColor="#D4A24A" />
          <stop offset="1" stopColor="#A77C2A" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="96" ry="96" fill="#0B0E13" />
      {/* The "C" — open ring, mouth facing the ball */}
      <path
        d="M 341 139 A 148 148 0 1 0 341 373"
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="60"
        strokeLinecap="round"
      />
      {/* Football cradled in the C's mouth, with one knocked-out pentagon panel */}
      <circle cx="380" cy="256" r="56" fill={`url(#${gradId})`} />
      <path d="M 380 218 L 348 242 L 360 280 L 400 280 L 412 242 Z" fill="#0B0E13" />
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

  // splash — vertical lockup: mark above the wordmark (login / signup / welcome)
  return (
    <div
      className={cn('flex flex-col items-center text-center select-none gap-4', className)}
      aria-label={brand.full}
    >
      <MarkSvg size={72} />
      <p className="font-mono font-semibold uppercase tracking-[0.18em] text-3xl sm:text-4xl leading-none text-wordmark">
        CALCIO
      </p>
    </div>
  );
}
