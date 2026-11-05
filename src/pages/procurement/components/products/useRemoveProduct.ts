import { useFetchWithCreds } from '@/pages/lib/fetch';
import { useUserContext } from '@/pages/lib/UserContext';
import {
  deletePricesUtil,
  deleteQuantityUtil,
  editHistoryUtil,
} from '@/pages/procurement/lib/apiUtils';
import { useProcurement } from '@/pages/procurement/lib/ProcurementContext';
import { priceHash } from '@/pages/procurement/lib/utils';
import { ProcurementProduct } from '@prisma/client';
import { useCallback } from 'react';

/**
 * Removes a product from the open order (not from the catalog): unlink it,
 * delete its quantity row, then delete the prices it already has. Same API
 * sequence as the old OrderTable, but every state update copies instead of
 * mutating (`delete currPrices[...]` in place left React with the same object
 * and stale price cells), and the price call is skipped when there is nothing
 * to delete (one round-trip less on a slow line).
 *
 * Resolves to true when the product left the order.
 */
export function useRemoveProduct() {
  const {
    selectedHistory,
    selectedSuppliers,
    prices,
    setSelectedProducts,
    setProductQuantities,
    setHashedQuantities,
    setPrices,
    setSnackbarMessage,
    setSnackbarOpen,
  } = useProcurement();
  const { accessToken } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();

  return useCallback(
    async (product: ProcurementProduct): Promise<boolean> => {
      if (selectedHistory == null) return false;
      const orderId = selectedHistory.id;
      const feedback = { setSnackbarMessage, setSnackbarOpen, fetchWithCreds };

      const unlinked = await editHistoryUtil({
        id: orderId,
        accessToken,
        removedProductIds: [product.id],
        ...feedback,
      });
      // The order still lists the product; leave its quantity and prices.
      if (unlinked == null) return false;

      await deleteQuantityUtil({
        accessToken,
        orderId,
        productId: product.id,
        ...feedback,
      });
      const priceIds = selectedSuppliers
        .map(({ id }) => ({ orderId, productId: product.id, supplierId: id }))
        .filter((ids) => prices[priceHash(ids)] != null);
      if (priceIds.length > 0) {
        await deletePricesUtil({ accessToken, ids: priceIds, ...feedback });
      }

      setSelectedProducts((curr) => curr.filter(({ id }) => id !== product.id));
      setProductQuantities((curr) =>
        curr.filter(({ productId }) => productId !== product.id),
      );
      setHashedQuantities((curr) => {
        const next = { ...curr };
        delete next[product.id];
        return next;
      });
      setPrices((curr) => {
        const next = { ...curr };
        priceIds.forEach((ids) => {
          delete next[priceHash(ids)];
        });
        return next;
      });
      return true;
    },
    [
      accessToken,
      fetchWithCreds,
      prices,
      selectedHistory,
      selectedSuppliers,
      setHashedQuantities,
      setPrices,
      setProductQuantities,
      setSelectedProducts,
      setSnackbarMessage,
      setSnackbarOpen,
    ],
  );
}
