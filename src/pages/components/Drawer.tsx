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

export default function CategoryList({
  categories,
  setEditCategoriesModal,
  setDeleteCategoriesModal,
  closeDrawer,
}: {
  categories: ExtendedCategory[];
  setEditCategoriesModal: Dispatch<SetStateAction<EditCategoriesProps>>;
  setDeleteCategoriesModal: Dispatch<SetStateAction<DeleteCategoriesProps>>;
  closeDrawer?: () => void;
}) {
  const [hoveredCategoryId, setHoveredCategoryId] = React.useState<
    string | null
  >(null);

  return (
    <Box>
      {categories.length > 0 && (
        <List component="div" disablePadding className={drawerClasses.list}>
          {categories.map((category) => {
            const { id, name } = category;
            return (
              <Collapsable
                id={id}
                categoryTitle={name}
                key={name}
                collapsable={category.successorCategories.length > 0}
                setEditCategoriesModal={setEditCategoriesModal}
                setDeleteCategoriesModal={setDeleteCategoriesModal}
                closeDrawer={closeDrawer}
                isOpen={hoveredCategoryId === id}
                onHover={setHoveredCategoryId}
              >
                {category.successorCategories.length > 0 && (
                  <CategoryList
                    categories={category.successorCategories}
                    setEditCategoriesModal={setEditCategoriesModal}
                    setDeleteCategoriesModal={setDeleteCategoriesModal}
                    closeDrawer={closeDrawer}
                  />
                )}
              </Collapsable>
            );
          })}
        </List>
      )}
    </Box>
  );
}
