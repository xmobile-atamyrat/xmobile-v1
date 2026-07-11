import { Box, CardMedia } from '@mui/material';

export default function Loader() {
  return (
    <Box
      // Splash sits above every MUI layer (appBar/drawer/modal/snackbar/tooltip)
      sx={{ zIndex: (theme) => theme.zIndex.tooltip + 1 }}
      className="fixed inset-0 flex justify-center items-center bg-white"
    >
      <CardMedia
        component="img"
        src="/logo/xmobile-original-logo.jpeg"
        className="w-auto h-1/4"
      />
    </Box>
  );
}
