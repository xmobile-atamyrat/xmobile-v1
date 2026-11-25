import FavoriteButton from '@/pages/components/FavoriteButton';
import OtherModelSaleBadge from '@/pages/components/sale/OtherModelSaleBadge';
import SaleBadge from '@/pages/components/sale/SaleBadge';
import SalePrice from '@/pages/components/sale/SalePrice';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import {
  PRODUCT_IMAGE_FALLBACK,
  productThumbnailUrl,
} from '@/pages/lib/mediaUrls';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import { useStalePrices } from '@/pages/lib/StalePricesContext';
import { quickAddTagOf } from '@/pages/lib/saleVariant';
import { AddToCartProps, ExtendedProduct } from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { parseName } from '@/pages/lib/utils';
import {
  computeProductPrice,
  resolveVariantDisplay,
} from '@/pages/product/utils';
import { productCardClasses } from '@/styles/classMaps/components/productCard';
import { saleClasses } from '@/styles/classMaps/components/sale';
import { fontClassName } from '@/styles/theme';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import {
  Box,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Divider,
  IconButton,
  Typography,
} from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';

// next/dynamic (not React.lazy) so the chunk suspends inside its own boundary.
// A bare lazy() here has no ancestor <Suspense>, and this card now renders
// underneath the _app splash overlay, so a cold chunk load crashes hydration
// and the splash never dismisses.
const AddToCart = dynamic(() => import('@/pages/components/AddToCart'), {
  loading: () => <CircularProgress />,
});

interface ProductCardProps {
  product?: ExtendedProduct;
  handleClickAddProduct?: () => void;
  cartProps?: AddToCartProps;
  onFavoriteRemove?: () => void;
}

