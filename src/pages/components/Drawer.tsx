import * as React from 'react';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import { IconButton, List, Paper, Tooltip } from '@mui/material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { appBarHeight } from '@/pages/lib/constants';
import {
  DeleteCategoriesProps,
  EditCategoriesProps,
  ExtendedCategory,
} from '@/pages/lib/types';
import Collapsable from '@/pages/components/Collapsable';
import { Dispatch, SetStateAction } from 'react';
import { useUserContext } from '@/pages/lib/UserContext';

const drawerWidth = 300;

interface CustomDrawerProps {
  setEditCategoriesModal: Dispatch<SetStateAction<EditCategoriesProps>>;
  setDeleteCategoriesModal: Dispatch<SetStateAction<DeleteCategoriesProps>>;
  openDrawer: boolean;
}

function ConstructDrawerList(
  categories: ExtendedCategory[],
  selectedCategoryId: string | undefined,
  setSelectedCategoryId: Dispatch<SetStateAction<string | undefined>>,
  setEditCategoriesModal: Dispatch<SetStateAction<EditCategoriesProps>>,
  setDeleteCategoriesModal: Dispatch<SetStateAction<DeleteCategoriesProps>>,
  depth: number,
): React.ReactNode {
  return (
    <List component="div" disablePadding className="flex flex-col">
      {categories.map(({ id, imgUrl, name, successorCategories }) => (
        <Collapsable
          id={id}
          categoryTitle={name}
          imgUrl={imgUrl}
          key={name}
          pl={depth}
          initialOpenState={id === selectedCategoryId}
          collapsable={
            successorCategories != null && successorCategories.length > 0
          }
          setEditCategoriesModal={setEditCategoriesModal}
          setDeleteCategoriesModal={setDeleteCategoriesModal}
        >
          {ConstructDrawerList(
            successorCategories!,
            selectedCategoryId,
            setSelectedCategoryId,
            setEditCategoriesModal,
            setDeleteCategoriesModal,
            depth + 1,
          )}
        </Collapsable>
      ))}
    </List>
  );
}

export default function CustomDrawer({
  setEditCategoriesModal,
  setDeleteCategoriesModal,
  openDrawer,
}: CustomDrawerProps) {
  const { categories, selectedCategoryId, setSelectedCategoryId } =
    useCategoryContext();
  const { user } = useUserContext();

  return (
    <Drawer
      variant={openDrawer ? 'permanent' : 'temporary'}
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
            setDeleteCategoriesModal,
            0, // depth
          )}
        </Box>
      )}
      {user?.grade === 'ADMIN' && (
        <Paper className="h-12 w-full absolute bottom-0 bg-slate-100 flex justify-center">
          <Tooltip title="Edit categories">
            <IconButton
              onClick={() => {
                setSelectedCategoryId(undefined);
                setEditCategoriesModal({ open: true, dialogType: 'add' });
              }}
            >
              <AddCircleIcon fontSize="large" color="primary" />
            </IconButton>
          </Tooltip>
        </Paper>
      )}
    </Drawer>
  );
}
