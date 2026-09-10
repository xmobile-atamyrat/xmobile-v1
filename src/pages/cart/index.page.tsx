import CheckoutSummary from '@/pages/cart/components/CheckoutSummary';
import OutOfStockDialog from '@/pages/cart/components/OutOfStockDialog';
import CartProductCard from '@/pages/cart/components/ProductCard';
import Layout from '@/pages/components/Layout';
import { fetchColors } from '@/pages/lib/apis';
import { fetchWithoutCreds, useFetchWithCreds } from '@/pages/lib/fetch';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { computeProductPrice } from '@/pages/product/utils';
import { cartIndexClasses } from '@/styles/classMaps/cart/index';
import { interClassname } from '@/styles/theme';
import { CartPageSkeleton } from '@/pages/components/SkeletonLoader';
import {
  Box,
  Breadcrumbs,
  CardMedia,
  CircularProgress,
  IconButton,
  Link,
  Typography,
} from '@mui/material';
import { CartItem, Color, Prices, Product } from '@prisma/client';
import { GetStaticProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { Suspense, useEffect, useState } from 'react';

// getStaticProps because translations are static
export const getStaticProps = (async (context) => {
  return {
    props: {
      messages: (await import(`../../i18n/${context.locale}.json`)).default,
    },
  };
}) satisfies GetStaticProps<object>;

export default function CartPage() {
  const { user, accessToken, isLoading } = useUserContext();
  const [cartItems, setCartItems] = useState<
    (CartItem & { product: Product })[]
  >([]);
  const [totalPrice, setTotalPrice] = useState(0);
  const [colorsMap, setColorsMap] = useState<Map<string, Color>>(new Map());
  const [showOutOfStockDialog, setShowOutOfStockDialog] = useState(false);
  const router = useRouter();
  const t = useTranslations();
  const fetchWithCreds = useFetchWithCreds();
  const platform = usePlatform();

  const onDelete = (cartItemId: string) => {
    setCartItems(cartItems.filter((cartItem) => cartItem.id !== cartItemId));
  };

  useEffect(() => {
    (async () => {
      const cs = await fetchColors();
      setColorsMap(new Map(cs.map((c) => [c.id, c])));
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (isLoading) return;
      try {
        const { success, data, message } = user
          ? await fetchWithCreds<(CartItem & { product: Product })[]>({
              accessToken,
              path: `/api/cart?userId=${user.id}`,
              method: 'GET',
            })
          : await fetchWithoutCreds<(CartItem & { product: Product })[]>(
              '/api/guest/cart',
              'GET',
            );

        if (success) {
          const computedData = await Promise.all(
            data.map(async (item) => {
              // Price comes from the selected variant when present, else the product
              const priceSource = item.selectedVariant ?? item.product.price;
              const priceMatch = priceSource?.match(/\[([^\]]+)\]/);
              let computedProduct = item.product;

              if (priceMatch) {
                const priceId = priceMatch[1];
                const priceResp =
                  user && accessToken
                    ? await fetchWithCreds<Prices>({
                        accessToken,
                        path: `/api/prices?id=${priceId}`,
                        method: 'GET',
                      })
                    : await fetchWithoutCreds<Prices>(
                        `/api/prices?id=${priceId}`,
                        'GET',
                      );
                if (priceResp.success && priceResp.data?.priceInTmt) {
                  computedProduct = {
                    ...item.product,
                    price: priceResp.data.priceInTmt,
                  };
                }
              } else if (user && accessToken) {
                computedProduct = await computeProductPrice({
                  product: item.product,
                  accessToken,
                  fetchWithCreds,
                });
              }

              return {
                ...item,
                product: computedProduct,
              };
            }),
          );
          setCartItems(computedData);
        } else {
          console.error(message);
        }
      } catch (error) {
        console.error('Error fetching cart data:', error);
      }
    })();
  }, [user, accessToken, isLoading]);

  useEffect(() => {
    if (cartItems == null) return;
    let totPrice = 0;
    cartItems.forEach((item) => {
      // Out-of-stock items can't be ordered, so they don't count toward the total
      if (item.product.outOfStockAt != null) return;
      if (!Number.isNaN(Number(item.product.price)))
        totPrice += Number(item.product.price) * item.quantity;
    });
    setTotalPrice(totPrice);
  }, [cartItems]);

  const outOfStockItems = cartItems.filter(
    (item) => item.product.outOfStockAt != null,
  );

  const handleCheckoutClick = () => {
    if (outOfStockItems.length > 0) {
      setShowOutOfStockDialog(true);
      return;
    }
    router.push('/cart/checkout');
  };

  // Removes every out-of-stock item, then continues to checkout — the user
  // asked to check out and then asked to clear the blocker.
  const handleRemoveOutOfStockItems = async () => {
    const removableIds = outOfStockItems.map((item) => item.id);
    try {
      const results = await Promise.all(
        removableIds.map((cartItemId) =>
          user
            ? fetchWithCreds({
                accessToken,
                path: '/api/cart',
                method: 'DELETE',
                body: { id: cartItemId },
              })
            : fetchWithoutCreds('/api/guest/cart', 'DELETE', {
                id: cartItemId,
              }),
        ),
      );

      const removed = new Set(
        removableIds.filter((_, index) => results[index]?.success),
      );

      if (removed.size > 0) {
        setCartItems((prev) => prev.filter((item) => !removed.has(item.id)));
      }

      if (removed.size < removableIds.length) {
        console.error('Failed to remove some out-of-stock cart items');
        return;
      }

      setShowOutOfStockDialog(false);
      router.push('/cart/checkout');
    } catch (error) {
      console.error('Error removing out-of-stock cart items:', error);
    }
  };

  if (isLoading) {
    return (
      <Layout handleHeaderBackButton={() => router.push('/')}>
        <Box className={cartIndexClasses.box[platform]}>
          <CartPageSkeleton count={4} />
        </Box>
      </Layout>
    );
  }

  return (
    <Layout handleHeaderBackButton={() => router.push('/')}>
      <Box className={cartIndexClasses.box[platform]}>
        <Breadcrumbs
          separator="|"
          maxItems={2}
          className={cartIndexClasses.breadcrumbs[platform]}
        >
          <Link href="/" className={cartIndexClasses.link}>
            <Typography
              className={`${interClassname.className} ${cartIndexClasses.breadcrumbsText} font-regular`}
            >
              {t('home')}
            </Typography>
          </Link>
          <Link href="/cart" className={cartIndexClasses.link}>
            <Typography
              className={`${interClassname.className} ${cartIndexClasses.breadcrumbsText} font-bold`}
            >
              {t('cart')}
            </Typography>
          </Link>
        </Breadcrumbs>
        <Box className={cartIndexClasses.prodCart[platform]}>
          {cartItems != null && cartItems.length > 0 ? (
            <Box className="flex flex-col">
              <Box className={cartIndexClasses.cartHeader[platform]}>
                <Typography
                  className={`${interClassname.className} ${cartIndexClasses.yourCartTypo[platform]}`}
                >
                  {t('cart')}
                </Typography>
                <CheckoutSummary
                  totalPrice={totalPrice}
                  onCheckoutClick={handleCheckoutClick}
                />
              </Box>
              <Box className={cartIndexClasses.infoRow[platform]}>
                <Typography
                  className={`${interClassname.className} ${cartIndexClasses.infoRowTypo} w-[38vw] ml-[3vw]`}
                >
                  {t('product').toUpperCase()}
                </Typography>
                <Typography
                  className={`${interClassname.className} ${cartIndexClasses.infoRowTypo} w-[14vw]`}
                >
                  {t('price').toUpperCase()}
                </Typography>
                <Typography
                  className={`${interClassname.className} ${cartIndexClasses.infoRowTypo} w-[14vw]`}
                >
                  {t('quantity').toUpperCase()}
                </Typography>
                <Typography
                  className={`${interClassname.className} ${cartIndexClasses.infoRowTypo} w-[14vw]`}
                >
                  {t('total').toUpperCase()}
                </Typography>
              </Box>
              <Suspense fallback={<CircularProgress />}>
                {cartItems.map((cartItem) => (
                  <CartProductCard
                    product={cartItem?.product}
                    key={cartItem?.id}
                    selectedVariant={cartItem?.selectedVariant}
                    colorsMap={colorsMap}
                    cartProps={{
                      cartAction: 'delete',
                      quantity: cartItem?.quantity,
                      cartItemId: cartItem?.id,
                      onDelete,
                      setTotalPrice,
                    }}
                  />
                ))}
              </Suspense>
            </Box>
          ) : (
            <Box className="w-full flex flex-col items-center">
              <CardMedia
                component="img"
                src="/cart/empty/emptyCart.png"
                className={cartIndexClasses.emptyCart.img[platform]}
              />
              <Typography
                className={`${interClassname.className} ${cartIndexClasses.emptyCart.typo[platform]}`}
              >
                {t('emptyCart')}
              </Typography>
              <Link
                href="/"
                className={cartIndexClasses.emptyCart.link[platform]}
              >
                <IconButton
                  disableRipple
                  className={`${cartIndexClasses.iconButton[platform]} ${interClassname.className}`}
                >
                  {t('continueShopping')}
                </IconButton>
              </Link>
            </Box>
          )}
        </Box>
      </Box>
      {showOutOfStockDialog && (
        <OutOfStockDialog
          items={outOfStockItems.map((item) => ({
            id: item.id,
            name: item.product.name,
          }))}
          onClose={() => setShowOutOfStockDialog(false)}
          onRemove={handleRemoveOutOfStockItems}
        />
      )}
    </Layout>
  );
}
