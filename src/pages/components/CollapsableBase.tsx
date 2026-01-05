import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { DeleteCategoriesProps, EditCategoriesProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { parseName } from '@/pages/lib/utils';
import { collapsableClasses } from '@/styles/classMaps/components/collapsable';
import { interClassname } from '@/styles/theme';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import {
  Box,
  IconButton,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { Dispatch, SetStateAction, useState } from 'react';

interface CollapsableBaseProps {
  categoryTitle: string;
  id: string;
  setEditCategoriesModal: Dispatch<SetStateAction<EditCategoriesProps>>;
  setDeleteCategoriesModal: Dispatch<SetStateAction<DeleteCategoriesProps>>;
  closeDrawer: () => void;
  isActiveParent?: boolean;
  hasSubcategories?: boolean;
}

export default function CollapsableBase({
  categoryTitle,
  id,
  setEditCategoriesModal,
  setDeleteCategoriesModal,
  closeDrawer,
  isActiveParent,
  hasSubcategories,
}: CollapsableBaseProps) {
  const { selectedCategoryId, setSelectedCategoryId } = useCategoryContext();
  const { user } = useUserContext();
  const [anchorEl, setAnchorEl] = useState<HTMLElement>();
  const router = useRouter();
  const openEditMenu = Boolean(anchorEl);
  const t = useTranslations();

  return (
    <Box
      className={`
        ${
          selectedCategoryId === id || isActiveParent
            ? 'bg-[#f4f4f4] h-[48px]'
            : ''
        }
        ${collapsableClasses.baseBox}`}
    >
      <ListItemButton
        onClick={() => {
          setSelectedCategoryId(id);
          closeDrawer();
          router.push(`/product?categoryId=${id}`);
        }}
      >
        <ListItemText
          primary={parseName(categoryTitle, router.locale ?? 'tk')}
          className={`${interClassname.className} font-regular text-[16px] leading-[24px] tracking-normal text-[#303030]`}
        />
        {hasSubcategories && (
          <KeyboardArrowRightIcon className="text-[#30303080] text-[20px]" />
        )}
      </ListItemButton>
      {['SUPERUSER', 'ADMIN'].includes(user?.grade) &&
        selectedCategoryId === id && (
          <Box>
            <IconButton
              aria-label="more"
              id="long-button"
              aria-controls={openEditMenu ? 'long-menu' : undefined}
              aria-expanded={openEditMenu ? 'true' : undefined}
              aria-haspopup="true"
              onClick={(event) => setAnchorEl(event.currentTarget)}
              className="px-0"
            >
              <MoreVertIcon color="primary" fontSize="small" />
            </IconButton>
            <Menu
              open={openEditMenu}
              onClose={() => setAnchorEl(undefined)}
              anchorEl={anchorEl}
            >
              <MenuItem
                onClick={() =>
                  setEditCategoriesModal({
                    open: true,
                    dialogType: 'add',
                    categoryId: id,
                  })
                }
                className={collapsableClasses.menuItem}
              >
                <AddCircleIcon color="primary" fontSize="small" />
                <Typography className="overflow-x-scroll">
                  {t('add')}
                </Typography>
              </MenuItem>
              <MenuItem
                onClick={() =>
                  setEditCategoriesModal({
                    open: true,
                    dialogType: 'edit',
                    categoryId: id,
                    categoryName: categoryTitle,
                  })
                }
                className={collapsableClasses.menuItem}
              >
                <EditIcon color="primary" fontSize="small" />
                <Typography className="overflow-x-scroll">
                  {t('edit')}
                </Typography>
              </MenuItem>
              <MenuItem
                onClick={() =>
                  setDeleteCategoriesModal({
                    categoryId: id,
                    open: true,
                  })
                }
                className={collapsableClasses.menuItem}
              >
                <DeleteIcon color="error" fontSize="small" />
                <Typography className="overflow-x-scroll">
                  {t('delete')}
                </Typography>
              </MenuItem>
            </Menu>
          </Box>
        )}
    </Box>
  );
}
