import type {
  ListingRankList,
  ListingRankProductItem,
  ListingRankTaken,
  ListingRankUnrankedPage,
} from '@/pages/api/product/listing-rank.page';
import SortableProductList, {
  ProductThumbnail,
} from '@/pages/components/SortableProductList';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { DEFAULT_LOCALE } from '@/pages/lib/constants';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import {
  byRank,
  isValidListingRank,
  LISTING_RANK_MAX,
  LISTING_RANK_MAX_CHANGES,
  listingRankChanges,
  moveKeepingRanks,
  rankForAdd,
  shiftAddedRanks,
} from '@/pages/lib/listingRank';
import { parseName } from '@/pages/lib/utils';
import {
  categoryMenuItems,
  flattenCategories,
} from '@/pages/product/components/categoryOptions';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  InputAdornment,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Ranked = ListingRankProductItem & { listingRank: number };

type SnackbarSeverity = 'error' | 'warning' | 'success';

interface ListingOrderTabProps {
  accessToken: string | null | undefined;
  showSnackbar: (message: string, severity: SnackbarSeverity) => void;
}

const SEARCH_DEBOUNCE_MS = 300;
const PATH = '/api/product/listing-rank';

export default function ListingOrderTab({
  accessToken,
  showSnackbar,
}: ListingOrderTabProps) {
  const router = useRouter();
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const t = useTranslations();
  const locale = router.locale ?? DEFAULT_LOCALE;
  const fetchWithCreds = useFetchWithCreds();
  const { categories } = useCategoryContext();

  const [categoryId, setCategoryId] = useState('');
  const [pendingCategoryId, setPendingCategoryId] = useState<string | null>(
    null,
  );

  const [saved, setSaved] = useState<Ranked[]>([]);
  const [items, setItems] = useState<Ranked[]>([]);
  const [nextRank, setNextRank] = useState<number | null>(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [unranked, setUnranked] = useState<ListingRankProductItem[]>([]);
  const [unrankedHasMore, setUnrankedHasMore] = useState(false);
  const [unrankedPage, setUnrankedPage] = useState(1);
  const [loadingUnranked, setLoadingUnranked] = useState(false);
  const [query, setQuery] = useState('');
  const listToken = useRef(0);
  const unrankedToken = useRef(0);
  // The search term the unranked list currently shows (or is loading).
  const searchedQuery = useRef('');

  const [rankDrafts, setRankDrafts] = useState<Record<string, string>>({});

  const accessTokenRef = useRef(accessToken);
  accessTokenRef.current = accessToken;

  const categoryOptions = useMemo(
    () => flattenCategories(categories ?? [], locale),
    [categories, locale],
  );

  const changes = useMemo(
    () => listingRankChanges(saved, items),
    [saved, items],
  );
  const isDirty = changes.length > 0;

  const applyList = (data: ListingRankList) => {
    setSaved(data.ranked);
    setItems(data.ranked);
    setNextRank(data.nextRank);
    setUnranked(data.unranked);
    setUnrankedHasMore(data.unrankedHasMore);
    setUnrankedPage(1);
    setRankDrafts({});
    unrankedToken.current += 1;
    searchedQuery.current = '';
  };

  const fetchList = useCallback(
    async <T,>(params: Record<string, string>) => {
      const token = accessTokenRef.current;
      if (!token) return null;
      const res = await fetchWithCreds<T>({
        accessToken: token,
        path: `${PATH}?${new URLSearchParams(params).toString()}`,
        method: 'GET',
      });
      return res.success && res.data != null ? res.data : null;
    },
    [fetchWithCreds],
  );

  const load = useCallback(
    async (id: string) => {
      listToken.current += 1;
      const token = listToken.current;
      setLoading(true);
      setQuery('');
      try {
        const data = await fetchList<ListingRankList>({ categoryId: id });
        if (token !== listToken.current) return;
        if (data) applyList(data);
        else showSnackbar(t('listingOrderLoadError'), 'error');
      } catch {
        if (token === listToken.current) {
          showSnackbar(t('listingOrderLoadError'), 'error');
        }
      } finally {
        if (token === listToken.current) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fetchList],
  );

  const loadUnranked = async (q: string, page: number) => {
    if (!categoryId) return;
    unrankedToken.current += 1;
    const token = unrankedToken.current;
    searchedQuery.current = q;
    setLoadingUnranked(true);
    try {
      const params: Record<string, string> = {
        categoryId,
        page: String(page),
        part: 'unranked',
      };
      if (q) params.q = q;
      const data = await fetchList<ListingRankUnrankedPage>(params);
      if (token !== unrankedToken.current || data == null) return;
      setUnranked((prev) =>
        page === 1 ? data.unranked : [...prev, ...data.unranked],
      );
      setUnrankedHasMore(data.unrankedHasMore);
      setUnrankedPage(page);
    } catch {
      // The list just stays as it was.
    } finally {
      if (token === unrankedToken.current) setLoadingUnranked(false);
    }
  };

  useEffect(() => {
    const term = query.trim();
    if (term === searchedQuery.current || term.length === 1) return undefined;
    const timer = setTimeout(() => loadUnranked(term, 1), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    if (!isDirty) return undefined;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // eslint-disable-next-line no-param-reassign
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  const selectCategory = (id: string) => {
    setCategoryId(id);
    setPendingCategoryId(null);
    load(id);
  };

  const requestCategory = (id: string) => {
    if (id === categoryId) return;
    if (isDirty) setPendingCategoryId(id);
    else selectCategory(id);
  };

  const pickedIds = new Set(items.map(({ id }) => id));
  const removedSaved = saved.filter(({ id }) => !pickedIds.has(id));
  const shownUnranked = [
    ...removedSaved.map((item) => ({ ...item, listingRank: null })),
    ...unranked.filter(({ id }) => !pickedIds.has(id)),
  ];

  const clearDraft = (id: string) =>
    setRankDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

  const add = (product: ListingRankProductItem) => {
    const rank = rankForAdd(items, nextRank);
    if (rank == null) {
      showSnackbar(t('listingOrderRankFull'), 'warning');
      return;
    }
    setItems((prev) =>
      [...prev, { ...product, listingRank: rank }].sort(byRank),
    );
  };

  const remove = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    clearDraft(id);
  };

  const reorder = (from: number, to: number) =>
    setItems((prev) => moveKeepingRanks(prev, from, to));

  const commitRank = (item: Ranked) => {
    const draft = rankDrafts[item.id];
    if (draft == null) return;
    const value = Number(draft);
    clearDraft(item.id);
    if (value === item.listingRank) return;
    if (!isValidListingRank(value)) {
      showSnackbar(
        t('listingOrderRankInvalid', { max: LISTING_RANK_MAX }),
        'warning',
      );
      return;
    }
    if (
      items.some((other) => other.id !== item.id && other.listingRank === value)
    ) {
      showSnackbar(t('listingOrderRankDuplicate', { rank: value }), 'warning');
      return;
    }
    setItems((prev) =>
      prev
        .map((other) =>
          other.id === item.id ? { ...other, listingRank: value } : other,
        )
        .sort(byRank),
    );
  };

  // Someone else saved first and took numbers this list was about to use.
  const handleRankTaken = async (taken: ListingRankTaken | null) => {
    const staleNextRank = nextRank;
    const freshNextRank = taken?.nextRank ?? null;
    setNextRank(freshNextRank);
    const shifted =
      staleNextRank != null && freshNextRank != null
        ? shiftAddedRanks(
            items,
            new Set(saved.map(({ id }) => id)),
            staleNextRank,
            freshNextRank,
          )
        : null;
    const conflict = taken?.conflict ?? null;
    if (shifted != null) {
      // The products added since the last save move along to free numbers,
      // keeping their order, so the next Save goes through.
      setItems(shifted);
      showSnackbar(
        t('listingOrderRanksMoved', { from: freshNextRank ?? '' }),
        'warning',
      );
    } else if (conflict != null) {
      showSnackbar(
        t('listingOrderRankTaken', {
          rank: conflict.listingRank,
          product: parseName(conflict.productName, locale),
          category: parseName(conflict.categoryName, locale),
        }),
        'warning',
      );
    } else {
      showSnackbar(t('listingOrderRankTakenUnknown'), 'warning');
      await load(categoryId);
    }
  };

  const handleSave = async () => {
    if (!accessToken || !categoryId) return;
    if (changes.length > LISTING_RANK_MAX_CHANGES) {
      showSnackbar(
        t('listingOrderTooManyChanges', {
          count: changes.length,
          max: LISTING_RANK_MAX_CHANGES,
        }),
        'warning',
      );
      return;
    }
    setSaving(true);
    try {
      const res = await fetchWithCreds<ListingRankList | ListingRankTaken>({
        accessToken,
        path: PATH,
        method: 'PUT',
        body: { categoryId, changes },
      });
      if (res.success) {
        showSnackbar(t('listingOrderSaved'), 'success');
        setQuery('');
        // The numbers are saved even when the fresh list didn't come back.
        if (res.data != null) applyList(res.data as ListingRankList);
        else await load(categoryId);
      } else if (res.message === 'listingRankTaken') {
        await handleRankTaken((res.data as ListingRankTaken) ?? null);
      } else if (res.message === 'productNotFound') {
        showSnackbar(t('recommendedProductGone'), 'warning');
        await load(categoryId);
      } else if (res.message === 'productNotInCategory') {
        showSnackbar(t('listingOrderProductMoved'), 'warning');
        await load(categoryId);
      } else {
        showSnackbar(t('listingOrderSaveError'), 'error');
      }
    } catch {
      showSnackbar(t('listingOrderSaveError'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const hiddenNotes = (item: ListingRankProductItem) => (
    <>
      {item.imgUrl == null && (
        <Typography fontSize={12} color="warning.main">
          {t('recommendedHiddenNoImage')}
        </Typography>
      )}
      {item.isOutOfStock && <Chip size="small" label={t('outOfStock')} />}
    </>
  );

  const nameAndCategory = (item: ListingRankProductItem) => (
    <>
      <Typography fontSize={14} className="truncate">
        {parseName(item.name, locale)}
      </Typography>
      <Typography fontSize={12} color="text.secondary" className="truncate">
        {parseName(item.categoryName, locale)}
      </Typography>
    </>
  );

  return (
    <Box className="flex flex-col gap-5 w-full">
      <Box className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <TextField
          select
          size="small"
          value={categoryId}
          onChange={(event) => requestCategory(event.target.value)}
          label={t('selectCategory')}
          sx={{ minWidth: 260, flex: isMdUp ? undefined : 1 }}
        >
          {categoryMenuItems(categoryOptions)}
        </TextField>
        <Box className="flex flex-row items-center gap-2">
          {isDirty && (
            <>
              <Typography fontSize={13} color="text.secondary">
                {t('unsavedChanges', { count: changes.length })}
              </Typography>
              <Button
                sx={{ textTransform: 'none' }}
                disabled={saving}
                onClick={() => {
                  setItems(saved);
                  setRankDrafts({});
                }}
              >
                {t('cancel')}
              </Button>
            </>
          )}
          <Button
            variant="contained"
            sx={{ textTransform: 'none', minWidth: 96 }}
            disabled={!isDirty || saving}
            onClick={handleSave}
          >
            {saving ? <CircularProgress size={20} /> : t('save')}
          </Button>
        </Box>
      </Box>

      <Typography fontSize={13} color="text.secondary">
        {t('listingOrderHint')}
      </Typography>

      {loading && (
        <Box className="flex justify-center py-10">
          <CircularProgress />
        </Box>
      )}

      {!loading && categoryId && (
        <>
          <Typography fontWeight={600} fontSize={15}>
            {t('listingOrderRanked')} ({items.length})
          </Typography>
          {items.length === 0 && (
            <Typography color="text.secondary" fontSize={14}>
              {t('listingOrderEmpty')}
            </Typography>
          )}
          {items.length > 0 && (
            <SortableProductList
              items={items}
              imgUrl={(item) => item.imgUrl}
              onReorder={reorder}
              onRemove={(item) => remove(item.id)}
              renderLeading={(item) => (
                <TextField
                  size="small"
                  value={rankDrafts[item.id] ?? String(item.listingRank)}
                  onChange={(event) =>
                    setRankDrafts((prev) => ({
                      ...prev,
                      [item.id]: event.target.value.replace(/\D/g, ''),
                    }))
                  }
                  onBlur={() => commitRank(item)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') commitRank(item);
                    if (event.key === 'Escape') clearDraft(item.id);
                  }}
                  onDragStart={(event) => event.preventDefault()}
                  inputProps={{
                    inputMode: 'numeric',
                    'aria-label': t('listingOrderNumber'),
                    draggable: false,
                  }}
                  sx={{ width: 84, flexShrink: 0 }}
                />
              )}
              renderDetails={(item) => (
                <>
                  {nameAndCategory(item)}
                  {hiddenNotes(item)}
                </>
              )}
            />
          )}

          <Divider />

          <Typography fontWeight={600} fontSize={15}>
            {t('listingOrderUnranked')}
          </Typography>
          <TextField
            size="small"
            fullWidth
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('listingOrderSearchPlaceholder')}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={18} />
                </InputAdornment>
              ),
              endAdornment: loadingUnranked ? (
                <InputAdornment position="end">
                  <CircularProgress size={16} />
                </InputAdornment>
              ) : undefined,
            }}
          />
          <Box className="flex flex-col border border-[#eee] rounded-[10px]">
            {shownUnranked.length === 0 && !loadingUnranked && (
              <Typography fontSize={13} color="text.secondary" sx={{ p: 2 }}>
                {t('noProductsFound')}
              </Typography>
            )}
            {shownUnranked.map((product) => (
              <Box
                key={product.id}
                className="flex flex-row items-center gap-3 px-3 py-2 border-b border-[#f3f3f3] last:border-b-0"
              >
                <ProductThumbnail imgUrl={product.imgUrl} size={40} />
                <Box className="flex flex-col flex-1 min-w-0">
                  {nameAndCategory(product)}
                </Box>
                {hiddenNotes(product)}
                <Button
                  size="small"
                  variant="outlined"
                  sx={{ textTransform: 'none', flexShrink: 0 }}
                  onClick={() => add(product)}
                >
                  {t('add')}
                </Button>
              </Box>
            ))}
          </Box>
          {unrankedHasMore && (
            <Button
              sx={{ textTransform: 'none', alignSelf: 'center' }}
              disabled={loadingUnranked}
              // The next page of the list on screen, not of a term still being
              // typed: the debounced search replaces the list once it fires.
              onClick={() =>
                loadUnranked(searchedQuery.current, unrankedPage + 1)
              }
            >
              {t('showMore')}
            </Button>
          )}
        </>
      )}

      <Dialog
        open={pendingCategoryId != null}
        onClose={() => setPendingCategoryId(null)}
      >
        <DialogTitle>{t('listingOrderDiscardTitle')}</DialogTitle>
        <DialogContent>
          <Typography fontSize={14}>{t('listingOrderDiscardBody')}</Typography>
        </DialogContent>
        <DialogActions>
          <Button
            sx={{ textTransform: 'none' }}
            onClick={() => setPendingCategoryId(null)}
          >
            {t('cancel')}
          </Button>
          <Button
            color="error"
            sx={{ textTransform: 'none' }}
            onClick={() =>
              pendingCategoryId != null && selectCategory(pendingCategoryId)
            }
          >
            {t('discard')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
