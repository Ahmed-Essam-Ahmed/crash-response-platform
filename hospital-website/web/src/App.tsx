import { useCallback, useEffect, useState } from 'react';
import HospitalPanel from './components/HospitalPanel';
import IncidentBoard from './components/IncidentBoard';
import IncidentDetail from './components/IncidentDetail';
import MapCanvas from './components/MapCanvas';
import { useStream } from './hooks/useStream';
import {
  cancelIncident, fetchActive, fetchFleet, fetchHospitals, fetchIncident, health, reportCrash,
} from './api';
import type { Ambulance, Hospital, Incident, StreamEvent } from './types';

const SEVERITIES = [2.5, 4.2, 6.3, 7.8, 9.3];

export default function App() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [fleet, setFleet] = useState<Ambulance[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Incident | null>(null);
  const [connected, setConnected] = useState(false);

  const refresh = useCallback(() => {
    fetchActive().then(setIncidents).catch(() => undefined);
    fetchHospitals().then(setHospitals).catch(() => undefined);
    fetchFleet().then(setFleet).catch(() => undefined);
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(() => {
      health().then((h) => setConnected(h.status === 'ok')).catch(() => setConnected(false));
      refresh();
    }, 4000);
    return () => clearInterval(timer);
  }, [refresh]);

  const onEvent = useCallback(
    (event: StreamEvent) => {
      if (event.type === 'hospitals_update') {
        setHospitals(event.hospitals);
      } else if (event.type === 'fleet_update') {
        setFleet((prev) => {
          const byId = new Map(prev.map((a) => [a.ambulance_id, a]));
          for (const amb of event.ambulances) byId.set(amb.ambulance_id, amb);
          return [...byId.values()];
        });
      } else if (event.type === 'incident_detected' || event.type === 'incident_status') {
        refresh();
        if (selected) {
          fetchIncident(selected).then(setDetail).catch(() => undefined);
        }
      }
    },
    [refresh, selected],
  );

  const { connected: streamConnected } = useStream(onEvent);
  useEffect(() => setConnected(connected || streamConnected), [connected, streamConnected]);

  const openDetail = (alertId: string) => {
    setSelected(alertId);
    fetchIncident(alertId).then(setDetail).catch(() => undefined);
  };

  const sendTestCrash = async () => {
    const severity = SEVERITIES[Math.floor(Math.random() * SEVERITIES.length)];
    const incident = await reportCrash({
      trip_id: `console-${Date.now().toString(36)}`,
      severity,
      location: {
        lat: 30.028 + Math.random() * 0.02,
        lon: 31.232 + Math.random() * 0.02,
      },
      medical_profile_ref: 'profile-0001',
      detection: { rule: true, ml_confidence: 0.94 },
      impact_factors: { peak_g: 4 + severity, delta_v_mps: severity * 1.4, impact_type: 'frontal' },
    });
    openDetail(incident.alert_id);
  };

  const onCancel = async (alertId: string) => {
    await cancelIncident(alertId);
    setDetail(null);
    setSelected(null);
    refresh();
  };

  return (
    <div style={styles.shell}>
      <header style={styles.header}>
        <h1 style={styles.brand}>Hospital Response Console</h1>
        <div style={styles.headerRight}>
          <span style={dot(connected)} />
          <span style={styles.statusText}>{connected ? 'live' : 'offline'}</span>
          <button style={styles.primary} onClick={sendTestCrash}>
            Report crash
          </button>
        </div>
      </header>

      <div style={styles.main}>
        <section style={styles.mapPane}>
          <MapCanvas
            hospitals={hospitals}
            ambulances={fleet}
            incidents={incidents}
            selectedId={selected}
            onSelect={openDetail}
          />
          <div style={styles.legend}>
            {[
              ['#ff4d4d', 'severity ≥ 7'],
              ['#ffab40', '5.5–7'],
              ['#26c6da', 'trauma hospital'],
              ['#ffd166', 'ambulance'],
            ].map(([color, label]) => (
              <span key={label} style={styles.legendItem}>
                <i style={{ background: color }} /> {label}
              </span>
            ))}
          </div>
        </section>

        <aside style={styles.side}>
          <h3 style={styles.panelTitle}>Active incidents ({incidents.length})</h3>
          <div style={styles.scroll}>
            <IncidentBoard incidents={incidents} selectedId={selected} onSelect={openDetail} />
          </div>
          <h3 style={styles.panelTitle}>Hospitals</h3>
          <div style={styles.scrollSmall}>
            <HospitalPanel hospitals={hospitals} />
          </div>
        </aside>

        <section style={styles.detail}>
          {detail ? (
            <IncidentDetail incident={detail} onCancel={onCancel} />
          ) : (
            <p style={styles.placeholder}>
              Select an incident to view its assignment, impact factors and timeline.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function dot(ok: boolean): React.CSSProperties {
  return { width: 9, height: 9, borderRadius: 9, background: ok ? '#66bb6a' : '#ef5350' };
}

const styles: Record<string, React.CSSProperties> = {
  shell: { height: '100vh', display: 'flex', flexDirection: 'column', background: '#0b1620', color: '#dff1fa', fontFamily: "'Helvetica Neue', Arial, sans-serif" },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: '#0d2133', borderBottom: '1px solid #1d3f57' },
  brand: { fontSize: 16, margin: 0, fontWeight: 700 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 12 },
  statusText: { fontSize: 12, color: '#8fb6d1' },
  primary: { background: '#0b5c8a', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 14px', fontWeight: 600, cursor: 'pointer' },
  main: { flex: 1, display: 'flex', overflow: 'hidden' },
  mapPane: { flex: 1, minWidth: 0, position: 'relative' },
  legend: { position: 'absolute', left: 12, bottom: 12, display: 'flex', gap: 14, background: 'rgba(8,20,30,0.85)', border: '1px solid #1d3f57', borderRadius: 8, padding: '6px 10px', fontSize: 11, color: '#8fb6d1' },
  legendItem: { display: 'inline-flex', alignItems: 'center', gap: 5 },
  side: { width: 330, borderLeft: '1px solid #1d3f57', background: '#0d2133', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  panelTitle: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: '#6f8ba1', margin: '12px 12px 6px 12px' },
  scroll: { flex: 1, overflowY: 'auto', padding: '0 12px 8px 12px', minHeight: 120 },
  scrollSmall: { maxHeight: 240, overflowY: 'auto', padding: '0 12px 12px 12px' },
  detail: { width: 340, borderLeft: '1px solid #1d3f57', background: '#0d2133', display: 'flex', flexDirection: 'column' },
  placeholder: { color: '#6f8ba1', fontSize: 13, padding: 18 },
};
