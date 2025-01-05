import BASE_URL from '@/lib/ApiEndpoints';
import { Box, IconButton, Input, Snackbar, Alert } from '@mui/material';
import { ShoppingCart } from '@mui/icons-material';
import { useState } from 'react';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';
import { AddToCartProps, SnackbarProps } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import LoginIcon from '@mui/icons-material/Login';
import DeleteIcon from '@mui/icons-material/Delete';
import { useRouter } from 'next/router';

export default function AddToCart({
  productId,
  quantity: initialQuantity = 1,
  cartAction,
  cartItemId = undefined,
}: AddToCartProps) {
  // constants
  const [quantity, setQuantity] = useState(initialQuantity);
  const { user } = useUserContext();
  const [snackbarMessage, setSnackbarMessage] = useState<SnackbarProps>();
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const t = useTranslations();
  const router = useRouter();

  const handleProductQuantity = (action: 'add' | 'remove') => () => {
    if (action === 'add') {
      setQuantity(quantity + 1);
    }
    if (action === 'remove') {
      if (quantity > 1) setQuantity(quantity - 1);
    }
  };

  // addCartItems function
  const addCartItems = async () => {
    const userId = user?.id;
    const response = await fetch(`${BASE_URL}/api/cart`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        productId,
        quantity,
      }),
    });
    const data = await response.json();

    try {
      if (data.success) {
        setSnackbarOpen(true);
        setSnackbarMessage({
          message: t('addToCartSuccess'),
          severity: 'success',
        });
      } else {
        setSnackbarOpen(true);
        setSnackbarMessage({
          message: t(data.message),
          severity: 'error',
        });
      }
    } catch (error) {
      // console.log(error);
    }
  };

  // deleteCartItems function
  const deleteCartItems = async (cartId: string) => {
    const response = await fetch(`${BASE_URL}/api/cart`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: cartId,
      }),
    });

    try {
      const data = await response.json();
      if (data.success) {
        setSnackbarOpen(true);
        setSnackbarMessage({
          message: t('deleteFromCartSuccess'),
          severity: 'success',
        });
        router.reload();
      } else {
        setSnackbarOpen(true);
        setSnackbarMessage({
          message: t('deleteFromCartFail'),
          severity: 'error',
        });
      }
    } catch (error) {
      // console.log(error);
    }
  };

  return (
    <>
      <Box className="flex column-reverse">
        {/* removeButton */}
        <IconButton
          onClick={handleProductQuantity('remove')}
          sx={{ paddingTop: 0 }}
        >
          <RemoveCircleIcon
            sx={{
              fontSize: {
                xs: '1.3rem',
                sm: '1.5rem',
                md: '1.7rem',
                lg: '1.7rem',
              },
            }}
            color="primary"
          />
        </IconButton>

        {/* quantityInput */}
        <Input
          name="quantity"
          inputProps={{ min: 1 }}
          sx={{ minWidth: { xs: 15, sm: 25, md: 30, lg: 40 }, maxWidth: 50 }}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
        ></Input>

        {/* addButton */}
        <IconButton
          onClick={handleProductQuantity('add')}
          sx={{ paddingTop: 0 }}
        >
          <AddCircleIcon
            sx={{
              fontSize: {
                xs: '1.3rem',
                sm: '1.5rem',
                md: '1.7rem',
                lg: '1.7rem',
              },
            }}
            color="primary"
          />
        </IconButton>

        {/* addButton, deleteButton */}
        {cartAction === 'add' && (
          <IconButton
            color="primary"
            sx={{ pr: 1, paddingTop: 0 }}
            type="submit"
            onClick={addCartItems}
          >
            <ShoppingCart
              sx={{
                fontSize: {
                  xs: '1.3rem',
                  sm: '1.5rem',
                  md: '1.7rem',
                  lg: '1.7rem',
                },
              }}
            />
          </IconButton>
        )}
        {cartAction === 'delete' && (
          <IconButton
            color="primary"
            sx={{ pr: 1, paddingTop: 0 }}
            type="submit"
            onClick={() => {
              deleteCartItems(cartItemId);
            }}
          >
            <DeleteIcon
              color="error"
              sx={{
                fontSize: {
                  xs: '1.3rem',
                  sm: '1.5rem',
                  md: '1.7rem',
                  lg: '1.7rem',
                },
              }}
            />
          </IconButton>
        )}
      </Box>

      {/* snackbarPop-ups */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={(_, reason) => {
          if (reason === 'clickaway') {
            return;
          }
          setSnackbarOpen(false);
        }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={snackbarMessage?.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbarMessage?.message && snackbarMessage.message}
          {snackbarMessage?.severity === 'error' && (
            <Link href="user/signin">
              {`. ${t('signin')}`}
              <LoginIcon />
            </Link>
          )}
        </Alert>
      </Snackbar>
    </>
  );
}
