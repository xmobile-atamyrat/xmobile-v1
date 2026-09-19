import { fontClassName, hairline, ink, muted, red } from '@/styles/theme';
import LoadingButton from '@mui/lab/LoadingButton';
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

interface DeleteDialogProps {
  title: string;
  description?: string;
  handleClose: () => void;
  handleDelete: () => Promise<void> | void;
  blueButtonText?: string;
  redButtonText?: string;
}

export default function DeleteDialog({
  description,
  title,
  handleClose,
  handleDelete,
  blueButtonText,
  redButtonText,
}: DeleteDialogProps) {
  const [loading, setLoading] = useState(false);
  const t = useTranslations();

  return (
    <Dialog
      open
      onClose={handleClose}
      PaperProps={{
        sx: { borderRadius: '16px', p: '20px', maxWidth: 320, width: '100%' },
      }}
    >
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: '999px',
          bgcolor: '#FDECEE',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mx: 'auto',
        }}
      >
        <Trash2 size={22} color={red} />
      </Box>
      <DialogTitle
        id="alert-dialog-title"
        className={fontClassName.className}
        sx={{
          textAlign: 'center',
          fontSize: '16px',
          fontWeight: 700,
          color: ink,
        }}
      >
        {title}
      </DialogTitle>
      {description && (
        <DialogContent sx={{ py: 0 }}>
          <DialogContentText
            id="alert-dialog-description"
            className={fontClassName.className}
            sx={{
              textAlign: 'center',
              fontSize: '13px',
              lineHeight: 1.5,
              color: muted,
            }}
          >
            {description}
          </DialogContentText>
        </DialogContent>
      )}
      <DialogActions sx={{ gap: '10px', px: '20px', pt: '16px', pb: 0 }}>
        <button
          onClick={handleClose}
          className={`${fontClassName.className} flex-1 h-[42px] rounded-[11px] bg-white text-[14px] font-semibold`}
          style={{ border: `1px solid ${hairline}`, color: '#4A4959' }}
        >
          {blueButtonText ?? t('cancel')}
        </button>
        <LoadingButton
          loading={loading}
          onClick={async () => {
            setLoading(true);
            await handleDelete();
            setLoading(false);
          }}
          autoFocus
          variant="contained"
          disableElevation
          className={fontClassName.className}
          sx={{
            flex: 1,
            height: '42px',
            borderRadius: '11px',
            textTransform: 'none',
            fontSize: '14px',
            fontWeight: 600,
            bgcolor: red,
            '&:hover': { bgcolor: red },
          }}
        >
          {redButtonText ?? t('delete')}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
