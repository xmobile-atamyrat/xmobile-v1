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
} from '@mui/material';
import { useState } from 'react';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { VisuallyHiddenInput, resizeImage } from '@/pages/lib/utils';
import BASE_URL from '@/lib/ApiEndpoints';
import { ResponseApi } from '@/pages/lib/types';
import { Product } from '@prisma/client';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import { useTranslations } from 'next-intl';
import { DeleteOutlined } from '@mui/icons-material';

interface AddProductDialogProps {
  handleClose: () => void;
}

export default function AddProductDialog({
  handleClose,
}: AddProductDialogProps) {
  const [loading, setLoading] = useState(false);
  const { setProducts } = useProductContext();
  const { selectedCategoryId } = useCategoryContext();
  const t = useTranslations();

  const [productImageFile, setProductImageFile] = useState<File>();
  const [productLogoUrl, setProductLogoUrl] = useState<string>();
  const [productImageUrl, setProductImageUrl] = useState<string>();

  return (
    <Dialog
      open
      onClose={handleClose}
      component="form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (selectedCategoryId == null) return;

        setLoading(true);

        const formData = new FormData(
          event.currentTarget as unknown as HTMLFormElement,
        );
        const { name, description, price } = Object.fromEntries(
          formData.entries(),
        );
        const newFormData = new FormData();

        newFormData.append('name', name);
        newFormData.append('categoryId', selectedCategoryId);

        if (description) newFormData.append('description', description);
        if (price) newFormData.append('price', price);

        if (productImageUrl != null && productImageUrl !== '') {
          newFormData.append('imageUrl', productImageUrl);
        } else if (productImageFile != null && productImageFile?.name !== '') {
          const resizedImage = await resizeImage(productImageFile, 240);
          newFormData.append('imageUrl', resizedImage);
        }

        await fetch(`${BASE_URL}/api/product`, {
          method: 'POST',
          body: newFormData,
        });

        const { success, data }: ResponseApi<Product[]> = await (
          await fetch(
            `${BASE_URL}/api/product?categoryId=${selectedCategoryId}`,
          )
        ).json();
        if (success && data != null) setProducts(data);

        setLoading(false);
        handleClose();
      }}
    >
      <DialogTitle>{t('addNewProduct')}</DialogTitle>
      <DialogContent className="w-[600px]">
        <Box className="flex flex-col gap-2 p-2">
          <TextField autoFocus label="Name" type="text" required name="name" />
          <TextField
            label="Description"
            type="text"
            name="description"
            multiline
          />
          <TextField label="Price" type="number" name="price" />
        </Box>
        <Box className="flex flex-row">
          <Box className="flex flex-col">
            <TextField
              margin="dense"
              id="imgUrl"
              label="Image URL"
              type="url"
              name="imgUrl"
              className="m-2 w-[250px] text-[16px] h-[56px]"
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
              className="m-2 w-[250px] text-[16px] h-[56px]"
            >
              Upload category image
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
            Close
          </Button>
          <LoadingButton loading={loading} variant="contained" type="submit">
            Submit
          </LoadingButton>
        </DialogActions>
      </DialogActions>
    </Dialog>
  );
}
