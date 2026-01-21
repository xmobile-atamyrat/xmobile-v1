import { SearchBar } from '@/pages/components/Appbar';
import DeleteDialog from '@/pages/components/DeleteDialog';
import Layout from '@/pages/components/Layout';
import { appBarHeight, mobileAppBarHeight } from '@/pages/lib/constants';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import AddColor from '@/pages/product/components/AddColor';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  Alert,
  Box,
  Button,
  IconButton,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Colors } from '@prisma/client';
import { GetServerSideProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';

export const getServerSideProps: GetServerSideProps = async (context) => {
  return {
    props: {
      messages: (await import(`../../../i18n/${context.locale}.json`)).default,
    },
  };
};

export default function UpdateColors() {
  const router = useRouter();
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const t = useTranslations();
  const [colors, setColors] = useState<Colors[]>([]);
  const [updatedColors, setUpdatedColors] = useState<{
    [key: string]: Partial<Colors>;
  }>({});
  const [hoveredColor, setHoveredColor] = useState<string>();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedColorId, setSelectedColorId] = useState<string>();
  const [showCreateColorDialog, setShowCreateColorDialog] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<SnackbarProps>();
  const [searchKeyword, setSearchKeyword] = useState('');
  const { user, accessToken } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();

  const fetchColors = useCallback(
    async (keyword?: string) => {
      if (!accessToken) return;
      const path = keyword
        ? `/api/colors?searchKeyword=${keyword}`
        : '/api/colors';
      const response = await fetchWithCreds<Colors[]>({
        accessToken,
        path,
        method: 'GET',
      });

      if (response.success && response.data != null) {
        setColors(response.data);
      } else {
        setSnackbarMessage({
          message: 'fetchColorsError',
          severity: 'error',
        });
        setSnackbarOpen(true);
      }
    },
    [accessToken, fetchWithCreds],
  );

  useEffect(() => {
    fetchColors();
  }, [fetchColors]);

  const handleColorUpdate = (
    id: string,
    field: keyof Colors,
    value: string,
  ) => {
    setUpdatedColors((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        id,
        [field]: value,
      },
    }));

    setColors((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)),
    );
  };

  const handleSave = async () => {
    try {
      const colorPairs = Object.values(updatedColors);
      const { success } = await fetchWithCreds<Colors[]>({
        accessToken,
        path: `/api/colors`,
        method: 'PUT',
        body: { colorPairs },
      });

      if (success) {
        setSnackbarMessage({ message: 'colorsUpdated', severity: 'success' });
        setUpdatedColors({});
      } else {
        setSnackbarMessage({ message: 'updateColorsError', severity: 'error' });
      }
      setSnackbarOpen(true);
    } catch (error) {
      console.error(error);
      setSnackbarMessage({ message: 'updateColorsError', severity: 'error' });
      setSnackbarOpen(true);
    }
  };

  return (
    <Layout handleHeaderBackButton={() => router.push('/')}>
      {['SUPERUSER', 'ADMIN'].includes(user?.grade) && (
        <Box
          sx={{
            mt: isMdUp
              ? `${appBarHeight * 1.25}px`
              : `${mobileAppBarHeight * 1.25}px`,
            px: isMdUp ? 4 : 1,
            pb: 4,
          }}
          className="flex flex-col gap-8 w-full h-full"
        >
          <Box className="flex flex-col w-full justify-center gap-4 pl-2">
            <Typography variant="h5" fontWeight={600}>
              {t('colors')}
            </Typography>

            <Box className="flex flex-col gap-2 w-full max-w-[600px]">
              <Box className="w-full">
                {SearchBar({
                  handleSearch: (keyword) => fetchColors(keyword),
                  setSearchKeyword,
                  searchPlaceholder: t('search'),
                  searchKeyword,
                  width: '100%',
                })}
              </Box>
              <Box className="flex flex-row gap-2 w-full">
                <Button
                  variant="contained"
                  onClick={() => setShowCreateColorDialog(true)}
                  sx={{ textTransform: 'none', height: 42 }}
                >
                  {t('addColor')}
                </Button>
                {Object.keys(updatedColors).length > 0 && (
                  <Button
                    variant="contained"
                    onClick={handleSave}
                    sx={{ textTransform: 'none', height: 42 }}
                  >
                    {t('save')}
                  </Button>
                )}
              </Box>
            </Box>
          </Box>

          <Table>
            <TableHead>
              <TableRow>
                <TableCell>
                  <Typography fontWeight={600}>{t('colorName')}</Typography>
                </TableCell>
                <TableCell>
                  <Typography fontWeight={600}>{t('colorCode')}</Typography>
                </TableCell>
                <TableCell>
                  <Typography fontWeight={600}>{t('preview')}</Typography>
                </TableCell>
                <TableCell>
                  <Typography fontWeight={600}>ID</Typography>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {colors.map((color) => (
                <TableRow
                  key={color.id}
                  onMouseOver={() => setHoveredColor(color.id)}
                  onMouseOut={() => setHoveredColor(undefined)}
                >
                  <TableCell>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        position: 'relative',
                      }}
                    >
                      {hoveredColor === color.id && (
                        <IconButton
                          sx={{ position: 'absolute', left: -40 }}
                          onClick={() => {
                            setSelectedColorId(color.id);
                            setShowDeleteDialog(true);
                          }}
                        >
                          <DeleteIcon color="error" />
                        </IconButton>
                      )}
                      <TextField
                        variant="standard"
                        fullWidth
                        value={color.name}
                        onChange={(e) =>
                          handleColorUpdate(color.id, 'name', e.target.value)
                        }
                        InputProps={{ disableUnderline: true }}
                      />
                    </Box>
                  </TableCell>
                  <TableCell>
                    <TextField
                      variant="standard"
                      type="color"
                      value={color.hex}
                      onChange={(e) =>
                        handleColorUpdate(color.id, 'hex', e.target.value)
                      }
                      InputProps={{ disableUnderline: true }}
                    />
                  </TableCell>
                  <TableCell>
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        backgroundColor: color.hex,
                        border: '1px solid #ccc',
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ position: 'relative' }}>
                    {hoveredColor === color.id && (
                      <IconButton
                        sx={{ position: 'absolute', left: -10 }}
                        onClick={() => {
                          navigator.clipboard.writeText(color.id);
                          setSnackbarMessage({
                            message: 'copied',
                            severity: 'success',
                          });
                          setSnackbarOpen(true);
                        }}
                      >
                        <ContentCopyIcon color="primary" fontSize="small" />
                      </IconButton>
                    )}
                    <Typography variant="caption" color="textSecondary">
                      {color.id}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Snackbar
            open={snackbarOpen}
            autoHideDuration={6000}
            onClose={() => setSnackbarOpen(false)}
          >
            <Alert severity={snackbarMessage?.severity} variant="filled">
              {snackbarMessage?.message && t(snackbarMessage.message)}
            </Alert>
          </Snackbar>

          {showDeleteDialog && (
            <DeleteDialog
              title={t('deleteColor')}
              description={t('confirmDeleteColor')}
              blueButtonText={t('cancel')}
              redButtonText={t('delete')}
              handleClose={() => setShowDeleteDialog(false)}
              handleDelete={async () => {
                if (!selectedColorId) return;
                const { success } = await fetchWithCreds({
                  accessToken,
                  path: `/api/colors?id=${selectedColorId}`,
                  method: 'DELETE',
                });
                if (success) {
                  setColors((prev) =>
                    prev.filter((c) => c.id !== selectedColorId),
                  );
                  setSnackbarMessage({
                    message: 'colorDeleteSuccess',
                    severity: 'success',
                  });
                } else {
                  setSnackbarMessage({
                    message: 'colorDeleteFailed',
                    severity: 'error',
                  });
                }
                setSnackbarOpen(true);
                setShowDeleteDialog(false);
              }}
            />
          )}

          {showCreateColorDialog && (
            <AddColor
              handleClose={() => setShowCreateColorDialog(false)}
              handleCreate={async (name, hex) => {
                const { success, data } = await fetchWithCreds<Colors>({
                  accessToken,
                  path: '/api/colors',
                  method: 'POST',
                  body: { name, hex },
                });
                if (success && data) {
                  setColors((prev) => [data, ...prev]);
                  setSnackbarMessage({
                    message: 'colorCreateSuccess',
                    severity: 'success',
                  });
                  setSnackbarOpen(true);
                  return true;
                }
                setSnackbarMessage({
                  message: 'colorCreateFailed',
                  severity: 'error',
                });
                setSnackbarOpen(true);
                return false;
              }}
            />
          )}
        </Box>
      )}
    </Layout>
  );
}
