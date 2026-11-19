import { detectMobileOs, storeUrlFor } from '@/pages/lib/appDownload';
import { buttonClasses } from '@/styles/classMaps/components/button';
import { fontClassName, ink, muted, navy } from '@/styles/theme';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import Typography from '@mui/material/Typography';
import { Download } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface UpdateModalProps {
  type: 'hard' | 'soft';
  onDismiss?: () => void;
}

export default function UpdateModal({ type, onDismiss }: UpdateModalProps) {
  const isHard = type === 'hard';
  const t = useTranslations();

  const handleUpdate = () => {
    const url = storeUrlFor(
      detectMobileOs(navigator.userAgent, navigator.maxTouchPoints) ??
        'android',
    );
    window.open(url, '_blank');
  };

  return (
    <Dialog
      open
      disableEscapeKeyDown={isHard}
      onClose={isHard ? undefined : onDismiss}
      PaperProps={{
        sx: {
          borderRadius: '16px',
          p: 1,
          maxWidth: 340,
          textAlign: 'center',
        },
      }}
    >
      <DialogContent>
        <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: '999px',
              bgcolor: '#F0EEF9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Download size={28} color={navy} />
          </Box>

          <Typography
            className={fontClassName.className}
            sx={{ fontSize: '16px', fontWeight: 700, color: ink }}
          >
            {isHard ? t('hardUpdate') : t('softUpdate')}
          </Typography>

          <Typography
            className={fontClassName.className}
            sx={{ fontSize: '13px', lineHeight: 1.5, color: muted }}
          >
            {isHard ? t('hardUpdateDescription') : t('softUpdateDescription')}
          </Typography>

          <button
            onClick={handleUpdate}
            className={`${fontClassName.className} ${buttonClasses.primary.mobile}`}
          >
            {t('update')}
          </button>

          {!isHard && (
            <button
              onClick={onDismiss}
              className={`${fontClassName.className} ${buttonClasses.textLink} w-full`}
            >
              {t('remindLater')}
            </button>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
