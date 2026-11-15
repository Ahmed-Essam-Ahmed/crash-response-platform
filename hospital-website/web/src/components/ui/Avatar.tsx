export function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-[var(--primary-soft)] font-semibold text-[var(--primary-ink)]"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden
    >
      {initials || '·'}
    </span>
  );
}
