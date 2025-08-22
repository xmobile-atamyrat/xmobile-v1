import BASE_URL from '@/lib/ApiEndpoints';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { EditCategoriesProps } from '@/pages/lib/types';
import { VisuallyHiddenInput, addEditCategory } from '@/pages/lib/utils';
import { addEditCategoriesDialogClasses } from '@/styles/classMaps/AddEditCategoriesDialog';
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
  const platform = usePlatform();

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
      <DialogTitle className={addEditCategoriesDialogClasses.dialog.title}>
        {dialogType === 'add' ? t('addNewCategory') : t('editCategory')}
      </DialogTitle>
      <DialogContent sx={{ padding: 0 }}>
        <Box className={addEditCategoriesDialogClasses.box.flex.gapP}>
          <Box className={addEditCategoriesDialogClasses.box.flex.gap}>
            <Typography>
              {t('categoryName')}
              <span style={{ color: 'red' }}>*</span>
            </Typography>
            <TextField
              label={t('inTurkmen')}
              name="categoryNameInTurkmen"
              className={addEditCategoriesDialogClasses.textField[platform]}
              defaultValue={parsedCategoryName.tk ?? ''}
            />
            <TextField
              label={t('inCharjov')}
              name="categoryNameInCharjov"
              className={addEditCategoriesDialogClasses.textField[platform]}
              defaultValue={parsedCategoryName.ch ?? ''}
            />
            <TextField
              label={t('inRussian')}
              name="categoryNameInRussian"
              className={addEditCategoriesDialogClasses.textField[platform]}
              defaultValue={parsedCategoryName.ru ?? ''}
            />
            <TextField
              label={t('inEnglish')}
              name="categoryNameInEnglish"
              className={addEditCategoriesDialogClasses.textField[platform]}
              defaultValue={parsedCategoryName.en ?? ''}
            />
            {errorMessage && (
              <Typography fontSize={14} color="red">
                {errorMessage}
              </Typography>
            )}
          </Box>
          <Box className={addEditCategoriesDialogClasses.box.flex.gapFull}>
            <Typography>
              {`${t('categoryLogo')} `}
              <span
                style={{ fontSize: '12px' }}
              >{`(${t('notRequired')})`}</span>
            </Typography>
            <Box
              className={addEditCategoriesDialogClasses.box.flex.list[platform]}
            >
              <Box className={addEditCategoriesDialogClasses.box.flex.gapFull}>
                <Button
                  component="label"
                  role={undefined}
                  variant="contained"
                  tabIndex={-1}
                  startIcon={<CloudUploadIcon />}
                  sx={{ textTransform: 'none' }}
                  className={addEditCategoriesDialogClasses.button[platform]}
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
                    className={
                      addEditCategoriesDialogClasses.imgTxtField[platform]
                    }
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
                <Box className={addEditCategoriesDialogClasses.box.item}>
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
                    className={addEditCategoriesDialogClasses.icon}
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
      <DialogActions className={addEditCategoriesDialogClasses.dialog.actions}>
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
