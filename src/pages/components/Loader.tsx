import { Box, CardMedia } from '@mui/material';

export default function Loader() {
  return (
    <Box className="relative flex justify-center items-center h-full w-full bg-white">
      <CardMedia
        component="img"
        src="/logo/xmobile-original-logo.jpeg"
        className="w-[200px] h-auto"
      />
      <span className="absolute bottom-24 h-[34px] w-[34px] rounded-full border-[3px] border-[#ECECF1] border-t-[#E41E2B] animate-spin" />
    </Box>
  );
}
