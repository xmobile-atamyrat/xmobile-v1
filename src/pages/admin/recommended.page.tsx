import type { RecommendedProductItem } from '@/pages/api/product/recommended.page';
import { verifyToken } from '@/pages/api/utils/authMiddleware';
import { REFRESH_SECRET } from '@/pages/api/utils/tokenUtils';
import Layout from '@/pages/components/Layout';
import { fetchProducts } from '@/pages/lib/apis';
import {
  appBarHeight,
  AUTH_REFRESH_COOKIE_NAME,
  DEFAULT_LOCALE,
  mobileAppBarHeight,
  RECOMMENDED_PRODUCTS_MAX,
} from '@/pages/lib/constants';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import {
  PRODUCT_IMAGE_FALLBACK,
  productThumbnailUrl,
} from '@/pages/lib/mediaUrls';
import { useUserContext } from '@/pages/lib/UserContext';
import { parseName } from '@/pages/lib/utils';
import { colors, fontClassName } from '@/styles/theme';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import StarOutlineIcon from '@mui/icons-material/StarOutline';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  Snackbar,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { UserRole } from '@prisma/client';
import { Search } from 'lucide-react';
import { GetServerSideProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useRef, useState } from 'react';

type SnackbarSeverity = 'error' | 'warning' | 'success';

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const refreshToken = ctx.req.cookies[AUTH_REFRESH_COOKIE_NAME];
  const redirectHome = {
    redirect: { destination: `/${ctx.locale || 'ru'}/`, permanent: false },
  };
  if (!refreshToken) return redirectHome;

  try {
    const decoded = await verifyToken(refreshToken, REFRESH_SECRET);
    if (
      decoded.grade !== UserRole.ADMIN &&
      decoded.grade !== UserRole.SUPERUSER
    ) {
      return redirectHome;
    }
  } catch {
    return redirectHome;
  }

  return {
    props: {
      messages: (await import(`../../i18n/${ctx.locale}.json`)).default,
    },
  };
};

