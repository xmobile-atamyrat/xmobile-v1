import BASE_URL from '@/lib/ApiEndpoints';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import { AddEditProductProps } from '@/pages/lib/types';
import { VisuallyHiddenInput, addProduct } from '@/pages/lib/utils';
import { DeleteOutlined } from '@mui/icons-material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { LoadingButton } from '@mui/lab';
import {
  Box,
  Button,
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

interface AddProductDialogProps {
  handleClose: () => void;
  args: AddEditProductProps;
}

export default function AddProductDialog({
  handleClose,
  args: { description, dialogType, id, imageUrl, name, price },
}: AddProductDialogProps) {
  const [loading, setLoading] = useState(false);
  const { setProducts } = useProductContext();
  const { selectedCategoryId } = useCategoryContext();
  const t = useTranslations();

  const [productImageFile, setProductImageFile] = useState<File>();
  const [productLogoUrl, setProductLogoUrl] = useState<string>();
  const [productImageUrl, setProductImageUrl] = useState<string>();

  const [errorMessage, setErrorMessage] = useState<string>();

  const parsedProductName = JSON.parse(name ?? '{}');
  const parsedProductDescription = JSON.parse(description ?? '{}');

  useEffect(() => {
    if (imageUrl == null) return;
    try {
      new URL(imageUrl);
      setProductImageUrl(imageUrl);
    } catch (_) {
      setProductLogoUrl(imageUrl);
    }
  }, [imageUrl]);

  return (
    <Dialog
      open
      onClose={handleClose}
      component="form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (selectedCategoryId == null) return;

        setLoading(true);
        setErrorMessage(undefined);

        try {
          const formData = new FormData(
            event.currentTarget as unknown as HTMLFormElement,
          );
          await addProduct({
            formJson: Object.fromEntries(formData.entries()),
            productNameRequiredError: t('productNameRequired'),
            selectedCategoryId,
            setProducts,
            productImageFile,
            productImageUrl,
            type: dialogType,
            selectedProductId: id,
          });
        } catch (error) {
          setLoading(false);
          setErrorMessage((error as Error).message);
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
            {errorMessage && (
              <Typography fontSize={14} color="red">
                {errorMessage}
              </Typography>
            )}
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
            type="number"
            name="price"
            className="my-1 sm:mr-2 sm:min-w-[250px] w-full sm:w-1/3"
            defaultValue={price ?? ''}
          />
        </Box>
        <Box className="flex flex-col sm:flex-row p-2">
          <Box className="flex flex-col">
            <TextField
              margin="dense"
              id="imgUrl"
              label={t('imageUrl')}
              type="url"
              name="imgUrl"
              className="my-1 sm:mr-2 w-full sm:w-[250px] text-[16px] h-[56px]"
              value={productImageUrl ?? ''}
              onChange={(event) => {
                try {
                  const { value } = event.target;
                  new URL(value);
                  setProductImageUrl(value);
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
                  setProductImageFile(file);
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = () => {
                      setProductLogoUrl(reader.result as string);
                    };
                    reader.readAsDataURL(file);
                  }
                  event.target.value = '';
                }}
              />
            </Button>
          </Box>
          {(productLogoUrl || productImageUrl) && (
            <Box className="h-full w-full p-2 relative">
              <img
                alt="asdf"
                src={productImageUrl ?? productLogoUrl}
                width={200}
                onError={async (error) => {
                  if (productLogoUrl == null) return;
                  error.currentTarget.onerror = null;
                  error.currentTarget.src = URL.createObjectURL(
                    await (
                      await fetch(
                        `${BASE_URL}/api/localImage?imgUrl=${productLogoUrl}`,
                      )
                    ).blob(),
                  );
                }}
              />
              <IconButton
                className="absolute right-0 top-0"
                onClick={() => {
                  setProductLogoUrl(undefined);
                  setProductImageUrl(undefined);
                  setProductImageFile(undefined);
                }}
              >
                <DeleteOutlined fontSize="medium" color="error" />
              </IconButton>
            </Box>
          )}
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
