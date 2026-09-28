import type { Hospital } from '../types';

export function CapacityPanel({
  hospitals,
  onSelect,
}: {
  hospitals: Hospital[];
  onSelect?: (hospitalId: string) => void;
}) {
  return (
    <div className="card shadow-soft p-5">
      <h2 className="text-sm font-semibold">Hospital capacity</h2>
      <ul className="mt-4 space-y-4">
        {hospitals.map((hospital) => {
          const used = hospital.current_load;
          const pct = hospital.capacity ? Math.round((used / hospital.capacity) * 100) : 0;
          const bar = pct >= 75 ? 'bg-rose-500' : pct >= 40 ? 'bg-amber-500' : 'bg-emerald-500';
          return (
            <li key={hospital.hospital_id}>
              <div className="flex items-baseline justify-between gap-2">
                <button
                  onClick={() => onSelect?.(hospital.hospital_id)}
                  className="-ml-2 min-h-9 truncate rounded-lg px-2 text-left text-sm font-medium transition hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-accent)]"
                >
                  {hospital.name}
                </button>
                <span className="shrink-0 text-xs tabular-nums text-[var(--color-muted)]">
                  {hospital.free_beds} free
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-line)]">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${bar}`}
                    style={{ width: `${Math.max(pct, used > 0 ? 6 : 0)}%` }}
                  />
                </div>
                <span className="w-14 shrink-0 text-right text-xs tabular-nums text-[var(--color-muted)]">
                  {used}/{hospital.capacity}
                </span>
              </div>
              <p className="mt-1.5 text-[11px] text-[var(--color-muted)]">Trauma level {hospital.trauma_level}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
