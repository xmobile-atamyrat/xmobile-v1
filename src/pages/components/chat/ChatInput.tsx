import {
  CHAT_MESSAGE_COUNTER_THRESHOLD,
  CHAT_MESSAGE_MAX_LENGTH,
} from '@/pages/lib/constants';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { chatClasses } from '@/styles/classMaps/components/chat';
import { fill, hairline, navy } from '@/styles/theme';
import {
  Box,
  CircularProgress,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
import { Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React, { useEffect, useRef, useState } from 'react';

interface ChatInputProps {
  onSendMessage: (content: string) => void;
  disabled?: boolean;
  isSending?: boolean;
}

const ChatInput = ({ onSendMessage, disabled, isSending }: ChatInputProps) => {
  const [message, setMessage] = useState('');
  const [shouldFocus, setShouldFocus] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const platform = usePlatform();
  const t = useTranslations();

  const { length } = message;
  const isOverLimit = length > CHAT_MESSAGE_MAX_LENGTH;
  const showCounter =
    length >= CHAT_MESSAGE_MAX_LENGTH - CHAT_MESSAGE_COUNTER_THRESHOLD;
  const canSend = Boolean(message.trim()) && !isOverLimit && !disabled;

  useEffect(() => {
    if (shouldFocus && !disabled && !isSending) {
      inputRef.current?.focus();
      setShouldFocus(false);
    }
  }, [shouldFocus, disabled, isSending]);

  const handleSend = () => {
    if (!canSend) return;
    onSendMessage(message.trim());
    setMessage('');
    setShouldFocus(true);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Box
      className={chatClasses.input.container[platform]}
      sx={{
        borderTop: `1px solid ${hairline}`,
        backgroundColor: '#fff',
      }}
    >
      <Box
        className={chatClasses.input.row[platform]}
        sx={{ display: 'flex', alignItems: 'center' }}
      >
        <TextField
          inputRef={inputRef}
          fullWidth
          placeholder={t('chatTypeMessage')}
          variant="outlined"
          size="small"
          multiline
          maxRows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyPress}
          onFocus={(e) => {
            // Scroll input into view when keyboard appears on mobile
            if (platform === 'mobile') {
              setTimeout(() => {
                e.target.scrollIntoView({
                  behavior: 'smooth',
                  block: 'center',
                });
              }, 300); // Delay to allow keyboard animation
            }
          }}
          disabled={disabled || isSending}
          error={isOverLimit}
          inputProps={{
            'aria-invalid': isOverLimit,
            'aria-describedby': showCounter ? 'chat-input-counter' : undefined,
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '999px',
              backgroundColor: fill,
              border: 'none',
              fontSize: { xs: '13px', sm: '14px' },
              '& fieldset': { border: 'none' },
              '&:hover fieldset': { border: 'none' },
              '&.Mui-focused fieldset': { border: 'none' },
              ...(isOverLimit && {
                outline: '1px solid',
                outlineColor: 'error.main',
              }),
            },
          }}
        />
        <IconButton
          className={chatClasses.input.button[platform]}
          onClick={handleSend}
          disabled={!canSend}
          sx={{
            borderRadius: '50%',
            backgroundColor: navy,
            color: '#fff',
            '&:hover': { backgroundColor: navy },
            '&.Mui-disabled': { backgroundColor: '#D0D5DD', color: '#fff' },
          }}
        >
          <Send size={18} />
        </IconButton>
        {isSending && <CircularProgress size={20} sx={{ color: navy }} />}
      </Box>
      {showCounter && (
        <Box
          id="chat-input-counter"
          className={chatClasses.input.counter[platform]}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography
            role="alert"
            variant="inherit"
            sx={{ color: 'error.main' }}
          >
            {isOverLimit
              ? t('chatMessageTooLong', {
                  count: length - CHAT_MESSAGE_MAX_LENGTH,
                })
              : ''}
          </Typography>
          <Typography
            variant="inherit"
            sx={{
              flexShrink: 0,
              color: isOverLimit ? 'error.main' : 'text.secondary',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {length}/{CHAT_MESSAGE_MAX_LENGTH}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default ChatInput;
