import { Platform } from '@/pages/lib/PlatformContext';
import { saleClasses } from '@/styles/classMaps/components/sale';
import { fontClassName } from '@/styles/theme';
import { BadgePercent } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface OtherModelSaleBadgeProps {
  /** Biggest discount among the other models. */
  percent: number;
  platform: Platform;
}

// Says that a model other than the one priced here is on sale. Web spells it
// out; the narrow mobile card shows the icon and the percent. Both are visible
// without hover.
export default function OtherModelSaleBadge({
  percent,
  platform,
}: OtherModelSaleBadgeProps) {
  const t = useTranslations();
  const label = `${t('otherModelOnSale')} (-${percent}%)`;
  const classes = saleClasses.otherModel;

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`${fontClassName.className} ${classes.base} ${classes.size[platform]}`}
    >
      <BadgePercent aria-hidden className={classes.icon[platform]} />
      <span className={classes.text}>
        {platform === 'web' ? t('otherModelOnSale') : `-${percent}%`}
      </span>
    </span>
  );
}
