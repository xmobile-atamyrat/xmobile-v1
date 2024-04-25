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
}

export default function Collapsable({
  categoryTitle,
  children,
  imgUrl,
  pl,
}: CollapsableProps) {
  const [open, setOpen] = useState(false);
  return (
    <Box sx={{ pl: pl ?? 4 }}>
      <ListItemButton
        sx={{
          p: 0,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        {imgUrl != null && (
          <ListItemIcon>
            <img src={imgUrl} width={44} height={44} alt={categoryTitle} />
          </ListItemIcon>
        )}
        <ListItemText primary={categoryTitle} />
        <IconButton onClick={() => setOpen(!open)}>
          {open ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
      </ListItemButton>
      <Collapse in={open} timeout="auto" unmountOnExit>
        {children}
      </Collapse>
    </Box>
  );
}
