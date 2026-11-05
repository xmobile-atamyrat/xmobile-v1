import { usePlatform } from '@/pages/lib/PlatformContext';
import MarkPicker, {
  MarkPickerTarget,
} from '@/pages/procurement/components/prices/MarkPicker';
import PricesCards from '@/pages/procurement/components/prices/PricesCards';
import PricesSummary from '@/pages/procurement/components/prices/PricesSummary';
import PricesTable from '@/pages/procurement/components/prices/PricesTable';
import { usePriceEditing } from '@/pages/procurement/components/prices/usePriceEditing';
import {
  isOrdered,
  matchesFilter,
  PricesFilter,
  summarizePrices,
} from '@/pages/procurement/lib/priceInput';
import { useProcurement } from '@/pages/procurement/lib/ProcurementContext';
import { procurementClasses as c } from '@/styles/classMaps/procurement';
import { pricesClasses as pc } from '@/styles/classMaps/procurement/prices';
import { fontClassName } from '@/styles/theme';
import { Box, Typography } from '@mui/material';
import { OrderPriceColor } from '@prisma/client';
import { CheckCircle2, Store, Tags } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useState } from 'react';

function EmptyState({ icon: Icon, text }: { icon: typeof Tags; text: string }) {
  return (
    <Box className={`${pc.emptyCard} ${c.empty}`}>
      <Box className={c.emptyIcon}>
        <Icon className="w-6 h-6" />
      </Box>
      <Typography className={`${fontClassName.className} text-[14px]`}>
        {text}
      </Typography>
    </Box>
  );
}

/**
 * Prices tab: price per product x supplier, with the cheapest marked.
 * Phones get a card per product, desktop the matrix. Reads everything from
 * useProcurement(); takes no props.
 */
export default function PricesPanel(): JSX.Element | null {
  const t = useTranslations();
  const platform = usePlatform();
  const {
    selectedHistory,
    selectedProducts,
    selectedSuppliers,
    prices,
    hashedQuantities,
  } = useProcurement();
  const editing = usePriceEditing();

  const [filter, setFilter] = useState<PricesFilter>('all');
  // Products edited while a filter is on stay visible until the filter
  // changes, so filling the last missing price doesn't yank the card away.
  const [kept, setKept] = useState<Set<string>>(() => new Set());
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [picker, setPicker] = useState<MarkPickerTarget>();

  const orderId = selectedHistory?.id;
  const currency = selectedHistory?.currency ?? '';

  const summary = useMemo(
    () =>
      summarizePrices({
        orderId: orderId ?? '',
        productIds: selectedProducts.map(({ id }) => id),
        supplierIds: selectedSuppliers.map(({ id }) => id),
        prices,
        quantities: hashedQuantities,
      }),
    [orderId, selectedProducts, selectedSuppliers, prices, hashedQuantities],
  );

  // Ordered products first (stable), unordered ones sink to the bottom.
  const visibleProducts = useMemo(
    () =>
      selectedProducts
        .filter(({ id }) => kept.has(id) || matchesFilter(filter, id, summary))
        .sort(
          (a, b) =>
            Number(!isOrdered(hashedQuantities[a.id])) -
            Number(!isOrdered(hashedQuantities[b.id])),
        ),
    [selectedProducts, kept, filter, summary, hashedQuantities],
  );

  const changeFilter = useCallback((next: PricesFilter) => {
    setFilter(next);
    setKept(new Set());
  }, []);

  const keep = useCallback(
    (productId: string) => {
      if (filter === 'all') return;
      setKept((curr) =>
        curr.has(productId) ? curr : new Set(curr).add(productId),
      );
    },
    [filter],
  );

  const toggleExpanded = useCallback((productId: string) => {
    setExpanded((curr) => {
      const next = new Set(curr);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }, []);

  const pickMark = useCallback(
    (color: OrderPriceColor) => {
      if (picker == null) return;
      keep(picker.productId);
      editing.changeColor(picker, color);
      setPicker(undefined);
    },
    [editing, keep, picker],
  );

  if (selectedHistory == null) return null;

  if (selectedProducts.length === 0 || selectedSuppliers.length === 0) {
    return (
      <EmptyState
        icon={selectedProducts.length === 0 ? Tags : Store}
        text={t('noProductsOrSuppliers')}
      />
    );
  }

  const viewProps = {
    products: visibleProducts,
    suppliers: selectedSuppliers,
    prices,
    quantities: hashedQuantities,
    currency,
    editing,
    onEdited: keep,
    onOpenPicker: setPicker,
  };

  return (
    <Box className="flex flex-col gap-3 min-w-0" data-testid="prices-panel">
      <PricesSummary
        summary={summary}
        currency={currency}
        filter={filter}
        onFilter={changeFilter}
      />

      {visibleProducts.length === 0 && (
        <EmptyState
          icon={filter === 'missing' ? CheckCircle2 : Tags}
          text={t(
            filter === 'missing'
              ? 'procurementNoMissingPrices'
              : 'procurementNothingChosen',
          )}
        />
      )}

      {visibleProducts.length > 0 &&
        (platform === 'mobile' ? (
          <PricesCards
            {...viewProps}
            expanded={expanded}
            onToggleExpanded={toggleExpanded}
          />
        ) : (
          <PricesTable {...viewProps} />
        ))}

      <MarkPicker
        target={picker}
        onClose={() => setPicker(undefined)}
        onPick={pickMark}
      />
    </Box>
  );
}
