import DeleteDialog from '@/pages/components/DeleteDialog';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useUserContext } from '@/pages/lib/UserContext';
import {
  deletePricesUtil,
  editHistoryUtil,
} from '@/pages/procurement/lib/apiUtils';
import { useProcurement } from '@/pages/procurement/lib/ProcurementContext';
import {
  getSupplierStats,
  SupplierStats,
  supplierPriceIds,
  withoutSupplierPrices,
} from '@/pages/procurement/lib/supplierStats';
import { procurementClasses as pc } from '@/styles/classMaps/procurement';
import { suppliersClasses as c } from '@/styles/classMaps/procurement/suppliers';
import { fontClassName } from '@/styles/theme';
import { Box, ButtonBase, Typography } from '@mui/material';
import { ProcurementSupplier } from '@prisma/client';
import { Plus, Store, TrendingDown, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

const font = fontClassName.className;

function StatusLine({
  stats,
  calculated,
}: {
  stats: SupplierStats;
  calculated: boolean;
}) {
  const t = useTranslations();
  if (stats.total === 0) {
    return (
      <Box className={c.status}>
        <span className={`${font} ${c.badge} ${c.badgeTone.idle}`}>
          {t('procurementSupplierNothingToPrice')}
        </span>
      </Box>
    );
  }
  const complete = stats.priced === stats.total;
  let tone = c.badgeTone.partial;
  if (stats.priced === 0) tone = c.badgeTone.idle;
  else if (complete) tone = c.badgeTone.complete;
  return (
    <Box className={c.status}>
      <span className={`${font} ${c.badge} ${tone}`}>
        {t('procurementSupplierPriced', {
          priced: stats.priced,
          total: stats.total,
        })}
      </span>
      {calculated && stats.cheapest > 0 && (
        <span className={`${font} ${c.badge} ${c.badgeTone.cheapest}`}>
          <TrendingDown className={c.badgeIcon} aria-hidden />
          {t('procurementSupplierCheapest', { count: stats.cheapest })}
        </span>
      )}
    </Box>
  );
}

/**
 * Suppliers tab: the stores this order asks for prices. Each row shows how
 * many of the products being bought the store has priced and, once the order
 * is calculated, how many it is the cheapest for. Removing a supplier takes it
 * off the order and deletes its prices in this order.
 */
export default function SuppliersPanel(): JSX.Element | null {
  const t = useTranslations();
  const platform = usePlatform();
  const { accessToken } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();
  const {
    selectedHistory,
    selectedSuppliers,
    setSelectedSuppliers,
    selectedProducts,
    hashedQuantities,
    prices,
    setPrices,
    openCatalog,
    setSnackbarMessage,
    setSnackbarOpen,
  } = useProcurement();
  const [removing, setRemoving] = useState<ProcurementSupplier>();

  const orderId = selectedHistory?.id;
  const { bySupplier, calculated } = useMemo(
    () =>
      getSupplierStats({
        orderId: orderId ?? '',
        supplierIds: selectedSuppliers.map(({ id }) => id),
        productIds: selectedProducts.map(({ id }) => id),
        quantities: hashedQuantities,
        prices,
      }),
    [orderId, selectedSuppliers, selectedProducts, hashedQuantities, prices],
  );

  const handleRemove = async () => {
    const supplier = removing;
    if (supplier == null || orderId == null) return;
    const productIds = selectedProducts.map(({ id }) => id);
    const removed = await editHistoryUtil({
      id: orderId,
      accessToken,
      removedSupplierIds: [supplier.id],
      setSnackbarMessage,
      setSnackbarOpen,
      fetchWithCreds,
    });
    if (removed == null) {
      // Still on the order server-side: keep it (and its prices) on screen.
      setRemoving(undefined);
      return;
    }
    setSelectedSuppliers((prev) => prev.filter(({ id }) => id !== supplier.id));

    // Delete only the cells that exist; skip the request when there are none.
    const ids = supplierPriceIds({
      orderId,
      supplierId: supplier.id,
      productIds,
      prices,
    });
    const pricesDeleted =
      ids.length === 0 ||
      (await deletePricesUtil({
        accessToken,
        ids,
        setSnackbarMessage,
        setSnackbarOpen,
        fetchWithCreds,
      }));
    if (pricesDeleted) {
      setPrices((curr) =>
        withoutSupplierPrices({
          orderId,
          supplierId: supplier.id,
          productIds,
          prices: curr,
        }),
      );
    }
    setRemoving(undefined);
  };

  const addButton = (primary: boolean) => (
    <ButtonBase
      disableRipple
      onClick={() => openCatalog('supplier')}
      className={`${font} ${primary ? pc.btnPrimary : pc.btnSoft} ${
        primary ? c.emptyAction : 'flex-none'
      }`}
    >
      <Plus className={pc.icon} aria-hidden />
      {t('addSuppliers')}
    </ButtonBase>
  );

  if (selectedSuppliers.length === 0) {
    return (
      <Box className={c.emptyCard[platform]}>
        <Box className={pc.empty}>
          <Box className={pc.emptyIcon}>
            <Store className="w-6 h-6" aria-hidden />
          </Box>
          <Typography className={`${font} ${c.emptyText}`}>
            {t('procurementSuppliersEmpty')}
          </Typography>
          {addButton(true)}
        </Box>
      </Box>
    );
  }

  return (
    <Box className={c.root}>
      <Box className={c.header}>
        <Typography component="h2" className={`${font} ${c.headerTitle}`}>
          {t('suppliers')}
          <span className={c.headerCount}>{selectedSuppliers.length}</span>
        </Typography>
        {addButton(false)}
      </Box>

      <Box component="ul" className={`${c.list[platform]} m-0 p-0 list-none`}>
        {selectedSuppliers.map((supplier, index) => (
          <Box
            component="li"
            key={supplier.id}
            data-testid="procurement-supplier-row"
            className={`${c.row[platform]} ${
              platform === 'mobile' && index < selectedSuppliers.length - 1
                ? c.rowBorder
                : ''
            }`}
          >
            <Box className={c.tile}>
              <Store className={c.tileIcon} aria-hidden />
            </Box>
            <Box className={c.body}>
              <Typography className={`${font} ${c.name}`}>
                {supplier.name}
              </Typography>
              {supplier.description && (
                <Typography className={`${font} ${c.description}`}>
                  {supplier.description}
                </Typography>
              )}
              <StatusLine
                stats={
                  bySupplier[supplier.id] ?? {
                    priced: 0,
                    total: 0,
                    cheapest: 0,
                  }
                }
                calculated={calculated}
              />
            </Box>
            <ButtonBase
              disableRipple
              aria-label={`${t('remove')} ${supplier.name}`}
              onClick={() => setRemoving(supplier)}
              className={c.remove}
            >
              <Trash2 className={c.removeIcon} aria-hidden />
            </ButtonBase>
          </Box>
        ))}
      </Box>

      {removing && (
        <DeleteDialog
          title={t('remove')}
          description={t('procurementRemoveSupplierConfirm', {
            name: removing.name,
          })}
          blueButtonText={t('cancel')}
          redButtonText={t('remove')}
          handleClose={() => setRemoving(undefined)}
          handleDelete={handleRemove}
        />
      )}
    </Box>
  );
}
