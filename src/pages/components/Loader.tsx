import { Box, CardMedia } from '@mui/material';

const Loader: React.FC = () => {
  return (
    <Box className="flex justify-center items-center h-full w-full">
      <CardMedia
        component="img"
        src="/xmobile-original-logo.jpeg"
        className="w-auto h-1/4"
      />
    </Box>
  );
};

export default Loader;
