import { forwardRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { plainFor, severityWord, toneForSeverity } from '../lib/status';
import { ago, minutes } from '../lib/format';
import { Stepper } from './Stepper';
import type { Incident } from '../types';

const TONE_VAR: Record<string, string> = {
  critical: 'var(--sev-critical)',
  serious: 'var(--sev-serious)',
  moderate: 'var(--sev-moderate)',
  mild: 'var(--sev-mild)',
};

export const IncidentCard = forwardRef<
  HTMLElement,
  {
    incident: Incident;
    hospitalName: string;
    busy: boolean;
    onAdvance: () => void;
    onCancel: () => void;
    onOpen: () => void;
  }
>(function IncidentCard(
  { incident, hospitalName, busy, onAdvance, onCancel, onOpen },
  ref,
) {
  const reduce = useReducedMotion();
  const tone = toneForSeverity(incident.severity);
  const { headline, action } = plainFor(incident.status);
  const done = incident.status === 'closed' || incident.status === 'cancelled';
  const rail = TONE_VAR[tone];

  return (
    <motion.article
      ref={ref}
      layout
      data-tone={tone}
      initial={reduce ? false : { opacity: 0, y: 14, scale: 0.985 }}
      animate={{ opacity: done ? 0.66 : 1, y: 0, scale: 1 }}
      exit={reduce ? undefined : { opacity: 0, scale: 0.97, transition: { duration: 0.22 } }}
      transition={{ type: 'spring', stiffness: 380, damping: 34, mass: 0.8 }}
      whileHover={reduce ? undefined : { y: -3 }}
      className="card group relative flex overflow-hidden transition-shadow duration-300 hover:shadow-lift"
    >
      <span className="w-1 shrink-0 self-stretch" style={{ backgroundColor: rail }} aria-hidden />

      <div className="@container min-w-0 flex-1 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <motion.span
                key={severityWord(incident.severity)}
                initial={reduce ? false : { scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                className="chip rounded-full px-2.5 py-1 text-xs font-semibold"
              >
                {severityWord(incident.severity)}
              </motion.span>
              <span className="tnum text-xs text-muted">
                {ago(incident.created_at ?? incident.updated_at ?? new Date().toISOString())}
              </span>
            </div>

            <h3 className="mt-2 text-lg leading-snug font-semibold tracking-tight @xl:text-xl">
              {headline}
            </h3>

            <p className="mt-1 text-sm text-muted">
              {hospitalName}
              {incident.assignment.ambulance_ids.length === 1 && (
                <> · {incident.assignment.ambulance_ids[0]}</>
              )}
              {incident.assignment.ambulance_ids.length > 1 && (
                <> · {incident.assignment.ambulance_ids.length} ambulances</>
              )}
              {incident.status === 'en_route_to_scene' && incident.eta_scene_seconds != null && (
                <> · arrives in {minutes(incident.eta_scene_seconds)}</>
              )}
              {incident.status === 'en_route_to_hospital' && incident.eta_hospital_seconds != null && (
                <> · patient arrives in {minutes(incident.eta_hospital_seconds)}</>
              )}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {action && !done && (
              <motion.button
                whileTap={reduce ? undefined : { scale: 0.96 }}
                onClick={onAdvance}
                disabled={busy}
                className="btn btn-primary disabled:opacity-50"
              >
                {busy && (
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    className="size-3.5 rounded-full border-2 border-current border-t-transparent"
                  />
                )}
                {action}
              </motion.button>
            )}
            <motion.button
              whileTap={reduce ? undefined : { scale: 0.96 }}
              onClick={onOpen}
              className="btn btn-ghost"
            >
              Details
            </motion.button>
          </div>
        </div>

        <div className="mt-4">
          <Stepper status={incident.status} tone={rail} />
        </div>

        {!done && (
          <motion.button
            whileTap={reduce ? undefined : { scale: 0.96 }}
            onClick={onCancel}
            disabled={busy}
            className="press mt-1 inline-flex min-h-10 items-center rounded-lg px-2.5 text-xs font-medium text-muted hover:bg-[color-mix(in_oklab,var(--sev-critical)_10%,transparent)] hover:text-[var(--sev-critical)] disabled:opacity-50"
          >
            Cancel this call
          </motion.button>
        )}
      </div>
    </motion.article>
  );
});
