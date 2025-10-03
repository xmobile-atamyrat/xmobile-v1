import { usePlatform } from '@/pages/lib/PlatformContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { SnackbarProps } from '@/pages/lib/types';
import { productCardClasses } from '@/styles/classMaps/components/productCard';
import LoginIcon from '@mui/icons-material/Login';
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import { Alert, Box, IconButton, Snackbar } from '@mui/material';
import { Product } from '@prisma/client';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useCallback, useState } from 'react';

interface IconGroupProps {
  product?: Product;
  inCart?: boolean;
  cartItemId?: string;
  onCartChange?: () => void;
}

export default function IconGroup({
  product: initialProduct,
  inCart,
  cartItemId,
  onCartChange,
}: IconGroupProps) {
  const platform = usePlatform();
  const { user, accessToken } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();
  const [snackbarMessage, setSnackbarMessage] = useState<SnackbarProps>();
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const t = useTranslations();
  const productId = initialProduct.id;

  const addCartItems = async () => {
    const userId = user?.id;

    if (userId == null) {
      setSnackbarOpen(true);
      setSnackbarMessage({
        message: 'userNotFound',
        severity: 'warning',
      });
    } else {
      try {
        const data = await fetchWithCreds({
          accessToken,
          path: '/api/cart',
          method: 'POST',
          body: {
            userId,
            productId,
            quantity: 1,
          },
        });

        if (data.success) {
          setSnackbarOpen(true);
          setSnackbarMessage({
            message: 'addToCartSuccess',
            severity: 'success',
          });
          onCartChange?.();
        } else {
          setSnackbarOpen(true);
          setSnackbarMessage({
            message: data.message,
            severity: 'error',
          });
        }
      } catch (error) {
        console.error(t('addToCartFail'));
      }
    }
  };

  const deleteCartItems = async (cartId: string) => {
    try {
      const data = await fetchWithCreds({
        accessToken,
        path: '/api/cart',
        method: 'DELETE',
        body: {
          id: cartId,
        },
      });

      if (data.success) {
        setSnackbarOpen(true);
        setSnackbarMessage({
          message: 'deleteFromCartSuccess',
          severity: 'success',
        });
        onCartChange?.();
      } else {
        setSnackbarOpen(true);
        setSnackbarMessage({
          message: 'deleteFromCartFail',
          severity: 'error',
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const shareItems = useCallback(async () => {
    const productUrl = `${window.location.origin}/product/${productId}`;
    const shareData = {
      url: productUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        setSnackbarOpen(true);
        setSnackbarMessage({
          message: 'shareFailed',
          severity: 'error',
        });
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareData.url);
        setSnackbarOpen(true);
        setSnackbarMessage({
          message: 'linkCopied',
          severity: 'success',
        });
      } catch (err) {
        setSnackbarOpen(true);
        setSnackbarMessage({
          message: 'shareFailed',
          severity: 'error',
        });
      }
    }
  }, [productId]);

  return (
    <Box className={productCardClasses.iconGroup[platform]}>
      {/* Cart Icon */}
      {user && (
        <IconButton
          sx={{
            border: '1px solid #ff624c',
          }}
          onClick={async (e) => {
            e.stopPropagation();
            if (inCart) {
              if (!cartItemId) {
                setSnackbarOpen(true);
                setSnackbarMessage({
                  message: 'cartItemIdMissing',
                  severity: 'error',
                });
                return;
              }
              await deleteCartItems(cartItemId);
            } else {
              await addCartItems();
            }
          }}
          className={
            inCart
              ? 'opacity-100 bg-[#ff624c] text-[#fff] w-[50px] h-[50px] hover:bg-[#ee513b] mx-[10px]'
              : productCardClasses.boxes.icons
          }
          aria-label={inCart ? 'Remove from cart' : 'Add to cart'}
        >
          <ShoppingCartOutlinedIcon
            className={
              inCart
                ? 'text-[#fff] w-[20px] h-[20px]'
                : productCardClasses.icons
            }
          />
        </IconButton>
      )}
      {/* Share Icon */}
      <IconButton
        className={productCardClasses.boxes.icons}
        sx={{
          border: '1px solid #ff624c',
        }}
        onClick={(e) => {
          e.stopPropagation();
          shareItems();
        }}
        aria-label="Share product"
      >
        <ShareOutlinedIcon className={productCardClasses.icons} />
      </IconButton>
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
        onClick={(e) => e.stopPropagation()}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={snackbarMessage?.severity}
          variant="filled"
          className="w-100%"
        >
          {snackbarMessage?.message && t(snackbarMessage.message)}
          {snackbarMessage?.message === 'userNotFound' && (
            <Link href="/user/signin">
              {`. ${t('signin')}`}
              <LoginIcon />
            </Link>
          )}
        </Alert>
      </Snackbar>
    </Box>
  );
}
