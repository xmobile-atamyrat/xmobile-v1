import Collapsable from '@/pages/components/Collapsable';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import {
  appBarHeight,
  drawerPaddingTopOffset,
  HIGHEST_LEVEL_CATEGORY_ID,
  MAIN_BG_COLOR,
  mobileAppBarHeight,
} from '@/pages/lib/constants';
import {
  DeleteCategoriesProps,
  EditCategoriesProps,
  ExtendedCategory,
} from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import {
  IconButton,
  List,
  Paper,
  Tooltip,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import * as React from 'react';
import { Dispatch, SetStateAction } from 'react';

const drawerWidth = 300;

interface CustomDrawerProps {
  setEditCategoriesModal: Dispatch<SetStateAction<EditCategoriesProps>>;
  setDeleteCategoriesModal: Dispatch<SetStateAction<DeleteCategoriesProps>>;
  openDrawer: boolean;
  closeDrawer: () => void;
}

function ConstructDrawerList(
  categories: ExtendedCategory[],
  selectedCategoryId: string | undefined,
  setSelectedCategoryId: Dispatch<SetStateAction<string | undefined>>,
  setEditCategoriesModal: Dispatch<SetStateAction<EditCategoriesProps>>,
  setDeleteCategoriesModal: Dispatch<SetStateAction<DeleteCategoriesProps>>,
  depth: number,
  closeDrawer: () => void,
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
          initialOpenState={true} // {id === selectedCategoryId}
          collapsable={
            successorCategories != null && successorCategories.length > 0
          }
          setEditCategoriesModal={setEditCategoriesModal}
          setDeleteCategoriesModal={setDeleteCategoriesModal}
          closeDrawer={closeDrawer}
        >
          {ConstructDrawerList(
            successorCategories!,
            selectedCategoryId,
            setSelectedCategoryId,
            setEditCategoriesModal,
            setDeleteCategoriesModal,
            depth + 1,
            closeDrawer,
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
  closeDrawer,
}: CustomDrawerProps) {
  const { categories, selectedCategoryId, setSelectedCategoryId } =
    useCategoryContext();
  const { user } = useUserContext();
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));

  return (
    <Drawer
      variant="temporary"
      open={openDrawer}
      sx={{
        width: drawerWidth,
        height: '100%',
        [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box' },
      }}
      onClose={closeDrawer}
    >
      {categories?.length > 0 && (
        <Box
          sx={{
            overflow: 'auto',
            pt: {
              xs: `${mobileAppBarHeight + drawerPaddingTopOffset}px`,
              sm: `${appBarHeight + drawerPaddingTopOffset}px`,
            },
            height: '100vh',
          }}
          className={`bg-[${MAIN_BG_COLOR}]`}
        >
          {ConstructDrawerList(
            categories,
            selectedCategoryId,
            setSelectedCategoryId,
            setEditCategoriesModal,
            setDeleteCategoriesModal,
            0, // depth
            closeDrawer,
          )}
        </Box>
      )}
      {user?.grade === 'ADMIN' && (
        <Paper className="h-12 w-full absolute bottom-0 bg-slate-100 flex justify-center">
          <Tooltip title="Edit categories">
            <IconButton
              onClick={() => {
                setSelectedCategoryId(HIGHEST_LEVEL_CATEGORY_ID);
                setEditCategoriesModal({ open: true, dialogType: 'add' });
              }}
            >
              <AddCircleIcon
                fontSize={isMdUp ? 'large' : 'small'}
                color="primary"
              />
            </IconButton>
          </Tooltip>
        </Paper>
      )}
    </Drawer>
  );
}