const move = <T,>(list: T[], from: number, to: number): T[] => {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

const sameOrder = (a: RecommendedProductItem[], b: RecommendedProductItem[]) =>
  a.length === b.length && a.every((item, i) => item.id === b[i].id);

const SEARCH_DEBOUNCE_MS = 300;

export default function RecommendedProductsAdminPage() {
  const router = useRouter();
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const t = useTranslations();
  const locale = router.locale ?? DEFAULT_LOCALE;
  const { user, accessToken, isLoading: isUserLoading } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();

  // `saved` mirrors the server; `items` is the admin's working copy, so Save
  // only lights up once they actually differ.
  const [saved, setSaved] = useState<RecommendedProductItem[]>([]);
  const [items, setItems] = useState<RecommendedProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RecommendedProductItem[]>([]);
  const [searching, setSearching] = useState(false);
  const searchToken = useRef(0);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarSeverity, setSnackbarSeverity] =
    useState<SnackbarSeverity>('success');
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const showSnackbar = (message: string, severity: SnackbarSeverity) => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const isAuthorized =
    user &&
    (user.grade === UserRole.ADMIN || user.grade === UserRole.SUPERUSER);
  const isDirty = !sameOrder(items, saved);
  const isFull = items.length >= RECOMMENDED_PRODUCTS_MAX;

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await fetchWithCreds<RecommendedProductItem[]>({
        accessToken,
        path: '/api/product/recommended',
        method: 'GET',
      });
      if (res.success && res.data != null) {
        setSaved(res.data);
        setItems(res.data);
      } else {
        showSnackbar(t('recommendedLoadError'), 'error');
      }
    } catch {
      showSnackbar(t('recommendedLoadError'), 'error');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, fetchWithCreds]);

  useEffect(() => {
    if (isAuthorized) load();
  }, [isAuthorized, load]);

  // Debounced, and a slower earlier response can't overwrite a newer one.
  useEffect(() => {
    const term = query.trim();
    searchToken.current += 1;
    const token = searchToken.current;
    if (term.length < 2) {
      setResults([]);
      setSearching(false);
      return undefined;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const products = await fetchProducts({ searchKeyword: term });
        if (token !== searchToken.current) return;
        setResults(
          products.map((product) => ({
            id: product.id,
            slug: product.slug,
            name: product.name,
            imgUrl: product.imgUrls[0] ?? null,
            isOutOfStock: product.outOfStockAt != null,
          })),
        );
      } catch {
        if (token === searchToken.current) setResults([]);
      } finally {
        if (token === searchToken.current) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // Leaving with unsaved changes would silently drop the new order.
  useEffect(() => {
    if (!isDirty) return undefined;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Older browsers only show the prompt when returnValue is set.
      // eslint-disable-next-line no-param-reassign
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  if (!isUserLoading && !isAuthorized) {
    router.push('/');
  }
  if (isUserLoading || !isAuthorized) {
    return null;
  }

  const pickedIds = new Set(items.map(({ id }) => id));

  const add = (product: RecommendedProductItem) => {
    if (pickedIds.has(product.id) || isFull) return;
    setItems((prev) => [...prev, product]);
  };

  const remove = (index: number) =>
    setItems((prev) => prev.filter((_, i) => i !== index));

  const reorder = (from: number, to: number) => {
    if (from === to || to < 0 || to >= items.length) return;
    setItems((prev) => move(prev, from, to));
  };

  const endDrag = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  const handleSave = async () => {
    if (!accessToken) return;
    setSaving(true);
    try {
      const res = await fetchWithCreds<RecommendedProductItem[]>({
        accessToken,
        path: '/api/product/recommended',
        method: 'PUT',
        body: { productIds: items.map(({ id }) => id) },
      });
      if (res.success && res.data != null) {
        setSaved(res.data);
        setItems(res.data);
        showSnackbar(t('recommendedSaved'), 'success');
      } else if (res.message === 'productNotFound') {
        // Someone deleted a pick meanwhile; show the list as it now stands.
        showSnackbar(t('recommendedProductGone'), 'warning');
        await load();
      } else {
        showSnackbar(t('recommendedSaveError'), 'error');
      }
    } catch {
      showSnackbar(t('recommendedSaveError'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const thumbnail = (imgUrl: string | null, size: number) => (
    <Box
      component="img"
      src={productThumbnailUrl(imgUrl) ?? PRODUCT_IMAGE_FALLBACK}
      alt=""
      draggable={false}
      loading="lazy"
      sx={{
        width: size,
        height: size,
        objectFit: 'contain',
        borderRadius: 1,
        bgcolor: 'action.hover',
        flexShrink: 0,
        pointerEvents: 'none',
      }}
    />
  );

  return (
    <Layout handleHeaderBackButton={() => router.push('/user')}>
      <Box
        sx={{
          mt: isMdUp
            ? `${appBarHeight * 1.25}px`
            : `${mobileAppBarHeight * 1.25}px`,
          px: isMdUp ? 4 : 2,
          pb: 4,
          maxWidth: 900,
        }}
        className="flex flex-col gap-5 w-full"
      >
        <Box className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <Box className="flex flex-row items-center gap-2">
            <StarOutlineIcon
              sx={{ fontSize: isMdUp ? 28 : 24, color: colors.main }}
            />
            <Typography
              fontWeight={700}
              fontSize={isMdUp ? 22 : 18}
              className={fontClassName.className}
            >
              {t('recommendedProducts')}
            </Typography>
            <Typography fontSize={13} color="text.secondary">
              {items.length}/{RECOMMENDED_PRODUCTS_MAX}
            </Typography>
          </Box>
          <Box className="flex flex-row items-center gap-2">
            {isDirty && (
              <Button
                sx={{ textTransform: 'none' }}
                disabled={saving}
                onClick={() => setItems(saved)}
              >
                {t('cancel')}
              </Button>
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
          {t('recommendedProductsHint')}
        </Typography>

        <Box className="flex flex-col gap-2">
          <TextField
            size="small"
            fullWidth
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('recommendedSearchPlaceholder')}
            disabled={isFull}
            helperText={
              isFull
                ? t('recommendedLimitReached', {
                    max: RECOMMENDED_PRODUCTS_MAX,
                  })
                : undefined
            }
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={18} />
                </InputAdornment>
              ),
              endAdornment: searching ? (
                <InputAdornment position="end">
                  <CircularProgress size={16} />
                </InputAdornment>
              ) : undefined,
            }}
          />
          {query.trim().length >= 2 && !searching && (
            <Box className="flex flex-col border border-[#eee] rounded-[10px] max-h-[320px] overflow-y-auto">
              {results.length === 0 && (
                <Typography fontSize={13} color="text.secondary" sx={{ p: 2 }}>
                  {t('noProductsFound')}
                </Typography>
              )}
              {results.map((product) => {
                const picked = pickedIds.has(product.id);
                return (
                  <Box
                    key={product.id}
                    className="flex flex-row items-center gap-3 px-3 py-2 border-b border-[#f3f3f3] last:border-b-0"
                  >
                    {thumbnail(product.imgUrl, 40)}
                    <Typography
                      fontSize={14}
                      className="flex-1 min-w-0 truncate"
                    >
                      {parseName(product.name, locale)}
                    </Typography>
                    {product.isOutOfStock && (
                      <Chip size="small" label={t('outOfStock')} />
                    )}
                    <Button
                      size="small"
                      variant={picked ? 'text' : 'outlined'}
                      disabled={picked || isFull}
                      sx={{ textTransform: 'none', flexShrink: 0 }}
                      onClick={() => add(product)}
                    >
                      {picked ? t('recommendedAdded') : t('add')}
                    </Button>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>

        <Divider />

        {loading && (
          <Box className="flex justify-center py-10">
            <CircularProgress />
          </Box>
        )}

        {!loading && items.length === 0 && (
          <Typography color="text.secondary">
            {t('recommendedEmpty')}
          </Typography>
        )}

        {!loading && items.length > 0 && (
          <Box
            className="flex flex-col gap-2"
            onDragOver={(event) => event.preventDefault()}
          >
            {items.map((item, index) => {
              const isDropTarget =
                overIndex === index && dragIndex != null && dragIndex !== index;
              return (
                <Box
                  key={item.id}
                  draggable
                  onDragStart={(event) => {
                    // eslint-disable-next-line no-param-reassign
                    event.dataTransfer.effectAllowed = 'move';
                    // Firefox won't start a drag without some payload.
                    event.dataTransfer.setData('text/plain', String(index));
                    setDragIndex(index);
                  }}
                  onDragEnter={() => setOverIndex(index)}
                  onDragEnd={endDrag}
                  onDrop={(event) => {
                    if (dragIndex == null) return;
                    event.preventDefault();
                    reorder(dragIndex, index);
                    endDrag();
                  }}
                  className="flex flex-row items-center gap-3 rounded-[10px] p-2"
                  sx={{
                    border: '2px solid',
                    borderColor: isDropTarget ? 'primary.main' : '#eee',
                    opacity: dragIndex === index ? 0.4 : 1,
                    cursor: 'grab',
                    transition: 'border-color 120ms, opacity 120ms',
                  }}
                >
                  <DragIndicatorIcon
                    fontSize="small"
                    sx={{
                      color: 'text.secondary',
                      display: { xs: 'none', sm: 'block' },
                    }}
                  />
                  <Typography
                    fontWeight={600}
                    fontSize={14}
                    sx={{ width: 24, textAlign: 'center', flexShrink: 0 }}
                  >
                    {index + 1}
                  </Typography>
                  {thumbnail(item.imgUrl, isMdUp ? 56 : 44)}
                  <Box className="flex flex-col flex-1 min-w-0">
                    <Typography fontSize={14} className="truncate">
                      {parseName(item.name, locale)}
                    </Typography>
                    {item.isOutOfStock && (
                      <Typography fontSize={12} color="warning.main">
                        {t('recommendedHiddenOutOfStock')}
                      </Typography>
                    )}
                  </Box>
                  {/* For touch screens (the WebView app) and keyboard users,
                      where native drag and drop isn't available. */}
                  <Tooltip title={t('moveUp')}>
                    <span>
                      <IconButton
                        size="small"
                        aria-label={t('moveUp')}
                        disabled={index === 0}
                        onClick={() => reorder(index, index - 1)}
                      >
                        <KeyboardArrowUpIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title={t('moveDown')}>
                    <span>
                      <IconButton
                        size="small"
                        aria-label={t('moveDown')}
                        disabled={index === items.length - 1}
                        onClick={() => reorder(index, index + 1)}
                      >
                        <KeyboardArrowDownIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title={t('remove')}>
                    <IconButton
                      size="small"
                      aria-label={t('remove')}
                      onClick={() => remove(index)}
                    >
                      <DeleteOutlinedIcon fontSize="small" color="error" />
                    </IconButton>
                  </Tooltip>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={snackbarSeverity}
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Layout>
  );
}
