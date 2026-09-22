/* eslint-disable no-use-before-define */
import BASE_URL from '@/lib/ApiEndpoints';
import { useUserContext } from '@/pages/lib/UserContext';
import { useWebSocketContext } from '@/pages/lib/WebSocketContext';
import { ChatMessage, ChatSession } from '@/pages/lib/types';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { v4 as uuidv4 } from 'uuid';

interface ChatContextProps {
  isConnected: boolean;
  /**
   * Users the server currently holds an open socket for. Only ever populated
   * for admins -- a customer's snapshot is empty by design, so reading this in
   * customer-facing UI will silently show everyone as offline.
   */
  onlineUserIds: Set<string>;
  /** Whether any admin is connected, i.e. is the support desk staffed. */
  isSupportOnline: boolean;
  messages: ChatMessage[];
  sessions: ChatSession[];
  currentSession: ChatSession | undefined;
  isSendingMessage: boolean;
  sendMessage: (content: string) => void;
  joinSession: (sessionId: string) => Promise<boolean>;
  loadMessages: (sessionId: string, cursorId?: string) => Promise<void>;
  loadSessions: () => Promise<ChatSession[]>;
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
  onlineUserIds: new Set<string>(),
  isSupportOnline: false,
  messages: [],
  sessions: [],
  currentSession: undefined,
  isSendingMessage: false,
  sendMessage: () => {},
  joinSession: async () => false,
  loadMessages: async () => {},
  loadSessions: async () => [],
  createSession: async () => null,
  endSession: async () => {},
  setSessions: () => {},
  setCurrentSession: () => {},
  setMessages: () => {},
});

export const useChatContext = () => useContext(ChatContext);

export const ChatContextProvider = ({ children }: { children: ReactNode }) => {
  const { user, accessToken } = useUserContext();
  const { isConnected, send, subscribe } = useWebSocketContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession>();
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(
    () => new Set<string>(),
  );
  const [isSupportOnline, setIsSupportOnline] = useState(false);

  const sessionRef = useRef<ChatSession | undefined>(currentSession);

  useEffect(() => {
    sessionRef.current = currentSession;
  }, [currentSession]);

  // Reset all chat state when the signed-in user changes (e.g. sign-out then sign-in as different user)
  useEffect(() => {
    setSessions([]);
    setMessages([]);
    setCurrentSession(undefined);
    // Presence is scoped to who you are: an admin's roster must not survive
    // into a customer session on the same device.
    setOnlineUserIds(new Set<string>());
    setIsSupportOnline(false);
  }, [user?.id]);

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/chat/session`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setSessions(data.data);
        return data.data;
      }
    } catch (err) {
      console.error(err);
    }
    return [];
  }, [accessToken]);

  const loadMessages = useCallback(
    async (sessionId: string, cursorId?: string) => {
      if (isConnected) {
        send({
          type: 'get_messages',
          sessionId,
          cursorId,
        });
      } else {
        console.warn('WebSocket not connected, cannot load messages');
      }
    },
    [isConnected, send],
  );

  // Presence subscriptions are registered at mount, NOT gated on isConnected.
  //
  // The server pushes `presence_state` the instant the socket opens, without
  // being asked. Registering the handler from an effect that waits for
  // isConnected loses that race every time: isConnected only flips in the
  // socket's onopen, and the effect reacting to it does not run until React
  // has committed that re-render -- by which point the snapshot has already
  // been dispatched to an empty subscriber set and dropped. Transitions kept
  // working, so the symptom was the subtle one: everybody reads as offline
  // until something happens to change.
  //
  // Effects run child-first, so this registers before WebSocketContext's own
  // effect has even constructed the socket. `subscribe` is stable, so the
  // handlers survive reconnects and catch the replayed snapshot too.
  useEffect(() => {
    const unsubscribePresenceState = subscribe('presence_state', (data) => {
      setOnlineUserIds(new Set<string>(data.onlineUserIds ?? []));
      setIsSupportOnline(Boolean(data.supportOnline));
    });

    const unsubscribePresenceUpdate = subscribe('presence_update', (data) => {
      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        if (data.online) {
          next.add(data.userId);
        } else {
          next.delete(data.userId);
        }
        return next;
      });
    });

    const unsubscribeSupportPresence = subscribe('support_presence', (data) => {
      setIsSupportOnline(Boolean(data.supportOnline));
    });

    return () => {
      unsubscribePresenceState();
      unsubscribePresenceUpdate();
      unsubscribeSupportPresence();
    };
  }, [subscribe]);

  // Subscribe to WebSocket messages for chat
  useEffect(() => {
    if (!isConnected) {
      // Our own socket is down, so every cached presence value is a claim
      // about a server we can no longer hear from. Drop them: showing a stale
      // "online" is worse than showing nothing, and the server replays a full
      // snapshot the moment we reconnect anyway.
      setOnlineUserIds(new Set<string>());
      setIsSupportOnline(false);
      return undefined;
    }

    const unsubscribeAck = subscribe('ack', (data) => {
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
    });

    const unsubscribeHistory = subscribe('history', (data) => {
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
    });

    const unsubscribeMessage = subscribe('message', (data) => {
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
    });

    const unsubscribeSessionUpdate = subscribe('session_update', (data) => {
      const activeSession = sessionRef.current;

      if (activeSession?.id === data.sessionId) {
        if (data.status === 'CLOSED') {
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
    });

    return () => {
      unsubscribeAck();
      unsubscribeHistory();
      unsubscribeMessage();
      unsubscribeSessionUpdate();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, subscribe, loadSessions]);

  const sendMessage = useCallback(
    (content: string) => {
      if (!isConnected || !currentSession || !user) return;

      setIsSendingMessage(true);

      send({
        type: 'message',
        tempId: uuidv4(),
        content,
        sessionId: currentSession.id,
        senderId: user.id,
        senderRole: user.grade,
        timestamp: new Date().toISOString(),
      });
    },
    [isConnected, currentSession, user, send],
  );

  const joinSession = useCallback(
    async (sessionId: string) => {
      const session = sessions.find((s) => s.id === sessionId);
      if (!session) {
        console.warn('Session not found:', sessionId);
        return false;
      }

      setMessages([]);

      setCurrentSession(session);

      if (isConnected) {
        await loadMessages(sessionId);
      }

      loadSessions();
      return true;
    },
    [
      sessions,
      user,
      accessToken,
      isConnected,
      loadMessages,
      loadSessions,
      send,
    ],
  );

  const createSession = useCallback(async () => {
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
  }, [accessToken]);

  const endSession = useCallback(
    async (sessionId: string) => {
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
          if (isConnected) {
            send({
              type: 'session_update',
              sessionId,
              status: 'CLOSED',
            });
          }

          if (currentSession?.id === sessionId) {
            const isAdmin = user && ['ADMIN', 'SUPERUSER'].includes(user.grade);

            if (isAdmin) {
              setCurrentSession(undefined);
            } else {
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
    },
    [accessToken, currentSession, user, loadSessions, isConnected, send],
  );

  const contextValue = useMemo(
    () => ({
      isConnected,
      onlineUserIds,
      isSupportOnline,
      messages,
      sessions,
      currentSession,
      isSendingMessage,
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
      onlineUserIds,
      isSupportOnline,
      messages,
      sessions,
      currentSession,
      isSendingMessage,
      sendMessage,
      joinSession,
      loadMessages,
      loadSessions,
      createSession,
      endSession,
    ],
  );

  return (
    <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>
  );
};
