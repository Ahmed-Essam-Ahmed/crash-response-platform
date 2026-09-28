import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

export interface Toast {
  id: number;
  text: string;
  tone: 'ok' | 'critical' | 'moderate';
}

export function Toaster({
  toasts,
  dismiss,
}: {
  toasts: Toast[];
  dismiss: (id: number) => void;
}) {
  const reduce = useReducedMotion();

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end"
      aria-live="polite"
      aria-atomic="false"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.button
            key={toast.id}
            layout
            data-tone={toast.tone === 'ok' ? 'mild' : toast.tone}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            onClick={() => dismiss(toast.id)}
            className="chip pointer-events-auto flex min-h-11 items-center gap-2.5 rounded-xl px-4 text-sm font-medium shadow-lift"
          >
            <span className="size-2 shrink-0 rounded-full bg-current" />
            {toast.text}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
