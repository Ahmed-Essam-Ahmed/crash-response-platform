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
    lines: Map<string, L.Polyline>;
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
    for (const [alertId, line] of store.lines) {
      if (!liveIds.has(alertId)) {
        line.remove();
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
        const line: L.LatLngExpression[] = [
          [hospital.lat, hospital.lon],
          point,
        ];
        const current = store.lines.get(incident.alert_id);
        const style = { color: SEVERITY[tone], weight: 3, opacity: 0.75, dashArray: '6 7' };
        if (current) {
          current.setLatLngs(line);
          current.setStyle(style);
        } else {
          store.lines.set(incident.alert_id, L.polyline(line, style).addTo(instance));
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

    const bounds = L.latLngBounds([[hospital.lat, hospital.lon]]);
    live.forEach((i) => bounds.extend([i.location.lat, i.location.lon]));
    ambulances
      .filter((a) => a.status !== 'out_of_service')
      .forEach((a) => bounds.extend([a.lat, a.lon]));

    if (bounds.isValid() && !fitted.current) {
      instance.fitBounds(bounds, { padding: [34, 34], maxZoom: 15 });
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
      <div ref={holder} className="live-map h-[320px] w-full sm:h-[380px]" />
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
