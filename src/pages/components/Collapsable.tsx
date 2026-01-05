import CollapsableBase from '@/pages/components/CollapsableBase';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { DeleteCategoriesProps, EditCategoriesProps } from '@/pages/lib/types';
import { collapsableClasses } from '@/styles/classMaps/components/collapsable';
import { Box, Menu } from '@mui/material';
import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';

interface CollapsableProps {
  children: React.ReactNode;
  categoryTitle: string;
  id: string;
  collapsable: boolean;
  setEditCategoriesModal: Dispatch<SetStateAction<EditCategoriesProps>>;
  setDeleteCategoriesModal: Dispatch<SetStateAction<DeleteCategoriesProps>>;
  closeDrawer: () => void;
  isOpen?: boolean;
  onHover?: (id: string | null) => void;
  isActiveParent?: boolean;
  hasSubcategories?: boolean;
}

export default function Collapsable({
  children,
  categoryTitle,
  id,
  collapsable,
  setEditCategoriesModal,
  setDeleteCategoriesModal,
  closeDrawer,
  isOpen,
  onHover,
  isActiveParent,
  hasSubcategories,
}: CollapsableProps) {
  const { selectedCategoryId } = useCategoryContext();
  const open = isOpen ?? false;
  const timeoutRef = useRef<any>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setAnchorEl(event.currentTarget);
    if (onHover) {
      onHover(id);
    }
  };

  const handleMenuClose = () => {
    timeoutRef.current = setTimeout(() => {
      setAnchorEl(null);
      if (onHover) {
        if (isOpen) {
          onHover(null);
        }
      }
    }, 200);
  };

  // Effect to clean up timeout if we suddenly close (e.g. sibling hovered)
  useEffect(() => {
    if (!open && timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, [open]);

  const handleMenuEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  const handleForceClose = () => {
    setAnchorEl(null);
    if (onHover) onHover(null);
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
          isActiveParent={isActiveParent}
          hasSubcategories={hasSubcategories}
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
          TransitionProps={{ exit: false }}
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
        isActiveParent={isActiveParent}
        hasSubcategories={hasSubcategories}
      />
    </Box>
  );
}
