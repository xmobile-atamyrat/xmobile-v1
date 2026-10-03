import { fileToken } from '@/lib/productImageOrder';
import { VisuallyHiddenInput } from '@/pages/lib/utils';
import {
  AddLink,
  ChevronLeft,
  ChevronRight,
  CloudUpload,
  DeleteOutlined,
  DragIndicator,
  StarBorder,
} from '@mui/icons-material';
import {
  Box,
  Button,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTranslations } from 'next-intl';
import { DragEvent, useEffect, useRef, useState } from 'react';

// `existing` is already saved on the product, `url` was pasted in this session
// and `file` is a pending upload. `stored` is the value the API knows the
// image by, `src` what the thumbnail shows.
export type ProductImage =
  | { key: string; kind: 'existing' | 'url'; stored: string; src: string }
  | { key: string; kind: 'file'; file: File; src: string };

// Splits the list into what the product API takes: uploads, pasted URLs and
// the final order, with uploads named by their position among the files.
export function productImagesPayload(images: ProductImage[]) {
  const files: File[] = [];
  const pastedUrls: string[] = [];
  const order = images.map((image) => {
    if (image.kind === 'file') {
      files.push(image.file);
      return fileToken(files.length - 1);
    }
    if (image.kind === 'url') pastedUrls.push(image.stored);
    return image.stored;
  });
  return { files, pastedUrls, order };
}

export const isValidUrl = (value: string) => {
  try {
    return Boolean(new URL(value));
  } catch (_) {
    return false;
  }
};

