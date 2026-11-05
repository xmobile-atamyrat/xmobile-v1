import { useFetchWithCreds } from '@/pages/lib/fetch';
import { useUserContext } from '@/pages/lib/UserContext';
import { editProductQuantityUtil } from '@/pages/procurement/lib/apiUtils';
import { useProcurement } from '@/pages/procurement/lib/ProcurementContext';
import { useCallback, useEffect, useRef, useState } from 'react';

export type QuantitySaveStatus = 'saving' | 'saved';

const SAVE_DELAY_MS = 400;
const SAVED_VISIBLE_MS = 1500;

interface PendingSave {
  timer: ReturnType<typeof setTimeout>;
  orderId: string;
  quantity: number | null;
}

// The api util toasts "success" on every save; a quantity field saving after
// each pause in typing would flash a toast per keystroke burst. We show a
// quiet per-row "Saved" instead and toast only on failure.
const silent = () => {};

/**
 * Debounced quantity saving with one timer PER PRODUCT, so editing product A
 * and then B within the delay saves both (the old table shared a single
 * debounce and silently dropped A). Edits are applied optimistically to both
 * `hashedQuantities` and `productQuantities` (the context re-derives the
 * former from the latter, so they must agree) and reverted if the save fails.
 * Pending saves are flushed on blur and when the panel unmounts (tab switch).
 */
export function useQuantitySaver(delay = SAVE_DELAY_MS) {
  const {
    selectedHistory,
    hashedQuantities,
    setHashedQuantities,
    setProductQuantities,
    notify,
  } = useProcurement();
  const { accessToken } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();
  const [status, setStatus] = useState<Record<string, QuantitySaveStatus>>({});

  const pending = useRef(new Map<string, PendingSave>());
  /** Last quantity the server confirmed, per product (for reverting). */
  const confirmed = useRef(new Map<string, number | null>());
  const versions = useRef(new Map<string, number>());
  const savedTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  // Read at save time so a save flushed on unmount still has fresh values.
  const latest = useRef({
    accessToken,
    fetchWithCreds,
    orderId: selectedHistory?.id,
  });
  latest.current = {
    accessToken,
    fetchWithCreds,
    orderId: selectedHistory?.id,
  };
  const quantities = useRef(hashedQuantities);
  quantities.current = hashedQuantities;

  const setRowStatus = useCallback(
    (productId: string, value: QuantitySaveStatus | undefined) => {
      setStatus((curr) => {
        if (curr[productId] === value) return curr;
        const next = { ...curr };
        if (value == null) delete next[productId];
        else next[productId] = value;
        return next;
      });
    },
    [],
  );

  const applyQuantity = useCallback(
    (orderId: string, productId: string, quantity: number | null) => {
      setProductQuantities((curr) =>
        curr.map((pq) =>
          pq.orderId === orderId && pq.productId === productId
            ? { ...pq, quantity }
            : pq,
        ),
      );
      setHashedQuantities((curr) => ({ ...curr, [productId]: quantity }));
    },
    [setHashedQuantities, setProductQuantities],
  );

  const save = useCallback(
    async (productId: string) => {
      const entry = pending.current.get(productId);
      if (entry == null) return;
      clearTimeout(entry.timer);
      pending.current.delete(productId);
      const version = (versions.current.get(productId) ?? 0) + 1;
      versions.current.set(productId, version);
      clearTimeout(savedTimers.current.get(productId));
      setRowStatus(productId, 'saving');

      const result = await editProductQuantityUtil({
        accessToken: latest.current.accessToken,
        orderId: entry.orderId,
        productId,
        // The column is `Int?`; an emptied field is saved as null.
        quantity: entry.quantity as number,
        setSnackbarOpen: silent,
        setSnackbarMessage: silent,
        fetchWithCreds: latest.current.fetchWithCreds,
      });

      // A newer edit is pending or in flight: it owns the row now.
      if (
        versions.current.get(productId) !== version ||
        pending.current.has(productId)
      ) {
        if (result != null) confirmed.current.set(productId, result.quantity);
        return;
      }
      if (result != null) {
        confirmed.current.set(productId, result.quantity);
        setRowStatus(productId, 'saved');
        savedTimers.current.set(
          productId,
          setTimeout(
            () => setRowStatus(productId, undefined),
            SAVED_VISIBLE_MS,
          ),
        );
        return;
      }
      setRowStatus(productId, undefined);
      if (latest.current.orderId === entry.orderId) {
        applyQuantity(
          entry.orderId,
          productId,
          confirmed.current.get(productId) ?? null,
        );
      }
      notify('failedToUpdateQuantity', 'error');
    },
    [applyQuantity, notify, setRowStatus],
  );

  /** Call on every keystroke: updates the field now, saves after a pause. */
  const changeQuantity = useCallback(
    (productId: string, quantity: number | null) => {
      const { orderId } = latest.current;
      if (orderId == null) return;
      if (!confirmed.current.has(productId)) {
        confirmed.current.set(productId, quantities.current[productId] ?? null);
      }
      applyQuantity(orderId, productId, quantity);
      clearTimeout(pending.current.get(productId)?.timer);
      pending.current.set(productId, {
        orderId,
        quantity,
        timer: setTimeout(() => save(productId), delay),
      });
    },
    [applyQuantity, delay, save],
  );

  /** Saves right away if this product has an edit waiting (e.g. on blur). */
  const flush = useCallback(
    (productId: string) => {
      if (pending.current.has(productId)) save(productId);
    },
    [save],
  );

  /** Drops a waiting edit (the product is being removed from the order). */
  const cancel = useCallback(
    (productId: string) => {
      clearTimeout(pending.current.get(productId)?.timer);
      pending.current.delete(productId);
      setRowStatus(productId, undefined);
    },
    [setRowStatus],
  );

  // Another order was opened: its server values are the new baseline.
  useEffect(() => {
    confirmed.current.clear();
  }, [selectedHistory?.id]);

  // Switching tabs unmounts the panel; don't lose edits still waiting.
  useEffect(() => {
    const pendingSaves = pending.current;
    const saved = savedTimers.current;
    return () => {
      Array.from(pendingSaves.keys()).forEach((productId) => save(productId));
      saved.forEach((timer) => clearTimeout(timer));
    };
    // `save` only reads refs and stable setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status, changeQuantity, flush, cancel };
}
