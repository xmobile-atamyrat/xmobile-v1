import CollapsableBase from '@/pages/components/CollapsableBase';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import {
  CategoryStack,
  DeleteCategoriesProps,
  EditCategoriesProps,
  ExtendedCategory,
} from '@/pages/lib/types';
import { ExpandLess, ExpandMore } from '@mui/icons-material';
import { Box, Collapse, IconButton } from '@mui/material';
import { Dispatch, ReactNode, SetStateAction, useState } from 'react';

interface CollapsableProps {
  imgUrl: string | null;
  children: ReactNode;
  categoryTitle: string;
  pl: number;
  id: string;
  initialOpenState: boolean;
  collapsable: boolean;
  setEditCategoriesModal: Dispatch<SetStateAction<EditCategoriesProps>>;
  setDeleteCategoriesModal: Dispatch<SetStateAction<DeleteCategoriesProps>>;
  closeDrawer: () => void;
  categoryStackList: CategoryStack;
  parentCategory?: ExtendedCategory;
}

export default function Collapsable({
  categoryTitle,
  children,
  imgUrl,
  pl,
  id,
  initialOpenState,
  collapsable,
  setEditCategoriesModal,
  setDeleteCategoriesModal,
  closeDrawer,
  categoryStackList,
  parentCategory,
}: CollapsableProps) {
  const [open, setOpen] = useState(initialOpenState);
  const { selectedCategoryId } = useCategoryContext();
  return collapsable ? (
    <Box className="w-full">
      <Box
        sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}
        className={`h-full w-full ${selectedCategoryId === id && 'bg-slate-200'}`}
        style={{ paddingLeft: `${pl * 2}rem` }}
      >
        <Box className="w-[90%]">
          <CollapsableBase
            categoryTitle={categoryTitle}
            id={id}
            imgUrl={imgUrl}
            setDeleteCategoriesModal={setDeleteCategoriesModal}
            setEditCategoriesModal={setEditCategoriesModal}
            closeDrawer={closeDrawer}
            categoryStackList={categoryStackList}
            parentCategory={parentCategory}
          />
        </Box>
        <IconButton className="h-full px-0" onClick={() => setOpen(!open)}>
          {open ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
      </Box>
      <Collapse in={open} timeout="auto" unmountOnExit>
        {children}
      </Collapse>
    </Box>
  ) : (
    <Box style={{ paddingLeft: `${pl * 2}rem` }}>
      <CollapsableBase
        categoryTitle={categoryTitle}
        id={id}
        imgUrl={imgUrl}
        setDeleteCategoriesModal={setDeleteCategoriesModal}
        setEditCategoriesModal={setEditCategoriesModal}
        closeDrawer={closeDrawer}
        categoryStackList={categoryStackList}
        parentCategory={parentCategory}
      />
    </Box>
  );
}
