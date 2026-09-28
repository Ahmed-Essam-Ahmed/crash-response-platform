import type { Hospital } from '../types';

export default function HospitalPanel({ hospitals }: { hospitals: Hospital[] }) {
  return (
    <div style={styles.list}>
      {hospitals.map((h) => {
        const ratio = h.capacity ? h.current_load / h.capacity : 0;
        const color = ratio > 0.8 ? '#ef5350' : ratio > 0.5 ? '#ffa726' : '#66bb6a';
        return (
          <div key={h.hospital_id} style={styles.card}>
            <div style={styles.head}>
              <span style={styles.name}>{h.name}</span>
              <span style={styles.level}>L{h.trauma_level}</span>
            </div>
            <div style={styles.bar}>
              <div style={{ ...styles.fill, width: `${Math.min(100, ratio * 100)}%`, background: color }} />
            </div>
            <div style={styles.meta}>
              {h.current_load} / {h.capacity} occupied · {h.free_beds} free beds
            </div>
          </div>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  card: { background: '#0e2438', border: '1px solid #1d3f57', borderRadius: 8, padding: 10 },
  head: { display: 'flex', justifyContent: 'space-between', marginBottom: 6 },
  name: { fontSize: 13, fontWeight: 600, color: '#dff1fa' },
  level: { fontSize: 11, fontWeight: 700, color: '#0b1620', background: '#4dd0e1', padding: '1px 7px', borderRadius: 8 },
  bar: { height: 6, background: '#123049', borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%' },
  meta: { fontSize: 11, color: '#8fb6d1', marginTop: 6 },
};
