import { Box, CardMedia, Typography } from '@mui/material';
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
    <Box className="relative flex flex-col justify-center items-center gap-12 h-full w-full bg-white px-6">
      <CardMedia
        component="img"
        src="/logo/xmobile-original-logo.jpeg"
        className="w-[260px] sm:w-[360px] md:w-[420px] h-auto animate-breathe"
      />
      <Typography
        className={`text-[#20166E] text-center transition-all duration-300 ease-out ${
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
        }`}
        sx={{
          fontSize: { xs: 22, sm: 30, md: 34 },
          fontWeight: 700,
          letterSpacing: '0.04em',
        }}
      >
        {TAGLINES[taglineIndex]}
      </Typography>
    </Box>
  );
}
