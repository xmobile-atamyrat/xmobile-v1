import { CarouselArrowProps, CarouselSettings } from '@/pages/lib/types';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Box, IconButton } from '@mui/material';
import Slider from 'react-slick';
import 'slick-carousel/slick/slick-theme.css';
import 'slick-carousel/slick/slick.css';

interface CarouselProps {
  children: React.ReactNode;
  settings?: CarouselSettings;
}

const DEFAULT_SETTINGS: CarouselSettings = {
  dots: true,
  infinite: true,
  speed: 500,
  slidesToShow: 1,
  slidesToScroll: 1,
  autoplay: true,
  autoplaySpeed: 3000,
  pauseOnHover: true,
};

export function NextArrow({ onClick }: CarouselArrowProps) {
  return (
    <div onClick={onClick}>
      <IconButton
        //   className="absolute -right-52 -top-44"
        className="absolute"
      >
        <ArrowBackIcon />
      </IconButton>
    </div>
  );
}

export function PrevArrow({ onClick }: CarouselArrowProps) {
  return (
    <div onClick={onClick}>
      <IconButton
        //   className="absolute -left-12 top-36"
        className="absolute"
      >
        <ArrowBackIcon />
      </IconButton>
    </div>
  );
}

export default function Carousel({ children, settings }: CarouselProps) {
  const updatedSettings = { ...DEFAULT_SETTINGS, ...settings };
  return (
    <Box className="w-full h-full flex justify-center relative">
      <Box className="w-[60%]">
        <Slider {...updatedSettings}>{children}</Slider>
      </Box>
    </Box>
  );
}
