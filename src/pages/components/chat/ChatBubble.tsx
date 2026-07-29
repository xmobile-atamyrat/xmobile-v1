import { usePlatform } from '@/pages/lib/PlatformContext';
import { ChatMessage } from '@/pages/lib/types';
import { linkify } from '@/pages/lib/utils';
import { chatClasses } from '@/styles/classMaps/components/chat';
import { hairline, ink, navy } from '@/styles/theme';
import { Box, Paper, Typography } from '@mui/material';

interface ChatBubbleProps {
  message: ChatMessage;
  isMe: boolean;
  senderIndicator?: string;
}

const ChatBubble = ({ message, isMe }: ChatBubbleProps) => {
  const platform = usePlatform();
  const isUserMessage = message.senderRole === 'FREE';
  const backgroundColor = isUserMessage ? navy : '#fff';

  const alignSelf = isMe ? 'flex-end' : 'flex-start';
  const borderRadius = isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px';
  // Timestamp tone tracks the bubble fill, not the sender (mockup lines 1131/1134).
  const metaColor = isUserMessage ? 'rgba(255,255,255,.6)' : '#B6B5C2';

  const time = new Date(
    message.timestamp || message.date || message.updatedAt || Date.now(),
  ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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
          color: isUserMessage ? '#fff' : ink,
          borderRadius,
          wordBreak: 'break-word',
          border: !isUserMessage ? `1px solid ${hairline}` : 'none',
          boxShadow: !isUserMessage ? '0 2px 8px rgba(20,16,60,.04)' : 'none',
          maxWidth: '78%',
        }}
      >
        <Typography
          className={chatClasses.bubble.text[platform]}
          sx={{ fontWeight: 400 }}
        >
          {linkify(message.content)}
        </Typography>

        {/* Timestamp inside the bubble (mockup), tone matches the fill */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isMe ? 'flex-end' : 'flex-start',
            gap: 0.5,
            mt: '4px',
          }}
        >
          <Typography sx={{ fontSize: '10px', color: metaColor }}>
            {time}
          </Typography>
          {isMe && message.status === 'error' && (
            <Typography sx={{ color: '#ff5252', fontSize: '10px' }}>
              !
            </Typography>
          )}
        </Box>
      </Paper>
    </Box>
  );
};

export default ChatBubble;
