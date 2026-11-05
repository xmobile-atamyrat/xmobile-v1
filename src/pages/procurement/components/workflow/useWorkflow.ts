import { hasNativeFiles, isInApp } from '@/pages/lib/nativeFiles';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { editProductPricesUtil } from '@/pages/procurement/lib/apiUtils';
import {
  buildEmptyOrderFiles,
  buildFinalOrderFiles,
  canShareFiles,
  countCheapestFound,
  countFilledPrices,
  downloadFiles,
  hasUncalculatedPrices,
  orderedProducts,
  readFilledOrderFiles,
  toXlsxFile,
  UploadResult,
} from '@/pages/procurement/lib/orderFiles';
import { useProcurement } from '@/pages/procurement/lib/ProcurementContext';
import { assignColorToPrices, priceHash } from '@/pages/procurement/lib/utils';
import { ProcurementSupplierProductPrice } from '@prisma/client';
import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export type StepKey = 'empty' | 'upload' | 'calculate' | 'final';

/** Files built and waiting in the share sheet (phones with Web Share). */
export interface ReadyFiles {
  kind: 'empty' | 'final';
  items: { file: File; supplierName: string; lines: number }[];
}

/**
 * State + actions behind the stepper. Everything is derived from the order
 * in ProcurementContext; the only local state is what happened in this
 * session (files handed out, last upload result, files ready to share).
 */
