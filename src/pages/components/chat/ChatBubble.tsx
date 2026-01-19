import { usePlatform } from '@/pages/lib/PlatformContext';
import { ChatMessage } from '@/pages/lib/types';
import { linkify } from '@/pages/lib/utils';
import { chatClasses } from '@/styles/classMaps/components/chat';
import { Box, Paper, Typography } from '@mui/material';

interface ChatBubbleProps {
  message: ChatMessage;
  isMe: boolean;
}

const ChatBubble = ({ message, isMe }: ChatBubbleProps) => {
  const platform = usePlatform();
  const isUserMessage = message.senderRole === 'FREE';
  const backgroundColor = isUserMessage ? '#FF624C' : '#1B1B1B';

  const alignSelf = isMe ? 'flex-end' : 'flex-start';
  const borderRadius = isMe ? '16px 16px 0px 16px' : '16px 16px 16px 0px';

  return (
    <Box
      className={chatClasses.bubble.container}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: alignSelf,
      }}
    >
      <Paper
        elevation={0}
        className={chatClasses.bubble.paper[platform]}
        sx={{
          backgroundColor,
          color: '#fff',
          borderRadius,
          wordBreak: 'break-word',
          border: !isUserMessage ? '1px solid #E6E6E6' : 'none',
          maxWidth: '75%',
        }}
      >
        <Typography
          className={chatClasses.bubble.text[platform]}
          sx={{ fontWeight: 400 }}
        >
          {linkify(message.content)}
        </Typography>
      </Paper>

      {/* Timestamp & Status */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography
          className={chatClasses.bubble.timestamp}
          sx={{ color: '#9E9E9E' }}
        >
          {new Date(
            message.timestamp ||
              message.date ||
              message.updatedAt ||
              Date.now(),
          ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Typography>
        {isMe && message.status === 'error' && (
          <Typography
            variant="caption"
            sx={{ color: 'red', fontSize: '0.7rem' }}
          >
            !
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default ChatBubble;
