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
import { ReactNode, useState } from 'react';

interface CollapsableProps {
  imgUrl: string | null;
  children: ReactNode;
  categoryTitle: string;
  pl?: number;
  id: string;
}

export default function Collapsable({
  categoryTitle,
  children,
  imgUrl,
  pl,
  id,
}: CollapsableProps) {
  const [open, setOpen] = useState(false);
  const { setSelectedCategoryId } = useCategoryContext();
  return (
    <Box sx={{ pl: pl ?? 4 }}>
      <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
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
        <IconButton onClick={() => setOpen(!open)}>
          {open ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
      </Box>
      <Collapse in={open} timeout="auto" unmountOnExit>
        {children}
      </Collapse>
    </Box>
  );
}
