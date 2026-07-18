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
  onExpand: (index: number) => void;
}

export default function ProductImageGallery({
  displayImgUrls,
  altText,
  onExpand,
}: ProductImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Once the user swipes or taps a dot, stop the auto-advance so it doesn't
  // fight their intent while they read the page.
  const [interacted, setInteracted] = useState(false);
  const platform = usePlatform();
  const classes = detailPageClasses.gallery;

  const total = displayImgUrls.length;
  const safeIndex = selectedIndex < total ? selectedIndex : 0;

  const touchStartX = useRef<number | null>(null);
  const didSwipe = useRef(false);

  useEffect(() => {
    if (total <= 1 || interacted) return undefined;
    const timer = setInterval(() => {
      setSelectedIndex((prev) => (prev + 1) % total);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [total, interacted]);

  const goTo = (index: number) => {
    setInteracted(true);
    setSelectedIndex(((index % total) + total) % total);
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
    onExpand(safeIndex);
  };

  return (
    <Box className={classes.wrapper[platform]}>
      {/* Main image */}
      <Box
        className={classes.mainImage[platform]}
        onTouchStart={platform === 'mobile' ? handleTouchStart : undefined}
        onTouchEnd={platform === 'mobile' ? handleTouchEnd : undefined}
      >
        <CardMedia
          component="img"
          image={displayImgUrls[safeIndex]}
          alt={altText}
          className={`${detailPageClasses.cardMedia[platform]} cursor-pointer`}
          loading="lazy"
          decoding="async"
          onClick={handleImageClick}
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
                  onClick={() => goTo(i)}
                />
              ))}
            </Box>
          </>
        )}
      </Box>

      {/* Web: thumbnail strip */}
      {platform === 'web' && total > 1 && (
        <Box className={classes.thumbnailStrip.web}>
          {displayImgUrls.map((url, i) => (
            <CardMedia
              key={i}
              component="img"
              image={url}
              alt={`${altText} ${i + 1}`}
              className={[
                classes.thumbnail.base,
                classes.thumbnail.size.web,
                i === safeIndex
                  ? classes.thumbnail.active
                  : classes.thumbnail.inactive,
              ].join(' ')}
              sx={{ objectFit: 'contain' }}
              onClick={() => setSelectedIndex(i)}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
