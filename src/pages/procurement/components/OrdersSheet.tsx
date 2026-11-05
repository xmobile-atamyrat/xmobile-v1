import DeleteDialog from '@/pages/components/DeleteDialog';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { useUserContext } from '@/pages/lib/UserContext';
import NameDialog from '@/pages/procurement/components/NameDialog';
import OrderCard from '@/pages/procurement/components/orders/OrderCard';
import {
  filterOrders,
  sortOrdersNewestFirst,
  suggestOrderName,
} from '@/pages/procurement/components/orders/orderUtils';
import ProcurementSheet from '@/pages/procurement/components/ProcurementSheet';
import {
  deleteHistoryUtil,
  editHistoryUtil,
} from '@/pages/procurement/lib/apiUtils';
import { useProcurement } from '@/pages/procurement/lib/ProcurementContext';
import {
  procurementClasses as pc,
  procurementFieldSx,
} from '@/styles/classMaps/procurement';
import { procurementOrdersClasses as c } from '@/styles/classMaps/procurement/orders';
import { fontClassName } from '@/styles/theme';
import {
  Box,
  ButtonBase,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import { ProcurementOrder } from '@prisma/client';
import { ClipboardList, Plus, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

/** Show the search field once the list gets long. */
const SEARCH_THRESHOLD = 10;
/** Past this many orders the sheet opens tall instead of hugging the list. */
const FULL_HEIGHT_THRESHOLD = 5;

/**
 * Order history: switch, rename, delete orders; plus the new-order NameDialog.
 * Reads everything from useProcurement(); takes no props. `?order=<id>` is
 * kept in step with the open order by the page shell (index.page.tsx).
 */
export default function OrdersSheet(): JSX.Element | null {
  const t = useTranslations();
  const { accessToken } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();
  const {
    historyList,
    setHistoryList,
    selectedHistory,
    setSelectedHistory,
    setSelectedProducts,
    setSelectedSuppliers,
    setProductQuantities,
    setHashedQuantities,
    setPrices,
    selectOrder,
    createOrder,
    ordersSheetOpen,
    setOrdersSheetOpen,
    newOrderDialogOpen,
    setNewOrderDialogOpen,
    setLoading,
    setSnackbarOpen,
    setSnackbarMessage,
  } = useProcurement();

  const [query, setQuery] = useState('');
  const [renameTarget, setRenameTarget] = useState<ProcurementOrder>();
  const [deleteTarget, setDeleteTarget] = useState<ProcurementOrder>();

  const sorted = useMemo(
    () => sortOrdersNewestFirst(historyList),
    [historyList],
  );
  const showSearch = sorted.length > SEARCH_THRESHOLD;
  const visible = useMemo(
    () => (showSearch ? filterOrders(sorted, query) : sorted),
    [showSearch, sorted, query],
  );
  const font = fontClassName.className;

  const closeSheet = () => {
    setOrdersSheetOpen(false);
    setQuery('');
  };

  const openOrder = async (id: string) => {
    setLoading(true);
    try {
      await selectOrder(id);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (order: ProcurementOrder) => {
    closeSheet();
    if (order.id === selectedHistory?.id) return;
    await openOrder(order.id);
  };

  const handleRename = async (order: ProcurementOrder, name: string) => {
    if (name === order.name) return;
    const updated = await editHistoryUtil({
      accessToken,
      id: order.id,
      name,
      setSnackbarOpen,
      setSnackbarMessage,
      fetchWithCreds,
    });
    // Throwing keeps NameDialog open; the util already showed the error toast.
    if (updated == null) throw new Error('rename failed');
    setHistoryList((list) =>
      list.map((item) => (item.id === updated.id ? updated : item)),
    );
    setSelectedHistory((curr) =>
      curr?.id === updated.id
        ? { ...curr, name: updated.name, updatedAt: updated.updatedAt }
        : curr,
    );
  };

  const clearOpenOrder = () => {
    setSelectedHistory(undefined);
    setSelectedProducts([]);
    setSelectedSuppliers([]);
    setProductQuantities([]);
    setHashedQuantities({});
    setPrices({});
  };

  const handleDelete = async (order: ProcurementOrder) => {
    const deleted = await deleteHistoryUtil({
      accessToken,
      id: order.id,
      setSnackbarOpen,
      setSnackbarMessage,
      fetchWithCreds,
    });
    setDeleteTarget(undefined);
    if (deleted == null) return;
    const remaining = sorted.filter((item) => item.id !== deleted.id);
    setHistoryList((list) => list.filter((item) => item.id !== deleted.id));
    if (selectedHistory?.id !== deleted.id) return;
    // The open order is gone: fall back to the newest one, like a fresh load.
    if (remaining.length > 0) await openOrder(remaining[0].id);
    else clearOpenOrder();
  };

  const handleCreate = async (name: string) => {
    const created = await createOrder(name);
    if (created == null) throw new Error('create failed');
    closeSheet();
  };

  return (
    <>
      {ordersSheetOpen && (
        <ProcurementSheet
          onClose={closeSheet}
          title={t('procurementOrders')}
          fullHeight={sorted.length > FULL_HEIGHT_THRESHOLD}
          data-testid="procurement-orders-sheet"
          footer={
            <ButtonBase
              disableRipple
              onClick={() => setNewOrderDialogOpen(true)}
              className={`${pc.btnPrimary} flex-1 ${font}`}
            >
              <Plus size={18} />
              {t('newOrder')}
            </ButtonBase>
          }
        >
          {showSearch && (
            <Box className={c.search}>
              <TextField
                fullWidth
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('procurementSearchOrders')}
                sx={procurementFieldSx}
                inputProps={{
                  'aria-label': t('procurementSearchOrders'),
                  enterKeyHint: 'search',
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search size={18} className="text-muted" />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
          )}
          {visible.length > 0 ? (
            <Box component="ul" className={c.list}>
              {visible.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  active={order.id === selectedHistory?.id}
                  onSelect={handleSelect}
                  onRename={setRenameTarget}
                  onDelete={setDeleteTarget}
                />
              ))}
            </Box>
          ) : (
            <Box className={pc.empty}>
              <Box className={pc.emptyIcon}>
                {sorted.length > 0 ? (
                  <Search size={24} />
                ) : (
                  <ClipboardList size={24} />
                )}
              </Box>
              <Typography className={`${font} text-[14px] text-muted`}>
                {sorted.length > 0
                  ? t('noOrdersFound')
                  : t('procurementNoOrders')}
              </Typography>
            </Box>
          )}
        </ProcurementSheet>
      )}

      {newOrderDialogOpen && (
        <NameDialog
          title={t('newOrder')}
          initialValue={suggestOrderName(historyList)}
          submitLabel={t('procurementCreate')}
          onClose={() => setNewOrderDialogOpen(false)}
          onSubmit={handleCreate}
        />
      )}

      {renameTarget && (
        <NameDialog
          title={t('procurementRenameOrder')}
          initialValue={renameTarget.name}
          onClose={() => setRenameTarget(undefined)}
          onSubmit={(name) => handleRename(renameTarget, name)}
        />
      )}

      {deleteTarget && (
        <DeleteDialog
          title={t('procurementDeleteOrder')}
          description={t('procurementDeleteOrderText', {
            name: deleteTarget.name,
          })}
          handleClose={() => setDeleteTarget(undefined)}
          handleDelete={() => handleDelete(deleteTarget)}
        />
      )}
    </>
  );
}
