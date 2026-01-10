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
  const subscribersRef = useRef<Map<string, Set<(data: any) => void>>>(
    new Map(),
  );

  const maxReconnectAttempts = parseInt(
    process.env.NEXT_PUBLIC_WS_MAX_RECONNECT_ATTEMPTS || '5',
    10,
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

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (!accessToken) return;

    const wsBase =
      process.env.NODE_ENV === 'production'
        ? `wss://xmobile.com.tm`
        : process.env.NEXT_PUBLIC_WS_URL;
    const wsUrl = `${wsBase}/ws/?accessToken=${accessToken}`;

    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0; // Reset on successful connection
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          notifySubscribers(data);
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      wsRef.current.onclose = (event) => {
        console.log('WebSocket disconnected', event.code, event.reason);
        setIsConnected(false);

        // Don't reconnect if it was a clean close or user/auth issue
        if (event.code === 1000 || event.code === 1008) {
          reconnectAttemptsRef.current = 0;
          return;
        }

        // Exponential backoff reconnection
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(
            1000 * 2 ** reconnectAttemptsRef.current,
            30000, // Max 30 seconds
          );
          reconnectAttemptsRef.current += 1;

          console.log(
            `Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`,
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            if (user && accessToken) {
              connect();
            }
          }, delay);
        } else {
          console.error(
            'Max reconnection attempts reached. Please refresh the page.',
          );
          reconnectAttemptsRef.current = 0; // Reset for potential manual retry
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
    }
  }, [accessToken, user, maxReconnectAttempts, notifySubscribers]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
    wsRef.current?.close();
    wsRef.current = null;
    setIsConnected(false);
    reconnectAttemptsRef.current = 0;
  }, []);

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
