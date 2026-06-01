import { brand } from '@/theme/tokens';

/** "In partnership with Robinsons" splash lockup — shared by Login and Signup. */
export function PartnershipLockup() {
  return (
    <div className="mt-8 flex flex-col items-center gap-2">
      <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-text-muted">
        In partnership with
      </p>
      <img
        src="/robinsons-logo.svg"
        alt="Robinson's"
        className="h-12 w-auto object-contain"
        draggable={false}
      />
      <p className="mt-3 text-center text-text-primary font-sans text-base sm:text-lg italic">
        {brand.tagline}
      </p>
    </div>
  );
}
