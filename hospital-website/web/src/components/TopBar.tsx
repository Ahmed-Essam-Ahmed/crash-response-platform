import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useTheme } from '../theme';
import { Button } from './Button';
import type { Hospital, User } from '../types';

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
  hospital,
  user,
  connected,
  onStaff,
  onSignOut,
}: {
  hospital: Hospital;
  user: User;
  connected: boolean;
  onStaff: () => void;
  onSignOut: () => void;
}) {
  const { mode, toggle } = useTheme();
  const reduce = useReducedMotion();
  const clock = useClockLabel();

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/80 backdrop-blur-2xl backdrop-saturate-150">
      <div className="mx-auto flex max-w-[100rem] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6">
        <span className="grid size-10 shrink-0 place-items-center rounded-[0.875rem] bg-primary text-base font-bold text-primary-fg shadow-soft">
          R+
        </span>

        <div className="min-w-0 leading-tight">
          <p className="truncate text-[length:var(--text-base)] font-semibold tracking-tight">
            {hospital.name}
          </p>
          <p className="tnum truncate text-xs text-muted">
            Signed in as {user.full_name || user.email} · {clock}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <motion.span
            animate={reduce ? undefined : { opacity: connected ? 1 : 0.55 }}
            transition={{ duration: 0.3 }}
            data-tone={connected ? 'mild' : 'moderate'}
            role="status"
            className="chip inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium"
          >
            <span className="size-2 shrink-0 rounded-full bg-current" />
            {connected ? 'Live' : 'Reconnecting'}
          </motion.span>

          <button
            type="button"
            onClick={(e) => toggle(e.currentTarget.getBoundingClientRect())}
            aria-label={`Switch to ${mode === 'dark' ? 'light' : 'dark'} theme`}
            className="grid size-11 place-items-center rounded-[0.875rem] border border-line bg-surface text-muted transition-colors hover:border-[var(--primary)] hover:text-ink"
          >
            <motion.span
              key={mode}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
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
          </button>

          <Button variant="ghost" onClick={onStaff}>
            Team
          </Button>

          <Button variant="ghost" onClick={onSignOut}>
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
