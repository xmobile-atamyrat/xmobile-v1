import { Box } from '@mui/material';
import { ReactNode, useState } from 'react';
import CustomDrawer from '@/pages/components/Drawer';
import EditCategoriesDialog from '@/pages/components/EditCategoriesDialog';
import CustomAppBar from '@/pages/components/Appbar';
import { appBarHeight } from '@/pages/lib/constants';

export default function Layout({ children }: { children: ReactNode }) {
  const [editCategoriesModal, setEditCategoriesModal] = useState(false);
  return (
    <Box sx={{ display: 'flex', pt: `${appBarHeight}px` }}>
      <CustomAppBar />
      <CustomDrawer handleEditCategories={() => setEditCategoriesModal(true)} />
      <Box
        component="main"
        sx={{ flexGrow: 1, p: 3, width: '100%', height: '100%' }}
      >
        {children}
      </Box>
      {editCategoriesModal && (
        <EditCategoriesDialog
          handleClose={() => setEditCategoriesModal(false)}
        />
      )}
    </Box>
  );
}
