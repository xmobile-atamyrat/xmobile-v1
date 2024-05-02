import * as React from 'react';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import { IconButton, List, Paper, Tooltip } from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { appBarHeight } from '@/pages/lib/constants';
import { EditCategoriesProps, ExtendedCategory } from '@/pages/lib/types';
import Collapsable from '@/pages/components/Collapsable';
import { Dispatch, SetStateAction } from 'react';

const drawerWidth = 300;

interface CustomDrawerProps {
  setEditCategoriesModal: Dispatch<SetStateAction<EditCategoriesProps>>;
}

function ConstructDrawerList(
  categories: ExtendedCategory[],
  selectedCategoryId: string | undefined,
  setSelectedCategoryId: Dispatch<SetStateAction<string | undefined>>,
  setEditCategoriesModal: Dispatch<SetStateAction<EditCategoriesProps>>,
): React.ReactNode {
  return (
    <List component="div" disablePadding className="flex flex-col gap-2">
      {categories.map(
        ({ id, imgUrl, name, successorCategories, predecessorId }) => (
          <Collapsable
            id={id}
            categoryTitle={name}
            imgUrl={imgUrl}
            key={name}
            pl={predecessorId == null ? 2 : 4}
            initialOpenState={id === selectedCategoryId}
            collapsable={
              successorCategories != null && successorCategories.length > 0
            }
            setEditCategoriesModal={setEditCategoriesModal}
          >
            {ConstructDrawerList(
              successorCategories!,
              selectedCategoryId,
              setSelectedCategoryId,
              setEditCategoriesModal,
            )}
          </Collapsable>
        ),
      )}
    </List>
  );
}

export default function CustomDrawer({
  setEditCategoriesModal,
}: CustomDrawerProps) {
  const { categories, selectedCategoryId, setSelectedCategoryId } =
    useCategoryContext();

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
          {ConstructDrawerList(
            categories,
            selectedCategoryId,
            setSelectedCategoryId,
            setEditCategoriesModal,
          )}
        </Box>
      )}
      <Paper className="h-12 w-full absolute bottom-0 bg-slate-100 flex justify-center">
        <Tooltip title="Edit categories">
          <IconButton
            onClick={() =>
              setEditCategoriesModal({ open: true, whoOpened: 'parent' })
            }
          >
            <AddCircleIcon fontSize="large" color="primary" />
          </IconButton>
        </Tooltip>
      </Paper>
    </Drawer>
  );
}
