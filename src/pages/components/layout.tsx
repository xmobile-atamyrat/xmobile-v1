import { Box } from '@mui/material';
import { ReactNode, useState } from 'react';
import CustomAppBar from '@/pages/components/Appbar';
import CustomDrawer from '@/pages/components/Drawer';

export default function Layout({ children }: { children: ReactNode }) {
  const [editCategoriesModal, setEditCategoriesModal] = useState(false);
  return (
    <Box sx={{ display: 'flex' }}>
      <CustomAppBar />
      <CustomDrawer handleEditCategories={() => setEditCategoriesModal(true)} />
      <Box
        component="main"
        sx={{ flexGrow: 1, p: 3, width: '100%', height: '100%', mt: '64px' }}
      >
        {children}
      </Box>
      {editCategoriesModal && <div></div>}
    </Box>
  );
}
