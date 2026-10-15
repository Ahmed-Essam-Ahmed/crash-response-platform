import { useEffect, useMemo, useRef } from 'react';
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

// Google Maps route blue, with a deeper blue underneath for the halo. Only one
// leg is ever drawn at a time, so the colour is not carrying direction.
const ROUTE_BLUE = '#669df8';
const ROUTE_CASING = '#1a5fb4';

type LatLng = [number, number];

function toPairs(points: { lat: number; lon: number }[] | undefined): LatLng[] {
  if (!points || points.length < 2) return [];
  return points.map((p) => [p.lat, p.lon] as LatLng);
}

function nearestVertex(line: LatLng[], at: LatLng) {
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < line.length; i++) {
    const dLat = line[i][0] - at[0];
    const dLon = (line[i][1] - at[1]) * Math.cos((at[0] * Math.PI) / 180);
    const distance = dLat * dLat + dLon * dLon;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return best;
}

// Draws only what is still ahead of the ambulance, so the travelled part of the
// road does not stay behind it. Keeps a stub at the destination once there is
// nothing left to travel, otherwise the route would blink out of existence.
function trimTravelled(line: LatLng[], at: LatLng | null) {
  if (!at || line.length < 2) return line;
  const remaining = [at, ...line.slice(nearestVertex(line, at) + 1)];
  return remaining.length >= 2 ? remaining : line.slice(-2);
}

function routeShape(
  incident: Incident,
  hospital: LatLng,
  crash: LatLng,
  ambulance: LatLng | null,
): { line: LatLng[]; style: L.PolylineOptions; casing: L.PolylineOptions } {
  const outbound = toPairs(incident.route?.outbound);
  const inbound = toPairs(incident.route?.inbound);
  const returning = incident.status === 'en_route_to_hospital' || incident.status === 'at_hospital';

  const line = trimTravelled(
    returning
      ? inbound.length
        ? inbound
        : [crash, hospital]
      : outbound.length
        ? outbound
        : [hospital, crash],
    ambulance,
  );

  // One leg is drawn at a time, so a solid line is enough to read as the road
  // ahead rather than two directions competing for the same style.
  const style: L.PolylineOptions = {
    color: ROUTE_BLUE,
    weight: 5,
    opacity: 0.95,
    lineCap: 'round',
    lineJoin: 'round',
    smoothFactor: 0,
  };

  return {
    line,
    style,
    casing: {
      color: ROUTE_CASING,
      weight: 9,
      opacity: 0.4,
      lineCap: 'round',
      lineJoin: 'round',
      smoothFactor: 0,
    },
  };
}

// Once the crew is standing at the crash the patient is being put in the
// ambulance, and the crash site stops being somewhere a dispatcher needs to
// look at. The case card still carries the address.
function showsCrashPin(status: string) {
  return status !== 'on_scene' && status !== 'en_route_to_hospital' && status !== 'at_hospital';
}

