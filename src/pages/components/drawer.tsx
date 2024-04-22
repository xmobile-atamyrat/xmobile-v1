import * as React from 'react';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import { IconButton, Paper, Tooltip } from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';

const drawerWidth = 300;

interface CustomDrawerProps {
  handleEditCategories: () => void;
}

export default function CustomDrawer({
  handleEditCategories,
}: CustomDrawerProps) {
  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box' },
        position: 'relative',
      }}
    >
      <Box sx={{ overflow: 'auto' }}></Box>
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
