import Collapsable from '@/pages/components/Collapsable';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import {
  DeleteCategoriesProps,
  EditCategoriesProps,
  ExtendedCategory,
} from '@/pages/lib/types';
import { drawerClasses } from '@/styles/classMaps/components/drawer';
import { Box, List } from '@mui/material';
import { Dispatch, SetStateAction, useEffect, useState } from 'react';

const isSelected = (
  category: ExtendedCategory,
  targetId: string | undefined | null,
): boolean => {
  if (!targetId) return false;

  if (category.successorCategories.some((sub) => sub.id === targetId)) {
    return true;
  }

  return category.successorCategories.some((sub) => isSelected(sub, targetId));
};

export default function CategoryList({
  categories,
  setEditCategoriesModal,
  setDeleteCategoriesModal,
  closeDrawer,
  isDrawerOpen,
}: {
  categories: ExtendedCategory[];
  setEditCategoriesModal: Dispatch<SetStateAction<EditCategoriesProps>>;
  setDeleteCategoriesModal: Dispatch<SetStateAction<DeleteCategoriesProps>>;
  closeDrawer?: () => void;
  isDrawerOpen?: boolean;
}) {
  const [hoveredCategoryId, setHoveredCategoryId] = useState<string | null>(
    null,
  );
  const { selectedCategoryId } = useCategoryContext();

  useEffect(() => {
    if (!isDrawerOpen) {
      setHoveredCategoryId(null);
    }
  }, [isDrawerOpen]);

  return (
    <Box>
      {categories.length > 0 && (
        <List component="div" disablePadding className={drawerClasses.list}>
          {categories.map((category) => {
            const { id, name } = category;
            const hasSubcategories = category.successorCategories.length > 0;
            const isActiveParent = isSelected(category, selectedCategoryId);

            return (
              <Collapsable
                id={id}
                categoryTitle={name}
                key={name}
                collapsable={hasSubcategories}
                setEditCategoriesModal={setEditCategoriesModal}
                setDeleteCategoriesModal={setDeleteCategoriesModal}
                closeDrawer={closeDrawer}
                isOpen={hoveredCategoryId === id}
                onHover={setHoveredCategoryId}
                isActiveParent={isActiveParent}
                hasSubcategories={hasSubcategories}
              >
                {hasSubcategories && (
                  <CategoryList
                    categories={category.successorCategories}
                    setEditCategoriesModal={setEditCategoriesModal}
                    setDeleteCategoriesModal={setDeleteCategoriesModal}
                    closeDrawer={closeDrawer}
                    isDrawerOpen={isDrawerOpen}
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
