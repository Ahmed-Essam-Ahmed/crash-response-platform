import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { toneForSeverity } from '../lib/status';
import type { Tone } from '../lib/status';
import type { Ambulance, Hospital, Incident } from '../types';

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const SEVERITY: Record<Tone, string> = {
  critical: '#c0392b',
  serious: '#d97706',
  moderate: '#2563eb',
  mild: '#0d9488',
};

const MOVING = new Set(['en_route', 'on_scene', 'transporting']);

type LatLng = [number, number];

function toPairs(points: { lat: number; lon: number }[] | undefined): LatLng[] {
  if (!points || points.length < 2) return [];
  return points.map((p) => [p.lat, p.lon] as LatLng);
}

function routeShape(
  incident: Incident,
  hospital: LatLng,
  crash: LatLng,
): { line: LatLng[]; style: L.PolylineOptions; casing: L.PolylineOptions } {
  const color = SEVERITY[toneForSeverity(incident.severity)];
  const outbound = toPairs(incident.route?.outbound);
  const inbound = toPairs(incident.route?.inbound);
  const returning = incident.status === 'en_route_to_hospital' || incident.status === 'at_hospital';

  const line = returning
    ? inbound.length
      ? inbound
      : [crash, hospital]
    : outbound.length
      ? outbound
      : [hospital, crash];

  // Leaflet simplifies a polyline before drawing it, which is what turns a real
  // street-for-street route back into something that looks like a straight line.
  const style: L.PolylineOptions = returning
    ? { color, weight: 4, opacity: 0.9, smoothFactor: 0 }
    : { color, weight: 4, opacity: 0.85, dashArray: '7 8', smoothFactor: 0 };

  return {
    line,
    style,
    casing: { color: '#0b1220', weight: 8, opacity: 0.35, lineCap: 'round', smoothFactor: 0 },
  };
}

function pin(color: string, glyph: string, ring: string) {
  return L.divIcon({
    className: 'live-pin',
    iconSize: [30, 40],
    iconAnchor: [15, 38],
    popupAnchor: [0, -34],
    html: `<svg width="30" height="40" viewBox="0 0 30 40" aria-hidden="true">
        <path d="M15 39C15 39 28 24.5 28 15A13 13 0 1 0 2 15C2 24.5 15 39 15 39Z"
              fill="${color}" stroke="${ring}" stroke-width="1.5"/>
        <circle cx="15" cy="15" r="7.5" fill="none" stroke="#fff" stroke-width="1.5" opacity="0.95"/>
        <text x="15" y="19.2" text-anchor="middle" font-size="11" font-weight="700" fill="#fff"
              font-family="system-ui, -apple-system, sans-serif">${glyph}</text>
      </svg>`,
  });
}

const HOSPITAL_ICON = pin('#0f766e', 'H', '#0b4f4a');
const AMBULANCE_ICON = (moving: boolean) =>
  pin(
    moving ? '#dc2626' : '#64748b',
    moving ? '+' : 'A',
    moving ? '#7f1d1d' : '#334155',
  );

function crashIcon(tone: Tone) {
  return pin(SEVERITY[tone], '!', '#1f2937');
}

function escape(value: string | null | undefined) {
  return (value ?? '').replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
}

const FRAME = { padding: [34, 34] as [number, number], maxZoom: 15, animate: true };

function contentBounds(hospital: Hospital, incidents: Incident[], ambulances: Ambulance[]) {
  const bounds = L.latLngBounds([[hospital.lat, hospital.lon]]);
  for (const incident of incidents) {
    if (incident.status === 'closed' || incident.status === 'cancelled') continue;
    bounds.extend([incident.location.lat, incident.location.lon]);
    toPairs(incident.route?.outbound).forEach(([lat, lon]) => bounds.extend([lat, lon]));
    toPairs(incident.route?.inbound).forEach(([lat, lon]) => bounds.extend([lat, lon]));
  }
  for (const amb of ambulances) {
    if (amb.status === 'out_of_service') continue;
    bounds.extend([amb.lat, amb.lon]);
  }
  return bounds;
}

