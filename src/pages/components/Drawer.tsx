import Collapsable from '@/pages/components/Collapsable';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import {
  HIGHEST_LEVEL_CATEGORY_ID,
  MAIN_BG_COLOR,
} from '@/pages/lib/constants';
import { usePlatform } from '@/pages/lib/PlatformContext';
import {
  CategoryStack,
  DeleteCategoriesProps,
  EditCategoriesProps,
  ExtendedCategory,
} from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { drawerClasses } from '@/styles/classMaps/drawer';
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
  categoryStackList: CategoryStack,
): React.ReactNode {
  return (
    <List component="div" disablePadding className={drawerClasses.list}>
      {categories.map((category) => {
        const { id, name, imgUrl, successorCategories } = category;
        return (
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
            categoryStackList={categoryStackList}
            parentCategory={category}
          >
            {ConstructDrawerList(
              successorCategories!,
              selectedCategoryId,
              setSelectedCategoryId,
              setEditCategoriesModal,
              setDeleteCategoriesModal,
              depth + 1,
              closeDrawer,
              [...categoryStackList, [category, name]],
            )}
          </Collapsable>
        );
      })}
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
  const platform = usePlatform();

  return (
    <Drawer
      variant="temporary"
      open={openDrawer}
      sx={{
        height: '100%',
        width: drawerWidth,
        [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box' },
      }}
      onClose={closeDrawer}
    >
      {categories?.length > 0 && (
        <Box className={drawerClasses.box[platform] && `bg-[${MAIN_BG_COLOR}]`}>
          {ConstructDrawerList(
            categories,
            selectedCategoryId,
            setSelectedCategoryId,
            setEditCategoriesModal,
            setDeleteCategoriesModal,
            0, // depth
            closeDrawer,
            [],
          )}
        </Box>
      )}
      {['SUPERUSER', 'ADMIN'].includes(user?.grade) && (
        <Paper className={drawerClasses.paper}>
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
