import { fetchProductsCount } from '@/pages/lib/apis';
import { useEffect, useSyncExternalStore } from 'react';

// Whether anything at all is on sale, shared by every consumer: one request per
// app load, none per navigation. Module-level, so it resets on a hard reload.
// null until an answer is known.
let available: boolean | null = null;
let isLoading = false;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Records an answer a page already has, so it needn't be asked for. */
export function reportSaleAvailability(next: boolean) {
  if (available === next) return;
  available = next;
  listeners.forEach((listener) => listener());
}

/** Forgets the cached answer. Tests only. */
export function resetSaleAvailability() {
  available = null;
  isLoading = false;
}

async function loadSaleAvailability() {
  if (available != null || isLoading) return;
  isLoading = true;
  try {
    const count = await fetchProductsCount({ sale: true });
    // A page may have reported fresher data while this was in flight.
    if (available == null) reportSaleAvailability(count > 0);
  } catch (error) {
    // Stays unknown, so the next consumer to mount tries again.
    console.warn('Failed to check for products on sale:', error);
  } finally {
    isLoading = false;
  }
}

/** False until it is known that something is on sale (always on the server). */
export function useSaleAvailability(): boolean {
  const value = useSyncExternalStore(
    subscribe,
    () => available === true,
    () => false,
  );

  useEffect(() => {
    // After the whole commit's effects, so that a page reporting its own data
    // (home) goes first and saves the request.
    queueMicrotask(loadSaleAvailability);
  }, []);

  return value;
}
