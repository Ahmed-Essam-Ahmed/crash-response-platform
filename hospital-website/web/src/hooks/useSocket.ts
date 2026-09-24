import { useEffect, useState } from 'react';

const WS_URL = 'ws://localhost:8000/ws';

export function useSocket() {
  const [events, setEvents] = useState<unknown[]>([]);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    ws.onopen = () => ws.send('ping');
    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        setEvents((prev) => [data, ...prev].slice(0, 200));
      } catch {
        /* ignore malformed frames */
      }
    };
    return () => ws.close();
  }, []);

  return events;
}