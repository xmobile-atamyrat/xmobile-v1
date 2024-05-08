import {
  EditCategoriesProps,
  ExtendedCategory,
  ResponseApi,
} from '@/pages/lib/types';
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
  styled,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import BASE_URL from '@/lib/ApiEndpoints';
import { Fragment, useEffect, useState } from 'react';
import LoadingButton from '@mui/lab/LoadingButton';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import AddCircleIcon from '@mui/icons-material/AddCircle';

const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

interface EditCategoriesDialogProps {
  handleClose: () => void;
  whoOpened: EditCategoriesProps['whoOpened'];
}

async function resizeImage(
  image: File,
  width: number,
  height: number,
): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        resolve(blob as Blob);
      });
    };
    img.src = URL.createObjectURL(image);
  });
}

export default function EditCategoriesDialog({
  handleClose,
  whoOpened,
}: EditCategoriesDialogProps) {
  const [loading, setLoading] = useState(false);
  const { setCategories, selectedCategoryId } = useCategoryContext();
  const [category, setCategory] = useState<ExtendedCategory>();

  useEffect(() => {
    if (whoOpened === 'parent' || selectedCategoryId == null) return;
    (async () => {
      const { success, data }: ResponseApi<ExtendedCategory> = await (
        await fetch(`${BASE_URL}/api/category?categoryId=${selectedCategoryId}`)
      ).json();
      if (success && data) setCategory(data);
    })();
  }, [selectedCategoryId, whoOpened]);

  return (
    <Dialog
      open
      onClose={handleClose}
      component="form"
      onSubmit={async (event) => {
        event.preventDefault();
        setLoading(true);
        const formData = new FormData(
          event.currentTarget as unknown as HTMLFormElement,
        );
        const formJson = Object.fromEntries(formData.entries());

        if (whoOpened === 'parent') {
          const newFormData = new FormData();
          const { categoryName, categoryImage } = formJson;
          const resizedImage = await resizeImage(
            categoryImage as File,
            240,
            240,
          );
          newFormData.append('name', categoryName);
          newFormData.append('imageUrl', resizedImage);

          await fetch(`${BASE_URL}/api/category`, {
            method: 'POST',
            body: newFormData,
          });

          const {
            success: catSuccess,
            data: categories,
          }: ResponseApi<ExtendedCategory[]> = await (
            await fetch(`${BASE_URL}/api/category`)
          ).json();

          if (catSuccess && categories) setCategories(categories);

          setLoading(false);
          handleClose();
        } else {
          // edit category
        }
      }}
    >
      <DialogTitle className="w-full flex justify-center">
        {whoOpened === 'parent'
          ? 'Create new Category'
          : 'Edit or Create new Category'}
      </DialogTitle>
      <DialogContent
        className={`overflow-auto min-h-[${whoOpened === 'parent' ? '300px' : '600px'}] min-w-[600px]`}
      >
        {whoOpened === 'parent' ? (
          <Box className="flex flex-row items-start justify-center">
            <TextField
              label="Category Name"
              name="categoryName"
              className="m-2 min-w-[250px]"
            />
            <Button
              component="label"
              role={undefined}
              variant="contained"
              tabIndex={-1}
              startIcon={<CloudUploadIcon />}
              sx={{ textTransform: 'none' }}
              className="m-2 min-w-[250px] text-[16px]"
            >
              Upload category image
              <VisuallyHiddenInput
                type="file"
                name="categoryImage"
                accept="image/*"
              />
            </Button>
          </Box>
        ) : (
          category != null && (
            <Box className="flex flex-col">
              <Box className="flex flex-row">
                <TextField
                  label="Category Name"
                  name="parentCategoryName"
                  defaultValue={category.name}
                  className="m-2 w-1/2"
                />
                <Button
                  component="label"
                  role={undefined}
                  variant="contained"
                  tabIndex={-1}
                  startIcon={<CloudUploadIcon />}
                  sx={{ textTransform: 'none' }}
                  className="m-2 w-1/2 text-[16px]"
                >
                  Upload category image
                  <VisuallyHiddenInput
                    type="file"
                    name="categoryImage"
                    accept="image/*"
                  />
                </Button>
              </Box>
              <Box className="flex flex-col pl-12 py-2">
                {category.successorCategories?.map((cat, index) => (
                  <Fragment key={cat.id}>
                    <Typography>|--- {cat.name}</Typography>
                    {category.successorCategories &&
                    index !== category.successorCategories.length - 1 ? (
                      <Typography>|</Typography>
                    ) : (
                      <IconButton
                        className="flex flex-row justify-start h-10 w-10"
                        color="primary"
                      >
                        <AddCircleIcon />
                      </IconButton>
                    )}
                  </Fragment>
                ))}
              </Box>
            </Box>
          )
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="contained" color="error" onClick={handleClose}>
          Close
        </Button>
        <LoadingButton loading={loading} variant="contained" type="submit">
          Submit
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
