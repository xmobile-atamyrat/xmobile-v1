import { SnackbarProps } from '@/pages/lib/types';
import { Box, Button, Dialog, DialogContent, DialogTitle } from '@mui/material';
import { CalculationHistory } from '@prisma/client';
import { useTranslations } from 'next-intl';
import { Dispatch, SetStateAction } from 'react';

interface HistoryListDialogProps {
  handleClose: () => void;
  historyList: CalculationHistory[];
  setHistoryList: Dispatch<SetStateAction<CalculationHistory[]>>;
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>;
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>;
}

export default function AddSupplierDialog({
  handleClose,
  historyList,
}: HistoryListDialogProps) {
  const t = useTranslations();
  return (
    <Dialog open onClose={handleClose} component="form">
      <DialogTitle className="w-full flex justify-center">
        {t('history')}
      </DialogTitle>
      <DialogContent>
        <Box className="flex flex-col w-[300px] sm:w-[600px] gap-4 p-2">
          {historyList.map((history) => (
            <Button
              variant="outlined"
              sx={{
                textTransform: 'none',
                width: 400,
              }}
              key={history.id}
            >
              {history.name}
            </Button>
          ))}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
