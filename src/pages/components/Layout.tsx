import { Box } from '@mui/material';
import { ReactNode, useState } from 'react';
import CustomDrawer from '@/pages/components/Drawer';
import CustomAppBar from '@/pages/components/Appbar';
import { appBarHeight } from '@/pages/lib/constants';
import { DeleteCategoriesProps, EditCategoriesProps } from '@/pages/lib/types';
import DeleteCategoriesDialog from '@/pages/components/DeleteCategoriesDialog';
import { deleteCategory } from '@/pages/lib/utils';
import AddEditCategoriesDialog from '@/pages/components/AddEditCategoriesDialog';

export default function Layout({ children }: { children: ReactNode }) {
  const [editCategoriesModal, setEditCategoriesModal] =
    useState<EditCategoriesProps>({ open: false });
  const [deleteCategoriesModal, setDeleteCategoriesModal] =
    useState<DeleteCategoriesProps>({ open: false });
  const [openDrawer, setOpenDrawer] = useState(false);
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
            if (categoryId == null) return;
            await deleteCategory(categoryId, imgUrl);
          }}
        />
      )}
    </Box>
  );
}
