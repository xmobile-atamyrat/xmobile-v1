import { usePlatform } from '@/pages/lib/PlatformContext';
import { useProcurement } from '@/pages/procurement/lib/ProcurementContext';
import { procurementShellClasses as s } from '@/styles/classMaps/procurement/shell';
import { fontClassName } from '@/styles/theme';
import { Box, ButtonBase, Typography } from '@mui/material';
import { ArrowLeft, ChevronDown, ClipboardList, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';

/**
 * Mobile: white strip with a round back button, the title, a "+" for a new
 * order and the active order as a chip that opens the orders sheet.
 * Desktop: title row with the order switcher and "New order" on the right.
 */
export default function ProcurementHeader() {
  const t = useTranslations();
  const router = useRouter();
  const platform = usePlatform();
  const {
    selectedHistory,
    historyList,
    initialLoading,
    setOrdersSheetOpen,
    setNewOrderDialogOpen,
  } = useProcurement();
  const font = fontClassName.className;
  // Orders exist but none is open (bad ?order= link, failed load): the chip
  // still opens the list so the user can pick one.
  const showSwitcher =
    !initialLoading && (selectedHistory != null || historyList.length > 0);
  const orderName = selectedHistory?.name ?? t('orderNotSelected');

  if (platform === 'mobile') {
    return (
      <Box component="header" className={s.header.mobile}>
        <Box className={s.headerRow}>
          <ButtonBase
            disableRipple
            onClick={() => router.push('/user')}
            className={s.backBtn}
            aria-label={t('back')}
          >
            <ArrowLeft size={20} />
          </ButtonBase>
          <Typography component="h1" className={`${font} ${s.title.mobile}`}>
            {t('procurement')}
          </Typography>
          <ButtonBase
            disableRipple
            onClick={() => setNewOrderDialogOpen(true)}
            className={s.newOrderIconBtn}
            aria-label={t('newOrder')}
          >
            <Plus size={20} />
          </ButtonBase>
        </Box>
        {showSwitcher && (
          <ButtonBase
            disableRipple
            onClick={() => setOrdersSheetOpen(true)}
            className={`${font} ${s.orderChip}`}
            aria-label={`${t('procurementSwitchOrder')}: ${orderName}`}
            aria-haspopup="dialog"
          >
            <ClipboardList className={s.orderChipIcon} />
            <span className={s.orderChipName}>{orderName}</span>
            <ChevronDown className={s.orderChipChevron} />
          </ButtonBase>
        )}
      </Box>
    );
  }

  return (
    <Box component="header" className={s.header.web}>
      <Typography component="h1" className={`${font} ${s.title.web}`}>
        {t('procurement')}
      </Typography>
      <Box className={s.webActions}>
        {showSwitcher && (
          <ButtonBase
            disableRipple
            onClick={() => setOrdersSheetOpen(true)}
            className={`${font} ${s.orderSwitch}`}
            aria-label={`${t('procurementSwitchOrder')}: ${orderName}`}
            aria-haspopup="dialog"
          >
            <ClipboardList className={s.orderChipIcon} />
            <span className={s.orderSwitchName}>{orderName}</span>
            <ChevronDown className={s.orderChipChevron} />
          </ButtonBase>
        )}
        <ButtonBase
          disableRipple
          onClick={() => setNewOrderDialogOpen(true)}
          className={`${font} ${s.newOrderBtn}`}
        >
          <Plus size={18} />
          {t('newOrder')}
        </ButtonBase>
      </Box>
    </Box>
  );
}
