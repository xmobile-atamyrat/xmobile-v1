import { PRODUCT_IMAGE_FALLBACK } from '@/pages/lib/mediaUrls';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { detailPageClasses } from '@/styles/classMaps/product/detail';
import { fontClassName } from '@/styles/theme';
import { Box, Dialog, IconButton } from '@mui/material';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

const SWIPE_THRESHOLD = 40; // px of horizontal travel before it counts as a swipe

interface ProductImageLightboxProps {
  open: boolean;
  onClose: () => void;
  // Index-aligned: previewUrls are the gallery-tier images the page already
  // loaded, fullUrls the originals that replace them once downloaded.
  previewUrls: string[];
  fullUrls: string[];
  index: number;
  onIndexChange: (index: number) => void;
  altText: string;
}

export default function ProductImageLightbox({
  open,
  onClose,
  previewUrls,
  fullUrls,
  index,
  onIndexChange,
  altText,
}: ProductImageLightboxProps) {
  const t = useTranslations();
  const platform = usePlatform();
  const classes = detailPageClasses.lightbox;
  const galleryClasses = detailPageClasses.gallery;

  const total = previewUrls.length;
  const safeIndex = index < total ? index : 0;

  // Originals are only requested for the current slide and its neighbours,
  // and stay requested afterwards: on a slow link a 5-image product shouldn't
  // pull every full-size photo the moment the viewer opens.
  const [requested, setRequested] = useState<Set<number>>(new Set());
  const [loaded, setLoaded] = useState<Set<number>>(new Set());
  useEffect(() => {
    setRequested(new Set());
    setLoaded(new Set());
  }, [fullUrls]);
  useEffect(() => {
    if (!open || total === 0) return;
    setRequested((prev) => {
      const wanted = [safeIndex - 1, safeIndex, safeIndex + 1].map(
        (i) => (i + total) % total,
      );
      if (wanted.every((i) => prev.has(i))) return prev;
      return new Set([...prev, ...wanted]);
    });
  }, [open, safeIndex, total, fullUrls]);

  const goTo = (i: number) => onIndexChange(((i % total) + total) % total);

  useEffect(() => {
    if (!open || total <= 1) return undefined;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') onIndexChange((safeIndex - 1 + total) % total);
      if (e.key === 'ArrowRight') onIndexChange((safeIndex + 1) % total);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, safeIndex, total, onIndexChange]);

  // The track follows the finger while dragging (dragX), then snaps to the
  // nearest slide with a CSS transition once released.
  const touchStartX = useRef<number | null>(null);
  const [dragX, setDragX] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (total <= 1) return;
    touchStartX.current = e.touches[0].clientX;
    setDragX(0);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    setDragX(e.touches[0].clientX - touchStartX.current);
  };
  const handleTouchEnd = () => {
    if (touchStartX.current == null) return;
    const dx = dragX ?? 0;
    if (Math.abs(dx) > SWIPE_THRESHOLD) {
      goTo(dx < 0 ? safeIndex + 1 : safeIndex - 1);
    }
    touchStartX.current = null;
    setDragX(null);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      PaperProps={{ className: classes.paper }}
      // A right click / long press anywhere in the viewer gets no menu at
      // all, so there's no "Save image" even if it reaches an img somehow.
      onContextMenu={(e) => e.preventDefault()}
    >
      <Box className={`${classes.header} ${fontClassName.className}`}>
        <span className={classes.counter}>
          {total > 1 ? `${safeIndex + 1} / ${total}` : ''}
        </span>
        <IconButton
          aria-label={t('close')}
          className={classes.close}
          onClick={onClose}
        >
          <X className={classes.closeIcon} />
        </IconButton>
      </Box>

      <Box
        className={classes.stage}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <Box
          className={classes.track}
          style={{
            transform: `translate3d(calc(${-safeIndex * 100}% + ${
              dragX ?? 0
            }px), 0, 0)`,
            transition: dragX == null ? 'transform 300ms ease-out' : 'none',
          }}
        >
          {previewUrls.map((previewUrl, i) => (
            <Box
              key={i}
              className={classes.slide[platform]}
              aria-hidden={i !== safeIndex}
            >
              <Box className={classes.slideInner}>
                {/* Already cached by the gallery, so something shows instantly;
                    hidden once the original covers it so transparent PNGs
                    don't render twice. */}
                {!loaded.has(i) && (
                  <img
                    src={previewUrl}
                    alt={i === safeIndex ? altText : ''}
                    className={`${classes.img} ${detailPageClasses.protectedImg}`}
                    draggable={false}
                    onError={(e) => {
                      const el = e.currentTarget;
                      el.onerror = null;
                      el.src = PRODUCT_IMAGE_FALLBACK;
                    }}
                  />
                )}
                {requested.has(i) && (
                  <img
                    src={fullUrls[i]}
                    alt={loaded.has(i) && i === safeIndex ? altText : ''}
                    className={`${classes.img} ${detailPageClasses.protectedImg}`}
                    draggable={false}
                    decoding="async"
                    onLoad={() =>
                      setLoaded((prev) =>
                        prev.has(i) ? prev : new Set(prev).add(i),
                      )
                    }
                    // Keep the preview rather than swapping in the fallback:
                    // a smaller real photo beats a placeholder.
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
              </Box>
            </Box>
          ))}
        </Box>

        {platform === 'web' && total > 1 && (
          <>
            <IconButton
              aria-label={t('previous')}
              className={`${classes.arrow} ${classes.arrowPrev}`}
              onClick={() => goTo(safeIndex - 1)}
            >
              <ChevronLeft className={classes.arrowIcon} />
            </IconButton>
            <IconButton
              aria-label={t('next')}
              className={`${classes.arrow} ${classes.arrowNext}`}
              onClick={() => goTo(safeIndex + 1)}
            >
              <ChevronRight className={classes.arrowIcon} />
            </IconButton>
          </>
        )}
      </Box>

      {total > 1 && (
        <Box className={classes.footer[platform]}>
          {platform === 'web'
            ? previewUrls.map((url, i) => (
                <Box
                  key={i}
                  role="button"
                  aria-label={`Go to image ${i + 1}`}
                  className={[
                    galleryClasses.thumbnail.base,
                    galleryClasses.thumbnail.size.web,
                    i === safeIndex
                      ? galleryClasses.thumbnail.active
                      : galleryClasses.thumbnail.inactive,
                  ].join(' ')}
                  onClick={() => goTo(i)}
                >
                  <img
                    src={url}
                    alt=""
                    className={`${galleryClasses.thumbnail.img} ${detailPageClasses.protectedImg}`}
                    draggable={false}
                  />
                </Box>
              ))
            : previewUrls.map((_, i) => (
                <Box
                  key={i}
                  role="button"
                  aria-label={`Go to image ${i + 1}`}
                  className={
                    i === safeIndex
                      ? galleryClasses.dotActive
                      : galleryClasses.dot
                  }
                  onClick={() => goTo(i)}
                />
              ))}
        </Box>
      )}
    </Dialog>
  );
}
