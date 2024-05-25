import {
  Box,
  Button,
  Divider,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import CancelIcon from '@mui/icons-material/Cancel';
import Link from 'next/link';

export default function Signin() {
  return (
    <Box className="h-[100vh] flex justify-center items-center">
      <Paper
        className="flex flex-col"
        elevation={3}
        square={false}
        sx={{
          width: '400px',
          height: '400px',
          borderRadius: '16px',
          border: 2,
          borderColor: '#dae2ed',
          p: 2,
          gap: 3,
        }}
        component="form"
        onSubmit={async (event) => {
          event.preventDefault();
          console.log('Signin');
        }}
      >
        <Box className="flex flex-col gap-1">
          <Box className="flex flex-row justify-between">
            <Typography variant="h5">Signin</Typography>
            <Link href="/">
              <CancelIcon />
            </Link>
          </Box>
          <Divider />
        </Box>
        <TextField fullWidth required label="Your email address" type="email" />
        <TextField fullWidth required label="Your password" type="password" />
        <Button
          fullWidth
          variant="contained"
          sx={{ textTransform: 'none' }}
          size="large"
          type="submit"
        >
          Sign in
        </Button>
        <Divider />
        <Box className="flex flex-row justify-between">
          <Button sx={{ textTransform: 'none' }}>Forgot password?</Button>
          <Button sx={{ textTransform: 'none' }}>Sign up</Button>
        </Box>
      </Paper>
    </Box>
  );
}
