import { CarouselSettings } from '@/pages/lib/types';
import { Box } from '@mui/material';
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

export default function Carousel({ children, settings }: CarouselProps) {
  const updatedSettings = { ...DEFAULT_SETTINGS, ...settings };
  return (
    <Box className="w-full h-full flex justify-center relative">
      <Box
        sx={{
          width: {
            xs: '85%',
            sm: '75%',
            md: '65%',
            lg: '55%',
            xl: '45%',
          },
        }}
      >
        <Slider {...updatedSettings}>{children}</Slider>
      </Box>
    </Box>
  );
}
