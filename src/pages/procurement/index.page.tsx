import Layout from '@/pages/components/Layout';
import { appBarHeight, mobileAppBarHeight } from '@/pages/lib/constants';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';

import {
  createHistoryUtil,
  editHistoryUtil,
  getHistoryListUtil,
} from '@/pages/procurement/lib/apiUtils';
import { DetailedOrder } from '@/pages/procurement/lib/types';
import { dayMonthYearFromDate } from '@/pages/procurement/lib/utils';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { ProcurementOrder } from '@prisma/client';

import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';

export default function ProcurementHistory() {
  const { user, accessToken } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();
  const router = useRouter();

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [historyList, setHistoryList] = useState<ProcurementOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [createHistoryDialog, setCreateHistoryDialog] = useState(false);
  const [editHistoryDialog, setEditHistoryDialog] = useState<DetailedOrder>();

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<SnackbarProps>();
  const [pricesMenuAnchorEl, setPricesMenuAnchorEl] =
    useState<null | HTMLElement>(null);

  const fetchHistoryList = useCallback(async () => {
    if (!accessToken) return;

    try {
      await getHistoryListUtil({
        accessToken,
        fetchWithCreds,
        setHistoryList,
        setSnackbarMessage,
        setSnackbarOpen,
      });
    } finally {
      setLoading(false);
    }
  }, [accessToken, fetchWithCreds]);

  useEffect(() => {
    if (accessToken) {
      fetchHistoryList();
    }
  }, [accessToken]);

  const handleCreateHistory = useCallback(
    async (name: string) => {
      await createHistoryUtil({
        accessToken,
        name,
        fetchWithCreds,
        setSnackbarMessage,
        setSnackbarOpen,
        setHistory: setHistoryList,
        setSelectedHistory: () => {}, // Not needed for this use case
      });
      setCreateHistoryDialog(false);
    },
    [accessToken, fetchWithCreds],
  );

  const handleEditHistory = useCallback(
    async (id: string, name: string, currency: string) => {
      await editHistoryUtil({
        accessToken,
        id,
        name,
        currency: currency as any, // Type conversion needed
        fetchWithCreds,
        setSnackbarMessage,
        setSnackbarOpen,
      });
      // Refresh the list after edit
      fetchHistoryList();
      setEditHistoryDialog(undefined);
    },
    [accessToken, fetchWithCreds, fetchHistoryList],
  );

  if (!user || user.grade !== 'SUPERUSER') {
    return (
      <Layout>
        <Box className="flex h-screen items-center justify-center">
          <Typography variant="h6" color="error">
            Доступ запрещен
          </Typography>
        </Box>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <Box className="flex h-screen items-center justify-center">
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  return (
    <Layout>
      <Box
        className="flex flex-col p-6"
        style={{
          minHeight: `calc(100vh - ${isMobile ? mobileAppBarHeight : appBarHeight}px)`,
        }}
      >
        <Box className="mb-6 flex items-center justify-between">
          <Typography variant="h4" component="h1">
            Закупки
          </Typography>
          <Box className="flex gap-2">
            <Button
              onClick={() => setCreateHistoryDialog(true)}
              variant="contained"
            >
              Создать сессию
            </Button>
            <Button
              className="h-9"
              onClick={(event) => setPricesMenuAnchorEl(event.currentTarget)}
              sx={{ textTransform: 'none' }}
              variant="outlined"
              endIcon={<KeyboardArrowDownIcon />}
            >
              Цены
            </Button>
            <Menu
              anchorEl={pricesMenuAnchorEl}
              open={Boolean(pricesMenuAnchorEl)}
              onClose={() => setPricesMenuAnchorEl(null)}
            >
              <MenuItem
                onClick={() => {
                  router.push('/procurement/all-prices');
                  setPricesMenuAnchorEl(null);
                }}
              >
                Все цены
              </MenuItem>
            </Menu>
          </Box>
        </Box>

        {historyList.length === 0 ? (
          <Box className="flex flex-col items-center justify-center py-12">
            <Typography variant="h6" color="textSecondary" gutterBottom>
              Нет созданных сессий
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Создайте первую сессию закупок
            </Typography>
          </Box>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Название</TableCell>
                  <TableCell>Валюта</TableCell>
                  <TableCell>Дата создания</TableCell>
                  <TableCell>Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {historyList.map((history) => (
                  <TableRow
                    key={history.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => router.push(`/procurement/${history.id}`)}
                  >
                    <TableCell>{history.name}</TableCell>
                    <TableCell>{history.currency}</TableCell>
                    <TableCell>
                      {dayMonthYearFromDate(history.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Box className="flex gap-1">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditHistoryDialog(history as DetailedOrder);
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            // setDeleteDialogId(history.id);
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Dialogs */}
        {createHistoryDialog && (
          <Dialog
            open={createHistoryDialog}
            onClose={() => setCreateHistoryDialog(false)}
          >
            <DialogTitle>Создать новую сессию</DialogTitle>
            <DialogContent>
              <TextField
                autoFocus
                margin="dense"
                label="Название сессии"
                fullWidth
                variant="outlined"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    const target = e.target as HTMLInputElement;
                    if (target.value.trim()) {
                      handleCreateHistory(target.value.trim());
                    }
                  }
                }}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setCreateHistoryDialog(false)}>
                Отмена
              </Button>
              <Button
                onClick={() => {
                  const input = document.querySelector(
                    'input[label="Название сессии"]',
                  ) as HTMLInputElement;
                  if (input?.value.trim()) {
                    handleCreateHistory(input.value.trim());
                  }
                }}
                variant="contained"
              >
                Создать
              </Button>
            </DialogActions>
          </Dialog>
        )}

        {editHistoryDialog && (
          <Dialog
            open={Boolean(editHistoryDialog)}
            onClose={() => setEditHistoryDialog(undefined)}
          >
            <DialogTitle>Редактировать сессию</DialogTitle>
            <DialogContent>
              <TextField
                autoFocus
                margin="dense"
                label="Название сессии"
                fullWidth
                variant="outlined"
                defaultValue={editHistoryDialog.name}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    const target = e.target as HTMLInputElement;
                    if (target.value.trim()) {
                      handleEditHistory(
                        editHistoryDialog.id,
                        target.value.trim(),
                        editHistoryDialog.currency,
                      );
                    }
                  }
                }}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setEditHistoryDialog(undefined)}>
                Отмена
              </Button>
              <Button
                onClick={() => {
                  const input = document.querySelector(
                    'input[label="Название сессии"]',
                  ) as HTMLInputElement;
                  if (input?.value.trim()) {
                    handleEditHistory(
                      editHistoryDialog.id,
                      input.value.trim(),
                      editHistoryDialog.currency,
                    );
                  }
                }}
                variant="contained"
              >
                Сохранить
              </Button>
            </DialogActions>
          </Dialog>
        )}

        <Snackbar
          open={snackbarOpen}
          autoHideDuration={6000}
          onClose={() => setSnackbarOpen(false)}
        >
          <Alert
            onClose={() => setSnackbarOpen(false)}
            severity={snackbarMessage?.severity}
            sx={{ width: '100%' }}
          >
            {snackbarMessage?.message}
          </Alert>
        </Snackbar>
      </Box>
    </Layout>
  );
}
