import AddEditProductDialog from '@/pages/components/AddEditProductDialog';
import { ProductGridSkeleton } from '@/pages/components/SkeletonLoader';
import FilterSidebar from '@/pages/components/FilterSidebar';
import Layout from '@/pages/components/Layout';
import ProductCard from '@/pages/components/ProductCard';
import SimpleBreadcrumbs from '@/pages/components/SimpleBreadcrumbs';
import SortDropdown from '@/pages/components/SortDropdown';
import {
  fetchBrands,
  fetchColors,
  fetchProducts,
  fetchProductsCount,
} from '@/pages/lib/apis';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { FILTER_MAX_PRICE, PRODUCTS_PER_PAGE } from '@/pages/lib/constants';
import { useProductFilters } from '@/pages/lib/hooks/useProductFilters';
import {
  buildPaginationItems,
  getTotalPages,
  PAGINATION_ELLIPSIS,
} from '@/pages/lib/pagination';
import { SearchBar } from '@/pages/components/Appbar';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { usePrevProductContext } from '@/pages/lib/PrevProductContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import {
  AddEditProductProps,
  BrandProps,
  ExtendedCategory,
  SnackbarProps,
} from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { parseName } from '@/pages/lib/utils';
import { appbarClasses } from '@/styles/classMaps/components/appbar';
import { filterSidebarClasses } from '@/styles/classMaps/components/filterSidebar';
import { productIndexPageClasses } from '@/styles/classMaps/product';
import { fontClassName } from '@/styles/theme';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  IconButton,
  Slide,
  Snackbar,
  Typography,
} from '@mui/material';
import { ArrowLeft, ChevronLeft, ChevronRight, SearchX, X } from 'lucide-react';
import { Color } from '@prisma/client';
import { TransitionProps } from '@mui/material/transitions';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const SlideTransition = React.forwardRef(function Transition(
  props: TransitionProps & { children: React.ReactElement },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

interface ProductGridContentProps {
  landingCategoryId?: string;
  category?: ExtendedCategory | null;
  categoryPath?: ExtendedCategory[];
}

export default function ProductGridContent({
  landingCategoryId,
  category,
  categoryPath = [],
}: ProductGridContentProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const { categories: allCategories } = useCategoryContext();
  const { products, setProducts, searchKeyword, setSearchKeyword } =
    useProductContext();
  // Editable search field on the results page. Debounced into the shared
  // context so the grid refetches without a network call per keystroke.
  const [localSearchKeyword, setLocalSearchKeyword] = useState(
    searchKeyword ?? '',
  );
  const isFirstSearchRun = useRef(true);
  // Total number of products matching the current query (all pages), so the
  // header count reflects the real total rather than the loaded page.
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const { setPrevSearchKeyword, setPrevCategory, setPrevProducts } =
    usePrevProductContext();
  const [addEditProductDialog, setAddEditProductDialog] =
    useState<AddEditProductProps>({ open: false, imageUrls: [] });
  const { user } = useUserContext();
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<SnackbarProps>();
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  // Web paginates (spec 1473); mobile keeps the infinite-scroll list.
  const [webPage, setWebPage] = useState(1);
  // Reference lists, only for labelling the active-filter chips in the sort bar.
  const [brands, setBrands] = useState<BrandProps[]>([]);
  const [colors, setColors] = useState<Color[]>([]);

  // local state for mobile (doesn't automatically apply filters) - trigger 'Apply Button'
  const [localFilters, setLocalFilters] = useState({
    categoryIds: [] as string[],
    brandIds: [] as string[],
    colorIds: [] as string[],
    minPrice: '',
    maxPrice: '',
    sortBy: '',
  });

  const t = useTranslations();
  const router = useRouter();
  const platform = usePlatform();

  const { filters, setFilters } = useProductFilters();

  // Any filter/sort change invalidates the current page. Resetting in the same
  // batch as setFilters keeps it to one refetch (a reset-on-change effect would
  // fire twice: once for the stale page, once for page 1).
  const applyFilters = useCallback(
    (newFilters: Parameters<typeof setFilters>[0]) => {
      setWebPage(1);
      setFilters(newFilters);
    },
    // setFilters is re-created each render by useProductFilters; the closure
    // only ever calls the latest one via this component's render scope.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Put the reader back at the top of the results after a page change. This
  // has to run post-commit: scrolling inside the click handler gets undone
  // when React re-renders the pagination row, because the browser scrolls the
  // still-focused page button back into view.
  const isFirstPageRun = useRef(true);
  useEffect(() => {
    if (isFirstPageRun.current) {
      isFirstPageRun.current = false;
      return;
    }
    if (platform !== 'web') return;
    window.scrollTo(0, 0);
  }, [webPage, platform]);

  // Chip labels need the brand/colour names the sidebar already fetches.
  // Web-only: the mobile sheet has no active-chip row.
  useEffect(() => {
    if (platform !== 'web') return;
    fetchBrands()
      .then(setBrands)
      .catch(() => setBrands([]));
    fetchColors()
      .then(setColors)
      .catch(() => setColors([]));
  }, [platform]);

  // Debounce the editable search field into context (skip the mount run so we
  // don't clobber a keyword handed off from the home page).
  useEffect(() => {
    if (isFirstSearchRun.current) {
      isFirstSearchRun.current = false;
      return undefined;
    }
    const handler = setTimeout(() => {
      setWebPage(1);
      setSearchKeyword(localSearchKeyword);
    }, 500);
    return () => clearTimeout(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSearchKeyword]);

  useEffect(() => {
    if (mobileFilterOpen) {
      setLocalFilters({
        categoryIds: filters.categoryIds,
        brandIds: filters.brandIds,
        colorIds: filters.colorIds,
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
        sortBy: filters.sortBy,
      });
    }
  }, [mobileFilterOpen, filters]);

  // Landing Mode: user navigated to a specific category endpoint
  // Filter Mode: user selected categories from sidebar (root categories only)
  const isLandingMode = !!landingCategoryId;

  // Hide category section in Landing Mode since user already chose their category
  const hideSections = useMemo<('categories' | 'brands')[]>(
    () => (isLandingMode ? ['categories'] : []),
    [isLandingMode],
  );

  // Fallback from filter state to explicit prop or URL param for fetching
  const effectiveCategoryIds = useMemo(() => {
    if (filters.categoryIds.length > 0) {
      return filters.categoryIds;
    }
    if (landingCategoryId) {
      return [landingCategoryId];
    }
    // Generic fallback for /product global page
    if (router.query.categoryIds) {
      return Array.isArray(router.query.categoryIds)
        ? router.query.categoryIds
        : [router.query.categoryIds];
    }
    if (router.query.categoryId) {
      return [router.query.categoryId as string];
    }
    return [];
  }, [
    filters.categoryIds,
    router.query.categoryIds,
    router.query.categoryId,
    landingCategoryId,
  ]);

  useEffect(() => {
    setProducts([]);
    setPage(0);
    setHasMore(true);
    setIsLoading(true);
    setTotalCount(null);

    // Web jumps straight to the requested page; mobile always restarts at 1
    // and appends via loadMoreProducts.
    const requestedPage = platform === 'web' ? webPage : 1;

    (async () => {
      try {
        const fetchProductsParams: any = {
          page: requestedPage,
          categoryIds: effectiveCategoryIds,
          brandIds: filters.brandIds,
          colorIds: filters.colorIds,
          minPrice: filters.minPrice,
          maxPrice: filters.maxPrice,
          sortBy: filters.sortBy,
        };

        if (searchKeyword) {
          fetchProductsParams.searchKeyword = searchKeyword;
        }

        // Total match count for the header (independent of pagination).
        fetchProductsCount(fetchProductsParams)
          .then(setTotalCount)
          .catch(() => setTotalCount(null));

        const newProducts = await fetchProducts(fetchProductsParams);
        setProducts(newProducts);
        setPrevProducts(newProducts);
        // Cache for back-navigation optimization
        if (effectiveCategoryIds.length === 1) {
          setPrevCategory(effectiveCategoryIds[0]);
        }
        setPrevSearchKeyword(searchKeyword);
        setPage(requestedPage);

        if (newProducts.length === 0) {
          setHasMore(false);
        }
      } catch (error) {
        console.error('Failed to load products:', error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [
    filters,
    searchKeyword,
    router.isReady,
    effectiveCategoryIds,
    platform,
    webPage,
    setProducts,
    setPrevProducts,
    setPrevCategory,
    setPrevSearchKeyword,
  ]);

  const loadMoreProducts = useCallback(async () => {
    if (isLoading || !hasMore) return;
    setIsLoading(true);

    try {
      const fetchProductsParams: any = {
        page: page + 1,
        categoryIds: effectiveCategoryIds,
        brandIds: filters.brandIds,
        colorIds: filters.colorIds,
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
    // Web uses numbered pagination instead of infinite scroll.
    if (platform === 'web') return () => undefined;
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
  }, [loadMoreProducts, platform]);

  const handleBackButton = () => {
    if (categoryPath.length > 1) {
      const parentCategory = categoryPath[categoryPath.length - 2];
      router.push(`/category/${parentCategory.slug}`);
    } else {
      router.push('/');
    }
  };

  if (!router.isReady) return null;

  let titleText = t('allProducts') || 'All Products';
  if (category) {
    titleText = parseName(category.name, router.locale ?? 'ru');
  } else if (searchKeyword) {
    titleText = t('searchResultsFor', { keyword: searchKeyword });
  }

  // Real total for the current query (all pages); fall back to the loaded
  // count until the count request resolves.
  const displayCount = totalCount != null ? totalCount : products.length;

  // --- Active filter chips (spec 1457) ---------------------------------
  // Every chip is a real selected filter; there is no fabricated state here.
  const categoryById = new Map<string, ExtendedCategory>();
  const collectCategories = (cats: ExtendedCategory[]) => {
    cats.forEach((cat) => {
      categoryById.set(cat.id, cat);
      if (cat.successorCategories?.length) {
        collectCategories(cat.successorCategories);
      }
    });
  };
  collectCategories(allCategories ?? []);

  const activeChips: { key: string; label: string; onRemove: () => void }[] =
    [];

  filters.categoryIds.forEach((id) => {
    const cat = categoryById.get(id);
    if (!cat) return;
    activeChips.push({
      key: `category-${id}`,
      label: parseName(cat.name, router.locale ?? 'ru'),
      onRemove: () =>
        applyFilters({
          categoryIds: filters.categoryIds.filter((cid) => cid !== id),
        }),
    });
  });

  filters.brandIds.forEach((id) => {
    const brand = brands.find((b) => b.id === id);
    if (!brand) return;
    activeChips.push({
      key: `brand-${id}`,
      label: brand.name,
      onRemove: () =>
        applyFilters({
          brandIds: filters.brandIds.filter((bid) => bid !== id),
        }),
    });
  });

  filters.colorIds.forEach((id) => {
    const color = colors.find((c) => c.id === id);
    if (!color) return;
    activeChips.push({
      key: `color-${id}`,
      label: color.name,
      onRemove: () =>
        applyFilters({
          colorIds: filters.colorIds.filter((cid) => cid !== id),
        }),
    });
  });

  if (filters.minPrice || filters.maxPrice) {
    activeChips.push({
      key: 'price',
      label: `${filters.minPrice || 0} – ${
        filters.maxPrice || FILTER_MAX_PRICE
      } TMT`,
      onRemove: () => applyFilters({ minPrice: '', maxPrice: '' }),
    });
  }

  // --- Pagination (spec 1473) ------------------------------------------
  const totalPages =
    totalCount != null ? getTotalPages(totalCount, PRODUCTS_PER_PAGE) : 0;
  const paginationItems = buildPaginationItems(webPage, totalPages);

  const goToPage = (next: number) => {
    if (next < 1 || next > totalPages || next === webPage) return;
    // Drop focus so the button can't drag the viewport back down once the
    // pagination row re-renders; the effect above does the actual scrolling.
    (document.activeElement as HTMLElement | null)?.blur();
    setWebPage(next);
  };

  return (
    <Box>
      <Box className={productIndexPageClasses.boxes.appbar[platform]}>
        {/* Back button — matches the product detail page */}
        <IconButton
          aria-label="Back"
          className={appbarClasses.backButtonCircle[platform]}
          onClick={handleBackButton}
        >
          <ArrowLeft className={appbarClasses.backIconCircle[platform]} />
        </IconButton>

        {platform === 'mobile' && (
          <Box className="flex-1">
            {SearchBar({
              searchKeyword: localSearchKeyword,
              searchPlaceholder: t('search'),
              setSearchKeyword: setLocalSearchKeyword,
              showFilter: true,
              onFilterClick: () => setMobileFilterOpen(true),
              formClassName: 'flex flex-1 items-center gap-2.5',
            })}
          </Box>
        )}
      </Box>
      <Layout handleHeaderBackButton={handleBackButton}>
        <Dialog
          open={mobileFilterOpen}
          onClose={() => setMobileFilterOpen(false)}
          TransitionComponent={SlideTransition}
          fullWidth
          PaperProps={{
            sx: {
              position: 'fixed',
              bottom: 0,
              m: 0,
              width: '100%',
              maxHeight: '88vh',
              borderRadius: '26px 26px 0 0',
            },
          }}
        >
          <Box className="flex flex-col bg-white">
            <Box className={filterSidebarClasses.dragHandle} />
            <Box className={filterSidebarClasses.header}>
              <Typography
                className={`${fontClassName.className} ${filterSidebarClasses.title}`}
              >
                {t('filter') || 'Filter'}
              </Typography>
              <Typography
                className={`${fontClassName.className} ${filterSidebarClasses.resetButton}`}
                onClick={() =>
                  setLocalFilters({
                    categoryIds: [],
                    brandIds: [],
                    colorIds: [],
                    minPrice: '',
                    maxPrice: '',
                    sortBy: '',
                  })
                }
              >
                {t('clear') || 'Clear'}
              </Typography>
            </Box>
            <Box className={filterSidebarClasses.body}>
              <FilterSidebar
                variant="mobile"
                categories={allCategories}
                selectedCategoryIds={localFilters.categoryIds}
                selectedBrandIds={localFilters.brandIds}
                selectedColorIds={localFilters.colorIds}
                minPrice={localFilters.minPrice}
                maxPrice={localFilters.maxPrice}
                sortBy={localFilters.sortBy}
                onFilterChange={(newFilters) => {
                  setLocalFilters((prev) => ({ ...prev, ...newFilters }));
                }}
                hideSections={hideSections}
              />
            </Box>
            <Box className={filterSidebarClasses.footer}>
              <Button
                disableElevation
                className={`${fontClassName.className} ${filterSidebarClasses.clearButton}`}
                onClick={() =>
                  setLocalFilters({
                    categoryIds: [],
                    brandIds: [],
                    colorIds: [],
                    minPrice: '',
                    maxPrice: '',
                    sortBy: '',
                  })
                }
              >
                {t('clear') || 'Clear'}
              </Button>
              <Button
                disableElevation
                className={`${fontClassName.className} ${filterSidebarClasses.applyButton}`}
                onClick={() => {
                  applyFilters(localFilters);
                  setMobileFilterOpen(false);
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

          {/* Title block spans the full width above the rail — spec 1439-1442 */}
          <Box className={productIndexPageClasses.header[platform]}>
            <Typography
              component={platform === 'web' ? 'h1' : 'p'}
              className={`${fontClassName.className} ${productIndexPageClasses.pageTitle[platform]}`}
            >
              {titleText}
            </Typography>
            {!isLoading && products.length > 0 && (
              <Typography
                className={`${fontClassName.className} ${productIndexPageClasses.resultsCount[platform]}`}
              >
                {`${displayCount} ${t('products')}`}
              </Typography>
            )}
          </Box>

          <Box className={productIndexPageClasses.boxes.layout[platform]}>
            {platform === 'web' && (
              <FilterSidebar
                categories={allCategories}
                selectedCategoryIds={filters.categoryIds}
                selectedBrandIds={filters.brandIds}
                selectedColorIds={filters.colorIds}
                minPrice={filters.minPrice}
                maxPrice={filters.maxPrice}
                onFilterChange={applyFilters}
                hideSections={hideSections}
                showBrandCounts={!isLandingMode}
              />
            )}

            <Box className="flex flex-col w-full min-w-0">
              {platform === 'web' && (
                <Box className={productIndexPageClasses.resultsBar.web}>
                  <Box className={productIndexPageClasses.activeFilters.wrap}>
                    {activeChips.length > 0 && (
                      <Typography
                        className={`${fontClassName.className} ${productIndexPageClasses.activeFilters.label}`}
                      >
                        {`${t('activeFilters')}:`}
                      </Typography>
                    )}
                    {activeChips.map((chip) => (
                      <Button
                        key={chip.key}
                        disableRipple
                        disableElevation
                        onClick={chip.onRemove}
                        className={`${fontClassName.className} ${productIndexPageClasses.activeFilters.chip}`}
                      >
                        <span
                          className={
                            productIndexPageClasses.activeFilters.chipLabel
                          }
                        >
                          {chip.label}
                        </span>
                        <X
                          size={13}
                          className={
                            productIndexPageClasses.activeFilters.chipIcon
                          }
                        />
                      </Button>
                    ))}
                  </Box>
                  <SortDropdown
                    value={filters.sortBy}
                    onChange={(val) => applyFilters({ sortBy: val })}
                  />
                </Box>
              )}
              {(() => {
                if (isLoading && products.length === 0) {
                  return <ProductGridSkeleton count={8} />;
                }
                const isAdmin = ['SUPERUSER', 'ADMIN'].includes(
                  user?.grade || '',
                );
                if (products.length === 0 && !isAdmin) {
                  return (
                    <Box className={productIndexPageClasses.emptyState.wrap}>
                      <Box
                        className={productIndexPageClasses.emptyState.iconWrap}
                      >
                        <SearchX size={28} color="#8B8A98" />
                      </Box>
                      <Typography
                        className={`${fontClassName.className} ${productIndexPageClasses.emptyState.title}`}
                      >
                        {t('noProductsFound')}
                      </Typography>
                      {searchKeyword && (
                        <Typography
                          className={`${fontClassName.className} ${productIndexPageClasses.emptyState.subtitle}`}
                        >
                          {t('searchResultsFor', { keyword: searchKeyword })}
                        </Typography>
                      )}
                    </Box>
                  );
                }
                return (
                  <Box
                    className={
                      productIndexPageClasses.boxes.productsGrid[platform]
                    }
                  >
                    {isAdmin && (
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
                    {products.map((product, idx) => (
                      <ProductCard
                        product={product}
                        key={idx}
                        cartProps={{ cartAction: 'add' }}
                      />
                    ))}
                  </Box>
                );
              })()}
              {platform === 'mobile' && <div id="load-more-trigger"></div>}
              {isLoading && products.length > 0 && (
                <Box className="w-full flex justify-center py-4">
                  <CircularProgress />
                </Box>
              )}

              {/* Numbered pagination, spec 1473 — web only; mobile keeps the
                  infinite-scroll list it already had. */}
              {platform === 'web' && totalPages > 1 && (
                <Box className={productIndexPageClasses.pagination.wrap}>
                  <Button
                    disableRipple
                    disableElevation
                    aria-label={t('previous')}
                    onClick={() => goToPage(webPage - 1)}
                    className={
                      webPage <= 1
                        ? productIndexPageClasses.pagination.arrowDisabled
                        : productIndexPageClasses.pagination.arrow
                    }
                  >
                    <ChevronLeft size={18} />
                  </Button>

                  {paginationItems.map((item, idx) =>
                    item === PAGINATION_ELLIPSIS ? (
                      <Box
                        // eslint-disable-next-line react/no-array-index-key
                        key={`gap-${idx}`}
                        className={productIndexPageClasses.pagination.ellipsis}
                      >
                        …
                      </Box>
                    ) : (
                      <Button
                        key={item}
                        disableRipple
                        disableElevation
                        aria-current={item === webPage ? 'page' : undefined}
                        onClick={() => goToPage(item)}
                        className={`${fontClassName.className} ${
                          item === webPage
                            ? productIndexPageClasses.pagination.pageActive
                            : productIndexPageClasses.pagination.page
                        }`}
                      >
                        {item}
                      </Button>
                    ),
                  )}

                  <Button
                    disableRipple
                    disableElevation
                    aria-label={t('next')}
                    onClick={() => goToPage(webPage + 1)}
                    className={
                      webPage >= totalPages
                        ? productIndexPageClasses.pagination.arrowDisabled
                        : productIndexPageClasses.pagination.arrow
                    }
                  >
                    <ChevronRight size={18} />
                  </Button>
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
          autoHideDuration={3000}
          disableWindowBlurListener
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
