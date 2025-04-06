import BASE_URL from '@/lib/ApiEndpoints';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { EditCategoriesProps } from '@/pages/lib/types';
import { VisuallyHiddenInput, addEditCategory } from '@/pages/lib/utils';
import { DeleteOutlined } from '@mui/icons-material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import LoadingButton from '@mui/lab/LoadingButton';
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
import { useCallback, useEffect, useState } from 'react';

interface EditCategoriesDialogProps {
  handleClose: () => void;
  editCategoriesModal: EditCategoriesProps;
}

export default function AddEditCategoriesDialog({
  handleClose,
  editCategoriesModal: { categoryName, dialogType, imageUrl },
}: EditCategoriesDialogProps) {
  const [loading, setLoading] = useState(false);
  const { setCategories, selectedCategoryId, setSelectedCategoryId } =
    useCategoryContext();
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

  const addEditCategoryCache = useCallback(
    async (formJson: {
      [k: string]: FormDataEntryValue;
    }): Promise<string | null> => {
      const firstCatId = await addEditCategory({
        type: dialogType,
        categoryImageFile,
        categoryImageUrl,
        formJson,
        setCategories,
        errorMessage: t('categoryNameRequired'),
        selectedCategoryId,
      });
      return firstCatId;
    },
    [
      selectedCategoryId,
      t,
      categoryImageFile,
      categoryImageUrl,
      setCategories,
      dialogType,
    ],
  );

  return (
    <Dialog
      open
      fullScreen
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
          const firstCatId = await addEditCategoryCache(formJson);
          if (selectedCategoryId == null && firstCatId != null) {
            setSelectedCategoryId(firstCatId);
          }
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
      <DialogContent sx={{ padding: 0 }}>
        <Box className="flex flex-col gap-4 p-2">
          <Box className="flex flex-col gap-2">
            <Typography>
              {t('categoryName')}
              <span style={{ color: 'red' }}>*</span>
            </Typography>
            <TextField
              label={t('inTurkmen')}
              name="categoryNameInTurkmen"
              className="my-1 sm:mr-2 min-w-[250px] w-full sm:w-1/3"
              defaultValue={parsedCategoryName.tk ?? ''}
            />
            <TextField
              label={t('inCharjov')}
              name="categoryNameInCharjov"
              className="my-1 sm:mr-2 min-w-[250px] w-full sm:w-1/3"
              defaultValue={parsedCategoryName.ch ?? ''}
            />
            <TextField
              label={t('inRussian')}
              name="categoryNameInRussian"
              className="my-1 sm:mr-2 min-w-[250px] w-full sm:w-1/3"
              defaultValue={parsedCategoryName.ru ?? ''}
            />
            <TextField
              label={t('inEnglish')}
              name="categoryNameInEnglish"
              className="my-1 sm:mr-2 min-w-[250px] w-full sm:w-1/3"
              defaultValue={parsedCategoryName.en ?? ''}
            />
            {errorMessage && (
              <Typography fontSize={14} color="red">
                {errorMessage}
              </Typography>
            )}
          </Box>
          <Box className="flex flex-col gap-2 w-full">
            <Typography>
              {`${t('categoryLogo')} `}
              <span
                style={{ fontSize: '12px' }}
              >{`(${t('notRequired')})`}</span>
            </Typography>
            <Box className="flex flex-col sm:flex-row justify-between items-start w-full">
              <Box className="flex flex-col gap-2 w-full">
                <Button
                  component="label"
                  role={undefined}
                  variant="contained"
                  tabIndex={-1}
                  startIcon={<CloudUploadIcon />}
                  sx={{ textTransform: 'none' }}
                  className="my-1 sm:mr-2 min-w-[250px] text-[16px] h-[56px] w-full sm:w-1/3"
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
                <Box sx={{ width: '100%' }}>
                  <TextField
                    label={t('categoryImageURL')}
                    className="w-full sm:w-[250px]"
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
