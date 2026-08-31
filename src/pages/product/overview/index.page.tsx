import Layout from '@/pages/components/Layout';
import AddEditProductDialog from '@/pages/components/AddEditProductDialog';
import { AdminProductListItem } from '@/pages/api/product/admin-list.page';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { fetchProducts } from '@/pages/lib/apis';
import {
  appBarHeight,
  mobileAppBarHeight,
  squareBracketRegex,
} from '@/pages/lib/constants';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { AddEditProductProps, SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { parseName } from '@/pages/lib/utils';
import {
  categoryMenuItems,
  flattenCategories,
} from '@/pages/product/components/categoryOptions';
import {
  filterOverviewProducts,
  sortOverviewProducts,
} from '@/pages/product/overview/lib';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
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
import { GetServerSideProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';

export const getServerSideProps: GetServerSideProps = async (context) => {
  return {
    props: {
      messages: (await import(`../../../i18n/${context.locale}.json`)).default,
    },
  };
};

// Admin view over products and the prices connected to each: browse, filter by
// stock, add a product, edit one, and manage its price connections — without
// hunting for it in the storefront grid.
export default function ProductsOverview() {
  const router = useRouter();
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const t = useTranslations();
  const { user, accessToken } = useUserContext();
  const { categories } = useCategoryContext();
  const fetchWithCreds = useFetchWithCreds();

  const [products, setProducts] = useState<AdminProductListItem[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [outOfStockOnly, setOutOfStockOnly] = useState(false);
  const [addEditProductDialog, setAddEditProductDialog] =
    useState<AddEditProductProps>({ open: false, imageUrls: [] });
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<SnackbarProps>();

  const notify = (message: string, severity: SnackbarProps['severity']) => {
    setSnackbarOpen(true);
    setSnackbarMessage({ message, severity });
  };

  const flattenedCats = useMemo(
    () => flattenCategories(categories, router.locale ?? 'tk'),
    [categories, router.locale],
  );

  const loadProducts = async () => {
    if (!accessToken) return;
    const res = await fetchWithCreds<AdminProductListItem[]>({
      accessToken,
      path: '/api/product/admin-list',
      method: 'GET',
    });
    if (res.success && res.data != null) {
      setProducts(res.data);
    } else {
      notify('fetchProductsError', 'error');
    }
  };

  useEffect(() => {
    loadProducts();
  }, [accessToken]);

  const visibleProducts = useMemo(
    () =>
      sortOverviewProducts(
        filterOverviewProducts(products, {
          searchKeyword,
          categoryId: categoryFilter,
          outOfStockOnly,
          locale: router.locale ?? 'tk',
        }),
        router.locale ?? 'tk',
      ),
    [products, searchKeyword, categoryFilter, outOfStockOnly, router.locale],
  );

  // The list payload is deliberately thin, so opening the edit form needs the
  // full record — raw multi-locale names included, which is why it skips the
  // `locale` parameter.
  const openEditDialog = async (productId: string) => {
    try {
      const rawProduct = (await fetchProducts({ productId }))?.[0];
      if (rawProduct == null) {
        notify('fetchProductsError', 'error');
        return;
      }
      setAddEditProductDialog({
        open: true,
        id: rawProduct.id,
        dialogType: 'edit',
        name: rawProduct.name,
        description: rawProduct.description,
        imageUrls: rawProduct.imgUrls,
        // Stored as "[priceId]{value}" — the form edits the reference only.
        price:
          rawProduct.price?.match(squareBracketRegex)?.[0] ?? rawProduct.price,
        tags: rawProduct.tags,
        videoUrls: rawProduct.videoUrls,
        brandId: rawProduct.brandId,
        categoryId: rawProduct.categoryId,
        isOutOfStock: rawProduct.isOutOfStock,
      });
    } catch (error) {
      console.error(error);
      notify('serverError', 'error');
    }
  };

  return (
    <Layout handleHeaderBackButton={() => router.push('/')}>
      <Box
        sx={{
          mt: `${isMdUp ? appBarHeight : mobileAppBarHeight}px`,
          p: 2,
        }}
      >
        {['SUPERUSER', 'ADMIN'].includes(user?.grade) && (
          <Box className="flex flex-col gap-2">
            <Box className="flex flex-row items-center justify-between gap-2">
              <Typography variant="h6">{t('products')}</Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() =>
                  setAddEditProductDialog({
                    open: true,
                    dialogType: 'add',
                    imageUrls: [],
                    // Pre-fills the form with whatever category is being
                    // browsed; still changeable inside the dialog.
                    categoryId: categoryFilter || undefined,
                  })
                }
              >
                {t('addNewProduct')}
              </Button>
            </Box>

            <Box className="flex flex-row flex-wrap gap-2">
              <TextField
                size="small"
                placeholder={t('search')}
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                sx={{ minWidth: 240 }}
              />
              <FormControl size="small" sx={{ minWidth: 240 }}>
                <InputLabel>{t('category')}</InputLabel>
                <Select
                  label={t('category')}
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <MenuItem value="">{t('allCategories')}</MenuItem>
                  {categoryMenuItems(flattenedCats)}
                </Select>
              </FormControl>
              <ToggleButton
                size="small"
                color="error"
                value="outOfStockOnly"
                selected={outOfStockOnly}
                onChange={() => setOutOfStockOnly((prev) => !prev)}
              >
                {t('outOfStockOnly')}
              </ToggleButton>
            </Box>

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('productName')}</TableCell>
                  <TableCell>{t('category')}</TableCell>
                  <TableCell>{t('connectedPrices')}</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <Box className="flex flex-row items-center gap-2">
                        {parseName(product.name, router.locale ?? 'tk')}
                        {product.isOutOfStock && (
                          <Chip
                            size="small"
                            color="error"
                            variant="outlined"
                            label={t('outOfStock')}
                          />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {flattenedCats.find(
                        (cat) => cat.id === product.categoryId,
                      )?.name ?? t('noCategory')}
                    </TableCell>
                    <TableCell>{product.priceCount}</TableCell>
                    <TableCell>
                      {/* Connecting prices lives in the edit form, so this row
                          only opens that one dialog. */}
                      <IconButton
                        size="small"
                        title={t('edit')}
                        onClick={() => openEditDialog(product.id)}
                      >
                        <EditIcon color="primary" fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}

        {addEditProductDialog.open && (
          <AddEditProductDialog
            args={addEditProductDialog}
            snackbarErrorHandler={(message) => notify(message, 'error')}
            handleClose={() => {
              setAddEditProductDialog({ open: false, imageUrls: [] });
              // Names, categories and stock flags shown above may have changed.
              loadProducts();
            }}
          />
        )}

        <Snackbar
          open={snackbarOpen}
          autoHideDuration={6000}
          onClose={() => setSnackbarOpen(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity={snackbarMessage?.severity} variant="filled">
            {snackbarMessage?.message && t(snackbarMessage.message)}
          </Alert>
        </Snackbar>
      </Box>
    </Layout>
  );
}
