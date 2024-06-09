import { Box } from '@mui/material';
import { ReactNode, useState } from 'react';
import CustomDrawer from '@/pages/components/Drawer';
import CustomAppBar from '@/pages/components/Appbar';
import { appBarHeight } from '@/pages/lib/constants';
import {
  DeleteCategoriesProps,
  EditCategoriesProps,
  ExtendedCategory,
  ResponseApi,
} from '@/pages/lib/types';
import { deleteCategory } from '@/pages/lib/utils';
import AddEditCategoriesDialog from '@/pages/components/AddEditCategoriesDialog';
import DeleteDialog from '@/pages/components/DeleteDialog';
import { useTranslations } from 'next-intl';
import BASE_URL from '@/lib/ApiEndpoints';
import { useCategoryContext } from '@/pages/lib/CategoryContext';

export default function Layout({ children }: { children: ReactNode }) {
  const [editCategoriesModal, setEditCategoriesModal] =
    useState<EditCategoriesProps>({ open: false });
  const [deleteCategoriesModal, setDeleteCategoriesModal] =
    useState<DeleteCategoriesProps>({ open: false });
  const [openDrawer, setOpenDrawer] = useState(false);
  const t = useTranslations();
  const { setCategories } = useCategoryContext();

  return (
    <Box
      sx={{
        display: 'flex',
        pt: `${appBarHeight}px`,
        width: '100%',
        height: '100%',
      }}
    >
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
        className="bg-[#F8F9FA]"
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
              data: categories,
            }: ResponseApi<ExtendedCategory[]> = await (
              await fetch(`${BASE_URL}/api/category`)
            ).json();

            if (catSuccess && categories) setCategories(categories);
          }}
        />
      )}
    </Box>
  );
}
