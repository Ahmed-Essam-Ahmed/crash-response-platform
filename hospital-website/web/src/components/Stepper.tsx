import { motion, useReducedMotion } from 'motion/react';
import { STEPS, stepIndex } from '../lib/status';

export function Stepper({ status, tone }: { status: string; tone: string }) {
  const current = stepIndex(status);
  const done = status === 'closed';
  const cancelled = status === 'cancelled';
  const reduce = useReducedMotion();

  if (cancelled) {
    return (
      <div className="flex items-center gap-2 text-xs font-medium text-muted">
        <span className="size-1.5 rounded-full bg-[var(--line-strong)]" />
        Cancelled before a patient was assigned
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-1" role="progressbar" aria-valuemin={0} aria-valuemax={STEPS.length - 1} aria-valuenow={current} aria-label="Case progress">
        {STEPS.map((step, i) => {
          const reached = i <= current;
          return (
            <span key={step.key} className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--line)]">
              <motion.span
                className="block h-full rounded-full"
                style={{ backgroundColor: reached ? tone : 'transparent' }}
                initial={reduce ? false : { scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.45, delay: reduce ? 0 : i * 0.04, ease: [0.22, 1, 0.36, 1] }}
              />
            </span>
          );
        })}
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-2 text-2xs text-muted">
        <span>{STEPS[0].label}</span>
        <motion.span
          key={STEPS[current].label}
          initial={reduce ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="text-xs font-semibold text-ink"
        >
          {STEPS[current].label}
        </motion.span>
        <span>{STEPS[STEPS.length - 1].label}</span>
      </div>
    </div>
  );
}
