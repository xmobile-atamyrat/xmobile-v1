import ChatSessionList from '@/pages/components/chat/ChatSessionList';
import ChatWindow from '@/pages/components/chat/ChatWindow';
import { useChatContext } from '@/pages/lib/ChatContext';
import { useNotificationContext } from '@/pages/lib/NotificationContext';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useVisualViewport } from '@/pages/lib/useVisualViewport';
import { ChatSession } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { chatClasses } from '@/styles/classMaps/components/chat';
import { colors, fill, hairline, ink, muted, navy, red } from '@/styles/theme';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Paper,
  Snackbar,
  Typography,
} from '@mui/material';
import { ArrowLeft, Headset, Phone } from 'lucide-react';
import { GetServerSideProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';

// Store support line (primary of the three in Footer/support), dialed from the chat header
const STORE_PHONE = '+99361004933';
const ONLINE_GREEN = '#1F9A5A';

export const getServerSideProps: GetServerSideProps = async (context) => {
  return {
    props: {
      messages: (await import(`../../i18n/${context.locale}.json`)).default,
    },
  };
};

export default function ChatPage() {
  const router = useRouter();
  const { sessionId } = router.query;
  const { user, isLoading: userLoading } = useUserContext();
  const platform = usePlatform();
  const t = useTranslations();
  const {
    isConnected,
    currentSession,
    createSession,
    setCurrentSession,
    endSession,
    loadSessions,
    loadMessages,
    sessions,
    joinSession,
    messages,
  } = useChatContext();
  const { markSessionAsRead } = useNotificationContext();

  const [loading, setLoading] = useState(false);
  const [showTakenAlert, setShowTakenAlert] = useState(false);
  const visualViewport = useVisualViewport();
  const [isSessionClosed, setSessionClosed] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const initializedSessionIdRef = useRef<string | null>(null);
  const messagesLoadedRef = useRef<string | null>(null);

  const isAdmin = user && ['ADMIN', 'SUPERUSER'].includes(user.grade);
  const isParticipant = currentSession?.users?.some((u) => u.id === user?.id);
  const canManageSession =
    isAdmin && isParticipant && currentSession?.status !== 'CLOSED';

  // Redirect to sign in if not authenticated
  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/user/signin');
    }
  }, [user, userLoading, router]);

  // Load sessions on mount
  useEffect(() => {
    if (user && !userLoading) {
      loadSessions();
    }
  }, [user, userLoading, loadSessions]);

  // Handle sessionId from query params
  useEffect(() => {
    if (!user || userLoading) {
      setIsInitializing(false);
      initializedSessionIdRef.current = null;
      return;
    }

    const initializeSession = async () => {
      // Wait for sessions to load if we have a sessionId
      if (sessionId && typeof sessionId === 'string') {
        // If we've already initialized this session and we're in it, don't do it again
        if (
          initializedSessionIdRef.current === sessionId &&
          currentSession?.id === sessionId
        ) {
          setIsInitializing(false);
          return;
        }

        // If sessions haven't loaded yet, trigger load and wait
        let currentSessions = sessions;
        if (currentSessions.length === 0) {
          currentSessions = await loadSessions();
          if (currentSessions.length === 0) {
            setIsInitializing(false);
            return;
          }
        }

        setIsInitializing(true);
        setSessionError(null);
        const session = currentSessions.find((s) => s.id === sessionId);
        if (session) {
          // Only join if we're not already in this session
          if (currentSession?.id !== sessionId) {
            try {
              initializedSessionIdRef.current = sessionId;
              // Reset messages loaded ref so we can load messages when WebSocket connects
              messagesLoadedRef.current = null;
              const success = await joinSession(sessionId);
              if (!success) {
                setShowTakenAlert(true);
                setSessionError('chatSessionTakenByOther');
                initializedSessionIdRef.current = null;
              } else if (!isConnected) {
                // If WebSocket isn't connected, messages weren't loaded
                // They will be loaded when WebSocket connects via the useEffect
                messagesLoadedRef.current = null;
              }
            } catch (error) {
              console.error('Failed to join session:', error);
              setSessionError('chatNotParticipant');
              initializedSessionIdRef.current = null;
            }
          } else {
            // Already in the correct session
            initializedSessionIdRef.current = sessionId;
            // If we're already in the session but have no messages, try to load them
            if (messages.length === 0 && isConnected) {
              messagesLoadedRef.current = null; // Reset to allow loading
            }
          }
        } else {
          // Session not found in loaded sessions
          setSessionError('chatNotParticipant');
        }
        setIsInitializing(false);
        return;
      }

      // No sessionId in URL - reset initialized ref
      if (initializedSessionIdRef.current !== null) {
        initializedSessionIdRef.current = null;
      }

      // No sessionId in URL
      setIsInitializing(true);
      if (isAdmin) {
        // Admin: show session list (no auto-selection)
        setIsInitializing(false);
        return;
      }

      // Free user: auto-select active session or show start chat
      // Only auto-select if we have sessions loaded and no current session
      if (sessions.length > 0 && !currentSession) {
        const userSession = sessions[0];
        setCurrentSession(userSession);
        // Update URL to include sessionId for consistency
        router.replace(`/chat?sessionId=${userSession.id}`, undefined, {
          shallow: true,
        });
        if (isConnected) {
          loadMessages(userSession.id);
        }
      }
      setIsInitializing(false);
    };

    initializeSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    sessionId,
    user,
    userLoading,
    sessions,
    // Include sessions so we can react when they load
    // But use initializedSessionIdRef to prevent re-joining
  ]);

  // Handle session closed state
  useEffect(() => {
    if (currentSession?.status === 'CLOSED') {
      if (!isAdmin) {
        setSessionClosed(true);
      }
    }
  }, [currentSession, isAdmin]);

  // Mark session notifications as read when they come from deeplink
  useEffect(() => {
    if (currentSession?.id) {
      markSessionAsRead(currentSession.id).catch((error) => {
        console.error('Failed to mark session as read:', error);
      });
    }
  }, [currentSession?.id, markSessionAsRead]);

  // Load messages when WebSocket connects and we have a session but no messages
  useEffect(() => {
    if (
      isConnected &&
      currentSession &&
      currentSession.id &&
      messages.length === 0 &&
      !isInitializing &&
      messagesLoadedRef.current !== currentSession.id
    ) {
      // WebSocket just connected and we have a session but no messages loaded
      messagesLoadedRef.current = currentSession.id;
      loadMessages(currentSession.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isConnected,
    currentSession?.id,
    messages.length,
    isInitializing,
    loadMessages,
  ]);

  // Reset messages loaded ref when session changes
  useEffect(() => {
    if (currentSession?.id !== messagesLoadedRef.current) {
      messagesLoadedRef.current = null;
    }
  }, [currentSession?.id]);

  const handleStartChatUser = async () => {
    setLoading(true);
    const newSession = await createSession();
    if (newSession) {
      // Update URL to include sessionId
      router.replace(`/chat?sessionId=${newSession.id}`, undefined, {
        shallow: true,
      });
    }
    setLoading(false);
  };

  const handleSessionSelect = async (session: ChatSession) => {
    try {
      const success = await joinSession(session.id);
      if (!success) {
        setShowTakenAlert(true);
      } else {
        // Update URL with sessionId
        router.replace(`/chat?sessionId=${session.id}`, undefined, {
          shallow: true,
        });
      }
    } catch (error) {
      console.error('Failed to join session', error);
    }
  };

  const handleBackToSessionList = () => {
    setCurrentSession(undefined);
    router.replace('/chat', undefined, { shallow: true });
  };

  const handleEndSession = async () => {
    if (!currentSession || !isAdmin) return;

    // eslint-disable-next-line no-alert
    if (window.confirm(t('chatConfirmEndSession'))) {
      await endSession(currentSession.id);
      setCurrentSession(undefined);
      router.replace('/chat', undefined, { shallow: true });
    }
  };

  const handleBack = () => {
    router.push('/');
  };

  const renderHeader = () => {
    const inSession = !!currentSession;
    // Admin viewing the session list has no conversation partner → no avatar/status.
    const showAvatar = !isAdmin || inSession;
    const online = isConnected;

    let title: string;
    if (inSession && isAdmin) {
      title =
        currentSession?.users?.find((u) => u.grade === 'FREE')?.name ||
        t('chatGuest');
    } else if (isAdmin) {
      title = t('chatAdminDashboard');
    } else {
      title = t('chatCustomerSupport');
    }

    const onBack = inSession && isAdmin ? handleBackToSessionList : handleBack;

    return (
      <Box
        className={chatClasses.header.container[platform]}
        sx={{
          backgroundColor: '#fff',
          borderBottom: `1px solid ${hairline}`,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          flexShrink: 0,
          minHeight: '64px',
          px: 2,
        }}
      >
        <Box
          component="button"
          onClick={onBack}
          aria-label="Back"
          sx={{
            width: 40,
            height: 40,
            flexShrink: 0,
            borderRadius: '999px',
            backgroundColor: fill,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ArrowLeft size={20} color={navy} />
        </Box>

        {showAvatar && (
          <Box
            sx={{ position: 'relative', width: 42, height: 42, flexShrink: 0 }}
          >
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: '999px',
                backgroundColor: navy,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Headset size={22} color="#fff" />
            </Box>
            {online && (
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: 11,
                  height: 11,
                  borderRadius: '999px',
                  backgroundColor: ONLINE_GREEN,
                  border: '2px solid #fff',
                }}
              />
            )}
          </Box>
        )}

        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography
            noWrap
            sx={{ fontSize: '15px', fontWeight: 700, color: ink }}
          >
            {title}
          </Typography>
          {showAvatar && (
            <Typography
              sx={{
                fontSize: '12px',
                fontWeight: 500,
                color: online ? ONLINE_GREEN : muted,
              }}
            >
              {online ? t('chatOnline') : t('chatConnecting')}
            </Typography>
          )}
        </Box>

        {isAdmin ? (
          canManageSession && (
            <Button
              size="small"
              variant="text"
              onClick={handleEndSession}
              sx={{
                color: red,
                minWidth: 'auto',
                fontSize: '13px',
                fontWeight: 600,
                textTransform: 'none',
              }}
            >
              {t('chatEndButton')}
            </Button>
          )
        ) : (
          <IconButton
            component="a"
            href={`tel:${STORE_PHONE}`}
            size="small"
            aria-label={STORE_PHONE}
            sx={{ color: navy, flexShrink: 0 }}
          >
            <Phone size={20} />
          </IconButton>
        )}
      </Box>
    );
  };

  const renderContent = () => {
    // Show loading while initializing
    if (isInitializing || userLoading) {
      return (
        <Box
          sx={{
            flexGrow: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CircularProgress sx={{ color: navy }} />
        </Box>
      );
    }

    // Show error if session not found
    if (sessionError) {
      return (
        <Box
          sx={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            p: 3,
            gap: 2,
          }}
        >
          <Typography align="center" sx={{ fontSize: '14px', color: muted }}>
            {sessionError === 'chatSessionTakenByOther'
              ? t('chatSessionTakenByOther')
              : t('chatNotParticipant')}
          </Typography>
        </Box>
      );
    }

    // Admin view
    if (isAdmin) {
      return currentSession ? (
        <ChatWindow />
      ) : (
        <ChatSessionList onSelectSession={handleSessionSelect} />
      );
    }

    // Free user view
    if (currentSession && currentSession.status !== 'CLOSED') {
      return <ChatWindow />;
    }

    // Show start view if session is CLOSED or no session exists
    return (
      <Box
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
          gap: 2,
        }}
      >
        <Typography align="center" sx={{ fontSize: '14px', color: ink }}>
          {t('chatNeedHelpPrompt')}
        </Typography>
        <Button
          variant="contained"
          onClick={handleStartChatUser}
          disabled={loading || !isConnected}
          sx={{
            backgroundColor: navy,
            color: 'white',
            textTransform: 'none',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: 600,
            px: 3,
            '&:hover': {
              backgroundColor: colors.buttonHoverBg,
            },
          }}
        >
          {loading ? (
            <CircularProgress size={24} color="inherit" />
          ) : (
            t('chatStartChatButton')
          )}
        </Button>
      </Box>
    );
  };

  // Don't render anything if redirecting
  if (!userLoading && !user) {
    return null;
  }

  return (
    <>
      <Paper
        sx={{
          position: 'fixed',
          top: visualViewport ? visualViewport.offsetTop : 0,
          left: 0,
          right: 0,
          width: '100%',
          height: visualViewport ? visualViewport.height : '100%',
          zIndex: 1300,
          borderRadius: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {renderHeader()}
        <Box
          sx={{
            flexGrow: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {renderContent()}
        </Box>
      </Paper>

      <Snackbar
        open={isSessionClosed}
        autoHideDuration={5000}
        onClose={() => setSessionClosed(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSessionClosed(false)}
          severity="info"
          variant="filled"
          sx={{ backgroundColor: navy, color: '#fff' }}
        >
          {t('chatSessionClosedByAdmin')}
        </Alert>
      </Snackbar>

      <Snackbar
        open={showTakenAlert}
        autoHideDuration={5000}
        onClose={() => setShowTakenAlert(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setShowTakenAlert(false)}
          severity="info"
          variant="filled"
          sx={{ backgroundColor: navy, color: '#fff' }}
        >
          {t('chatSessionTakenByOther')}
        </Alert>
      </Snackbar>
    </>
  );
}
