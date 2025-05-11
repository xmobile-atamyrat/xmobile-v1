import DeleteDialog from '@/pages/components/DeleteDialog';
import { SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import AddEditHistoryDialog from '@/pages/procurement/components/AddEditHistoryDialog';
import {
  deleteHistoryUtil,
  editHistoryUtil,
} from '@/pages/procurement/lib/apiUtils';
import { DetailedOrder } from '@/pages/procurement/lib/types';
import { dayMonthYearFromDate } from '@/pages/procurement/lib/utils';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { ProcurementOrder } from '@prisma/client';
import { useTranslations } from 'next-intl';
import { Dispatch, SetStateAction, useState } from 'react';

interface HistoryListDialogProps {
  handleClose: () => void;
  historyList: ProcurementOrder[];
  handleSelectHistory: (id: string) => Promise<void>;
  setHistoryList: Dispatch<SetStateAction<ProcurementOrder[]>>;
  selectedHistory: DetailedOrder;
  setSelectedHistory: Dispatch<SetStateAction<DetailedOrder>>;
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>;
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>;
}

export default function AddSupplierDialog({
  handleClose,
  historyList,
  handleSelectHistory,
  setHistoryList,
  setSnackbarMessage,
  setSnackbarOpen,
  setSelectedHistory,
  selectedHistory,
}: HistoryListDialogProps) {
  const { accessToken } = useUserContext();
  const t = useTranslations();
  const [deleteDialogId, setDeleteDialogId] = useState<string>();
  const [editDialogObj, setEditDialogObj] = useState<{
    id: string;
    name: string;
  }>();

  return (
    <Dialog open onClose={handleClose} component="form" fullScreen>
      <DialogTitle className="w-full flex justify-center">
        {t('history')}
      </DialogTitle>
      <DialogContent>
        <Box className="flex flex-col gap-4 p-2">
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell align="center">{t('name')}</TableCell>
                  <TableCell align="center">{t('createdDate')}</TableCell>
                  <TableCell align="center">{t('modifiedDate')}</TableCell>
                  <TableCell align="center">{t('actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {historyList.map((history) => (
                  <TableRow key={history.id}>
                    <TableCell>
                      <Button
                        variant="outlined"
                        sx={{
                          textTransform: 'none',
                          width: '100%',
                        }}
                        key={history.id}
                        onClick={async () => {
                          await handleSelectHistory(history.id);
                        }}
                      >
                        {history.name}
                      </Button>
                    </TableCell>
                    <TableCell align="center">
                      {dayMonthYearFromDate(new Date(history.createdAt))}
                    </TableCell>
                    <TableCell align="center">
                      {dayMonthYearFromDate(new Date(history.updatedAt))}
                    </TableCell>
                    <TableCell align="center">
                      <Box className="flex flex-row items-center">
                        <IconButton
                          onClick={() => {
                            setEditDialogObj({
                              name: history.name,
                              id: history.id,
                            });
                          }}
                        >
                          <EditIcon color="primary" />
                        </IconButton>
                        <IconButton
                          onClick={() => setDeleteDialogId(history.id)}
                        >
                          <DeleteIcon color="error" />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </DialogContent>
      <DialogActions className="mb-4 mr-4">
        <Button variant="contained" color="error" onClick={handleClose}>
          {t('cancel')}
        </Button>
      </DialogActions>
      {deleteDialogId && (
        <DeleteDialog
          title={t('delete')}
          description={t('confirmDelete')}
          blueButtonText={t('cancel')}
          redButtonText={t('delete')}
          handleClose={() => setDeleteDialogId(undefined)}
          handleDelete={async () => {
            const deletedHistory = await deleteHistoryUtil(
              accessToken,
              deleteDialogId,
              setSnackbarOpen,
              setSnackbarMessage,
            );
            if (deletedHistory) {
              const updatedHistoryList = historyList.filter(
                (history) => history.id !== deletedHistory.id,
              );
              setHistoryList(updatedHistoryList);
              if (selectedHistory.id === deletedHistory.id) {
                if (updatedHistoryList.length > 0) {
                  await handleSelectHistory(updatedHistoryList[0].id);
                } else {
                  setSelectedHistory(undefined);
                }
              }
            }
            setDeleteDialogId(undefined);
          }}
        />
      )}
      {editDialogObj && (
        <AddEditHistoryDialog
          initialTitle={editDialogObj.name}
          handleClose={() => setEditDialogObj(undefined)}
          handleSubmit={async (newTitle: string) => {
            const updatedHistory = await editHistoryUtil({
              accessToken,
              id: editDialogObj.id,
              name: newTitle,
              setSnackbarOpen,
              setSnackbarMessage,
            });
            if (updatedHistory) {
              setHistoryList((prev) =>
                prev.map((history) =>
                  history.id === updatedHistory.id ? updatedHistory : history,
                ),
              );
              if (selectedHistory.id === updatedHistory.id) {
                setSelectedHistory((curr) => {
                  return {
                    ...curr,
                    name: updatedHistory.name,
                  };
                });
              }
              setEditDialogObj(undefined);
            }
          }}
          setSnackbarMessage={setSnackbarMessage}
          setSnackbarOpen={setSnackbarOpen}
        />
      )}
    </Dialog>
  );
}
