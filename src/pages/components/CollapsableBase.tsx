import BASE_URL from '@/lib/ApiEndpoints';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import {
  CategoryStack,
  DeleteCategoriesProps,
  EditCategoriesProps,
  ExtendedCategory,
} from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { blobToBase64, parseName } from '@/pages/lib/utils';
import { collapsableClasses } from '@/styles/classMaps/collapsable';
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
  categoryStackList: CategoryStack;
  parentCategory?: ExtendedCategory;
}

export default function CollapsableBase({
  imgUrl: categoryImgUrl,
  categoryTitle,
  id,
  setEditCategoriesModal,
  setDeleteCategoriesModal,
  closeDrawer,
  categoryStackList,
  parentCategory,
}: CollapsableBaseProps) {
  const { selectedCategoryId, setSelectedCategoryId } = useCategoryContext();
  const { user } = useUserContext();
  const [anchorEl, setAnchorEl] = useState<HTMLElement>();
  const router = useRouter();
  const openEditMenu = Boolean(anchorEl);
  const [imgUrl, setImgUrl] = useState<string | null>();
  const t = useTranslations();
  const { setStack, setParentCategory } = useCategoryContext();

  useEffect(() => {
    if (categoryImgUrl != null && id != null) {
      const cacheImgUrl = sessionStorage.getItem(id);
      if (cacheImgUrl != null) {
        setImgUrl(cacheImgUrl);
      } else {
        setImgUrl('/xmobile-original-logo.jpeg');
        if (process.env.NODE_ENV === 'development') {
          return;
        }
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
      className={
        collapsableClasses.baseBox &&
        `${selectedCategoryId === id && 'bg-slate-200'}`
      }
    >
      <ListItemButton
        onClick={() => {
          setSelectedCategoryId(id);
          setStack(categoryStackList);
          if (parentCategory != null) {
            setParentCategory(parentCategory);
          }
          closeDrawer();

          router.push('/product');
        }}
        className={collapsableClasses.listItemButton}
      >
        {imgUrl != null && (
          <ListItemIcon>
            <img
              src={imgUrl}
              className={collapsableClasses.listItemIcon}
              // style={{ width: '30px', height: '30px' }}
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
                    imageUrl: imgUrl,
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
                    imgUrl,
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
