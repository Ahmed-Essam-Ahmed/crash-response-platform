import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useTheme } from '../theme';

const SPRING = { type: 'spring', stiffness: 420, damping: 32, mass: 0.7 } as const;

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
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/72 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex max-w-[100rem] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <motion.div
            whileHover={reduce ? undefined : { rotate: -6, scale: 1.04 }}
            transition={SPRING}
            className="grid size-10 shrink-0 place-items-center rounded-[0.875rem] bg-primary text-base font-bold text-primary-fg"
          >
            R+
          </motion.div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[length:var(--text-base)] font-semibold tracking-tight">Response Hub</p>
            <p className="truncate text-xs text-muted">
              Emergency department · {clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <AnimatePresence mode="popLayout" initial={false}>
            {criticalCount > 0 && (
              <motion.span
                key="critical"
                layout
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={SPRING}
                className="chip hidden items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold sm:inline-flex"
                data-tone="critical"
              >
                <span className="size-1.5 rounded-full bg-current" />
                {criticalCount} critical
              </motion.span>
            )}
          </AnimatePresence>

          <motion.div
            animate={connected ? { opacity: 1 } : { opacity: 0.72 }}
            transition={{ duration: 0.3 }}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ${
              connected
                ? 'bg-[color-mix(in_oklab,var(--sev-mild)_14%,var(--surface))] text-[var(--tone-ink)] ring-[color-mix(in_oklab,var(--sev-mild)_28%,transparent)]'
                : 'bg-[color-mix(in_oklab,var(--sev-moderate)_16%,var(--surface))] text-[color-mix(in_oklab,var(--sev-moderate)_72%,var(--ink))] ring-[color-mix(in_oklab,var(--sev-moderate)_30%,transparent)]'
            }`}
            data-tone={connected ? 'mild' : 'moderate'}
            role="status"
          >
            <span className="relative flex size-2">
              {connected && (
                <motion.span
                  className="absolute inline-flex size-full rounded-full bg-current"
                  animate={{ scale: [1, 2.1], opacity: [0.6, 0] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                />
              )}
              <span className="relative inline-flex size-2 rounded-full bg-current" />
            </span>
            {connected ? 'Live' : 'Reconnecting'}
          </motion.div>

          <motion.button
            whileTap={reduce ? undefined : { scale: 0.92 }}
            onClick={(e) => toggle(e.currentTarget.getBoundingClientRect())}
            aria-label={`Switch to ${mode === 'dark' ? 'light' : 'dark'} theme`}
            className="grid size-11 place-items-center rounded-[0.875rem] border border-line bg-surface text-muted hover:text-ink"
          >
            <motion.span
              key={mode}
              initial={reduce ? false : { rotate: -90, opacity: 0, scale: 0.6 }}
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

          <motion.button
            whileTap={reduce ? undefined : { scale: 0.96 }}
            onClick={onReport}
            disabled={reporting}
            aria-label={reporting ? 'Reporting a test crash' : 'Report a test crash'}
            className="btn btn-primary disabled:opacity-60"
          >
            {reporting ? (
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                className="size-4 rounded-full border-2 border-current border-t-transparent"
              />
            ) : (
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            )}
            <span className="hidden sm:inline">{reporting ? 'Reporting' : 'Report a crash'}</span>
            <span className="sm:hidden">Report</span>          </motion.button>
        </div>
      </div>
    </header>
  );
}
