import ChatBubble from '@/pages/components/chat/ChatBubble';
import ChatInput from '@/pages/components/chat/ChatInput';
import { useChatContext } from '@/pages/lib/ChatContext';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { chatClasses } from '@/styles/classMaps/components/chat';
import { Box, Button, Typography } from '@mui/material';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';

const ChatWindow = () => {
  const {
    messages,
    sendMessage,
    currentSession,
    isConnected,
    isSendingMessage,
    loadMessages,
  } = useChatContext();
  const { user } = useUserContext();
  const platform = usePlatform();
  const t = useTranslations();
  const scrollRef = useRef<HTMLDivElement>(null);

  const hasMore = messages.length >= 50;

  const isClosed = currentSession?.status === 'CLOSED';

  const isAdminView = user?.grade === 'ADMIN' || user?.grade === 'SUPERUSER';

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    // Always scroll to bottom
    container.scrollTop = container.scrollHeight;
  }, [messages]);

  const handleLoadMore = () => {
    if (!currentSession || !messages.length) return;

    const oldestMsg = messages[0];
    const cursorId = oldestMsg.messageId || oldestMsg.tempId;
    if (cursorId) {
      loadMessages(currentSession.id, cursorId);
    }
  };

  if (!currentSession) {
    return (
      <Box sx={{ p: 3, textAlign: 'center', color: '#838383' }}>
        <Typography sx={{ fontSize: '14px' }}>
          {t('chatNoActiveSession')}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#F9F9F9',
      }}
    >
      {/* Messages Area */}
      <Box
        ref={scrollRef}
        className={chatClasses.chatWindow.messagesArea[platform]}
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {hasMore && messages.length > 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <Button
              size="small"
              onClick={handleLoadMore}
              sx={{
                textTransform: 'none',
                fontSize: '13px',
                color: '#FF624C',
              }}
            >
              {t('chatLoadOlderMessages')}
            </Button>
          </Box>
        )}
        {messages.length === 0 ? (
          <Typography
            sx={{
              textAlign: 'center',
              color: '#9E9E9E',
              mt: 4,
              fontSize: '14px',
            }}
          >
            {t('chatStartConversation')}
          </Typography>
        ) : (
          (() => {
            const elements: JSX.Element[] = [];
            let lastDateKey: string | null = null;

            messages.forEach((msg) => {
              const date = new Date(
                msg.date || msg.createdAt || msg.timestamp || Date.now(),
              );
              const dateKey = date.toDateString();

              if (dateKey !== lastDateKey) {
                elements.push(
                  <Box
                    key={`d-${dateKey}`}
                    sx={{ display: 'flex', justifyContent: 'center', my: 1 }}
                  >
                    <Typography
                      sx={{
                        px: 2,
                        py: 0.4,
                        bgcolor: 'grey.300',
                        color: 'text.secondary',
                        borderRadius: '999px',
                        fontSize: '12px',
                      }}
                    >
                      {date.toLocaleDateString()}
                    </Typography>
                  </Box>,
                );
                lastDateKey = dateKey;
              }

              const isAdminMessage =
                msg.senderRole === 'ADMIN' || msg.senderRole === 'SUPERUSER';
              const isMe = msg.senderId === user?.id;

              let senderIndicator;
              if (isMe) {
                senderIndicator = t('chatYou') || 'You';
              } else if (isAdminMessage) {
                senderIndicator =
                  msg.senderName || `Admin (${msg.senderId.slice(-4)})`;
              }

              const key =
                msg.messageId ||
                msg.tempId ||
                `msg-${msg.senderId}-${msg.date}`;

              elements.push(
                <ChatBubble
                  key={key}
                  message={msg}
                  isMe={isMe}
                  senderIndicator={senderIndicator}
                />,
              );
            });

            return elements;
          })()
        )}
      </Box>

      {isClosed && (
        <Box
          sx={{
            p: 1.5,
            textAlign: 'center',
            backgroundColor: '#FFF3E0',
            borderTop: '1px solid #FFE0B2',
          }}
        >
          <Typography
            sx={{ fontSize: '13px', color: '#E65100', fontWeight: 500 }}
          >
            {isAdminView ? t('chatReadOnlyMode') : t('chatSessionClosed')}
          </Typography>
        </Box>
      )}
      <ChatInput
        onSendMessage={sendMessage}
        disabled={!isConnected || isClosed}
        isSending={isSendingMessage}
      />
    </Box>
  );
};

export default ChatWindow;
