import { cn } from '@/lib/utils';
import { brand } from '@/theme/tokens';

export type CalcioLogoVariant = 'primary' | 'gold' | 'mark' | 'mono';

const LOGO_SRC: Record<CalcioLogoVariant, string> = {
  primary: '/brand/calcio-icon-primary.svg',
  gold: '/brand/calcio-icon-gold.svg',
  mark: '/brand/calcio-mark.svg',
  mono: '/brand/calcio-mark-mono.svg',
};

interface CalcioLogoProps {
  variant?: CalcioLogoVariant;
  size?: number;
  label?: string;
  decorative?: boolean;
  className?: string;
}

export function CalcioLogo({
  variant = 'primary',
  size = 32,
  label = brand.full,
  decorative = false,
  className,
}: CalcioLogoProps) {
  return (
    <img
      src={LOGO_SRC[variant]}
      alt={decorative ? '' : label}
      aria-hidden={decorative ? true : undefined}
      width={size}
      height={size}
      className={cn('inline-block shrink-0 select-none', className)}
      draggable={false}
    />
  );
}
