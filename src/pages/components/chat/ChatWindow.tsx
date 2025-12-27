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
          messages.map((msg) => {
            const isMe = msg.senderId === user.id;
            const key =
              msg.messageId || msg.tempId || `msg-${msg.senderId}-${msg.date}`;

            return <ChatBubble key={key} message={msg} isMe={isMe} />;
          })
        )}
      </Box>

      {/* Input Area */}
      <ChatInput
        onSendMessage={sendMessage}
        disabled={!isConnected}
        isSending={isSendingMessage}
      />
    </Box>
  );
};

export default ChatWindow;
