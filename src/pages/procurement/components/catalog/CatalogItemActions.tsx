import { usePlatform } from '@/pages/lib/PlatformContext';
import ProcurementSheet from '@/pages/procurement/components/ProcurementSheet';
import { CatalogItem } from '@/pages/procurement/lib/ProcurementContext';
import { catalogClasses as cc } from '@/styles/classMaps/procurement/catalog';
import { fontClassName } from '@/styles/theme';
import { Box, ButtonBase, Menu, MenuItem } from '@mui/material';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface CatalogItemActionsProps {
  item: CatalogItem | undefined;
  anchorEl: HTMLElement | null;
  renameLabel: string;
  onClose: () => void;
  onRename: (item: CatalogItem) => void;
  onDelete: (item: CatalogItem) => void;
}

/** Rename / delete for one base item: action sheet on phones, menu on web. */
export default function CatalogItemActions({
  item,
  anchorEl,
  renameLabel,
  onClose,
  onRename,
  onDelete,
}: CatalogItemActionsProps) {
  const t = useTranslations();
  const platform = usePlatform();
  if (item == null) return null;

  const actions = [
    {
      key: 'rename',
      label: renameLabel,
      Icon: Pencil,
      danger: false,
      run: () => onRename(item),
    },
    {
      key: 'delete',
      label: t('procurementDeleteFromBase'),
      Icon: Trash2,
      danger: true,
      run: () => onDelete(item),
    },
  ];

  if (platform === 'web') {
    return (
      <Menu
        open={anchorEl != null}
        anchorEl={anchorEl}
        onClose={onClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { borderRadius: '14px', minWidth: 200 } }}
      >
        {actions.map(({ key, label, Icon, danger, run }) => (
          <MenuItem
            key={key}
            onClick={run}
            className={`${cc.menuItem} ${danger ? '!text-red' : ''} ${
              fontClassName.className
            }`}
          >
            <Icon className="w-[17px] h-[17px]" />
            {label}
          </MenuItem>
        ))}
      </Menu>
    );
  }

  return (
    <ProcurementSheet onClose={onClose} title={item.name}>
      <Box className="flex flex-col pb-2" role="menu">
        {actions.map(({ key, label, Icon, danger, run }) => (
          <ButtonBase
            key={key}
            role="menuitem"
            disableRipple
            onClick={run}
            className={`${cc.actionRow} ${danger ? '!text-red' : ''} ${
              fontClassName.className
            }`}
          >
            <span className={danger ? cc.actionTileDanger : cc.actionTile}>
              <Icon className="w-[18px] h-[18px]" />
            </span>
            {label}
          </ButtonBase>
        ))}
      </Box>
    </ProcurementSheet>
  );
}
