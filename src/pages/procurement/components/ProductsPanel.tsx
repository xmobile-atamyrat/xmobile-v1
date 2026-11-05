import DeleteDialog from '@/pages/components/DeleteDialog';
import { usePlatform } from '@/pages/lib/PlatformContext';
import ProductRow from '@/pages/procurement/components/products/ProductRow';
import { isMissingQuantity } from '@/pages/procurement/components/products/quantity';
import { useQuantitySaver } from '@/pages/procurement/components/products/useQuantitySaver';
import { useRemoveProduct } from '@/pages/procurement/components/products/useRemoveProduct';
import { useProcurement } from '@/pages/procurement/lib/ProcurementContext';
import { procurementFieldSx } from '@/styles/classMaps/procurement';
import { productsPanelClasses as c } from '@/styles/classMaps/procurement/products';
import { fontClassName } from '@/styles/theme';
import {
  Box,
  ButtonBase,
  InputAdornment,
  Skeleton,
  TextField,
  Typography,
} from '@mui/material';
import { ProcurementProduct } from '@prisma/client';
import { AlertCircle, PackagePlus, Plus, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useState } from 'react';

/** Above this many products a client-side name filter is shown. */
const SEARCH_THRESHOLD = 8;

/**
 * Products tab: the order's products with their quantities. Reads everything
 * from useProcurement(); takes no props. Owns its own mutations: quantity
 * edits (debounced per product) and removing a product from the order.
 */
export default function ProductsPanel(): JSX.Element | null {
  const t = useTranslations();
  const platform = usePlatform();
  const {
    selectedHistory,
    selectedProducts,
    hashedQuantities,
    initialLoading,
    openCatalog,
  } = useProcurement();
  const { status, changeQuantity, flush, cancel } = useQuantitySaver();
  const removeProduct = useRemoveProduct();
  const [toRemove, setToRemove] = useState<ProcurementProduct>();
  const [query, setQuery] = useState('');

  const positions = useMemo(
    () => new Map(selectedProducts.map(({ id }, i) => [id, i + 1])),
    [selectedProducts],
  );
  const showSearch = selectedProducts.length > SEARCH_THRESHOLD;
  const visibleProducts = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!showSearch || needle === '') return selectedProducts;
    return selectedProducts.filter(({ name }) =>
      name.toLocaleLowerCase().includes(needle),
    );
  }, [query, selectedProducts, showSearch]);
  const missingCount = selectedProducts.filter(({ id }) =>
    isMissingQuantity(hashedQuantities[id]),
  ).length;

  const handleRemove = useCallback(async () => {
    if (toRemove == null) return;
    cancel(toRemove.id);
    await removeProduct(toRemove);
    setToRemove(undefined);
  }, [cancel, removeProduct, toRemove]);

  const addButton = (className: string) => (
    <ButtonBase
      disableRipple
      onClick={() => openCatalog('product')}
      disabled={selectedHistory == null}
      className={`${fontClassName.className} ${className}`}
    >
      <Plus className="w-[18px] h-[18px]" aria-hidden />
      {t('addProducts')}
    </ButtonBase>
  );

  if (initialLoading) {
    return (
      <Box className={c.list[platform]} aria-busy>
        {[0, 1, 2].map((i) => (
          <Box key={i} className={c.skeletonRow}>
            <Skeleton variant="text" sx={{ flex: 1, fontSize: '15px' }} />
            <Skeleton variant="rounded" width={88} height={44} />
          </Box>
        ))}
      </Box>
    );
  }

  if (selectedProducts.length === 0) {
    return (
      <Box className={c.list[platform]}>
        <Box className={c.empty}>
          <Box className={c.emptyIcon}>
            <PackagePlus className="w-6 h-6" aria-hidden />
          </Box>
          <Typography className={`${fontClassName.className} ${c.emptyText}`}>
            {t('procurementNoProducts')}
          </Typography>
          {selectedHistory != null && addButton(c.emptyBtn)}
        </Box>
      </Box>
    );
  }

  return (
    <Box className={c.root}>
      <Box className={c.head}>
        <Typography
          component="h2"
          className={`${fontClassName.className} ${c.count[platform]}`}
        >
          {t('procurementProductCount', { count: selectedProducts.length })}
        </Typography>
        {addButton(c.addBtn)}
      </Box>

      {missingCount > 0 && (
        <Box className={`${fontClassName.className} ${c.hint}`} role="note">
          <AlertCircle className={c.hintIcon} aria-hidden />
          {t('procurementZeroQuantityHint')}
        </Box>
      )}

      {showSearch && (
        <TextField
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('procurementSearchInOrder')}
          sx={procurementFieldSx}
          fullWidth
          inputProps={{
            type: 'search',
            'aria-label': t('procurementSearchInOrder'),
            className: fontClassName.className,
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search className={c.searchIcon} aria-hidden />
              </InputAdornment>
            ),
          }}
        />
      )}

      <Box className={c.list[platform]}>
        {platform === 'web' && (
          <Box
            className={`${fontClassName.className} ${c.tableHead}`}
            aria-hidden
          >
            <span>#</span>
            <span>{t('product')}</span>
            <span className={c.tableHeadQty}>{t('quantity')}</span>
            <span />
          </Box>
        )}
        {visibleProducts.length === 0 ? (
          <Typography className={`${fontClassName.className} ${c.noMatch}`}>
            {t('noProductsFound')}
          </Typography>
        ) : (
          <ul aria-label={t('products')}>
            {visibleProducts.map((product, i) => (
              <ProductRow
                key={product.id}
                product={product}
                position={positions.get(product.id) ?? i + 1}
                quantity={hashedQuantities[product.id]}
                status={status[product.id]}
                platform={platform}
                isLast={i === visibleProducts.length - 1}
                onQuantityChange={changeQuantity}
                onQuantityBlur={flush}
                onRemove={setToRemove}
              />
            ))}
          </ul>
        )}
      </Box>

      {toRemove && (
        <DeleteDialog
          title={t('confirmRemoveProduct')}
          description={toRemove.name}
          redButtonText={t('remove')}
          blueButtonText={t('cancel')}
          handleClose={() => setToRemove(undefined)}
          handleDelete={handleRemove}
        />
      )}
    </Box>
  );
}
