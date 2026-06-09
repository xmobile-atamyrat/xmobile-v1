import { usePlatform } from '@/pages/lib/PlatformContext';
import { detailPageClasses } from '@/styles/classMaps/product/detail';
import { Box, CardMedia } from '@mui/material';
import { useState } from 'react';

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
  const platform = usePlatform();
  const classes = detailPageClasses.gallery;

  const safeIndex = selectedIndex < displayImgUrls.length ? selectedIndex : 0;

  return (
    <Box className={classes.wrapper[platform]}>
      {/* Main image */}
      <Box className="w-full flex justify-center items-center">
        <CardMedia
          component="img"
          image={displayImgUrls[safeIndex]}
          alt={altText}
          className={`${detailPageClasses.cardMedia[platform]} cursor-pointer`}
          loading="lazy"
          decoding="async"
          onClick={() => onExpand(safeIndex)}
        />
      </Box>

      {/* Thumbnail strip */}
      {displayImgUrls.length > 1 && (
        <Box className={classes.thumbnailStrip[platform]}>
          {displayImgUrls.map((url, i) => (
            <CardMedia
              key={i}
              component="img"
              image={url}
              alt={`${altText} ${i + 1}`}
              className={[
                classes.thumbnail.base,
                classes.thumbnail.size[platform],
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
