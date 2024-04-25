import * as React from 'react';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import { IconButton, Paper, Tooltip } from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { appBarHeight } from '@/pages/lib/constants';
import { useEffect } from 'react';

const drawerWidth = 300;

interface CustomDrawerProps {
  handleEditCategories: () => void;
}

// function ConstructDrawerList(categories: ExtendedCategory[]): ReactNode {
//   return (
//     <
//   )
// }

export default function CustomDrawer({
  handleEditCategories,
}: CustomDrawerProps) {
  const { categories } = useCategoryContext();

  useEffect(() => {
    console.log(categories);
  }, [categories]);

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box' },
      }}
    >
      {categories?.length > 0 && (
        <Box sx={{ overflow: 'auto', pt: `${appBarHeight * 1.5}px`, px: 2 }}>
          {categories[0].name}
        </Box>
      )}
      <Paper className="h-12 w-full absolute bottom-0 bg-slate-100 flex justify-center">
        <Tooltip title="Edit categories">
          <IconButton onClick={handleEditCategories}>
            <AddCircleIcon fontSize="large" color="primary" />
          </IconButton>
        </Tooltip>
      </Paper>
    </Drawer>
  );
}
