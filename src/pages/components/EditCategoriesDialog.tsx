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
  TextField,
  Typography,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import BASE_URL from '@/lib/ApiEndpoints';
import { useState } from 'react';
import LoadingButton from '@mui/lab/LoadingButton';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { VisuallyHiddenInput, resizeImage } from '@/pages/lib/utils';
import { useTranslations } from 'next-intl';

interface EditCategoriesDialogProps {
  handleClose: () => void;
  editCategoriesModal: EditCategoriesProps;
}

// interface EditCategoriesDialogBaseProps {
//   textfields: {
//     label: string;
//     name: string;
//     defaultValue?: string;
//     required?: boolean;
//   }[];
// }

// function EditCategoriesDialogBase(): ReactNode {
//   return (
//     <Box className="flex flex-row items-start justify-between gap-4">
//       <TextField
//         label="Category Name"
//         name="categoryName"
//         className="m-2 min-w-[250px] w-1/2"
//         required
//       />
//       <Button
//         component="label"
//         role={undefined}
//         variant="contained"
//         tabIndex={-1}
//         startIcon={<CloudUploadIcon />}
//         sx={{ textTransform: 'none' }}
//         className="m-2 min-w-[250px] text-[16px] h-[56px] w-1/2"
//       >
//         Upload category image
//         <VisuallyHiddenInput
//           type="file"
//           name="categoryImage"
//           accept="image/*"
//         />
//       </Button>
//     </Box>
//   );
// }

export default function EditCategoriesDialog({
  handleClose,
  editCategoriesModal,
}: EditCategoriesDialogProps) {
  const [loading, setLoading] = useState(false);
  const { setCategories, selectedCategoryId } = useCategoryContext();
  const t = useTranslations();

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

        if (editCategoriesModal.dialogType === 'add') {
          const newFormData = new FormData();
          const { categoryName, categoryImage } = formJson;
          const categoryImageFile = categoryImage as File;
          if (categoryImageFile?.name !== '' && categoryImageFile?.size !== 0) {
            const resizedImage = await resizeImage(categoryImageFile, 240);
            newFormData.append('imageUrl', resizedImage);
          }
          newFormData.append('name', categoryName);
          if (selectedCategoryId != null)
            newFormData.append('predecessorId', selectedCategoryId);

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
          const newFormData = new FormData();
          const { editCategoryName, editCategoryImage } = formJson;
          const categoryImageFile = editCategoryImage as File;
          if (categoryImageFile?.name !== '' && categoryImageFile?.size !== 0) {
            const resizedImage = await resizeImage(categoryImageFile, 240);
            newFormData.append('imageUrl', resizedImage);
          }
          newFormData.append('name', editCategoryName);

          await fetch(
            `${BASE_URL}/api/category?categoryId=${selectedCategoryId}`,
            {
              method: 'PUT',
              body: newFormData,
            },
          );

          const {
            success: catSuccess,
            data: categories,
          }: ResponseApi<ExtendedCategory[]> = await (
            await fetch(`${BASE_URL}/api/category`)
          ).json();

          if (catSuccess && categories) setCategories(categories);

          setLoading(false);
          handleClose();
        }
      }}
    >
      <DialogTitle className="w-full flex justify-center">
        {editCategoriesModal.dialogType === 'add'
          ? t('addNewCategory')
          : t('editCategory')}
      </DialogTitle>
      <DialogContent className="min-w-[600px]">
        {editCategoriesModal.dialogType === 'add' ? (
          <Box className="flex flex-col gap-4">
            <Box>
              <Typography>
                {t('categoryName')}
                <span style={{ color: 'red' }}>*</span>
              </Typography>
              <TextField
                label={t('inTurkmen')}
                name="categoryNameInTurkmen"
                className="m-2 min-w-[250px] w-1/3"
              />
              <TextField
                label={t('inCharjov')}
                name="categoryNameInCharjov"
                className="m-2 min-w-[250px] w-1/3"
              />
              <TextField
                label={t('inRussian')}
                name="categoryNameInRussian"
                className="m-2 min-w-[250px] w-1/3"
              />
              <TextField
                label={t('inEnglish')}
                name="categoryNameInEnglish"
                className="m-2 min-w-[250px] w-1/3"
              />
            </Box>
            <Box>
              <Typography>
                {`${t('categoryLogo')} `}
                <span
                  style={{ fontSize: '12px' }}
                >{`(${t('notRequired')})`}</span>
              </Typography>
              <Button
                component="label"
                role={undefined}
                variant="contained"
                tabIndex={-1}
                startIcon={<CloudUploadIcon />}
                sx={{ textTransform: 'none' }}
                className="m-2 min-w-[250px] text-[16px] h-[56px] w-1/3"
              >
                Upload category image
                <VisuallyHiddenInput
                  type="file"
                  name="categoryImage"
                  accept="image/*"
                />
              </Button>
            </Box>
          </Box>
        ) : (
          <Box className="flex flex-row items-start justify-between gap-4">
            <TextField
              label="Category Name"
              name="editCategoryName"
              defaultValue={editCategoriesModal.categoryName || ''}
              className="w-1/2"
              required
            />
            <Button
              component="label"
              role={undefined}
              variant="contained"
              tabIndex={-1}
              startIcon={<CloudUploadIcon />}
              sx={{ textTransform: 'none' }}
              className="m-2 w-1/2 text-[16px] h-[56px]"
            >
              Change image
              <VisuallyHiddenInput
                type="file"
                name="editCategoryImage"
                accept="image/*"
              />
            </Button>
          </Box>
        )}
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
  );
}
