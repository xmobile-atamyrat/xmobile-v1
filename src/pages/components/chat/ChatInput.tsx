import { usePlatform } from '@/pages/lib/PlatformContext';
import { chatClasses } from '@/styles/classMaps/components/chat';
import SendIcon from '@mui/icons-material/Send';
import { Box, CircularProgress, IconButton, TextField } from '@mui/material';
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

  useEffect(() => {
    if (shouldFocus && !disabled && !isSending) {
      inputRef.current?.focus();
      setShouldFocus(false);
    }
  }, [shouldFocus, disabled, isSending]);

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message);
      setMessage('');
      setShouldFocus(true);
    }
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
        display: 'flex',
        alignItems: 'center',
        borderTop: '1px solid #E6E6E6',
        backgroundColor: '#fff',
      }}
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
              e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300); // Delay to allow keyboard animation
          }
        }}
        disabled={disabled || isSending}
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: '20px',
            backgroundColor: '#F6F6F6',
            border: 'none',
            fontSize: { xs: '13px', sm: '14px' },
            '& fieldset': { border: 'none' },
            '&:hover fieldset': { border: 'none' },
            '&.Mui-focused fieldset': { border: 'none' },
          },
        }}
      />
      <IconButton
        className={chatClasses.input.button[platform]}
        onClick={handleSend}
        disabled={!message.trim() || disabled}
        sx={{
          borderRadius: '50%',
          backgroundColor: '#FF624C',
          color: '#fff',
          '&:hover': { backgroundColor: '#FF624C' },
          '&.Mui-disabled': { backgroundColor: '#D0D5DD', color: '#fff' },
        }}
      >
        <SendIcon sx={{ fontSize: { xs: '18px', sm: '20px' } }} />
      </IconButton>
      {isSending && <CircularProgress size={20} sx={{ color: '#FF624C' }} />}
    </Box>
  );
};

export default ChatInput;
