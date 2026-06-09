import { useState, useEffect, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  /** Optional photo URL. Falls back to initials when null/undefined or on load error. */
  src?: string | null;
}

const SIZE: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
};

/** Returns 1–2 initial letters from a display name. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/**
 * Deterministic surface tint per name so avatars stay visually distinct.
 * Uses a small hash on the name to pick from a curated palette of muted
 * dark-mode-safe backgrounds.
 */
const PALETTE = [
  'bg-primary/15 text-primary',
  'bg-accent/15 text-accent',
  'bg-steele-dark/30 text-steele',
  'bg-gold/15 text-gold',
  'bg-silver/15 text-silver',
  'bg-bronze/15 text-bronze',
];

function tintFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length]!;
}

export function Avatar({ name, size = 'md', src, className, ...props }: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  useEffect(() => { setImgError(false); }, [src]);
  const showPhoto = !!src && !imgError;

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center rounded-full select-none overflow-hidden',
        SIZE[size],
        !showPhoto && cn('font-sans font-semibold', tintFor(name)),
        className,
      )}
      aria-hidden
      {...props}
    >
      {showPhoto ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        initials(name)
      )}
    </div>
  );
}
