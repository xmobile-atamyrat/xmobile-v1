import BASE_URL from '@/lib/ApiEndpoints';
import AddEditCategoriesDialog from '@/pages/components/AddEditCategoriesDialog';
import CustomAppBar from '@/pages/components/Appbar';
import DeleteDialog from '@/pages/components/DeleteDialog';
import CustomDrawer from '@/pages/components/Drawer';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { appBarHeight } from '@/pages/lib/constants';
import { useProductContext } from '@/pages/lib/ProductContext';
import {
  DeleteCategoriesProps,
  EditCategoriesProps,
  ExtendedCategory,
  ResponseApi,
} from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { deleteCategory } from '@/pages/lib/utils';
import { Box } from '@mui/material';
import { Product } from '@prisma/client';
import { useTranslations } from 'next-intl';
import { ReactNode, useEffect, useState } from 'react';

interface LayoutProps {
  children: ReactNode;
  showSearch: boolean;
  handleHeaderBackButton?: () => void;
}

export default function Layout({
  children,
  showSearch,
  handleHeaderBackButton,
}: LayoutProps) {
  const [editCategoriesModal, setEditCategoriesModal] =
    useState<EditCategoriesProps>({ open: false });
  const [deleteCategoriesModal, setDeleteCategoriesModal] =
    useState<DeleteCategoriesProps>({ open: false });
  const [openDrawer, setOpenDrawer] = useState(false);
  const t = useTranslations();
  const { setCategories, setSelectedCategoryId, categories } =
    useCategoryContext();
  const { setProducts } = useProductContext();
  const { user, setUser } = useUserContext();

  useEffect(() => {
    if (categories.length > 0) return;
    (async () => {
      const { success, data: categoriesData }: ResponseApi<ExtendedCategory[]> =
        await (await fetch(`${BASE_URL}/api/category`)).json();

      if (success && categoriesData) {
        setCategories(categoriesData);

        // TODO: get selected category id and toggle to selected category when drawer is opened
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user == null) {
      const userString = localStorage.getItem('user');
      if (userString != null) setUser(JSON.parse(userString));
    }
  }, [user, setUser]);

  return (
    <Box>
      <CustomAppBar
        openDrawer={openDrawer}
        setOpenDrawer={setOpenDrawer}
        showSearch={showSearch}
        handleBackButton={handleHeaderBackButton}
      />
      <CustomDrawer
        openDrawer={openDrawer}
        setEditCategoriesModal={setEditCategoriesModal}
        setDeleteCategoriesModal={setDeleteCategoriesModal}
        closeDrawer={() => setOpenDrawer(false)}
      />
      <Box
        component="main"
        sx={{ flexGrow: 1, width: '100%', height: '100%' }}
        className="bg-[#F8F9FA] min-h-screen"
        pt={`${appBarHeight}px`}
      >
        {children}
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
          handleClose={() =>
            setDeleteCategoriesModal({
              open: false,
              categoryId: undefined,
              imgUrl: undefined,
            })
          }
          handleDelete={async () => {
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
                setSelectedCategoryId(updatedCategories[0]?.id);
                const { success, data }: ResponseApi<Product[]> = await (
                  await fetch(
                    `${BASE_URL}/api/product?categoryId=${updatedCategories[0].id}`,
                  )
                ).json();
                if (success && data != null) setProducts(data);
              } else {
                setSelectedCategoryId(undefined);
                setProducts([]);
              }
            }
          }}
        />
      )}
    </Box>
  );
}
