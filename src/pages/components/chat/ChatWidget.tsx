import { useChatContext } from '@/pages/lib/ChatContext';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { ChatSession } from '@/pages/lib/types';
import { chatClasses } from '@/styles/classMaps/components/chat';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChatIcon from '@mui/icons-material/Chat';
import CloseIcon from '@mui/icons-material/Close';
import SettingsOverscanIcon from '@mui/icons-material/SettingsOverscan';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Fab,
  IconButton,
  Paper,
  Slide,
  Snackbar,
  Typography,
} from '@mui/material';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import ChatSessionList from './ChatSessionList';
import ChatWindow from './ChatWindow';

const ChatWidget = () => {
  const { user } = useUserContext();
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
  } = useChatContext();

  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showTakenAlert, setShowTakenAlert] = useState(false);
  const [isSessionClosed, setSessionClosed] = useState(false);
  const router = useRouter();

  const isAdmin = user && ['ADMIN', 'SUPERUSER'].includes(user.grade);

  useEffect(() => {
    if (isOpen) {
      loadSessions();
    }
  }, [isOpen, loadSessions]);

  useEffect(() => {
    if (currentSession?.status === 'CLOSED') {
      if (!isAdmin) {
        setSessionClosed(true);
      }
    }
  }, [currentSession, isAdmin]);

  useEffect(() => {
    if (isOpen && !isAdmin && sessions.length > 0 && !currentSession) {
      const userSession = sessions[0];
      setCurrentSession(userSession);
      if (isConnected) {
        loadMessages(userSession.id);
      }
    }
  }, [
    sessions,
    isAdmin,
    currentSession,
    isOpen,
    isConnected,
    loadMessages,
    setCurrentSession,
  ]);

  const handleToggle = () => {
    if (!user) {
      router.push('/user');
      return;
    }
    setIsOpen((prev) => !prev);
  };

  const handleStartChatUser = async () => {
    setLoading(true);
    await createSession();
    setLoading(false);
  };

  const handleSessionSelect = async (session: ChatSession) => {
    try {
      const success = await joinSession(session.id);
      if (!success) {
        setShowTakenAlert(true);
      }
    } catch (error) {
      console.error('Failed to join session', error);
    }
  };

  const handleBackToSessionList = () => {
    setCurrentSession(undefined);
  };

  const handleEndSession = async () => {
    if (!currentSession || !isAdmin) return;

    // eslint-disable-next-line no-alert
    if (window.confirm(t('chatConfirmEndSession'))) {
      await endSession(currentSession.id);
    }
  };

  const handleExpand = () => {
    if (currentSession) {
      router.push(`/chat?sessionId=${currentSession.id}`);
    } else {
      router.push('/chat');
    }
  };

  const renderHeader = () => {
    if (currentSession) {
      const title = isAdmin
        ? `${currentSession.users?.find((u) => u.grade === 'FREE')?.name || t('chatGuest')}`
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
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {isAdmin && (
              <IconButton
                size="small"
                onClick={handleBackToSessionList}
                sx={{ color: 'white' }}
              >
                <ArrowBackIcon />
              </IconButton>
            )}
            <Typography sx={{ fontSize: '15px', fontWeight: 600 }}>
              {title}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton
              size="small"
              onClick={handleExpand}
              sx={{ color: 'white' }}
              title="Expand to full screen"
            >
              <SettingsOverscanIcon fontSize="small" />
            </IconButton>
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
            {platform === 'mobile' && (
              <IconButton
                size="small"
                onClick={handleToggle}
                sx={{ color: 'white' }}
              >
                <CloseIcon />
              </IconButton>
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
        }}
      >
        <Typography sx={{ fontSize: '15px', fontWeight: 600 }}>
          {isAdmin ? t('chatAdminDashboard') : t('chatSupportChat')}
        </Typography>
        {platform === 'mobile' && (
          <IconButton
            size="small"
            onClick={handleToggle}
            sx={{ color: 'white' }}
          >
            <CloseIcon />
          </IconButton>
        )}
      </Box>
    );
  };

  const renderContent = () => {
    if (isAdmin) {
      return currentSession ? (
        <ChatWindow />
      ) : (
        <ChatSessionList onSelectSession={handleSessionSelect} />
      );
    }

    if (currentSession && currentSession.status !== 'CLOSED') {
      return <ChatWindow />;
    }

    // Show start view if session is CLOSED (allow creating new session)
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

  return (
    <>
      <Fab
        aria-label="chat"
        onClick={handleToggle}
        className={chatClasses.widget.fab[platform]}
        sx={{
          backgroundColor: '#FF624C',
          color: 'white',
          zIndex: 1400,
          '&:hover': {
            backgroundColor: '#EC4D38',
          },
        }}
      >
        {isOpen ? <CloseIcon /> : <ChatIcon />}
      </Fab>

      <Slide direction="up" in={isOpen} mountOnEnter unmountOnExit>
        <Paper
          sx={{
            position: 'fixed',
            ...(platform === 'web'
              ? {
                  bottom: '96px',
                  right: '24px',
                  width: '420px',
                  height: '600px',
                }
              : {
                  inset: 0,
                  width: '100%',
                  height: '100%',
                }),
            zIndex: 1300,
            borderRadius: '16px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
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
      </Slide>

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
};

export default ChatWidget;
