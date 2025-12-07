import Collapsable from '@/pages/components/Collapsable';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import {
  HIGHEST_LEVEL_CATEGORY_ID,
  MAIN_BG_COLOR,
} from '@/pages/lib/constants';
import { usePlatform } from '@/pages/lib/PlatformContext';
import {
  DeleteCategoriesProps,
  EditCategoriesProps,
  ExtendedCategory,
} from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { drawerClasses } from '@/styles/classMaps/components/drawer';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import { Box, IconButton, List, Paper, Popover, Tooltip } from '@mui/material';
import * as React from 'react';
import { Dispatch, SetStateAction } from 'react';

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
            collapsable={false}
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
  const platform = usePlatform();

  return (
    // <Drawer
    //   variant="temporary"
    //   open={openDrawer}
    //   sx={{
    //     height: '100%',
    //     width: drawerWidth,
    //     [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box' },
    //   }}
    //   onClose={closeDrawer}
    // >
    //   {categories?.length > 0 && (
    //     <Box className={`${drawerClasses.box}  bg-[${MAIN_BG_COLOR}]`}>
    //       {ConstructDrawerList(
    //         categories,
    //         selectedCategoryId,
    //         setSelectedCategoryId,
    //         setEditCategoriesModal,
    //         setDeleteCategoriesModal,
    //         0, // depth
    //         closeDrawer,
    //         [],
    //       )}
    //     </Box>
    //   )}
    //   {['SUPERUSER', 'ADMIN'].includes(user?.grade) && (
    //     <Paper className={drawerClasses.paper}>
    //       <Tooltip title="Edit categories">
    //         <IconButton
    //           onClick={() => {
    //             setSelectedCategoryId(HIGHEST_LEVEL_CATEGORY_ID);
    //             setEditCategoriesModal({ open: true, dialogType: 'add' });
    //           }}
    //         >
    //           <AddCircleIcon
    //             className={drawerClasses.addCircleIcon[platform]}
    //             color="primary"
    //           />
    //         </IconButton>
    //       </Tooltip>
    //     </Paper>
    //   )}
    // </Drawer>

    <Popover
      open={openDrawer}
      onClose={closeDrawer}
      className="mt-[150px] ml-[180px]"
    >
      {categories?.length > 0 && (
        <Box
          className={`${drawerClasses.box[platform]}  bg-[${MAIN_BG_COLOR}]`}
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
                className={drawerClasses.addCircleIcon[platform]}
                color="primary"
              />
            </IconButton>
          </Tooltip>
        </Paper>
      )}
    </Popover>
  );
}
