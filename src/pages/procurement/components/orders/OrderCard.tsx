import { formatOrderDate } from '@/pages/procurement/components/orders/orderUtils';
import { procurementOrdersClasses as c } from '@/styles/classMaps/procurement/orders';
import { fontClassName } from '@/styles/theme';
import { Box, ButtonBase, Menu, MenuItem, Typography } from '@mui/material';
import { ProcurementOrder } from '@prisma/client';
import { ClipboardList, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

interface OrderCardProps {
  order: ProcurementOrder;
  active: boolean;
  onSelect: (order: ProcurementOrder) => void;
  onRename: (order: ProcurementOrder) => void;
  onDelete: (order: ProcurementOrder) => void;
}

/** One order in the orders sheet: tap to open it, "⋯" to rename/delete. */
export default function OrderCard({
  order,
  active,
  onSelect,
  onRename,
  onDelete,
}: OrderCardProps) {
  const t = useTranslations();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const font = fontClassName.className;

  return (
    <Box
      component="li"
      data-testid="procurement-order-card"
      data-active={active ? 'true' : undefined}
      className={`${c.card} ${active ? c.cardActive : c.cardIdle}`}
    >
      <ButtonBase
        disableRipple
        onClick={() => onSelect(order)}
        aria-current={active ? 'true' : undefined}
        className={`${c.cardMain} ${font}`}
      >
        <Box className={`${c.tile} ${active ? c.tileActive : c.tileIdle}`}>
          <ClipboardList size={18} />
        </Box>
        <Box className={c.body}>
          <Box className={c.titleRow}>
            <Typography component="span" className={`${c.name} ${font}`}>
              {order.name}
            </Typography>
            {active && (
              <span className={c.openBadge}>{t('procurementOrderOpen')}</span>
            )}
          </Box>
          <Box className={c.metaRow}>
            <span className={c.currency}>{order.currency}</span>
            <span className={c.meta}>
              {t('procurementOrderCreated', {
                date: formatOrderDate(order.createdAt),
              })}
            </span>
            <span className={c.meta}>
              {t('procurementOrderModified', {
                date: formatOrderDate(order.updatedAt),
              })}
            </span>
          </Box>
        </Box>
      </ButtonBase>
      <ButtonBase
        disableRipple
        className={c.more}
        aria-label={t('procurementOrderActions')}
        aria-haspopup="menu"
        onClick={(event) => setMenuAnchor(event.currentTarget)}
      >
        <MoreHorizontal size={20} />
      </ButtonBase>
      <Menu
        anchorEl={menuAnchor}
        open={menuAnchor != null}
        onClose={() => setMenuAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ className: c.menuPaper, elevation: 4 }}
      >
        <MenuItem
          className={`${c.menuItem} ${font}`}
          onClick={() => {
            setMenuAnchor(null);
            onRename(order);
          }}
        >
          <Pencil size={17} />
          {t('procurementRename')}
        </MenuItem>
        <MenuItem
          className={`${c.menuItemDanger} ${font}`}
          onClick={() => {
            setMenuAnchor(null);
            onDelete(order);
          }}
        >
          <Trash2 size={17} />
          {t('delete')}
        </MenuItem>
      </Menu>
    </Box>
  );
}
