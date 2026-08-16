import Layout from '@/pages/components/Layout';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { appBarHeight, mobileAppBarHeight } from '@/pages/lib/constants';
import { SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import {
  applyPendingEdits,
  collectCategorySubtreeIds,
  debounce,
  filterPricesByCategories,
  filterPricesWithoutCategory,
  filterPricesWithoutProduct,
  NO_CATEGORY_FILTER,
  NO_PRODUCT_FILTER,
  parsePrice,
  PRICE_CATEGORY_IDX,
  PRICE_DOLLAR_IDX,
  PRICE_ID_IDX,
  PRICE_MANAT_IDX,
  PRICE_NAME_IDX,
  PriceSortKey,
  processPrices,
  sortPrices,
  TableData,
  tmtFromUsd,
} from '@/pages/product/utils';
import {
  Alert,
  Box,
  Button,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
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
import { useFetchWithCreds } from '@/pages/lib/fetch';
import AddPrice from '@/pages/product/components/AddPrice';
import {
  categoryMenuItems,
  flattenCategories,
} from '@/pages/product/components/categoryOptions';
import PriceCategoryCell from '@/pages/product/components/PriceCategoryCell';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
  // Pending edits keyed by price id. Row-index keying corrupts across
  // sort/filter/search re-ordering, so we key by the stable price id instead.
  const [updatedPrices, setUpdatedPrices] = useState<
    Record<string, Partial<Prices>>
  >({});
  // Mirror of updatedPrices read by the derive effect to overlay pending edits
  // without adding updatedPrices to its deps (which would re-sort mid-typing).
  const updatedPricesRef = useRef<Record<string, Partial<Prices>>>({});
  const [hoveredPrice, setHoveredPrice] = useState<number>();
  const [showDleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedPrice, setSelectedPrice] = useState<string>();
  const [showCreatePriceDialog, setShowCreatePriceDialog] = useState(false);
  const [dollarRate, setDollarRate] = useState(0);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<SnackbarProps>();
  const [searchKeyword, setSearchKeyword] = useState('');
  // Raw master list of all fetched prices (retains updatedAt for sorting).
  // The rendered `tableData` is derived from this via sort/filter below, so the
  // existing edit-by-row-index logic on `tableData` stays untouched.
  const [allPrices, setAllPrices] = useState<Prices[]>([]);
  const [priceCategoryMap, setPriceCategoryMap] = useState<
    Record<string, string[]>
  >({});
  const [sortKey, setSortKey] = useState<PriceSortKey>('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const { user, accessToken } = useUserContext();
  const { categories } = useCategoryContext();
  const fetchWithCreds = useFetchWithCreds();

  // Flattened category tree (id + localized name + depth), shared by the filter,
  // the per-row pickers, and the AddPrice dialog.
  const flattenedCats = useMemo(
    () => flattenCategories(categories, router.locale ?? 'tk'),
    [categories, router.locale],
  );

  // Derive the rendered table from the master list + active sort/filter, then
  // overlay any typed-but-unsaved edits (keyed by price id) so re-sorting,
  // filtering, or searching preserves pending edits instead of dropping them.
  useEffect(() => {
    const isSentinel =
      categoryFilter === NO_PRODUCT_FILTER ||
      categoryFilter === NO_CATEGORY_FILTER;
    const subtreeIds =
      categoryFilter && !isSentinel
        ? collectCategorySubtreeIds(categories, categoryFilter)
        : new Set<string>();
    let filtered: Prices[];
    if (categoryFilter === NO_PRODUCT_FILTER) {
      filtered = filterPricesWithoutProduct(allPrices, priceCategoryMap);
    } else if (categoryFilter === NO_CATEGORY_FILTER) {
      filtered = filterPricesWithoutCategory(allPrices);
    } else {
      filtered = filterPricesByCategories(allPrices, subtreeIds);
    }
    setTableData(
      applyPendingEdits(
        processPrices(sortPrices(filtered, sortKey)),
        updatedPricesRef.current,
      ),
    );
  }, [allPrices, priceCategoryMap, sortKey, categoryFilter, categories]);

  useEffect(() => {
    if (accessToken) {
      (async () => {
        const pricesResponse = await fetchWithCreds<Prices[]>({
          accessToken,
          path: '/api/prices',
          method: 'GET',
        });

        if (pricesResponse.success && pricesResponse.data != null) {
          setAllPrices(pricesResponse.data);
        } else {
          console.error(pricesResponse.message);
          setSnackbarMessage({
            message: 'fetchPricesError',
            severity: 'error',
          });
        }

        const mapResponse = await fetchWithCreds<Record<string, string[]>>({
          accessToken,
          path: '/api/prices/categories',
          method: 'GET',
        });
        if (mapResponse.success && mapResponse.data != null) {
          setPriceCategoryMap(mapResponse.data);
        }

        const dollarRateResponse = await fetchWithCreds<DollarRate>({
          accessToken,
          path: `/api/prices/rate?currency=TMT`,
          method: 'GET',
        });
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

        if (
          (cellIndex === PRICE_DOLLAR_IDX || cellIndex === PRICE_MANAT_IDX) &&
          !(dollarRate > 0)
        ) {
          setSnackbarOpen(true);
          setSnackbarMessage({
            message: 'dollarRateNotLoaded',
            severity: 'error',
          });
          return;
        }

        const priceId = row[PRICE_ID_IDX] as string;
        const currPrice: Partial<Prices> = { id: priceId };

        if (cellIndex === PRICE_MANAT_IDX) {
          currPrice.priceInTmt = value;
          currPrice.price = parsePrice(
            (parseFloat(value) / dollarRate).toString(),
          ).toString();
        } else if (cellIndex === PRICE_DOLLAR_IDX) {
          currPrice.price = value;
          currPrice.priceInTmt = tmtFromUsd(
            parseFloat(value),
            dollarRate,
          ).toString();
        } else if (cellIndex === PRICE_NAME_IDX) {
          currPrice.name = value;
        }

        setUpdatedPrices((prevPrices) => {
          const next = {
            ...prevPrices,
            [priceId]: { ...prevPrices[priceId], ...currPrice },
          };
          updatedPricesRef.current = next;
          return next;
        });

        setTableData((prevData) => {
          const newData = prevData.map((prevRow, index) => {
            if (index === rowIndex + 1) {
              return prevRow.map((cell, idx) => {
                if (cellIndex === PRICE_DOLLAR_IDX && idx === PRICE_MANAT_IDX) {
                  return parsePrice(
                    tmtFromUsd(parseFloat(value), dollarRate).toString(),
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

  // A category pick is a discrete event, so unlike handlePriceUpdate it needs no
  // debounce. It records the edit in the same id-keyed pending map, which makes
  // the Save button appear and rides along in the existing batched PUT.
  const handleCategoryChange = useCallback(
    (priceId: string, categoryId: string | null) => {
      setUpdatedPrices((prevPrices) => {
        const next = {
          ...prevPrices,
          [priceId]: { ...prevPrices[priceId], id: priceId, categoryId },
        };
        updatedPricesRef.current = next;
        return next;
      });

      setTableData((prevData) =>
        prevData.map((row, index) =>
          index > 0 && row[PRICE_ID_IDX] === priceId
            ? row.map((cell, idx) =>
                idx === PRICE_CATEGORY_IDX ? categoryId : cell,
              )
            : row,
        ),
      );
    },
    [],
  );

  const handleSearch = useCallback(
    async (keyword: string) => {
      try {
        const { success, data, message } = await fetchWithCreds<Prices[]>({
          accessToken,
          path: `/api/prices?searchKeyword=${keyword}`,
          method: 'GET',
        });
        if (success) {
          setAllPrices(data ?? []);
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
                      const { success, data } = await fetchWithCreds<{
                        updatedPrices: Prices[];
                      }>({
                        accessToken,
                        path: `/api/prices/rate`,
                        method: 'PUT',
                        body: {
                          rate: dollarRate,
                          currency: 'TMT',
                        },
                      });

                      if (success) {
                        // Write to the master list (not tableData directly) so a
                        // later sort/filter/search re-derive keeps the recalculated
                        // manat values instead of reverting to stale allPrices.
                        setAllPrices(data.updatedPrices);
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
              <Box className="w-full flex flex-row gap-2 items-center">
                <Box className="flex-1">
                  {SearchBar({
                    handleSearch,
                    setSearchKeyword,
                    searchPlaceholder: t('search'),
                    searchKeyword,
                    width: '100%',
                  })}
                </Box>
                <FormControl size="small" sx={{ minWidth: 130 }}>
                  <InputLabel>{t('sortBy')}</InputLabel>
                  <Select
                    label={t('sortBy')}
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as PriceSortKey)}
                  >
                    <MenuItem value="">{t('default')}</MenuItem>
                    <MenuItem value="nameAsc">{t('nameAToZ')}</MenuItem>
                    <MenuItem value="nameDesc">{t('nameZToA')}</MenuItem>
                    <MenuItem value="dollarAsc">
                      {t('dollarsLowToHigh')}
                    </MenuItem>
                    <MenuItem value="dollarDesc">
                      {t('dollarsHighToLow')}
                    </MenuItem>
                    <MenuItem value="manatAsc">{t('manatLowToHigh')}</MenuItem>
                    <MenuItem value="manatDesc">{t('manatHighToLow')}</MenuItem>
                    <MenuItem value="editedRecent">
                      {t('recentlyEdited')}
                    </MenuItem>
                    <MenuItem value="editedStale">
                      {t('longestNotEdited')}
                    </MenuItem>
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 130 }}>
                  <InputLabel>{t('category')}</InputLabel>
                  <Select
                    label={t('category')}
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                  >
                    <MenuItem value="">{t('allCategories')}</MenuItem>
                    <MenuItem value={NO_CATEGORY_FILTER}>
                      {t('noCategory')}
                    </MenuItem>
                    <MenuItem value={NO_PRODUCT_FILTER}>
                      {t('noProduct')}
                    </MenuItem>
                    {categoryMenuItems(flattenedCats)}
                  </Select>
                </FormControl>
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
                        const { success } = await fetchWithCreds<Prices[]>({
                          accessToken,
                          path: `/api/prices`,
                          method: 'PUT',
                          body: {
                            pricePairs: Object.values(updatedPrices),
                          },
                        });

                        if (success) {
                          // Fold saved edits into the master list so re-derives
                          // keep showing them, then clear pending state (hides
                          // the Save button and stops re-saving stale edits).
                          setAllPrices((prev) =>
                            prev.map((p) =>
                              updatedPrices[p.id]
                                ? { ...p, ...updatedPrices[p.id] }
                                : p,
                            ),
                          );
                          setUpdatedPrices({});
                          updatedPricesRef.current = {};
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
          {tableData.length > 1 && (
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
                        contentEditable={
                          cellIndex !== PRICE_ID_IDX &&
                          cellIndex !== PRICE_CATEGORY_IDX
                        }
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
                        {cellIndex === PRICE_CATEGORY_IDX ? (
                          <PriceCategoryCell
                            priceId={row[PRICE_ID_IDX] as string}
                            value={(cell as string | null) ?? null}
                            options={flattenedCats}
                            emptyLabel={t('noCategory')}
                            dirty={
                              'categoryId' in
                              (updatedPrices[row[PRICE_ID_IDX] as string] ?? {})
                            }
                            onChange={handleCategoryChange}
                          />
                        ) : (
                          cell
                        )}
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
                  const { success } = await fetchWithCreds<Prices>({
                    accessToken,
                    path: `/api/prices?id=${selectedPrice}`,
                    method: 'DELETE',
                  });
                  if (success) {
                    setAllPrices((prev) =>
                      prev.filter((p) => p.id !== selectedPrice),
                    );
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
              categoryOptions={flattenedCats}
              handleCreate={async (
                name: string,
                priceInDollars: string,
                priceInManat: string,
                categoryId: string | null,
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
                const exists = allPrices.some((p) => p.name === name);
                if (exists) {
                  setSnackbarOpen(true);
                  setSnackbarMessage({
                    message: 'priceExists',
                    severity: 'error',
                  });
                  return false;
                }
                try {
                  const { success, data } = await fetchWithCreds<Prices>({
                    accessToken,
                    path: `/api/prices`,
                    method: 'POST',
                    body: {
                      name,
                      price: priceInDollars,
                      priceInTmt: priceInManat,
                      categoryId,
                    },
                  });

                  if (success && data != null) {
                    setAllPrices((prev) => [data, ...prev]);
                    // A brand-new price is referenced by no product yet, and may
                    // carry no category either, so an active filter would hide
                    // it. Clear the filter so it stays visible.
                    setCategoryFilter('');
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
