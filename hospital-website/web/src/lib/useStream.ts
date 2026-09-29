import { useEffect, useRef, useState } from 'react';
import { getToken, streamUrl } from '../api';
import type { StreamEvent } from '../types';

export function useStream(onEvent: (event: StreamEvent) => void) {
  const [connected, setConnected] = useState(false);
  const handler = useRef(onEvent);
  handler.current = onEvent;
  const token = getToken();

  useEffect(() => {
    if (!token) {
      setConnected(false);
      return;
    }

    let socket: WebSocket | null = null;
    let retry = 0;
    let timer: number | undefined;
    let closed = false;

    const connect = () => {
      socket = new WebSocket(streamUrl());
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
          const parsed = JSON.parse(message.data as string) as StreamEvent;
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
  }, [token]);

  return { connected };
}
