import { usePlatform } from '@/pages/lib/PlatformContext';
import { StorefrontBanner } from '@/pages/lib/types';
import {
  getBannerMediaUrl,
  PRODUCT_IMAGE_FALLBACK,
} from '@/pages/lib/mediaUrls';
import { bannerClasses } from '@/styles/classMaps/components/banner';
import { Box } from '@mui/material';
import Link from 'next/link';
import Slider from 'react-slick';
import 'slick-carousel/slick/slick-theme.css';
import 'slick-carousel/slick/slick.css';

interface PromoBannerSectionProps {
  banners: StorefrontBanner[];
}

export default function PromoBannerSection({
  banners,
}: PromoBannerSectionProps) {
  const platform = usePlatform();

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

  const renderSlide = (banner: StorefrontBanner) => {
    const src = getBannerMediaUrl(banner.imgUrl) ?? PRODUCT_IMAGE_FALLBACK;
    const image = (
      <img
        src={src}
        alt=""
        className={bannerClasses.image}
        onError={(error) => {
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
    <Box className={bannerClasses.section[platform]}>
      {multiple ? (
        <Slider {...settings}>{banners.map(renderSlide)}</Slider>
      ) : (
        renderSlide(banners[0])
      )}
    </Box>
  );
}
