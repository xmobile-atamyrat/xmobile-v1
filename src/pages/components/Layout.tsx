import { Box } from '@mui/material';
import { ReactNode, useState } from 'react';
import CustomDrawer from '@/pages/components/Drawer';
import EditCategoriesDialog from '@/pages/components/EditCategoriesDialog';
import CustomAppBar from '@/pages/components/Appbar';
import { appBarHeight } from '@/pages/lib/constants';
import { EditCategoriesProps } from '@/pages/lib/types';

export default function Layout({ children }: { children: ReactNode }) {
  const [editCategoriesModal, setEditCategoriesModal] =
    useState<EditCategoriesProps>({ open: false });
  return (
    <Box sx={{ display: 'flex', pt: `${appBarHeight}px` }}>
      <CustomAppBar />
      <CustomDrawer setEditCategoriesModal={setEditCategoriesModal} />
      <Box
        component="main"
        sx={{ flexGrow: 1, p: 3, width: '100%', height: '100%' }}
      >
        {children}
      </Box>
      {editCategoriesModal.open && (
        <EditCategoriesDialog
          handleClose={() =>
            setEditCategoriesModal({ open: false, whoOpened: undefined })
          }
        />
      )}
    </Box>
  );
}
