import {
  PRODUCT_IMAGE_FALLBACK,
  productThumbnailUrl,
} from '@/pages/lib/mediaUrls';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import {
  Box,
  IconButton,
  Tooltip,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useTranslations } from 'next-intl';
import { ReactNode, useState } from 'react';

export function ProductThumbnail({
  imgUrl,
  size,
}: {
  imgUrl: string | null;
  size: number;
}) {
  return (
    <Box
      component="img"
      src={productThumbnailUrl(imgUrl) ?? PRODUCT_IMAGE_FALLBACK}
      alt=""
      draggable={false}
      loading="lazy"
      sx={{
        width: size,
        height: size,
        objectFit: 'contain',
        borderRadius: 1,
        bgcolor: 'action.hover',
        flexShrink: 0,
        pointerEvents: 'none',
      }}
    />
  );
}

interface SortableProductListProps<T extends { id: string }> {
  items: T[];
  imgUrl: (item: T) => string | null;
  onReorder: (from: number, to: number) => void;
  onRemove: (item: T, index: number) => void;
  /** Between the drag handle and the thumbnail: a position or a number field. */
  renderLeading: (item: T, index: number) => ReactNode;
  /** The text column next to the thumbnail. */
  renderDetails: (item: T) => ReactNode;
}

/**
 * A drag-to-reorder product list for the admin screens. Native drag and drop
 * for mouse users, plus up/down buttons for touch screens (the WebView app)
 * and keyboard users, where drag and drop isn't available.
 */
export default function SortableProductList<T extends { id: string }>({
  items,
  imgUrl,
  onReorder,
  onRemove,
  renderLeading,
  renderDetails,
}: SortableProductListProps<T>) {
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const t = useTranslations();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const endDrag = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  return (
    <Box
      className="flex flex-col gap-2"
      onDragOver={(event) => event.preventDefault()}
    >
      {items.map((item, index) => {
        const isDropTarget =
          overIndex === index && dragIndex != null && dragIndex !== index;
        return (
          <Box
            key={item.id}
            draggable
            onDragStart={(event) => {
              // eslint-disable-next-line no-param-reassign
              event.dataTransfer.effectAllowed = 'move';
              // Firefox won't start a drag without some payload.
              event.dataTransfer.setData('text/plain', String(index));
              setDragIndex(index);
            }}
            onDragEnter={() => setOverIndex(index)}
            onDragEnd={endDrag}
            onDrop={(event) => {
              if (dragIndex == null) return;
              event.preventDefault();
              onReorder(dragIndex, index);
              endDrag();
            }}
            className="flex flex-row items-center gap-3 rounded-[10px] p-2"
            sx={{
              border: '2px solid',
              borderColor: isDropTarget ? 'primary.main' : '#eee',
              opacity: dragIndex === index ? 0.4 : 1,
              cursor: 'grab',
              transition: 'border-color 120ms, opacity 120ms',
            }}
          >
            <DragIndicatorIcon
              fontSize="small"
              sx={{
                color: 'text.secondary',
                display: { xs: 'none', sm: 'block' },
              }}
            />
            {renderLeading(item, index)}
            <ProductThumbnail imgUrl={imgUrl(item)} size={isMdUp ? 56 : 44} />
            <Box className="flex flex-col flex-1 min-w-0">
              {renderDetails(item)}
            </Box>
            <Tooltip title={t('moveUp')}>
              <span>
                <IconButton
                  size="small"
                  aria-label={t('moveUp')}
                  disabled={index === 0}
                  onClick={() => onReorder(index, index - 1)}
                >
                  <KeyboardArrowUpIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={t('moveDown')}>
              <span>
                <IconButton
                  size="small"
                  aria-label={t('moveDown')}
                  disabled={index === items.length - 1}
                  onClick={() => onReorder(index, index + 1)}
                >
                  <KeyboardArrowDownIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={t('remove')}>
              <IconButton
                size="small"
                aria-label={t('remove')}
                onClick={() => onRemove(item, index)}
              >
                <DeleteOutlinedIcon fontSize="small" color="error" />
              </IconButton>
            </Tooltip>
          </Box>
        );
      })}
    </Box>
  );
}
