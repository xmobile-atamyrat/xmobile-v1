import {
  LineChart,
  MarkElement,
  type LineChartProps,
  type MarkElementProps,
} from '@mui/x-charts/LineChart';
import { useMemo } from 'react';

type Props = LineChartProps & {
  /** Indexes of points that cover only part of their week or month. */
  partialIndexes: readonly number[];
};

/**
 * A LineChart that draws the marks of partial points faded and dashed, so a
 * week the range cuts to 3 days doesn't read as a drop. Lives in its own
 * module so the dashboard can load it (and the chart library) lazily.
 */
export default function PartialLineChart({ partialIndexes, ...props }: Props) {
  const key = partialIndexes.join(',');
  const Mark = useMemo(() => {
    const partial = new Set(key === '' ? [] : key.split(',').map(Number));
    function PartialAwareMark(markProps: MarkElementProps) {
      return partial.has(markProps.dataIndex) ? (
        <MarkElement
          {...markProps}
          opacity={0.45}
          strokeDasharray="2 2"
          data-partial="true"
        />
      ) : (
        <MarkElement {...markProps} />
      );
    }
    return PartialAwareMark;
  }, [key]);
  return <LineChart {...props} slots={{ ...props.slots, mark: Mark }} />;
}
