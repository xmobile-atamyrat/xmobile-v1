import BASE_URL from '@/lib/ApiEndpoints';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useUserContext } from '@/pages/lib/UserContext';
import {
  findParentCategory,
  flattenCategories,
} from '@/pages/lib/categoryPathUtils';
import { HIGHEST_LEVEL_CATEGORY_ID } from '@/pages/lib/constants';
import { POPULAR_ROOT_LIMIT_CODE } from '@/pages/lib/popularCategoriesLayout';
import { EditCategoriesProps } from '@/pages/lib/types';
import {
  VisuallyHiddenInput,
  addEditCategory,
  parseName,
} from '@/pages/lib/utils';
import { addEditCategoriesDialogClasses } from '@/styles/classMaps/components/addEditCategoriesDialog';
import { DeleteOutlined } from '@mui/icons-material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import LoadingButton from '@mui/lab/LoadingButton';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface EditCategoriesDialogProps {
  handleClose: () => void;
  editCategoriesModal: EditCategoriesProps;
}

export default function AddEditCategoriesDialog({
  handleClose,
  editCategoriesModal: {
    categoryName,
    dialogType,
    imageUrl,
    popular: initialPopular,
    categoryId: editCategoryId,
  },
}: EditCategoriesDialogProps) {
  const [loading, setLoading] = useState(false);
  const {
    categories,
    setCategories,
    selectedCategoryId,
    setSelectedCategoryId,
  } = useCategoryContext();
  const { accessToken } = useUserContext();
  const t = useTranslations();
  const [categoryImageFile, setCategoryImageFile] = useState<File>();
  const [categoryLogoUrl, setCategoryLogoUrl] = useState<string>();
  const [categoryImageUrl, setCategoryImageUrl] = useState<string>();
  const [popularChecked, setPopularChecked] = useState(initialPopular ?? false);
  const [predecessorId, setPredecessorId] = useState<string>(
    HIGHEST_LEVEL_CATEGORY_ID,
  );
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'error' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'error',
  });

  const showSnackbar = useCallback(
    (message: string, severity: 'error' | 'warning') => {
      setSnackbar({ open: true, message, severity });
    },
    [],
  );

  const parsedCategoryName = JSON.parse(categoryName ?? '{}');
  const router = useRouter();
  const platform = usePlatform();

  useEffect(() => {
    if (dialogType === 'edit' && editCategoryId) {
      const parent = findParentCategory(editCategoryId, categories);
      setPredecessorId(parent?.id ?? HIGHEST_LEVEL_CATEGORY_ID);
    } else {
      setPredecessorId(HIGHEST_LEVEL_CATEGORY_ID);
    }
  }, [dialogType, editCategoryId, categories]);

  useEffect(() => {
    setPopularChecked(initialPopular ?? false);
  }, [initialPopular]);

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
        categoryIdForEdit: dialogType === 'edit' ? editCategoryId : undefined,
        popular: popularChecked,
        accessToken,
        predecessorId,
      });
      return firstCatId;
    },
    [
      selectedCategoryId,
      editCategoryId,
      popularChecked,
      dialogType,
      accessToken,
      t,
      categoryImageFile,
      categoryImageUrl,
      setCategories,
      predecessorId,
    ],
  );

  const flattenedCats = useMemo(() => {
    const flat = flattenCategories(categories);
    return [
      {
        id: HIGHEST_LEVEL_CATEGORY_ID,
        name: t('categoryParentRoot'),
        level: 0,
      },
      ...flat.map((cat) => ({
        ...cat,
        name: parseName(cat.name, router.locale ?? 'tk'),
      })),
    ].filter((cat) => cat.id !== editCategoryId);
  }, [categories, router.locale, editCategoryId]);

  return (
    <Dialog
      open
      fullScreen
      onClose={handleClose}
      component="form"
      onSubmit={async (event) => {
        event.preventDefault();
        setLoading(true);

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
          const msg = (error as Error).message;
          if (msg === POPULAR_ROOT_LIMIT_CODE) {
            showSnackbar(t('categoryHierarchyPopularLimitReached'), 'warning');
          } else {
            showSnackbar(msg, 'error');
          }
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
            <Autocomplete
              options={flattenedCats}
              getOptionLabel={(option) => {
                const prefix = '-'.repeat(option.level * 2);
                return `${prefix} ${option.name}`;
              }}
              value={
                flattenedCats.find((cat) => cat.id === predecessorId) ||
                flattenedCats[0]
              }
              onChange={(_, newValue) => {
                if (newValue) {
                  setPredecessorId(newValue.id);
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t('categoryParent')}
                  className={addEditCategoriesDialogClasses.textField[platform]}
                />
              )}
              disableClearable
            />
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
            {predecessorId === HIGHEST_LEVEL_CATEGORY_ID && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={popularChecked}
                    onChange={(_, checked) => setPopularChecked(checked)}
                    color="primary"
                  />
                }
                label={t('categoryPopular')}
              />
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
      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Dialog>
  );
}
