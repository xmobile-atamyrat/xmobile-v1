import { Box, CardMedia } from '@mui/material';

export default function Loader() {
  return (
    <Box className="relative flex flex-col justify-center items-center h-full w-full bg-white px-6">
      <CardMedia
        component="img"
        src="/logo/xmobile-original-logo.jpeg"
        className="w-[260px] sm:w-[360px] md:w-[420px] h-auto animate-breathe"
      />
    </Box>
  );
}
