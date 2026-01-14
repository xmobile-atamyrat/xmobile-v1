import { SearchBar } from '@/pages/components/Appbar';
import FilterSidebar from '@/pages/components/FilterSidebar';
import Layout from '@/pages/components/Layout';
import NotificationBadge from '@/pages/components/NotificationBadge';
import NotificationMenu from '@/pages/components/NotificationMenu';
import ProductCard from '@/pages/components/ProductCard';
import SortDropdown from '@/pages/components/SortDropdown';
import { fetchProducts } from '@/pages/lib/apis';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { useProductFilters } from '@/pages/lib/hooks/useProductFilters';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { homePageClasses } from '@/styles/classMaps';
import { interClassname } from '@/styles/theme';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import {
  Box,
  Button,
  CardMedia,
  CircularProgress,
  Dialog,
  IconButton,
  Slide,
  Typography,
} from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import { Product } from '@prisma/client';
import { GetStaticProps } from 'next';
import { useTranslations } from 'next-intl';
import React, { useEffect, useState } from 'react';

const SlideTransition = React.forwardRef(function Transition(
  props: TransitionProps & { children: React.ReactElement },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

export const getStaticProps: GetStaticProps = async (context) => {
  let messages = {};
  try {
    messages = (await import(`../i18n/${context.locale}.json`)).default;
  } catch (error) {
    console.error('Error loading messages:', error);
  }

  return {
    props: {
      messages,
    },
  };
};

export default function Home() {
  const platform = usePlatform();
  const t = useTranslations();
  const { user } = useUserContext();
  const { categories } = useCategoryContext();
  const { searchKeyword, setSearchKeyword } = useProductContext();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const [localFilters, setLocalFilters] = useState({
    categoryIds: [] as string[],
    brandIds: [] as string[],
    minPrice: '',
    maxPrice: '',
    sortBy: '',
  });

  const { filters, setFilters } = useProductFilters();
  const [notificationAnchorEl, setNotificationAnchorEl] =
    useState<null | HTMLElement>(null);

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

  useEffect(() => {
    let mounted = true;
    (async () => {
      setIsLoading(true);
      try {
        const fetched = await fetchProducts({
          page,
          searchKeyword: searchKeyword || undefined,
          categoryIds: filters.categoryIds,
          brandIds: filters.brandIds,
          minPrice: filters.minPrice,
          maxPrice: filters.maxPrice,
          sortBy: filters.sortBy,
        });
        if (!mounted) return;

        if (fetched.length < 20) {
          setHasMore(false);
        } else {
          setHasMore(true);
        }

        if (page === 1) {
          setProducts(fetched);
        } else {
          setProducts((prev) => [...prev, ...fetched]);
        }
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [searchKeyword, filters, page]);

  useEffect(() => {
    const loadMoreTrigger = document.getElementById('load-more-products');
    if (!loadMoreTrigger) return () => undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (async () => {
              if (isLoading || !hasMore) return;
              setPage((prev) => prev + 1);
            })();
          }
        });
      },
      { rootMargin: '100px' },
    );

    observer.observe(loadMoreTrigger);
    return () => {
      observer.disconnect();
    };
  }, [isLoading, hasMore]);

  return (
    <Layout>
      <Box className={homePageClasses.newProductsMobileAppbar[platform]}>
        <Box className={homePageClasses.topLayer}>
          <CardMedia
            component="img"
            src="/xmobile-processed-logo.png"
            className="w-auto h-[40px]"
          />
          {user && (
            <Box className="w-[18px] h-[18px] rounded-full bg-[#f5f5f5] justify-center items-center flex mr-6">
              <NotificationBadge
                onClick={(e: React.MouseEvent<HTMLElement>) =>
                  setNotificationAnchorEl(e.currentTarget)
                }
              />
              <NotificationMenu
                anchorEl={notificationAnchorEl}
                open={Boolean(notificationAnchorEl)}
                onClose={() => setNotificationAnchorEl(null)}
              />
            </Box>
          )}
        </Box>
        {SearchBar({
          searchKeyword,
          searchPlaceholder: t('search'),
          setSearchKeyword,
          width: '100%',
        })}
      </Box>
      <Box className="flex flex-row gap-6 w-full">
        {platform === 'web' && (
          <FilterSidebar
            categories={categories}
            selectedCategoryIds={filters.categoryIds}
            selectedBrandIds={filters.brandIds}
            minPrice={filters.minPrice}
            maxPrice={filters.maxPrice}
            onFilterChange={(newFilters) => {
              setFilters(newFilters);
              setPage(1);
              setProducts([]);
            }}
          />
        )}

        <Box className={homePageClasses.main[platform]}>
          <Box className="w-full">
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
              {!searchKeyword && (
                <Typography
                  className={`${interClassname.className} ${homePageClasses.newProductsTitle[platform]}`}
                >
                  {t('newProducts')}
                </Typography>
              )}
              {platform === 'web' && (
                <SortDropdown
                  value={filters.sortBy}
                  onChange={(val) => {
                    setFilters({ sortBy: val });
                    setPage(1);
                    setProducts([]);
                  }}
                />
              )}
              {platform === 'mobile' && (
                <IconButton
                  onClick={() => setMobileFilterOpen(true)}
                  sx={{ ml: 'auto' }}
                >
                  <CardMedia
                    component="img"
                    src="/filter.svg"
                    sx={{ width: 30, height: 30 }}
                  />
                </IconButton>
              )}
            </Box>

            {isLoading && page === 1 && (
              <Box className="flex justify-center items-center h-64">
                <CircularProgress />
              </Box>
            )}
            <Box className={homePageClasses.newProductsBox[platform]}>
              {products.length > 0 &&
                products.map((product, idx) => (
                  <ProductCard
                    product={product}
                    key={idx}
                    cartProps={{ cartAction: 'add' }}
                  />
                ))}
            </Box>
            {products.length === 0 && !isLoading && (
              <Typography>{t('noProductsFound')}</Typography>
            )}
            {isLoading && page > 1 && (
              <Box className="flex justify-center items-center py-4">
                <CircularProgress />
              </Box>
            )}
          </Box>
        </Box>
      </Box>
      <div id="load-more-products" />
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
              categories={categories}
              selectedCategoryIds={localFilters.categoryIds}
              selectedBrandIds={localFilters.brandIds}
              minPrice={localFilters.minPrice}
              maxPrice={localFilters.maxPrice}
              sortBy={localFilters.sortBy}
              onFilterChange={(newFilters) => {
                setLocalFilters((prev) => ({ ...prev, ...newFilters }));
              }}
            />
          </Box>
          <Box sx={{ p: 2, borderTop: '1px solid #f5f5f5' }}>
            <Button
              fullWidth
              variant="contained"
              onClick={() => {
                setFilters(localFilters);
                setPage(1);
                setProducts([]);
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
    </Layout>
  );
}