function frameAll(
  instance: L.Map,
  hospital: Hospital,
  incidents: Incident[],
  ambulances: Ambulance[],
) {
  const bounds = contentBounds(hospital, incidents, ambulances);
  if (bounds.isValid()) instance.fitBounds(bounds, FRAME);
  else instance.setView([hospital.lat, hospital.lon], 14, { animate: true });
}

function recenter(
  instance: L.Map,
  hospital: Hospital,
  incidents: Incident[],
  ambulances: Ambulance[],
) {
  const bounds = contentBounds(hospital, incidents, ambulances);
  if (bounds.isValid()) instance.flyToBounds(bounds, { ...FRAME, duration: 0.7 });
  else instance.flyTo([hospital.lat, hospital.lon], 14, { duration: 0.7 });
}

export function LiveMap({
  hospital,
  ambulances,
  incidents,
  focus,
  onFocusCase,
}: {
  hospital: Hospital;
  ambulances: Ambulance[];
  incidents: Incident[];
  focus?: string | null;
  onFocusCase?: (alertId: string) => void;
}) {
  const holder = useRef<HTMLDivElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const layers = useRef<{
    hospital: L.Marker;
    crashes: Map<string, L.Marker>;
    lines: Map<string, { casing: L.Polyline; line: L.Polyline }>;
    fleet: Map<string, L.Marker>;
  } | null>(null);
  const fitted = useRef(false);

  useEffect(() => {
    if (!holder.current || map.current) return;
    const instance = L.map(holder.current, {
      zoomControl: false,
      attributionControl: true,
    }).setView([hospital.lat, hospital.lon], 13);

    L.control.zoom({ position: 'bottomright' }).addTo(instance);
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(instance);

    const anchor = L.marker([hospital.lat, hospital.lon], {
      icon: HOSPITAL_ICON,
      zIndexOffset: 600,
      keyboard: false,
    })
      .addTo(instance)
      .bindPopup(`<strong>${escape(hospital.name)}</strong><br/>Your hospital`);

    map.current = instance;
    layers.current = { hospital: anchor, crashes: new Map(), lines: new Map(), fleet: new Map() };

    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(holder.current);
    return () => {
      observer.disconnect();
      instance.off();
      instance.remove();
      map.current = null;
      layers.current = null;
      fitted.current = false;
    };
  }, [hospital.lat, hospital.lon, hospital.name]);

  useEffect(() => {
    const instance = map.current;
    const store = layers.current;
    if (!instance || !store) return;

    const live = incidents.filter((i) => i.status !== 'closed' && i.status !== 'cancelled');
    const liveIds = new Set(live.map((i) => i.alert_id));

    for (const [alertId, marker] of store.crashes) {
      if (!liveIds.has(alertId)) {
        marker.remove();
        store.crashes.delete(alertId);
      }
    }
    for (const [alertId, pair] of store.lines) {
      if (!liveIds.has(alertId)) {
        pair.casing.remove();
        pair.line.remove();
        store.lines.delete(alertId);
      }
    }

    for (const incident of live) {
      const tone = toneForSeverity(incident.severity);
      const point: L.LatLngExpression = [incident.location.lat, incident.location.lon];
      const heading = incident.assignment.accepted
        ? incident.status === 'en_route_to_hospital' || incident.status === 'on_scene'
          ? `${incident.location.label ?? 'Crash'} &rarr; you`
          : `You &rarr; ${incident.location.label ?? 'crash'}`
        : 'Offered to you';

      const existing = store.crashes.get(incident.alert_id);
      if (existing) {
        existing.setLatLng(point);
        existing.setIcon(crashIcon(tone));
        existing.setPopupContent(
          `<strong>${escape(incident.patient?.name ?? 'Crash')}</strong><br/>` +
            `${escape(incident.location.label ?? 'Unknown location')}<br/>` +
            `${escape(heading)}`,
        );
      } else {
        store.crashes.set(
          incident.alert_id,
          L.marker(point, { icon: crashIcon(tone), zIndexOffset: 500, keyboard: false })
            .addTo(instance)
            .bindPopup(
              `<strong>${escape(incident.patient?.name ?? 'Crash')}</strong><br/>` +
                `${escape(incident.location.label ?? 'Unknown location')}<br/>` +
                `${escape(heading)}`,
            )
            .on('click', () => onFocusCase?.(incident.alert_id)),
        );
      }

      if (incident.assignment.accepted) {
        const current = store.lines.get(incident.alert_id);
        const shape = routeShape(incident, [hospital.lat, hospital.lon], [incident.location.lat, incident.location.lon]);
        if (current) {
          current.casing.setLatLngs(shape.line);
          current.casing.setStyle(shape.casing);
          current.line.setLatLngs(shape.line);
          current.line.setStyle(shape.style);
        } else {
          const casing = L.polyline(shape.line, shape.casing).addTo(instance);
          const line = L.polyline(shape.line, shape.style).addTo(instance);
          casing.bringToBack();
          store.lines.set(incident.alert_id, { casing, line });
        }
      }
    }

    const seen = new Set<string>();
    for (const amb of ambulances) {
      if (amb.status === 'out_of_service') continue;
      seen.add(amb.ambulance_id);
      const moving = MOVING.has(amb.status);
      const point: L.LatLngExpression = [amb.lat, amb.lon];
      const existing = store.fleet.get(amb.ambulance_id);
      const text = moving
        ? `<strong>${escape(amb.label ?? amb.ambulance_id)}</strong><br/>${escape(amb.status.replace(/_/g, ' '))}`
        : `<strong>${escape(amb.label ?? amb.ambulance_id)}</strong><br/>Ready at your hospital`;
      if (existing) {
        existing.setLatLng(point);
        existing.setIcon(AMBULANCE_ICON(moving));
        existing.setPopupContent(text);
      } else {
        store.fleet.set(
          amb.ambulance_id,
          L.marker(point, { icon: AMBULANCE_ICON(moving), zIndexOffset: moving ? 700 : 300, keyboard: false })
            .addTo(instance)
            .bindPopup(text),
        );
      }
    }
    for (const [id, marker] of store.fleet) {
      if (!seen.has(id)) {
        marker.remove();
        store.fleet.delete(id);
      }
    }

    if (!fitted.current) {
      frameAll(instance, hospital, live, ambulances);
      fitted.current = true;
    }
  }, [hospital, ambulances, incidents, onFocusCase]);

  useEffect(() => {
    const instance = map.current;
    const store = layers.current;
    if (!instance || !store || !focus) return;
    const target = store.crashes.get(focus);
    if (target) {
      instance.flyTo(target.getLatLng(), Math.max(instance.getZoom(), 15), { duration: 0.6 });
      target.openPopup();
    }
  }, [focus]);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 pt-4">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Live map</h2>
          <p className="text-xs text-muted">
            Your hospital, live cases, and where your ambulances are right now
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-2xs font-semibold tracking-[0.08em] text-muted uppercase">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--sev-mild)] opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-[var(--sev-mild)]" />
          </span>
          Live
        </span>
      </div>
      <div className="relative">
        <div ref={holder} className="live-map h-[320px] w-full sm:h-[380px]" />
        <button
          type="button"
          onClick={() => {
            const instance = map.current;
            if (instance) recenter(instance, hospital, incidents, ambulances);
          }}
          aria-label="Recentre the map on your hospital and current cases"
          className="press absolute top-3 right-3 z-[1050] grid size-11 place-items-center rounded-xl border border-line bg-[var(--surface)] text-ink shadow-soft hover:bg-[var(--surface-2)]"
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="3.2" />
            <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
          </svg>
        </button>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 px-5 py-3 text-2xs text-muted">
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-[#0f766e]" /> Your hospital
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-[#c0392b]" /> Critical case
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-[#d97706]" /> Serious
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-[#2563eb]" /> Moderate
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-[#0d9488]" /> Mild
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-[#dc2626]" /> Ambulance moving
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-[#64748b]" /> Ambulance ready
        </li>
      </ul>
    </div>
  );
}
