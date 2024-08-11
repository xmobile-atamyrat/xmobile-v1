import BASE_URL from '@/lib/ApiEndpoints';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import { AddEditProductProps } from '@/pages/lib/types';
import {
  addEditProduct,
  isNumeric,
  VisuallyHiddenInput,
} from '@/pages/lib/utils';
import { DeleteOutlined } from '@mui/icons-material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
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
  TextField,
  Typography,
} from '@mui/material';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

interface AddEditProductDialogProps {
  handleClose: () => void;
  args: AddEditProductProps;
  snackbarErrorHandler?: (message: string) => void;
}

export default function AddEditProductDialog({
  handleClose,
  args: { description, dialogType, id, imageUrls, name, price },
  snackbarErrorHandler,
}: AddEditProductDialogProps) {
  const [loading, setLoading] = useState(false);
  const { setProducts, setSelectedProduct } = useProductContext();
  const { selectedCategoryId } = useCategoryContext();
  const t = useTranslations();

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

  const parsedProductName = JSON.parse(name ?? '{}');
  const parsedProductDescription = JSON.parse(description ?? '{}');

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
                    await fetch(`${BASE_URL}/api/localImage?imgUrl=${imageUrl}`)
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
  }, [imageUrls]);

  return (
    <Dialog
      open
      onClose={handleClose}
      component="form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (selectedCategoryId == null) return;

        setLoading(true);

        try {
          const formData = new FormData(
            event.currentTarget as unknown as HTMLFormElement,
          );

          const updatedProduct = await addEditProduct({
            formJson: Object.fromEntries(formData.entries()),
            productNameRequiredError: t('productNameRequired'),
            selectedCategoryId,
            setProducts,
            productImageFiles,
            deleteImageUrls: originalDeletedProductImageUrls,
            productImageUrls: productImageUrls
              .filter((obj) => {
                const [key] = Object.keys(obj);
                return isNumeric(key);
              })
              .map((obj) => obj[Object.keys(obj)[0]]),
            type: dialogType,
            selectedProductId: id,
          });
          setSelectedProduct(updatedProduct);
        } catch (error) {
          setLoading(false);
          if (snackbarErrorHandler) {
            snackbarErrorHandler(
              dialogType === 'add' ? 'createProductError' : 'editProductError',
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
        <Box className="flex flex-col w-[300px] sm:w-[600px] gap-2 p-2">
          <Box className="w-full">
            <Typography>
              {t('productName')}
              <span style={{ color: 'red' }}>*</span>
            </Typography>
            <TextField
              label={t('inTurkmen')}
              name="productNameInTurkmen"
              className="my-1 sm:mr-2 sm:min-w-[250px] w-full sm:w-1/3"
              defaultValue={parsedProductName.tk ?? ''}
            />
            <TextField
              label={t('inCharjov')}
              name="productNameInCharjov"
              className="my-1 sm:mr-2 sm:min-w-[250px] w-full sm:w-1/3"
              defaultValue={parsedProductName.ch ?? ''}
            />
            <TextField
              label={t('inRussian')}
              name="productNameInRussian"
              className="my-1 sm:mr-2 sm:min-w-[250px] w-full sm:w-1/3"
              defaultValue={parsedProductName.ru ?? ''}
            />
            <TextField
              label={t('inEnglish')}
              name="productNameInEnglish"
              className="my-1 sm:mr-2 sm:min-w-[250px] w-full sm:w-1/3"
              defaultValue={parsedProductName.en ?? ''}
            />
          </Box>
          <Box>
            <Typography>{t('productDescription')}</Typography>
            <TextField
              label={t('inTurkmen')}
              type="text"
              name="productDescriptionInTurkmen"
              multiline
              className="my-1 sm:mr-2 sm:min-w-[250px] w-full sm:w-1/3"
              defaultValue={parsedProductDescription.tk ?? ''}
            />
            <TextField
              label={t('inCharjov')}
              type="text"
              name="productDescriptionInCharjov"
              multiline
              className="my-1 sm:mr-2 sm:min-w-[250px] w-full sm:w-1/3"
              defaultValue={parsedProductDescription.ch ?? ''}
            />
            <TextField
              label={t('inRussian')}
              type="text"
              name="productDescriptionInRussian"
              multiline
              className="my-1 sm:mr-2 sm:min-w-[250px] w-full sm:w-1/3"
              defaultValue={parsedProductDescription.ru ?? ''}
            />
            <TextField
              label={t('inEnglish')}
              type="text"
              name="productDescriptionInEnglish"
              multiline
              className="my-1 sm:mr-2 sm:min-w-[250px] w-full sm:w-1/3"
              defaultValue={parsedProductDescription.en ?? ''}
            />
          </Box>
          <TextField
            label={t('price')}
            type="text"
            name="price"
            className="my-1 sm:mr-2 sm:min-w-[250px] w-full sm:w-1/3"
            defaultValue={price ?? ''}
          />
        </Box>
        <Box className="flex flex-col p-2">
          <Box className="flex flex-col">
            <TextField
              margin="dense"
              id="imgUrl"
              label={t('imageUrl')}
              type="url"
              name="imgUrl"
              className="my-1 sm:mr-2 w-full sm:w-[250px] text-[16px] h-[56px]"
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
              className="my-1 sm:mr-2 w-full sm:w-[250px] text-[16px] h-[56px]"
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
              <Box className="h-full w-full p-2 relative" key={key}>
                <CardMedia component="img" alt="asdf" src={url} width={200} />
                <IconButton
                  className="absolute right-0 top-0"
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
                        productImageFileUrls.filter((_, i) => i !== fileIndex),
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
                  className="absolute top-0 left-0 w-14"
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
            <Box className="h-full w-full p-2 relative" key={index}>
              <CardMedia component="img" alt="asdf" src={url} width={200} />
              <IconButton
                className="absolute right-0 top-0"
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
        <DialogActions>
          <Button variant="contained" color="error" onClick={handleClose}>
            {t('cancel')}
          </Button>
          <LoadingButton loading={loading} variant="contained" type="submit">
            {t('submit')}
          </LoadingButton>
        </DialogActions>
      </DialogActions>
    </Dialog>
  );
}
