import { useChatContext } from '@/pages/lib/ChatContext';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { useVisualViewport } from '@/pages/lib/useVisualViewport';
import { ChatSession } from '@/pages/lib/types';
import { chatClasses } from '@/styles/classMaps/components/chat';
import { colors, fill, hairline, ink, muted, navy, red } from '@/styles/theme';
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
import { ArrowLeft, Headset, MessageCircle, Maximize2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import ChatSessionList from './ChatSessionList';
import ChatWindow from './ChatWindow';

const ONLINE_GREEN = '#1F9A5A';

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
  const visualViewport = useVisualViewport();

  const [isSessionClosed, setSessionClosed] = useState(false);
  const router = useRouter();

  const isAdmin = user && ['ADMIN', 'SUPERUSER'].includes(user.grade);
  const canManageSession = isAdmin && currentSession?.status !== 'CLOSED';

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
      router.push('/user/signin');
      return;
    }
    // Non-admin users get the full chat page, not the floating popup.
    if (!isAdmin) {
      router.push('/chat');
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
    const inSession = !!currentSession;
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
        }}
      >
        {inSession && isAdmin && (
          <Box
            component="button"
            onClick={handleBackToSessionList}
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
        )}

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

        {canManageSession && (
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
        )}
        <IconButton
          size="small"
          onClick={handleExpand}
          sx={{ color: navy, flexShrink: 0 }}
          title="Expand to full screen"
        >
          <Maximize2 size={18} />
        </IconButton>
        {platform === 'mobile' && (
          <IconButton
            size="small"
            onClick={handleToggle}
            sx={{ color: navy, flexShrink: 0 }}
          >
            <X size={20} />
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
        <Typography align="center" sx={{ fontSize: '14px', color: '#17161D' }}>
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
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 500,
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

  return (
    <>
      <Fab
        aria-label="chat"
        onClick={handleToggle}
        className={chatClasses.widget.fab[platform]}
        sx={{
          backgroundColor: navy,
          color: 'white',
          zIndex: 1400,
          '&:hover': {
            backgroundColor: colors.buttonHoverBg,
          },
        }}
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
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
                  top: visualViewport ? visualViewport.offsetTop : 0,
                  left: 0,
                  right: 0,
                  width: '100%',
                  height: visualViewport ? visualViewport.height : '100%',
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
          sx={{ backgroundColor: navy, color: '#fff' }}
        >
          {t('chatSessionClosedByAdmin')}
        </Alert>
      </Snackbar>
    </>
  );
};

export default ChatWidget;
