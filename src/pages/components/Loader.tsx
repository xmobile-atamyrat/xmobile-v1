import { Box, CardMedia } from '@mui/material';

export default function Loader() {
  return (
    <Box className="flex justify-center items-center h-full w-full">
      <CardMedia
        component="img"
        src="/logo/xmobile-original-logo.jpeg"
        className="w-auto h-1/4"
      />
    </Box>
  );
}
