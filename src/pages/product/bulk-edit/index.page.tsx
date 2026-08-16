import type {
  BulkImportBody,
  BulkImportResult,
  BulkPreviewResult,
  BulkPriceCategory,
  BulkProductExportRow,
  BulkVariant,
  VariantChange,
} from '@/pages/api/product/bulk.page';
import { verifyToken } from '@/pages/api/utils/authMiddleware';
import { REFRESH_SECRET } from '@/pages/api/utils/tokenUtils';
import Layout from '@/pages/components/Layout';
import {
  appBarHeight,
  AUTH_REFRESH_COOKIE_NAME,
  mobileAppBarHeight,
} from '@/pages/lib/constants';
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
import { UserRole } from '@prisma/client';
import { GetServerSideProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useRef, useState } from 'react';

function variantChangeText(change: VariantChange): string {
  const label = change.color ? `${change.spec} (${change.color})` : change.spec;
  if (change.kind === 'added')
    return `+ ${label}${change.to ? `: ${change.to}` : ''}`;
  if (change.kind === 'removed')
    return `− ${label}${change.from ? `: ${change.from}` : ''}`;
  return `${label}: ${change.from} → ${change.to}`;
}

// The route itself is SUPERUSER-only — anyone else is redirected home before
// the page is built, matching the 403 /api/product/bulk returns them in both
// directions. Staff who only need prices use /product/price-list instead.
export const getServerSideProps: GetServerSideProps = async (context) => {
  const home = {
    redirect: { destination: `/${context.locale || 'ru'}/`, permanent: false },
  };
  const refreshToken = context.req.cookies[AUTH_REFRESH_COOKIE_NAME];
  if (!refreshToken) return home;
  try {
    const decoded = await verifyToken(refreshToken, REFRESH_SECRET);
    if (decoded.grade !== UserRole.SUPERUSER) return home;
  } catch {
    return home;
  }

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
  const { accessToken } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BulkImportResult>();
  const [preview, setPreview] = useState<BulkPreviewResult>();
  const [pendingBody, setPendingBody] = useState<BulkImportBody>();
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
        priceCategories: BulkPriceCategory[];
      }>({
        accessToken,
        path: '/api/product/bulk',
        method: 'GET',
      });
      if (!success || data == null) {
        showSnackbar('downloadProductsError', 'error');
        return;
      }
      const blob = await buildWorkbookBlob({
        products: data.products,
        variants: data.variants,
        rate: data.rate,
        categorySlugs: data.categorySlugs,
        brands: data.brands,
        priceCategories: data.priceCategories,
      });
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
    setPreview(undefined);
    setPendingBody(undefined);
    try {
      let body: BulkImportBody;
      try {
        body = await parseWorkbook(file);
      } catch (error) {
        console.error(error);
        showSnackbar('invalidWorkbook', 'error');
        return;
      }
      // Dry run first: preview the diff, write nothing yet.
      const { success, data } = await fetchWithCreds<BulkPreviewResult>({
        accessToken,
        path: '/api/product/bulk',
        method: 'POST',
        body: { ...body, dryRun: true },
      });
      if (!success || data == null) {
        showSnackbar('uploadProductsError', 'error');
        return;
      }
      // Any error blocks everything — show them, never offer to apply.
      if (data.errors.length > 0) {
        setPreview(data);
        showSnackbar('bulkEditErrors', 'error');
        return;
      }
      if (
        data.changes.length === 0 &&
        data.newPrices.length === 0 &&
        data.updatedPrices.length === 0
      ) {
        showSnackbar('bulkEditNothingToChange', 'success');
        return;
      }
      // Clean and non-empty: open the confirm dialog.
      setPreview(data);
      setPendingBody(body);
    } catch (error) {
      console.error(error);
      showSnackbar('uploadProductsError', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmApply = async () => {
    if (pendingBody == null) return;
    setLoading(true);
    try {
      const { success, data } = await fetchWithCreds<BulkImportResult>({
        accessToken,
        path: '/api/product/bulk',
        method: 'POST',
        body: { ...pendingBody, dryRun: false },
      });
      if (!success || data == null) {
        showSnackbar('uploadProductsError', 'error');
        return;
      }
      setResult(data);
      // A race (data changed since preview) can still surface errors on apply.
      setPreview(
        data.errors.length > 0
          ? {
              changes: [],
              newPrices: [],
              updatedPrices: [],
              errors: data.errors,
            }
          : undefined,
      );
      showSnackbar(
        data.errors.length > 0 ? 'bulkEditErrors' : 'success',
        data.errors.length > 0 ? 'error' : 'success',
      );
    } catch (error) {
      console.error(error);
      showSnackbar('uploadProductsError', 'error');
    } finally {
      setPendingBody(undefined);
      setLoading(false);
    }
  };

  return (
    <Layout handleHeaderBackButton={() => router.push('/')}>
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

        {result != null && result.errors.length === 0 && (
          <Box className="flex flex-col">
            <Typography fontWeight={600} fontSize={isMdUp ? 18 : 16}>
              {t('bulkEditUpdated', { count: result.updatedCount })}
            </Typography>
            {result.createdPriceCount > 0 && (
              <Typography fontWeight={600} fontSize={isMdUp ? 18 : 16}>
                {t('bulkEditPricesCreated', {
                  count: result.createdPriceCount,
                })}
              </Typography>
            )}
            {result.updatedPriceCount > 0 && (
              <Typography fontWeight={600} fontSize={isMdUp ? 18 : 16}>
                {t('bulkEditPricesUpdated', {
                  count: result.updatedPriceCount,
                })}
              </Typography>
            )}
          </Box>
        )}

        {preview != null && preview.errors.length > 0 && (
          <Box className="flex flex-col gap-2">
            <Typography color="error" fontWeight={600}>
              {t('bulkEditFixErrors')}
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {['sheet', 'row', 'errorMessage'].map((header) => (
                    <TableCell key={header}>
                      <Typography fontWeight={600}>{t(header)}</Typography>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {preview.errors.map((error, index) => (
                  <TableRow key={index}>
                    <TableCell>{error.sheet}</TableCell>
                    <TableCell>{error.row}</TableCell>
                    <TableCell>{error.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}

        {pendingBody != null && preview != null && (
          <Box className="flex flex-col gap-3">
            <Box className="flex flex-row items-center gap-2 flex-wrap">
              <Typography fontWeight={600} fontSize={isMdUp ? 18 : 16}>
                {t('bulkEditConfirmTitle', {
                  count:
                    preview.changes.length +
                    preview.newPrices.length +
                    preview.updatedPrices.length,
                })}
              </Typography>
              <Box className="flex flex-row gap-2 ml-auto">
                <Button
                  onClick={() => setPendingBody(undefined)}
                  disabled={loading}
                  sx={{ textTransform: 'none' }}
                >
                  {t('cancel')}
                </Button>
                <Button
                  variant="contained"
                  onClick={handleConfirmApply}
                  disabled={loading}
                  sx={{ textTransform: 'none' }}
                >
                  {t('bulkEditApplyAll')}
                </Button>
              </Box>
            </Box>
            <Typography>{t('bulkEditReviewNote')}</Typography>
            {preview.changes.map((change) => (
              <Box
                key={change.id}
                className="flex flex-col"
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  p: 2,
                }}
              >
                <Typography fontWeight={600}>{change.name}</Typography>
                {change.fields.map((field) => (
                  <Typography key={field.label} fontSize={14}>
                    {field.label}: {field.from} → {field.to}
                  </Typography>
                ))}
                {change.variants.map((variant, index) => (
                  <Typography key={index} fontSize={14}>
                    {variantChangeText(variant)}
                  </Typography>
                ))}
              </Box>
            ))}
            {preview.updatedPrices.length > 0 && (
              <Box
                className="flex flex-col"
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  p: 2,
                }}
              >
                <Typography fontWeight={600}>
                  {t('bulkEditUpdatedPrices')}
                </Typography>
                {preview.updatedPrices.map((price) => (
                  <Box key={price.id} className="flex flex-col">
                    <Typography fontSize={14} fontWeight={600}>
                      {price.label}
                    </Typography>
                    {price.changes.map((field) => (
                      <Typography key={field.label} fontSize={14}>
                        {field.label}: {field.from} → {field.to}
                      </Typography>
                    ))}
                  </Box>
                ))}
              </Box>
            )}
            {preview.newPrices.length > 0 && (
              <Box
                className="flex flex-col"
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  p: 2,
                }}
              >
                <Typography fontWeight={600}>
                  {t('bulkEditNewPrices')}
                </Typography>
                {preview.newPrices.map((price, index) => (
                  <Typography key={index} fontSize={14}>
                    + {price.name}: {price.usd} / {price.tmt}
                  </Typography>
                ))}
              </Box>
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
    </Layout>
  );
}
