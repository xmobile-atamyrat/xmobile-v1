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
import { deleteCategory } from '@/pages/lib/utils';
import { Box } from '@mui/material';
import { Product } from '@prisma/client';
import { useTranslations } from 'next-intl';
import { ReactNode, useState } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  const [editCategoriesModal, setEditCategoriesModal] =
    useState<EditCategoriesProps>({ open: false });
  const [deleteCategoriesModal, setDeleteCategoriesModal] =
    useState<DeleteCategoriesProps>({ open: false });
  const [openDrawer, setOpenDrawer] = useState(false);
  const t = useTranslations();
  const { setCategories, setSelectedCategoryId } = useCategoryContext();
  const { setProducts } = useProductContext();

  return (
    <Box>
      <CustomAppBar openDrawer={openDrawer} setOpenDrawer={setOpenDrawer} />
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
