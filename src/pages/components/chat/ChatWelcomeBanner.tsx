import HeadsetMicOutlinedIcon from '@mui/icons-material/HeadsetMicOutlined';
import { Box, Typography } from '@mui/material';
import { useTranslations } from 'next-intl';

const ChatWelcomeBanner = () => {
  const t = useTranslations();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        px: 3,
        pt: 3,
        pb: 2,
      }}
    >
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          backgroundColor: 'rgba(255, 98, 76, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 1.5,
        }}
      >
        <HeadsetMicOutlinedIcon sx={{ color: '#FF624C', fontSize: 24 }} />
      </Box>

      <Typography
        sx={{ fontSize: '13px', fontWeight: 600, color: '#1B1B1B', mb: 0.5 }}
      >
        {t('chatCustomerSupport')}
      </Typography>

      <Typography
        sx={{
          fontSize: '13px',
          color: '#838383',
          textAlign: 'center',
          lineHeight: 1.5,
        }}
      >
        {t('chatWelcomeMessage')}
      </Typography>
    </Box>
  );
};

export default ChatWelcomeBanner;
