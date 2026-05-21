import { type ReactNode, useEffect } from 'react';
import { AnimatePresence, motion, type PanInfo, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
  /**
   * If true, hides the drag handle + close button row. Caller owns dismissal
   * (e.g. tapping an item navigates and the route-change effect closes it).
   */
  hideHeader?: boolean;
}

/**
 * Bottom sheet — slides up from the bottom, dim+blur overlay, drag-down to
 * dismiss. Body scroll locks while open. ESC key closes.
 *
 * Implementation notes (after a real bug where the overlay sometimes stayed
 * mounted after `open` flipped to false):
 *   - The overlay and the sheet are SIBLING direct children of
 *     <AnimatePresence>, not wrapped in a fragment. Fragments confuse
 *     AnimatePresence's child reconciliation and can stall exit animations.
 *   - Drag is confined to the drag-handle stripe at the top of the sheet, not
 *     the whole sheet area, so taps on items inside the sheet body never get
 *     swallowed by a phantom drag gesture.
 */
export function Sheet({ open, onClose, title, children, className, hideHeader }: SheetProps) {
  const prefersReducedMotion = useReducedMotion();

  // Lock body scroll while the sheet is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ESC closes the sheet.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > 80 || info.velocity.y > 500) onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="sheet-overlay"
          className="fixed inset-0 z-sheet bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          aria-hidden
        />
      )}
      {open && (
        <motion.div
          key="sheet-panel"
          className={cn(
            'fixed bottom-0 left-0 right-0 z-sheet',
            'bg-surface-elevated border-t border-border rounded-t-2xl shadow-sheet',
            'pb-safe',
            className,
          )}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          initial={prefersReducedMotion ? { y: 0, opacity: 0 } : { y: '100%' }}
          animate={{ y: 0, opacity: 1 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { y: '100%' }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        >
          {/* Header row: drag handle (only this strip is draggable) + title + close. */}
          {!hideHeader && (
            <motion.div
              className="pt-3 pb-1 cursor-grab active:cursor-grabbing"
              drag={prefersReducedMotion ? false : 'y'}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.4 }}
              dragSnapToOrigin
              dragMomentum={false}
              onDragEnd={handleDragEnd}
            >
              <div className="flex justify-center">
                <div className="h-1 w-10 rounded-full bg-border-strong" aria-hidden />
              </div>
            </motion.div>
          )}
          {title && (
            <div className="flex items-center justify-between px-5 pb-2 pt-1">
              <h2 className="text-base font-semibold text-text-primary font-sans tracking-tight">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="tap-target inline-flex items-center justify-center rounded-sm text-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:shadow-glow press-down"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          )}
          <div className="px-5 pb-5 max-h-[80vh] overflow-y-auto">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
