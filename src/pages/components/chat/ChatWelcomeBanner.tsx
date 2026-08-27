import { usePlatform } from '@/pages/lib/PlatformContext';
import { colors } from '@/styles/theme';
import { chatClasses } from '@/styles/classMaps/components/chat';
import HeadsetMicOutlinedIcon from '@mui/icons-material/HeadsetMicOutlined';
import { alpha, Box, Typography } from '@mui/material';
import { useTranslations } from 'next-intl';

const ChatWelcomeBanner = () => {
  const t = useTranslations();
  const platform = usePlatform();
  const classes = chatClasses.chatWindow.welcomeBanner;

  return (
    <Box
      className={classes.container[platform]}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <Box
        className={classes.iconWrapper[platform]}
        sx={{
          borderRadius: '50%',
          backgroundColor: alpha(colors.main, 0.1),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <HeadsetMicOutlinedIcon sx={{ color: colors.main, fontSize: 24 }} />
      </Box>

      <Typography
        className={classes.title[platform]}
        sx={{ color: colors.blackText }}
      >
        {t('chatCustomerSupport')}
      </Typography>

      <Typography
        className={classes.message[platform]}
        sx={{ color: colors.placeholder, textAlign: 'center' }}
      >
        {t('chatWelcomeMessage')}
      </Typography>
    </Box>
  );
};

export default ChatWelcomeBanner;
