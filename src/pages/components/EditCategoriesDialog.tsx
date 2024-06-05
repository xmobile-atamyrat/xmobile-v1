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
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { useEffect, useState } from 'react';
import LoadingButton from '@mui/lab/LoadingButton';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { VisuallyHiddenInput, addEditCategory } from '@/pages/lib/utils';
import { useTranslations } from 'next-intl';
import { DeleteOutlined } from '@mui/icons-material';
import { EditCategoriesProps } from '@/pages/lib/types';
import BASE_URL from '@/lib/ApiEndpoints';

interface EditCategoriesDialogProps {
  handleClose: () => void;
  editCategoriesModal: EditCategoriesProps;
}

export default function EditCategoriesDialog({
  handleClose,
  editCategoriesModal: { categoryName, dialogType, imageUrl },
}: EditCategoriesDialogProps) {
  const [loading, setLoading] = useState(false);
  const { setCategories, selectedCategoryId } = useCategoryContext();
  const t = useTranslations();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [categoryImageFile, setCategoryImageFile] = useState<File>();
  const [categoryLogoUrl, setCategoryLogoUrl] = useState<string>();
  const [categoryImageUrl, setCategoryImageUrl] = useState<string>();
  const parsedCategoryName = JSON.parse(categoryName ?? '{}');

  useEffect(() => {
    if (imageUrl == null) return;
    try {
      new URL(imageUrl);
      setCategoryImageUrl(imageUrl);
    } catch (_) {
      setCategoryLogoUrl(imageUrl);
    }
  }, [imageUrl]);

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
        try {
          await addEditCategory({
            type: dialogType,
            categoryImageFile,
            categoryImageUrl,
            formJson,
            setCategories,
            errorMessage: t('categoryNameRequired'),
            selectedCategoryId,
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
      <DialogTitle className="w-full flex justify-center">
        {dialogType === 'add' ? t('addNewCategory') : t('editCategory')}
      </DialogTitle>
      <DialogContent className="min-w-[600px]">
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
              defaultValue={parsedCategoryName.tk ?? ''}
            />
            <TextField
              label={t('inCharjov')}
              name="categoryNameInCharjov"
              className="m-2 min-w-[250px] w-1/3"
              defaultValue={parsedCategoryName.ch ?? ''}
            />
            <TextField
              label={t('inRussian')}
              name="categoryNameInRussian"
              className="m-2 min-w-[250px] w-1/3"
              defaultValue={parsedCategoryName.ru ?? ''}
            />
            <TextField
              label={t('inEnglish')}
              name="categoryNameInEnglish"
              className="m-2 min-w-[250px] w-1/3"
              defaultValue={parsedCategoryName.en ?? ''}
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
                      setCategoryImageFile(file);
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
                    value={categoryImageUrl ?? ''}
                    onChange={(event) => {
                      try {
                        const { value } = event.target;
                        new URL(value);
                        setCategoryImageUrl(value);
                      } catch (_) {
                        // do nothing
                      }
                    }}
                  />
                </Box>
              </Box>
              {(categoryLogoUrl != null || categoryImageUrl != null) && (
                <Box className="h-full w-full p-2 relative">
                  <img
                    alt="asdf"
                    src={categoryImageUrl ?? categoryLogoUrl}
                    width={200}
                    onError={async (error) => {
                      if (categoryLogoUrl == null) return;
                      error.currentTarget.onerror = null;
                      error.currentTarget.src = URL.createObjectURL(
                        await (
                          await fetch(
                            `${BASE_URL}/api/localImage?imgUrl=${categoryLogoUrl}`,
                          )
                        ).blob(),
                      );
                    }}
                  />
                  <IconButton
                    className="absolute right-0 top-0"
                    onClick={() => {
                      setCategoryLogoUrl(undefined);
                      setCategoryImageUrl(undefined);
                      setCategoryImageFile(undefined);
                    }}
                  >
                    <DeleteOutlined fontSize="medium" color="error" />
                  </IconButton>
                </Box>
              )}
            </Box>
          </Box>
        </Box>
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
