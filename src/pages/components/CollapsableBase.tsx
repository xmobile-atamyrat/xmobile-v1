import BASE_URL from '@/lib/ApiEndpoints';
import {
  Box,
  IconButton,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import { EditCategoriesProps, DeleteCategoriesProps } from '@/pages/lib/types';
import { Dispatch, SetStateAction } from 'react';
import DeleteIcon from '@mui/icons-material/Delete';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import AddCircleIcon from '@mui/icons-material/AddCircle';

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
  return (
    <Box
      className={`w-full flex flex-row items-center ${selectedCategoryId === id && 'bg-slate-200'}`}
    >
      <ListItemButton
        onClick={() => setSelectedCategoryId(id)}
        className="py-2"
      >
        {imgUrl != null && (
          <ListItemIcon>
            <img
              src={imgUrl}
              width={44}
              height={44}
              alt={categoryTitle}
              onError={async (error) => {
                error.currentTarget.onerror = null;
                error.currentTarget.src = URL.createObjectURL(
                  await (
                    await fetch(
                      `${BASE_URL}/api/categoryImage?imgUrl=${imgUrl}`,
                    )
                  ).blob(),
                );
              }}
            />
          </ListItemIcon>
        )}
        <ListItemText primary={categoryTitle} />
      </ListItemButton>
      {selectedCategoryId === id && (
        <Box>
          <IconButton
            onClick={() =>
              setEditCategoriesModal({
                open: true,
                dialogType: 'add',
                categoryId: id,
              })
            }
          >
            <AddCircleIcon color="primary" fontSize="small" />
          </IconButton>
          <IconButton
            onClick={() =>
              setEditCategoriesModal({
                open: true,
                dialogType: 'edit',
                categoryId: id,
                categoryName: categoryTitle,
              })
            }
          >
            <EditIcon color="primary" fontSize="small" />
          </IconButton>
          <IconButton
            onClick={() =>
              setDeleteCategoriesModal({ categoryId: id, imgUrl, open: true })
            }
          >
            <DeleteIcon color="error" fontSize="small" />
          </IconButton>
        </Box>
      )}
    </Box>
  );
}
