import { useEffect, useState } from 'react';
import { motion, useReducedMotion, useSpring } from 'motion/react';
import { useTheme } from '../theme';
import { MagneticButton } from './MagneticButton';

const SPRING = { type: 'spring', stiffness: 420, damping: 32, mass: 0.7 } as const;

function useClockLabel() {
  const [label, setLabel] = useState(() => formatClock());
  useEffect(() => {
    const timer = window.setInterval(() => setLabel(formatClock()), 15_000);
    return () => window.clearInterval(timer);
  }, []);
  return label;
}

function formatClock() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function TopBar({
  connected,
  onReport,
  reporting,
  criticalCount,
}: {
  connected: boolean;
  onReport: () => void;
  reporting: boolean;
  criticalCount: number;
}) {
  const { mode, toggle } = useTheme();
  const reduce = useReducedMotion();
  const clock = useClockLabel();

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/70 backdrop-blur-2xl backdrop-saturate-150">
      <div className="mx-auto flex max-w-[100rem] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6">
        <motion.div
          whileHover={reduce ? undefined : { rotate: -8, scale: 1.06 }}
          whileTap={reduce ? undefined : { scale: 0.92 }}
          transition={SPRING}
          className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-[0.875rem] bg-primary text-base font-bold text-primary-fg shadow-soft"
        >
          R+
        </motion.div>

        <div className="min-w-0 leading-tight">
          <p className="truncate text-[length:var(--text-base)] font-semibold tracking-tight">
            Response Hub
          </p>
          <p className="tnum truncate text-xs text-muted">Emergency department · {clock}</p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {criticalCount > 0 && (
            <motion.span
              animate={reduce ? undefined : { scale: [1, 1.06, 1] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              data-tone="critical"
              className="chip hidden items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold sm:inline-flex"
            >
              <span className="size-1.5 rounded-full bg-current" />
              {criticalCount} critical
            </motion.span>
          )}

          <motion.div
            animate={connected ? { opacity: 1 } : { opacity: 0.72 }}
            transition={{ duration: 0.3 }}
            data-tone={connected ? 'mild' : 'moderate'}
            role="status"
            className="chip inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium"
          >
            <span className="relative flex size-2">
              {connected && (
                <motion.span
                  className="absolute inline-flex size-full rounded-full bg-current"
                  animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                />
              )}
              <span className="relative inline-flex size-2 rounded-full bg-current" />
            </span>
            {connected ? 'Live' : 'Reconnecting'}
          </motion.div>

          <motion.button
            whileHover={reduce ? undefined : { rotate: 18, scale: 1.08 }}
            whileTap={reduce ? undefined : { scale: 0.9 }}
            onClick={(e) => toggle(e.currentTarget.getBoundingClientRect())}
            aria-label={`Switch to ${mode === 'dark' ? 'light' : 'dark'} theme`}
            className="grid size-11 cursor-pointer place-items-center rounded-[0.875rem] border border-line bg-surface text-muted transition-colors hover:border-[var(--primary)] hover:text-ink"
          >
            <motion.span
              key={mode}
              initial={reduce ? false : { rotate: -90, opacity: 0, scale: 0.5 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              transition={SPRING}
              className="grid place-items-center"
            >
              {mode === 'dark' ? (
                <svg viewBox="0 0 24 24" className="size-[1.15rem]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="size-[1.15rem]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 13.2A8.5 8.5 0 1 1 10.8 3a6.8 6.8 0 0 0 10.2 10.2Z" />
                </svg>
              )}
            </motion.span>
          </motion.button>

          <MagneticButton variant="primary" onClick={onReport} disabled={reporting}>
            {reporting ? (
              <motion.span
                aria-hidden
                animate={{ rotate: 360 }}
                transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                className="size-4 rounded-full border-2 border-current border-t-transparent"
              />
            ) : (
              <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            )}
            <span className="hidden sm:inline">{reporting ? 'Reporting' : 'Report a crash'}</span>
            <span className="sm:hidden">Report</span>
          </MagneticButton>
        </div>
      </div>
    </header>
  );
}
