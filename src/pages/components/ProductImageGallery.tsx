import { usePlatform } from '@/pages/lib/PlatformContext';
import { detailPageClasses } from '@/styles/classMaps/product/detail';
import { fontClassName } from '@/styles/theme';
import { Box, CardMedia } from '@mui/material';
import { useEffect, useRef, useState } from 'react';

const AUTO_ADVANCE_MS = 4500;
const SWIPE_THRESHOLD = 40; // px of horizontal travel before it counts as a swipe

interface ProductImageGalleryProps {
  displayImgUrls: string[];
  altText: string;
  // Owned by the page so the fullscreen viewer and this gallery always show
  // the same image: swiping in one moves the other.
  selectedIndex: number;
  onSelect: (index: number) => void;
  onExpand: (index: number) => void;
}

export default function ProductImageGallery({
  displayImgUrls,
  altText,
  selectedIndex,
  onSelect,
  onExpand,
}: ProductImageGalleryProps) {
  // Once the user swipes, taps a dot or opens the viewer, stop the
  // auto-advance so it doesn't fight their intent while they read the page.
  const [interacted, setInteracted] = useState(false);
  const platform = usePlatform();
  const classes = detailPageClasses.gallery;

  const total = displayImgUrls.length;
  const safeIndex = selectedIndex < total ? selectedIndex : 0;
  // web only: a single image renders no thumbnail rail, so the frame takes the
  // full column width instead of leaving 86px of empty gutter
  const hasWebRail = platform === 'web' && total > 1;

  const touchStartX = useRef<number | null>(null);
  const didSwipe = useRef(false);

  // A timeout per image rather than one interval, so the clock restarts
  // whenever the index changes from outside (e.g. the fullscreen viewer).
  useEffect(() => {
    if (total <= 1 || interacted) return undefined;
    const timer = setTimeout(
      () => onSelect((safeIndex + 1) % total),
      AUTO_ADVANCE_MS,
    );
    return () => clearTimeout(timer);
  }, [total, interacted, safeIndex, onSelect]);

  const goTo = (index: number) => {
    setInteracted(true);
    onSelect(((index % total) + total) % total);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    didSwipe.current = false;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > SWIPE_THRESHOLD) {
      didSwipe.current = true; // suppress the tap-to-expand that follows
      goTo(dx < 0 ? safeIndex + 1 : safeIndex - 1);
    }
    touchStartX.current = null;
  };

  const handleImageClick = () => {
    if (didSwipe.current) {
      didSwipe.current = false;
      return;
    }
    setInteracted(true);
    onExpand(safeIndex);
  };

  return (
    <Box
      className={`${classes.wrapper[platform]} ${
        hasWebRail ? classes.wrapperWithRail : ''
      }`}
    >
      {/* Main image. The click lives on the frame because the img itself
          takes no pointer events (see protectedImg). */}
      <Box
        className={classes.mainImage[platform]}
        onClick={handleImageClick}
        onTouchStart={platform === 'mobile' ? handleTouchStart : undefined}
        onTouchEnd={platform === 'mobile' ? handleTouchEnd : undefined}
      >
        <CardMedia
          component="img"
          image={displayImgUrls[safeIndex]}
          alt={altText}
          className={`${detailPageClasses.cardMedia[platform]} ${detailPageClasses.protectedImg}`}
          loading="lazy"
          decoding="async"
          draggable={false}
        />

        {/* Mobile: page counter + dot indicators overlaid on the gallery */}
        {platform === 'mobile' && total > 1 && (
          <>
            <Box className={`${classes.counter} ${fontClassName.className}`}>
              {safeIndex + 1} / {total}
            </Box>
            <Box className={classes.dots}>
              {displayImgUrls.map((_, i) => (
                <Box
                  key={i}
                  role="button"
                  aria-label={`Go to image ${i + 1}`}
                  className={i === safeIndex ? classes.dotActive : classes.dot}
                  onClick={(e) => {
                    e.stopPropagation(); // a dot tap is navigation, not expand
                    goTo(i);
                  }}
                />
              ))}
            </Box>
          </>
        )}
      </Box>

      {/* Web: thumbnail rail (absolutely positioned beside the square frame) */}
      {hasWebRail && (
        <Box className={classes.thumbnailStrip.web}>
          {displayImgUrls.map((url, i) => (
            <Box
              key={i}
              role="button"
              aria-label={`Go to image ${i + 1}`}
              className={[
                classes.thumbnail.base,
                classes.thumbnail.size.web,
                i === safeIndex
                  ? classes.thumbnail.active
                  : classes.thumbnail.inactive,
              ].join(' ')}
              onClick={() => goTo(i)}
            >
              <CardMedia
                component="img"
                image={url}
                alt={`${altText} ${i + 1}`}
                className={`${classes.thumbnail.img} ${detailPageClasses.protectedImg}`}
                draggable={false}
              />
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