export function useWorkflow() {
  const platform = usePlatform();
  const { accessToken } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();
  const {
    selectedHistory,
    selectedProducts,
    selectedSuppliers,
    hashedQuantities,
    prices,
    setPrices,
    setLoading,
    notify,
    setSnackbarMessage,
    setSnackbarOpen,
  } = useProcurement();

  const orderId = selectedHistory?.id;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sentEmpty, setSentEmpty] = useState(false);
  const [sentFinal, setSentFinal] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult>();
  const [readyFiles, setReadyFiles] = useState<ReadyFiles>();

  // "Handed out" flags belong to the order that was open.
  useEffect(() => {
    setSentEmpty(false);
    setSentFinal(false);
    setUploadResult(undefined);
    setReadyFiles(undefined);
  }, [orderId]);

  const productIds = useMemo(
    () => selectedProducts.map(({ id }) => id),
    [selectedProducts],
  );
  const supplierIds = useMemo(
    () => selectedSuppliers.map(({ id }) => id),
    [selectedSuppliers],
  );

  const stats = useMemo(() => {
    // Progress counts only what goes into the files: products with a quantity.
    const ordered = orderedProducts(selectedProducts, hashedQuantities);
    const grid = {
      orderId: orderId ?? '',
      productIds: ordered.map(({ id }) => id),
      supplierIds,
      prices,
    };
    const finalFiles = orderId
      ? buildFinalOrderFiles({
          orderId,
          products: selectedProducts,
          suppliers: selectedSuppliers,
          quantities: hashedQuantities,
          prices,
        })
      : [];
    return {
      linesToOrder: ordered.length,
      filled: countFilledPrices(grid),
      cells: ordered.length * supplierIds.length,
      cheapest: countCheapestFound(grid),
      stale: hasUncalculatedPrices(grid),
      finalFiles: finalFiles.length,
      finalLines: finalFiles.reduce((sum, f) => sum + f.productIds.length, 0),
    };
  }, [
    orderId,
    supplierIds,
    prices,
    selectedProducts,
    selectedSuppliers,
    hashedQuantities,
  ]);

  const deliver = useCallback(
    async (
      kind: ReadyFiles['kind'],
      data: ReturnType<typeof buildFinalOrderFiles>,
    ) => {
      // App versions before the XFileShare module can't get files out of the
      // WebView at all; say so instead of a download that silently does nothing.
      if (isInApp() && !hasNativeFiles()) {
        notify('procurementUpdateAppForFiles', 'warning');
        return false;
      }
      const built = (
        await Promise.all(
          data.map(async (item) => ({ item, file: await toXlsxFile(item) })),
        )
      ).filter((entry): entry is { item: typeof entry.item; file: File } =>
        Boolean(entry.file),
      );
      if (built.length === 0) {
        notify('serverError', 'error');
        return false;
      }
      const files = built.map(({ file }) => file);
      const names = new Map(selectedSuppliers.map((s) => [s.id, s.name]));
      if (platform === 'mobile' && (hasNativeFiles() || canShareFiles(files))) {
        // Share needs a fresh tap, so hand the built files to a sheet.
        setReadyFiles({
          kind,
          items: built.map(({ item, file }) => ({
            file,
            supplierName: names.get(item.supplierId) ?? file.name,
            lines: item.productIds.length,
          })),
        });
      } else {
        await downloadFiles(files);
      }
      return true;
    },
    [notify, platform, selectedSuppliers],
  );

  const downloadEmpty = useCallback(async () => {
    const { files, error } = buildEmptyOrderFiles({
      products: selectedProducts,
      suppliers: selectedSuppliers,
      quantities: hashedQuantities,
    });
    if (error) {
      notify(error, 'error');
      return;
    }
    setLoading(true);
    try {
      if (await deliver('empty', files)) setSentEmpty(true);
    } finally {
      setLoading(false);
    }
  }, [
    deliver,
    hashedQuantities,
    notify,
    selectedProducts,
    selectedSuppliers,
    setLoading,
  ]);

  const downloadFinal = useCallback(async () => {
    if (!orderId) return;
    const files = buildFinalOrderFiles({
      orderId,
      products: selectedProducts,
      suppliers: selectedSuppliers,
      quantities: hashedQuantities,
      prices,
    });
    if (files.length === 0) {
      notify('procurementNeedCalculate', 'error');
      return;
    }
    setLoading(true);
    try {
      if (await deliver('final', files)) setSentFinal(true);
    } finally {
      setLoading(false);
    }
  }, [
    deliver,
    hashedQuantities,
    notify,
    orderId,
    prices,
    selectedProducts,
    selectedSuppliers,
    setLoading,
  ]);

  const chooseFiles = useCallback(() => fileInputRef.current?.click(), []);

  const onFilesChosen = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const input = event.target;
      const files = Array.from(input.files ?? []);
      // Reset so picking the same file(s) again still fires onChange.
      input.value = '';
      if (!orderId || files.length === 0) return;
      setLoading(true);
      try {
        const result = await readFilledOrderFiles(orderId, files, {
          supplierIds,
          productIds,
        });
        const entries = Object.entries(result.prices);
        if (entries.length > 0) {
          const saved = await editProductPricesUtil({
            accessToken,
            // color: null — a new price makes the last calculation stale
            // (same as the local state below, which has no colour).
            updatedPrices: entries.map(([key, { value }]) => {
              const ids = JSON.parse(key);
              return { ...ids, price: value, color: null };
            }),
            setSnackbarMessage,
            setSnackbarOpen,
            fetchWithCreds,
          });
          if (!saved) return;
          setPrices((curr) => ({ ...curr, ...result.prices }));
        }
        setUploadResult(result);
      } finally {
        setLoading(false);
      }
    },
    [
      accessToken,
      fetchWithCreds,
      orderId,
      productIds,
      setLoading,
      setPrices,
      setSnackbarMessage,
      setSnackbarOpen,
      supplierIds,
    ],
  );

  const calculate = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const coloredPrices = assignColorToPrices({
        orderId,
        productIds,
        supplierIds,
        prices,
      });
      const updatedPriceColors: Partial<ProcurementSupplierProductPrice>[] = [];
      productIds.forEach((productId) => {
        supplierIds.forEach((supplierId) => {
          const color =
            coloredPrices[priceHash({ orderId, productId, supplierId })]?.color;
          if (color != null) {
            updatedPriceColors.push({ orderId, productId, supplierId, color });
          }
        });
      });
      const success = await editProductPricesUtil({
        accessToken,
        updatedPrices: updatedPriceColors,
        setSnackbarMessage,
        setSnackbarOpen,
        fetchWithCreds,
      });
      if (success) setPrices(coloredPrices);
    } finally {
      setLoading(false);
    }
  }, [
    accessToken,
    fetchWithCreds,
    orderId,
    prices,
    productIds,
    setLoading,
    setPrices,
    setSnackbarMessage,
    setSnackbarOpen,
    supplierIds,
  ]);

  return {
    hasOrder: orderId != null,
    stores: selectedSuppliers.length,
    products: selectedProducts.length,
    stats,
    sentEmpty,
    sentFinal,
    fileInputRef,
    downloadEmpty,
    chooseFiles,
    onFilesChosen,
    calculate,
    downloadFinal,
    uploadResult,
    closeUploadResult: () => setUploadResult(undefined),
    readyFiles,
    closeReadyFiles: () => setReadyFiles(undefined),
    supplierName: (id?: string) =>
      selectedSuppliers.find((s) => s.id === id)?.name,
  };
}
