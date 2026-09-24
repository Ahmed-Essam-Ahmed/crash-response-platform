import { useEffect, useState } from 'react';
import AnalyticsPanel from './components/AnalyticsPanel';

const API = import.meta.env.VITE_ANALYTICS_API ?? 'http://localhost:8001';

export default function App() {
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    const check = setInterval(() => {
      fetch(`${API}/health`)
        .then((r) => r.json())
        .then(() => setConnected(true))
        .catch(() => setConnected(false));
    }, 3000);
    return () => clearInterval(check);
  }, []);

  return (
    <div style={styles.shell}>
      <header style={styles.header}>
        <h1>Crash Response — Data Analytics</h1>
        <span style={dot(connected)} />
      </header>
      <AnalyticsPanel />
    </div>
  );
}

function dot(connected: boolean | null): React.CSSProperties {
  const color = connected === null ? '#e0a94f' : connected ? '#2e7d32' : '#c62828';
  return { width: 10, height: 10, borderRadius: 10, display: 'inline-block', background: color };
}

const styles: Record<string, React.CSSProperties> = {
  shell: { minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#0c1620', color: '#dff1fa', fontFamily: "'Helvetica Neue', Arial, sans-serif" },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: '#0b1f33', borderBottom: '1px solid #1f3a4b' },
};
