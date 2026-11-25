import SaleBadge from '@/pages/components/sale/SaleBadge';
import { saleClasses } from '@/styles/classMaps/components/sale';
import { fontClassName } from '@/styles/theme';
import { Sparkle } from 'lucide-react';
import { useTranslations } from 'next-intl';

type SalePriceSize = keyof typeof saleClasses.price.root;

interface SalePriceProps {
  /** What the shopper pays now. */
  price: string;
  /** The normal price, shown crossed out. */
  oldPrice: string;
  size: SalePriceSize;
  /** Adds a "-N%" badge after the prices. */
  percent?: number;
}

export default function SalePrice({
  price,
  oldPrice,
  size,
  percent,
}: SalePriceProps) {
  const t = useTranslations();
  const classes = saleClasses.price;

  return (
    <div className={`${fontClassName.className} ${classes.root[size]}`}>
      <del className={classes.old[size]}>{oldPrice}</del>
      <span className={classes.current}>
        <span className={`${classes.amount[size]} ${saleClasses.shine}`}>
          {price}
        </span>
        <span className={classes.unit[size]}>{t('manat')}</span>
        <Sparkle
          aria-hidden
          className={`${classes.sparkleBase} ${classes.sparkle[size]}`}
        />
      </span>
      {percent != null && (
        <SaleBadge
          percent={percent}
          size={size === 'detailMobile' ? 'mobile' : 'web'}
        />
      )}
    </div>
  );
}
