import Layout from '@/pages/components/Layout';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import {
  appBarHeight,
  mobileAppBarHeight,
  mobileBottomNavHeight,
} from '@/pages/lib/constants';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { SnackbarProps } from '@/pages/lib/types';
import { useStalePrices } from '@/pages/lib/StalePricesContext';
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
  editChecksPrice,
  foldSavedEdit,
  isEditablePriceCell,
  isMoneyRevert,
  mergePriceEdit,
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
  PriceEdit,
  PriceSortKey,
  processPrices,
  sortPrices,
  TableData,
  tmtFromUsd,
} from '@/pages/product/utils';
import {
  displayPriceOf,
  displayTmtFromUsd,
  pricesFromUsd,
  roundToDisplayTmt,
} from '@/pages/lib/priceDisplay';
import { findDefaultRate, rateForPrice } from '@/lib/dollarRates';
import { daysSince, staleTierFor } from '@/lib/priceStaleness';
import {
  Alert,
  alpha,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
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
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  Tooltip,
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
import AddIcon from '@mui/icons-material/Add';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditableText from '@/pages/product/components/EditableText';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export const getServerSideProps: GetServerSideProps = async (context) => {
  return {
    props: {
      messages: (await import(`../../../i18n/${context.locale}.json`)).default,
    },
  };
};

// Translation key for each table column, in the PRICE_*_IDX order.
const PRICE_HEADER_KEYS = [
  'priceColumnName',
  'rate',
  'priceColumnDollars',
  'priceColumnManat',
  'priceColumnDisplay',
  'category',
  'outOfStock',
  'updatedAt',
];

// Name column layout, left to right: 8px gap, the 30px delete icon, 8px gap,
// then the name text. The header label and every name start at the same x.
const NAME_TEXT_START = 46;
// Matches the padding EditableText puts around its text.
const EDITOR_PADDING = 16;

// On mobile the unsaved-changes bar sits just above the fixed bottom nav, and
// the floating chat button moves above the bar (which is at most 88px tall).
const MOBILE_SAVE_BAR_BOTTOM = mobileBottomNavHeight + 8;
const MOBILE_CHAT_BOTTOM_ABOVE_SAVE_BAR = MOBILE_SAVE_BAR_BOTTOM + 96;

const pricesPath = (keyword: string) =>
  keyword === ''
    ? '/api/prices'
    : `/api/prices?searchKeyword=${encodeURIComponent(keyword)}`;

export default function UpdatePrices() {
  const router = useRouter();
  const theme = useTheme();
  const platform = usePlatform();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const t = useTranslations();
  const [tableData, setTableData] = useState<TableData>([]);
  // Pending edits keyed by price id. Row-index keying corrupts across
  // sort/filter/search re-ordering, so we key by the stable price id instead.
  const [updatedPrices, setUpdatedPrices] = useState<Record<string, PriceEdit>>(
    {},
  );
  // Mirror of updatedPrices read by the derive effect to overlay pending edits
  // without adding updatedPrices to its deps (which would re-sort mid-typing).
  const updatedPricesRef = useRef<Record<string, PriceEdit>>({});
  const [discardCount, setDiscardCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
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
  // Mirror of allPrices for the edit handlers, which compare each change with
  // the saved price and are memoized too long to read the state directly.
  const allPricesRef = useRef<Prices[]>([]);
  allPricesRef.current = allPrices;
  const [sortKey, setSortKey] = useState<PriceSortKey>('editedStale');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [outOfStockOnly, setOutOfStockOnly] = useState(false);
  const { user, accessToken } = useUserContext();
  const { refresh: refreshStalePrices } = useStalePrices();
  const { categories } = useCategoryContext();
  const fetchWithCreds = useFetchWithCreds();
  // The first load waits for a token, but must not repeat when one rotates: the
  // server can rotate it in the response to any save, and reloading then would
  // throw away the search results on screen.
  const hasAccessToken = Boolean(accessToken);

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
    if (hasAccessToken) {
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
  }, [hasAccessToken]);

  // Records a change in the pending map, or removes it again once the price is
  // back to its saved values.
  const recordEdit = useCallback(
    (priceId: string, change: PriceEdit, moneyReverted = false) => {
      setUpdatedPrices((prevPrices) => {
        const saved = allPricesRef.current.find((p) => p.id === priceId);
        const edit = { id: priceId, ...change };
        const merged =
          saved == null
            ? { ...prevPrices[priceId], ...edit }
            : mergePriceEdit(saved, prevPrices[priceId], edit, moneyReverted);
        const next = { ...prevPrices };
        if (merged == null) delete next[priceId];
        else next[priceId] = merged;
        updatedPricesRef.current = next;
        return next;
      });
    },
    [],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handlePriceUpdate = useCallback(
    debounce((value: string | null, cellIndex: number, row: any[]) => {
      // A cleared box is just the admin mid-edit (e.g. holding Backspace):
      // ignore it quietly. The cell restores the last value on blur.
      if (value == null || value.trim() === '') return;

      if (cellIndex !== PRICE_NAME_IDX && Number.isNaN(parseFloat(value))) {
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

      const saved = allPricesRef.current.find((p) => p.id === priceId);
      const moneyReverted =
        saved != null && isMoneyRevert(saved, cellIndex, value);
      // The saved row, to put the linked price cells back on a revert.
      const savedRow = moneyReverted ? processPrices([saved])[1] : null;

      recordEdit(priceId, currPrice, moneyReverted);

      // Find the row by its price id, not its position: this runs after the
      // debounce delay, and a re-sort or filter in that window would put a
      // different price at the position the admin typed into.
      setTableData((prevData) => {
        const newData = prevData.map((prevRow, index) => {
          if (index > 0 && prevRow[PRICE_ID_IDX] === priceId) {
            return prevRow.map((cell, idx) => {
              if (
                savedRow != null &&
                idx !== cellIndex &&
                (idx === PRICE_DOLLAR_IDX ||
                  idx === PRICE_MANAT_IDX ||
                  idx === PRICE_DISPLAY_IDX)
              ) {
                return savedRow[idx];
              }
              if (cellIndex === PRICE_DOLLAR_IDX && idx === PRICE_MANAT_IDX) {
                return parsePrice(
                  tmtFromUsd(parseFloat(value), rowRate).toString(),
                );
              }
              if (cellIndex === PRICE_MANAT_IDX && idx === PRICE_DOLLAR_IDX) {
                return parsePrice((parseFloat(value) / rowRate).toString());
              }
              if (cellIndex === PRICE_DOLLAR_IDX && idx === PRICE_DISPLAY_IDX) {
                return displayTmtFromUsd(parseFloat(value), rowRate);
              }
              if (cellIndex === PRICE_MANAT_IDX && idx === PRICE_DISPLAY_IDX) {
                return roundToDisplayTmt(parseFloat(value));
              }
              // The cell being typed in keeps what was typed, so the table
              // data matches the screen and a re-render never reverts it.
              if (idx === cellIndex) return value;
              return cell;
            });
          }
          return prevRow;
        });
        return newData;
      });
    }, 500),
    [rates],
  );

  // A category pick is a discrete event, so unlike handlePriceUpdate it needs no
  // debounce. It records the edit in the same id-keyed pending map, which makes
  // the Save button appear and rides along in the existing batched PUT.
  const handleCategoryChange = useCallback(
    (priceId: string, categoryId: string | null) => {
      recordEdit(priceId, { categoryId });

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

  // Same discrete-event shape as a category pick. The rate is linked to the
  // manat and display figures, so they are re-derived from the row's dollars at
  // the new rate right away (with pricesFromUsd, the same rule the server uses)
  // and travel in the pending edit. A display price the admin pinned in this
  // session, without touching dollars, is kept, as the server would.
  const handleRateChange = useCallback(
    (priceId: string, rateId: string | null) => {
      const dollarRateId = rateId == null ? null : Number(rateId);
      const change: PriceEdit = { dollarRateId };

      const saved = allPricesRef.current.find((p) => p.id === priceId);
      const pending = updatedPricesRef.current[priceId];
      const newRate = rateForPrice({ dollarRateId }, rates)?.rate ?? 0;
      const dollars = parseFloat(pending?.price ?? saved?.price ?? '');

      if (saved != null && newRate > 0 && Number.isFinite(dollars)) {
        // A pending display with no dollar change was typed by the admin,
        // unless an earlier rate change in this session derived it.
        const pendingRate =
          pending != null && 'dollarRateId' in pending
            ? rateForPrice(
                { dollarRateId: pending.dollarRateId ?? null },
                rates,
              )?.rate ?? 0
            : 0;
        const derivedByRate =
          pendingRate > 0 &&
          Number(pending?.displayPriceTmt) ===
            Number(pricesFromUsd(dollars, pendingRate).displayPriceTmt);
        const pinnedDisplay =
          pending?.price == null && !derivedByRate
            ? pending?.displayPriceTmt
            : undefined;
        const backToSaved =
          pending?.price == null &&
          dollarRateId === (saved.dollarRateId ?? null);
        // Back on the saved rate with the saved dollars: show the saved
        // figures again rather than a fresh conversion, which could differ
        // from what is stored.
        const derived = backToSaved
          ? {
              priceInTmt: saved.priceInTmt,
              displayPriceTmt: displayPriceOf(saved),
            }
          : pricesFromUsd(dollars, newRate);
        change.priceInTmt = derived.priceInTmt;
        change.displayPriceTmt = pinnedDisplay ?? derived.displayPriceTmt;
      }

      recordEdit(priceId, change);

      setTableData((prevData) =>
        prevData.map((row, index) =>
          index > 0 && row[PRICE_ID_IDX] === priceId
            ? row.map((cell, idx) => {
                if (idx === PRICE_RATE_IDX) return dollarRateId;
                if (idx === PRICE_MANAT_IDX && change.priceInTmt != null) {
                  return parsePrice(change.priceInTmt);
                }
                if (
                  idx === PRICE_DISPLAY_IDX &&
                  change.displayPriceTmt != null
                ) {
                  return parsePrice(change.displayPriceTmt);
                }
                return cell;
              })
            : row,
        ),
      );
    },
    [rates, recordEdit],
  );

  // Same discrete-event shape again. Nothing cascades client-side: the owning
  // product's own flag is re-derived by the server when the batched PUT lands,
  // so the product column here can lag until the next load.
  const handleOutOfStockChange = useCallback(
    (priceId: string, isOutOfStock: boolean) => {
      recordEdit(priceId, { isOutOfStock });

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
  // afterwards would push pre-recalculation numbers back over fresh ones. The
  // search runs server-side, so the re-read has to repeat it to keep it applied.
  const refreshAfterReprice = useCallback(async () => {
    setUpdatedPrices({});
    updatedPricesRef.current = {};
    const [pricesResponse, ratesResponse] = await Promise.all([
      fetchWithCreds<Prices[]>({
        accessToken,
        path: pricesPath(searchKeyword),
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
  }, [accessToken, searchKeyword]);

  const handleSearch = useCallback(
    async (keyword: string) => {
      try {
        const { success, data, message } = await fetchWithCreds<Prices[]>({
          accessToken,
          path: pricesPath(keyword),
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

  const pendingCount = Object.keys(updatedPrices).length;
  // One clock reading per render, shared by every row's age.
  const now = new Date();
  // Saved rows by id, so a pending edit can be judged against what is stored.
  const savedById = useMemo(
    () => new Map(allPrices.map((price) => [price.id, price])),
    [allPrices],
  );

  const filtersActive =
    searchKeyword !== '' ||
    categoryFilter !== '' ||
    outOfStockOnly ||
    rateFilter !== '';

  // Search runs server-side, so clearing it has to re-read the list too.
  const handleClearFilters = () => {
    setCategoryFilter('');
    setOutOfStockOnly(false);
    setRateFilter('');
    setSearchKeyword('');
    handleSearch('');
  };

  // Edits are only ever held in updatedPrices until saved, so dropping them and
  // re-deriving the table from allPrices restores the saved values. The bumped counter
  // in the row keys also remounts every editor, so an EditableText that still
  // has focus cannot keep showing the discarded text.
  const handleDiscard = () => {
    setUpdatedPrices({});
    updatedPricesRef.current = {};
    setAllPrices((prev) => [...prev]);
    setDiscardCount((n) => n + 1);
  };

  // Toggles "mark as checked" on a price. It is an ordinary pending edit: it
  // counts in the save bar and only reaches the server with Save, and the row
  // keeps its position until then.
  const handleToggleChecked = useCallback(
    (priceId: string) => {
      const marked = updatedPricesRef.current[priceId]?.markChecked === true;
      recordEdit(priceId, { markChecked: !marked });
    },
    [recordEdit],
  );

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { success } = await fetchWithCreds<Prices[]>({
        accessToken,
        path: `/api/prices`,
        method: 'PUT',
        body: { pricePairs: Object.values(updatedPrices) },
      });

      if (success) {
        // Fold saved edits into the master list so re-derives keep showing
        // them, then clear pending state (hides the Save bar and stops
        // re-saving stale edits).
        setAllPrices((prev) =>
          prev.map((p) =>
            updatedPrices[p.id]
              ? foldSavedEdit(p, updatedPrices[p.id], rates)
              : p,
          ),
        );
        setUpdatedPrices({});
        updatedPricesRef.current = {};
        // Saved or refreshed prices may clear warnings on the product cards.
        refreshStalePrices();
        setSnackbarOpen(true);
        setSnackbarMessage({ message: 'pricesUpdated', severity: 'success' });
      } else {
        setSnackbarOpen(true);
        setSnackbarMessage({ message: 'updatePricesError', severity: 'error' });
      }
    } catch (error) {
      console.error(error);
      setSnackbarOpen(true);
      setSnackbarMessage({ message: 'updatePricesError', severity: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Layout
      handleHeaderBackButton={() => router.push('/')}
      mobileChatFabBottom={
        pendingCount > 0 ? MOBILE_CHAT_BOTTOM_ABOVE_SAVE_BAR : undefined
      }
    >
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
          <Box className="flex flex-col w-full gap-3">
            {/* Rates: picking one both filters the table to it and chooses the
                rate the editor below changes, since they were always the same
                thing. "All" shows every price. */}
            <Box className="flex flex-row flex-wrap items-center gap-2">
              <Typography fontWeight={600} color="text.secondary">
                {t('rate')}:
              </Typography>
              <Chip
                label={t('allRates')}
                color="primary"
                variant={rateFilter === '' ? 'filled' : 'outlined'}
                onClick={() => setRateFilter('')}
              />
              {rates.map((rate) => (
                <Chip
                  key={rate.id}
                  label={`${rate.name} · ${rate.rate}`}
                  color="primary"
                  variant={
                    String(rate.id) === rateFilter ? 'filled' : 'outlined'
                  }
                  onClick={() => setRateFilter(String(rate.id))}
                />
              ))}
              <Chip
                label={`+ ${t('addRate')}`}
                variant="outlined"
                onClick={() => {
                  setNewRateName('');
                  setNewRateValue('');
                  setShowAddRateDialog(true);
                }}
              />
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                sx={{ textTransform: 'none', height: 40, ml: 'auto' }}
                onClick={() => setShowCreatePriceDialog(true)}
              >
                {t('addPrice')}
              </Button>
            </Box>

            {/* The editor only appears once a rate is picked. */}
            {selectedRate != null && (
              <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                <Box className="flex flex-row flex-wrap items-center gap-3">
                  <Typography fontWeight={600} fontSize={isMdUp ? 18 : 16}>
                    {selectedRate.name}
                  </Typography>
                  <Box className="flex flex-row items-center gap-2">
                    <Typography color="text.secondary">$1 =</Typography>
                    <TextField
                      size="small"
                      value={rateDraft}
                      type="number"
                      onChange={(e) => setRateDraft(e.target.value)}
                      sx={{ width: 110 }}
                    />
                    <Typography color="text.secondary">manat</Typography>
                  </Box>
                  <Box className="flex flex-row items-center gap-1">
                    <Button
                      variant="contained"
                      size="small"
                      disabled={
                        !(parseFloat(rateDraft) > 0) ||
                        parseFloat(rateDraft) === selectedRate.rate
                      }
                      startIcon={<CheckCircleOutlineIcon />}
                      sx={{ textTransform: 'none' }}
                      onClick={() => setShowRateConfirm(true)}
                    >
                      {t('save')}
                    </Button>
                    {/* The default rate has no delete: every other rate falls
                        back to it, and the server refuses to remove it. */}
                    {!selectedRate.isDefault && (
                      <IconButton
                        size="small"
                        onClick={() => setShowDeleteRateDialog(true)}
                      >
                        <DeleteIcon color="error" />
                      </IconButton>
                    )}
                  </Box>
                </Box>
              </Paper>
            )}

            {/* Search and filters in one slim bar. */}
            <Paper
              variant="outlined"
              sx={{ p: 1.5, borderRadius: 2 }}
              className="flex flex-row flex-wrap items-center gap-2"
            >
              <Box className="flex-1 min-w-[220px]">
                <SearchBar
                  handleSearch={handleSearch}
                  setSearchKeyword={setSearchKeyword}
                  searchPlaceholder={t('search')}
                  searchKeyword={searchKeyword}
                  width="100%"
                />
              </Box>
              <FormControl size="small" sx={{ minWidth: 180 }}>
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
              <ToggleButton
                size="small"
                color="error"
                value="outOfStockOnly"
                selected={outOfStockOnly}
                onChange={() => setOutOfStockOnly((prev) => !prev)}
                sx={{ textTransform: 'none', lineHeight: 1.2, height: 40 }}
              >
                {t('outOfStockOnly')}
              </ToggleButton>
              <FormControl size="small" sx={{ minWidth: 170 }}>
                <InputLabel>{t('sortBy')}</InputLabel>
                <Select
                  label={t('sortBy')}
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as PriceSortKey)}
                >
                  <MenuItem value="">{t('default')}</MenuItem>
                  <MenuItem value="nameAsc">{t('nameAToZ')}</MenuItem>
                  <MenuItem value="nameDesc">{t('nameZToA')}</MenuItem>
                  <MenuItem value="dollarAsc">{t('dollarsLowToHigh')}</MenuItem>
                  <MenuItem value="dollarDesc">
                    {t('dollarsHighToLow')}
                  </MenuItem>
                  <MenuItem value="manatAsc">{t('manatLowToHigh')}</MenuItem>
                  <MenuItem value="manatDesc">{t('manatHighToLow')}</MenuItem>
                  <MenuItem value="displayAsc">
                    {t('displayLowToHigh')}
                  </MenuItem>
                  <MenuItem value="displayDesc">
                    {t('displayHighToLow')}
                  </MenuItem>
                  <MenuItem value="editedRecent">
                    {t('recentlyEdited')}
                  </MenuItem>
                  <MenuItem value="editedStale">
                    {t('longestNotEdited')}
                  </MenuItem>
                </Select>
              </FormControl>
            </Paper>

            {/* How many rows the filters left, and a way out of them. Only
                shown while something is filtered. */}
            {filtersActive && (
              <Box className="flex flex-row items-center gap-3">
                <Typography color="text.secondary">
                  {t('pricesCount', {
                    count: Math.max(tableData.length - 1, 0),
                  })}
                </Typography>
                <Button
                  size="small"
                  sx={{ textTransform: 'none' }}
                  onClick={handleClearFilters}
                >
                  {t('clearFilters')}
                </Button>
              </Box>
            )}

            {/* Acts on exactly what the filters left on screen, never the
                whole table, and says how many that is. */}
            {tableData.length > 1 && rates.length > 0 && (
              <Paper
                variant="outlined"
                sx={{ p: 1.5, borderRadius: 2, bgcolor: 'grey.50' }}
                className="flex flex-row flex-wrap items-center gap-2"
              >
                <FormControl size="small" sx={{ minWidth: 200 }}>
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
                  sx={{ textTransform: 'none', height: 40 }}
                  onClick={() => setShowBulkConfirm(true)}
                >
                  {t('assignToRate')} ({tableData.length - 1})
                </Button>
              </Paper>
            )}
          </Box>
          {tableData.length > 1 && (
            <TableContainer
              component={Paper}
              variant="outlined"
              sx={{ borderRadius: 2, maxHeight: 'calc(100vh - 100px)' }}
            >
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    {tableData[0].map((_header, index) => (
                      <TableCell
                        key={index}
                        sx={{
                          bgcolor: 'grey.200',
                          whiteSpace: 'nowrap',
                          py: 1.5,
                          borderBottom: '2px solid',
                          borderBottomColor: alpha(
                            theme.palette.primary.main,
                            0.3,
                          ),
                          // Room for the delete icon that sits in each row's
                          // Name cell, so the header lines up with the names.
                          ...(index === PRICE_NAME_IDX && {
                            pl: `${NAME_TEXT_START}px`,
                          }),
                        }}
                      >
                        <Typography fontWeight={700} fontSize={15}>
                          {/* processPrices emits English labels; they are
                            translated here, where the locale is known. */}
                          {t(PRICE_HEADER_KEYS[index])}
                        </Typography>
                      </TableCell>
                    ))}
                    {/* Room for the per-row refresh icon. */}
                    <TableCell
                      sx={{
                        bgcolor: 'grey.200',
                        borderBottom: '2px solid',
                        borderBottomColor: alpha(
                          theme.palette.primary.main,
                          0.3,
                        ),
                      }}
                    />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tableData.slice(1).map((row) => {
                    const checkedAt = row[PRICE_UPDATED_IDX];
                    const days =
                      typeof checkedAt === 'string'
                        ? daysSince(checkedAt, now)
                        : null;
                    const rowEdit = updatedPrices[row[PRICE_ID_IDX] as string];
                    const markedChecked = rowEdit?.markChecked === true;
                    const savedRow = savedById.get(row[PRICE_ID_IDX] as string);
                    // Pressing refresh or editing the dollar/manat price both
                    // count as re-checking it on save, so the row shows as
                    // resolved already.
                    const pendingChecked =
                      rowEdit != null &&
                      savedRow != null &&
                      editChecksPrice(savedRow, rowEdit, rates);
                    // A sold-out price is not sold, so nobody needs to
                    // re-check it; the overview and the daily alert skip it
                    // the same way.
                    const outOfStock = row[PRICE_OUT_OF_STOCK_IDX] === true;
                    const tier =
                      days == null || pendingChecked || outOfStock
                        ? null
                        : staleTierFor(days);
                    const tintColor =
                      tier === 'red'
                        ? theme.palette.error.main
                        : theme.palette.warning.main;
                    return (
                      <TableRow
                        hover
                        className="group"
                        sx={
                          tier != null
                            ? {
                                bgcolor: alpha(tintColor, 0.12),
                                // Hover deepens the warning colour instead of
                                // the default grey, so a warned row never looks
                                // like a clean one under the pointer.
                                '&.MuiTableRow-hover:hover': {
                                  bgcolor: alpha(tintColor, 0.24),
                                },
                              }
                            : undefined
                        }
                        // Keyed by price id so a re-sort moves each row's cells
                        // with it: an open editor stays on the price being
                        // edited. The discard counter forces a remount so
                        // discarded text never lingers in an editor.
                        key={`${discardCount}-${row[PRICE_ID_IDX] as string}`}
                      >
                        {/* The id trails every row as the edit key and is not a
                        column, so only the header's worth of cells is drawn. */}
                        {row.slice(0, PRICE_ID_IDX).map((cell, cellIndex) => (
                          <TableCell
                            className="relative"
                            sx={
                              isEditablePriceCell(cellIndex)
                                ? {
                                    p: 0,
                                    height: '1px',
                                    // EditableText pads its own text by
                                    // EDITOR_PADDING, so the cell only adds
                                    // the rest of the way to the header's edge.
                                    ...(cellIndex === PRICE_NAME_IDX && {
                                      pl: `${NAME_TEXT_START - EDITOR_PADDING}px`,
                                    }),
                                    '&:hover': { bgcolor: 'action.hover' },
                                  }
                                : undefined
                            }
                            key={cellIndex}
                          >
                            {/* Shown by CSS on row hover, not by React state:
                              a hover state re-rendered the whole table every
                              time the pointer crossed a row, which janked
                              wheel scrolling on long lists. */}
                            {cellIndex === PRICE_NAME_IDX && (
                              <IconButton
                                disableRipple
                                size="small"
                                // Unclickable while hidden, so a tap on that spot
                                // cannot open the dialog. Devices without hover
                                // always show it.
                                className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto [@media(hover:none)]:opacity-100 [@media(hover:none)]:pointer-events-auto"
                                onClick={() => {
                                  setSelectedPrice(row[PRICE_ID_IDX] as string);
                                  setShowDeleteDialog(true);
                                }}
                              >
                                <DeleteIcon color="error" />
                              </IconButton>
                            )}
                            {(() => {
                              // Only the text span is editable, never the whole
                              // cell: see EditableText for why React must not
                              // own the edited text.
                              if (isEditablePriceCell(cellIndex)) {
                                return (
                                  <EditableText
                                    value={cell as string | number | null}
                                    onTextChange={(text) =>
                                      handlePriceUpdate(text, cellIndex, row)
                                    }
                                    onCommit={handlePriceUpdate.flush}
                                  />
                                );
                              }
                              if (cellIndex === PRICE_CATEGORY_IDX) {
                                return (
                                  <SelectCell
                                    id={row[PRICE_ID_IDX] as string}
                                    value={(cell as string | null) ?? null}
                                    options={flattenedCats}
                                    emptyLabel={t('noCategory')}
                                    dirty={
                                      'categoryId' in
                                      (updatedPrices[
                                        row[PRICE_ID_IDX] as string
                                      ] ?? {})
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
                                // Days since the price was last checked; the
                                // row tint above carries the warning tier.
                                if (days == null) return null;
                                if (pendingChecked) {
                                  return (
                                    <Typography
                                      variant="body2"
                                      color="text.secondary"
                                      sx={{ fontStyle: 'italic' }}
                                    >
                                      {t('daysShort', { days: 0 })}
                                    </Typography>
                                  );
                                }
                                const daysText = (
                                  <Typography
                                    variant="body2"
                                    color={
                                      tier == null
                                        ? 'text.secondary'
                                        : tintColor
                                    }
                                    fontWeight={tier == null ? undefined : 700}
                                  >
                                    {t('daysShort', { days })}
                                  </Typography>
                                );
                                return tier == null ? (
                                  daysText
                                ) : (
                                  <Tooltip
                                    title={t(
                                      tier === 'red'
                                        ? 'staleRedHint'
                                        : 'staleOrangeHint',
                                    )}
                                  >
                                    {daysText}
                                  </Tooltip>
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
                        <TableCell sx={{ py: 0, px: 1 }}>
                          <Tooltip title={t('refreshPrice')}>
                            <span>
                              <IconButton
                                disableRipple
                                size="small"
                                aria-label={t('refreshPrice')}
                                onClick={() =>
                                  handleToggleChecked(
                                    row[PRICE_ID_IDX] as string,
                                  )
                                }
                              >
                                <RefreshIcon
                                  color={markedChecked ? 'warning' : 'primary'}
                                />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Pinned to the bottom so Save is always in reach, however far down
              the list the admin has scrolled. */}
          {pendingCount > 0 && (
            <Paper
              elevation={6}
              sx={{
                position: 'sticky',
                bottom: platform === 'mobile' ? MOBILE_SAVE_BAR_BOTTOM : 16,
                zIndex: 10,
                p: 1.5,
                // Keeps Save clear of the floating chat button on web.
                ...(platform === 'web' && { pr: '64px' }),
                borderRadius: 2,
              }}
              className="flex flex-row items-center justify-between gap-3"
            >
              <Typography
                fontWeight={600}
                fontSize={isMdUp ? 16 : 14}
                color="warning.main"
              >
                {t('unsavedChanges', { count: pendingCount })}
              </Typography>
              <Box className="flex flex-row items-center gap-2">
                <Button
                  variant="outlined"
                  color="error"
                  sx={{ textTransform: 'none', minWidth: isMdUp ? 120 : 0 }}
                  disabled={isSaving}
                  onClick={handleDiscard}
                >
                  {t('discard')}
                </Button>
                <Button
                  variant="contained"
                  sx={{ textTransform: 'none', minWidth: isMdUp ? 140 : 0 }}
                  disabled={isSaving}
                  onClick={handleSave}
                >
                  {t('save')}
                </Button>
              </Box>
            </Paper>
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
                    // Forget its unsaved edit too, or the next save would
                    // send a price that no longer exists.
                    setUpdatedPrices((prev) => {
                      const next = { ...prev };
                      delete next[selectedPrice];
                      updatedPricesRef.current = next;
                      return next;
                    });
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
              rates={rates}
              // Opens on the rate the page is filtered to, so a price created
              // while working inside one rate lands on it by default.
              defaultRateId={editingRate?.id ?? null}
              // Same for the category, so the new price stays in the filtered
              // view. The two sentinels are views, not categories to file under.
              defaultCategoryId={
                categoryFilter === '' ||
                categoryFilter === NO_CATEGORY_FILTER ||
                categoryFilter === NO_PRODUCT_FILTER
                  ? null
                  : categoryFilter
              }
              categoryOptions={flattenedCats}
              handleCreate={async (
                name: string,
                priceInDollars: string,
                priceInManat: string,
                categoryId: string | null,
                dollarRateId: number | null,
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
                      dollarRateId,
                    },
                  });

                  if (success && data != null) {
                    setAllPrices((prev) => [data, ...prev]);
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
