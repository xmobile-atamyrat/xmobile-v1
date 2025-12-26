import { useChatContext } from '@/pages/lib/ChatContext';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { ChatSession } from '@/pages/lib/types';
import { chatClasses } from '@/styles/classMaps/components/chat';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChatIcon from '@mui/icons-material/Chat';
import CloseIcon from '@mui/icons-material/Close';
import {
  Box,
  Button,
  CircularProgress,
  Fab,
  IconButton,
  Paper,
  Slide,
  Typography,
} from '@mui/material';
import { useTranslations } from 'next-intl';
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

  const isAdmin = user && ['ADMIN', 'SUPERUSER'].includes(user.grade);

  useEffect(() => {
    if (isOpen) {
      loadSessions();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && !isAdmin && sessions.length > 0 && !currentSession) {
      const activeSession = sessions[0];
      setCurrentSession(activeSession);
      joinSession(activeSession.id);
      loadMessages(activeSession.id);
    }
  }, [sessions, isAdmin, currentSession, isOpen]);

  // Monitor session status changes to show alerts
  useEffect(() => {
    if (currentSession?.status === 'CLOSED') {
      window.alert(t('chatSessionClosedByAdmin'));
    }
  }, [currentSession?.status, t]);

  if (!user) return null;

  const handleToggle = () => {
    setIsOpen((prev) => !prev);
  };

  const handleStartChatUser = async () => {
    setLoading(true);
    await createSession();
    setLoading(false);
  };

  const handleSessionSelect = async (session: ChatSession) => {
    try {
      await joinSession(session.id);
    } catch (error) {
      console.error('Failed to join session', error);
    }
  };

  const handleBackToSessionList = () => {
    setCurrentSession(undefined);
  };

  const handleEndSession = async () => {
    if (!currentSession || !isAdmin) return;

    if (window.confirm(t('chatConfirmEndSession'))) {
      await endSession(currentSession.id);
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: isConnected ? '#4caf50' : '#f44336',
            }}
          />
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
                  bottom: '80px',
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
    </>
  );
};

export default ChatWidget;
