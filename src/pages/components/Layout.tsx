import { Box } from '@mui/material';
import { ReactNode, useState } from 'react';
import CustomDrawer from '@/pages/components/Drawer';
import EditCategoriesDialog from '@/pages/components/EditCategoriesDialog';
import CustomAppBar from '@/pages/components/Appbar';
import { appBarHeight } from '@/pages/lib/constants';
import { DeleteCategoriesProps, EditCategoriesProps } from '@/pages/lib/types';
import DeleteCategoriesDialog from '@/pages/components/DeleteCategoriesDialog';
import { deleteCategory } from '@/pages/lib/utils';

export default function Layout({ children }: { children: ReactNode }) {
  const [editCategoriesModal, setEditCategoriesModal] =
    useState<EditCategoriesProps>({ open: false });
  const [deleteCategoriesModal, setDeleteCategoriesModal] =
    useState<DeleteCategoriesProps>({ open: false });
  return (
    <Box sx={{ display: 'flex', pt: `${appBarHeight}px` }}>
      <CustomAppBar />
      <CustomDrawer
        setEditCategoriesModal={setEditCategoriesModal}
        setDeleteCategoriesModal={setDeleteCategoriesModal}
      />
      <Box
        component="main"
        sx={{ flexGrow: 1, p: 3, width: '100%', height: '100%' }}
      >
        {children}
      </Box>
      {editCategoriesModal.open && (
        <EditCategoriesDialog
          editCategoriesModal={editCategoriesModal}
          handleClose={() =>
            setEditCategoriesModal({ open: false, dialogType: undefined })
          }
        />
      )}
      {deleteCategoriesModal.open && (
        <DeleteCategoriesDialog
          handleClose={() =>
            setDeleteCategoriesModal({
              open: false,
              categoryId: undefined,
              imgUrl: undefined,
            })
          }
          handleDelete={async () => {
            const { categoryId, imgUrl } = deleteCategoriesModal;
            if (categoryId == null || imgUrl == null) return;
            await deleteCategory(categoryId, imgUrl);
          }}
        />
      )}
    </Box>
  );
}
