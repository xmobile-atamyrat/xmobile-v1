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
  filterPricesByRate,
  filterPricesOutOfStock,
  filterPricesWithoutCategory,
  filterPricesWithoutProduct,
  isEditablePriceCell,
  NO_CATEGORY_FILTER,
  NO_PRODUCT_FILTER,
  parsePrice,
  PRICE_CATEGORY_IDX,
  PRICE_DISPLAY_IDX,
  PRICE_DOLLAR_IDX,
  PRICE_ID_IDX,
  PRICE_MANAT_IDX,
  PRICE_NAME_IDX,
  PRICE_OUT_OF_STOCK_IDX,
  PRICE_RATE_IDX,
  PRICE_UPDATED_IDX,
  PriceSortKey,
  processPrices,
  sortPrices,
  TableData,
  tmtFromUsd,
} from '@/pages/product/utils';
import {
  displayTmtFromUsd,
  pricesFromUsd,
  roundToDisplayTmt,
} from '@/pages/lib/priceDisplay';
import { findDefaultRate, rateForPrice } from '@/lib/dollarRates';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
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
import SelectCell from '@/pages/product/components/SelectCell';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DeleteIcon from '@mui/icons-material/Delete';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export const getServerSideProps: GetServerSideProps = async (context) => {
  return {
    props: {
      messages: (await import(`../../../i18n/${context.locale}.json`)).default,
    },
  };
};

