import { Box } from '@mui/material';

export default function Loader() {
  return (
    <Box
      aria-hidden
      sx={(theme) => ({
        position: 'fixed',
        inset: 0,
        // Splash sits above every MUI layer (appBar/drawer/modal/snackbar/tooltip)
        zIndex: theme.zIndex.tooltip + 1,
        // Phones get the mobile layout from the server, so there is no layout
        // switch to cover. The logo is a background inside the media query so
        // phones never download it.
        display: 'none',
        [theme.breakpoints.up('md')]: {
          display: 'block',
          backgroundColor: '#fff',
          backgroundImage: "url('/logo/xmobile-original-logo.jpeg')",
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: '420px auto',
        },
      })}
    />
  );
}
