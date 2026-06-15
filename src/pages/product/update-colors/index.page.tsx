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
import { Color } from '@prisma/client';
import { GetServerSideProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

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
  const { user, accessToken } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();

  const [colors, setColors] = useState<Color[]>([]);
  const [updatedColors, setUpdatedColors] = useState<{ [id: string]: Color }>(
    {},
  );
  const [hoveredColor, setHoveredColor] = useState<string>();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string>();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<SnackbarProps>();
  const [searchKeyword, setSearchKeyword] = useState('');

  const notify = (message: string, severity: SnackbarProps['severity']) => {
    setSnackbarOpen(true);
    setSnackbarMessage({ message, severity });
  };

  useEffect(() => {
    if (!accessToken) return;
    (async () => {
      const res = await fetchWithCreds<Color[]>({
        accessToken,
        path: '/api/colors',
        method: 'GET',
      });
      if (res.success && res.data != null) {
        setColors(res.data);
      } else {
        notify('fetchColorsError', 'error');
      }
    })();
  }, [accessToken]);

  const handleFieldChange = (
    id: string,
    field: 'name' | 'hex',
    value: string,
  ) => {
    setColors((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)),
    );
    setUpdatedColors((prev) => {
      const base = prev[id] ?? colors.find((c) => c.id === id)!;
      return { ...prev, [id]: { ...base, [field]: value } };
    });
  };

  const handleSave = async () => {
    const colorPairs = Object.values(updatedColors);
    if (colorPairs.length === 0) return;
    const { success, message } = await fetchWithCreds<Color[]>({
      accessToken,
      path: '/api/colors',
      method: 'PUT',
      body: { colorPairs },
    });
    if (success) {
      setUpdatedColors({});
      notify('colorsUpdated', 'success');
    } else {
      notify(
        message === 'colorExists' ? 'colorExists' : 'updateColorsError',
        'error',
      );
    }
  };

  const filteredColors = colors.filter((c) =>
    c.name.toLowerCase().includes(searchKeyword.toLowerCase()),
  );

  return (
    <Layout handleHeaderBackButton={() => router.push('/')}>
      {['SUPERUSER', 'ADMIN'].includes(user?.grade) && (
        <Box
          sx={{
            mt: isMdUp
              ? `${appBarHeight * 1.25}px`
              : `${mobileAppBarHeight * 1.25}px`,
            px: isMdUp ? 4 : 1,
          }}
          className="flex flex-col gap-8 w-full h-full"
        >
          <Box className="flex flex-col gap-2 w-full max-w-[600px] pl-2">
            <Box className="w-full">
              {SearchBar({
                handleSearch: async () => {},
                setSearchKeyword,
                searchPlaceholder: t('search'),
                searchKeyword,
                width: '100%',
              })}
            </Box>
            <Box className="flex flex-row gap-2 w-full">
              <Button
                variant="contained"
                sx={{
                  textTransform: 'none',
                  fontSize: isMdUp ? 18 : 16,
                  height: isMdUp ? 52 : 42,
                  width: 120,
                }}
                onClick={() => setShowCreateDialog(true)}
              >
                <Typography>{t('addColor')}</Typography>
              </Button>
              {Object.keys(updatedColors).length > 0 && (
                <Button
                  variant="contained"
                  sx={{
                    textTransform: 'none',
                    fontSize: isMdUp ? 18 : 16,
                    height: isMdUp ? 52 : 42,
                  }}
                  onClick={handleSave}
                >
                  <Typography>{t('save')}</Typography>
                </Button>
              )}
            </Box>
          </Box>

          {filteredColors.length > 0 && (
            <Table>
              <TableHead>
                <TableRow>
                  {['Name', 'Color', 'ID'].map((header) => (
                    <TableCell key={header}>
                      <Typography fontWeight={600} fontSize={isMdUp ? 18 : 16}>
                        {header}
                      </Typography>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredColors.map((color) => (
                  <TableRow
                    key={color.id}
                    onMouseOver={() => setHoveredColor(color.id)}
                    onMouseOut={() => setHoveredColor(undefined)}
                  >
                    <TableCell className="relative">
                      {hoveredColor === color.id && (
                        <IconButton
                          className="absolute -left-4 top-1"
                          onClick={() => {
                            setSelectedColor(color.id);
                            setShowDeleteDialog(true);
                          }}
                        >
                          <DeleteIcon color="error" />
                        </IconButton>
                      )}
                      <TextField
                        variant="standard"
                        value={color.name}
                        onChange={(e) =>
                          handleFieldChange(color.id, 'name', e.target.value)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Box className="flex flex-row gap-2 items-center">
                        <input
                          type="color"
                          value={color.hex}
                          onChange={(e) =>
                            handleFieldChange(color.id, 'hex', e.target.value)
                          }
                          style={{
                            width: 36,
                            height: 36,
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer',
                          }}
                        />
                        <TextField
                          variant="standard"
                          value={color.hex}
                          onChange={(e) =>
                            handleFieldChange(color.id, 'hex', e.target.value)
                          }
                        />
                      </Box>
                    </TableCell>
                    <TableCell className="relative">
                      {hoveredColor === color.id && (
                        <IconButton
                          className="absolute -left-4 top-1"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(color.id);
                              notify('copied', 'success');
                            } catch (error) {
                              console.error(error);
                              notify('copyFailed', 'error');
                            }
                          }}
                        >
                          <ContentCopyIcon color="primary" />
                        </IconButton>
                      )}
                      {color.id}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <Snackbar
            open={snackbarOpen}
            autoHideDuration={6000}
            onClose={(_, reason) => {
              if (reason === 'clickaway') return;
              setSnackbarOpen(false);
            }}
          >
            <Alert
              onClose={() => setSnackbarOpen(false)}
              severity={snackbarMessage?.severity}
              variant="filled"
              sx={{ width: '100%' }}
            >
              {snackbarMessage?.message && t(snackbarMessage.message)}
            </Alert>
          </Snackbar>

          {showDeleteDialog && (
            <DeleteDialog
              title={t('deleteColor')}
              description={t('confirmDeleteColor')}
              blueButtonText={t('cancel')}
              redButtonText={t('delete')}
              handleClose={async () => setShowDeleteDialog(false)}
              handleDelete={async () => {
                if (selectedColor == null) return;
                try {
                  const { success } = await fetchWithCreds<Color>({
                    accessToken,
                    path: `/api/colors?id=${selectedColor}`,
                    method: 'DELETE',
                  });
                  if (success) {
                    setColors((prev) =>
                      prev.filter((c) => c.id !== selectedColor),
                    );
                    notify('colorDeleteSuccess', 'success');
                  } else {
                    notify('colorDeleteFailed', 'error');
                  }
                } catch (error) {
                  console.error(error);
                  notify('colorDeleteFailed', 'error');
                } finally {
                  setShowDeleteDialog(false);
                }
              }}
            />
          )}

          {showCreateDialog && (
            <AddColor
              handleClose={() => setShowCreateDialog(false)}
              handleCreate={async (name, hex) => {
                if (name === '' || hex === '') {
                  notify('emptyField', 'error');
                  return false;
                }
                if (colors.some((c) => c.name === name || c.hex === hex)) {
                  notify('colorExists', 'error');
                  return false;
                }
                try {
                  const { success, data, message } =
                    await fetchWithCreds<Color>({
                      accessToken,
                      path: '/api/colors',
                      method: 'POST',
                      body: { name, hex },
                    });
                  if (success && data) {
                    setColors((prev) => [data, ...prev]);
                    notify('colorCreateSuccess', 'success');
                    return true;
                  }
                  notify(
                    message === 'colorExists'
                      ? 'colorExists'
                      : 'colorCreateFailed',
                    'error',
                  );
                  return false;
                } catch (error) {
                  console.error(error);
                  notify('colorCreateFailed', 'error');
                  return false;
                }
              }}
            />
          )}
        </Box>
      )}
    </Layout>
  );
}
