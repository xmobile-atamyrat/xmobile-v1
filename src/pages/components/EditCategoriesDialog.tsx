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

export default function EditCategoriesDialog({
  handleClose,
  editCategoriesModal,
}: EditCategoriesDialogProps) {
  const [loading, setLoading] = useState(false);
  const { setCategories, selectedCategoryId } = useCategoryContext();
  const t = useTranslations();
  const [categoryLogoUrl, setCategoryLogoUrl] = useState<string>();
  const [errorMessage, setErrorMessage] = useState<string>();

  return (
    <Dialog
      open
      onClose={handleClose}
      component="form"
      onSubmit={async (event) => {
        event.preventDefault();
        setLoading(true);
        setErrorMessage(undefined);

        const formData = new FormData(
          event.currentTarget as unknown as HTMLFormElement,
        );
        const formJson = Object.fromEntries(formData.entries());

        if (editCategoriesModal.dialogType === 'add') {
          const newFormData = new FormData();
          const {
            categoryNameInTurkmen,
            categoryNameInCharjov,
            categoryNameInRussian,
            categoryNameInEnglish,
            categoryImage,
            categoryImageUrl,
          } = formJson;

          if (
            categoryNameInCharjov === '' &&
            categoryNameInEnglish === '' &&
            categoryNameInRussian === '' &&
            categoryNameInTurkmen === ''
          ) {
            setLoading(false);
            setErrorMessage(t('categoryNameRequired'));
            return;
          }
          const categoryImageFile = categoryImage as File;
          if (categoryImageUrl !== '') {
            newFormData.append('imageUrl', categoryImageUrl);
          } else if (
            categoryImageFile?.name !== '' &&
            categoryImageFile?.size !== 0
          ) {
            const resizedImage = await resizeImage(categoryImageFile, 240);
            newFormData.append('imageUrl', resizedImage);
          }

          const categoryNames: any = {};
          if (categoryNameInTurkmen !== '')
            categoryNames.tk = categoryNameInTurkmen;
          if (categoryNameInCharjov !== '')
            categoryNames.ch = categoryNameInCharjov;
          if (categoryNameInRussian !== '')
            categoryNames.ru = categoryNameInRussian;
          if (categoryNameInEnglish !== '')
            categoryNames.en = categoryNameInEnglish;

          newFormData.append('name', JSON.stringify(categoryNames));
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
              {errorMessage && (
                <Typography fontSize={14} color="red">
                  {errorMessage}
                </Typography>
              )}
            </Box>
            <Box className="flex flex-col gap-2">
              <Typography>
                {`${t('categoryLogo')} `}
                <span
                  style={{ fontSize: '12px' }}
                >{`(${t('notRequired')})`}</span>
              </Typography>
              <Box className="flex flex-row justify-between items-start">
                <Box className="flex flex-col gap-2">
                  <Button
                    component="label"
                    role={undefined}
                    variant="contained"
                    tabIndex={-1}
                    startIcon={<CloudUploadIcon />}
                    sx={{ textTransform: 'none' }}
                    className="m-2 min-w-[250px] text-[16px] h-[56px] w-1/3"
                  >
                    {t('uploadCategoryImage')}
                    <VisuallyHiddenInput
                      type="file"
                      name="categoryImage"
                      accept="image/*"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => {
                            setCategoryLogoUrl(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                        event.target.value = '';
                      }}
                    />
                  </Button>
                  <Box sx={{ margin: '0.5rem', width: '100%' }}>
                    <TextField
                      label={t('categoryImageURL')}
                      className="w-[250px]"
                      onChange={(event) => {
                        setCategoryLogoUrl(event.target.value);
                      }}
                      name="categoryImageUrl"
                    />
                  </Box>
                </Box>
                {categoryLogoUrl && (
                  <img alt="asdf" src={categoryLogoUrl} width={200} />
                )}
              </Box>
            </Box>
          </Box>
        ) : (
          <Box className="flex flex-row items-center justify-between gap-4">
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
      <DialogActions className="mb-4 mr-4">
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
