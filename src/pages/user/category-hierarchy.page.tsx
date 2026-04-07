import Layout from '@/pages/components/Layout';
import { appBarHeight } from '@/pages/lib/constants';
import { fetchWithoutCreds, useFetchWithCreds } from '@/pages/lib/fetch';
import { usePlatform } from '@/pages/lib/PlatformContext';
import {
  POPULAR_CATEGORIES_SECTION_MAX,
  POPULAR_ROOT_LIMIT_CODE,
} from '@/pages/lib/popularCategoriesLayout';
import { ExtendedCategory, ResponseApi } from '@/pages/lib/types';
import { parseName } from '@/pages/lib/utils';
import { useUserContext } from '@/pages/lib/UserContext';
import { categoryIdClasses } from '@/styles/classMaps/category/id';
import { appbarClasses } from '@/styles/classMaps/components/appbar';
import { homePageClasses } from '@/styles/classMaps';
import { colors, interClassname } from '@/styles/theme';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { GetStaticProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

export const getStaticProps = (async (context) => {
  return {
    props: {
      messages: (await import(`../../i18n/${context.locale}.json`)).default,
    },
  };
}) satisfies GetStaticProps<object>;

const ROOT_VALUE = '__root__';

function collectSubtreeIds(category: ExtendedCategory): Set<string> {
  const ids = new Set<string>([category.id]);
  (category.successorCategories ?? []).forEach((sub) => {
    collectSubtreeIds(sub).forEach((id) => {
      ids.add(id);
    });
  });
  return ids;
}

function flattenForParentSelect(
  cats: ExtendedCategory[],
  locale: string,
  excludeIds: Set<string>,
  depth = 0,
  out: { id: string; label: string }[] = [],
): { id: string; label: string }[] {
  cats.forEach((c) => {
    if (excludeIds.has(c.id)) {
      return;
    }
    const prefix = depth > 0 ? `${'\u2014 '.repeat(depth)}` : '';
    out.push({
      id: c.id,
      label: `${prefix}${parseName(c.name, locale)}`,
    });
    flattenForParentSelect(
      c.successorCategories ?? [],
      locale,
      excludeIds,
      depth + 1,
      out,
    );
  });
  return out;
}

interface CategoryTreeRowProps {
  category: ExtendedCategory;
  locale: string;
  depth: number;
  siblingIndex: number;
  siblingCount: number;
  busy: boolean;
  onMove: (categoryId: string, direction: 'up' | 'down') => void;
  onOpenParentDialog: (category: ExtendedCategory) => void;
  onTogglePopular: (categoryId: string, popular: boolean) => void;
  canSetPopular: boolean;
}

function CategoryTreeRow({
  category,
  locale,
  depth,
  siblingIndex,
  siblingCount,
  busy,
  onMove,
  onOpenParentDialog,
  onTogglePopular,
  canSetPopular,
}: CategoryTreeRowProps) {
  const t = useTranslations();
  const title = parseName(category.name, locale);
  const subs = category.successorCategories ?? [];
  const canUp = siblingIndex > 0;
  const canDown = siblingIndex < siblingCount - 1;
  const isPopular = category.popular === true;

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          pl: depth * 2,
          py: 0.75,
          pr: 0.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography
          className={interClassname.className}
          sx={{ flex: 1, minWidth: 0, fontWeight: depth === 0 ? 600 : 400 }}
          fontSize={15}
        >
          {title}
        </Typography>
        {depth === 0 && (
          <Tooltip
            title={
              canSetPopular
                ? t('categoryPopular')
                : t('categoryPopularLimitTooltip')
            }
          >
            <span>
              <IconButton
                size="small"
                disabled={busy || !canSetPopular}
                onClick={() => onTogglePopular(category.id, !isPopular)}
                aria-label={t('categoryPopular')}
                aria-pressed={isPopular}
                sx={{
                  color: isPopular ? colors.main : 'text.secondary',
                }}
              >
                {isPopular ? (
                  <StarIcon fontSize="small" />
                ) : (
                  <StarBorderIcon fontSize="small" />
                )}
              </IconButton>
            </span>
          </Tooltip>
        )}
        <Tooltip title={t('moveCategoryUp')}>
          <span>
            <IconButton
              size="small"
              disabled={busy || !canUp}
              onClick={() => onMove(category.id, 'up')}
              aria-label={t('moveCategoryUp')}
            >
              <KeyboardArrowUpIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={t('moveCategoryDown')}>
          <span>
            <IconButton
              size="small"
              disabled={busy || !canDown}
              onClick={() => onMove(category.id, 'down')}
              aria-label={t('moveCategoryDown')}
            >
              <KeyboardArrowDownIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={t('changeCategoryParent')}>
          <span>
            <IconButton
              size="small"
              disabled={busy}
              onClick={() => onOpenParentDialog(category)}
              aria-label={t('changeCategoryParent')}
            >
              <DriveFileMoveIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
      {subs.map((child, i, arr) => (
        <CategoryTreeRow
          key={child.id}
          category={child}
          locale={locale}
          depth={depth + 1}
          siblingIndex={i}
          siblingCount={arr.length}
          busy={busy}
          onMove={onMove}
          onOpenParentDialog={onOpenParentDialog}
          onTogglePopular={onTogglePopular}
          canSetPopular={depth === 0 ? canSetPopular : true}
        />
      ))}
    </Box>
  );
}

