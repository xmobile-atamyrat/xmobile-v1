import ChatSessionList from '@/pages/components/chat/ChatSessionList';
import ChatWindow from '@/pages/components/chat/ChatWindow';
import { useChatContext } from '@/pages/lib/ChatContext';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { ChatSession } from '@/pages/lib/types';
import { chatClasses } from '@/styles/classMaps/components/chat';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
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
import { GetServerSideProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';

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

  const [loading, setLoading] = useState(false);
  const [showTakenAlert, setShowTakenAlert] = useState(false);
  const [isSessionClosed, setSessionClosed] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const initializedSessionIdRef = useRef<string | null>(null);
  const messagesLoadedRef = useRef<string | null>(null);

  const isAdmin = user && ['ADMIN', 'SUPERUSER'].includes(user.grade);

  // Redirect to sign in if not authenticated
  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/user/sign_in_up');
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

        // If sessions haven't loaded yet, wait for them
        if (sessions.length === 0) {
          // Sessions are still loading, keep initializing state
          return;
        }

        setIsInitializing(true);
        setSessionError(null);
        const session = sessions.find((s) => s.id === sessionId);
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
    if (currentSession) {
      const title = isAdmin
        ? `${
            currentSession.users?.find((u) => u.grade === 'FREE')?.name ||
            t('chatGuest')
          }`
        : t('chatCustomerSupport');

      return (
        <Box
          className={chatClasses.header.container[platform]}
          sx={{
            backgroundColor: '#FF624C',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            minHeight: '64px',
            px: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {isAdmin ? (
              <IconButton
                size="small"
                onClick={handleBackToSessionList}
                sx={{ color: 'white' }}
              >
                <ArrowBackIcon />
              </IconButton>
            ) : (
              <IconButton
                size="small"
                onClick={handleBack}
                sx={{ color: 'white' }}
              >
                <ArrowBackIcon />
              </IconButton>
            )}
            <Typography sx={{ fontSize: '15px', fontWeight: 600 }}>
              {title}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {isAdmin && (
              <Button
                size="small"
                variant="text"
                onClick={handleEndSession}
                sx={{
                  color: 'white',
                  minWidth: 'auto',
                  fontSize: '13px',
                  textTransform: 'none',
                }}
              >
                {t('chatEndButton')}
              </Button>
            )}
          </Box>
        </Box>
      );
    }

    return (
      <Box
        className={chatClasses.header.container[platform]}
        sx={{
          backgroundColor: '#FF624C',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          minHeight: '64px',
          px: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton size="small" onClick={handleBack} sx={{ color: 'white' }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography sx={{ fontSize: '15px', fontWeight: 600 }}>
            {isAdmin ? t('chatAdminDashboard') : t('chatSupportChat')}
          </Typography>
        </Box>
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
          <CircularProgress sx={{ color: '#FF624C' }} />
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
          <Typography
            align="center"
            sx={{ fontSize: '14px', color: '#838383' }}
          >
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
        <Typography align="center" sx={{ fontSize: '14px', color: '#1B1B1B' }}>
          {t('chatNeedHelpPrompt')}
        </Typography>
        <Button
          variant="contained"
          onClick={handleStartChatUser}
          disabled={loading || !isConnected}
          sx={{
            backgroundColor: '#FF624C',
            color: 'white',
            textTransform: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 500,
            px: 3,
            '&:hover': {
              backgroundColor: '#EC4D38',
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
          inset: 0,
          width: '100%',
          height: '100%',
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
          sx={{ backgroundColor: '#ff624c', color: '#fff' }}
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
          sx={{ backgroundColor: '#ff624c', color: '#fff' }}
        >
          {t('chatSessionTakenByOther')}
        </Alert>
      </Snackbar>
    </>
  );
}
