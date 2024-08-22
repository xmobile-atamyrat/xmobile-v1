import BASE_URL from '@/lib/ApiEndpoints';
import Layout from '@/pages/components/Layout';
import { appBarHeight, mobileAppBarHeight } from '@/pages/lib/constants';
import { ResponseApi, SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import {
  debounce,
  parsePrice,
  PRICE_DOLLAR_IDX,
  PRICE_ID_IDX,
  PRICE_MANAT_IDX,
  PRICE_NAME_IDX,
  processPrices,
  TableData,
} from '@/pages/product/utils';
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
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import { useCallback, useEffect, useState } from 'react';

export const getServerSideProps: GetServerSideProps = (async (context) => {
  let prices: Prices[] = [];
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
  prices: Prices[];
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
  const [snackbarOpen, setSnackbarOpen] = useState(errorMessage != null);
  const [snackbarMessage, setSnackbarMessage] = useState<SnackbarProps>();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handlePriceUpdate = useCallback(
    debounce(
      (
        value: string | null,
        cellIndex: number,
        rowIndex: number,
        row: any[],
      ) => {
        if (
          value == null ||
          value === '' ||
          (cellIndex !== PRICE_NAME_IDX && Number.isNaN(parseFloat(value)))
        ) {
          setSnackbarOpen(true);
          setSnackbarMessage({
            message: 'invalidPrice',
            severity: 'error',
          });
          return;
        }

        const currPrice: Partial<Prices> = updatedPrices[rowIndex] || {};
        currPrice.id = row[PRICE_ID_IDX] as string;
        if (cellIndex === PRICE_MANAT_IDX) {
          currPrice.priceInTmt = value;
          currPrice.price = parsePrice(
            (parseFloat(value) / dollarRate).toString(),
          ).toString();
        } else if (cellIndex === PRICE_DOLLAR_IDX) {
          currPrice.price = value;
          currPrice.priceInTmt = parsePrice(
            (parseFloat(value) * dollarRate).toString(),
          ).toString();
        } else if (cellIndex === PRICE_NAME_IDX) {
          currPrice.name = value;
        }

        setUpdatedPrices((prevPrices) => ({
          ...prevPrices,
          [rowIndex]: {
            ...prevPrices[rowIndex],
            ...currPrice,
          },
        }));

        setTableData((prevData) => {
          const newData = prevData.map((prevRow, index) => {
            if (index === rowIndex + 1) {
              return prevRow.map((cell, idx) => {
                if (cellIndex === PRICE_DOLLAR_IDX && idx === PRICE_MANAT_IDX) {
                  return parsePrice(
                    (parseFloat(value) * dollarRate).toString(),
                  );
                }
                if (cellIndex === PRICE_MANAT_IDX && idx === PRICE_DOLLAR_IDX) {
                  return parsePrice(
                    (parseFloat(value) / dollarRate).toString(),
                  );
                }
                return cell;
              });
            }
            return prevRow;
          });
          return newData;
        });
      },
      500,
    ),
    [dollarRate],
  );

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
                  }}
                />
                <Typography fontWeight={600} fontSize={isMdUp ? 18 : 16}>
                  manat
                </Typography>
                <IconButton
                  onClick={async () => {
                    try {
                      const data = await (
                        await fetch(`${BASE_URL}/api/prices/rate`, {
                          method: 'PUT',
                          body: JSON.stringify({ rate: dollarRate }),
                        })
                      ).json();

                      if (data.success && data.data != null) {
                        setTableData(processPrices(data.data as Prices[]));
                        setSnackbarOpen(true);
                        setSnackbarMessage({
                          message: 'rateUpdated',
                          severity: 'success',
                        });
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
              </Box>
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
                        contentEditable={cellIndex !== PRICE_ID_IDX}
                        suppressContentEditableWarning
                        key={cellIndex}
                        onInput={(e) => {
                          handlePriceUpdate(
                            e.currentTarget.textContent,
                            cellIndex,
                            rowIndex,
                            row,
                          );
                        }}
                      >
                        {cellIndex === PRICE_NAME_IDX &&
                          hoveredPrice === rowIndex && (
                            <IconButton
                              className="absolute -left-4 top-1"
                              onClick={() => {
                                setSelectedPrice(row[PRICE_ID_IDX] as string);
                                setShowDeleteDialog(true);
                              }}
                            >
                              <DeleteIcon color="error" />
                            </IconButton>
                          )}
                        {cellIndex === PRICE_ID_IDX &&
                          hoveredPrice === rowIndex && (
                            <IconButton
                              className="absolute -left-4 top-1"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(
                                    cell as string,
                                  );
                                  setSnackbarOpen(true);
                                  setSnackbarMessage({
                                    message: 'copied',
                                    severity: 'success',
                                  });
                                } catch (error) {
                                  console.error(error);
                                  setSnackbarOpen(true);
                                  setSnackbarMessage({
                                    message: 'copyFailed',
                                    severity: 'error',
                                  });
                                }
                              }}
                            >
                              <ContentCopyIcon color="primary" />
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
                  await fetch(`${BASE_URL}/api/prices?id=${selectedPrice}`, {
                    method: 'DELETE',
                  });
                  setTableData((prevData) => {
                    const newData = prevData.filter(
                      (row) => row[PRICE_ID_IDX] !== selectedPrice,
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
              dollarRate={dollarRate}
              handleCreate={async (
                name: string,
                priceInDollars: string,
                priceInManat: string,
              ): Promise<boolean> => {
                if (
                  name === '' ||
                  priceInDollars === '' ||
                  priceInManat === ''
                ) {
                  setSnackbarOpen(true);
                  setSnackbarMessage({
                    message: 'emptyField',
                    severity: 'error',
                  });
                  return false;
                }
                let exists = false;
                tableData.forEach((row) => {
                  if (row[PRICE_NAME_IDX] === name) {
                    exists = true;
                  }
                });
                if (exists) {
                  setSnackbarOpen(true);
                  setSnackbarMessage({
                    message: 'priceExists',
                    severity: 'error',
                  });
                  return false;
                }
                try {
                  const res: ResponseApi<Prices> = await (
                    await fetch(`${BASE_URL}/api/prices`, {
                      method: 'POST',
                      body: JSON.stringify({
                        name,
                        price: priceInDollars,
                        priceInTmt: priceInManat,
                      }),
                    })
                  ).json();
                  if (res.success && res.data != null) {
                    setTableData((prevData) => {
                      const newData = [
                        prevData[0],
                        [name, priceInDollars, priceInManat, res.data!.id],
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
