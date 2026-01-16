import BASE_URL from '@/lib/ApiEndpoints';
import TikTokIcon from '@/pages/components/TikTokIcon';
import { fetchBrands } from '@/pages/lib/apis';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import {
  defaultProductDescCh,
  defaultProductDescEn,
  defaultProductDescRu,
  defaultProductDescTk,
  defaultProductDescTr,
} from '@/pages/lib/constants';
import { useLocale } from '@/pages/lib/hooks/useLocale';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { useNetworkContext } from '@/pages/lib/NetworkContext';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { usePrevProductContext } from '@/pages/lib/PrevProductContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import { AddEditProductProps, ExtendedCategory } from '@/pages/lib/types';
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
  IconButton,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import type { Product } from '@prisma/client';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

interface AddEditProductDialogProps {
  handleClose: () => void;
  args: AddEditProductProps;
  snackbarErrorHandler?: (message: string) => void;
  setProduct?: (product: Product) => void;
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
  },
  snackbarErrorHandler,
  setProduct,
}: AddEditProductDialogProps) {
  const [loading, setLoading] = useState(false);
  const { setProducts, setSelectedProduct } = useProductContext();
  const { categories, selectedCategoryId } = useCategoryContext();
  const { setPrevCategory, setPrevProducts } = usePrevProductContext();
  const { network } = useNetworkContext();
  const { accessToken } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();

  const t = useTranslations();
  const locale = useLocale();
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

  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [brandId, setBrandId] = useState(initBrandId || '');
  const [brandSearch, setBrandSearch] = useState('');
  const [editingBrandId, setEditingBrandId] = useState<string | null>(null);
  const [editBrandName, setEditBrandName] = useState('');

  const loadBrands = async () => {
    const data = await fetchBrands();
    setBrands(data);
  };

  useEffect(() => {
    loadBrands();
  }, []);

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

  useEffect(() => {
    if (selectedCategoryId == null) return;
    setCategoryId(selectedCategoryId);
  }, [selectedCategoryId]);

  useEffect(() => {
    if (imageUrls == null || imageUrls.length === 0) return;
    (async () => {
      const initialProductImageUrl: { [key: string]: string }[] =
        await Promise.all(
          imageUrls.map(async (imageUrl) => {
            try {
              new URL(imageUrl);
              return { [imageUrl]: imageUrl };
            } catch (_) {
              return {
                [imageUrl]: URL.createObjectURL(
                  await (
                    await fetch(
                      `${BASE_URL}/api/localImage?imgUrl=${imageUrl}&network=${network}`,
                    )
                  ).blob(),
                ),
              };
            }
          }),
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
    })();
  }, [imageUrls, network]);

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
          name: parseName(currCat.name, locale),
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
          if (categoryId == null) return;

          setLoading(true);

          try {
            const formData = new FormData(
              event.currentTarget as unknown as HTMLFormElement,
            );

            const updatedProduct = await addEditProduct({
              formJson: Object.fromEntries(formData.entries()),
              productNameRequiredError: t('productNameRequired'),
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
            });
            setSelectedProduct(updatedProduct);
            if (setProduct) {
              setProduct(updatedProduct);
            }
          } catch (error) {
            setLoading(false);
            if (snackbarErrorHandler) {
              snackbarErrorHandler(
                dialogType === 'add'
                  ? 'createProductError'
                  : 'editProductError',
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
            {categoryId && (
              <Box className={addEditProductDialogClasses.box.flex.gap}>
                <Typography>{t('category')}</Typography>
                <Select
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                  }}
                >
                  {flattenedCats.map((cat) => (
                    <MenuItem value={cat.id} key={cat.id}>
                      {parseName(cat.name, locale)}
                    </MenuItem>
                  ))}
                </Select>
              </Box>
            )}

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
                label={t('inEnglish')}
                name="productNameInEnglish"
                className={
                  addEditProductDialogClasses.textField.usual[platform]
                }
                defaultValue={parsedProductName.en ?? ''}
              />
            </Box>
            <Box>
              <Typography>{t('productDescription')}</Typography>
              <TextField
                label={t('inRussian')}
                type="text"
                name="productDescriptionInRussian"
                multiline
                className={
                  addEditProductDialogClasses.textField.usual[platform]
                }
                defaultValue={
                  parsedProductDescription.ru ?? defaultProductDescRu
                }
              />
              <TextField
                label={t('inTurkmen')}
                type="text"
                name="productDescriptionInTurkmen"
                multiline
                className={
                  addEditProductDialogClasses.textField.usual[platform]
                }
                defaultValue={
                  parsedProductDescription.tk ?? defaultProductDescTk
                }
              />
              <TextField
                label={t('inTurkish')}
                type="text"
                name="productDescriptionInTurkish"
                multiline
                className={
                  addEditProductDialogClasses.textField.usual[platform]
                }
                defaultValue={
                  parsedProductDescription.tr ?? defaultProductDescTr
                }
              />
              <TextField
                label={t('inCharjov')}
                type="text"
                name="productDescriptionInCharjov"
                multiline
                className={
                  addEditProductDialogClasses.textField.usual[platform]
                }
                defaultValue={
                  parsedProductDescription.ch ?? defaultProductDescCh
                }
              />
              <TextField
                label={t('inEnglish')}
                type="text"
                name="productDescriptionInEnglish"
                multiline
                className={
                  addEditProductDialogClasses.textField.usual[platform]
                }
                defaultValue={
                  parsedProductDescription.en ?? defaultProductDescEn
                }
              />
            </Box>
            <TextField
              label={t('price')}
              type="text"
              name="price"
              className={addEditProductDialogClasses.textField.price[platform]}
              defaultValue={price ?? ''}
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
            {tags.map((tag, index) => (
              <Box
                className={addEditProductDialogClasses.box.flex.rowGap}
                key={index}
              >
                <TextField
                  type="text"
                  name={`tag${index}`}
                  className={
                    addEditProductDialogClasses.textField.usual[platform]
                  }
                  value={tag}
                  onChange={(event) => {
                    const newTags = [...tags];
                    newTags[index] = event.currentTarget.value;
                    setTags(newTags);
                  }}
                />
                <IconButton
                  onClick={() => setTags(tags.filter((_, i) => i !== index))}
                >
                  <CancelIcon fontSize="medium" color="error" />
                </IconButton>
              </Box>
            ))}
            <Box className={addEditProductDialogClasses.box.flex.rowEnd}>
              <Button variant="outlined" onClick={() => setTags([...tags, ''])}>
                {t('add')}
              </Button>
            </Box>
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