export default function ProductCard({
  product: initialProduct,
  handleClickAddProduct,
  cartProps,
  onFavoriteRemove,
}: ProductCardProps) {
  const t = useTranslations();
  const router = useRouter();
  const { setSelectedProduct, colorsMap } = useProductContext();
  const [product, setProduct] = useState(initialProduct);
  const { accessToken } = useUserContext();
  const fetchWithCreds = useFetchWithCreds();
  const platform = usePlatform();
  const { staleByProductId } = useStalePrices();

  const cardImageSrc = productThumbnailUrl(product?.imgUrls[0]);

  // Quick-add from the grid can't ask which spec/color to buy, so it takes the
  // variant priced like the card (the base price), else the first tag. Read from
  // initialProduct: resolving the price drops the "[id]" part.
  const defaultVariant = useMemo(() => {
    const raw = quickAddTagOf(product?.tags, initialProduct?.price);
    if (raw == null) return undefined;
    const { spec, colorName } = resolveVariantDisplay(raw, colorsMap);
    return { raw, label: [spec, colorName].filter(Boolean).join(', ') };
  }, [product?.tags, initialProduct?.price, colorsMap]);

  useEffect(() => {
    if (initialProduct == null) return () => {};
    // A sold-out card shows no price, so there is nothing to look up.
    if (initialProduct.outOfStockAt != null) {
      setProduct(initialProduct);
      return () => {};
    }

    let cancelled = false;
    (async () => {
      const priced = await computeProductPrice({
        product: initialProduct,
        accessToken,
        fetchWithCreds,
      });
      if (!cancelled) setProduct(priced);
    })();
    return () => {
      cancelled = true;
    };
  }, [initialProduct]);

  // Sold-out cards show nothing about sales.
  const sale = product?.outOfStockAt == null ? product?.sale : null;

  let saleBadge = null;
  if (sale?.base != null) {
    saleBadge = <SaleBadge percent={sale.base.percent} size={platform} />;
  } else if (sale != null) {
    saleBadge = (
      <OtherModelSaleBadge percent={sale.bestPercent} platform={platform} />
    );
  }

  // Out-of-stock products show no price; the badge on the image carries the
  // state instead.
  let priceNode = null;
  if (product != null && product.outOfStockAt == null) {
    if (product.price?.includes('[')) {
      priceNode = (
        <CircularProgress
          className={productCardClasses.circProgress[platform]}
        />
      );
    } else if (sale?.base != null) {
      priceNode = (
        <Box className={productCardClasses.salePrice[platform]}>
          <SalePrice
            price={product.price}
            oldPrice={sale.base.oldPrice}
            size={platform === 'web' ? 'cardWeb' : 'cardMobile'}
          />
        </Box>
      );
    } else {
      priceNode = (
        <Typography
          className={`${fontClassName.className} ${productCardClasses.typo2[platform]}`}
        >
          {product.price}
          <span className={productCardClasses.priceUnit[platform]}>
            {t('manat')}
          </span>
        </Typography>
      );
    }
  }

  const quickAdd =
    product != null &&
    cartProps.cartAction === 'add' &&
    product.outOfStockAt == null ? (
      // Rendered outside the card's anchors, but keep the click contained so a
      // future wrapper can't turn "add to cart" into a navigation.
      <Box onClick={(e) => e.stopPropagation()}>
        <AddToCart
          productId={product.id}
          cartAction="add"
          price={product.price}
          selectedVariant={defaultVariant?.raw}
          variantLabel={defaultVariant?.label}
          setTotalPrice={() => undefined}
        />
      </Box>
    ) : null;

  // Staff only: the list is empty for everyone else. A sold-out product sells
  // at no price, so it carries the out-of-stock badge instead.
  const stale =
    product != null && product.outOfStockAt == null
      ? staleByProductId[product.id]
      : undefined;
  const staleHint =
    stale == null
      ? undefined
      : `${t(stale.tier === 'red' ? 'staleRedHint' : 'staleOrangeHint')}: ${t('daysShort', { days: stale.days })}`;

  return (
    <Card
      className={`${productCardClasses.card[platform]}${stale != null ? ` ${productCardClasses.staleRing[stale.tier]}` : ''}`}
      elevation={0}
    >
      {product != null ? (
        <Box className={productCardClasses.boxes.main}>
          {/* Image and title are separate anchors so the product name is still
              crawlable link text. The quick-add button must stay OUTSIDE any
              anchor: a <button> inside an <a> is invalid HTML and breaks
              hydration, which leaves the _app splash overlay stuck. */}
          <Link
            href={`/product/${product.slug}`}
            onClick={() => setSelectedProduct(initialProduct)}
            className="block text-inherit no-underline"
          >
            {cardImageSrc != null && (
              <Box className={productCardClasses.boxes.img[platform]}>
                <CardMedia
                  component="img"
                  image={cardImageSrc}
                  alt={product?.name}
                  className={`${productCardClasses.cardMedia[platform]} transition-all duration-200${product.outOfStockAt != null ? ' grayscale opacity-60' : ''}`}
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    const el = e.currentTarget;
                    el.onerror = null;
                    el.src = PRODUCT_IMAGE_FALLBACK;
                  }}
                />
                {product.outOfStockAt != null && (
                  <Box
                    className={`absolute top-2 left-2 bg-white/90 border border-[#ECECF1] rounded-full ${platform === 'web' ? 'px-2.5 py-0.5' : 'px-1.5 py-0'}`}
                  >
                    <Typography
                      className={`font-semibold text-[#8B8A98] uppercase tracking-wider ${platform === 'web' ? 'text-[11px]' : 'text-[9px]'}`}
                    >
                      {t('outOfStock')}
                    </Typography>
                  </Box>
                )}
                {stale != null && (
                  <Box
                    role="img"
                    aria-label={staleHint}
                    title={staleHint}
                    data-testid="stale-price-badge"
                    className={`${productCardClasses.staleBadge.base[platform]} ${productCardClasses.staleBadge[stale.tier]}`}
                  >
                    <WarningAmberRoundedIcon
                      className={productCardClasses.staleBadge.icon[platform]}
                    />
                    {t('daysShort', { days: stale.days })}
                  </Box>
                )}
                {saleBadge != null && (
                  <Box
                    className={`${saleClasses.cardBadge.base} ${stale == null ? saleClasses.cardBadge.top : saleClasses.cardBadge.belowStale[platform]}`}
                  >
                    {saleBadge}
                  </Box>
                )}
              </Box>
            )}
          </Link>
          {cartProps.cartAction !== 'delete' && (
            <FavoriteButton
              productId={product.id}
              variant="card"
              onRemove={onFavoriteRemove}
            />
          )}
          <Box className={productCardClasses.boxes.detail[platform]}>
            {/* With no image box to sit on, the badge leads the details. */}
            {cardImageSrc == null && saleBadge != null && (
              <Box className="flex mb-1">{saleBadge}</Box>
            )}
            {product.brand?.name != null && (
              <Typography
                className={`${fontClassName.className} ${productCardClasses.brand[platform]}`}
              >
                {product.brand.name}
              </Typography>
            )}
            <Link
              href={`/product/${product.slug}`}
              onClick={() => setSelectedProduct(initialProduct)}
              className="text-inherit no-underline"
            >
              <Typography
                className={`${fontClassName.className} ${productCardClasses.typo[platform]}`}
              >
                {parseName(product.name, router.locale ?? 'tk')}
              </Typography>
            </Link>
            {platform === 'web' ? (
              // price left, compact quick-add circle right (design's card has
              // no full-width CTA — the icon carries the action)
              <Box className={productCardClasses.footerRow}>
                {priceNode}
                {quickAdd}
              </Box>
            ) : (
              priceNode
            )}
          </Box>
          {cartProps.cartAction === 'delete' &&
            product.outOfStockAt == null && (
              <Box>
                <AddToCart
                  productId={product.id}
                  cartAction={cartProps?.cartAction}
                  quantity={cartProps?.quantity}
                  cartItemId={cartProps?.cartItemId}
                  onDelete={cartProps?.onDelete}
                  setTotalPrice={() => undefined}
                />
              </Box>
            )}
        </Box>
      ) : (
        <Box className="w-full h-full flex flex-col justify-between">
          <CardContent className="p-1">
            <Typography
              gutterBottom
              className={productCardClasses.typo3[platform]}
            >
              {t('addNewProduct')}
            </Typography>
          </CardContent>
          <Box>
            <Divider />
            <CardActions className={productCardClasses.cardActions}>
              <IconButton
                onClick={() => {
                  if (handleClickAddProduct) handleClickAddProduct();
                }}
              >
                <AddCircleIcon fontSize="large" color="primary" />
              </IconButton>
            </CardActions>
          </Box>
        </Box>
      )}
    </Card>
  );
}