// Sentinel for the filter dropdown's "create a rate" row. Real values are
// stringified ids, so this cannot collide with one.
const ADD_RATE_OPTION = '__add_rate__';

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
  const [rates, setRates] = useState<DollarRate[]>([]);
  // '' is "all rates"; otherwise the stringified id of the rate being filtered
  // to, which is also the rate the editor above the table edits.
  const [rateFilter, setRateFilter] = useState('');
  const [rateDraft, setRateDraft] = useState('');
  const [showRateConfirm, setShowRateConfirm] = useState(false);
  const [showAddRateDialog, setShowAddRateDialog] = useState(false);
  const [showDeleteRateDialog, setShowDeleteRateDialog] = useState(false);
  const [newRateName, setNewRateName] = useState('');
  const [newRateValue, setNewRateValue] = useState('');
  const [bulkRateId, setBulkRateId] = useState('');
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<SnackbarProps>();
  const [searchKeyword, setSearchKeyword] = useState('');
  // Raw master list of all fetched prices (retains updatedAt for sorting).
  // The rendered `tableData` is derived from this via sort/filter below, so the
  // existing edit-by-row-index logic on `tableData` stays untouched.
  const [allPrices, setAllPrices] = useState<Prices[]>([]);
  const [sortKey, setSortKey] = useState<PriceSortKey>('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [outOfStockOnly, setOutOfStockOnly] = useState(false);
  const { user, accessToken } = useUserContext();
  const { categories } = useCategoryContext();
  const fetchWithCreds = useFetchWithCreds();

  // The rate the filter is pinned to, or null for "all rates".
  const selectedRate = useMemo(
    () => rates.find((rate) => String(rate.id) === rateFilter) ?? null,
    [rates, rateFilter],
  );
  // What the editor above the table edits: the filtered rate, or the default
  // when no filter is set, so the control is never pointed at nothing.
  const editingRate = selectedRate ?? findDefaultRate(rates);
  // Options for the per-row picker and the bulk control. The number rides in the
  // label because an admin picking a rate is picking a number, not a word.
  const rateOptions = useMemo(
    () =>
      rates.map((rate) => ({
        id: String(rate.id),
        name: `${rate.name} (${rate.rate})`,
      })),
    [rates],
  );
  // How many prices the editor is about to rewrite, shown in its confirmation.
  // The default rate rewrites the whole table, not just the rows filed under it.
  const editingRateCount = useMemo(
    () =>
      editingRate?.isDefault
        ? allPrices.length
        : filterPricesByRate(allPrices, editingRate).length,
    [allPrices, editingRate],
  );

  // Flattened category tree (id + localized name + depth), shared by the filter,
  // the per-row pickers, and the AddPrice dialog.
  const flattenedCats = useMemo(
    () => flattenCategories(categories, router.locale ?? 'tk'),
    [categories, router.locale],
  );

  useEffect(() => {
    setRateDraft(editingRate == null ? '' : String(editingRate.rate));
  }, [editingRate?.id, editingRate?.rate]);

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
      filtered = filterPricesWithoutProduct(allPrices);
    } else if (categoryFilter === NO_CATEGORY_FILTER) {
      filtered = filterPricesWithoutCategory(allPrices);
    } else {
      filtered = filterPricesByCategories(allPrices, subtreeIds);
    }
    // Stacks on whichever filter ran above rather than replacing it, so
    // "out of stock" narrows the current category instead of leaving it.
    if (outOfStockOnly) filtered = filterPricesOutOfStock(filtered);
    // Stacks last, so "prices on this rate" always narrows whatever is already
    // on screen rather than replacing it.
    filtered = filterPricesByRate(filtered, selectedRate);
    setTableData(
      applyPendingEdits(
        processPrices(sortPrices(filtered, sortKey)),
        updatedPricesRef.current,
      ),
    );
  }, [
    allPrices,
    sortKey,
    categoryFilter,
    categories,
    outOfStockOnly,
    selectedRate,
  ]);

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

        const dollarRateResponse = await fetchWithCreds<DollarRate[]>({
          accessToken,
          path: `/api/prices/rate`,
          method: 'GET',
        });
        if (dollarRateResponse.success && dollarRateResponse.data != null) {
          // The other currencies in the table belong to procurement and are
          // never offered as a price rate.
          setRates(
            dollarRateResponse.data.filter(
              (rate) => String(rate.currency) === 'TMT',
            ),
          );
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

        // Each row converts at its own rate, so a price filed under "Bazar"
        // shows Bazar manat the moment it is typed rather than the default's.
        const rowRate =
          rateForPrice(
            { dollarRateId: (row[PRICE_RATE_IDX] as number | null) ?? null },
            rates,
          )?.rate ?? 0;

        if (
          (cellIndex === PRICE_DOLLAR_IDX || cellIndex === PRICE_MANAT_IDX) &&
          !(rowRate > 0)
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
          // An admin who wants a different shown price types it into the
          // Display column instead.
          currPrice.priceInTmt = value;
          currPrice.displayPriceTmt = roundToDisplayTmt(
            parseFloat(value),
          ).toString();
          currPrice.price = parsePrice(
            (parseFloat(value) / rowRate).toString(),
          ).toString();
        } else if (cellIndex === PRICE_DOLLAR_IDX) {
          currPrice.price = value;
          Object.assign(currPrice, pricesFromUsd(parseFloat(value), rowRate));
        } else if (cellIndex === PRICE_DISPLAY_IDX) {
          // Only this field: pinning what is shown must not disturb the dollar
          // price the business actually prices in.
          currPrice.displayPriceTmt = value;
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
                    tmtFromUsd(parseFloat(value), rowRate).toString(),
                  );
                }
                if (cellIndex === PRICE_MANAT_IDX && idx === PRICE_DOLLAR_IDX) {
                  return parsePrice((parseFloat(value) / rowRate).toString());
                }
                if (
                  cellIndex === PRICE_DOLLAR_IDX &&
                  idx === PRICE_DISPLAY_IDX
                ) {
                  return displayTmtFromUsd(parseFloat(value), rowRate);
                }
                if (
                  cellIndex === PRICE_MANAT_IDX &&
                  idx === PRICE_DISPLAY_IDX
                ) {
                  return roundToDisplayTmt(parseFloat(value));
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
    [rates],
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

  // Same discrete-event shape as a category pick. The manat figures are not
  // recomputed here: the server re-derives them from the row's dollars when the
  // batched PUT lands, which keeps one rule for the conversion.
  const handleRateChange = useCallback(
    (priceId: string, rateId: string | null) => {
      const dollarRateId = rateId == null ? null : Number(rateId);
      setUpdatedPrices((prevPrices) => {
        const next = {
          ...prevPrices,
          [priceId]: { ...prevPrices[priceId], id: priceId, dollarRateId },
        };
        updatedPricesRef.current = next;
        return next;
      });

      setTableData((prevData) =>
        prevData.map((row, index) =>
          index > 0 && row[PRICE_ID_IDX] === priceId
            ? row.map((cell, idx) =>
                idx === PRICE_RATE_IDX ? dollarRateId : cell,
              )
            : row,
        ),
      );
    },
    [],
  );

  // Same discrete-event shape again. Nothing cascades client-side: the owning
  // product's own flag is re-derived by the server when the batched PUT lands,
  // so the product column here can lag until the next load.
  const handleOutOfStockChange = useCallback(
    (priceId: string, isOutOfStock: boolean) => {
      setUpdatedPrices((prevPrices) => {
        const next = {
          ...prevPrices,
          [priceId]: { ...prevPrices[priceId], id: priceId, isOutOfStock },
        };
        updatedPricesRef.current = next;
        return next;
      });

      setTableData((prevData) =>
        prevData.map((row, index) =>
          index > 0 && row[PRICE_ID_IDX] === priceId
            ? row.map((cell, idx) =>
                idx === PRICE_OUT_OF_STOCK_IDX ? isOutOfStock : cell,
              )
            : row,
        ),
      );
    },
    [],
  );

  // Server-side repricing rewrites manat figures under the table, so the page
  // re-reads rather than patching rows, and drops pending edits: saving those
  // afterwards would push pre-recalculation numbers back over fresh ones.
  const refreshAfterReprice = useCallback(async () => {
    setUpdatedPrices({});
    updatedPricesRef.current = {};
    const [pricesResponse, ratesResponse] = await Promise.all([
      fetchWithCreds<Prices[]>({
        accessToken,
        path: '/api/prices',
        method: 'GET',
      }),
      fetchWithCreds<DollarRate[]>({
        accessToken,
        path: '/api/prices/rate',
        method: 'GET',
      }),
    ]);
    if (pricesResponse.success && pricesResponse.data != null) {
      setAllPrices(pricesResponse.data);
    }
    if (ratesResponse.success && ratesResponse.data != null) {
      setRates(
        ratesResponse.data.filter((rate) => String(rate.currency) === 'TMT'),
      );
    }
  }, [accessToken]);

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
            {/* the rate being edited: the filtered one, or the default */}
            <Box className={`w-full flex flex-row justify-start items-center`}>
              <Box className="flex flex-row gap-2 items-center justify-center flex-wrap">
                <Typography fontWeight={600} fontSize={isMdUp ? 18 : 16}>
                  {editingRate?.name ?? t('defaultRate')}: $1 =
                </Typography>
                <TextField
                  value={rateDraft}
                  type="number"
                  disabled={editingRate == null}
                  onChange={(e) => setRateDraft(e.target.value)}
                />
                <Typography fontWeight={600} fontSize={isMdUp ? 18 : 16}>
                  manat
                </Typography>
                <IconButton
                  disabled={editingRate == null || !(parseFloat(rateDraft) > 0)}
                  onClick={() => setShowRateConfirm(true)}
                >
                  <CheckCircleOutlineIcon color={'success'} />
                </IconButton>
                {/* The default rate has no delete: every other rate falls back
                    to it, and the server refuses to remove it. */}
                {editingRate != null && !editingRate.isDefault && (
                  <IconButton onClick={() => setShowDeleteRateDialog(true)}>
                    <DeleteIcon color="error" />
                  </IconButton>
                )}
              </Box>
            </Box>

            {/* search, add price, save */}
            <Box className={`flex flex-col gap-2 w-full max-w-[900px]`}>
              <Box className="w-full flex flex-row flex-wrap gap-2 items-center">
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
                    {/* Not localized, matching this table's hardcoded English
                        column headers. */}
                    <MenuItem value="displayAsc">Display ↑</MenuItem>
                    <MenuItem value="displayDesc">Display ↓</MenuItem>
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
                <FormControl size="small" sx={{ minWidth: 130 }}>
                  <InputLabel>{t('rate')}</InputLabel>
                  <Select
                    label={t('rate')}
                    value={rateFilter}
                    onChange={(e) => {
                      // The create row is a command, not a filter value, so it
                      // opens the dialog and leaves the selection alone.
                      if (e.target.value === ADD_RATE_OPTION) {
                        setNewRateName('');
                        setNewRateValue('');
                        setShowAddRateDialog(true);
                        return;
                      }
                      setRateFilter(e.target.value);
                    }}
                  >
                    <MenuItem value="">{t('allRates')}</MenuItem>
                    {rates.map((rate) => (
                      <MenuItem key={rate.id} value={String(rate.id)}>
                        {rate.name} ({rate.rate})
                      </MenuItem>
                    ))}
                    <MenuItem value={ADD_RATE_OPTION}>
                      + {t('addRate')}
                    </MenuItem>
                  </Select>
                </FormControl>
                <ToggleButton
                  size="small"
                  color="error"
                  value="outOfStockOnly"
                  selected={outOfStockOnly}
                  onChange={() => setOutOfStockOnly((prev) => !prev)}
                  // Russian and Turkmen render this label long enough to stack
                  // into three lines, which leaves the control taller than the
                  // dropdowns beside it. It wraps the row instead.
                  sx={{ whiteSpace: 'nowrap', lineHeight: 1.2 }}
                >
                  {t('outOfStockOnly')}
                </ToggleButton>
              </Box>
              <Box className="flex flex-row flex-wrap gap-2 w-full items-center">
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
                {/* Acts on exactly what the filters left on screen, never the
                    whole table, and says how many that is. */}
                {tableData.length > 1 && rates.length > 0 && (
                  <>
                    <FormControl size="small" sx={{ minWidth: 150 }}>
                      <InputLabel>{t('assignToRate')}</InputLabel>
                      <Select
                        label={t('assignToRate')}
                        value={bulkRateId}
                        onChange={(e) => setBulkRateId(e.target.value)}
                      >
                        {rates.map((rate) => (
                          <MenuItem key={rate.id} value={String(rate.id)}>
                            {rate.name} ({rate.rate})
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Button
                      variant="outlined"
                      disabled={bulkRateId === ''}
                      sx={{
                        textTransform: 'none',
                        fontSize: isMdUp ? 16 : 14,
                        height: isMdUp ? 52 : 42,
                      }}
                      onClick={() => setShowBulkConfirm(true)}
                    >
                      <Typography>
                        {t('assignToRate')} ({tableData.length - 1})
                      </Typography>
                    </Button>
                  </>
                )}
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
                    {/* The id trails every row as the edit key and is not a
                        column, so only the header's worth of cells is drawn. */}
                    {row.slice(0, PRICE_ID_IDX).map((cell, cellIndex) => (
                      <TableCell
                        className="relative"
                        contentEditable={isEditablePriceCell(cellIndex)}
                        suppressContentEditableWarning
                        key={cellIndex}
                        onInput={(e) => {
                          // The out-of-stock checkbox is a real <input>, so its
                          // native input event bubbles into this cell handler.
                          // Letting it through submits an empty value: an
                          // invalidPrice error on every toggle, and a price
                          // typed within the shared debounce window is lost.
                          if (!isEditablePriceCell(cellIndex)) return;
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
                        {(() => {
                          if (cellIndex === PRICE_CATEGORY_IDX) {
                            return (
                              <SelectCell
                                id={row[PRICE_ID_IDX] as string}
                                value={(cell as string | null) ?? null}
                                options={flattenedCats}
                                emptyLabel={t('noCategory')}
                                dirty={
                                  'categoryId' in
                                  (updatedPrices[row[PRICE_ID_IDX] as string] ??
                                    {})
                                }
                                onChange={handleCategoryChange}
                              />
                            );
                          }
                          if (cellIndex === PRICE_RATE_IDX) {
                            const priceId = row[PRICE_ID_IDX] as string;
                            return (
                              <SelectCell
                                id={priceId}
                                value={cell == null ? null : String(cell)}
                                options={rateOptions}
                                emptyLabel={t('defaultRate')}
                                minWidth={120}
                                dirty={
                                  'dollarRateId' in
                                  (updatedPrices[priceId] ?? {})
                                }
                                onChange={handleRateChange}
                              />
                            );
                          }
                          if (cellIndex === PRICE_UPDATED_IDX) {
                            // ISO date, not a locale format: the table spans
                            // five locales and an admin scanning for stale
                            // prices needs one shape they can compare at a
                            // glance.
                            return (
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                {typeof cell === 'string'
                                  ? cell.slice(0, 10)
                                  : ''}
                              </Typography>
                            );
                          }
                          if (cellIndex === PRICE_OUT_OF_STOCK_IDX) {
                            const priceId = row[PRICE_ID_IDX] as string;
                            return (
                              <Checkbox
                                size="small"
                                checked={cell === true}
                                onChange={(e) =>
                                  handleOutOfStockChange(
                                    priceId,
                                    e.target.checked,
                                  )
                                }
                                // Matches the dirty affordance the category and
                                // product cells use: a pending edit is coloured
                                // until the batched save clears it.
                                color={
                                  'isOutOfStock' in
                                  (updatedPrices[priceId] ?? {})
                                    ? 'warning'
                                    : 'primary'
                                }
                              />
                            );
                          }
                          return cell;
                        })()}
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

          {showRateConfirm && editingRate != null && (
            <Dialog open onClose={() => setShowRateConfirm(false)}>
              <DialogTitle>{editingRate.name}</DialogTitle>
              <DialogContent>
                <DialogContentText>
                  {t(
                    editingRate.isDefault
                      ? 'confirmDefaultRateRecalculate'
                      : 'confirmRateRecalculate',
                    { count: editingRateCount },
                  )}
                </DialogContentText>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setShowRateConfirm(false)}>
                  {t('cancel')}
                </Button>
                <Button
                  variant="contained"
                  onClick={async () => {
                    setShowRateConfirm(false);
                    try {
                      const { success } = await fetchWithCreds({
                        accessToken,
                        path: `/api/prices/rate`,
                        method: 'PUT',
                        body: {
                          id: editingRate.id,
                          rate: parseFloat(rateDraft),
                        },
                      });
                      setSnackbarOpen(true);
                      if (success) {
                        await refreshAfterReprice();
                        setSnackbarMessage({
                          message: 'rateUpdated',
                          severity: 'success',
                        });
                      } else {
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
                  {t('save')}
                </Button>
              </DialogActions>
            </Dialog>
          )}

          {showAddRateDialog && (
            <Dialog open onClose={() => setShowAddRateDialog(false)}>
              <DialogTitle>{t('addRate')}</DialogTitle>
              <DialogContent>
                <Box className="flex flex-col gap-3 pt-2">
                  <TextField
                    label={t('rateName')}
                    value={newRateName}
                    onChange={(e) => setNewRateName(e.target.value)}
                  />
                  <TextField
                    label={t('rate')}
                    type="number"
                    value={newRateValue}
                    onChange={(e) => setNewRateValue(e.target.value)}
                  />
                </Box>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setShowAddRateDialog(false)}>
                  {t('cancel')}
                </Button>
                <Button
                  variant="contained"
                  disabled={
                    newRateName.trim() === '' || !(parseFloat(newRateValue) > 0)
                  }
                  onClick={async () => {
                    try {
                      const { success, data } =
                        await fetchWithCreds<DollarRate>({
                          accessToken,
                          path: `/api/prices/rate`,
                          method: 'POST',
                          body: {
                            name: newRateName.trim(),
                            rate: parseFloat(newRateValue),
                          },
                        });
                      setSnackbarOpen(true);
                      if (success && data != null) {
                        setRates((prev) => [...prev, data]);
                        // Jump straight to the new rate: an admin who just made
                        // one is about to put prices on it.
                        setRateFilter(String(data.id));
                        setShowAddRateDialog(false);
                        setSnackbarMessage({
                          message: 'rateCreated',
                          severity: 'success',
                        });
                      } else {
                        setSnackbarMessage({
                          message: 'rateCreateFailed',
                          severity: 'error',
                        });
                      }
                    } catch (error) {
                      console.error(error);
                      setSnackbarOpen(true);
                      setSnackbarMessage({
                        message: 'rateCreateFailed',
                        severity: 'error',
                      });
                    }
                  }}
                >
                  {t('save')}
                </Button>
              </DialogActions>
            </Dialog>
          )}

          {showDeleteRateDialog && editingRate != null && (
            <DeleteDialog
              title={t('deleteRate')}
              description={t('confirmDeleteRate', { name: editingRate.name })}
              blueButtonText={t('cancel')}
              redButtonText={t('delete')}
              handleClose={async () => setShowDeleteRateDialog(false)}
              handleDelete={async () => {
                try {
                  const { success } = await fetchWithCreds({
                    accessToken,
                    path: `/api/prices/rate`,
                    method: 'DELETE',
                    body: { id: editingRate.id },
                  });
                  setSnackbarOpen(true);
                  if (success) {
                    // The rate is gone, so a filter still pointing at it would
                    // show an empty table.
                    setRateFilter('');
                    await refreshAfterReprice();
                    setSnackbarMessage({
                      message: 'rateDeleted',
                      severity: 'success',
                    });
                  } else {
                    setSnackbarMessage({
                      message: 'rateDeleteFailed',
                      severity: 'error',
                    });
                  }
                } catch (error) {
                  console.error(error);
                  setSnackbarOpen(true);
                  setSnackbarMessage({
                    message: 'rateDeleteFailed',
                    severity: 'error',
                  });
                } finally {
                  setShowDeleteRateDialog(false);
                }
              }}
            />
          )}

          {showBulkConfirm && (
            <Dialog open onClose={() => setShowBulkConfirm(false)}>
              <DialogTitle>{t('assignToRate')}</DialogTitle>
              <DialogContent>
                <DialogContentText>
                  {t('confirmAssignToRate', {
                    count: tableData.length - 1,
                    name:
                      rates.find((rate) => String(rate.id) === bulkRateId)
                        ?.name ?? '',
                  })}
                </DialogContentText>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setShowBulkConfirm(false)}>
                  {t('cancel')}
                </Button>
                <Button
                  variant="contained"
                  onClick={async () => {
                    setShowBulkConfirm(false);
                    // Exactly the rows the filters left on screen.
                    const priceIds = tableData
                      .slice(1)
                      .map((row) => row[PRICE_ID_IDX] as string);
                    try {
                      const { success } = await fetchWithCreds({
                        accessToken,
                        path: `/api/prices/assign-rate`,
                        method: 'PUT',
                        body: { priceIds, rateId: Number(bulkRateId) },
                      });
                      setSnackbarOpen(true);
                      if (success) {
                        await refreshAfterReprice();
                        setSnackbarMessage({
                          message: 'pricesAssigned',
                          severity: 'success',
                        });
                      } else {
                        setSnackbarMessage({
                          message: 'assignPricesError',
                          severity: 'error',
                        });
                      }
                    } catch (error) {
                      console.error(error);
                      setSnackbarOpen(true);
                      setSnackbarMessage({
                        message: 'assignPricesError',
                        severity: 'error',
                      });
                    }
                  }}
                >
                  {t('save')}
                </Button>
              </DialogActions>
            </Dialog>
          )}

          {showCreatePriceDialog && (
            <AddPrice
              handleClose={() => setShowCreatePriceDialog(false)}
              dollarRate={editingRate?.rate ?? 0}
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
                      // The rate the page is filtered to, so a price created
                      // while working inside one rate lands on it.
                      dollarRateId: editingRate?.id ?? null,
                    },
                  });

                  if (success && data != null) {
                    setAllPrices((prev) => [data, ...prev]);
                    // A brand-new price may carry no category and is always in
                    // stock, so either active filter would hide it. Clear both
                    // so it stays visible.
                    setCategoryFilter('');
                    setOutOfStockOnly(false);
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
