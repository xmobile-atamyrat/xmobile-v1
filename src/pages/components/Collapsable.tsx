import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { ExpandLess, ExpandMore } from '@mui/icons-material';
import { Collapse, Box, IconButton } from '@mui/material';
import { Dispatch, ReactNode, SetStateAction, useState } from 'react';
import { DeleteCategoriesProps, EditCategoriesProps } from '@/pages/lib/types';
import CollapsableBase from '@/pages/components/CollapsableBase';

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
}: CollapsableProps) {
  const [open, setOpen] = useState(initialOpenState);
  const { selectedCategoryId } = useCategoryContext();
  return collapsable ? (
    <Box className="h-[48px] w-full">
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
      />
    </Box>
  );
}
