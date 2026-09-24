import { useEffect, useState } from 'react';
import CanvasView from './components/CanvasView';
import IncidentFeed from './components/IncidentFeed';
import { fetchIncidents, setSimConfig } from './api';
import { useSocket } from './hooks/useSocket';
import type { EmergencyAlert, IncidentRow, VehicleState } from './types';

export default function App() {
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [vehicles, setVehicles] = useState<VehicleState[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<'scripted' | 'random'>('scripted');
  const [speed, setSpeed] = useState(3);
  const [connected, setConnected] = useState<boolean | null>(null);
  const wsEvents = useSocket();

  useEffect(() => {
    fetchIncidents().then(setIncidents).catch(() => setIncidents([]));
  }, []);

  useEffect(() => {
    setSimConfig(mode, undefined).catch(() => undefined);
  }, [mode]);

  useEffect(() => {
    setSimConfig(undefined, speed).catch(() => undefined);
  }, [speed]);

  useEffect(() => {
    for (const ev of wsEvents) {
      const e = ev as { type: string };
      if (e.type === 'emergency_alert') {
        const a = e as EmergencyAlert;
        setAlerts((prev) => [a, ...prev.filter((x) => x.alert_id !== a.alert_id)].slice(0, 80));
        setIncidents((prev) => [
          {
            alert_id: a.alert_id,
            trip_id: a.alert_id,
            severity: a.severity,
            lat: a.location.lat,
            lon: a.location.lon,
            status: a.status,
            hospital_id: a.assignment.hospital_id,
            ambulance_id: a.assignment.ambulance_id,
            contacts_notified: a.contacts_notified.join(', '),
            created_at: a.created_at,
          },
          ...prev,
        ]);
      } else if (e.type === 'vehicle_state') {
        const v = e as VehicleState;
        setVehicles((prev) => {
          const rest = prev.filter((x) => x.trip_id !== v.trip_id);
          return [...rest, v];
        });
      } else if (e.type === 'vehicle_lifecycle') {
        setVehicles((prev) => prev.filter((x) => x.trip_id !== (e as unknown as { trip_id: string }).trip_id));
      }
    }
  }, [wsEvents]);

  useEffect(() => {
    const check = setInterval(() => {
      fetch('http://localhost:8000/health')
        .then((r) => r.json())
        .then(() => setConnected(true))
        .catch(() => setConnected(false));
    }, 3000);
    return () => clearInterval(check);
  }, []);

  return (
    <div style={styles.shell}>
      <header style={styles.header}>
        <h1>Crash Response — Hospital &amp; Emergency Console</h1>
        <div style={styles.headerRight}>
          <span style={dot(connected)} />
        </div>
      </header>

      <div style={styles.main}>
        <section style={styles.world}>
          <div style={styles.controls}>
            <span style={styles.ctrlLabel}>Mode:</span>
            <button style={modeBtn(mode === 'scripted')} onClick={() => setMode('scripted')}>Scripted demo</button>
            <button style={modeBtn(mode === 'random')} onClick={() => setMode('random')}>Random city</button>
            <span style={styles.ctrlLabel}>Speed: {speed}x</span>
            <input
              type="range" min={1} max={8} step={1} value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              style={styles.slider}
            />
          </div>
          <div style={styles.canvas}>
            <CanvasView vehicles={vehicles} alerts={alerts} />
          </div>
        </section>
        <aside style={styles.feed}>
          <h3>Live Incident Feed</h3>
          <IncidentFeed incidents={incidents} onSelect={setSelected} />
        </aside>
      </div>
    </div>
  );
}

function dot(connected: boolean | null): React.CSSProperties {
  const color = connected === null ? '#e0a94f' : connected ? '#2e7d32' : '#c62828';
  return { ...styles.dot, background: color };
}

function modeBtn(active: boolean): React.CSSProperties {
  return {
    ...styles.modeBtn,
    ...(active ? { background: '#0b3d5c', color: '#fff', borderColor: '#2e8bc0' } : {}),
  };
}

const styles: Record<string, React.CSSProperties> = {
  shell: { height: '100vh', display: 'flex', flexDirection: 'column', background: '#0c1620', color: '#dff1fa', fontFamily: "'Helvetica Neue', Arial, sans-serif" },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: '#0b1f33', borderBottom: '1px solid #1f3a4b' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 14 },
  dot: { width: 10, height: 10, borderRadius: 10, display: 'inline-block' },
  main: { flex: 1, display: 'flex', overflow: 'hidden' },
  world: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' },
  controls: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#0d1b28', borderBottom: '1px solid #1f3a4b', flexWrap: 'wrap' },
  ctrlLabel: { color: '#8196a8', fontSize: 12, fontWeight: 600 },
  modeBtn: { background: '#16324f', color: '#9fc7e0', border: '1px solid #24445e', padding: '5px 12px', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  slider: { accentColor: '#2e8bc0', width: 120 },
  canvas: { flex: 1, position: 'relative' },
  feed: { width: 300, borderLeft: '1px solid #1f3a4b', overflowY: 'auto', background: '#0d1b28' },
};