import Layout from '@/pages/components/Layout';
import { appBarHeight, mobileAppBarHeight } from '@/pages/lib/constants';
import { SnackbarProps } from '@/pages/lib/types';
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
import { DollarRate, Prices } from '@prisma/client';
import { GetServerSideProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';

import { SearchBar } from '@/pages/components/Appbar';
import DeleteDialog from '@/pages/components/DeleteDialog';
import { fetchWithCreds } from '@/pages/lib/fetch';
import AddPrice from '@/pages/product/components/AddPrice';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import { useCallback, useEffect, useState } from 'react';

export const getServerSideProps: GetServerSideProps = async (context) => {
  return {
    props: {
      messages: (await import(`../../../i18n/${context.locale}.json`)).default,
    },
  };
};

export default function UpdatePrices() {
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
  const [dollarRate, setDollarRate] = useState(0);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<SnackbarProps>();
  const [searchKeyword, setSearchKeyword] = useState('');
  const { user, accessToken } = useUserContext();

  useEffect(() => {
    if (accessToken) {
      (async () => {
        const pricesResponse = await fetchWithCreds<Prices[]>(
          accessToken,
          '/api/prices',
          'GET',
        );

        if (pricesResponse.success && pricesResponse.data != null) {
          setTableData(processPrices(pricesResponse.data));
        } else {
          console.error(pricesResponse.message);
          setSnackbarMessage({
            message: 'fetchPricesError',
            severity: 'error',
          });
        }

        const dollarRateResponse = await fetchWithCreds<DollarRate>(
          accessToken,
          '/api/prices/rate',
          'GET',
        );
        if (dollarRateResponse.success && dollarRateResponse.data != null) {
          setDollarRate(dollarRateResponse.data.rate);
        } else {
          console.error(dollarRateResponse.message);
          setSnackbarMessage({
            message: 'fetchDollarRateError',
            severity: 'error',
          });
        }
      })();
    }
  }, [accessToken]);

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
          currPrice.priceInTmt = Math.ceil(
            parseFloat(value) * dollarRate,
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
                    Math.ceil(parseFloat(value) * dollarRate).toString(),
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

  const handleSearch = useCallback(
    async (keyword: string) => {
      try {
        const { success, data, message } = await fetchWithCreds<Prices[]>(
          accessToken,
          `/api/prices?searchKeyword=${keyword}`,
          'GET',
        );
        if (success) {
          setTableData(processPrices(data));
        } else {
          setSnackbarOpen(true);
          setSnackbarMessage({
            message,
            severity: 'error',
          });
        }
      } catch (error) {
        console.error(error);
        setSnackbarOpen(true);
        setSnackbarMessage({
          message: 'fetchPricesError',
          severity: 'error',
        });
      }
    },
    [accessToken],
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
          <Box className={`flex flex-col w-full justify-center gap-4 pl-2`}>
            {/* dollar rate */}
            <Box className={`w-full flex flex-row justify-start items-center`}>
              <Box className="flex flex-row gap-2 items-center justify-center">
                <Typography fontWeight={600} fontSize={isMdUp ? 18 : 16}>
                  $1 =
                </Typography>
                <TextField
                  value={dollarRate}
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
                      const { success, data } = await fetchWithCreds<Prices[]>(
                        accessToken,
                        `/api/prices/rate`,
                        'PUT',
                        {
                          rate: dollarRate,
                        },
                      );

                      if (success) {
                        setTableData(processPrices(data));
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
                  <CheckCircleOutlineIcon color={'success'} />
                </IconButton>
              </Box>
            </Box>

            {/* search, add price, save */}
            <Box className={`flex flex-col gap-2 w-full max-w-[600px]`}>
              <Box className="w-full">
                {SearchBar({
                  handleSearch,
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
                      height: isMdUp ? 52 : 42,
                    }}
                    onClick={async () => {
                      try {
                        const { success } = await fetchWithCreds<Prices[]>(
                          accessToken,
                          `/api/prices`,
                          'PUT',
                          {
                            pricePairs: Object.keys(updatedPrices).map(
                              (key) => updatedPrices[parseInt(key, 10)],
                            ),
                          },
                        );

                        if (success) {
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
              blueButtonText={t('cancel')}
              redButtonText={t('delete')}
              handleClose={async () => {
                setShowDeleteDialog(false);
              }}
              handleDelete={async () => {
                if (selectedPrice == null) return;
                try {
                  const { success } = await fetchWithCreds<Prices>(
                    accessToken,
                    `/api/prices?id=${selectedPrice}`,
                    'DELETE',
                  );
                  if (success) {
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
                  } else {
                    setSnackbarOpen(true);
                    setSnackbarMessage({
                      message: 'priceDeleteFailed',
                      severity: 'error',
                    });
                  }
                } catch (error) {
                  console.error(error);
                  setSnackbarOpen(true);
                  setSnackbarMessage({
                    message: 'priceDeleteFailed',
                    severity: 'error',
                  });
                } finally {
                  setShowDeleteDialog(false);
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
                  const { success, data } = await fetchWithCreds<Prices>(
                    accessToken,
                    `/api/prices`,
                    'POST',
                    {
                      name,
                      price: priceInDollars,
                      priceInTmt: priceInManat,
                    },
                  );

                  if (success) {
                    setTableData((prevData) => {
                      const newData = [
                        prevData[0],
                        [name, priceInDollars, priceInManat, data!.id],
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
