import AddEditProductDialog from '@/pages/components/AddEditProductDialog';
import Layout from '@/pages/components/Layout';
import ProductCard from '@/pages/components/ProductCard';
import SimpleBreadcrumbs from '@/pages/components/SimpleBreadcrumbs';
import { fetchProducts } from '@/pages/lib/apis';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { buildCategoryPath, findCategory } from '@/pages/lib/categoryPathUtils';
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
import { Product } from '@prisma/client';
import { GetServerSideProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';

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
  const {
    prevPage,
    prevCategory,
    prevProducts,
    prevSearchKeyword,
    setPrevSearchKeyword,
    setPrevCategory,
    setPrevProducts,
    setPrevPage,
  } = usePrevProductContext();
  const [addEditProductDialog, setAddEditProductDialog] =
    useState<AddEditProductProps>({ open: false, imageUrls: [] });
  const [categoryPath, setCategoryPath] = useState<ExtendedCategory[]>([]);
  const { user } = useUserContext();
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<SnackbarProps>();
  const t = useTranslations();
  const router = useRouter();
  const platform = usePlatform();

  // Get categoryId from URL query params
  const categoryId = router.query.categoryId as string | undefined;
  const category = findCategory(allCategories, categoryId);

  // Build category path when categoryId is available
  useEffect(() => {
    if (!categoryId || !allCategories || allCategories.length === 0) {
      setCategoryPath([]);
      return;
    }

    const path = buildCategoryPath(categoryId, allCategories);
    setCategoryPath(path);
  }, [categoryId, allCategories]);

  useEffect(() => {
    // Redirect to home if no categoryId in URL
    if (!categoryId) {
      router.replace('/');
      return;
    }

    // Reset state when categoryId changes
    setProducts([]);
    setPage(0);
    setHasMore(true);
    setIsLoading(true);

    // Load first page of products
    (async () => {
      try {
        const fetchProductsParams: any = { page: 1 };
        fetchProductsParams.categoryIds = [categoryId];
        if (searchKeyword) {
          fetchProductsParams.searchKeyword = searchKeyword;
        }

        const newProducts = await fetchProducts(fetchProductsParams);
        setProducts(newProducts);
        setPrevProducts(newProducts);
        setPrevCategory(categoryId);
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

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, searchKeyword]);

  const loadMoreProducts = useCallback(async () => {
    if (isLoading || !hasMore || !categoryId) return;
    setIsLoading(true);

    try {
      const fetchProductsParams: any = { page: page + 1 };
      fetchProductsParams.categoryIds = [categoryId];
      if (searchKeyword) {
        fetchProductsParams.searchKeyword = searchKeyword;
      }

      let newProducts: Product[];
      if (
        prevCategory === categoryId &&
        !searchKeyword &&
        fetchProductsParams.page <= prevPage &&
        prevSearchKeyword === searchKeyword
      ) {
        newProducts = prevProducts;
        setProducts(newProducts);
      } else {
        newProducts = await fetchProducts(fetchProductsParams);
        let updatedPrevProducts = prevProducts;

        setProducts((prevPageProducts) => {
          updatedPrevProducts = [...prevPageProducts, ...newProducts];
          return updatedPrevProducts;
        });
        setPrevProducts(updatedPrevProducts);
        setPrevSearchKeyword(searchKeyword);
        setPrevCategory(categoryId);

        if (newProducts.length !== 0) setPrevPage(fetchProductsParams.page);
      }
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
  }, [isLoading, hasMore, categoryId, page, searchKeyword]);

  useEffect(() => {
    const loadMoreTrigger = document.getElementById('load-more-trigger');
    if (!loadMoreTrigger) return () => undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreProducts();
        }
      },
      { rootMargin: '100px' }, // Adds a threshold for when to load
    );

    observer.observe(loadMoreTrigger);

    return () => {
      observer.disconnect();
    };
  }, [loadMoreProducts, categoryId]);

  useEffect(() => {
    setPage(0);
    setHasMore(true);
    setIsLoading(false);
    setProducts([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKeyword]);

  const handleBackButton = () => {
    if (categoryPath.length > 1) {
      // Navigate to the parent category page
      const parentCategory = categoryPath[categoryPath.length - 2];
      router.push(`/category/${parentCategory.id}`);
    } else {
      // If we're at the root category, go to home
      router.push('/');
    }
  };

  // Don't render if no categoryId
  if (!categoryId) {
    router.push('/');
  }

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
          <SimpleBreadcrumbs categoryPath={categoryPath} />
          <Box className="flex flex-wrap w-full">
            {['SUPERUSER', 'ADMIN'].includes(user?.grade) && (
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
        </Box>
        <div id="load-more-trigger"></div>
        {isLoading && (
          <Box className="w-full flex justify-center">
            <CircularProgress />
          </Box>
        )}
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
