import { saleClasses } from '@/styles/classMaps/components/sale';
import { fontClassName } from '@/styles/theme';

interface SaleBadgeProps {
  percent: number;
  size: keyof typeof saleClasses.percent.size;
}

export default function SaleBadge({ percent, size }: SaleBadgeProps) {
  return (
    <span
      className={`${fontClassName.className} ${saleClasses.percent.base} ${saleClasses.percent.size[size]}`}
    >
      {`-${percent}%`}
    </span>
  );
}
