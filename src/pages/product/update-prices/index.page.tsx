import BASE_URL from '@/lib/ApiEndpoints';
import Layout from '@/pages/components/Layout';
import { appBarHeight, mobileAppBarHeight } from '@/pages/lib/constants';
import { SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { VisuallyHiddenInput } from '@/pages/lib/utils';
import {
  handleFileUpload,
  processPrices,
  TableData,
} from '@/pages/product/utils';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
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
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Prices } from '@prisma/client';
import { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';

import DeleteDialog from '@/pages/components/DeleteDialog';
import AddPrice from '@/pages/product/components/AddPrice';
import DeleteIcon from '@mui/icons-material/Delete';
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
  const [updatedPrices, setUpdatedPrices] = useState<
    { [key: number]: Partial<Prices> }[]
  >([]);
  const [hoveredPrice, setHoveredPrice] = useState<number>();
  const [showDleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedPrice, setSelectedPrice] = useState<string>();
  const [showCreatePriceDialog, setShowCreatePriceDialog] = useState(false);

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
    setTableData(processPrices(prices));
  }, [prices]);

  useEffect(() => {
    console.info(updatedPrices);
  }, [updatedPrices]);

  return (
    <Layout handleHeaderBackButton={() => router.push('/')}>
      <Box
        sx={{
          mt: isMdUp
            ? `${appBarHeight * 1.25}px`
            : `${mobileAppBarHeight * 1.25}px`,
          px: isMdUp ? 4 : 1,
        }}
        className="flex flex-col col-2 w-full h-full"
      >
        <Box className="flex flex-row justify-between w-full">
          {/* left side buttons */}
          <Box>
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
          </Box>

          {/* right side buttons */}
          <Box className="flex flex-row gap-2">
            <Button
              variant="contained"
              sx={{
                textTransform: 'none',
                fontSize: isMdUp ? 18 : 16,
                height: isMdUp ? 48 : 36,
                width: '100%',
              }}
              onClick={() => setShowCreatePriceDialog(true)}
            >
              <Typography>{t('addPrice')}</Typography>
            </Button>
            {Object.keys(updatedPrices).length > 0 && (
              <Button
                variant="contained"
                sx={{
                  textTransform: 'none',
                  fontSize: isMdUp ? 18 : 16,
                  height: isMdUp ? 48 : 36,
                  width: '100%',
                }}
                onClick={async () => {
                  try {
                    const data = await (
                      await fetch(`${BASE_URL}/api/prices`, {
                        method: 'PUT',
                        body: JSON.stringify({
                          pricePairs: Object.keys(updatedPrices).map(
                            (key) => updatedPrices[parseInt(key, 10)],
                          ),
                        }),
                      })
                    ).json();

                    if (data.success) {
                      setSnackbarOpen(true);
                      setSnackbarMessage({
                        message: 'pricesUpdated',
                        severity: 'success',
                      });
                    } else {
                      setSnackbarOpen(true);
                      setSnackbarMessage({
                        message: 'updatePricesError',
                        severity: 'error',
                      });
                    }
                  } catch (error) {
                    console.error(error);
                    setSnackbarOpen(true);
                    setSnackbarMessage({
                      message: 'updatePricesError',
                      severity: 'error',
                    });
                  }
                }}
              >
                <Typography>{t('save')}</Typography>
              </Button>
            )}
          </Box>
        </Box>
        {tableData.length > 0 && (
          <Table>
            <TableHead>
              <TableRow>
                {tableData[0].map((header, index) => (
                  <TableCell key={index}>
                    <Typography fontWeight={600} fontSize={isMdUp ? 18 : 16}>
                      {header}
                    </Typography>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {tableData.slice(1).map((row, rowIndex) => (
                <TableRow
                  key={rowIndex}
                  onMouseOver={() => {
                    setHoveredPrice(rowIndex);
                  }}
                  onMouseOut={() => {
                    setHoveredPrice(undefined);
                  }}
                >
                  {row.map((cell, cellIndex) => (
                    <TableCell
                      className="relative"
                      contentEditable={cellIndex === 1}
                      suppressContentEditableWarning
                      key={cellIndex}
                      onInput={(e) => {
                        const value = e.currentTarget.textContent;
                        if (value === cell) {
                          const tempUpdatedPrices = { ...updatedPrices };
                          delete tempUpdatedPrices[rowIndex];
                          setUpdatedPrices(tempUpdatedPrices);
                          return;
                        }
                        if (
                          value == null ||
                          value === '' ||
                          Number.isNaN(parseFloat(value))
                        ) {
                          setSnackbarOpen(true);
                          setSnackbarMessage({
                            message: 'invalidPrice',
                            severity: 'error',
                          });
                        }
                        setUpdatedPrices((prevPrices) => ({
                          ...prevPrices,
                          [rowIndex]: {
                            ...prevPrices[rowIndex],
                            price: parseFloat(value as string).toString(),
                            name: row[0] as string,
                          },
                        }));
                      }}
                    >
                      {cellIndex === 0 && hoveredPrice === rowIndex && (
                        <IconButton
                          className="absolute -left-4 top-1"
                          onClick={() => {
                            setSelectedPrice(cell as string);
                            setShowDeleteDialog(true);
                          }}
                        >
                          <DeleteIcon color="error" />
                        </IconButton>
                      )}
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

        {showDleteDialog && (
          <DeleteDialog
            title={t('deletePrice')}
            description={t('confirmDeletePrice')}
            handleClose={async () => {
              setShowDeleteDialog(false);
            }}
            handleDelete={async () => {
              if (selectedPrice == null) return;
              try {
                await fetch(
                  `${BASE_URL}/api/prices?productName=${selectedPrice}`,
                  {
                    method: 'DELETE',
                  },
                );
                setTableData((prevData) => {
                  const newData = prevData.filter(
                    (row) => row[0] !== selectedPrice,
                  );
                  return newData;
                });
                setSnackbarOpen(true);
                setSnackbarMessage({
                  message: 'priceDeleteSuccess',
                  severity: 'success',
                });
              } catch (error) {
                console.error(error);
                setSnackbarOpen(true);
                setSnackbarMessage({
                  message: 'priceDeleteFailed',
                  severity: 'error',
                });
              }
            }}
          />
        )}

        {showCreatePriceDialog && (
          <AddPrice
            handleClose={() => setShowCreatePriceDialog(false)}
            handleCreate={async () => {
              // handleCreate
            }}
          />
        )}
      </Box>
    </Layout>
  );
}
