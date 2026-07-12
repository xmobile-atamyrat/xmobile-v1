import { Box, CardMedia, Fade, Typography } from '@mui/material';
import { useEffect, useState } from 'react';

const TAGLINES = [
  'Premium Electronics',
  'Eltip Bermek Hyzmaty',
  'Müňlerçäniň Ynamy',
  'Amatly Bahalar',
];

const TAGLINE_INTERVAL_MS = 2200;

export default function Loader() {
  const [taglineIndex, setTaglineIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      const timeout = setTimeout(() => {
        setTaglineIndex((prev) => (prev + 1) % TAGLINES.length);
        setVisible(true);
      }, 300);
      return () => clearTimeout(timeout);
    }, TAGLINE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <Box className="relative flex flex-col justify-center items-center gap-6 h-full w-full bg-white">
      <CardMedia
        component="img"
        src="/logo/xmobile-original-logo.jpeg"
        className="w-[200px] h-auto"
      />
      <Fade in={visible} timeout={300}>
        <Typography
          className="text-[#20166E] tracking-wide"
          sx={{ fontSize: 16, fontWeight: 600 }}
        >
          {TAGLINES[taglineIndex]}
        </Typography>
      </Fade>
    </Box>
  );
}
