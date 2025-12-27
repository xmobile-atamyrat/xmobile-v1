/* eslint-disable no-use-before-define */
import BASE_URL from '@/lib/ApiEndpoints';
import { useUserContext } from '@/pages/lib/UserContext';
import { ChatMessage, ChatSession } from '@/pages/lib/types';
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { v4 as uuidv4 } from 'uuid';

interface ChatContextProps {
  isConnected: boolean;
  messages: ChatMessage[];
  sessions: ChatSession[];
  currentSession: ChatSession | undefined;
  isSendingMessage: boolean;
  showClosureNotification: boolean;
  setShowClosureNotification: React.Dispatch<React.SetStateAction<boolean>>;
  connect: () => void;
  disconnect: () => void;
  sendMessage: (content: string) => void;
  joinSession: (sessionId: string) => Promise<void>;
  loadMessages: (sessionId: string, cursorId?: string) => Promise<void>;
  loadSessions: () => Promise<void>;
  createSession: () => Promise<ChatSession | null>;
  endSession: (sessionId: string) => Promise<void>;
  setSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>;
  setCurrentSession: React.Dispatch<
    React.SetStateAction<ChatSession | undefined>
  >;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

const ChatContext = createContext<ChatContextProps>({
  isConnected: false,
  messages: [],
  sessions: [],
  currentSession: undefined,
  isSendingMessage: false,
  showClosureNotification: false,
  setShowClosureNotification: () => {},
  connect: () => {},
  disconnect: () => {},
  sendMessage: () => {},
  joinSession: async () => {},
  loadMessages: async () => {},
  loadSessions: async () => {},
  createSession: async () => null,
  endSession: async () => {},
  setSessions: () => {},
  setCurrentSession: () => {},
  setMessages: () => {},
});

export const useChatContext = () => useContext(ChatContext);

export const ChatContextProvider = ({ children }: { children: ReactNode }) => {
  const { user, accessToken } = useUserContext();
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession>();
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [showClosureNotification, setShowClosureNotification] = useState(false);

  const ws = useRef<WebSocket | null>(null);
  const sessionRef = useRef<ChatSession | undefined>(currentSession);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  // Sync ref to avoid stale closures in WebSocket callbacks
  useEffect(() => {
    sessionRef.current = currentSession;
  }, [currentSession]);

  // Auto-connect when user logs in
  useEffect(() => {
    if (user && accessToken && !isConnected) {
      connect();
    }
    return () => {
      clearTimeout(reconnectTimeoutRef.current);
      disconnect();
    };
  }, [user, accessToken]);

  const connect = () => {
    if (ws.current?.readyState === WebSocket.OPEN) return;
    if (!accessToken) return;

    const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000'}/ws/?accessToken=${accessToken}`;
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      setIsConnected(true);
    };

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleIncomingMessage(data);
      } catch (err) {
        console.error('Failed to parse WS message:', err);
      }
    };

    ws.current.onclose = () => {
      setIsConnected(false);

      reconnectTimeoutRef.current = setTimeout(() => {
        if (user && accessToken) {
          connect();
        }
      }, 2000);
    };
  };

  const disconnect = () => {
    ws.current?.close();
    ws.current = null;
    setIsConnected(false);
  };

  const handleIncomingMessage = (data: any) => {
    if (data.type === 'ack') {
      setIsSendingMessage(false);
      if (!data.success) {
        setMessages([]);
        if (data.error === 'closed_session') {
          console.warn('Session closed error');
          setCurrentSession(undefined);
        } else if (data.error === 'wrong_session') {
          console.warn('Not a participant error');
          setCurrentSession(undefined);
        }
      }
      return;
    }

    if (data.type === 'history') {
      const activeSession = sessionRef.current;
      if (activeSession && data.sessionId === activeSession.id) {
        setMessages((prev) => {
          const incomingMessages = data.messages.map((msg: any) => ({
            ...msg,
            type: 'message',
            messageId: msg.id,
          }));

          // Deduplicate by messageId
          const existingIds = new Set(
            prev
              .filter((m) => m.type === 'message' && m.messageId)
              .map((m: any) => m.messageId),
          );

          const uniqueNewMessages = incomingMessages.filter(
            (msg: any) => !existingIds.has(msg.messageId),
          );

          // Combine and Sort by time
          return [...prev, ...uniqueNewMessages].sort((a: any, b: any) => {
            const timeA = new Date(a.date || a.createdAt).getTime();
            const timeB = new Date(b.date || b.createdAt).getTime();
            return timeA - timeB;
          });
        });
      }
      return;
    }

    if (data.type === 'message') {
      const activeSession = sessionRef.current;
      if (activeSession && data.sessionId === activeSession.id) {
        setMessages((prev) => {
          if (
            prev.some(
              (m) => m.type === 'message' && m.messageId === data.messageId,
            )
          )
            return prev;
          return [...prev, data];
        });
      }
    }

    if (data.type === 'session_update') {
      const activeSession = sessionRef.current;
      if (activeSession?.id === data.sessionId) {
        if (data.status === 'CLOSED') {
          const isAdmin = user && ['ADMIN', 'SUPERUSER'].includes(user.grade);

          if (!isAdmin) {
            setShowClosureNotification(true);
          }

          setCurrentSession((prev) =>
            prev ? { ...prev, status: 'CLOSED' } : undefined,
          );
          setMessages([]);
        } else {
          setCurrentSession((prev) =>
            prev ? { ...prev, status: data.status } : undefined,
          );
        }
      }

      loadSessions();
    }
  };

  const sendMessage = (content: string) => {
    if (!ws.current || !isConnected || !currentSession || !user) return;

    setIsSendingMessage(true);

    ws.current.send(
      JSON.stringify({
        type: 'message',
        tempId: uuidv4(),
        content,
        sessionId: currentSession.id,
        senderId: user.id,
        senderRole: user.grade,
        timestamp: new Date().toISOString(),
      }),
    );
  };

  const joinSession = async (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) {
      console.warn('Session not found:', sessionId);
      return;
    }

    setMessages([]);

    // Only admins can join PENDING sessions
    const isAdmin = user && ['ADMIN', 'SUPERUSER'].includes(user.grade);

    if (session.status === 'PENDING' && isAdmin) {
      try {
        const res = await fetch(`${BASE_URL}/api/chat/sessionActions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ sessionId }),
        });
        const data = await res.json();

        if (data.success && data.data) {
          setCurrentSession(data.data);

          if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(
              JSON.stringify({
                type: 'session_update',
                sessionId,
                status: 'ACTIVE',
              }),
            );
          }
        } else {
          throw new Error(data.message || 'Failed to claim session');
        }
      } catch (error) {
        console.error('Failed to claim session:', error);
        throw error;
      }
    } else {
      // Regular users or already active sessions: just set current session
      setCurrentSession(session);
    }

    if (isConnected) {
      await loadMessages(sessionId);
    }

    loadSessions();
  };

  const createSession = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/chat/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setCurrentSession(data.data);
        return data.data;
      }

      console.error('Failed to create session:', data.message);
      return null;
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  const loadSessions = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/chat/session`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setSessions(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadMessages = async (sessionId: string, cursorId?: string) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(
        JSON.stringify({
          type: 'get_messages',
          sessionId,
          cursorId,
        }),
      );
    } else {
      console.warn('WS not connected, cannot load messages');
    }
  };

  const endSession = async (sessionId: string) => {
    try {
      const res = await fetch(`${BASE_URL}/api/chat/session`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ sessionId, chatStatus: 'CLOSED' }),
      });
      const data = await res.json();

      if (data.success) {
        if (ws.current?.readyState === WebSocket.OPEN) {
          ws.current.send(
            JSON.stringify({
              type: 'session_update',
              sessionId,
              status: 'CLOSED',
            }),
          );
        }

        if (currentSession?.id === sessionId) {
          const isAdmin = user && ['ADMIN', 'SUPERUSER'].includes(user.grade);

          if (isAdmin) {
            // Admin: return to list
            setCurrentSession(undefined);
          } else {
            // User: mark as closed (will show closure UI)
            setCurrentSession((prev) =>
              prev ? { ...prev, status: 'CLOSED' } : undefined,
            );
          }
        }

        loadSessions();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const contextValue = useMemo(
    () => ({
      isConnected,
      messages,
      sessions,
      currentSession,
      isSendingMessage,
      showClosureNotification,
      setShowClosureNotification,
      connect,
      disconnect,
      sendMessage,
      joinSession,
      loadMessages,
      loadSessions,
      createSession,
      endSession,
      setSessions,
      setCurrentSession,
      setMessages,
    }),
    [
      isConnected,
      messages,
      sessions,
      currentSession,
      isSendingMessage,
      showClosureNotification,
    ],
  );

  return (
    <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>
  );
};
