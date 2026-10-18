import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { useHoverFx } from '../../lib/useHoverFx';
import { AnimatedNumber } from '../AnimatedNumber';

const EASE = [0.22, 1, 0.36, 1] as const;

export function Panel({
  title,
  hint,
  action,
  tone,
  delay = 0,
  className = '',
  children,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  tone?: string;
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  const { node, onPointerMove, onPointerLeave } = useHoverFx();
  const reduce = useReducedMotion();

  return (
    <motion.div
      ref={node}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      data-tone={tone}
      initial={reduce ? false : { opacity: 0, y: 12 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4, ease: EASE, delay }}
      className={`card fx p-5 ${className}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </motion.div>
  );
}

export function StatCard({
  label,
  value,
  format,
  icon,
  tone = 'mild',
  delay = 0,
}: {
  label: string;
  value: number | string;
  format?: (n: number) => string;
  icon: ReactNode;
  tone?: 'critical' | 'serious' | 'moderate' | 'mild';
  delay?: number;
}) {
  const { node, onPointerMove, onPointerLeave } = useHoverFx();
  const reduce = useReducedMotion();

  return (
    <motion.div
      ref={node}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      data-tone={tone}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{ duration: 0.35, ease: EASE, delay }}
      className="card fx relative overflow-hidden p-4"
    >
      <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: 'var(--tone)' }} />
      <div className="flex items-center gap-2">
        <span
          className="grid size-7 shrink-0 place-items-center rounded-[0.6rem]"
          style={{
            background: 'color-mix(in oklab, var(--tone) 15%, transparent)',
            color: 'var(--tone-ink)',
          }}
        >
          {icon}
        </span>
        <p className="truncate text-xs font-medium text-muted">{label}</p>
      </div>
      <p className="mt-2.5 text-2xl font-semibold leading-none tracking-tight">
        {typeof value === 'number' ? <AnimatedNumber value={value} format={format} /> : value}
      </p>
    </motion.div>
  );
}

export function Icon({ children, className = 'size-4' }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export const Icons = {
  incident: (
    <Icon>
      <path d="M10.3 3.9 2.4 17.5a1.8 1.8 0 0 0 1.6 2.7h15.9a1.8 1.8 0 0 0 1.6-2.7L13.6 3.9a1.8 1.8 0 0 0-3.3 0Z" />
      <path d="M12 9v4m0 3.5h.01" />
    </Icon>
  ),
  severity: (
    <Icon>
      <path d="M12 3a9 9 0 1 0 9 9" />
      <path d="M12 12 16.5 7.5M12 3v6" />
    </Icon>
  ),
  severe: (
    <Icon>
      <path d="M12 2c1 3-1 4-1 7a3 3 0 0 0 6 0c1.6 3 2 4 2 6a7 7 0 1 1-14 0c0-3 2-5 3-7 0 2 1 3 2 3 0-4-1-6 2-9Z" />
    </Icon>
  ),
  critical: (
    <Icon>
      <path d="M12 3.5 4 6v5.5c0 4.4 3.2 7.7 8 9 4.8-1.3 8-4.6 8-9V6l-8-2.5Z" />
      <path d="M12 8v3.5m0 3h.01" />
    </Icon>
  ),
  unclaimed: (
    <Icon>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Icon>
  ),
  response: (
    <Icon>
      <path d="M12 8v4l2.5 2" />
      <circle cx="12" cy="12" r="8.5" />
      <path d="M5 3.5 3 5.5m16-2 2 2" />
    </Icon>
  ),
  hospital: (
    <Icon>
      <path d="M5 21V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v15" />
      <path d="M3 21h18M12 8v6m-3-3h6" />
    </Icon>
  ),
  region: (
    <Icon>
      <path d="M12 21s6.5-5.6 6.5-10.5A6.5 6.5 0 1 0 5.5 10.5C5.5 15.4 12 21 12 21Z" />
      <circle cx="12" cy="10.5" r="2.2" />
    </Icon>
  ),
};
