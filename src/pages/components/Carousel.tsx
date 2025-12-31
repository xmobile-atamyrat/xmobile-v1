import { PRODUCT_IMAGE_WIDTH_RESP } from '@/pages/lib/constants';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { CarouselSettings } from '@/pages/lib/types';
import { carouselClasses } from '@/styles/classMaps/components/carousel';
import { Box } from '@mui/material';
import Slider from 'react-slick';
import 'slick-carousel/slick/slick-theme.css';
import 'slick-carousel/slick/slick.css';

interface CarouselProps {
  children: React.ReactNode;
  settings?: CarouselSettings;
  isMdUp?: boolean;
}

const DEFAULT_SETTINGS: CarouselSettings = {
  dots: true,
  infinite: true,
  speed: 1000,
  slidesToShow: 1,
  slidesToScroll: 1,
  autoplay: true,
  autoplaySpeed: 5000,
  pauseOnHover: true,
};

export default function Carousel({ children, settings }: CarouselProps) {
  const updatedSettings = { ...DEFAULT_SETTINGS, ...settings };
  const platform = usePlatform();
  return (
    <Box className={carouselClasses.box[platform]}>
      <Box sx={PRODUCT_IMAGE_WIDTH_RESP}>
        <Slider {...updatedSettings}>{children}</Slider>
      </Box>
    </Box>
  );
}
