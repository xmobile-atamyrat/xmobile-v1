import * as React from 'react';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import {
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Tooltip,
} from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { appBarHeight } from '@/pages/lib/constants';
import { ExtendedCategory } from '@/pages/lib/types';
import Collapsable from '@/pages/components/Collapsable';
import { Dispatch, SetStateAction } from 'react';

const drawerWidth = 300;

interface CustomDrawerProps {
  handleEditCategories: () => void;
}

function ConstructDrawerList(
  categories: ExtendedCategory[],
  setSelectedCategoryId: Dispatch<SetStateAction<string | undefined>>,
): React.ReactNode {
  return (
    <List component="div" disablePadding className="flex flex-col gap-2">
      {categories.map(
        ({ id, imgUrl, name, successorCategories, predecessorId }) =>
          successorCategories != null && successorCategories.length > 0 ? (
            <Collapsable
              id={id}
              categoryTitle={name}
              imgUrl={imgUrl}
              key={name}
              pl={predecessorId == null ? 2 : 4}
            >
              {ConstructDrawerList(successorCategories, setSelectedCategoryId)}
            </Collapsable>
          ) : (
            <ListItemButton
              sx={{
                // py: 0,
                pl: 4,
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
              }}
              key={name}
              onClick={() => setSelectedCategoryId(id)}
            >
              {imgUrl != null && (
                <ListItemIcon>
                  <img src={imgUrl} width={24} height={24} alt={name} />
                </ListItemIcon>
              )}
              <ListItemText primary={name} />
            </ListItemButton>
          ),
      )}
    </List>
  );
}

export default function CustomDrawer({
  handleEditCategories,
}: CustomDrawerProps) {
  const { categories, setSelectedCategoryId } = useCategoryContext();

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box' },
      }}
    >
      {categories?.length > 0 && (
        <Box sx={{ overflow: 'auto', pt: `${appBarHeight * 1.5}px` }}>
          {ConstructDrawerList(categories, setSelectedCategoryId)}
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
