import type { IncidentRow } from '../types';

type Props = {
  incidents: IncidentRow[];
  onSelect: (id: string) => void;
};

export default function IncidentFeed({ incidents, onSelect }: Props) {
  if (incidents.length === 0) {
    return <p style={styles.empty}>No incidents yet — waiting for the pipeline…</p>;
  }
  return (
    <div style={styles.list}>
      {incidents.map((inc) => (
        <button key={inc.alert_id} style={styles.item} onClick={() => onSelect(inc.alert_id)}>
          <span style={styles.row}>
            <b>{inc.alert_id}</b>
            <span style={{ ...badge(inc.severity) }}>{inc.severity.toFixed(1)}</span>
          </span>
          <span style={styles.sub}>
            {new Date(inc.created_at).toLocaleTimeString()} · {inc.status} ·→ {inc.hospital_id}
          </span>
        </button>
      ))}
    </div>
  );
}

function badge(sev: number) {
  return {
    ...styles.sev,
    background: sev >= 7 ? '#c62828' : sev >= 4 ? '#ef6c00' : '#f9a825',
  };
}

const styles: Record<string, React.CSSProperties> = {
  empty: { color: '#8aa2b5', padding: 16, fontSize: 13 },
  list: { display: 'flex', flexDirection: 'column', gap: 8, padding: 8 },
  item: {
    background: '#10222e', border: '1px solid #1f3a4b', borderRadius: 8, color: '#dff1fa',
    padding: '8px 12px', textAlign: 'left', cursor: 'pointer', fontSize: 13,
  },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  sev: { color: '#fff', borderRadius: 10, padding: '1px 8px', fontSize: 12, fontWeight: 700 },
  sub: { color: '#8196a8', fontSize: 12, display: 'block', marginTop: 3 },
};