import BASE_URL from '@/lib/ApiEndpoints';
import AddEditCategoriesDialog from '@/pages/components/AddEditCategoriesDialog';
import CustomAppBar from '@/pages/components/Appbar';
import ChatWidget from '@/pages/components/chat/ChatWidget';
import DeleteDialog from '@/pages/components/DeleteDialog';
import Footer from '@/pages/components/Footer';
import NotificationPermissionBanner from '@/pages/components/NotificationPermissionBanner';
import { fetchProducts } from '@/pages/lib/apis';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { MAIN_BG_COLOR } from '@/pages/lib/constants';
import { usePrevProductContext } from '@/pages/lib/PrevProductContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import {
  DeleteCategoriesProps,
  EditCategoriesProps,
  ExtendedCategory,
  ResponseApi,
} from '@/pages/lib/types';
import { deleteCategory } from '@/pages/lib/utils';
import { Box } from '@mui/material';
import { useTranslations } from 'next-intl';
import { ReactNode, useEffect, useState } from 'react';

interface LayoutProps {
  children: ReactNode;
  handleHeaderBackButton?: () => void;
  showSearch?: boolean;
}

export default function Layout({
  children,
  handleHeaderBackButton,
  showSearch = false,
}: LayoutProps) {
  const [editCategoriesModal, setEditCategoriesModal] =
    useState<EditCategoriesProps>({ open: false });
  const [deleteCategoriesModal, setDeleteCategoriesModal] =
    useState<DeleteCategoriesProps>({ open: false });
  const t = useTranslations();
  const { setCategories, setSelectedCategoryId, categories } =
    useCategoryContext();
  const { setProducts } = useProductContext();
  const { setPrevCategory, setPrevProducts } = usePrevProductContext();

  useEffect(() => {
    if (categories.length > 0) return;
    (async () => {
      const { success, data: categoriesData }: ResponseApi<ExtendedCategory[]> =
        await (await fetch(`${BASE_URL}/api/category`)).json();

      if (success && categoriesData) {
        setCategories(categoriesData);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box className="w-full h-full">
      <CustomAppBar
        handleBackButton={handleHeaderBackButton}
        showSearch={showSearch}
        setDeleteCategoriesModal={setDeleteCategoriesModal}
        setEditCategoriesModal={setEditCategoriesModal}
      />
      <NotificationPermissionBanner />
      <Box
        component="main"
        className={`bg-[${MAIN_BG_COLOR}] min-h-screen w-full relative flex flex-col justify-between`}
      >
        {children}
        <Footer />
      </Box>
      {editCategoriesModal.open && (
        <AddEditCategoriesDialog
          editCategoriesModal={editCategoriesModal}
          handleClose={() =>
            setEditCategoriesModal({ open: false, dialogType: undefined })
          }
        />
      )}
      {deleteCategoriesModal.open && (
        <DeleteDialog
          description={t('confirmDeleteCategory')}
          title={t('deleteCategories')}
          blueButtonText={t('cancel')}
          redButtonText={t('delete')}
          handleClose={() =>
            setDeleteCategoriesModal({
              open: false,
              categoryId: undefined,
              imgUrl: undefined,
            })
          }
          handleDelete={async () => {
            try {
              const { categoryId, imgUrl } = deleteCategoriesModal;
              if (categoryId == null) return;
              await deleteCategory(categoryId, imgUrl);

              const {
                success: catSuccess,
                data: updatedCategories,
              }: ResponseApi<ExtendedCategory[]> = await (
                await fetch(`${BASE_URL}/api/category`)
              ).json();

              if (catSuccess && updatedCategories) {
                setCategories(updatedCategories);

                if (
                  updatedCategories.length > 0 &&
                  updatedCategories[0]?.id != null
                ) {
                  setSelectedCategoryId(updatedCategories[0].id);
                  const prods = await fetchProducts({
                    categoryId: updatedCategories[0].id,
                  });
                  setProducts(prods);
                  setPrevProducts(prods);
                  setPrevCategory(updatedCategories[0].id);
                } else {
                  setSelectedCategoryId(undefined);
                  setProducts([]);
                }
              }
            } catch (error) {
              console.error(error);
            } finally {
              setDeleteCategoriesModal({
                open: false,
                categoryId: undefined,
                imgUrl: undefined,
              });
            }
          }}
        />
      )}
      <ChatWidget />
    </Box>
  );
}
