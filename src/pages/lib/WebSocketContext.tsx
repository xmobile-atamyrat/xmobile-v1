import { useUserContext } from '@/pages/lib/UserContext';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

interface WebSocketContextProps {
  isConnected: boolean;
  send: (message: object) => void;
  subscribe: (messageType: string, handler: (data: any) => void) => () => void;
}

const WebSocketContext = createContext<WebSocketContextProps>({
  isConnected: false,
  send: () => {},
  subscribe: () => () => {},
});

export const useWebSocketContext = () => useContext(WebSocketContext);

// A connection that drops without a FIN (phone changing networks, a
// backgrounded WebView) leaves the browser reporting OPEN for minutes. The
// server's ping frames are answered below the page, so only an app-level
// round trip lets the client notice.
export const HEARTBEAT_INTERVAL_MS = 25_000;
export const HEARTBEAT_TIMEOUT_MS = 10_000;

export const WebSocketContextProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const { user, accessToken } = useUserContext();
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout>();
  const pongTimeoutRef = useRef<NodeJS.Timeout>();
  const probeRef = useRef<() => void>();
  const subscribersRef = useRef<Map<string, Set<(data: any) => void>>>(
    new Map(),
  );

  // Subscribe to specific message types
  const subscribe = useCallback(
    (messageType: string, handler: (data: any) => void) => {
      if (!subscribersRef.current.has(messageType)) {
        subscribersRef.current.set(messageType, new Set());
      }
      subscribersRef.current.get(messageType)?.add(handler);

      // Return unsubscribe function
      return () => {
        subscribersRef.current.get(messageType)?.delete(handler);
      };
    },
    [],
  );

  // Send message through WebSocket
  const send = useCallback((message: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, cannot send message:', message);
    }
  }, []);

  // Notify subscribers of a message
  const notifySubscribers = useCallback((data: any) => {
    const messageType = data.type;
    const handlers = subscribersRef.current.get(messageType);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(
            `Error in WebSocket subscriber for type ${messageType}:`,
            error,
          );
        }
      });
    }
  }, []);

  const clearPongTimeout = useCallback(() => {
    if (pongTimeoutRef.current) {
      clearTimeout(pongTimeoutRef.current);
      pongTimeoutRef.current = undefined;
    }
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = undefined;
    }
    probeRef.current = undefined;
    clearPongTimeout();
  }, [clearPongTimeout]);

  const connect = useCallback(() => {
    const state = wsRef.current?.readyState;
    if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) return;
    if (!accessToken) return;

    const wsBase =
      process.env.NODE_ENV === 'production'
        ? `wss://xmobile.com.tm`
        : process.env.NEXT_PUBLIC_WS_URL;
    const wsUrl = `${wsBase}/ws/?accessToken=${accessToken}`;

    try {
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      const handleClose = (code: number, reason: string) => {
        stopHeartbeat();
        console.log('WebSocket disconnected', code, reason);
        setIsConnected(false);

        // Don't reconnect if it was a clean close or user/auth issue
        if (code === 1000 || code === 1008) {
          reconnectAttemptsRef.current = 0;
          return;
        }

        // Exponential backoff reconnection
        const delay = Math.min(
          1000 * 2 ** reconnectAttemptsRef.current,
          30000, // Max 30 seconds
        );
        reconnectAttemptsRef.current += 1;

        console.log(
          `Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`,
        );

        reconnectTimeoutRef.current = setTimeout(() => {
          if (user && accessToken) {
            connect();
          }
        }, delay);
      };

      socket.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0; // Reset on successful connection

        stopHeartbeat();
        const probe = () => {
          if (socket.readyState !== WebSocket.OPEN || pongTimeoutRef.current) {
            return;
          }
          socket.send(JSON.stringify({ type: 'ping' }));
          pongTimeoutRef.current = setTimeout(() => {
            if (wsRef.current !== socket) return;
            // Detach first: close() on a half-open socket can take minutes
            // to fire onclose, and connect() refuses while wsRef looks OPEN.
            wsRef.current = null;
            socket.close();
            handleClose(4000, 'Heartbeat timeout');
          }, HEARTBEAT_TIMEOUT_MS);
        };
        probeRef.current = probe;
        heartbeatIntervalRef.current = setInterval(
          probe,
          HEARTBEAT_INTERVAL_MS,
        );
      };

      socket.onmessage = (event) => {
        clearPongTimeout();
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'pong') return;
          notifySubscribers(data);
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      socket.onclose = (event) => {
        // This socket has already been replaced (e.g. user switched accounts) -
        // its stale closure must not reconnect with an outdated token.
        if (wsRef.current !== socket) return;
        handleClose(event.code, event.reason);
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }
  }, [accessToken, user, notifySubscribers, stopHeartbeat, clearPongTimeout]);

  const disconnect = useCallback(() => {
    stopHeartbeat();
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
    wsRef.current?.close();
    wsRef.current = null;
    setIsConnected(false);
    reconnectAttemptsRef.current = 0;
  }, [stopHeartbeat]);

  // Connect when user and token are available
  useEffect(() => {
    if (!user || !accessToken) {
      disconnect();
      return undefined;
    }

    connect();

    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, accessToken, connect]);

  // Backoff can leave us waiting up to 30s after the network is already back,
  // and a backgrounded WebView often loses its socket. Retry immediately on
  // either signal instead of waiting out the timer, and check that a socket
  // still claiming OPEN really is alive.
  useEffect(() => {
    if (!user || !accessToken) return undefined;

    const reconnectNow = () => {
      if (document.visibilityState === 'hidden') return;
      const state = wsRef.current?.readyState;
      if (state === WebSocket.OPEN) {
        probeRef.current?.();
        return;
      }
      if (state === WebSocket.CONNECTING) return;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = undefined;
      }
      reconnectAttemptsRef.current = 0;
      connect();
    };

    window.addEventListener('online', reconnectNow);
    document.addEventListener('visibilitychange', reconnectNow);
    return () => {
      window.removeEventListener('online', reconnectNow);
      document.removeEventListener('visibilitychange', reconnectNow);
    };
  }, [user, accessToken, connect]);

  const contextValue = {
    isConnected,
    send,
    subscribe,
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};
