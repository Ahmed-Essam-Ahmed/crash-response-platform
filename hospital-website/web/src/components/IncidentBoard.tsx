import type { Incident, IncidentStatus } from '../types';

export const STATUS_LABELS: Record<IncidentStatus, string> = {
  detected: 'Detected',
  contacts_notified: 'Contacts notified',
  ambulance_assigned: 'Ambulance assigned',
  en_route_to_scene: 'En route to scene',
  on_scene: 'On scene',
  en_route_to_hospital: 'Transporting',
  at_hospital: 'At hospital',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

const STATUS_COLORS: Record<IncidentStatus, string> = {
  detected: '#ef5350',
  contacts_notified: '#ffa726',
  ambulance_assigned: '#ffb74d',
  en_route_to_scene: '#fff176',
  on_scene: '#ff7043',
  en_route_to_hospital: '#4fc3f7',
  at_hospital: '#4dd0e1',
  closed: '#66bb6a',
  cancelled: '#78909c',
};

export function StatusPill({ status }: { status: IncidentStatus }) {
  return (
    <span style={{ ...styles.pill, background: STATUS_COLORS[status] }}>
      {STATUS_LABELS[status]}
    </span>
  );
}

interface Props {
  incidents: Incident[];
  selectedId: string | null;
  onSelect: (alertId: string) => void;
}

export default function IncidentBoard({ incidents, selectedId, onSelect }: Props) {
  if (incidents.length === 0) {
    return <p style={styles.empty}>No active incidents. Report a crash to begin a response.</p>;
  }
  return (
    <div style={styles.list}>
      {incidents.map((inc) => (
        <button
          key={inc.alert_id}
          onClick={() => onSelect(inc.alert_id)}
          style={{ ...styles.row, ...(selectedId === inc.alert_id ? styles.rowActive : {}) }}
        >
          <div style={styles.rowTop}>
            <span style={styles.sev}>{inc.severity.toFixed(1)}</span>
            <StatusPill status={inc.status} />
          </div>
          <div style={styles.meta}>
            {inc.alert_id} · {inc.destination.replace('_', ' ')} ·{' '}
            {inc.assignment.ambulance_ids.join(', ') || 'no unit'}
          </div>
        </button>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  row: {
    background: '#0e2438', border: '1px solid #1d3f57', borderRadius: 8, padding: 10,
    color: '#dff1fa', textAlign: 'left', cursor: 'pointer', font: 'inherit',
  },
  rowActive: { borderColor: '#4dd0e1', background: '#123049' },
  rowTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  sev: { fontWeight: 700, fontSize: 18, color: '#7fd0f0' },
  pill: { fontSize: 11, fontWeight: 700, color: '#10222e', padding: '2px 8px', borderRadius: 10 },
  meta: { fontSize: 11, color: '#8fb6d1' },
  empty: { color: '#6f8ba1', fontSize: 13 },
};
