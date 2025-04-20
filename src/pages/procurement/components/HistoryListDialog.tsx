import { SnackbarProps } from '@/pages/lib/types';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import { CalculationHistory } from '@prisma/client';
import { useTranslations } from 'next-intl';
import { Dispatch, SetStateAction, useState } from 'react';

interface HistoryListDialogProps {
  handleClose: () => void;
  historyList: CalculationHistory[];
  handleSelectHistory: (id: string) => Promise<void>;
  setHistoryList: Dispatch<SetStateAction<CalculationHistory[]>>;
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>;
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>;
}

export default function AddSupplierDialog({
  handleClose,
  historyList,
  handleSelectHistory,
}: HistoryListDialogProps) {
  const t = useTranslations();
  const [loading, setLoading] = useState(false);
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
              onClick={async () => {
                setLoading(true);
                await handleSelectHistory(history.id);
                setLoading(false);
              }}
            >
              {history.name}
            </Button>
          ))}
        </Box>
      </DialogContent>
      <DialogActions className="mb-4 mr-4">
        <Button variant="contained" color="error" onClick={handleClose}>
          {t('cancel')}
        </Button>
      </DialogActions>
      {loading && <CircularProgress />}
    </Dialog>
  );
}
