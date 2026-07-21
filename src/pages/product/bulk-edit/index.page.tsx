import type {
  BulkImportResult,
  BulkProductExportRow,
  BulkVariant,
} from '@/pages/api/product/bulk.page';
import Layout from '@/pages/components/Layout';
import { appBarHeight, mobileAppBarHeight } from '@/pages/lib/constants';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { dayMonthYearFromDate } from '@/pages/procurement/lib/utils';
import {
  buildWorkbookBlob,
  parseWorkbook,
} from '@/pages/product/bulk-edit/lib';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import {
  Alert,
  Box,
  Button,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { GetServerSideProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useRef, useState } from 'react';

export const getServerSideProps: GetServerSideProps = async (context) => {
  return {
    props: {
      messages: (await import(`../../../i18n/${context.locale}.json`)).default,
    },
  };
};

export default function BulkEdit() {
  const router = useRouter();
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const t = useTranslations();
  const { user, accessToken } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BulkImportResult>();
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<SnackbarProps>();

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbarOpen(true);
    setSnackbarMessage({ message, severity });
  };

  const handleDownload = async () => {
    setLoading(true);
    try {
      const { success, data } = await fetchWithCreds<{
        products: BulkProductExportRow[];
        variants: BulkVariant[];
        rate: number | null;
        categorySlugs: string[];
        brands: string[];
      }>({
        accessToken,
        path: '/api/product/bulk',
        method: 'GET',
      });
      if (!success || data == null) {
        showSnackbar('downloadProductsError', 'error');
        return;
      }
      const blob = await buildWorkbookBlob(
        data.products,
        data.variants,
        data.rate,
        data.categorySlugs,
        data.brands,
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `products-${dayMonthYearFromDate(new Date())}.xlsx`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      showSnackbar('downloadProductsError', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // allow re-selecting the same file later
    event.target.value = '';
    if (file == null) return;

    setLoading(true);
    setResult(undefined);
    try {
      let body;
      try {
        body = await parseWorkbook(file);
      } catch (error) {
        console.error(error);
        showSnackbar('invalidWorkbook', 'error');
        return;
      }
      const { success, data } = await fetchWithCreds<BulkImportResult>({
        accessToken,
        path: '/api/product/bulk',
        method: 'POST',
        body,
      });
      if (!success || data == null) {
        showSnackbar('uploadProductsError', 'error');
        return;
      }
      setResult(data);
      showSnackbar(
        data.errors.length > 0 ? 'bulkEditErrors' : 'success',
        data.errors.length > 0 ? 'error' : 'success',
      );
    } catch (error) {
      console.error(error);
      showSnackbar('uploadProductsError', 'error');
    } finally {
      setLoading(false);
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
          }}
          className="flex flex-col gap-4 w-full h-full pb-8"
        >
          <Typography fontWeight={600} fontSize={isMdUp ? 20 : 18}>
            {t('bulkEditProducts')}
          </Typography>
          <Typography fontSize={isMdUp ? 16 : 14}>
            {t('bulkEditDescription')}
          </Typography>
          <Box className="flex flex-row gap-2">
            <Button
              variant="contained"
              disabled={loading}
              startIcon={<DownloadIcon />}
              sx={{
                textTransform: 'none',
                fontSize: isMdUp ? 18 : 16,
                height: isMdUp ? 52 : 42,
              }}
              onClick={handleDownload}
            >
              <Typography>{t('downloadProducts')}</Typography>
            </Button>
            <Button
              variant="contained"
              disabled={loading}
              startIcon={<UploadIcon />}
              sx={{
                textTransform: 'none',
                fontSize: isMdUp ? 18 : 16,
                height: isMdUp ? 52 : 42,
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Typography>{t('uploadProducts')}</Typography>
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              hidden
              onChange={handleUpload}
            />
          </Box>

          {result != null && (
            <Box className="flex flex-col gap-2">
              <Typography fontWeight={600} fontSize={isMdUp ? 18 : 16}>
                {t('bulkEditUpdated', { count: result.updatedCount })}
              </Typography>
              {result.errors.length > 0 && (
                <>
                  <Typography color="error" fontWeight={600}>
                    {t('bulkEditErrors')}
                  </Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {['sheet', 'row', 'errorMessage'].map((header) => (
                          <TableCell key={header}>
                            <Typography fontWeight={600}>
                              {t(header)}
                            </Typography>
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {result.errors.map((error, index) => (
                        <TableRow key={index}>
                          <TableCell>{error.sheet}</TableCell>
                          <TableCell>{error.row}</TableCell>
                          <TableCell>{error.message}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </Box>
          )}

          <Snackbar
            open={snackbarOpen}
            autoHideDuration={6000}
            onClose={(_, reason) => {
              if (reason === 'clickaway') {
                return;
              }
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
        </Box>
      )}
    </Layout>
  );
}
