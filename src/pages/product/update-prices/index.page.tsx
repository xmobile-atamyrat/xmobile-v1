import BASE_URL from '@/lib/ApiEndpoints';
import Layout from '@/pages/components/Layout';
import { appBarHeight, mobileAppBarHeight } from '@/pages/lib/constants';
import { SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { VisuallyHiddenInput } from '@/pages/lib/utils';
import { handleFileUpload, TableData } from '@/pages/product/utils';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
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
import { Prices } from '@prisma/client';
import { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';

import { useEffect, useState } from 'react';

export const getServerSideProps: GetServerSideProps = (async (context) => {
  let prices: Partial<Prices>[] = [];
  let errorMessage: string | null = null;

  try {
    const pricesResponse = await (await fetch(`${BASE_URL}/api/prices`)).json();

    if (pricesResponse.success && pricesResponse.data != null) {
      prices = pricesResponse.data;
    } else {
      console.error(pricesResponse.message);
      errorMessage = 'fetchPricesError';
    }
  } catch (error) {
    console.error(error);
    errorMessage = 'fetchPricesError';
  }

  return {
    props: {
      prices,
      errorMessage,
      messages: (await import(`../../../i18n/${context.locale}.json`)).default,
    },
  };
}) satisfies GetServerSideProps<{
  prices: Partial<Prices>[];
  errorMessage: string | null;
}>;

export default function UpdatePrices({
  prices,
  errorMessage,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const { user } = useUserContext();
  const router = useRouter();
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const t = useTranslations();
  const [tableData, setTableData] = useState<TableData>([]);

  const [snackbarOpen, setSnackbarOpen] = useState(errorMessage != null);
  const [snackbarMessage, setSnackbarMessage] = useState<SnackbarProps>();

  useEffect(() => {
    if (user == null || user.grade !== 'ADMIN') {
      router.push('/');
    }
  }, [router, user]);

  useEffect(() => {
    if (errorMessage != null) {
      setSnackbarMessage({ message: errorMessage, severity: 'error' });
    }
  }, [errorMessage]);

  useEffect(() => {
    if (prices.length === 0) return;
    const processedPrices = prices.map(
      (price: { name: string; price: string }) => [
        price.name,
        price.price,
        parseFloat(price.price) * 20,
      ],
    );
    setTableData([
      ['Towar', 'Dollarda Bahasy', 'Manatda Bahasy'],
      ...processedPrices,
    ]);
  }, [prices]);

  return (
    <Layout handleHeaderBackButton={() => router.push('/')}>
      <Box
        sx={{
          mt: isMdUp
            ? `${appBarHeight * 1.25}px`
            : `${mobileAppBarHeight * 1.25}px`,
          px: isMdUp ? 4 : 0,
        }}
        className="flex flex-col col-2 w-full h-full"
      >
        {/* hidden price list upload button */}
        <Box>
          <Button
            hidden
            component="label"
            role={undefined}
            variant="contained"
            tabIndex={-1}
            startIcon={<CloudUploadIcon />}
            sx={{ textTransform: 'none' }}
            className="my-1 sm:mr-2 w-full sm:w-[250px] text-[16px] h-[56px]"
          >
            {t('updatePrices')}
            <VisuallyHiddenInput
              type="file"
              name="productImage"
              accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              onChange={(e) => handleFileUpload(e, setTableData)}
            />
          </Button>
        </Box>
        {tableData.length > 0 && (
          <Table>
            <TableHead>
              <TableRow>
                {tableData[0].map((header, index) => (
                  <TableCell key={index}>
                    <Typography fontWeight={600}>{header}</Typography>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {tableData.slice(1).map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <TableCell
                      contentEditable={cellIndex === 1}
                      key={cellIndex}
                    >
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
