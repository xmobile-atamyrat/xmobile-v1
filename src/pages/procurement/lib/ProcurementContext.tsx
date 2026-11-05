import { useDollarRateContext } from '@/pages/lib/DollarRateContext';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import {
  createHistoryUtil,
  createProductQuantityUtil,
  createProductUtil,
  createSupplierUtil,
  deleteProductUtil,
  deleteSupplierUtil,
  editDollarRateUtil,
  editHistoryUtil,
  editProductUtil,
  editSupplierUtil,
  getHistoryListUtil,
  getHistoryUtil,
  handleProductSearchUtil,
  handleSupplierSearchUtil,
} from '@/pages/procurement/lib/apiUtils';
import {
  DetailedOrder,
  HistoryPrice,
  ProductsSuppliersType,
} from '@/pages/procurement/lib/types';
import { priceHash } from '@/pages/procurement/lib/utils';
import { debounce } from '@/pages/product/utils';
import {
  CURRENCY,
  DollarRate,
  ProcurementOrder,
  ProcurementOrderProductQuantity,
  ProcurementProduct,
  ProcurementSupplier,
} from '@prisma/client';
import {
  createContext,
  Dispatch,
  ReactNode,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type CatalogItem = ProcurementProduct | ProcurementSupplier;

/**
 * Everything the procurement screen shares: the open order, its products,
 * suppliers, quantities and prices, plus the sheets that are open and the
 * catalog search. Panels read and update this through `useProcurement()`
 * instead of threading a dozen setters through props.
 *
 * Mutations that belong to a single panel (a quantity edit, a price edit,
 * removing a row from the order) live in that panel and use the setters here.
 */
export interface ProcurementContextValue {
  // --- order data ---
  historyList: ProcurementOrder[];
  setHistoryList: Dispatch<SetStateAction<ProcurementOrder[]>>;
  selectedHistory: DetailedOrder | undefined;
  setSelectedHistory: Dispatch<SetStateAction<DetailedOrder | undefined>>;
  selectedProducts: ProcurementProduct[];
  setSelectedProducts: Dispatch<SetStateAction<ProcurementProduct[]>>;
  selectedSuppliers: ProcurementSupplier[];
  setSelectedSuppliers: Dispatch<SetStateAction<ProcurementSupplier[]>>;
  productQuantities: ProcurementOrderProductQuantity[];
  setProductQuantities: Dispatch<
    SetStateAction<ProcurementOrderProductQuantity[]>
  >;
  /** productId -> quantity (null while the field is empty). */
  hashedQuantities: Record<string, number | null>;
  setHashedQuantities: Dispatch<SetStateAction<Record<string, number | null>>>;
  /** priceHash({orderId, productId, supplierId}) -> { value, color }. */
  prices: HistoryPrice;
  setPrices: Dispatch<SetStateAction<HistoryPrice>>;
  /** True until the first order list (and latest order) has loaded. */
  initialLoading: boolean;

  // --- currency ---
  rates: DollarRate[];
  orderCurrencyRate: DollarRate | undefined;
  /** Optimistically sets the rate of the order's currency, reverts on failure. */
  changeRate: (newRate: number | undefined) => Promise<void>;
  changeCurrency: (currency: CURRENCY) => Promise<void>;

  // --- orders (history) ---
  selectOrder: (id: string) => Promise<void>;
  /** Resolves to the new order (prepended + selected), or undefined on failure. */
  createOrder: (name: string) => Promise<ProcurementOrder | undefined>;

  // --- catalog (procurement products / suppliers "base") ---
  catalogType: ProductsSuppliersType | undefined;
  openCatalog: (type: ProductsSuppliersType) => void;
  closeCatalog: () => void;
  searchedItems: CatalogItem[];
  searchCatalog: (keyword: string) => void;
  /** Creates the item in the base; resolves to it (undefined on failure). */
  createCatalogItem: (name: string) => Promise<CatalogItem | undefined>;
  addCatalogItemToOrder: (item: CatalogItem) => Promise<void>;
  editCatalogItem: (item: {
    id: string;
    name: string;
    description?: string;
  }) => Promise<void>;
  deleteCatalogItem: (id: string) => Promise<void>;

  // --- sheets ---
  ordersSheetOpen: boolean;
  setOrdersSheetOpen: Dispatch<SetStateAction<boolean>>;
  newOrderDialogOpen: boolean;
  setNewOrderDialogOpen: Dispatch<SetStateAction<boolean>>;

  // --- feedback ---
  /** Full-screen blocking spinner for long actions (upload, calculate). */
  loading: boolean;
  setLoading: Dispatch<SetStateAction<boolean>>;
  /** `message` is an i18n key, like everywhere else on this page. */
  notify: (message: string, severity: SnackbarProps['severity']) => void;
  snackbarOpen: boolean;
  setSnackbarOpen: Dispatch<SetStateAction<boolean>>;
  snackbarMessage: SnackbarProps | undefined;
  setSnackbarMessage: Dispatch<SetStateAction<SnackbarProps>>;
}

const ProcurementContext = createContext<ProcurementContextValue | undefined>(
  undefined,
);

export function ProcurementProvider({ children }: { children: ReactNode }) {
  const { user, accessToken } = useUserContext();
  const { rates, setRates } = useDollarRateContext();
  const fetchWithCreds = useFetchWithCreds();

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<SnackbarProps>();
  const [selectedSuppliers, setSelectedSuppliers] = useState<
    ProcurementSupplier[]
  >([]);
  const [selectedProducts, setSelectedProducts] = useState<
    ProcurementProduct[]
  >([]);
  const [searchedSuppliers, setSearchedSuppliers] = useState<
    ProcurementSupplier[]
  >([]);
  const [searchedProducts, setSearchedProducts] = useState<
    ProcurementProduct[]
  >([]);
  const [historyList, setHistoryList] = useState<ProcurementOrder[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<DetailedOrder>();
  const [ordersSheetOpen, setOrdersSheetOpen] = useState(false);
  const [catalogType, setCatalogType] = useState<ProductsSuppliersType>();
  const [productQuantities, setProductQuantities] = useState<
    ProcurementOrderProductQuantity[]
  >([]);
  const [prices, setPrices] = useState<HistoryPrice>({});
  const [newOrderDialogOpen, setNewOrderDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [hashedQuantities, setHashedQuantities] = useState<
    Record<string, number | null>
  >({});
  const [orderCurrencyRate, setOrderCurrencyRate] = useState<DollarRate>();

  const notify = useCallback(
    (message: string, severity: SnackbarProps['severity']) => {
      setSnackbarMessage({ message, severity });
      setSnackbarOpen(true);
    },
    [],
  );

  const loadOrder = useCallback(
    async (id: string) => {
      await getHistoryUtil({
        accessToken,
        id,
        setSelectedHistory,
        setSelectedSuppliers,
        setSelectedProducts,
        setSnackbarOpen,
        setSnackbarMessage,
        setProductQuantities,
        fetchWithCreds,
      });
    },
    [accessToken, fetchWithCreds],
  );

  useEffect(() => {
    if (user?.grade !== 'SUPERUSER' || !accessToken) return;
    (async () => {
      const latestHistory = await getHistoryListUtil({
        accessToken,
        setHistoryList,
        setSnackbarOpen,
        setSnackbarMessage,
        fetchWithCreds,
      });
      // `?order=<id>` opens a specific order (deep link); default is the latest.
      const requested = new URLSearchParams(window.location.search).get(
        'order',
      );
      const orderId = requested || latestHistory?.id;
      if (orderId) await loadOrder(orderId);
      setInitialLoading(false);
    })();
    // Load once per sign-in; a silently refreshed token must not reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(accessToken), user?.grade]);

  // Rebuild `prices` only when another order (or a fresh server copy of its
  // prices) arrives. Keyed on the whole selectedHistory, a currency switch or
  // rename — which spread the stale snapshot loaded with the order — wiped
  // every price entered or uploaded since, though the DB still had them.
  const selectedHistoryId = selectedHistory?.id;
  const selectedHistoryPrices = selectedHistory?.prices;
  useEffect(() => {
    if (selectedHistory == null) return;
    setOrderCurrencyRate(
      rates.find((rate) => rate.currency === selectedHistory.currency),
    );
    if (selectedHistory.prices == null) {
      setPrices({});
      return;
    }
    const newPrices: HistoryPrice = {};
    selectedHistory.prices.forEach(
      ({ orderId, productId, supplierId, price, color }) => {
        newPrices[priceHash({ orderId, productId, supplierId })] = {
          value: price,
          color,
        };
      },
    );
    setPrices(newPrices);
    // `rates` is read for the initial match only; changeCurrency/changeRate
    // keep orderCurrencyRate in step afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHistoryId, selectedHistoryPrices]);

  useEffect(() => {
    if (selectedHistory == null || orderCurrencyRate != null) return;
    setOrderCurrencyRate(
      rates.find((rate) => rate.currency === selectedHistory.currency),
    );
  }, [rates, selectedHistory, orderCurrencyRate]);

  useEffect(() => {
    setHashedQuantities((currQuantities) => {
      const next = { ...currQuantities };
      productQuantities.forEach(({ productId, quantity }) => {
        next[productId] = quantity;
      });
      return next;
    });
  }, [productQuantities]);

  const changeRate = useCallback(
    async (newRate: number | undefined) => {
      if (orderCurrencyRate == null) return;
      const previous = orderCurrencyRate;
      setOrderCurrencyRate({ ...previous, rate: newRate });
      if (newRate == null) return;
      const applyRate = (rate: number) =>
        setRates((curr) =>
          curr.map((r) =>
            r.currency === previous.currency ? { ...r, rate } : r,
          ),
        );
      applyRate(newRate);
      const updatedRate = await editDollarRateUtil({
        accessToken,
        currency: previous.currency,
        rate: newRate,
        fetchWithCreds,
        setSnackbarMessage,
        setSnackbarOpen,
      });
      if (updatedRate == null) {
        setOrderCurrencyRate(previous);
        applyRate(previous.rate);
      }
    },
    [accessToken, fetchWithCreds, orderCurrencyRate, setRates],
  );

  const changeCurrency = useCallback(
    async (newCurrency: CURRENCY) => {
      // No orderCurrencyRate guard: an order whose currency has no rate yet
      // (e.g. USD missing from `rates`) must still be able to switch away.
      if (selectedHistory == null) return;
      const oldRate = orderCurrencyRate;
      const oldCurrency = selectedHistory.currency;
      setSelectedHistory((curr) => ({ ...curr, currency: newCurrency }));
      setOrderCurrencyRate(rates.find((rate) => rate.currency === newCurrency));
      const updatedHistory = await editHistoryUtil({
        accessToken,
        id: selectedHistory.id,
        currency: newCurrency,
        setSnackbarMessage,
        setSnackbarOpen,
        fetchWithCreds,
      });
      if (updatedHistory == null) {
        setSelectedHistory((curr) => ({ ...curr, currency: oldCurrency }));
        setOrderCurrencyRate(oldRate);
      }
    },
    [accessToken, fetchWithCreds, orderCurrencyRate, rates, selectedHistory],
  );

  const createOrder = useCallback(
    async (name: string) => {
      const created = await createHistoryUtil({
        accessToken,
        name,
        setHistory: setHistoryList,
        setSelectedHistory,
        setSnackbarOpen,
        setSnackbarMessage,
        fetchWithCreds,
      });
      // On failure keep the current order on screen (it used to be wiped).
      if (created == null) return undefined;
      setSelectedProducts([]);
      setSelectedSuppliers([]);
      setProductQuantities([]);
      setHashedQuantities({});
      setPrices({});
      return created;
    },
    [accessToken, fetchWithCreds],
  );

  const selectOrder = useCallback(
    async (id: string) => {
      setHashedQuantities({});
      await loadOrder(id);
    },
    [loadOrder],
  );

  // --- catalog ---
  const searchProducts = useMemo(
    () =>
      debounce(async (keyword: string) => {
        await handleProductSearchUtil({
          accessToken,
          keyword,
          setProducts: setSearchedProducts,
          setSnackbarOpen,
          setSnackbarMessage,
          fetchWithCreds,
        });
      }, 300),
    [accessToken, fetchWithCreds],
  );

  const searchSuppliers = useMemo(
    () =>
      debounce(async (keyword: string) => {
        await handleSupplierSearchUtil({
          accessToken,
          keyword,
          setSuppliers: setSearchedSuppliers,
          setSnackbarOpen,
          setSnackbarMessage,
          fetchWithCreds,
        });
      }, 300),
    [accessToken, fetchWithCreds],
  );

  const searchCatalog = useCallback(
    (keyword: string) => {
      if (catalogType === 'product') searchProducts(keyword);
      else if (catalogType === 'supplier') searchSuppliers(keyword);
    },
    [catalogType, searchProducts, searchSuppliers],
  );

  const createCatalogItem = useCallback(
    async (name: string): Promise<CatalogItem | undefined> => {
      if (catalogType === 'product') {
        return createProductUtil({
          accessToken,
          keyword: name,
          setProducts: setSearchedProducts,
          setSnackbarOpen,
          setSnackbarMessage,
          fetchWithCreds,
        });
      }
      if (catalogType === 'supplier') {
        return createSupplierUtil({
          accessToken,
          keyword: name,
          setSupplier: setSearchedSuppliers,
          setSnackbarOpen,
          setSnackbarMessage,
          fetchWithCreds,
        });
      }
      return undefined;
    },
    [accessToken, catalogType, fetchWithCreds],
  );

  const addCatalogItemToOrder = useCallback(
    async (item: CatalogItem) => {
      if (selectedHistory == null) return;
      if (catalogType === 'product') {
        await editHistoryUtil({
          id: selectedHistory.id,
          accessToken,
          addedProductIds: [item.id],
          setSnackbarMessage,
          setSnackbarOpen,
          fetchWithCreds,
        });
        const productQuantity = await createProductQuantityUtil({
          accessToken,
          orderId: selectedHistory.id,
          productId: item.id,
          setSnackbarMessage,
          setSnackbarOpen,
          fetchWithCreds,
        });
        if (productQuantity) {
          setSelectedProducts((prev) => [item as ProcurementProduct, ...prev]);
          setProductQuantities((prev) => [productQuantity, ...prev]);
        }
      } else if (catalogType === 'supplier') {
        const updated = await editHistoryUtil({
          id: selectedHistory.id,
          accessToken,
          addedSupplierIds: [item.id],
          setSnackbarMessage,
          setSnackbarOpen,
          fetchWithCreds,
        });
        if (updated) {
          setSelectedSuppliers((prev) => [
            item as ProcurementSupplier,
            ...prev,
          ]);
        }
      }
    },
    [accessToken, catalogType, fetchWithCreds, selectedHistory],
  );

  const editCatalogItem = useCallback(
    async ({
      id,
      name,
      description,
    }: {
      id: string;
      name: string;
      description?: string;
    }) => {
      if (catalogType === 'product') {
        const edited = await editProductUtil({
          accessToken,
          id,
          name,
          setSnackbarMessage,
          setSnackbarOpen,
          fetchWithCreds,
        });
        if (edited) {
          const swap = (list: ProcurementProduct[]) =>
            list.map((p) => (p.id === edited.id ? edited : p));
          setSearchedProducts(swap);
          setSelectedProducts(swap);
        }
      } else if (catalogType === 'supplier') {
        const edited = await editSupplierUtil({
          accessToken,
          id,
          name,
          description,
          setSnackbarMessage,
          setSnackbarOpen,
          fetchWithCreds,
        });
        if (edited) {
          const swap = (list: ProcurementSupplier[]) =>
            list.map((s) => (s.id === edited.id ? edited : s));
          setSearchedSuppliers(swap);
          setSelectedSuppliers(swap);
        }
      }
    },
    [accessToken, catalogType, fetchWithCreds],
  );

  const deleteCatalogItem = useCallback(
    async (id: string) => {
      if (catalogType === 'product') {
        const deleted = await deleteProductUtil({
          accessToken,
          id,
          setSnackbarMessage,
          setSnackbarOpen,
          fetchWithCreds,
        });
        if (deleted) {
          setSearchedProducts((list) => list.filter((p) => p.id !== id));
          setSelectedProducts((list) => list.filter((p) => p.id !== id));
        }
      } else if (catalogType === 'supplier') {
        const deleted = await deleteSupplierUtil({
          accessToken,
          id,
          fetchWithCreds,
          setSnackbarMessage,
          setSnackbarOpen,
        });
        if (deleted) {
          setSearchedSuppliers((list) => list.filter((s) => s.id !== id));
          setSelectedSuppliers((list) => list.filter((s) => s.id !== id));
        }
      }
    },
    [accessToken, catalogType, fetchWithCreds],
  );

  const openCatalog = useCallback((type: ProductsSuppliersType) => {
    setCatalogType(type);
  }, []);

  const closeCatalog = useCallback(() => {
    setCatalogType(undefined);
    setSearchedProducts([]);
    setSearchedSuppliers([]);
  }, []);

  const value = useMemo<ProcurementContextValue>(
    () => ({
      historyList,
      setHistoryList,
      selectedHistory,
      setSelectedHistory,
      selectedProducts,
      setSelectedProducts,
      selectedSuppliers,
      setSelectedSuppliers,
      productQuantities,
      setProductQuantities,
      hashedQuantities,
      setHashedQuantities,
      prices,
      setPrices,
      initialLoading,
      rates,
      orderCurrencyRate,
      changeRate,
      changeCurrency,
      selectOrder,
      createOrder,
      catalogType,
      openCatalog,
      closeCatalog,
      searchedItems:
        catalogType === 'supplier' ? searchedSuppliers : searchedProducts,
      searchCatalog,
      createCatalogItem,
      addCatalogItemToOrder,
      editCatalogItem,
      deleteCatalogItem,
      ordersSheetOpen,
      setOrdersSheetOpen,
      newOrderDialogOpen,
      setNewOrderDialogOpen,
      loading,
      setLoading,
      notify,
      snackbarOpen,
      setSnackbarOpen,
      snackbarMessage,
      setSnackbarMessage,
    }),
    [
      historyList,
      selectedHistory,
      selectedProducts,
      selectedSuppliers,
      productQuantities,
      hashedQuantities,
      prices,
      initialLoading,
      rates,
      orderCurrencyRate,
      changeRate,
      changeCurrency,
      selectOrder,
      createOrder,
      catalogType,
      openCatalog,
      closeCatalog,
      searchedSuppliers,
      searchedProducts,
      searchCatalog,
      createCatalogItem,
      addCatalogItemToOrder,
      editCatalogItem,
      deleteCatalogItem,
      ordersSheetOpen,
      newOrderDialogOpen,
      loading,
      notify,
      snackbarOpen,
      snackbarMessage,
    ],
  );

  return (
    <ProcurementContext.Provider value={value}>
      {children}
    </ProcurementContext.Provider>
  );
}

export function useProcurement(): ProcurementContextValue {
  const context = useContext(ProcurementContext);
  if (!context) {
    throw new Error('useProcurement must be used within <ProcurementProvider>');
  }
  return context;
}
