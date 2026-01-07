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
import { parseName } from '@/pages/lib/utils';
import { appbarClasses } from '@/styles/classMaps/components/appbar';
import { productIndexPageClasses } from '@/styles/classMaps/product';
import { interClassname } from '@/styles/theme';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import {
  Alert,
  Box,
  CircularProgress,
  IconButton,
  Snackbar,
  Typography,
} from '@mui/material';
import { GetServerSideProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useState } from 'react';

export const getServerSideProps: GetServerSideProps = async (context) => {
  return {
    props: {
      messages: (await import(`../../i18n/${context.locale}.json`)).default,
    },
  };
};

export default function Products() {
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
  const t = useTranslations();
  const router = useRouter();
  const platform = usePlatform();

  const { filters, setFilters } = useProductFilters();

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
  }, [filters, searchKeyword, router.isReady]);

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
        <Box className="flex w-1/6 justify-start">
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
              {parseName(category?.name, router.locale ?? 'ru')}
            </Typography>
          )}
        </Box>
        <Box className="w-1/6 flex justify-start invisible"></Box>
      </Box>
      <Layout showSearch handleHeaderBackButton={handleBackButton}>
        <Box className={productIndexPageClasses.boxes.products[platform]}>
          {isLandingMode && categoryPath.length > 0 && (
            <SimpleBreadcrumbs categoryPath={categoryPath} />
          )}

          <Box className="flex flex-row gap-6 w-full">
            {platform === 'web' && (
              <Box sx={{ minWidth: 250, display: { xs: 'none', md: 'block' } }}>
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
              </Box>
            )}

            <Box className="flex flex-col w-full">
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                mb={2}
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
