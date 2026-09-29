import { forwardRef, useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Button } from './Button';
import { severityWord, toneForSeverity } from '../lib/status';
import { distance, minutes, countdown, clockTime } from '../lib/format';
import { ContactSummary, MechanismLine } from './CaseFacts';
import { useHoverFx } from '../lib/useHoverFx';
import type { Offer } from '../types';

export const OfferCard = forwardRef<
  HTMLElement,
  {
    offer: Offer;
    busy: boolean;
    canAct: boolean;
    onAccept: () => void;
    onDecline: () => void;
    onOpen: () => void;
  }
>(function OfferCard({ offer, busy, canAct, onAccept, onDecline, onOpen }, ref) {
  const reduce = useReducedMotion();
  const { node, onPointerMove, onPointerLeave } = useHoverFx();
  const [remaining, setRemaining] = useState(() => countdown(offer.expires_at));
  const tone = toneForSeverity(offer.incident.severity);
  const patient = offer.incident.patient;

  useEffect(() => {
    const timer = window.setInterval(() => setRemaining(countdown(offer.expires_at)), 1000);
    return () => window.clearInterval(timer);
  }, [offer.expires_at]);

  return (
    <motion.article
      ref={ref}
      layout
      data-tone={tone}
      initial={reduce ? false : { opacity: 0, y: -14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? undefined : { opacity: 0, scale: 0.96, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 360, damping: 32, mass: 0.8 }}
      className="card relative overflow-hidden ring-1 ring-[color-mix(in_oklab,var(--tone)_35%,transparent)]"
    >
      <div
        ref={node}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        className="fx p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip rounded-full px-2.5 py-1 text-xs font-semibold">
                {offer.broadcast ? 'Open to all hospitals' : 'Offered to you'}
              </span>
              <span className="chip rounded-full px-2.5 py-1 text-xs font-semibold">
                {severityWord(offer.incident.severity)}
              </span>
            </div>
            <h3 className="mt-2 text-lg leading-snug font-semibold tracking-tight">
              {patient?.name ? `${patient.name} needs a hospital` : 'A crash needs a hospital'}
            </h3>
            <MechanismLine mechanism={offer.incident.mechanism} />

            <dl className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
              <div className="flex gap-1.5">
                <dt className="text-muted">Crash at</dt>
                <dd className="tnum font-medium">{clockTime(offer.incident.occurred_at) ?? 'just now'}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-muted">Severity</dt>
                <dd className="tnum font-medium">
                  {offer.incident.severity.toFixed(1)}
                  <span className="text-muted">/10</span>
                </dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-muted">Distance</dt>
                <dd className="tnum font-medium">{distance(offer.distance_m)}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-muted">Drive time</dt>
                <dd className="tnum font-medium">
                  {offer.eta_seconds != null ? `about ${minutes(offer.eta_seconds)}` : 'unknown'}
                </dd>
              </div>
            </dl>

            <p className="mt-2 text-sm text-muted">
              {offer.incident.location.label ??
                `${offer.incident.location.lat.toFixed(4)}, ${offer.incident.location.lon.toFixed(4)}`}
            </p>
            <ContactSummary contacts={offer.incident.emergency_contacts} />
          </div>

          <div className="shrink-0 text-right">
            <p className="text-2xs font-semibold tracking-[0.08em] text-muted uppercase">Respond within</p>
            <p className="tnum text-2xl font-semibold">{remaining}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {canAct ? (
            <>
              <Button onClick={onAccept} disabled={busy}>
                {busy ? 'Taking the case…' : 'Accept this case'}
              </Button>
              <Button variant="ghost" onClick={onDecline} disabled={busy}>
                Pass
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted">A dispatcher can accept or pass this case.</p>
          )}
          <Button variant="ghost" onClick={onOpen}>
            See patient details
          </Button>
        </div>
      </div>
    </motion.article>
  );
});
