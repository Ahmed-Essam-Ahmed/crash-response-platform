import type { ReactNode } from 'react';

export type TabItem<K extends string = string> = {
  key: K;
  label: ReactNode;
  count?: number;
};

export function Tabs<K extends string>({
  items,
  value,
  onChange,
  className = '',
}: {
  items: TabItem<K>[];
  value: K;
  onChange: (key: K) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={`inline-flex items-center gap-1 rounded-xl border border-line surface-2 p-1 ${className}`}
    >
      {items.map((item) => {
        const active = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.key)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
              active
                ? 'bg-surface text-ink shadow-[var(--shadow-soft)]'
                : 'text-muted hover:text-ink'
            }`}
          >
            {item.label}
            {typeof item.count === 'number' && (
              <span
                className={`tnum rounded-full px-1.5 text-2xs ${
                  active ? 'bg-[var(--primary-soft)] text-[var(--primary-ink)]' : 'surface-3 text-muted'
                }`}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