export default function CategoryHierarchyPage() {
  const router = useRouter();
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const platform = usePlatform();
  const t = useTranslations();
  const handleBackToUser = useCallback(() => {
    router.push('/user');
  }, [router]);
  const locale = router.locale ?? 'ru';
  const { user, accessToken, isLoading } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();

  const [categories, setCategories] = useState<ExtendedCategory[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingTree, setLoadingTree] = useState(true);
  const [busy, setBusy] = useState(false);

  const [parentDialogCat, setParentDialogCat] =
    useState<ExtendedCategory | null>(null);
  const [parentSelectValue, setParentSelectValue] =
    useState<string>(ROOT_VALUE);

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<
    'success' | 'error' | 'warning'
  >('success');

  const showSnackbar = useCallback(
    (message: string, severity: 'success' | 'error' | 'warning') => {
      setSnackbarMessage(message);
      setSnackbarSeverity(severity);
      setSnackbarOpen(true);
    },
    [],
  );

  const loadCategories = useCallback(async (): Promise<
    ExtendedCategory[] | null
  > => {
    setLoadingTree(true);
    setLoadError(null);
    try {
      const res: ResponseApi<ExtendedCategory[]> = await fetchWithoutCreds(
        '/api/category',
        'GET',
      );
      if (res.success && res.data) {
        setCategories(res.data);
        return res.data;
      }
      setLoadError(res.message ?? t('categoryHierarchyLoadError'));
      return null;
    } catch {
      setLoadError(t('categoryHierarchyLoadError'));
      return null;
    } finally {
      setLoadingTree(false);
    }
  }, [t]);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.push('/user/sign_in_up');
      return;
    }
    if (!['ADMIN', 'SUPERUSER'].includes(user.grade)) {
      router.push('/');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user || !['ADMIN', 'SUPERUSER'].includes(user.grade)) return;
    loadCategories();
  }, [user, loadCategories]);

  const parentOptions = useMemo(() => {
    if (!parentDialogCat) return [];
    const exclude = collectSubtreeIds(parentDialogCat);
    return flattenForParentSelect(categories, locale, exclude);
  }, [parentDialogCat, categories, locale]);

  const popularRootCount = useMemo(
    () =>
      categories.filter((c) => c.predecessorId == null && c.popular === true)
        .length,
    [categories],
  );

  const openParentDialog = useCallback((cat: ExtendedCategory) => {
    setParentDialogCat(cat);
    if (cat.predecessorId == null) {
      setParentSelectValue(ROOT_VALUE);
    } else {
      setParentSelectValue(cat.predecessorId);
    }
  }, []);

  const closeParentDialog = useCallback(() => {
    setParentDialogCat(null);
  }, []);

  const runHierarchyMutation = useCallback(
    async (body: object) => {
      if (!accessToken) {
        showSnackbar(t('authError'), 'error');
        return false;
      }
      setBusy(true);
      try {
        const res = await fetchWithCreds({
          accessToken,
          path: '/api/category/hierarchy',
          method: 'POST',
          body,
        });
        if (res.success) {
          const next = await loadCategories();
          const action =
            body && typeof body === 'object' && 'action' in body
              ? (body as { action?: string }).action
              : undefined;
          const popularFlag =
            body && typeof body === 'object' && 'popular' in body
              ? (body as { popular?: boolean }).popular
              : undefined;
          if (next && action === 'setPopular' && popularFlag === true) {
            const n = next.filter(
              (c) => c.predecessorId == null && c.popular === true,
            ).length;
            if (n >= POPULAR_CATEGORIES_SECTION_MAX) {
              showSnackbar(
                t('categoryHierarchyUpdateSuccessPopularFull'),
                'success',
              );
              return true;
            }
          }
          showSnackbar(t('categoryHierarchyUpdateSuccess'), 'success');
          return true;
        }
        if (res.message === POPULAR_ROOT_LIMIT_CODE) {
          showSnackbar(t('categoryHierarchyPopularLimitReached'), 'warning');
          return false;
        }
        showSnackbar(res.message ?? t('categoryHierarchyUpdateError'), 'error');
        return false;
      } catch {
        showSnackbar(t('categoryHierarchyUpdateError'), 'error');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [accessToken, fetchWithCreds, loadCategories, showSnackbar, t],
  );

  const handleMove = useCallback(
    (categoryId: string, direction: 'up' | 'down') => {
      runHierarchyMutation({
        action: 'reorderSibling',
        categoryId,
        direction,
      }).catch(() => {});
    },
    [runHierarchyMutation],
  );

  const handleTogglePopular = useCallback(
    (categoryId: string, popular: boolean) => {
      runHierarchyMutation({
        action: 'setPopular',
        categoryId,
        popular,
      }).catch(() => {});
    },
    [runHierarchyMutation],
  );

  const handleApplyParent = useCallback(async () => {
    if (!parentDialogCat) return;
    const newPredecessorId =
      parentSelectValue === ROOT_VALUE ? null : parentSelectValue;
    const ok = await runHierarchyMutation({
      action: 'setParent',
      categoryId: parentDialogCat.id,
      newPredecessorId,
    });
    if (ok) closeParentDialog();
  }, [
    parentDialogCat,
    parentSelectValue,
    runHierarchyMutation,
    closeParentDialog,
  ]);

  if (isLoading) {
    return (
      <Layout handleHeaderBackButton={handleBackToUser}>
        <Box className={categoryIdClasses.boxes.main[platform]}>
          <Box className={categoryIdClasses.boxes.header[platform]}>
            <IconButton
              size="medium"
              edge="start"
              color="inherit"
              className={appbarClasses.backButton[platform]}
              aria-label="open drawer"
              onClick={handleBackToUser}
            >
              <ArrowBackIosIcon
                className={appbarClasses.arrowBackIos[platform]}
              />
            </IconButton>
            <Box className="flex w-full justify-center">
              <Typography
                className={`${interClassname.className} ${homePageClasses.categoriesText[platform]}`}
              >
                {t('categoryHierarchy')}
              </Typography>
            </Box>
          </Box>
          <Box
            sx={{
              mt: isMdUp ? `${appBarHeight}px` : 0,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: 200,
            }}
          >
            <CircularProgress />
          </Box>
        </Box>
      </Layout>
    );
  }

  if (!user || !['ADMIN', 'SUPERUSER'].includes(user.grade)) {
    return null;
  }

  let treePanel: ReactNode;
  if (loadingTree) {
    treePanel = (
      <Box className="flex justify-center py-8">
        <CircularProgress />
      </Box>
    );
  } else if (loadError) {
    treePanel = (
      <Typography color="error" className={interClassname.className}>
        {loadError}
      </Typography>
    );
  } else {
    treePanel = (
      <Box
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          overflow: 'hidden',
          bgcolor: 'background.paper',
        }}
      >
        {categories.length === 0 ? (
          <Typography
            className={interClassname.className}
            sx={{ p: 2 }}
            color="text.secondary"
          >
            {t('categoryHierarchyEmpty')}
          </Typography>
        ) : (
          categories.map((cat, i, arr) => (
            <CategoryTreeRow
              key={cat.id}
              category={cat}
              locale={locale}
              depth={0}
              siblingIndex={i}
              siblingCount={arr.length}
              busy={busy}
              onMove={handleMove}
              onOpenParentDialog={openParentDialog}
              onTogglePopular={handleTogglePopular}
              canSetPopular={
                popularRootCount < POPULAR_CATEGORIES_SECTION_MAX ||
                cat.popular === true
              }
            />
          ))
        )}
      </Box>
    );
  }

  return (
    <Layout handleHeaderBackButton={handleBackToUser}>
      <Box
        className={`${categoryIdClasses.boxes.main[platform]} flex flex-col gap-4 w-full max-w-[720px] mx-auto`}
        sx={{
          mt: isMdUp ? `${appBarHeight * 1.25}px` : undefined,
          px: isMdUp ? 4 : 2,
          pb: 4,
        }}
      >
        <Box className={categoryIdClasses.boxes.header[platform]}>
          <IconButton
            size="medium"
            edge="start"
            color="inherit"
            className={appbarClasses.backButton[platform]}
            aria-label="open drawer"
            onClick={handleBackToUser}
          >
            <ArrowBackIosIcon
              className={appbarClasses.arrowBackIos[platform]}
            />
          </IconButton>
          <Box className="flex w-full justify-center">
            <Typography
              className={`${interClassname.className} ${homePageClasses.categoriesText[platform]}`}
            >
              {t('categoryHierarchy')}
            </Typography>
          </Box>
        </Box>

        <Box className="hidden md:flex flex-row items-center gap-2">
          <AccountTreeIcon
            sx={{ fontSize: isMdUp ? 28 : 24, color: colors.main }}
          />
          <Typography
            fontWeight={700}
            fontSize={isMdUp ? 22 : 18}
            className={interClassname.className}
          >
            {t('categoryHierarchy')}
          </Typography>
        </Box>

        <Typography
          variant="body2"
          color="text.secondary"
          className={interClassname.className}
          sx={{ lineHeight: 1.5 }}
        >
          {t('categoryHierarchySubtitle')}
        </Typography>

        <Divider />

        {treePanel}
      </Box>

      <Dialog
        open={parentDialogCat != null}
        onClose={closeParentDialog}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle className={interClassname.className}>
          {t('changeCategoryParent')}
        </DialogTitle>
        <DialogContent>
          <Typography
            variant="body2"
            color="text.secondary"
            className={interClassname.className}
            sx={{ mb: 2 }}
          >
            {parentDialogCat ? parseName(parentDialogCat.name, locale) : ''}
          </Typography>
          <FormControl fullWidth size="small" sx={{ mt: 1 }}>
            <InputLabel id="category-parent-select-label">
              {t('categoryParent')}
            </InputLabel>
            <Select
              labelId="category-parent-select-label"
              label={t('categoryParent')}
              value={parentSelectValue}
              onChange={(e) => setParentSelectValue(e.target.value as string)}
            >
              <MenuItem value={ROOT_VALUE}>{t('categoryParentRoot')}</MenuItem>
              {parentOptions.map((opt) => (
                <MenuItem key={opt.id} value={opt.id}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeParentDialog} color="inherit">
            {t('cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              handleApplyParent().catch(() => {});
            }}
            disabled={busy}
            sx={{
              bgcolor: colors.main,
              '&:hover': { bgcolor: colors.buttonHoverBg },
            }}
          >
            {t('save')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={5000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbarSeverity}
          onClose={() => setSnackbarOpen(false)}
          className={interClassname.className}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Layout>
  );
}
