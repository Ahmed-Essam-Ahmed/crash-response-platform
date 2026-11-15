import type { ReactNode } from 'react';
import { CheckCircle2, Info, OctagonAlert, TriangleAlert } from 'lucide-react';
import { Icon } from './Icon';

export type Tone = 'primary' | 'signal' | 'success' | 'warning' | 'info';

function look(tone: Tone) {
  switch (tone) {
    case 'signal':
      return 'border-[color-mix(in_oklab,var(--signal)_40%,transparent)] bg-[var(--signal-soft)] text-[var(--signal-ink)]';
    case 'success':
      return 'border-[color-mix(in_oklab,var(--success)_34%,transparent)] bg-[color-mix(in_oklab,var(--success)_14%,var(--surface))] text-[color-mix(in_oklab,var(--success)_72%,var(--ink))]';
    case 'warning':
      return 'border-[color-mix(in_oklab,var(--warning)_40%,transparent)] bg-[color-mix(in_oklab,var(--warning)_18%,var(--surface))] text-[color-mix(in_oklab,var(--warning)_72%,var(--ink))]';
    case 'info':
      return 'border-[color-mix(in_oklab,var(--info)_34%,transparent)] bg-[color-mix(in_oklab,var(--info)_12%,var(--surface))] text-[color-mix(in_oklab,var(--info)_72%,var(--ink))]';
    default:
      return 'border-line surface-2 text-ink';
  }
}

function Glyph({ tone }: { tone: Tone }) {
  if (tone === 'signal') return <Icon icon={OctagonAlert} size={18} />;
  if (tone === 'success') return <Icon icon={CheckCircle2} size={18} />;
  if (tone === 'warning') return <Icon icon={TriangleAlert} size={18} />;
  return <Icon icon={Info} size={18} />;
}

export function Alert({
  children,
  tone = 'info',
  title,
  className = '',
}: {
  children: ReactNode;
  tone?: Tone;
  title?: ReactNode;
  className?: string;
}) {
  return (
    <div role="alert" className={`flex items-start gap-3 rounded-xl border p-3.5 text-sm ${look(tone)} ${className}`}>
      <span className="mt-0.5 shrink-0">
        <Glyph tone={tone} />
      </span>
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        <div className={title ? 'mt-0.5' : ''}>{children}</div>
      </div>
    </div>
  );
}
