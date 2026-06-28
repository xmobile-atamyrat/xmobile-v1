import { fetchProducts } from '@/pages/lib/apis';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { BANNER_IMAGE_WIDTH, localeOptions } from '@/pages/lib/constants';
import {
  getBannerMediaUrl,
  PRODUCT_IMAGE_FALLBACK,
} from '@/pages/lib/mediaUrls';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { ExtendedProduct, PromoBannerData } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { flattenCategories } from '@/pages/lib/categoryPathUtils';
import {
  addEditBanner,
  BannerImageInput,
  parseName,
  VisuallyHiddenInput,
} from '@/pages/lib/utils';
import { DeleteOutlined } from '@mui/icons-material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import LoadingButton from '@mui/lab/LoadingButton';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';

type SnackbarSeverity = 'error' | 'warning' | 'success';
type RedirectType = 'NONE' | 'CATEGORY' | 'PRODUCT';

interface ImgState {
  file?: File;
  url?: string; // existing stored path / remote URL
  preview?: string; // data URL (new) or media URL (existing)
}

interface AddEditBannerDialogProps {
  handleClose: () => void;
  onSuccess: (message: string, severity?: SnackbarSeverity) => void;
  banner?: PromoBannerData;
  /** All existing banners, used to prevent duplicate display order among active ones. */
  existingBanners?: PromoBannerData[];
}

const IMAGE_KEYS = ['default', ...localeOptions];

