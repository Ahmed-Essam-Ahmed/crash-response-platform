import { STEPS, stepIndex } from '../lib/status';

export function Stepper({ status, tone }: { status: string; tone: string }) {
  const current = stepIndex(status);
  const done = status === 'closed';
  const cancelled = status === 'cancelled';
  const visible = STEPS.slice(0, done ? STEPS.length : current + 1);
  if (cancelled) {
    return (
      <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-muted)]">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
        Cancelled before a patient was assigned
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-1">
        {STEPS.map((step, i) => {
          const reached = i <= current;
          return (
            <span
              key={step.key}
              title={step.label}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${
                reached ? tone : 'bg-[var(--color-line)]'
              }`}
            />
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-[var(--color-muted)]">
        <span>{visible[0]?.label}</span>
        <span className="font-medium text-[var(--color-ink)]">{STEPS[current]?.label}</span>
        <span>Finished</span>
      </div>
    </div>
  );
}
