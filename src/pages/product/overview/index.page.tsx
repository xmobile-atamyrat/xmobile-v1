import BASE_URL from '@/lib/ApiEndpoints';
import Layout from '@/pages/components/Layout';
import AddEditProductDialog from '@/pages/components/AddEditProductDialog';
import { AdminProductListItem } from '@/pages/api/product/admin-list.page';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { fetchBrands, fetchProducts } from '@/pages/lib/apis';
import {
  appBarHeight,
  mobileAppBarHeight,
  squareBracketRegex,
} from '@/pages/lib/constants';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import {
  AddEditProductProps,
  BrandProps,
  ResponseApi,
  SnackbarProps,
} from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { addEditBrand, parseName } from '@/pages/lib/utils';
import SelectCell from '@/pages/product/components/SelectCell';
import {
  categoryMenuItems,
  flattenCategories,
} from '@/pages/product/components/categoryOptions';
import {
  buildProductEditFields,
  filterOverviewProducts,
  NO_BRAND_FILTER,
  OverviewSortKey,
  ProductEdit,
  resolveBrandSelection,
  sortOverviewProducts,
} from '@/pages/product/overview/lib';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import {
  Alert,
  Box,
  Button,
  Checkbox,
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
import { Product } from '@prisma/client';
import { GetServerSideProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useState } from 'react';

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
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [outOfStockOnly, setOutOfStockOnly] = useState(false);
  const [missingPriceOnly, setMissingPriceOnly] = useState(false);
  const [sortKey, setSortKey] = useState<OverviewSortKey>('nameAsc');
  // Pending category/brand/stock edits keyed by product id, mirroring
  // update-prices: a row edit is staged here and only written on Save, so a row
  // full of half-finished picks can't leave the list mid-request.
  const [updatedProducts, setUpdatedProducts] = useState<
    Record<string, ProductEdit>
  >({});
  const [savingEdits, setSavingEdits] = useState(false);
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

  useEffect(() => {
    (async () => setBrands(await fetchBrands()))();
  }, []);

  // Pending edits are overlaid before filtering (not after, unlike
  // update-prices) so flipping a row's stock or category updates its place in
  // the "out of stock only" / category-filtered view immediately rather than
  // only once Save lands.
  const visibleProducts = useMemo(() => {
    const withPendingEdits = products.map((product) =>
      updatedProducts[product.id]
        ? { ...product, ...updatedProducts[product.id] }
        : product,
    );
    return sortOverviewProducts(
      filterOverviewProducts(withPendingEdits, {
        searchKeyword,
        categoryId: categoryFilter,
        outOfStockOnly,
        brandId: brandFilter,
        missingPriceOnly,
        locale: router.locale ?? 'tk',
      }),
      router.locale ?? 'tk',
      sortKey,
    );
  }, [
    products,
    updatedProducts,
    searchKeyword,
    categoryFilter,
    outOfStockOnly,
    brandFilter,
    missingPriceOnly,
    sortKey,
    router.locale,
  ]);

  // The row cells are memoized, so these have to keep a stable identity across
  // renders or every keystroke in the search box would re-render all of them.
  const handleCategoryChange = useCallback(
    (productId: string, categoryId: string | null) => {
      if (categoryId == null) return; // a product always needs a category
      setUpdatedProducts((prev) => ({
        ...prev,
        [productId]: { ...prev[productId], categoryId },
      }));
    },
    [],
  );

  // Unlike a category, a brand is optional: null is a real choice here, staged
  // as an explicit null so the save knows to unlink rather than skip the field.
  const handleBrandChange = useCallback(
    (productId: string, brandId: string | null) => {
      setUpdatedProducts((prev) => ({
        ...prev,
        [productId]: { ...prev[productId], brandId },
      }));
    },
    [],
  );

  // Brands are created immediately rather than staged with the row: the row
  // edit stores a brand id, so the brand has to exist before there is anything
  // to stage. Returning the id hands the cell what it needs to select it.
  const handleCreateBrand = useCallback(
    async (name: string): Promise<string | null> => {
      const selection = resolveBrandSelection(brands, name);
      if (selection.kind === 'noop') return null;
      // Typing the name of a brand that already exists picks it instead of
      // failing on the unique index.
      if (selection.kind === 'existing') return selection.id;
      if (!accessToken) return null;

      const res = await addEditBrand({
        type: 'add',
        name: selection.name,
        accessToken,
        fetchWithCreds,
      });
      const created = res.data as BrandProps | undefined;
      if (!res.success || created == null) {
        notify('createBrandError', 'error');
        return null;
      }
      // Added locally rather than refetched: the brand column resolves ids to
      // names off this list, so the new row would render blank until a reload.
      setBrands((prev) => [...prev, { id: created.id, name: created.name }]);
      return created.id;
    },
    [brands, accessToken, fetchWithCreds],
  );

  const handleOutOfStockChange = useCallback(
    (productId: string, isOutOfStock: boolean) => {
      setUpdatedProducts((prev) => ({
        ...prev,
        [productId]: { ...prev[productId], isOutOfStock },
      }));
    },
    [],
  );

  // Each row is its own multipart PUT (the product API isn't a batch JSON
  // endpoint like /api/prices), fired in parallel and only for the fields the
  // admin actually touched — an omitted field is left untouched server-side,
  // which is what keeps this from clobbering images, tags, or the base price.
  const saveProductEdits = async () => {
    const edits = Object.entries(updatedProducts);
    if (edits.length === 0) return;
    setSavingEdits(true);
    try {
      const results = await Promise.all(
        edits.map(async ([productId, edit]) => {
          const formData = new FormData();
          buildProductEditFields(edit).forEach(([key, fieldValue]) =>
            formData.append(key, fieldValue),
          );
          const response = await fetch(
            `${BASE_URL}/api/product?productId=${productId}`,
            { method: 'PUT', body: formData },
          );
          const json: ResponseApi<Product> = await response.json();
          return { productId, ...json };
        }),
      );

      const succeeded = results.filter((result) => result.success);
      setProducts((prev) =>
        prev.map((product) => {
          const result = succeeded.find((r) => r.productId === product.id);
          return result?.data
            ? {
                ...product,
                categoryId: result.data.categoryId,
                brandId: result.data.brandId,
                isOutOfStock: result.data.isOutOfStock,
                // The row really was just edited, so the "recently edited" sort
                // has to see it move rather than keep the pre-save timestamp.
                updatedAt: new Date(result.data.updatedAt).toISOString(),
              }
            : product;
        }),
      );
      setUpdatedProducts((prev) => {
        const remaining = { ...prev };
        succeeded.forEach(({ productId }) => delete remaining[productId]);
        return remaining;
      });

      if (succeeded.length < results.length) {
        notify('updateProductsError', 'error');
      } else {
        notify('productsUpdated', 'success');
      }
    } catch (error) {
      console.error(error);
      notify('updateProductsError', 'error');
    } finally {
      setSavingEdits(false);
    }
  };

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
              <FormControl size="small" sx={{ minWidth: 200 }}>
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
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>{t('brand')}</InputLabel>
                <Select
                  label={t('brand')}
                  value={brandFilter}
                  onChange={(e) => setBrandFilter(e.target.value)}
                >
                  <MenuItem value="">{t('allBrands')}</MenuItem>
                  <MenuItem value={NO_BRAND_FILTER}>{t('noBrand')}</MenuItem>
                  {brands.map((brand) => (
                    <MenuItem value={brand.id} key={brand.id}>
                      {brand.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 170 }}>
                <InputLabel>{t('sortBy')}</InputLabel>
                <Select
                  label={t('sortBy')}
                  value={sortKey}
                  onChange={(e) =>
                    setSortKey(e.target.value as OverviewSortKey)
                  }
                >
                  <MenuItem value="nameAsc">{t('nameAToZ')}</MenuItem>
                  <MenuItem value="nameDesc">{t('nameZToA')}</MenuItem>
                  <MenuItem value="editedRecent">
                    {t('recentlyEdited')}
                  </MenuItem>
                  <MenuItem value="editedStale">
                    {t('longestNotEdited')}
                  </MenuItem>
                  <MenuItem value="priceAsc">{t('manatLowToHigh')}</MenuItem>
                  <MenuItem value="priceDesc">{t('manatHighToLow')}</MenuItem>
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
              <ToggleButton
                size="small"
                color="warning"
                value="missingPriceOnly"
                selected={missingPriceOnly}
                onChange={() => setMissingPriceOnly((prev) => !prev)}
              >
                {t('missingPriceOnly')}
              </ToggleButton>
              {Object.keys(updatedProducts).length > 0 && (
                <Button
                  variant="contained"
                  disabled={savingEdits}
                  onClick={saveProductEdits}
                >
                  {t('save')}
                </Button>
              )}
            </Box>

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('productName')}</TableCell>
                  <TableCell>{t('category')}</TableCell>
                  <TableCell>{t('brand')}</TableCell>
                  <TableCell>{t('price')}</TableCell>
                  <TableCell>{t('outOfStock')}</TableCell>
                  <TableCell>{t('lastEdited')}</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      {parseName(product.name, router.locale ?? 'tk')}
                    </TableCell>
                    <TableCell>
                      <SelectCell
                        id={product.id}
                        value={product.categoryId}
                        options={flattenedCats}
                        emptyLabel={t('noCategory')}
                        allowEmpty={false}
                        dirty={
                          'categoryId' in (updatedProducts[product.id] ?? {})
                        }
                        onChange={handleCategoryChange}
                      />
                    </TableCell>
                    <TableCell>
                      {/* Unlike the category, a brand can be cleared — the
                          column is nullable — and a missing one can be filled
                          in by typing a new name rather than opening the
                          product form just to add a brand. */}
                      <SelectCell
                        id={product.id}
                        value={product.brandId}
                        options={brands}
                        emptyLabel={t('noBrand')}
                        dirty={'brandId' in (updatedProducts[product.id] ?? {})}
                        onChange={handleBrandChange}
                        onCreate={handleCreateBrand}
                        createLabel={t('addNewBrand')}
                        createPlaceholder={t('brandName')}
                      />
                    </TableCell>
                    <TableCell>
                      {/* A dead reference is called out rather than shown as a
                          blank: it renders as a permanent spinner on the
                          storefront, so it needs fixing, not just filling in. */}
                      {product.basePriceIssue == null ? (
                        `${product.basePriceTmt} ${t('manat')}`
                      ) : (
                        <Chip
                          size="small"
                          color="warning"
                          variant="outlined"
                          label={
                            product.basePriceIssue === 'danglingRef'
                              ? t('brokenPriceLink')
                              : t('noPrice')
                          }
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <Checkbox
                        size="small"
                        checked={product.isOutOfStock}
                        onChange={(e) =>
                          handleOutOfStockChange(product.id, e.target.checked)
                        }
                        // Matches the dirty affordance the category cell uses:
                        // a pending edit is coloured until the save clears it.
                        color={
                          'isOutOfStock' in (updatedProducts[product.id] ?? {})
                            ? 'warning'
                            : 'primary'
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {/* ISO, not a locale format: the table spans five locales
                          and an admin scanning for stale rows needs one shape
                          they can compare at a glance. Same call the price
                          table's updated column makes. */}
                      <Typography variant="body2" color="text.secondary">
                        {product.updatedAt.slice(0, 10)}
                      </Typography>
                    </TableCell>
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
