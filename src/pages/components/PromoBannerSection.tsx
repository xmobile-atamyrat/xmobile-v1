import { usePlatform } from '@/pages/lib/PlatformContext';
import { StorefrontBanner } from '@/pages/lib/types';
import {
  getBannerMediaUrl,
  PRODUCT_IMAGE_FALLBACK,
} from '@/pages/lib/mediaUrls';
import { bannerClasses } from '@/styles/classMaps/components/banner';
import { Box } from '@mui/material';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import Slider from 'react-slick';
import 'slick-carousel/slick/slick-theme.css';
import 'slick-carousel/slick/slick.css';

interface PromoBannerSectionProps {
  banners: StorefrontBanner[];
  /** 'hero' drops the section's own bottom margin — the web home grid spaces it. */
  variant?: 'default' | 'hero';
}

export default function PromoBannerSection({
  banners,
  variant = 'default',
}: PromoBannerSectionProps) {
  const platform = usePlatform();
  // Slides after the first get no src until it loads, so on a slow link the
  // first banner doesn't share bandwidth with ones nobody is looking at yet.
  const [restReady, setRestReady] = useState(false);
  const firstImageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // A cached or fast first banner can finish before hydration attaches onLoad.
    if (firstImageRef.current?.complete) setRestReady(true);
  }, []);

  if (!banners || banners.length === 0) return null;

  const multiple = banners.length > 1;
  const settings = {
    dots: multiple,
    arrows: false,
    infinite: multiple,
    autoplay: multiple,
    autoplaySpeed: 5000,
    speed: 800,
    slidesToShow: 1,
    slidesToScroll: 1,
    pauseOnHover: true,
  };

  const renderSlide = (banner: StorefrontBanner, index: number) => {
    const src = getBannerMediaUrl(banner.imgUrl) ?? PRODUCT_IMAGE_FALLBACK;
    const isFirst = index === 0;
    const image = (
      <img
        ref={isFirst ? firstImageRef : undefined}
        src={isFirst || restReady ? src : undefined}
        alt=""
        className={bannerClasses.image}
        // Lowercase: React 18 doesn't know the camelCase fetchPriority prop.
        {...(isFirst ? { fetchpriority: 'high' } : {})}
        onLoad={isFirst ? () => setRestReady(true) : undefined}
        onError={(error) => {
          if (isFirst) setRestReady(true);
          error.currentTarget.onerror = null;
          error.currentTarget.src = PRODUCT_IMAGE_FALLBACK;
        }}
      />
    );

    if (banner.redirectUrl) {
      return (
        <Link
          key={banner.id}
          href={banner.redirectUrl}
          className={bannerClasses.slide[platform]}
        >
          {image}
        </Link>
      );
    }
    return (
      <Box key={banner.id} className={bannerClasses.slide[platform]}>
        {image}
      </Box>
    );
  };

  return (
    <Box
      className={
        variant === 'hero'
          ? bannerClasses.heroSection
          : bannerClasses.section[platform]
      }
    >
      {multiple ? (
        <Slider {...settings} className={bannerClasses.slider}>
          {banners.map(renderSlide)}
        </Slider>
      ) : (
        renderSlide(banners[0], 0)
      )}
    </Box>
  );
}
