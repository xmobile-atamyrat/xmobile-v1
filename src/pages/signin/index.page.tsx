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
import { ResponseApi } from '@/pages/lib/types';
import { User } from '@prisma/client';
import { useUserContext } from '@/pages/lib/UserContext';
import { useState } from 'react';
import { useRouter } from 'next/router';

export default function Signin() {
  const { setUser } = useUserContext();
  const [errorMessage, setErrorMessage] = useState<string>();
  const router = useRouter();
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

          if (errorMessage) setErrorMessage(undefined);

          const formData = new FormData(event.currentTarget);
          const { email, password } = Object.fromEntries(formData.entries());

          try {
            const { success, data, message }: ResponseApi<User> = await (
              await fetch('/api/user/signin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
              })
            ).json();
            if (message != null) {
              setErrorMessage(message);
            } else if (success && data != null) {
              setUser(data);
              localStorage.setItem('user', JSON.stringify(data));
              router.push('/');
            }
          } catch (error) {
            setErrorMessage((error as Error).message);
          }
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
        <TextField
          fullWidth
          required
          label="Your email address"
          type="email"
          name="email"
        />
        <TextField
          fullWidth
          required
          label="Your password"
          type="password"
          name="password"
        />
        <Box className="flex flex-col gap-2">
          <Box className="flex flex-col gap-2 relative min-h-[70px]">
            <Button
              fullWidth
              variant="contained"
              sx={{ textTransform: 'none' }}
              size="large"
              type="submit"
            >
              Sign in
            </Button>
            {errorMessage != null && (
              <Typography
                color="error"
                fontSize={14}
                className="absolute bottom-0"
              >
                {errorMessage}
              </Typography>
            )}
          </Box>
          <Divider />
          <Box className="flex flex-row justify-between">
            <Button sx={{ textTransform: 'none' }}>Forgot password?</Button>
            <Button sx={{ textTransform: 'none' }}>Sign up</Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
