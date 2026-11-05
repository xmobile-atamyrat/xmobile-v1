import { CatalogItem } from '@/pages/procurement/lib/ProcurementContext';
import { catalogClasses as cc } from '@/styles/classMaps/procurement/catalog';
import { fontClassName } from '@/styles/theme';
import { Box, ButtonBase, CircularProgress, Typography } from '@mui/material';
import { Check, MoreVertical, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { MouseEvent } from 'react';

interface CatalogRowProps {
  item: CatalogItem;
  inOrder: boolean;
  pending: boolean;
  onAdd: (item: CatalogItem) => void;
  onMore: (item: CatalogItem, anchor: HTMLElement) => void;
}

/** One base item: wrapping name (+ supplier note), add / "In order", ⋯ menu. */
export default function CatalogRow({
  item,
  inOrder,
  pending,
  onAdd,
  onMore,
}: CatalogRowProps) {
  const t = useTranslations();
  const note = 'description' in item ? item.description : null;

  let trailing;
  if (inOrder) {
    trailing = (
      <span className={`${cc.inOrder} ${fontClassName.className}`}>
        {t('procurementInOrder')}
        <Check className="w-[14px] h-[14px]" aria-hidden />
      </span>
    );
  } else {
    trailing = (
      <ButtonBase
        disableRipple
        disabled={pending}
        onClick={() => onAdd(item)}
        className={cc.addBtn}
        aria-label={`${t('procurementAddToOrder')}: ${item.name}`}
      >
        {pending ? (
          <CircularProgress size={18} sx={{ color: '#fff' }} />
        ) : (
          <Plus className="w-5 h-5" />
        )}
      </ButtonBase>
    );
  }

  return (
    <li className={cc.row} data-testid="catalog-row">
      <Box className={cc.rowText}>
        <Typography className={`${cc.rowName} ${fontClassName.className}`}>
          {item.name}
        </Typography>
        {note && (
          <Typography className={`${cc.rowNote} ${fontClassName.className}`}>
            {note}
          </Typography>
        )}
      </Box>
      {trailing}
      <ButtonBase
        disableRipple
        onClick={(e: MouseEvent<HTMLElement>) => onMore(item, e.currentTarget)}
        className={cc.moreBtn}
        aria-label={`${t('actions')}: ${item.name}`}
        aria-haspopup="menu"
      >
        <MoreVertical className="w-[18px] h-[18px]" />
      </ButtonBase>
    </li>
  );
}
