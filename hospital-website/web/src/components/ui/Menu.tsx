import { useEffect, useRef, useState, type ReactNode } from 'react';

export function Menu({
  trigger,
  children,
  align = 'end',
  width = 240,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  children: (props: { close: () => void }) => ReactNode;
  align?: 'start' | 'end';
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      {trigger({ open, toggle: () => setOpen((prev) => !prev) })}
      {open && (
        <div
          role="menu"
          style={{ width }}
          className={`absolute z-50 mt-2 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-[var(--shadow-pop)] ${
            align === 'end' ? 'right-0' : 'left-0'
          }`}
        >
          {children({ close: () => setOpen(false) })}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  children,
  onClick,
  icon,
  danger = false,
  href,
}: {
  children: ReactNode;
  onClick?: () => void;
  icon?: ReactNode;
  danger?: boolean;
  href?: string;
}) {
  const className = `flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
    danger ? 'text-[var(--signal-ink)] hover:bg-[var(--signal-soft)]' : 'text-ink-soft hover:bg-surface-2 hover:text-ink'
  }`;
  const content = (
    <>
      {icon && <span className="shrink-0 text-current opacity-80">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </>
  );
  if (href) {
    return (
      <a role="menuitem" href={href} className={className} onClick={onClick}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" role="menuitem" className={className} onClick={onClick}>
      {content}
    </button>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <p className="px-3 pt-2 pb-1 text-2xs font-semibold tracking-wide text-muted uppercase">{children}</p>;
}

export function MenuSeparator() {
  return <div className="my-1 h-px bg-line" />;
}
