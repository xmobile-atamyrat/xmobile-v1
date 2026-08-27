import { Box, CardMedia } from '@mui/material';

export default function Loader() {
  return (
    <Box
      // Splash sits above every MUI layer (appBar/drawer/modal/snackbar/tooltip)
      sx={{ zIndex: (theme) => theme.zIndex.tooltip + 1 }}
      className="fixed inset-0 flex flex-col justify-center items-center bg-white px-6"
    >
      <CardMedia
        component="img"
        src="/logo/xmobile-original-logo.jpeg"
        className="w-[260px] sm:w-[360px] md:w-[420px] h-auto"
      />
    </Box>
  );
}
