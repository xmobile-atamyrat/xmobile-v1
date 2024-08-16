import BASE_URL from '@/lib/ApiEndpoints';
import Layout from '@/pages/components/Layout';
import { appBarHeight, mobileAppBarHeight } from '@/pages/lib/constants';
import { SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { parsePrice, processPrices, TableData } from '@/pages/product/utils';
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
import { Prices } from '@prisma/client';
import { GetServerSideProps, InferGetServerSidePropsType } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';

import DeleteDialog from '@/pages/components/DeleteDialog';
import AddPrice from '@/pages/product/components/AddPrice';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DeleteIcon from '@mui/icons-material/Delete';
import { useEffect, useState } from 'react';

export const getServerSideProps: GetServerSideProps = (async (context) => {
  let prices: Partial<Prices>[] = [];
  let errorMessage: string | null = null;
  let dollarRate: number = 0;

  try {
    const pricesResponse = await (await fetch(`${BASE_URL}/api/prices`)).json();

    if (pricesResponse.success && pricesResponse.data != null) {
      prices = pricesResponse.data;
    } else {
      console.error(pricesResponse.message);
      errorMessage = 'fetchPricesError';
    }

    const dollarRateResponse = await (
      await fetch(`${BASE_URL}/api/prices/rate`)
    ).json();
    if (dollarRateResponse.success && dollarRateResponse.data != null) {
      dollarRate = dollarRateResponse.data.rate;
    }
  } catch (error) {
    console.error(error);
    errorMessage = 'fetchPricesError';
  }

  return {
    props: {
      prices,
      dollarRate,
      errorMessage,
      messages: (await import(`../../../i18n/${context.locale}.json`)).default,
    },
  };
}) satisfies GetServerSideProps<{
  prices: Partial<Prices>[];
  dollarRate: number;
  errorMessage: string | null;
}>;

export default function UpdatePrices({
  prices,
  dollarRate: initialDollarRate,
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
  const [dollarRate, setDollarRate] = useState(initialDollarRate);
  const [showDollarRateSaveButton, setShowDollarRateSaveButton] = useState(
    initialDollarRate !== dollarRate,
  );

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
    setTableData(processPrices(prices, dollarRate));
  }, [prices, dollarRate]);

  return (
    <Layout handleHeaderBackButton={() => router.push('/')}>
      {user?.grade === 'ADMIN' && (
        <Box
          sx={{
            mt: isMdUp
              ? `${appBarHeight * 1.25}px`
              : `${mobileAppBarHeight * 1.25}px`,
            px: isMdUp ? 4 : 1,
          }}
          className="flex flex-col gap-8 w-full h-full"
        >
          <Box className={`flex flex-col w-full justify-center gap-4 pl-2`}>
            {/* left side buttons */}
            <Box className={`w-full flex flex-row justify-start items-center`}>
              <Box className="flex flex-row gap-2 items-center justify-center">
                <Typography fontWeight={600} fontSize={isMdUp ? 18 : 16}>
                  $1 =
                </Typography>
                <TextField
                  defaultValue={dollarRate}
                  type="number"
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    if (Number.isNaN(value)) return;
                    setDollarRate(value);
                    setShowDollarRateSaveButton(initialDollarRate !== value);
                  }}
                />
                <Typography fontWeight={600} fontSize={isMdUp ? 18 : 16}>
                  manat
                </Typography>
                {showDollarRateSaveButton && (
                  <IconButton
                    onClick={async () => {
                      try {
                        const data = await (
                          await fetch(`${BASE_URL}/api/prices/rate`, {
                            method: 'PUT',
                            body: JSON.stringify({ rate: dollarRate }),
                          })
                        ).json();

                        if (data.success) {
                          setSnackbarOpen(true);
                          setSnackbarMessage({
                            message: 'rateUpdated',
                            severity: 'success',
                          });
                          setShowDollarRateSaveButton(false);
                        } else {
                          setSnackbarOpen(true);
                          setSnackbarMessage({
                            message: 'updateRateError',
                            severity: 'error',
                          });
                        }
                      } catch (error) {
                        console.error(error);
                        setSnackbarOpen(true);
                        setSnackbarMessage({
                          message: 'updateRateError',
                          severity: 'error',
                        });
                      }
                    }}
                  >
                    <CheckCircleOutlineIcon color="success" />
                  </IconButton>
                )}
              </Box>
              {/* hidden price list upload button */}
              {/* <Box>
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
              </Box> */}
            </Box>

            {/* right side buttons */}
            <Box className={`flex flex-row gap-2 w-full justify-end`}>
              <Button
                variant="contained"
                sx={{
                  textTransform: 'none',
                  fontSize: isMdUp ? 18 : 16,
                  height: isMdUp ? 48 : 36,
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
                            return;
                          }
                          if (value === cell) {
                            const tempUpdatedPrices = { ...updatedPrices };
                            delete tempUpdatedPrices[rowIndex];
                            setUpdatedPrices(tempUpdatedPrices);
                            return;
                          }
                          setUpdatedPrices((prevPrices) => ({
                            ...prevPrices,
                            [rowIndex]: {
                              ...prevPrices[rowIndex],
                              price: parseFloat(value as string).toString(),
                              name: row[0] as string,
                            },
                          }));

                          setTableData((prevData) => {
                            const newData = prevData.map((r, i) =>
                              i === rowIndex + 1
                                ? [
                                    r[0],
                                    value,
                                    parsePrice({
                                      price: value!,
                                      rate: dollarRate,
                                    }),
                                  ]
                                : r,
                            );
                            return newData;
                          });
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
              handleCreate={async (
                name: string,
                price: string,
              ): Promise<boolean> => {
                if (name === '') {
                  setSnackbarOpen(true);
                  setSnackbarMessage({
                    message: 'emptyField',
                    severity: 'error',
                  });
                  return false;
                }
                try {
                  const res = await (
                    await fetch(`${BASE_URL}/api/prices`, {
                      method: 'POST',
                      body: JSON.stringify({ pricePairs: [{ name, price }] }),
                    })
                  ).json();
                  if (res.success) {
                    setTableData((prevData) => {
                      const newData = [
                        prevData[0],
                        [name, price, parsePrice({ price, rate: dollarRate })],
                        ...prevData.slice(1),
                      ];
                      return newData;
                    });
                    setSnackbarOpen(true);
                    setSnackbarMessage({
                      message: 'priceCreateSuccess',
                      severity: 'success',
                    });
                    return true;
                  }
                  setSnackbarOpen(true);
                  setSnackbarMessage({
                    message: 'priceCreateFailed',
                    severity: 'error',
                  });
                  return false;
                } catch (error) {
                  console.error(error);
                  setSnackbarOpen(true);
                  setSnackbarMessage({
                    message: 'priceCreateFailed',
                    severity: 'error',
                  });
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
