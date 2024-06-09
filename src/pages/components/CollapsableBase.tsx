import BASE_URL from '@/lib/ApiEndpoints';
import {
  Box,
  IconButton,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import { EditCategoriesProps, DeleteCategoriesProps } from '@/pages/lib/types';
import { Dispatch, SetStateAction, useState } from 'react';
import DeleteIcon from '@mui/icons-material/Delete';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import { useUserContext } from '@/pages/lib/UserContext';
import { useRouter } from 'next/router';
import { parseName } from '@/pages/lib/utils';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { useTranslations } from 'next-intl';

interface CollapsableBaseProps {
  imgUrl: string | null;
  categoryTitle: string;
  id: string;
  setEditCategoriesModal: Dispatch<SetStateAction<EditCategoriesProps>>;
  setDeleteCategoriesModal: Dispatch<SetStateAction<DeleteCategoriesProps>>;
}

export default function CollapsableBase({
  imgUrl,
  categoryTitle,
  id,
  setEditCategoriesModal,
  setDeleteCategoriesModal,
}: CollapsableBaseProps) {
  const { selectedCategoryId, setSelectedCategoryId } = useCategoryContext();
  const { user } = useUserContext();
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState<HTMLElement>();
  const openEditMenu = Boolean(anchorEl);
  const t = useTranslations();

  return (
    <Box
      className={`w-full flex flex-row items-center ${selectedCategoryId === id && 'bg-slate-200'}`}
    >
      <ListItemButton
        onClick={() => setSelectedCategoryId(id)}
        className="py-2 pr-2"
      >
        {imgUrl != null && (
          <ListItemIcon>
            <img
              src={imgUrl}
              style={{ width: '30px', height: '30px' }}
              alt={categoryTitle}
              onError={async (error) => {
                error.currentTarget.onerror = null;
                error.currentTarget.src = URL.createObjectURL(
                  await (
                    await fetch(`${BASE_URL}/api/localImage?imgUrl=${imgUrl}`)
                  ).blob(),
                );
              }}
            />
          </ListItemIcon>
        )}
        <ListItemText
          primary={parseName(categoryTitle, router.locale ?? 'tk')}
          style={{
            overflow: 'auto',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}
          sx={{ pr: 0 }}
        />
      </ListItemButton>
      {user?.grade === 'ADMIN' && selectedCategoryId === id && (
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
              className="flex flex-row justify-start gap-2 items-center px-2 w-[120px]"
            >
              <AddCircleIcon color="primary" fontSize="small" />
              <Typography className="overflow-x-scroll">{t('add')}</Typography>
            </MenuItem>
            <MenuItem
              onClick={() =>
                setEditCategoriesModal({
                  open: true,
                  dialogType: 'edit',
                  categoryId: id,
                  categoryName: categoryTitle,
                  imageUrl: imgUrl,
                })
              }
              className="flex flex-row justify-start gap-2 items-center px-2 w-[120px]"
            >
              <EditIcon color="primary" fontSize="small" />
              <Typography className="overflow-x-scroll">{t('edit')}</Typography>
            </MenuItem>
            <MenuItem
              onClick={() =>
                setDeleteCategoriesModal({ categoryId: id, imgUrl, open: true })
              }
              className="flex flex-row justify-start gap-2 items-center px-2 w-[120px]"
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
