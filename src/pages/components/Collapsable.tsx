import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { ExpandLess, ExpandMore } from '@mui/icons-material';
import {
  ListItemText,
  Collapse,
  Box,
  ListItemIcon,
  IconButton,
  ListItemButton,
} from '@mui/material';
import { Dispatch, ReactNode, SetStateAction, useState } from 'react';
import EditIcon from '@mui/icons-material/Edit';
import { EditCategoriesProps } from '@/pages/lib/types';
import BASE_URL from '@/lib/ApiEndpoints';

interface CollapsableProps {
  imgUrl: string | null;
  children: ReactNode;
  categoryTitle: string;
  pl?: number;
  id: string;
  initialOpenState: boolean;
  collapsable: boolean;
  setEditCategoriesModal: Dispatch<SetStateAction<EditCategoriesProps>>;
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
}: CollapsableProps) {
  const [open, setOpen] = useState(initialOpenState);
  const { selectedCategoryId, setSelectedCategoryId } = useCategoryContext();
  return collapsable ? (
    <Box sx={{ pl: pl ?? 4 }}>
      <Box
        sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}
        className={`${selectedCategoryId === id && 'bg-slate-200'}`}
      >
        <ListItemButton
          sx={{
            p: 0,
          }}
          onClick={() => setSelectedCategoryId(id)}
        >
          {imgUrl != null && (
            <ListItemIcon>
              <img src={imgUrl} width={44} height={44} alt={categoryTitle} />
            </ListItemIcon>
          )}
          <ListItemText primary={categoryTitle} />
        </ListItemButton>
        {selectedCategoryId === id && (
          <IconButton
            onClick={() =>
              setEditCategoriesModal({ open: true, whoOpened: 'child' })
            }
          >
            <EditIcon color="primary" fontSize="small" />
          </IconButton>
        )}
        <IconButton onClick={() => setOpen(!open)}>
          {open ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
      </Box>
      <Collapse in={open} timeout="auto" unmountOnExit>
        {children}
      </Collapse>
    </Box>
  ) : (
    <ListItemButton
      sx={{
        pl: 4,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
      }}
      key={categoryTitle}
      onClick={() => setSelectedCategoryId(id)}
      className={`${selectedCategoryId === id && 'bg-slate-200'}`}
    >
      {imgUrl != null && (
        <ListItemIcon>
          <img
            src={imgUrl}
            width={24}
            height={24}
            alt={categoryTitle}
            onError={async (error) => {
              error.currentTarget.onerror = null;
              error.currentTarget.src = URL.createObjectURL(
                await (
                  await fetch(`${BASE_URL}/api/categoryImage?imgUrl=${imgUrl}`)
                ).blob(),
              );
            }}
          />
        </ListItemIcon>
      )}
      <ListItemText primary={categoryTitle} />
      {selectedCategoryId === id && (
        <IconButton
          onClick={() =>
            setEditCategoriesModal({ open: true, whoOpened: 'child' })
          }
        >
          <EditIcon color="primary" fontSize="small" />
        </IconButton>
      )}
    </ListItemButton>
  );
}
