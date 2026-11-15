export function LoadingScreen({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="flex min-h-[40dvh] flex-col items-center justify-center gap-3 text-center">
      <svg
        width={30}
        height={30}
        viewBox="0 0 24 24"
        className="animate-spin text-[var(--primary)]"
        aria-hidden
      >
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.24" strokeWidth="2.5" />
        <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <p className="text-sm text-muted">{message}</p>
    </div>
  );
}