const move = <T,>(list: T[], from: number, to: number): T[] => {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

const tileButtonSx = {
  bgcolor: 'background.paper',
  boxShadow: 1,
  '&:hover': { bgcolor: 'background.paper' },
  '&.Mui-disabled': { bgcolor: 'background.paper', opacity: 0.5 },
};

export default function ProductImagesEditor({
  images,
  onChange,
  onRemoveExisting,
}: {
  images: ProductImage[];
  onChange: (next: ProductImage[]) => void;
  onRemoveExisting: (stored: string) => void;
}) {
  const t = useTranslations();
  const [urlInput, setUrlInput] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const nextKey = useRef(0);

  // Pending uploads are previewed through object URLs, which hold the file in
  // memory until revoked.
  const imagesRef = useRef(images);
  imagesRef.current = images;
  useEffect(
    () => () => {
      imagesRef.current.forEach((image) => {
        if (image.kind === 'file') URL.revokeObjectURL(image.src);
      });
    },
    [],
  );

  const newKey = () => {
    nextKey.current += 1;
    return `new-${nextKey.current}`;
  };

  const addUrl = () => {
    const value = urlInput.trim();
    if (!isValidUrl(value)) return;
    onChange([
      ...images,
      { key: newKey(), kind: 'url', stored: value, src: value },
    ]);
    setUrlInput('');
  };

  const addFiles = (fileList: FileList | null) => {
    const files = Array.from(fileList ?? []).filter((file) =>
      file.type.startsWith('image/'),
    );
    if (files.length === 0) return;
    onChange([
      ...images,
      ...files.map(
        (file): ProductImage => ({
          key: newKey(),
          kind: 'file',
          file,
          src: URL.createObjectURL(file),
        }),
      ),
    ]);
  };

  const remove = (index: number) => {
    const image = images[index];
    if (image.kind === 'existing') onRemoveExisting(image.stored);
    if (image.kind === 'file') URL.revokeObjectURL(image.src);
    onChange(images.filter((_, i) => i !== index));
  };

  const reorder = (from: number, to: number) => {
    if (from === to || to < 0 || to >= images.length) return;
    onChange(move(images, from, to));
  };

  const endDrag = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  // Files dragged in from the desktop land on the same grid that reorders
  // tiles; `dragIndex` tells the two apart.
  const handleGridDrop = (event: DragEvent) => {
    event.preventDefault();
    if (dragIndex == null) addFiles(event.dataTransfer.files);
    endDrag();
  };

  return (
    <Box className="flex flex-col gap-3 p-2 w-full max-w-[1000px]">
      <Box>
        <Typography variant="subtitle1" fontWeight={600}>
          {t('productImages')}
          {images.length > 0 && (
            <Typography component="span" color="text.secondary" ml={1}>
              ({images.length})
            </Typography>
          )}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('productImagesHint')}
        </Typography>
      </Box>

      <Box className="flex flex-wrap items-start gap-2">
        <Button
          component="label"
          variant="contained"
          startIcon={<CloudUpload />}
          sx={{ textTransform: 'none', height: 40 }}
        >
          {t('uploadProductImage')}
          <VisuallyHiddenInput
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = '';
            }}
          />
        </Button>
        <Box className="flex items-start gap-1 flex-1 min-w-[240px] max-w-[480px]">
          <TextField
            size="small"
            fullWidth
            type="url"
            label={t('imageUrl')}
            value={urlInput}
            onChange={(event) => setUrlInput(event.target.value)}
            onKeyDown={(event) => {
              // Enter would otherwise submit the whole product form.
              if (event.key === 'Enter') {
                event.preventDefault();
                addUrl();
              }
            }}
          />
          <Button
            variant="outlined"
            startIcon={<AddLink />}
            disabled={!isValidUrl(urlInput.trim())}
            onClick={addUrl}
            sx={{ textTransform: 'none', height: 40, flexShrink: 0 }}
          >
            {t('add')}
          </Button>
        </Box>
      </Box>

      <Box
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleGridDrop}
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(auto-fill, minmax(104px, 1fr))',
            sm: 'repeat(auto-fill, minmax(132px, 1fr))',
          },
          gap: 1.5,
          minHeight: 104,
          p: images.length === 0 ? 2 : 0,
          border: images.length === 0 ? '2px dashed' : 'none',
          borderColor: 'divider',
          borderRadius: 2,
        }}
      >
        {images.length === 0 && (
          <Typography
            color="text.secondary"
            sx={{ gridColumn: '1 / -1', alignSelf: 'center' }}
            textAlign="center"
          >
            {t('noProductImages')}
          </Typography>
        )}
        {images.map((image, index) => {
          const isCover = index === 0;
          const isDropTarget =
            overIndex === index && dragIndex != null && dragIndex !== index;
          return (
            <Box
              key={image.key}
              draggable
              onDragStart={(event) => {
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
                event.stopPropagation();
                reorder(dragIndex, index);
                endDrag();
              }}
              sx={{
                position: 'relative',
                aspectRatio: '1 / 1',
                borderRadius: 2,
                overflow: 'hidden',
                border: '2px solid',
                borderColor: (() => {
                  if (isDropTarget) return 'primary.main';
                  if (isCover) return 'secondary.main';
                  return 'divider';
                })(),
                bgcolor: 'action.hover',
                cursor: 'grab',
                opacity: dragIndex === index ? 0.4 : 1,
                transition: 'border-color 120ms, opacity 120ms',
                '&:hover .tile-controls, &:focus-within .tile-controls': {
                  opacity: 1,
                },
              }}
            >
              <Box
                component="img"
                src={image.src}
                alt=""
                draggable={false}
                loading="lazy"
                sx={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  pointerEvents: 'none',
                }}
              />

              <Box
                sx={{
                  position: 'absolute',
                  top: 4,
                  left: 4,
                  px: 0.75,
                  borderRadius: 1,
                  fontSize: 12,
                  fontWeight: 600,
                  lineHeight: '20px',
                  bgcolor: isCover ? 'secondary.main' : 'background.paper',
                  color: isCover ? 'secondary.contrastText' : 'text.primary',
                  boxShadow: 1,
                }}
              >
                {isCover ? t('coverImage') : index + 1}
              </Box>
              <DragIndicator
                fontSize="small"
                sx={{
                  position: 'absolute',
                  top: 6,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  color: 'text.secondary',
                  display: { xs: 'none', sm: 'block' },
                }}
              />
              <Tooltip title={t('delete')}>
                <IconButton
                  size="small"
                  aria-label={t('delete')}
                  onClick={() => remove(index)}
                  sx={{
                    ...tileButtonSx,
                    position: 'absolute',
                    top: 4,
                    right: 4,
                  }}
                >
                  <DeleteOutlined fontSize="small" color="error" />
                </IconButton>
              </Tooltip>

              {/* Buttons for touch screens (the WebView app) and keyboard
                  users, where native drag and drop isn't available. */}
              <Box
                className="tile-controls"
                sx={{
                  position: 'absolute',
                  left: 4,
                  right: 4,
                  bottom: 4,
                  display: 'flex',
                  justifyContent: 'space-between',
                  // Touch screens can't hover to reveal them, whatever the width.
                  opacity: 1,
                  '@media (hover: hover)': { opacity: 0 },
                  transition: 'opacity 120ms',
                }}
              >
                <Tooltip title={t('moveLeft')}>
                  <span>
                    <IconButton
                      size="small"
                      aria-label={t('moveLeft')}
                      disabled={isCover}
                      onClick={() => reorder(index, index - 1)}
                      sx={tileButtonSx}
                    >
                      <ChevronLeft fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                {!isCover && (
                  <Tooltip title={t('makeCover')}>
                    <IconButton
                      size="small"
                      aria-label={t('makeCover')}
                      onClick={() => reorder(index, 0)}
                      sx={tileButtonSx}
                    >
                      <StarBorder fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title={t('moveRight')}>
                  <span>
                    <IconButton
                      size="small"
                      aria-label={t('moveRight')}
                      disabled={index === images.length - 1}
                      onClick={() => reorder(index, index + 1)}
                      sx={tileButtonSx}
                    >
                      <ChevronRight fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
