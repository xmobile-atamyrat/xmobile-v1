import TikTokIcon from '@/pages/components/TikTokIcon';
import { fetchBrands, fetchColors, fetchPrices } from '@/pages/lib/apis';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import {
  curlyBracketRegex,
  squareBracketRegex,
  defaultProductDescCh,
  defaultProductDescEn,
  defaultProductDescRu,
  defaultProductDescTk,
  defaultProductDescTr,
} from '@/pages/lib/constants';

import { useFetchWithCreds } from '@/pages/lib/fetch';
import { getProductMediaUrl } from '@/pages/lib/mediaUrls';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { usePrevProductContext } from '@/pages/lib/PrevProductContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import {
  AddEditProductProps,
  ExtendedCategory,
  PriceWithOwner,
} from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import {
  addEditBrand,
  addEditProduct,
  deleteBrand,
  isNumeric,
  parseName,
  VisuallyHiddenInput,
} from '@/pages/lib/utils';
import { addEditProductDialogClasses } from '@/styles/classMaps/components/addEditProductDialog';
import {
  Check,
  Close,
  DeleteOutlined,
  Edit,
  Instagram,
  YouTube,
} from '@mui/icons-material';
import CancelIcon from '@mui/icons-material/Cancel';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { LoadingButton } from '@mui/lab';
import {
  Box,
  Button,
  CardMedia,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  ListSubheader,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import type { Color, Prices, Product } from '@prisma/client';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';

interface AddEditProductDialogProps {
  handleClose: () => void;
  args: AddEditProductProps;
  snackbarErrorHandler?: (message: string) => void;
  setProduct?: (product: Product) => void;
}

// Searchable price dropdown: a Select with a filter box pinned to the top of
// the menu. Used for both the base price and per-variant prices.
//
// The options are every price in the product's category. A price another
// product already owns is listed but not selectable — the reassignment guard on
// PUT /api/prices would refuse it anyway, and showing it with the owner's name
// answers "why isn't the price I just made showing up" far better than hiding
// it does.
function PriceSelect({
  value,
  onChange,
  priceOptions,
  ownProductId,
  locale,
  blocked = false,
  onBlockedOpen,
  sx,
}: {
  value: string; // selected priceId, or '' for none
  onChange: (priceId: string) => void;
  priceOptions: PriceWithOwner[];
  /** The product being edited; its own prices stay selectable. */
  ownProductId?: string;
  locale: string;
  /** No category picked yet, so there is no list to offer. */
  blocked?: boolean;
  onBlockedOpen?: () => void;
  sx?: object;
}) {
  const t = useTranslations();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const filtered = priceOptions.filter((p) =>
    `${p.name} ${p.priceInTmt}`.toLowerCase().includes(search.toLowerCase()),
  );

  // Null when the price is free to take (unowned, or owned by this product).
  const takenBy = (price: PriceWithOwner) =>
    price.product != null && price.product.id !== ownProductId
      ? parseName(price.product.name, locale)
      : null;

  return (
    <Select
      size="small"
      displayEmpty
      value={value}
      sx={sx}
      open={open}
      onOpen={() => {
        // Refusing to open is the whole point: the list is category-scoped, so
        // without a category there is nothing meaningful to show.
        if (blocked) {
          onBlockedOpen?.();
          return;
        }
        setOpen(true);
      }}
      onChange={(e) => onChange(e.target.value)}
      onClose={() => {
        setOpen(false);
        setSearch('');
      }}
      MenuProps={{
        autoFocus: false,
        PaperProps: { style: { maxHeight: 320 } },
      }}
      renderValue={(selected) => {
        const p = priceOptions.find((o) => o.id === selected);
        return p ? (
          `${p.name} — ${p.priceInTmt} ${t('manat')}`
        ) : (
          <em>{t('price')}</em>
        );
      }}
    >
      <ListSubheader sx={{ p: 1 }}>
        <TextField
          size="small"
          autoFocus
          fullWidth
          placeholder={t('search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            // Let the menu handle Escape; swallow the rest so the Select's
            // built-in type-ahead doesn't hijack typing.
            if (e.key !== 'Escape') e.stopPropagation();
          }}
        />
      </ListSubheader>
      <MenuItem value="">
        <em>{t('price')}</em>
      </MenuItem>
      {filtered.map((priceOpt) => {
        const owner = takenBy(priceOpt);
        return (
          <MenuItem
            value={priceOpt.id}
            key={priceOpt.id}
            disabled={owner != null}
          >
            {priceOpt.name} — {priceOpt.priceInTmt} {t('manat')}
            {owner != null && ` (${t('takenBy')} ${owner})`}
          </MenuItem>
        );
      })}
      {filtered.length === 0 && (
        <MenuItem disabled>{t('noPricesInCategory')}</MenuItem>
      )}
    </Select>
  );
}

export default function AddEditProductDialog({
  handleClose,
  args: {
    description,
    dialogType,
    id,
    imageUrls,
    name,
    price,
    tags: initTags,
    videoUrls: initVideoUrls,
    categoryId: initCategoryId,
    brandId: initBrandId,
    isOutOfStock: initIsOutOfStock,
  },
  snackbarErrorHandler,
  setProduct,
}: AddEditProductDialogProps) {
  const [loading, setLoading] = useState(false);
  const { setProducts, setSelectedProduct } = useProductContext();
  const { categories, selectedCategoryId } = useCategoryContext();
  const { setPrevCategory, setPrevProducts } = usePrevProductContext();
  const { accessToken } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();

  const t = useTranslations();
  const router = useRouter();
  const platform = usePlatform();

  // for existing product imageUrls the key is imageUrl
  // for new product imageUrls the key is number
  // this is to differentiate between the two when deleting
  const [productImageUrls, setProductImageUrls] = useState<
    { [key: string | number]: string }[]
  >([]);
  const [productImageUrlsNumberKeyCount, setProductImageUrlsNumberKeyCount] =
    useState<number>(0);
  const [originalDeletedProductImageUrls, setOriginalDeletedProductImageUrls] =
    useState<string[]>([]);
  const [productImageFiles, setProductImageFiles] = useState<File[]>([]);
  const [productImageFileUrls, setProductImageFileUrls] = useState<string[]>(
    [],
  );
  const [productImageOrder, setProductImageOrder] = useState<{
    [key: number]: string;
  }>({});
  const [tags, setTags] = useState<string[]>([]);
  const parsedProductName = JSON.parse(name ?? '{}');
  const parsedProductDescription = JSON.parse(description ?? '{}');
  const [videoUrls, setVideoUrls] = useState<string[]>(initVideoUrls);
  const [categoryId, setCategoryId] = useState(initCategoryId || '');
  const [flattenedCats, setFlattenedCats] = useState<
    { id: string; name: string }[]
  >([]);

  const [isOutOfStock, setIsOutOfStock] = useState(initIsOutOfStock ?? false);
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [brandId, setBrandId] = useState(initBrandId || '');
  const [brandSearch, setBrandSearch] = useState('');
  const [editingBrandId, setEditingBrandId] = useState<string | null>(null);
  const [editBrandName, setEditBrandName] = useState('');

  const [colorOptions, setColorOptions] = useState<Color[]>([]);
  // Every price sitting in the product's own category — the pool the pickers
  // offer. Refetched whenever the category changes, because that is what
  // decides which prices are on the table.
  const [categoryPrices, setCategoryPrices] = useState<PriceWithOwner[]>([]);
  // The prices this product owns. A price connected before the product was
  // moved between categories can live outside `categoryPrices`, so the two are
  // merged below rather than one standing in for the other — dropping such a
  // price from the list would strand a base price or variant tag still
  // pointing at it.
  const [connectedPrices, setConnectedPrices] = useState<PriceWithOwner[]>([]);
  // Connect-a-price search state. This is the escape hatch for linking a price
  // from *outside* the product's category; it asks for unassigned prices only,
  // since the API refuses to move one that is already owned.
  const [priceSearch, setPriceSearch] = useState('');
  const [priceSearchResults, setPriceSearchResults] = useState<
    PriceWithOwner[]
  >([]);
  const [connectError, setConnectError] = useState('');
  // Base price is stored as "[priceId]" when it references a catalog price, or
  // a legacy literal string. Keep the raw value so an untouched legacy literal
  // is preserved on save; the select only edits the catalog reference.
  const [basePrice, setBasePrice] = useState(price ?? '');
  const basePriceId = basePrice.match(squareBracketRegex)?.[1] ?? '';
  // A legacy product stored a literal price string instead of a "[priceId]" ref.
  // The select only edits catalog refs, so surface the literal (otherwise it
  // renders as a blank field while the hidden input silently keeps the value).
  const legacyLiteralPrice =
    basePrice && !basePrice.match(squareBracketRegex) ? basePrice : '';

  const loadBrands = async () => {
    const data = await fetchBrands();
    setBrands(data);
  };

  useEffect(() => {
    loadBrands();
  }, []);

  useEffect(() => {
    (async () => setColorOptions(await fetchColors()))();
  }, []);

  useEffect(() => {
    (async () => {
      // A product being created has no id yet, so it starts with nothing
      // connected; picks made below are staged and written after it is created.
      if (id != null) setConnectedPrices(await fetchPrices({ productId: id }));
    })();
  }, [id]);

  useEffect(() => {
    (async () => {
      setCategoryPrices(categoryId ? await fetchPrices({ categoryId }) : []);
    })();
  }, [categoryId]);

  // What the base-price and variant dropdowns offer.
  const priceOptions = useMemo(() => {
    const merged = new Map(categoryPrices.map((option) => [option.id, option]));
    // Connected wins on collision: it carries this product as the owner, which
    // is what keeps the row selectable rather than greyed out as "taken".
    connectedPrices.forEach((option) => merged.set(option.id, option));
    return [...merged.values()];
  }, [categoryPrices, connectedPrices]);

  // Every keystroke used to fire its own request and write whatever came back,
  // so a slow early response could land after a newer one and repopulate the
  // list with results for a prefix the admin had already typed past. The
  // counter retires superseded requests; the debounce keeps a fast typist from
  // opening one per character in the first place.
  const priceSearchSeq = useRef(0);
  const priceSearchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => () => clearTimeout(priceSearchTimer.current), []);

  const runPriceSearch = (keyword: string) => {
    clearTimeout(priceSearchTimer.current);
    priceSearchTimer.current = setTimeout(async () => {
      priceSearchSeq.current += 1;
      const seq = priceSearchSeq.current;
      const results = await fetchPrices({
        unassigned: true,
        searchKeyword: keyword,
      });
      if (seq !== priceSearchSeq.current) return;
      setPriceSearchResults(results);
    }, 300);
  };

  const searchUnassignedPrices = (keyword: string) => {
    setPriceSearch(keyword);
    if (keyword.trim() === '') {
      // Bumping the counter retires anything already in flight, so a late
      // response cannot refill the list the admin just cleared.
      priceSearchSeq.current += 1;
      setPriceSearchResults([]);
      return;
    }
    runPriceSearch(keyword.trim());
  };

  // Writes the link immediately for an existing product. For a new one the
  // price is only held in local state and linked after the product is created.
  const connectPrice = async (
    priceToConnect: PriceWithOwner,
  ): Promise<boolean> => {
    setConnectError('');
    if (id != null) {
      const { success, message } = await fetchWithCreds<Prices>({
        accessToken,
        path: '/api/prices',
        method: 'PUT',
        body: { pricePairs: [{ id: priceToConnect.id, productId: id }] },
      });
      if (!success) {
        setConnectError(message ?? t('connectPriceError'));
        return false;
      }
    }
    setConnectedPrices((prev) =>
      prev.some((p) => p.id === priceToConnect.id)
        ? prev
        : [...prev, priceToConnect],
    );
    setPriceSearchResults((prev) =>
      prev.filter((p) => p.id !== priceToConnect.id),
    );
    return true;
  };

  // Picking a price for the base price or a variant is what connects it. The
  // pickers offer the whole category, but the product's `price`/`tags` may only
  // reference prices it owns, so the reference and the link have to be made
  // together — otherwise choosing a price would write a string pointing at a
  // row this product has no claim on. Returns false when the link was refused,
  // in which case the caller must leave the reference alone.
  const ensurePriceConnected = async (priceId: string): Promise<boolean> => {
    if (priceId === '') return true;
    if (connectedPrices.some((option) => option.id === priceId)) return true;
    const pick = priceOptions.find((option) => option.id === priceId);
    if (pick == null) return false;
    return connectPrice(pick);
  };

  // The pickers are category-scoped, so without a category there is no list to
  // draw. Says so instead of opening an empty menu.
  const pricePickerBlocked = !categoryId;
  const reportPickerBlocked = () => {
    setConnectError(t('selectCategoryFirst'));
  };

  // Disconnecting a price that the base price or a variant still points at
  // would leave those strings referencing a price no longer in the product's
  // list, so the reference has to be cleared first.
  const disconnectPrice = async (priceId: string) => {
    setConnectError('');
    const usedByTag = tags.some(
      (tag) => tag.match(squareBracketRegex)?.[1] === priceId,
    );
    if (basePriceId === priceId || usedByTag) {
      setConnectError(t('priceStillInUse'));
      return;
    }
    if (id != null) {
      const { success, message } = await fetchWithCreds<Prices>({
        accessToken,
        path: '/api/prices',
        method: 'PUT',
        body: { pricePairs: [{ id: priceId, productId: null }] },
      });
      if (!success) {
        setConnectError(message ?? t('connectPriceError'));
        return;
      }
    }
    setConnectedPrices((prev) => prev.filter((p) => p.id !== priceId));
    // The price is unowned again, so the category list has to stop showing this
    // product as its holder — otherwise it would render greyed out until the
    // dialog is reopened.
    setCategoryPrices((prev) =>
      prev.map((option) =>
        option.id === priceId ? { ...option, product: null } : option,
      ),
    );
  };

  // A variant tag is "<spec> [priceId]{colorId}". Price and color are picked
  // from dropdowns; only the spec text is free-typed.
  const splitTag = (tag: string) => {
    const priceId = tag.match(squareBracketRegex)?.[1] ?? '';
    const colorId = tag.match(curlyBracketRegex)?.[1] ?? '';
    const spec = tag
      .replace(squareBracketRegex, '')
      .replace(curlyBracketRegex, '')
      .replace(/\s+/g, ' ')
      .trim();
    return { spec, priceId, colorId };
  };
  const composeTag = (spec: string, priceId: string, colorId: string) =>
    `${spec.trim()}${priceId ? ` [${priceId}]` : ''}${
      colorId ? `{${colorId}}` : ''
    }`.trim();

  const handleCreateBrand = async () => {
    const trimmedBrandSearch = brandSearch.trim();
    if (!trimmedBrandSearch) return;
    const existing = brands.find(
      (b) => b.name.toLowerCase() === trimmedBrandSearch.toLowerCase(),
    );
    if (existing) {
      setBrandId(existing.id);
      setBrandSearch('');
      return;
    }

    if (!accessToken) {
      snackbarErrorHandler?.('Authentication required');
      return;
    }

    setLoading(true);
    const res = await addEditBrand({
      type: 'add',
      name: trimmedBrandSearch,
      accessToken,
      fetchWithCreds,
    });
    setLoading(false);

    if (res.success && res.data) {
      await loadBrands();
      setBrandId(res.data.id);
      setBrandSearch('');
    } else if (snackbarErrorHandler) {
      snackbarErrorHandler(res.message || t('createBrandError'));
    }
  };

  const handleUpdateBrand = async (brandIdToUpdate: string) => {
    const trimmedEditBrandName = editBrandName.trim();
    if (!trimmedEditBrandName) return;
    if (!accessToken) {
      snackbarErrorHandler?.('Authentication required');
      return;
    }
    setLoading(true);
    const res = await addEditBrand({
      type: 'edit',
      id: brandIdToUpdate,
      name: trimmedEditBrandName,
      accessToken,
      fetchWithCreds,
    });
    setLoading(false);

    if (res.success) {
      await loadBrands();
      setEditingBrandId(null);
      setEditBrandName('');
    } else if (snackbarErrorHandler) {
      snackbarErrorHandler(res.message || t('updateBrandError'));
    }
  };

  const handleDeleteBrand = async (brand: { id: string; name: string }) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(t('brandDeleteConfirm', { name: brand.name }))) return;
    if (!accessToken) {
      snackbarErrorHandler?.('Authentication required');
      return;
    }
    setLoading(true);
    const res = await deleteBrand(brand.id, accessToken, fetchWithCreds);
    setLoading(false);
    if (res.success) {
      if (brandId === brand.id) setBrandId('');
      await loadBrands();
    } else if (snackbarErrorHandler) {
      snackbarErrorHandler(res.message || t('deleteBrandError'));
    }
  };

  // Seeds the category when the dialog is opened from a category page without
  // one of its own. An explicit categoryId always wins: every edit passes the
  // product's real category, and browsing to a category beforehand must not
  // silently move the product being edited into it.
  useEffect(() => {
    if (selectedCategoryId == null || initCategoryId != null) return;
    setCategoryId(selectedCategoryId);
  }, [selectedCategoryId, initCategoryId]);

  useEffect(() => {
    if (imageUrls == null || imageUrls.length === 0) return;
    const initialProductImageUrl: { [key: string]: string }[] = imageUrls.map(
      (imageUrl) => {
        try {
          new URL(imageUrl);
          return { [imageUrl]: imageUrl };
        } catch (_) {
          const display = getProductMediaUrl('original', imageUrl) ?? imageUrl;
          return { [imageUrl]: display };
        }
      },
    );
    setProductImageOrder(
      initialProductImageUrl
        .map((obj) => {
          const [key] = Object.keys(obj);
          return obj[key];
        })
        .reduce(
          (acc, curr, index) => {
            acc[index + 1] = curr;
            return acc;
          },
          {} as { [key: number]: string },
        ),
    );
    setProductImageUrls(initialProductImageUrl);
  }, [imageUrls]);

  useEffect(() => {
    setTags(initTags ?? []);
  }, [initTags]);

  useEffect(() => {
    if (initVideoUrls == null || initVideoUrls.length === 0) {
      setVideoUrls(['', '', '']);
    }
  }, [initVideoUrls]);

  useEffect(() => {
    if (categories == null || categories.length === 0) return;
    const queue: ExtendedCategory[] = [];
    const flatCats: { id: string; name: string }[] = [];
    categories.forEach((category) => {
      queue.push(category);
      while (queue.length > 0) {
        const currCat = queue.pop();
        flatCats.push({
          id: currCat.id,
          name: parseName(currCat.name, router.locale),
        });
        currCat.successorCategories?.forEach((succCat) => {
          queue.push(succCat);
        });
      }
    });
    setFlattenedCats(flatCats);
  }, [categories]);

  const filteredBrands = brands.filter((b) =>
    b.name.toLowerCase().includes(brandSearch.toLowerCase()),
  );

  return (
    <>
      <Dialog
        open
        fullScreen
        onClose={handleClose}
        component="form"
        onSubmit={async (event) => {
          event.preventDefault();
          // The API rejects an unknown category, so catch the empty pick here
          // and say why instead of surfacing a "category not found" error.
          if (!categoryId) {
            if (snackbarErrorHandler) snackbarErrorHandler('categoryRequired');
            return;
          }

          setLoading(true);

          try {
            const formData = new FormData(
              event.currentTarget as unknown as HTMLFormElement,
            );

            const updatedProduct = await addEditProduct({
              formJson: Object.fromEntries(formData.entries()),
              categoryId,
              brandId: brandId || undefined,
              setProducts,
              setPrevProducts,
              setPrevCategory,
              productImageFiles,
              deleteImageUrls: originalDeletedProductImageUrls,
              productImageUrls: productImageUrls
                .filter((obj) => {
                  const [key] = Object.keys(obj);
                  return isNumeric(key);
                })
                .map((obj) => obj[Object.keys(obj)[0]]),
              type: dialogType,
              tags,
              videoUrls,
              selectedProductId: id,
              isOutOfStock,
            });
            // A new product only got its id just now, so the prices staged in
            // connectedPrices are linked here. Editing an existing product
            // writes each link as it is made, so there is nothing left to do.
            if (id == null && connectedPrices.length > 0) {
              const { success, message } = await fetchWithCreds({
                accessToken,
                path: '/api/prices',
                method: 'PUT',
                body: {
                  pricePairs: connectedPrices.map((p) => ({
                    id: p.id,
                    productId: updatedProduct.id,
                  })),
                },
              });
              // The product's `price` and `tags` already reference these ids,
              // so a rejected link (another admin claimed one first) leaves it
              // pointing at prices it does not own — the exact state the
              // reassignment guard exists to prevent. Reported rather than
              // thrown: the product itself was created, so the state below
              // still has to be applied, and only a human can resolve which
              // product should keep the contested price.
              if (!success && snackbarErrorHandler) {
                snackbarErrorHandler(message ?? 'connectPriceError');
              }
            }

            setSelectedProduct(updatedProduct);
            if (setProduct) {
              setProduct(updatedProduct);
            }
          } catch (error: any) {
            setLoading(false);
            if (snackbarErrorHandler) {
              snackbarErrorHandler(
                error.message ||
                  (dialogType === 'add'
                    ? 'createProductError'
                    : 'editProductError'),
              );
            }
            return;
          }

          setLoading(false);
          handleClose();
        }}
      >
        <DialogTitle>
          {dialogType === 'add' ? t('addNewProduct') : t('editProduct')}
        </DialogTitle>
        <DialogContent sx={{ padding: 0 }}>
          <Box className={addEditProductDialogClasses.box.flex.gapP}>
            {/* Always rendered: a product added from a page with no category
                of its own (the products overview) has nothing to inherit, so
                the category has to be pickable here. */}
            <Box className={addEditProductDialogClasses.box.flex.gap}>
              <Typography>
                {t('category')}
                <span style={{ color: 'red' }}>*</span>
              </Typography>
              <Select
                value={categoryId}
                displayEmpty
                onChange={(e) => {
                  setCategoryId(e.target.value);
                }}
              >
                <MenuItem value="" disabled>
                  {t('selectCategory')}
                </MenuItem>
                {flattenedCats.map((cat) => (
                  <MenuItem value={cat.id} key={cat.id}>
                    {parseName(cat.name, router.locale)}
                  </MenuItem>
                ))}
              </Select>
            </Box>

            <Box className="w-full">
              <Typography>
                {t('productName')}
                <span style={{ color: 'red' }}>*</span>
              </Typography>
              <TextField
                label={t('inRussian')}
                name="productNameInRussian"
                className={
                  addEditProductDialogClasses.textField.usual[platform]
                }
                defaultValue={parsedProductName.ru ?? ''}
              />
              <TextField
                label={t('inTurkmen')}
                name="productNameInTurkmen"
                className={
                  addEditProductDialogClasses.textField.usual[platform]
                }
                defaultValue={parsedProductName.tk ?? ''}
              />
              <TextField
                label={t('inTurkish')}
                name="productNameInTurkish"
                className={
                  addEditProductDialogClasses.textField.usual[platform]
                }
                defaultValue={parsedProductName.tr ?? ''}
              />
              <TextField
                label={t('inCharjov')}
                name="productNameInCharjov"
                className={
                  addEditProductDialogClasses.textField.usual[platform]
                }
                defaultValue={parsedProductName.ch ?? ''}
              />
              <TextField
                label={`${t('inEnglish')} *`}
                name="productNameInEnglish"
                required
                className={
                  addEditProductDialogClasses.textField.usual[platform]
                }
                defaultValue={parsedProductName.en ?? ''}
              />
            </Box>
            <Box className="w-full">
              <Typography>{t('price')}</Typography>
              <PriceSelect
                value={basePriceId}
                onChange={async (selectedId) => {
                  // Connect first: a reference to a price this product does not
                  // own is exactly what the reassignment guard exists to stop,
                  // so a refused link must leave the old base price standing.
                  if (!(await ensurePriceConnected(selectedId))) return;
                  setBasePrice(selectedId ? `[${selectedId}]` : '');
                }}
                priceOptions={priceOptions}
                ownProductId={id}
                locale={router.locale ?? 'tk'}
                blocked={pricePickerBlocked}
                onBlockedOpen={reportPickerBlocked}
                sx={{ minWidth: 200 }}
              />
              {legacyLiteralPrice && (
                <Typography
                  variant="caption"
                  color="textSecondary"
                  sx={{ display: 'block', mt: 0.5 }}
                >
                  {t('price')}: {legacyLiteralPrice}
                </Typography>
              )}
              {pricePickerBlocked && (
                <Typography
                  variant="caption"
                  color="warning.main"
                  sx={{ display: 'block', mt: 0.5 }}
                >
                  {t('selectCategoryFirst')}
                </Typography>
              )}
              <input type="hidden" name="price" value={basePrice} />
            </Box>

            {/* The prices this product owns. The pickers above draw from the
                whole category, connecting as they go; this list is where an
                admin sees what got claimed, drops one, or searches for a price
                from outside the category to pull in. */}
            <Box className="w-full">
              <Typography>{t('connectedPrices')}</Typography>
              {connectedPrices.map((connected) => (
                <Box
                  key={connected.id}
                  className="flex flex-row items-center justify-between"
                  sx={{ py: 0.25 }}
                >
                  <Typography variant="body2">
                    {connected.name} — {connected.priceInTmt} {t('manat')}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => disconnectPrice(connected.id)}
                  >
                    <DeleteOutlined color="error" fontSize="small" />
                  </IconButton>
                </Box>
              ))}
              <TextField
                size="small"
                fullWidth
                sx={{ mt: 1 }}
                placeholder={t('search')}
                value={priceSearch}
                onChange={(e) => searchUnassignedPrices(e.target.value)}
              />
              {priceSearchResults.map((result) => (
                <Box
                  key={result.id}
                  className="flex flex-row items-center justify-between"
                  sx={{ py: 0.25 }}
                >
                  <Typography variant="body2">
                    {result.name} — {result.priceInTmt} {t('manat')}
                  </Typography>
                  <Button size="small" onClick={() => connectPrice(result)}>
                    {t('add')}
                  </Button>
                </Box>
              ))}
              {connectError && (
                <Typography variant="caption" color="error">
                  {connectError}
                </Typography>
              )}
            </Box>

            <FormControlLabel
              control={
                <Switch
                  checked={isOutOfStock}
                  onChange={(e) => setIsOutOfStock(e.target.checked)}
                  color="error"
                />
              }
              label={t('outOfStock')}
            />

            {/* Brand Section */}
            <Box className="w-full" mt={2}>
              <Typography>{t('brand')}</Typography>
              <Box display="flex" gap={1} mb={1}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder={t('brandSearchPlaceholder')}
                  value={brandSearch}
                  onChange={(e) => setBrandSearch(e.target.value)}
                />
                <Button
                  variant="contained"
                  onClick={handleCreateBrand}
                  disabled={!brandSearch}
                >
                  {t('add') || 'Add'}
                </Button>
              </Box>
              <Box
                sx={{
                  border: '1px solid #ccc',
                  borderRadius: 1,
                  maxHeight: 200,
                  overflowY: 'auto',
                }}
              >
                {filteredBrands.length === 0 && (
                  <Typography
                    variant="body2"
                    color="textSecondary"
                    sx={{ p: 2, textAlign: 'center' }}
                  >
                    {t('noBrands')}
                  </Typography>
                )}
                {filteredBrands.map((brand) => (
                  <Box
                    key={brand.id}
                    display="flex"
                    alignItems="center"
                    justifyContent="space-between"
                    p={1}
                    sx={{
                      bgcolor:
                        brandId === brand.id
                          ? 'rgba(25, 118, 210, 0.08)'
                          : 'transparent',
                      '&:hover': {
                        bgcolor: 'rgba(0, 0, 0, 0.04)',
                      },
                    }}
                  >
                    {editingBrandId === brand.id ? (
                      // Edit Mode
                      <Box display="flex" alignItems="center" gap={1} flex={1}>
                        <TextField
                          size="small"
                          fullWidth
                          value={editBrandName}
                          onChange={(e) => setEditBrandName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleUpdateBrand(brand.id);
                            }
                          }}
                        />
                        <IconButton onClick={() => handleUpdateBrand(brand.id)}>
                          <Check color="primary" />
                        </IconButton>
                        <IconButton onClick={() => setEditingBrandId(null)}>
                          <Close />
                        </IconButton>
                      </Box>
                    ) : (
                      // Display Mode
                      <>
                        <Box
                          display="flex"
                          alignItems="center"
                          gap={1}
                          flex={1}
                          onClick={() => setBrandId(brand.id)}
                          sx={{ cursor: 'pointer' }}
                        >
                          {brandId === brand.id ? (
                            <RadioButtonCheckedIcon
                              color="primary"
                              fontSize="small"
                            />
                          ) : (
                            <RadioButtonUncheckedIcon
                              color="action"
                              fontSize="small"
                            />
                          )}
                          <Typography>{brand.name}</Typography>
                        </Box>
                        <Box>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingBrandId(brand.id);
                              setEditBrandName(brand.name);
                            }}
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteBrand(brand);
                            }}
                          >
                            <DeleteOutlined fontSize="small" color="error" />
                          </IconButton>
                        </Box>
                      </>
                    )}
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>

          <Box className={addEditProductDialogClasses.box.flex.rowGap}>
            <Typography>{t('productVideo')}:</Typography>
            {/* TODO: consider adding videoUrls dynamically (not fixed amount) */}
            {videoUrls?.map((videoUrl, index) => (
              <Box className="flex" key={`video-${index}`}>
                <Box className={addEditProductDialogClasses.box.flex.inline}>
                  {(() => {
                    if (index === 0) return <TikTokIcon />;
                    if (index === 1)
                      return <Instagram className="text-black" />;
                    return <YouTube className="text-black" />;
                  })()}
                </Box>
                <TextField
                  type="text"
                  name={`videoUrl${index}`}
                  className="w-full"
                  value={videoUrl}
                  onChange={(event) => {
                    const newVideoUrls = [...videoUrls];
                    newVideoUrls[index] = event.currentTarget.value;
                    setVideoUrls(newVideoUrls);
                  }}
                />
              </Box>
            ))}
          </Box>

          <Box
            className={addEditProductDialogClasses.box.flex.colGapP[platform]}
          >
            <Typography>{t('tags')}:</Typography>
            {tags.map((tag, index) => {
              const { spec, priceId, colorId } = splitTag(tag);
              return (
                <Box
                  className={addEditProductDialogClasses.box.flex.rowGap}
                  key={index}
                >
                  <TextField
                    type="text"
                    name={`tag${index}`}
                    placeholder={t('tags')}
                    className={
                      addEditProductDialogClasses.textField.usual[platform]
                    }
                    value={spec}
                    onChange={(event) => {
                      const newTags = [...tags];
                      newTags[index] = composeTag(
                        event.currentTarget.value,
                        priceId,
                        colorId,
                      );
                      setTags(newTags);
                    }}
                  />
                  <PriceSelect
                    value={priceId}
                    onChange={async (selectedId) => {
                      // Same rule as the base price: the tag may only reference
                      // a price this product owns, so the link is made first
                      // and the tag left untouched if it is refused.
                      if (!(await ensurePriceConnected(selectedId))) return;
                      const newTags = [...tags];
                      newTags[index] = composeTag(spec, selectedId, colorId);
                      setTags(newTags);
                    }}
                    priceOptions={priceOptions}
                    ownProductId={id}
                    locale={router.locale ?? 'tk'}
                    blocked={pricePickerBlocked}
                    onBlockedOpen={reportPickerBlocked}
                    sx={{ minWidth: 150 }}
                  />
                  <Select
                    size="small"
                    displayEmpty
                    value={colorId}
                    sx={{ minWidth: 130 }}
                    onChange={(event) => {
                      const newTags = [...tags];
                      newTags[index] = composeTag(
                        spec,
                        priceId,
                        event.target.value,
                      );
                      setTags(newTags);
                    }}
                  >
                    <MenuItem value="">
                      <em>{t('color')}</em>
                    </MenuItem>
                    {colorOptions.map((color) => (
                      <MenuItem value={color.id} key={color.id}>
                        <Box className="flex flex-row items-center gap-2">
                          <Box
                            sx={{
                              width: 16,
                              height: 16,
                              borderRadius: '50%',
                              border: '1px solid #ccc',
                              backgroundColor: color.hex,
                            }}
                          />
                          {color.name}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                  <IconButton
                    onClick={() => setTags(tags.filter((_, i) => i !== index))}
                  >
                    <CancelIcon fontSize="medium" color="error" />
                  </IconButton>
                </Box>
              );
            })}
            <Box className={addEditProductDialogClasses.box.flex.rowEnd}>
              <Button variant="outlined" onClick={() => setTags([...tags, ''])}>
                {t('add')}
              </Button>
            </Box>
          </Box>
          <Box
            className={addEditProductDialogClasses.box.flex.descGrid[platform]}
          >
            <Typography className="col-span-full">
              {t('productDescription')}
            </Typography>
            <TextField
              label={t('inRussian')}
              type="text"
              name="productDescriptionInRussian"
              multiline
              minRows={4}
              className={
                addEditProductDialogClasses.textField.description[platform]
              }
              defaultValue={parsedProductDescription.ru ?? defaultProductDescRu}
            />
            <TextField
              label={t('inTurkmen')}
              type="text"
              name="productDescriptionInTurkmen"
              multiline
              minRows={4}
              className={
                addEditProductDialogClasses.textField.description[platform]
              }
              defaultValue={parsedProductDescription.tk ?? defaultProductDescTk}
            />
            <TextField
              label={t('inTurkish')}
              type="text"
              name="productDescriptionInTurkish"
              multiline
              minRows={4}
              className={
                addEditProductDialogClasses.textField.description[platform]
              }
              defaultValue={parsedProductDescription.tr ?? defaultProductDescTr}
            />
            <TextField
              label={t('inCharjov')}
              type="text"
              name="productDescriptionInCharjov"
              multiline
              minRows={4}
              className={
                addEditProductDialogClasses.textField.description[platform]
              }
              defaultValue={parsedProductDescription.ch ?? defaultProductDescCh}
            />
            <TextField
              label={t('inEnglish')}
              type="text"
              name="productDescriptionInEnglish"
              multiline
              minRows={4}
              className={
                addEditProductDialogClasses.textField.description[platform]
              }
              defaultValue={parsedProductDescription.en ?? defaultProductDescEn}
            />
          </Box>
          <Box className={addEditProductDialogClasses.box.flex.pad}>
            <Box className={addEditProductDialogClasses.box.flex.col}>
              <TextField
                margin="dense"
                id="imgUrl"
                label={t('imageUrl')}
                type="url"
                name="imgUrl"
                className={
                  addEditProductDialogClasses.textField.imageButton[platform]
                }
                onChange={(event) => {
                  try {
                    const { value } = event.currentTarget;
                    new URL(value);
                    setProductImageUrls([
                      ...productImageUrls,
                      { [productImageUrlsNumberKeyCount]: value },
                    ]);
                    setProductImageUrlsNumberKeyCount(
                      productImageUrlsNumberKeyCount + 1,
                    );
                  } catch (_) {
                    // do nothing
                  }
                }}
              />
              <Button
                component="label"
                role={undefined}
                variant="contained"
                tabIndex={-1}
                startIcon={<CloudUploadIcon />}
                sx={{ textTransform: 'none' }}
                className={
                  addEditProductDialogClasses.textField.imageButton[platform]
                }
              >
                {t('uploadProductImage')}
                <VisuallyHiddenInput
                  type="file"
                  name="productImage"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      setProductImageFiles([...productImageFiles, file]);
                      const reader = new FileReader();
                      reader.onload = () => {
                        setProductImageFileUrls([
                          ...productImageFileUrls,
                          reader.result as string,
                        ]);
                      };
                      reader.readAsDataURL(file);
                    }
                    event.target.value = '';
                  }}
                />
              </Button>
            </Box>
            {productImageUrls.map((obj, index) => {
              const [key] = Object.keys(obj);
              const url = obj[key];
              return (
                <Box
                  className={addEditProductDialogClasses.box.fullRel}
                  key={key}
                >
                  <CardMedia component="img" alt="asdf" src={url} width={200} />
                  <IconButton
                    className={addEditProductDialogClasses.box.absZero}
                    onClick={() => {
                      productImageUrls.forEach((objUrls) => {
                        const [idx] = Object.keys(objUrls);
                        if (!isNumeric(idx) && obj[idx] === url) {
                          setOriginalDeletedProductImageUrls([
                            ...originalDeletedProductImageUrls,
                            idx,
                          ]);
                        }
                      });
                      setProductImageUrls(
                        productImageUrls.filter((_, i) => i !== index),
                      );
                      if (productImageFileUrls.includes(url)) {
                        const fileIndex = productImageFileUrls.indexOf(url);
                        setProductImageFileUrls(
                          productImageFileUrls.filter(
                            (_, i) => i !== fileIndex,
                          ),
                        );
                        setProductImageFiles(
                          productImageFiles.filter((_, i) => i !== fileIndex),
                        );
                      }
                    }}
                  >
                    <DeleteOutlined fontSize="medium" color="error" />
                  </IconButton>
                  <TextField
                    disabled
                    size="small"
                    className={
                      addEditProductDialogClasses.textField.absZeroLeft
                    }
                    style={{ backgroundColor: 'white' }}
                    type="number"
                    defaultValue={index + 1}
                    onChange={(event) => {
                      const newIndex = Number(event.currentTarget.value);
                      if (newIndex > 0 && newIndex <= productImageUrls.length) {
                        const curIndex = index + 1;

                        const newProductImageOrder = { ...productImageOrder };
                        const curUrl = newProductImageOrder[curIndex];
                        newProductImageOrder[curIndex] =
                          newProductImageOrder[newIndex];
                        newProductImageOrder[newIndex] = curUrl;
                        setProductImageOrder(newProductImageOrder);

                        const newProductImageUrls = [...productImageUrls];
                        const temp = newProductImageUrls[curIndex - 1];
                        newProductImageUrls[curIndex - 1] =
                          newProductImageUrls[newIndex - 1];
                        newProductImageUrls[newIndex - 1] = temp;
                        setProductImageUrls(newProductImageUrls);
                      }
                    }}
                  />
                </Box>
              );
            })}
            {productImageFileUrls.map((url, index) => (
              <Box
                className={addEditProductDialogClasses.box.fullRel}
                key={index}
              >
                <CardMedia component="img" alt="asdf" src={url} width={200} />
                <IconButton
                  className={addEditProductDialogClasses.box.absZero}
                  onClick={() => {
                    const fileIndex = productImageFileUrls.indexOf(url);
                    setProductImageFileUrls(
                      productImageFileUrls.filter((_, i) => i !== fileIndex),
                    );
                    setProductImageFiles(
                      productImageFiles.filter((_, i) => i !== fileIndex),
                    );
                  }}
                >
                  <DeleteOutlined fontSize="medium" color="error" />
                </IconButton>
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" color="error" onClick={handleClose}>
            {t('cancel')}
          </Button>
          <LoadingButton loading={loading} variant="contained" type="submit">
            {t('submit')}
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </>
  );
}
