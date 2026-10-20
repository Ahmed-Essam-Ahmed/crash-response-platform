import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Hotspot } from '../../api-analytics';

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const EGYPT_VIEW: L.LatLngExpression = [26.75, 29.6];
const HOME_ZOOM = 6;
const FRAME = { padding: [28, 28] as [number, number], maxZoom: 14 };

const SCALE: { min: number; color: string; label: string }[] = [
  { min: 8, color: '#ff3b3b', label: 'Critical ≥8' },
  { min: 7, color: '#ff7a1a', label: 'Severe ≥7' },
  { min: 5, color: '#ffb020', label: 'Moderate ≥5' },
  { min: 0, color: '#4fbf86', label: 'Mild' },
];

function colorFor(severity: number) {
  return SCALE.find((s) => severity >= s.min)!.color;
}

function severityLabel(severity: number) {
  return SCALE.find((s) => severity >= s.min)!.label.replace(/ ≥.*$/, '').toLowerCase();
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
}

function zoneBounds(hotspots: Hotspot[]) {
  const points = hotspots.map((h) => [h.lat, h.lon] as L.LatLngTuple);
  const bounds = L.latLngBounds(points);
  return bounds.isValid() ? bounds : L.latLngBounds([EGYPT_VIEW as L.LatLngTuple]);
}

export function RedZoneMap({ hotspots }: { hotspots: Hotspot[] }) {
  const holder = useRef<HTMLDivElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const zones = useRef<L.LayerGroup | null>(null);
  const fitted = useRef<string | null>(null);

  const signature = useMemo(
    () =>
      hotspots
        .map((h) => `${h.lat.toFixed(4)},${h.lon.toFixed(4)}:${h.count}:${h.max_severity}`)
        .join('|'),
    [hotspots],
  );

  useEffect(() => {
    const el = holder.current;
    if (!el || map.current) return;
    const instance = L.map(el, {
      zoomControl: false,
      attributionControl: true,
      minZoom: 5,
    }).setView(EGYPT_VIEW, HOME_ZOOM);

    L.control.zoom({ position: 'bottomright' }).addTo(instance);
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(instance);

    zones.current = L.layerGroup().addTo(instance);
    map.current = instance;

    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(el);
    return () => {
      observer.disconnect();
      instance.off();
      instance.remove();
      map.current = null;
      zones.current = null;
      fitted.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = map.current;
    const group = zones.current;
    if (!instance || !group) return;

    group.clearLayers();
    const maxCount = Math.max(1, ...hotspots.map((h) => h.count));

    for (const cell of hotspots) {
      const color = colorFor(cell.max_severity);
      const point: L.LatLngExpression = [cell.lat, cell.lon];

      L.circle(point, {
        radius: 220 + (cell.count / maxCount) * 380,
        color,
        weight: 1.5,
        opacity: 0.9,
        fillColor: color,
        fillOpacity: 0.32,
      })
        .bindPopup(
          `<strong style="color:${color}">${escapeHtml(severityLabel(cell.max_severity))} zone</strong><br/>` +
            `${cell.count} incident${cell.count === 1 ? '' : 's'} · peak severity ${cell.max_severity}<br/>` +
            `${cell.lat.toFixed(4)}, ${cell.lon.toFixed(4)}`,
        )
        .addTo(group);

      L.marker(point, {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: '',
          iconSize: [26, 20],
          iconAnchor: [13, 10],
          html: `<span style="display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:20px;padding:0 6px;border-radius:999px;background:rgba(8,16,24,.82);border:1px solid ${color};color:#fff;font:600 11px/1 Inter,system-ui,sans-serif">${cell.count}</span>`,
        }),
      }).addTo(group);
    }

    if (fitted.current !== signature) {
      fitted.current = signature;
      if (hotspots.length > 0) instance.fitBounds(zoneBounds(hotspots), FRAME);
      else instance.setView(EGYPT_VIEW, HOME_ZOOM, { animate: true });
    }
  }, [hotspots, signature]);

  return (
    <div className="overflow-hidden rounded-[0.9rem] border border-line">
      <div className="relative">
        <div ref={holder} className="live-map h-[320px] w-full" />
        {hotspots.length === 0 && (
          <div className="pointer-events-none absolute inset-0 z-[1040] grid place-items-center">
            <span className="rounded-full border border-line bg-[var(--surface)] px-3 py-1.5 text-xs text-muted shadow-soft">
              No incidents match the current filters
            </span>
          </div>
        )}
        <button
          type="button"
          aria-label="Fit the map to all red zones"
          onClick={() => {
            const instance = map.current;
            if (!instance) return;
            if (hotspots.length > 0) instance.fitBounds(zoneBounds(hotspots), FRAME);
            else instance.setView(EGYPT_VIEW, HOME_ZOOM, { animate: true });
          }}
          className="press absolute top-3 right-3 z-[1050] grid size-9 place-items-center rounded-xl border border-line bg-[var(--surface)] text-ink shadow-soft hover:bg-[var(--surface-2)]"
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="3.2" />
            <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
          </svg>
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-3 py-2">
        {SCALE.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5 text-[11px] text-muted">
            <span className="size-2.5 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
        <span className="ml-auto text-[11px] text-muted">circle size ∝ incidents</span>
      </div>
    </div>
  );
}
