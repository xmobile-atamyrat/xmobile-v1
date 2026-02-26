import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import Typography from '@mui/material/Typography';

interface UpdateModalProps {
  type: 'hard' | 'soft';
  onDismiss?: () => void;
}

// Replace when published on stores
const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=YOUR_PACKAGE_NAME';
const APP_STORE_URL = 'https://apps.apple.com/app/YOUR_APP_ID';

export default function UpdateModal({ type, onDismiss }: UpdateModalProps) {
  const isHard = type === 'hard';

  const handleUpdate = () => {
    const url = /iPad|iPhone|iPod/.test(navigator.userAgent)
      ? APP_STORE_URL
      : PLAY_STORE_URL;
    window.open(url, '_blank');
  };

  return (
    <Dialog
      open
      disableEscapeKeyDown={isHard}
      onClose={isHard ? undefined : onDismiss}
      PaperProps={{
        sx: {
          borderRadius: 3,
          p: 1,
          maxWidth: 340,
          textAlign: 'center',
        },
      }}
    >
      <DialogContent>
        <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
          <SystemUpdateAltIcon sx={{ fontSize: 56, color: '#d32f2f' }} />

          <Typography variant="h6" fontWeight={700}>
            {isHard ? 'Обновление обязательно' : 'Доступно обновление'}
          </Typography>

          <Typography variant="body2" color="text.secondary">
            {isHard
              ? 'Эта версия приложения больше не поддерживается. Пожалуйста, обновите приложение, чтобы продолжить использование.'
              : 'Доступна новая версия приложения с улучшениями и исправлениями. Рекомендуем обновить.'}
          </Typography>

          <Button
            variant="contained"
            fullWidth
            onClick={handleUpdate}
            sx={{
              backgroundColor: '#d32f2f',
              '&:hover': { backgroundColor: '#b71c1c' },
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            Обновить
          </Button>

          {!isHard && (
            <Button
              variant="text"
              fullWidth
              onClick={onDismiss}
              sx={{
                color: 'text.secondary',
                textTransform: 'none',
              }}
            >
              Напомнить позже
            </Button>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
