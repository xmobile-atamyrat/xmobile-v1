import { useFetchWithCreds } from '@/pages/lib/fetch';
import { SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { editProductPricesUtil } from '@/pages/procurement/lib/apiUtils';
import {
  parsePriceInput,
  priceToInput,
  sanitizePriceInput,
} from '@/pages/procurement/lib/priceInput';
import { useProcurement } from '@/pages/procurement/lib/ProcurementContext';
import { priceHash } from '@/pages/procurement/lib/utils';
import {
  OrderPriceColor,
  ProcurementSupplierProductPrice,
} from '@prisma/client';
import { useCallback, useEffect, useRef, useState } from 'react';

export const PRICE_SAVE_DELAY_MS = 300;

export interface PriceCellKey {
  productId: string;
  supplierId: string;
}

type PriceUpdate = Partial<ProcurementSupplierProductPrice>;

/**
 * Price editing for the prices tab.
 *
 * - The field keeps the raw text while it's focused/being typed ("3," stays
 *   "3,"), the parsed number goes into `prices` right away.
 * - Saves are debounced PER CELL: pending edits are kept by cell, so editing
 *   cell A and then cell B within the delay saves both (the old shared
 *   debounce dropped A). All cells pending when the timer fires go out in one
 *   PUT, which is fewer round-trips on a slow connection.
 * - Editing a price clears its colour (locally and on the server).
 * - Colour changes are optimistic and revert if the save fails.
 * - Pending edits are flushed when the panel unmounts (tab switch).
 */
export function usePriceEditing() {
  const { accessToken } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();
  const { selectedHistory, prices, setPrices, notify } = useProcurement();
  const orderId = selectedHistory?.id;

  /** hash -> text being typed. Only cells currently being edited are here. */
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const pending = useRef(new Map<string, PriceUpdate>());
  const timer = useRef<ReturnType<typeof setTimeout>>();

  // Latest values for callbacks that outlive a render (timers, unmount).
  const latest = useRef({ accessToken, fetchWithCreds, notify });
  latest.current = { accessToken, fetchWithCreds, notify };
  const pricesRef = useRef(prices);
  pricesRef.current = prices;

  /** Saves quietly: the field itself is the feedback; only errors toast. */
  const save = useCallback(async (updatedPrices: PriceUpdate[]) => {
    let failure: SnackbarProps | undefined;
    const ok = await editProductPricesUtil({
      accessToken: latest.current.accessToken,
      updatedPrices,
      fetchWithCreds: latest.current.fetchWithCreds,
      setSnackbarOpen: () => {},
      setSnackbarMessage: (message) => {
        if (typeof message === 'object') failure = message;
      },
    });
    if (!ok) latest.current.notify(failure?.message ?? 'serverError', 'error');
    return ok;
  }, []);

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = undefined;
    if (pending.current.size === 0) return;
    const batch = Array.from(pending.current.values());
    pending.current.clear();
    save(batch);
  }, [save]);

  useEffect(() => flush, [flush]);

  const hashOf = useCallback(
    ({ productId, supplierId }: PriceCellKey) =>
      priceHash({ orderId: orderId ?? '', productId, supplierId }),
    [orderId],
  );

  const inputValue = useCallback(
    (cell: PriceCellKey): string => {
      const hash = hashOf(cell);
      return drafts[hash] ?? priceToInput(prices[hash]?.value);
    },
    [drafts, hashOf, prices],
  );

  const changePrice = useCallback(
    (cell: PriceCellKey, raw: string) => {
      if (orderId == null) return;
      const hash = hashOf(cell);
      const text = sanitizePriceInput(raw);
      setDrafts((curr) => ({ ...curr, [hash]: text }));
      const value = parsePriceInput(text);
      if (value === undefined) return;
      const current = pricesRef.current[hash];
      if (current?.value === value && (current?.color ?? 'white') === 'white')
        return;
      setPrices((curr) => ({
        ...curr,
        [hash]: { value, color: OrderPriceColor.white },
      }));
      pending.current.set(hash, {
        orderId,
        productId: cell.productId,
        supplierId: cell.supplierId,
        price: value,
        color: OrderPriceColor.white,
      });
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, PRICE_SAVE_DELAY_MS);
    },
    [flush, hashOf, orderId, setPrices],
  );

  /** On blur: drop the raw text so the field shows the stored number. */
  const commitPrice = useCallback(
    (cell: PriceCellKey) => {
      const hash = hashOf(cell);
      setDrafts((curr) => {
        if (!(hash in curr)) return curr;
        const next = { ...curr };
        delete next[hash];
        return next;
      });
    },
    [hashOf],
  );

  const changeColor = useCallback(
    async (cell: PriceCellKey, color: OrderPriceColor) => {
      if (orderId == null) return;
      const hash = hashOf(cell);
      const previous = pricesRef.current[hash]?.color;
      if (previous === color) return;
      setPrices((curr) => ({ ...curr, [hash]: { ...curr[hash], color } }));
      // A price typed into this cell that hasn't been sent yet goes with the
      // colour; otherwise its later "clear the colour" save would undo it.
      const pendingPrice = pending.current.get(hash);
      pending.current.delete(hash);
      const ok = await save([
        {
          orderId,
          productId: cell.productId,
          supplierId: cell.supplierId,
          ...(pendingPrice && { price: pendingPrice.price }),
          color,
        },
      ]);
      if (!ok) {
        setPrices((curr) =>
          curr[hash]?.color === color
            ? { ...curr, [hash]: { ...curr[hash], color: previous } }
            : curr,
        );
      }
    },
    [hashOf, orderId, save, setPrices],
  );

  return { hashOf, inputValue, changePrice, commitPrice, changeColor };
}
