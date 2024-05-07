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
    <Box>
      <Box
        sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}
        className={`${selectedCategoryId === id && 'bg-slate-200'}`}
        style={{ paddingLeft: `${pl * 2}rem` }}
      >
        <CollapsableBase
          categoryTitle={categoryTitle}
          id={id}
          imgUrl={imgUrl}
          setDeleteCategoriesModal={setDeleteCategoriesModal}
          setEditCategoriesModal={setEditCategoriesModal}
        />
        <IconButton onClick={() => setOpen(!open)}>
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
    // <ListItemButton
    //   sx={{
    //     pl: 4,
    //     display: 'flex',
    //     flexDirection: 'row',
    //     alignItems: 'center',
    //   }}
    //   key={categoryTitle}
    //   onClick={() => setSelectedCategoryId(id)}
    //   className={`${selectedCategoryId === id && 'bg-slate-200'}`}
    // >
    //   {imgUrl != null && (
    //     <ListItemIcon>
    //       <img
    //         src={imgUrl}
    //         width={24}
    //         height={24}
    //         alt={categoryTitle}
    //         onError={async (error) => {
    //           error.currentTarget.onerror = null;
    //           error.currentTarget.src = URL.createObjectURL(
    //             await (
    //               await fetch(`${BASE_URL}/api/categoryImage?imgUrl=${imgUrl}`)
    //             ).blob(),
    //           );
    //         }}
    //       />
    //     </ListItemIcon>
    //   )}
    //   <ListItemText primary={categoryTitle} />
    //   {selectedCategoryId === id && (
    //     <Box>
    //       <IconButton
    //         onClick={() =>
    //           setEditCategoriesModal({ open: true, whoOpened: 'child' })
    //         }
    //       >
    //         <EditIcon color="primary" fontSize="small" />
    //       </IconButton>
    //       <IconButton
    //         onClick={() =>
    //           setDeleteCategoriesModal({ categoryId: id, imgUrl, open: true })
    //         }
    //       >
    //         <DeleteIcon color="error" fontSize="small" />
    //       </IconButton>
    //     </Box>
    //   )}
    // </ListItemButton>
  );
}
