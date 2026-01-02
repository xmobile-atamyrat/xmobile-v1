import CollapsableBase from '@/pages/components/CollapsableBase';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { DeleteCategoriesProps, EditCategoriesProps } from '@/pages/lib/types';
import { collapsableClasses } from '@/styles/classMaps/components/collapsable';
import { Box, Menu } from '@mui/material';
import { Dispatch, SetStateAction, useRef, useState } from 'react';

interface CollapsableProps {
  children: React.ReactNode;
  categoryTitle: string;
  id: string;
  collapsable: boolean;
  setEditCategoriesModal: Dispatch<SetStateAction<EditCategoriesProps>>;
  setDeleteCategoriesModal: Dispatch<SetStateAction<DeleteCategoriesProps>>;
  closeDrawer: () => void;
}

export default function Collapsable({
  children,
  categoryTitle,
  id,
  collapsable,
  setEditCategoriesModal,
  setDeleteCategoriesModal,
  closeDrawer,
}: CollapsableProps) {
  const { selectedCategoryId } = useCategoryContext();
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<any>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setAnchorEl(event.currentTarget);
    setOpen(true);
  };

  const handleMenuClose = () => {
    timeoutRef.current = setTimeout(() => {
      setOpen(false);
      setAnchorEl(null);
    }, 200);
  };

  const handleMenuEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  const handleForceClose = () => {
    setOpen(false);
    setAnchorEl(null);
  };

  return collapsable ? (
    <Box className="w-full">
      <Box
        className={`
          ${selectedCategoryId === id ? 'bg-slate-200' : ''}
          ${collapsableClasses.box}`}
        onMouseEnter={handleMenuOpen}
        onMouseLeave={handleMenuClose}
      >
        <CollapsableBase
          categoryTitle={categoryTitle}
          id={id}
          setDeleteCategoriesModal={setDeleteCategoriesModal}
          setEditCategoriesModal={setEditCategoriesModal}
          closeDrawer={closeDrawer}
        />
        <Menu
          open={open}
          anchorEl={anchorEl}
          anchorOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'left',
          }}
          disableRestoreFocus
          hideBackdrop
          disableScrollLock
          sx={{
            pointerEvents: 'none',
            '& .MuiPaper-root': {
              pointerEvents: 'auto',
            },
          }}
          MenuListProps={{
            onMouseEnter: handleMenuEnter,
            onMouseLeave: handleMenuClose,
          }}
          onClose={handleForceClose}
        >
          {children}
        </Menu>
      </Box>
    </Box>
  ) : (
    <Box>
      <CollapsableBase
        categoryTitle={categoryTitle}
        id={id}
        setDeleteCategoriesModal={setDeleteCategoriesModal}
        setEditCategoriesModal={setEditCategoriesModal}
        closeDrawer={closeDrawer}
      />
    </Box>
  );
}
