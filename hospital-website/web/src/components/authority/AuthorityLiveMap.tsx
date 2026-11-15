import { useEffect, useMemo, useState } from 'react';
import { fetchAuthorityIncident, fetchAuthorityOverview, type AuthorityOverview } from '../../api';
import type { Incident } from '../../types';
import { LiveMap } from '../LiveMap';
import { plainFor, severityWord, toneForSeverity } from '../../lib/status';
import { duration } from './chart';
import '../platform-admin.css';

const REFRESH_MS = 5_000;
const STATUS_ORDER = [
  'detected',
  'contacts_notified',
  'ambulance_assigned',
  'en_route_to_scene',
  'on_scene',
  'en_route_to_hospital',
  'at_hospital',
];

type MapLayer = 'hospitals' | 'incidents' | 'ambulances';
type SeverityFilter = 'all' | '5' | '7' | '8';

function formatClock(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function caseId(alertId: string) {
  return `Case #${alertId.slice(-6)}`;
}

function severityColor(severity: number) {
  if (severity >= 8) return 'var(--sev-critical)';
  if (severity >= 5.5) return 'var(--sev-serious)';
  if (severity >= 3) return 'var(--sev-moderate)';
  return 'var(--sev-mild)';
}

function CaseDrawer({
  alertId,
  fallback,
  onClose,
}: {
  alertId: string;
  fallback: Incident;
  onClose: () => void;
}) {
  const [details, setDetails] = useState<Incident | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDetails(null);
    setError(null);
    fetchAuthorityIncident(alertId)
      .then((value) => {
        if (!cancelled) setDetails(value);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [alertId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const incident = details ?? fallback;
  const events = details?.events ?? [];
  const governorate = incident.location.governorate;

  return (
    <div className="fixed inset-0 z-[3000] flex justify-end">
      <button
        type="button"
        aria-label="Close case details"
        onClick={onClose}
        className="absolute inset-0 bg-black/35 backdrop-blur-[1px]"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${caseId(alertId)} details`}
        className="relative h-full w-full max-w-md overflow-y-auto border-l border-line bg-[var(--surface)] shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-line bg-[var(--surface)] px-5 py-4">
          <div>
            <p className="text-2xs font-semibold tracking-[0.12em] text-muted uppercase">Active case</p>
            <h2 className="mt-0.5 text-lg font-semibold tracking-tight">{caseId(alertId)}</h2>
            <p className="text-xs text-muted">{incident.location.label ?? 'Location not recorded'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold hover:bg-[var(--surface-2)]"
          >
            Close
          </button>
        </div>

        <div className="space-y-5 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip rounded-full px-2 py-0.5 text-2xs font-semibold" data-tone={toneForSeverity(incident.severity)}>
              {severityWord(incident.severity)} · {incident.severity.toFixed(1)}
            </span>
            <span className="text-xs text-muted">{plainFor(incident.status).headline}</span>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-2xs font-semibold tracking-wide text-muted uppercase">Governorate</dt>
              <dd>{governorate ?? 'Unknown'}</dd>
            </div>
            <div>
              <dt className="text-2xs font-semibold tracking-wide text-muted uppercase">Hospital</dt>
              <dd>{incident.assignment.accepted ? 'Assigned' : 'Not accepted yet'}</dd>
            </div>
            <div>
              <dt className="text-2xs font-semibold tracking-wide text-muted uppercase">Reported</dt>
              <dd>{formatClock(incident.created_at)}</dd>
            </div>
            <div>
              <dt className="text-2xs font-semibold tracking-wide text-muted uppercase">Destination</dt>
              <dd className="capitalize">{incident.destination.replace(/_/g, ' ')}</dd>
            </div>
            <div>
              <dt className="text-2xs font-semibold tracking-wide text-muted uppercase">ETA to scene</dt>
              <dd>{duration(incident.eta_scene_seconds)}</dd>
            </div>
            <div>
              <dt className="text-2xs font-semibold tracking-wide text-muted uppercase">ETA to hospital</dt>
              <dd>{duration(incident.eta_hospital_seconds)}</dd>
            </div>
          </dl>

          {incident.severity_summary && (
            <div className="rounded-xl border border-line bg-[var(--surface-2)] p-3 text-sm">
              {incident.severity_summary}
            </div>
          )}

          {incident.patient && (
            <div>
              <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">Casualty</h3>
              <p className="mt-1.5 text-sm">
                {incident.patient.age != null ? `${incident.patient.age} years` : 'Age not recorded'}
                {incident.patient.gender ? ` · ${incident.patient.gender}` : ''}
                {incident.patient.blood_type ? ` · ${incident.patient.blood_type}` : ''}
              </p>
              <p className="mt-1 text-xs text-muted">Name is withheld on the national operational view.</p>
            </div>
          )}

          <div>
            <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">Timeline</h3>
            {error && <p className="mt-2 text-xs text-[var(--sev-critical)]">{error}</p>}
            {!events.length && !error ? (
              <p className="mt-2 text-xs text-muted">Loading the case timeline…</p>
            ) : (
              <ol className="mt-2 space-y-0">
                {events.map((event, index) => (
                  <li key={`${event.status}-${event.created_at}-${index}`} className="relative flex gap-3 pb-4 last:pb-0">
                    <span className="relative mt-1 flex size-2.5 shrink-0 rounded-full bg-[var(--primary)]">
                      {index < events.length - 1 && (
                        <span className="absolute top-2.5 left-1/2 h-[calc(100%+0.55rem)] w-px -translate-x-1/2 bg-line" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold">{plainFor(event.status).headline}</p>
                      <p className="text-2xs text-muted">
                        {formatClock(event.created_at)}
                        {event.note ? ` · ${event.note}` : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

export function AuthorityLiveMap() {
  const [data, setData] = useState<AuthorityOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [focus, setFocus] = useState<string | null>(null);
  const [focusHospital, setFocusHospital] = useState<number | null>(null);
  const [governorate, setGovernorate] = useState('all');
  const [status, setStatus] = useState('all');
  const [severity, setSeverity] = useState<SeverityFilter>('all');
  const [layers, setLayers] = useState<Set<MapLayer>>(
    () => new Set<MapLayer>(['hospitals', 'incidents', 'ambulances']),
  );

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      fetchAuthorityOverview()
        .then((value) => {
          if (cancelled) return;
          setData(value);
          setError(null);
          setUpdatedAt(new Date());
        })
        .catch((e) => {
          if (!cancelled) setError(e.message);
        });
    };

    load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, REFRESH_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [reloadToken]);

  const hospitals = data?.hospitals ?? [];
  const ambulances = data?.ambulances ?? [];
  const incidents = data?.incidents ?? [];

  const inService = useMemo(
    () => ambulances.filter((unit) => unit.status !== 'out_of_service'),
    [ambulances],
  );

  const governorates = useMemo(
    () =>
      Array.from(
        new Set(
          incidents
            .map((incident) => incident.location.governorate)
            .filter((name): name is string => Boolean(name)),
        ),
      ).sort(),
    [incidents],
  );

  const filteredIncidents = useMemo(() => {
    const minimum = severity === 'all' ? 0 : Number(severity);
    return incidents
      .filter((incident) => governorate === 'all' || incident.location.governorate === governorate)
      .filter((incident) => status === 'all' || incident.status === status)
      .filter((incident) => incident.severity >= minimum)
      .sort((a, b) => b.severity - a.severity || String(b.created_at).localeCompare(String(a.created_at)));
  }, [incidents, governorate, status, severity]);

  const selected = useMemo(
    () => filteredIncidents.find((incident) => incident.alert_id === focus) ?? null,
    [filteredIncidents, focus],
  );

  const toggleLayer = (layer: MapLayer) => {
    setLayers((current) => {
      const next = new Set(current);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return next;
    });
  };

  const resetFilters = () => {
    setGovernorate('all');
    setStatus('all');
    setSeverity('all');
  };

  if (error && !data) {
    return (
      <div className="card space-y-3 p-6 text-sm">
        <p className="font-semibold text-ink">The live national picture could not be loaded.</p>
        <p className="text-muted">{error}</p>
        <button
          type="button"
          onClick={() => setReloadToken((value) => value + 1)}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data) {
    return <div className="card h-[520px] animate-pulse bg-[var(--surface-2)]" aria-label="Loading live map" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-muted">
        <span className="flex items-center gap-2">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--sev-mild)] opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-[var(--sev-mild)]" />
          </span>
          <span className="font-semibold tracking-[0.08em] uppercase">Live</span>
          <span className="tnum">
            {filteredIncidents.length} of {incidents.length} active · {hospitals.length} hospitals · {inService.length} units
          </span>
          <span className="rounded-full border border-line px-2 py-0.5 text-2xs font-semibold">Demo data</span>
        </span>
        <span className="tnum">
          {updatedAt
            ? `Updated ${updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
            : 'Connecting…'}
        </span>
        {error && <span className="text-[var(--sev-critical)]">{error}</span>}
      </div>

      <div className="card flex flex-wrap items-end gap-3 p-3">
        <label className="flex min-w-40 flex-1 flex-col gap-1 text-2xs font-semibold tracking-wide text-muted uppercase">
          Governorate
          <select
            value={governorate}
            onChange={(event) => setGovernorate(event.target.value)}
            className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-normal text-ink normal-case outline-none focus:border-[var(--primary)]"
          >
            <option value="all">All governorates</option>
            {governorates.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-40 flex-1 flex-col gap-1 text-2xs font-semibold tracking-wide text-muted uppercase">
          Status
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-normal text-ink normal-case outline-none focus:border-[var(--primary)]"
          >
            <option value="all">All active statuses</option>
            {STATUS_ORDER.map((key) => (
              <option key={key} value={key}>
                {plainFor(key).headline}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-2xs font-semibold tracking-wide text-muted uppercase">Minimum severity</span>
          <div className="flex gap-1.5">
            {(['all', '5', '7', '8'] as SeverityFilter[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setSeverity(value)}
                className="rounded-full px-3 py-1 text-xs font-medium"
                style={
                  severity === value
                    ? { background: 'var(--primary)', color: 'var(--primary-fg)' }
                    : { background: 'var(--surface-2)', color: 'var(--muted)' }
                }
              >
                {value === 'all' ? 'Any' : `${value}+`}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={resetFilters}
          disabled={governorate === 'all' && status === 'all' && severity === 'all'}
          className="text-xs text-muted underline-offset-2 hover:text-ink hover:underline disabled:opacity-40"
        >
          Reset
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(20rem,0.9fr)]">
        <div className="space-y-2">
          <LiveMap
            networkView
            networkHospitals={hospitals}
            ambulances={ambulances}
            incidents={filteredIncidents}
            focus={focus}
            focusHospital={focusHospital}
            onFocusCase={setFocus}
            onFocusHospital={setFocusHospital}
            visibleLayers={layers}
            onToggleLayer={toggleLayer}
          />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-[var(--surface)] px-4 py-2.5 text-2xs text-muted">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[#0f766e]" /> Hospital</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[#c0392b]" /> Critical case</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[#d97706]" /> Serious</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[#2563eb]" /> Moderate</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[#0d9488]" /> Mild</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[#dc2626]" /> Ambulance moving</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[#64748b]" /> Ambulance ready</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 rounded bg-[#669df8] ring-1 ring-[#1a5fb4]/40" /> Active route</span>
          </div>
        </div>

        <aside className="card flex max-h-[640px] flex-col overflow-hidden">
          <div className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold tracking-tight">Active case queue</h2>
              <p className="text-xs text-muted">Highest severity first · select to inspect</p>
            </div>
            <span className="chip rounded-full px-2 py-0.5 text-2xs font-semibold" data-tone="serious">
              {filteredIncidents.length}
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {filteredIncidents.length ? (
              <ul className="space-y-1.5">
                {filteredIncidents.map((incident) => (
                  <li key={incident.alert_id}>
                    <button
                      type="button"
                      onClick={() => setFocus(incident.alert_id)}
                      className={`flex w-full items-start gap-2.5 rounded-xl border p-2.5 text-left transition-colors hover:bg-[var(--surface-2)] ${
                        focus === incident.alert_id ? 'border-[var(--primary)]' : 'border-transparent'
                      }`}
                    >
                      <span
                        className="mt-1 size-2.5 shrink-0 rounded-full"
                        style={{ background: severityColor(incident.severity) }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-semibold">{caseId(incident.alert_id)}</span>
                          <span className="shrink-0 text-2xs font-semibold">{incident.severity.toFixed(1)}</span>
                        </span>
                        <span className="mt-0.5 block truncate text-2xs text-muted">
                          {incident.location.label ?? 'Location not recorded'}
                        </span>
                        <span className="mt-1 flex items-center justify-between gap-2 text-2xs text-muted">
                          <span className="truncate">
                            {plainFor(incident.status).headline}
                            {incident.hospital_name ? ` · ${incident.hospital_name}` : ''}
                          </span>
                          <span className="shrink-0">{formatClock(incident.created_at)}</span>
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-4 text-sm text-muted">
                No active cases match these filters. Widen the severity or choose another governorate.
              </p>
            )}
          </div>
        </aside>
      </div>

      {selected && (
        <CaseDrawer
          alertId={selected.alert_id}
          fallback={selected as Incident}
          onClose={() => setFocus(null)}
        />
      )}
    </div>
  );
}
