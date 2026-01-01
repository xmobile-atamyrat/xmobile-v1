import Collapsable from '@/pages/components/Collapsable';
import {
  DeleteCategoriesProps,
  EditCategoriesProps,
  ExtendedCategory,
} from '@/pages/lib/types';
import { drawerClasses } from '@/styles/classMaps/components/drawer';
import { Box, List } from '@mui/material';
import * as React from 'react';
import { Dispatch, SetStateAction } from 'react';

export default function categoryList(
  categories: ExtendedCategory[],
  selectedCategoryId: string | undefined,
  setSelectedCategoryId: Dispatch<SetStateAction<string | undefined>>,
  setEditCategoriesModal: Dispatch<SetStateAction<EditCategoriesProps>>,
  setDeleteCategoriesModal: Dispatch<SetStateAction<DeleteCategoriesProps>>,
  depth: number,
  closeDrawer: () => void,
): React.ReactNode {
  return (
    <Box>
      {categories.length > 0 && (
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
                {categoryList(
                  successorCategories! || [],
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
      )}
    </Box>
  );
}
