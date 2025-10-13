import BASE_URL from '@/lib/ApiEndpoints';
import { useCartActions } from '@/pages/lib/CartContext';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { SnackbarProps } from '@/pages/lib/types';
import { productCardClasses } from '@/styles/classMaps/components/productCard';
import { borders } from '@/styles/theme';
import LoginIcon from '@mui/icons-material/Login';
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import { Alert, Box, IconButton, Snackbar } from '@mui/material';
import { Product } from '@prisma/client';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import React, { useCallback, useState } from 'react';

interface IconGroupProps {
  product: Product;
  inCart: boolean;
  cartItemId: string;
}
export default function IconGroup({
  product: initialProduct,
  inCart,
  cartItemId,
}: IconGroupProps) {
  const platform = usePlatform();
  const { user } = useUserContext();
  const [snackbarMessage, setSnackbarMessage] = useState<SnackbarProps>();
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const t = useTranslations();
  const productId = initialProduct.id;
  const showSnackbar = (
    message: SnackbarProps['message'],
    severity: SnackbarProps['severity'],
  ) => {
    setSnackbarMessage({ message, severity });
    setSnackbarOpen(true);
  };
  const { addCartItems, deleteCartItems } = useCartActions();
  const [isLocked, setIsLocked] = useState(false);

  const shareItems = useCallback(async () => {
    const productUrl = `${BASE_URL}/product/${productId}`;
    const shareData = {
      url: productUrl,
    };

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        showSnackbar('genericError', 'error');
      }
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareData.url);
        showSnackbar('linkCopied', 'success');
      } catch (err) {
        showSnackbar('genericError', 'error');
      }
    } else {
      showSnackbar('genericError', 'error');
    }
  }, [productId]);

  const handleClick = async () => {
    if (isLocked) {
      showSnackbar('pleaseWait', 'warning');
      return;
    }

    setIsLocked(true);
    setTimeout(() => setIsLocked(false), 5000);

    if (inCart && cartItemId) {
      const result = await deleteCartItems(cartItemId);
      showSnackbar(result.messageKey, result.status);
    } else {
      const result = await addCartItems(productId, 1);
      showSnackbar(result.messageKey, result.status);
    }
  };

  const handleCartClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      handleClick();
    },
    [handleClick],
  );

  const handleShareClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      shareItems();
    },
    [shareItems],
  );

  return (
    <Box className={productCardClasses.iconGroup[platform]}>
      {/* Cart Icon */}
      {user && (
        <IconButton
          sx={{
            border: borders.onePxRed,
          }}
          onClick={async (e) => {
            handleCartClick(e);
          }}
          className={
            inCart
              ? productCardClasses.boxes.iconsInCart
              : productCardClasses.boxes.icons
          }
          aria-label={inCart ? 'Remove from cart' : 'Add to cart'}
        >
          <ShoppingCartOutlinedIcon
            className={
              inCart ? productCardClasses.iconsInCart : productCardClasses.icons
            }
          />
        </IconButton>
      )}
      {/* Share Icon */}
      <IconButton
        className={productCardClasses.boxes.icons}
        sx={{
          border: borders.onePxRed,
        }}
        onClick={async (e) => {
          handleShareClick(e);
        }}
        aria-label="Share product"
      >
        <ShareOutlinedIcon className={productCardClasses.icons} />
      </IconButton>
      {/* snackbarPop-ups */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
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