// Drawn only while there is road left to cover: out to the crash, then back
// from the crash to the hospital. On scene the crew is standing at the end of
// the outward leg, and at the hospital the inward one is finished.
function showsRouteLine(status: string) {
  return (
    status === 'ambulance_assigned' ||
    status === 'en_route_to_scene' ||
    status === 'en_route_to_hospital'
  );
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

type NetworkHospital = Hospital & { id: number };
type MapLayer = 'hospitals' | 'incidents' | 'ambulances';

function contentBounds(hospitals: Hospital[], incidents: Incident[], ambulances: Ambulance[]) {
  const bounds = L.latLngBounds(hospitals.map((item) => [item.lat, item.lon] as LatLng));
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
  hospitals: Hospital[],
  incidents: Incident[],
  ambulances: Ambulance[],
) {
  const bounds = contentBounds(hospitals, incidents, ambulances);
  if (bounds.isValid()) instance.fitBounds(bounds, FRAME);
  else instance.setView([26.75, 29.6], 5.4, { animate: true });
}

function recenter(
  instance: L.Map,
  hospitals: Hospital[],
  incidents: Incident[],
  ambulances: Ambulance[],
) {
  const bounds = contentBounds(hospitals, incidents, ambulances);
  if (bounds.isValid()) instance.flyToBounds(bounds, { ...FRAME, duration: 0.7 });
  else instance.flyTo([26.75, 29.6], 5.4, { duration: 0.7 });
}

export function LiveMap({
  hospital,
  networkHospitals,
  ambulances,
  incidents,
  focus,
  onFocusCase,
  onFocusHospital,
  focusHospital,
  networkView = false,
  visibleLayers,
  onToggleLayer,
}: {
  hospital?: Hospital;
  networkHospitals?: NetworkHospital[];
  ambulances: Ambulance[];
  incidents: Incident[];
  focus?: string | null;
  onFocusCase?: (alertId: string) => void;
  onFocusHospital?: (hospitalId: number) => void;
  focusHospital?: number | null;
  networkView?: boolean;
  visibleLayers?: Set<MapLayer>;
  onToggleLayer?: (layer: MapLayer) => void;
}) {
  const hospitalPoints = useMemo(
    () => networkHospitals?.length ? networkHospitals : hospital ? [hospital] : [],
    [networkHospitals, hospital],
  );
  const activeLayers = useMemo(
    () => visibleLayers ?? new Set<MapLayer>(['hospitals', 'incidents', 'ambulances']),
    [visibleLayers],
  );
  const holder = useRef<HTMLDivElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const layers = useRef<{
    hospitals: Map<string, L.Marker>;
    crashes: Map<string, L.Marker>;
    lines: Map<string, { casing: L.Polyline; line: L.Polyline }>;
    fleet: Map<string, L.Marker>;
  } | null>(null);
  const fitted = useRef(false);
  const crewPositions = useRef(new Map<string, LatLng>());

  useEffect(() => {
    if (!holder.current || map.current) return;
    const instance = L.map(holder.current, {
      zoomControl: false,
      attributionControl: true,
    }).setView(networkView ? [26.75, 29.6] : [hospital?.lat ?? 30.0444, hospital?.lon ?? 31.2357], networkView ? 5.4 : 13);

    L.control.zoom({ position: 'bottomright' }).addTo(instance);
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(instance);

    map.current = instance;
    layers.current = { hospitals: new Map(), crashes: new Map(), lines: new Map(), fleet: new Map() };

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
  }, [hospital?.lat, hospital?.lon, hospital?.name, networkView]);

  useEffect(() => {
    const instance = map.current;
    const store = layers.current;
    if (!instance || !store) return;

    const hospitalIds = new Set(activeLayers.has('hospitals') ? hospitalPoints.map((item) => item.hospital_id) : []);
    for (const [id, marker] of store.hospitals) {
      if (!hospitalIds.has(id)) { marker.remove(); store.hospitals.delete(id); }
    }
    for (const item of hospitalPoints) {
      if (!hospitalIds.has(item.hospital_id)) continue;
      const point: L.LatLngExpression = [item.lat, item.lon];
      const existing = store.hospitals.get(item.hospital_id);
      if (existing) existing.setLatLng(point);
      else {
        const marker = L.marker(point, { icon: HOSPITAL_ICON, zIndexOffset: 600, keyboard: false }).addTo(instance)
          .bindPopup(`<strong>${escape(item.name)}</strong><br/>${networkView ? `${item.free_beds} beds free` : 'Your hospital'}`);
        if (networkView && onFocusHospital && 'id' in item && typeof item.id === 'number') {
          const networkId = item.id;
          marker.on('click', () => onFocusHospital(networkId));
        }
        store.hospitals.set(item.hospital_id, marker);
      }
    }

    const live = incidents.filter((i) => i.status !== 'closed' && i.status !== 'cancelled');
    const pinnedIds = new Set(activeLayers.has('incidents') ? live.filter((i) => showsCrashPin(i.status)).map((i) => i.alert_id) : []);
    const routedIds = new Set(activeLayers.has('incidents') ? live.filter((i) => showsRouteLine(i.status)).map((i) => i.alert_id) : []);

    const crewByIncident = new Map<string, LatLng>();
    for (const incident of live) {
      for (const id of incident.assignment.ambulance_ids) {
        const unit = ambulances.find((a) => a.ambulance_id === id);
        if (unit) crewByIncident.set(incident.alert_id, [unit.lat, unit.lon]);
      }
    }
    crewPositions.current = crewByIncident;

    for (const [alertId, marker] of store.crashes) {
      if (!pinnedIds.has(alertId)) {
        marker.remove();
        store.crashes.delete(alertId);
      }
    }
    for (const [alertId, pair] of store.lines) {
      if (!routedIds.has(alertId)) {
        pair.casing.remove();
        pair.line.remove();
        store.lines.delete(alertId);
      }
    }

    for (const incident of live) {
      if (!pinnedIds.has(incident.alert_id)) continue;
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
    }

    for (const incident of live) {
      if (!incident.assignment.accepted || !routedIds.has(incident.alert_id)) continue;
      const current = store.lines.get(incident.alert_id);
      const unit = incident.assignment.ambulance_ids
        .map((id) => ambulances.find((a) => a.ambulance_id === id))
        .find((a): a is Ambulance => Boolean(a));
      const routeHospital = networkHospitals?.find((item) => item.id === unit?.hospital_id) ?? hospital;
      if (!routeHospital) continue;
      const shape = routeShape(
        incident,
        [routeHospital.lat, routeHospital.lon],
        [incident.location.lat, incident.location.lon],
        unit ? [unit.lat, unit.lon] : null,
      );
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

    const seen = new Set<string>();
    for (const amb of activeLayers.has('ambulances') ? ambulances : []) {
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
      if (networkView) instance.setView([26.75, 29.6], 5.4, { animate: true });
      else frameAll(instance, hospitalPoints, live, ambulances);
      fitted.current = true;
    }
  }, [hospital, hospitalPoints, networkHospitals, networkView, ambulances, incidents, onFocusCase, onFocusHospital, activeLayers]);

  useEffect(() => {
    const instance = map.current;
    const store = layers.current;
    if (!instance || !store || !focus) return;
    const target = store.crashes.get(focus);
    if (target) {
      instance.flyTo(target.getLatLng(), Math.max(instance.getZoom(), 15), { duration: 0.6 });
      target.openPopup();
      return;
    }
    // Once the crash pin is gone the interesting place is the crew carrying
    // the patient, so selecting the case lands on the ambulance instead.
    const unit = crewPositions.current.get(focus);
    if (unit) instance.flyTo(unit, Math.max(instance.getZoom(), 15), { duration: 0.6 });
  }, [focus]);

  useEffect(() => {
    if (focusHospital == null || !networkView) return;
    const point = networkHospitals?.find((item) => item.id === focusHospital);
    if (point && map.current) map.current.flyTo([point.lat, point.lon], Math.max(map.current.getZoom(), 10), { duration: 0.65 });
  }, [focusHospital, networkHospitals, networkView]);

  if (networkView) {
    return (
      <div className="adm-map-shell">
        <div className="adm-map-grid" aria-hidden />
        <div ref={holder} className="adm-map live-map" />
        <div className="adm-map-tools">
          <span className="adm-coordinate">EGYPT / NATIONAL VIEW</span>
          <button type="button" className="adm-square" aria-label="Reset map view" onClick={() => networkView ? map.current?.flyTo([26.75, 29.6], 5.4, { duration: 0.7 }) : map.current && recenter(map.current, hospitalPoints, incidents, ambulances)}>
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>
            </svg>
          </button>
        </div>
        <div className="adm-layer-control">
          <div className="adm-layer-heading">MAP LAYERS</div>
          {([['hospitals', 'Hospitals', 'cyan'], ['incidents', 'Incidents', 'red'], ['ambulances', 'Ambulances', 'green']] as [MapLayer, string, string][]).map(([layer, label, tone]) => (
            <button key={layer} className="adm-layer-row" onClick={() => onToggleLayer?.(layer)} aria-pressed={activeLayers.has(layer)}>
              <span className={`adm-layer-icon ${tone}`}><i /></span><span>{label}</span>
              <span className={`adm-toggle ${activeLayers.has(layer) ? 'on' : ''}`}><i /></span>
            </button>
          ))}
        </div>
      </div>
    );
  }

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
            if (instance) recenter(instance, hospitalPoints, incidents, ambulances);
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
