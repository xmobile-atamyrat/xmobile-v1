import { LoadingButton } from '@mui/lab';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import { useState } from 'react';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { VisuallyHiddenInput, resizeImage } from '@/pages/lib/utils';
import BASE_URL from '@/lib/ApiEndpoints';
import { ResponseApi } from '@/pages/lib/types';
import { Product } from '@prisma/client';
import { useProductoryContext } from '@/pages/lib/ProductContext';
import { useCategoryContext } from '@/pages/lib/CategoryContext';

interface AddProductDialogProps {
  handleClose: () => void;
}

export default function AddProductDialog({
  handleClose,
}: AddProductDialogProps) {
  const [loading, setLoading] = useState(false);
  const { setProducts } = useProductoryContext();
  const { selectedCategoryId } = useCategoryContext();

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
        const { name, description, price, imgUrl, productImage } =
          Object.fromEntries(formData.entries());
        const productImageFile = productImage as File;
        const newFormData = new FormData();

        newFormData.append('name', name);
        newFormData.append('categoryId', selectedCategoryId);
        if (description) newFormData.append('description', description);
        if (price) newFormData.append('price', price);
        if (imgUrl) {
          newFormData.append('imageUrl', imgUrl);
        } else if (
          productImageFile?.name !== '' &&
          productImageFile?.size !== 0
        ) {
          const resizedImage = await resizeImage(productImageFile, 240, 240);
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
        // handleClose();
      }}
    >
      <DialogTitle>Add new product</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          id="name"
          label="Name"
          type="text"
          fullWidth
          required
          name="name"
        />
        <TextField
          margin="dense"
          id="description"
          label="Description"
          type="text"
          fullWidth
          name="description"
        />
        <TextField
          margin="dense"
          id="price"
          label="Price"
          type="number"
          fullWidth
          name="price"
        />
        <TextField
          margin="dense"
          id="imgUrl"
          label="Image URL"
          type="url"
          fullWidth
          name="imgUrl"
        />
        <Button
          component="label"
          role={undefined}
          variant="contained"
          tabIndex={-1}
          startIcon={<CloudUploadIcon />}
          sx={{ textTransform: 'none' }}
          className="m-2 min-w-[250px] text-[16px] h-[56px]"
        >
          Upload category image
          <VisuallyHiddenInput
            type="file"
            name="productImage"
            accept="image/*"
          />
        </Button>
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
