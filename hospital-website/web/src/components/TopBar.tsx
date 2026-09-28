import { useTheme } from '../theme';

export function TopBar({
  connected,
  onReport,
  reporting,
}: {
  connected: boolean;
  onReport: () => void;
  reporting: boolean;
}) {
  const { mode, toggle } = useTheme();

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-line)] bg-[var(--color-surface)]/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--color-accent)] text-base font-bold text-white shadow-soft">
            R+
          </div>
          <div className="leading-tight">
            <p className="text-[15px] font-semibold">Response Hub</p>
            <p className="text-xs text-[var(--color-muted)]">Emergency department</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2.5">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ${
              connected
                ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/25'
                : 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/25'
            }`}
          >
            <span className="relative flex h-2 w-2">
              {connected && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              )}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            </span>
            {connected ? 'Live' : 'Reconnecting'}
          </span>

          <button
            onClick={toggle}
            aria-label="Switch colour theme"
            className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)] transition hover:text-[var(--color-ink)] active:scale-95"
          >
            {mode === 'dark' ? (
              <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 13.2A8.5 8.5 0 1 1 10.8 3a6.8 6.8 0 0 0 10.2 10.2Z" />
              </svg>
            )}
          </button>

          <button
            onClick={onReport}
            disabled={reporting}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 text-sm font-semibold text-white shadow-soft transition hover:opacity-90 active:scale-[0.97] disabled:opacity-60"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            {reporting ? 'Reporting…' : 'Report a crash'}
          </button>
        </div>
      </div>
    </header>
  );
}