/** Convert an ISO string to the value format expected by <input type="datetime-local">. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const tzOffsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 16);
}

export default function AddEditBannerDialog({
  handleClose,
  onSuccess,
  banner,
  existingBanners = [],
}: AddEditBannerDialogProps) {
  const isEdit = banner != null;
  const t = useTranslations();
  const router = useRouter();
  const platform = usePlatform();
  const { accessToken } = useUserContext();
  const { categories } = useCategoryContext();

  const [loading, setLoading] = useState(false);

  const [imgState, setImgState] = useState<Record<string, ImgState>>(() => {
    const initial: Record<string, ImgState> = {};
    if (banner) {
      Object.entries(banner.imgUrls).forEach(([key, stored]) => {
        initial[key] = {
          url: stored,
          preview: getBannerMediaUrl(stored) ?? stored,
        };
      });
    }
    return initial;
  });

  const [redirectType, setRedirectType] = useState<RedirectType>(
    banner?.redirectType ?? 'NONE',
  );
  const [redirectId, setRedirectId] = useState<string | null>(
    banner?.redirectId ?? null,
  );
  const [isActive, setIsActive] = useState<boolean>(banner?.isActive ?? true);
  const [sortOrder, setSortOrder] = useState<string>(
    String(banner?.sortOrder ?? 1),
  );
  const [startsAt, setStartsAt] = useState<string>(
    toLocalInput(banner?.startsAt ?? null),
  );
  const [endsAt, setEndsAt] = useState<string>(
    toLocalInput(banner?.endsAt ?? null),
  );

  // Product picker async search state
  const [productOptions, setProductOptions] = useState<ExtendedProduct[]>([]);
  const [productInput, setProductInput] = useState('');
  const [selectedProduct, setSelectedProduct] =
    useState<ExtendedProduct | null>(null);

  const locale = router.locale ?? 'tk';

  const categoryOptions = useMemo(
    () =>
      flattenCategories(categories).map((c) => ({
        ...c,
        name: parseName(c.name, locale),
      })),
    [categories, locale],
  );

  // Preload the selected product label when editing a product-redirect banner.
  useEffect(() => {
    if (
      isEdit &&
      banner?.redirectType === 'PRODUCT' &&
      banner?.redirectId &&
      selectedProduct == null
    ) {
      (async () => {
        try {
          const results = await fetchProducts({
            productId: banner.redirectId!,
          });
          if (results[0]) setSelectedProduct(results[0]);
        } catch (error) {
          console.error(error);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Async product search
  useEffect(() => {
    if (redirectType !== 'PRODUCT') return undefined;
    let active = true;
    const handle = setTimeout(async () => {
      try {
        const results = await fetchProducts({
          searchKeyword: productInput || undefined,
        });
        if (active) setProductOptions(results);
      } catch (error) {
        console.error(error);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [productInput, redirectType]);

  const handleImageChange = (key: string, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setImgState((prev) => ({
        ...prev,
        [key]: { file, preview: reader.result as string },
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleImageClear = (key: string) => {
    setImgState((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSubmit = async () => {
    if (imgState.default == null) {
      onSuccess(t('defaultBannerImageRequired'), 'warning');
      return;
    }
    if (redirectType !== 'NONE' && !redirectId) {
      onSuccess(t('redirectTargetRequired'), 'warning');
      return;
    }

    const order = parseInt(sortOrder, 10);
    if (Number.isNaN(order) || order < 1) {
      onSuccess(t('bannerOrderInvalid'), 'warning');
      return;
    }
    if (
      isActive &&
      existingBanners.some(
        (b) => b.id !== banner?.id && b.isActive && b.sortOrder === order,
      )
    ) {
      onSuccess(t('bannerOrderConflict'), 'warning');
      return;
    }

    const images: BannerImageInput[] = [];
    IMAGE_KEYS.forEach((key) => {
      const state = imgState[key];
      if (state?.file) images.push({ key, file: state.file });
      else if (state?.url) images.push({ key, url: state.url });
    });

    // Locale overrides that existed before but were removed in this edit.
    const clearedImages = isEdit
      ? Object.keys(banner!.imgUrls).filter(
          (key) => key !== 'default' && imgState[key] == null,
        )
      : [];

    setLoading(true);
    try {
      await addEditBanner({
        type: isEdit ? 'edit' : 'add',
        bannerId: banner?.id,
        images,
        clearedImages,
        redirectType: redirectType === 'NONE' ? null : redirectType,
        redirectId: redirectType === 'NONE' ? null : redirectId,
        isActive,
        sortOrder: parseInt(sortOrder, 10) || 0,
        startsAt: startsAt || null,
        endsAt: endsAt || null,
        accessToken,
      });
      onSuccess(isEdit ? t('bannerUpdated') : t('bannerCreated'), 'success');
      handleClose();
    } catch (error) {
      onSuccess((error as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const renderUploader = (key: string) => {
    const state = imgState[key];
    const label =
      key === 'default' ? t('bannerDefaultImage') : key.toUpperCase();
    return (
      <Box key={key} className="flex flex-col gap-2 mb-3">
        <Typography fontSize={14} fontWeight={600}>
          {key === 'default' ? (
            <>
              {label}
              <span style={{ color: 'red' }}> *</span>
            </>
          ) : (
            `${t('bannerImageForLocale')} ${label}`
          )}
        </Typography>
        <Box className="flex flex-row items-start gap-3 flex-wrap">
          <Button
            component="label"
            role={undefined}
            variant="contained"
            tabIndex={-1}
            startIcon={<CloudUploadIcon />}
            sx={{ textTransform: 'none' }}
          >
            {t('uploadBannerImage')}
            <VisuallyHiddenInput
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) handleImageChange(key, file);
                event.target.value = '';
              }}
            />
          </Button>
          {state?.preview != null && (
            <Box className="relative">
              <img
                alt={label}
                src={state.preview}
                width={platform === 'web' ? 320 : 200}
                style={{ borderRadius: 8, display: 'block' }}
                onError={(error) => {
                  error.currentTarget.onerror = null;
                  error.currentTarget.src = PRODUCT_IMAGE_FALLBACK;
                }}
              />
              <IconButton onClick={() => handleImageClear(key)}>
                <DeleteOutlined fontSize="medium" color="error" />
              </IconButton>
            </Box>
          )}
        </Box>
      </Box>
    );
  };

  return (
    <Dialog open fullScreen onClose={handleClose}>
      <DialogTitle>{isEdit ? t('editBanner') : t('addBanner')}</DialogTitle>
      <DialogContent dividers>
        <Box className="flex flex-col gap-4 max-w-[760px]">
          {/* Images */}
          <Typography fontWeight={700}>{t('bannerImages')}</Typography>
          <Typography fontSize={12} color="text.secondary">
            {t('bannerPerLocaleImageHint')}
          </Typography>
          <Alert severity="info" sx={{ py: 0.5 }}>
            <Typography fontSize={12}>
              {t('bannerImageGuidelines', {
                width: BANNER_IMAGE_WIDTH,
                height: Math.round(BANNER_IMAGE_WIDTH / 3),
              })}
            </Typography>
          </Alert>
          {IMAGE_KEYS.map((key) => renderUploader(key))}

          {/* Redirect */}
          <Typography fontWeight={700} mt={2}>
            {t('bannerRedirect')}
          </Typography>
          <FormControl fullWidth>
            <InputLabel>{t('bannerRedirectType')}</InputLabel>
            <Select
              label={t('bannerRedirectType')}
              value={redirectType}
              onChange={(e) => {
                setRedirectType(e.target.value as RedirectType);
                setRedirectId(null);
                setSelectedProduct(null);
              }}
            >
              <MenuItem value="NONE">{t('bannerRedirectNone')}</MenuItem>
              <MenuItem value="CATEGORY">
                {t('bannerRedirectCategory')}
              </MenuItem>
              <MenuItem value="PRODUCT">{t('bannerRedirectProduct')}</MenuItem>
            </Select>
          </FormControl>

          {redirectType === 'CATEGORY' && (
            <Autocomplete
              options={categoryOptions}
              getOptionLabel={(o) => `${'- '.repeat(o.level)}${o.name}`}
              value={categoryOptions.find((o) => o.id === redirectId) ?? null}
              onChange={(_, v) => setRedirectId(v?.id ?? null)}
              renderInput={(params) => (
                <TextField {...params} label={t('bannerRedirectCategory')} />
              )}
            />
          )}

          {redirectType === 'PRODUCT' && (
            <Autocomplete
              options={productOptions}
              filterOptions={(x) => x}
              getOptionLabel={(o) => parseName(o.name, locale)}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              value={selectedProduct}
              onChange={(_, v) => {
                setSelectedProduct(v);
                setRedirectId(v?.id ?? null);
              }}
              onInputChange={(_, v) => setProductInput(v)}
              renderInput={(params) => (
                <TextField {...params} label={t('bannerRedirectProduct')} />
              )}
            />
          )}

          {/* Controls */}
          <Typography fontWeight={700} mt={2}>
            {t('bannerSettings')}
          </Typography>
          <FormControlLabel
            control={
              <Checkbox
                checked={isActive}
                onChange={(_, checked) => setIsActive(checked)}
                color="primary"
              />
            }
            label={t('bannerActive')}
          />
          <TextField
            label={t('bannerSortOrder')}
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            inputProps={{ min: 1, step: 1 }}
            sx={{ maxWidth: 200 }}
          />
          <TextField
            label={t('bannerStartsAt')}
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ maxWidth: 280 }}
          />
          <TextField
            label={t('bannerEndsAt')}
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ maxWidth: 280 }}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" color="error" onClick={handleClose}>
          {t('cancel')}
        </Button>
        <LoadingButton
          loading={loading}
          variant="contained"
          onClick={handleSubmit}
        >
          {t('submit')}
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
