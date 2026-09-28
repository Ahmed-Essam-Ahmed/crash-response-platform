import { useEffect, useRef, useState } from 'react';
import type { StreamEvent } from '../types';
import { WS_URL } from '../api';

export function useStream(onEvent: (event: StreamEvent) => void) {
  const [connected, setConnected] = useState(false);
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retry = 0;
    let timer: number | undefined;
    let closed = false;

    const connect = () => {
      socket = new WebSocket(WS_URL);
      socket.onopen = () => {
        retry = 0;
        setConnected(true);
      };
      socket.onclose = () => {
        setConnected(false);
        if (closed) return;
        retry += 1;
        timer = window.setTimeout(connect, Math.min(1000 * retry, 8000));
      };
      socket.onerror = () => socket?.close();
      socket.onmessage = (message) => {
        try {
          const parsed = JSON.parse(message.data) as StreamEvent;
          if (parsed?.type) handler.current(parsed);
        } catch {
          return;
        }
      };
    };

    connect();
    return () => {
      closed = true;
      if (timer) window.clearTimeout(timer);
      socket?.close();
    };
  }, []);

  return { connected };
}
