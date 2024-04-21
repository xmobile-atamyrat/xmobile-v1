import { Box } from '@mui/material';
import { ReactNode } from 'react';
import CustomAppBar from './appbar';
import CustomDrawer from './drawer';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex' }}>
      {/* <CssBaseline /> */}
      <CustomAppBar />
      <CustomDrawer />
      <Box
        component="main"
        sx={{ flexGrow: 1, p: 3, width: '100%', height: '100%', mt: '64px' }}
      >
        {children}
      </Box>
    </Box>
  );
}
