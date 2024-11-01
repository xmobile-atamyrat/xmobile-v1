import BASE_URL from '@/lib/ApiEndpoints';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { DeleteCategoriesProps, EditCategoriesProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { blobToBase64, parseName } from '@/pages/lib/utils';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import MoreVertIcon from '@mui/icons-material/MoreVert';
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
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { Dispatch, SetStateAction, useEffect, useState } from 'react';

interface CollapsableBaseProps {
  imgUrl: string | null;
  categoryTitle: string;
  id: string;
  setEditCategoriesModal: Dispatch<SetStateAction<EditCategoriesProps>>;
  setDeleteCategoriesModal: Dispatch<SetStateAction<DeleteCategoriesProps>>;
  closeDrawer: () => void;
}

export default function CollapsableBase({
  imgUrl: categoryImgUrl,
  categoryTitle,
  id,
  setEditCategoriesModal,
  setDeleteCategoriesModal,
  closeDrawer,
}: CollapsableBaseProps) {
  const { selectedCategoryId, setSelectedCategoryId } = useCategoryContext();
  const { user } = useUserContext();
  const [anchorEl, setAnchorEl] = useState<HTMLElement>();
  const router = useRouter();
  const openEditMenu = Boolean(anchorEl);
  const [imgUrl, setImgUrl] = useState<string | null>();
  const t = useTranslations();

  useEffect(() => {
    if (categoryImgUrl != null && id != null) {
      const cacheImgUrl = sessionStorage.getItem(id);
      if (cacheImgUrl != null) {
        setImgUrl(cacheImgUrl);
      } else {
        setImgUrl('/xmobile-original-logo.jpeg');
        (async () => {
          if (categoryImgUrl.startsWith('http')) {
            setImgUrl(categoryImgUrl);
          } else {
            const imgFetcher = fetch(
              `${BASE_URL}/api/localImage?imgUrl=${categoryImgUrl}`,
            );
            const resp = await imgFetcher;
            if (resp.ok) {
              const imgBlob = await resp.blob();
              const base64 = await blobToBase64(imgBlob);
              setImgUrl(base64);
              sessionStorage.setItem(id, base64);
            }
          }
        })();
      }
    }
  }, [categoryImgUrl, id]);

  return (
    <Box
      className={`w-full flex flex-row items-center ${selectedCategoryId === id && 'bg-slate-200'}`}
    >
      <ListItemButton
        onClick={() => {
          setSelectedCategoryId(id);
          closeDrawer();
          if (router.pathname !== '/') router.push('/');
        }}
        className="py-2 pr-2"
      >
        {imgUrl != null && (
          <ListItemIcon>
            <img
              src={imgUrl}
              style={{ width: '30px', height: '30px' }}
              alt={categoryTitle}
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
