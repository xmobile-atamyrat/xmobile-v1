import AddEditProductDialog from '@/pages/components/AddEditProductDialog';
import FilterSidebar from '@/pages/components/FilterSidebar';
import Layout from '@/pages/components/Layout';
import ProductCard from '@/pages/components/ProductCard';
import SimpleBreadcrumbs from '@/pages/components/SimpleBreadcrumbs';
import SortDropdown from '@/pages/components/SortDropdown';
import { fetchProducts } from '@/pages/lib/apis';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { buildCategoryPath, findCategory } from '@/pages/lib/categoryPathUtils';
import { useProductFilters } from '@/pages/lib/hooks/useProductFilters';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { usePrevProductContext } from '@/pages/lib/PrevProductContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import {
  AddEditProductProps,
  ExtendedCategory,
  SnackbarProps,
} from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { useLocale } from '@/pages/lib/hooks/useLocale';
import { parseName } from '@/pages/lib/utils';
import { appbarClasses } from '@/styles/classMaps/components/appbar';
import { productIndexPageClasses } from '@/styles/classMaps/product';
import { interClassname } from '@/styles/theme';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import {
  Alert,
  Box,
  Button,
  CardMedia,
  CircularProgress,
  Dialog,
  IconButton,
  Slide,
  Snackbar,
  Typography,
} from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import { GetStaticProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

export const getStaticProps: GetStaticProps = async () => {
  // For static export, we can't rely on context.locale (Next.js i18n)
  // Load default locale messages at build time
  // Client-side will switch locale based on cookie
  const defaultLocale = 'ru';
  let messages = {};
  try {
    messages = (await import(`../../i18n/${defaultLocale}.json`)).default;
  } catch (error) {
    console.error('Error loading messages:', error);
  }

  return {
    props: {
      messages,
      // Also load all locale messages so client can switch without page reload
      allMessages: {
        en: (await import('../../i18n/en.json')).default,
        ru: (await import('../../i18n/ru.json')).default,
        tk: (await import('../../i18n/tk.json')).default,
        ch: (await import('../../i18n/ch.json')).default,
        tr: (await import('../../i18n/tr.json')).default,
      },
    },
  };
};

const SlideTransition = React.forwardRef(function Transition(
  props: TransitionProps & { children: React.ReactElement },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

export default function Products() {
  const locale = useLocale();
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const { categories: allCategories } = useCategoryContext();
  const { products, setProducts, searchKeyword } = useProductContext();
  const { setPrevSearchKeyword, setPrevCategory, setPrevProducts } =
    usePrevProductContext();
  const [addEditProductDialog, setAddEditProductDialog] =
    useState<AddEditProductProps>({ open: false, imageUrls: [] });
  const [categoryPath, setCategoryPath] = useState<ExtendedCategory[]>([]);
  const { user } = useUserContext();
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<SnackbarProps>();
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  // local state for mobile (doesn't automatically apply filters) - trigger 'Apply Button'
  const [localFilters, setLocalFilters] = useState({
    categoryIds: [] as string[],
    brandIds: [] as string[],
    minPrice: '',
    maxPrice: '',
    sortBy: '',
  });
  const t = useTranslations();
  const router = useRouter();
  const platform = usePlatform();

  const { filters, setFilters } = useProductFilters();

  useEffect(() => {
    if (mobileFilterOpen) {
      setLocalFilters({
        categoryIds: filters.categoryIds,
        brandIds: filters.brandIds,
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
        sortBy: filters.sortBy,
      });
    }
  }, [mobileFilterOpen, filters]);

  // Landing Mode: user navigated from header (single category, possibly subcategory)
  // Filter Mode: user selected categories from sidebar (root categories only)
  const isLandingMode =
    router.isReady && !!router.query.categoryId && !router.query.categoryIds;

  // Hide category section in Landing Mode since user already chose their category
  const hideSections = useMemo<('categories' | 'brands')[]>(
    () => (isLandingMode ? ['categories'] : []),
    [isLandingMode],
  );

  // Fallback from filter state to URL param for fetching
  const effectiveCategoryIds = useMemo(() => {
    if (filters.categoryIds.length > 0) {
      return filters.categoryIds;
    }

    if (router.query.categoryIds) {
      return Array.isArray(router.query.categoryIds)
        ? router.query.categoryIds
        : [router.query.categoryIds];
    }
    // // Fallback/Legacy Landing Mode
    if (router.query.categoryId) {
      return [router.query.categoryId as string];
    }
    return [];
  }, [filters.categoryIds, router.query.categoryId]);

  // For breadcrumbs/title: use single selected category or Landing category
  const primaryCategoryId =
    filters.categoryIds.length === 1
      ? filters.categoryIds[0]
      : (router.query.categoryId as string | undefined);
  const category = findCategory(allCategories, primaryCategoryId);

  useEffect(() => {
    if (!primaryCategoryId || !allCategories || allCategories.length === 0) {
      setCategoryPath([]);
      return;
    }

    const path = buildCategoryPath(primaryCategoryId, allCategories);
    setCategoryPath(path);
  }, [primaryCategoryId, allCategories]);

  useEffect(() => {
    setProducts([]);
    setPage(0);
    setHasMore(true);
    setIsLoading(true);

    (async () => {
      try {
        const fetchProductsParams: any = {
          page: 1,
          categoryIds: effectiveCategoryIds,
          brandIds: filters.brandIds,
          minPrice: filters.minPrice,
          maxPrice: filters.maxPrice,
          sortBy: filters.sortBy,
        };

        if (searchKeyword) {
          fetchProductsParams.searchKeyword = searchKeyword;
        }

        const newProducts = await fetchProducts(fetchProductsParams);
        setProducts(newProducts);
        setPrevProducts(newProducts);
        // Cache for back-navigation optimization
        if (primaryCategoryId) setPrevCategory(primaryCategoryId);
        setPrevSearchKeyword(searchKeyword);
        setPage(1);

        if (newProducts.length === 0) {
          setHasMore(false);
        }
      } catch (error) {
        console.error('Failed to load products:', error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [filters, searchKeyword, router.isReady, effectiveCategoryIds]);

  const loadMoreProducts = useCallback(async () => {
    if (isLoading || !hasMore) return;
    setIsLoading(true);

    try {
      const fetchProductsParams: any = {
        page: page + 1,
        categoryIds: effectiveCategoryIds,
        brandIds: filters.brandIds,
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
        sortBy: filters.sortBy,
      };

      if (searchKeyword) {
        fetchProductsParams.searchKeyword = searchKeyword;
      }

      const newProducts = await fetchProducts(fetchProductsParams);
      setProducts((prev) => {
        const updated = [...prev, ...newProducts];
        setPrevProducts(updated);
        return updated;
      });
      setPage((prev) => prev + 1);

      if (newProducts.length === 0) {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, hasMore, page, searchKeyword, filters, effectiveCategoryIds]);

  useEffect(() => {
    const loadMoreTrigger = document.getElementById('load-more-trigger');
    if (!loadMoreTrigger) return () => undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreProducts();
        }
      },
      { rootMargin: '100px' },
    );

    observer.observe(loadMoreTrigger);

    return () => {
      observer.disconnect();
    };
  }, [loadMoreProducts]);

  const handleBackButton = () => {
    if (categoryPath.length > 1) {
      const parentCategory = categoryPath[categoryPath.length - 2];
      router.push(`/category/${parentCategory.id}`);
    } else {
      router.push('/');
    }
  };

  // Don't render if not ready
  if (!router.isReady) return null;

  return (
    <Box>
      <Box className={productIndexPageClasses.boxes.appbar[platform]}>
        {/* Left side: Back button + Title */}
        <Box className="flex items-center gap-2">
          <IconButton
            size="medium"
            edge="start"
            color="inherit"
            className={appbarClasses.backButton[platform]}
            aria-label="open drawer"
            onClick={handleBackButton}
          >
            <ArrowBackIosIcon
              className={appbarClasses.arrowBackIos[platform]}
            />
          </IconButton>
        </Box>

        <Box className={productIndexPageClasses.boxes.category[platform]}>
          {category && (
            <Typography
              className={`${interClassname.className} ${productIndexPageClasses.categoryName[platform]}`}
            >
              {parseName(category?.name, locale)}
            </Typography>
          )}
        </Box>
        <Box className="w-1/6 flex justify-start invisible"></Box>

        {platform === 'mobile' && (
          <IconButton onClick={() => setMobileFilterOpen(true)}>
            <CardMedia
              component="img"
              src="/filter.svg"
              sx={{ width: 30, height: 30 }}
            />
          </IconButton>
        )}
      </Box>
      <Layout showSearch handleHeaderBackButton={handleBackButton}>
        <Dialog
          fullScreen
          open={mobileFilterOpen}
          onClose={() => setMobileFilterOpen(false)}
          TransitionComponent={SlideTransition}
        >
          <Box className="flex flex-col h-full bg-white">
            <Box className="flex items-center justify-between p-4 border-b">
              <IconButton onClick={() => setMobileFilterOpen(false)}>
                <ArrowBackIosIcon />
              </IconButton>
              <Typography variant="h6" fontWeight={600}>
                {t('filter') || 'Filter'}
              </Typography>
              <Box sx={{ width: 40 }} />
            </Box>
            <Box className="flex-1 overflow-auto p-4">
              <FilterSidebar
                variant="mobile"
                categories={allCategories}
                selectedCategoryIds={localFilters.categoryIds}
                selectedBrandIds={localFilters.brandIds}
                minPrice={localFilters.minPrice}
                maxPrice={localFilters.maxPrice}
                sortBy={localFilters.sortBy}
                onFilterChange={(newFilters) => {
                  setLocalFilters((prev) => ({ ...prev, ...newFilters }));
                }}
                hideSections={hideSections}
              />
            </Box>
            <Box sx={{ p: 2, borderTop: '1px solid #f5f5f5' }}>
              <Button
                fullWidth
                variant="contained"
                onClick={() => {
                  setFilters(localFilters);
                  setMobileFilterOpen(false);
                }}
                sx={{
                  bgcolor: '#191919',
                  borderRadius: 2,
                  py: 1.5,
                  fontSize: '16px',
                  fontWeight: 600,
                  textTransform: 'none',
                  '&:hover': { bgcolor: '#000' },
                }}
              >
                {t('apply') || 'Apply'}
              </Button>
            </Box>
          </Box>
        </Dialog>
        <Box className={productIndexPageClasses.boxes.products[platform]}>
          {isLandingMode && categoryPath.length > 0 && (
            <SimpleBreadcrumbs categoryPath={categoryPath} />
          )}

          <Box className="flex flex-row gap-6 w-full">
            {platform === 'web' && (
              <FilterSidebar
                categories={allCategories}
                selectedCategoryIds={filters.categoryIds}
                selectedBrandIds={filters.brandIds}
                minPrice={filters.minPrice}
                maxPrice={filters.maxPrice}
                onFilterChange={(newFilters) => {
                  setFilters(newFilters);
                }}
                hideSections={hideSections}
              />
            )}

            <Box className="flex flex-col w-full">
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                mb={2}
                sx={{
                  position: platform === 'web' ? 'sticky' : 'static',
                  top: platform === 'web' ? '0px' : 'auto',
                  zIndex: 10,
                  backgroundColor: '#fff',
                  paddingTop: '20px',
                  paddingBottom: '8px',
                }}
              >
                {platform === 'web' && (
                  <Box sx={{ marginLeft: 'auto' }}>
                    <SortDropdown
                      value={filters.sortBy}
                      onChange={(val) => setFilters({ sortBy: val })}
                    />
                  </Box>
                )}
              </Box>
              <Box className="flex flex-wrap w-full">
                {['SUPERUSER', 'ADMIN'].includes(user?.grade || '') && (
                  <ProductCard
                    handleClickAddProduct={() =>
                      setAddEditProductDialog({
                        open: true,
                        dialogType: 'add',
                        imageUrls: [],
                      })
                    }
                  />
                )}
                {products.length > 0 &&
                  products.map((product, idx) => (
                    <ProductCard
                      product={product}
                      key={idx}
                      cartProps={{ cartAction: 'add' }}
                    />
                  ))}
              </Box>
              <div id="load-more-trigger"></div>
              {isLoading && (
                <Box className="w-full flex justify-center">
                  <CircularProgress />
                </Box>
              )}
            </Box>
          </Box>
        </Box>

        {addEditProductDialog.open && (
          <AddEditProductDialog
            args={addEditProductDialog}
            handleClose={() =>
              setAddEditProductDialog({
                open: false,
                id: undefined,
                description: undefined,
                dialogType: undefined,
                imageUrls: [],
                name: undefined,
              })
            }
            snackbarErrorHandler={(message) => {
              setSnackbarOpen(true);
              setSnackbarMessage({ message, severity: 'error' });
            }}
          />
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
      </Layout>
    </Box>
  );
}
