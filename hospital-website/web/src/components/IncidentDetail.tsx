import { STATUS_LABELS } from './IncidentBoard';
import type { Incident } from '../types';

interface Props {
  incident: Incident;
  onCancel: (alertId: string) => void;
}

export default function IncidentDetail({ incident, onCancel }: Props) {
  const done = incident.status === 'closed' || incident.status === 'cancelled';
  const factors = incident.impact_factors ?? {};

  return (
    <div style={styles.wrap}>
      <div style={styles.head}>
        <div>
          <h3 style={styles.title}>{incident.alert_id}</h3>
          <p style={styles.sub}>
            severity {incident.severity.toFixed(1)} · {incident.destination.replace('_', ' ')} · trip{' '}
            {incident.trip_id}
          </p>
        </div>
        {!done && (
          <button style={styles.cancel} onClick={() => onCancel(incident.alert_id)}>
            Cancel
          </button>
        )}
      </div>

      <div style={styles.grid}>
        <Field label="Hospital" value={incident.assignment.hospital_id ?? '—'} />
        <Field label="Ambulances" value={incident.assignment.ambulance_ids.join(', ') || '—'} />
        <Field label="ETA to scene" value={incident.eta_scene_seconds ? `${incident.eta_scene_seconds}s` : '—'} />
        <Field label="ETA to hospital" value={incident.eta_hospital_seconds ? `${incident.eta_hospital_seconds}s` : '—'} />
      </div>

      {Object.keys(factors).length > 0 && (
        <>
          <h4 style={styles.section}>Impact factors</h4>
          <div style={styles.factors}>
            {Object.entries(factors).map(([key, value]) => (
              <span key={key} style={styles.factor}>
                {key.replace(/_/g, ' ')}: <b>{String(value)}</b>
              </span>
            ))}
          </div>
        </>
      )}

      <h4 style={styles.section}>Timeline</h4>
      <ol style={styles.timeline}>
        {(incident.events ?? []).map((event, index) => (
          <li key={`${event.status}-${index}`} style={styles.step}>
            <span style={styles.dot} />
            <div>
              <div style={styles.stepTitle}>{STATUS_LABELS[event.status]}</div>
              {event.note && <div style={styles.stepNote}>{event.note}</div>}
              {event.created_at && <div style={styles.stepTime}>{event.created_at.slice(11, 19)}</div>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.field}>
      <div style={styles.fieldLabel}>{label}</div>
      <div style={styles.fieldValue}>{value}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { padding: 14, overflowY: 'auto', flex: 1 },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  title: { margin: 0, fontSize: 16, color: '#dff1fa' },
  sub: { margin: '4px 0 0 0', fontSize: 12, color: '#8fb6d1' },
  cancel: { background: '#c62828', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontWeight: 600 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 },
  field: { background: '#0e2438', border: '1px solid #1d3f57', borderRadius: 6, padding: 8 },
  fieldLabel: { fontSize: 10, color: '#6f8ba1', textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldValue: { fontSize: 13, color: '#dff1fa', marginTop: 2 },
  section: { margin: '14px 0 8px 0', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: '#6f8ba1' },
  factors: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  factor: { background: '#0e2438', border: '1px solid #1d3f57', borderRadius: 12, padding: '3px 10px', fontSize: 11, color: '#b9d6ea' },
  timeline: { listStyle: 'none', margin: 0, padding: 0 },
  step: { display: 'flex', gap: 10, paddingBottom: 12, position: 'relative' },
  dot: { width: 9, height: 9, borderRadius: 9, background: '#4dd0e1', marginTop: 4, flexShrink: 0 },
  stepTitle: { fontSize: 13, fontWeight: 600, color: '#dff1fa' },
  stepNote: { fontSize: 11, color: '#8fb6d1' },
  stepTime: { fontSize: 10, color: '#5d7a91' },
};
