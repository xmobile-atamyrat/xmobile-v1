import { usePlatform } from '@/pages/lib/PlatformContext';
import { procurementClasses as c } from '@/styles/classMaps/procurement';
import { fontClassName } from '@/styles/theme';
import { Box, ButtonBase, Dialog, Typography } from '@mui/material';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ReactNode } from 'react';

interface ProcurementSheetProps {
  open?: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  /** Pinned under the scrolling body (primary/secondary buttons). */
  footer?: ReactNode;
  /** Fixed tall sheet (search lists) instead of hugging its content. */
  fullHeight?: boolean;
  /** Extra controls in the header, left of the close button. */
  headerAction?: ReactNode;
  'data-testid'?: string;
}

/**
 * Bottom sheet on phones, centered dialog on desktop — the profile language
 * sheet's shape (handle · title + round close · body · pinned footer). Every
 * procurement dialog goes through this so they all look and behave the same.
 */
export default function ProcurementSheet({
  open = true,
  onClose,
  title,
  subtitle,
  children,
  footer,
  fullHeight = false,
  headerAction,
  'data-testid': testId,
}: ProcurementSheetProps) {
  const platform = usePlatform();
  const t = useTranslations();
  const isMobile = platform === 'mobile';
  const paperClass = (fullHeight ? c.sheetFull : c.sheet)[platform];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      sx={
        isMobile
          ? { '& .MuiDialog-container': { alignItems: 'flex-end' } }
          : undefined
      }
      PaperProps={{
        className: `${paperClass} ${fontClassName.className}`,
        sx: { m: 0, maxWidth: 'none', maxHeight: 'none' },
        ...({ 'data-testid': testId } as object),
      }}
    >
      {isMobile && <Box className={c.sheetHandle} />}
      <Box className={c.sheetHeader}>
        <Box className="min-w-0 flex-1">
          <Typography
            component="h2"
            className={`${c.sheetTitle} ${fontClassName.className}`}
          >
            {title}
          </Typography>
          {subtitle && (
            <Typography
              className={`${c.sheetSubtitle} ${fontClassName.className}`}
            >
              {subtitle}
            </Typography>
          )}
        </Box>
        {headerAction}
        <ButtonBase
          disableRipple
          onClick={onClose}
          className={c.sheetClose}
          aria-label={t('close')}
        >
          <X className="w-[17px] h-[17px] text-muted" />
        </ButtonBase>
      </Box>
      <Box className={c.sheetBody}>{children}</Box>
      {footer && <Box className={c.sheetFooter}>{footer}</Box>}
    </Dialog>
  );
}
