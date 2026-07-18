import BASE_URL from '@/lib/ApiEndpoints';
import AddEditProductDialog from '@/pages/components/AddEditProductDialog';
import DeleteDialog from '@/pages/components/DeleteDialog';
import Layout from '@/pages/components/Layout';
import ProductImageGallery from '@/pages/components/ProductImageGallery';
import SimpleBreadcrumbs from '@/pages/components/SimpleBreadcrumbs';
import { ProductDetailSkeleton } from '@/pages/components/SkeletonLoader';
import TikTokIcon from '@/pages/components/TikTokIcon';
import {
  fetchAllProductSlugs,
  fetchColors,
  fetchProducts,
} from '@/pages/lib/apis';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { buildCategoryPath } from '@/pages/lib/categoryPathUtils';
import {
  curlyBracketRegex,
  LOCALE_TO_OG_LOCALE,
  mobileBottomNavHeight,
  squareBracketRegex,
} from '@/pages/lib/constants';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import {
  getAbsoluteProductMediaUrl,
  getProductMediaUrl,
  PRODUCT_IMAGE_FALLBACK,
  tierForProductList,
} from '@/pages/lib/mediaUrls';
import { useNetworkContext } from '@/pages/lib/NetworkContext';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { usePrevProductContext } from '@/pages/lib/PrevProductContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import {
  generateBreadcrumbJsonLd,
  generateHreflangLinks,
  generateProductJsonLd,
  generateProductMetaDescription,
  generateProductTitle,
  getCanonicalUrl,
} from '@/pages/lib/seo';
import { expandDynamicPathsForAllLocales } from '@/pages/lib/ssgLocales';
import {
  AddEditProductProps,
  ExtendedCategory,
  ExtendedProduct,
  ResponseApi,
  SnackbarProps,
} from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { isUUID, parseName } from '@/pages/lib/utils';
import {
  computePrice,
  computeProductPriceTags,
  parseVariantTag,
} from '@/pages/product/utils';
import { detailPageClasses } from '@/styles/classMaps/product/detail';
import { fontClassName, hairline, muted, navy } from '@/styles/theme';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import InstagramIcon from '@mui/icons-material/Instagram';
import YouTubeIcon from '@mui/icons-material/YouTube';
import {
  Alert,
  Box,
  CardMedia,
  Dialog,
  Divider,
  IconButton,
  Snackbar,
  Typography,
} from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import type { Color, Product } from '@prisma/client';
import { ArrowLeft } from 'lucide-react';
import { GetStaticPaths, GetStaticProps } from 'next';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { lazy, useEffect, useMemo, useState } from 'react';
import 'slick-carousel/slick/slick-theme.css';
import 'slick-carousel/slick/slick.css';

const AddToCart = lazy(() => import('@/pages/components/AddToCart'));

// getStaticPaths for dynamic routes
export const getStaticPaths: GetStaticPaths = async (context) => {
  try {
    const slugs = await fetchAllProductSlugs();
    const paths = expandDynamicPathsForAllLocales(context, slugs);

    return {
      paths,
      fallback: 'blocking',
    };
  } catch (error) {
    console.error('Error fetching product slugs for static generation:', error);
    return {
      paths: [],
      fallback: 'blocking',
    };
  }
};

// getStaticProps for static generation
export const getStaticProps: GetStaticProps = async ({
  params,
  locale = 'tk',
}) => {
  const productSlug = params?.slug as string;

  try {
    // If the slug is actually a legacy fixed UUID, redirect to the friendly slug
    if (isUUID(productSlug)) {
      const productsById = await fetchProducts({ productId: productSlug });
      const productById =
        productsById && productsById.length > 0 ? productsById[0] : null;

      if (productById && productById.slug) {
        return {
          redirect: {
            destination: `/${locale}/product/${productById.slug}`,
            permanent: true,
          },
        };
      }
    }

    // Fetch the specific product at build time
    const products = await fetchProducts({ productSlug });
    const product = products && products.length > 0 ? products[0] : null;

    if (!product) {
      return { notFound: true, revalidate: 300 };
    }

    // Load messages first so they can be used for SEO generation
    let messages = null;
    try {
      messages = (await import(`../../i18n/${locale}.json`)).default;
    } catch (messageError) {
      console.error(
        `Error loading messages for locale ${locale}:`,
        messageError,
      );
    }

    let categoryPath: ExtendedCategory[] = [];
    let seoData = null;

    try {
      const categoriesRes = await fetch(`${BASE_URL}/api/category`);
      const { success, data: allCategories }: ResponseApi<ExtendedCategory[]> =
        await categoriesRes.json();

      if (success && allCategories && product.categoryId) {
        categoryPath = buildCategoryPath(product.categoryId, allCategories);
      }

      const productName = parseName(product.name, locale);

      let priceValue = product.price;
      const priceMatch = product.price?.match(curlyBracketRegex);
      if (priceMatch) {
        priceValue = priceMatch[1];
      }
      priceValue = priceValue?.replace(/[^\d.]/g, '');

      const productPath = `product/${product.slug}`;

      const title = generateProductTitle(productName, product.brand?.name);
      const metaDescription = generateProductMetaDescription(
        messages?.productDetailsMetaDescription || '',
        productName,
        priceValue,
      );
      const canonicalUrl = getCanonicalUrl(locale, productPath);
      const hreflangLinks = generateHreflangLinks(productPath);

      // Generate absolute image URLs for og:image and JSON-LD
      const rawImages = product.imgUrls || [];
      const imageUrls = rawImages.map((img) => {
        if (img.startsWith('http')) return img;
        return (
          getAbsoluteProductMediaUrl(BASE_URL, 'good', img) ??
          `${BASE_URL}/api/localImage?imgUrl=${encodeURIComponent(img)}`
        );
      });

      const productJsonLd = generateProductJsonLd({
        productName,
        productUrl: canonicalUrl,
        price: priceValue,
        imageUrls,
        description: parseName(product.description ?? '{}', locale),
        brandName: product.brand?.name,
      });

      const breadcrumbJsonLd = generateBreadcrumbJsonLd(
        categoryPath,
        productName,
        locale,
        messages?.home as string,
      );

      seoData = {
        title,
        description: metaDescription,
        canonicalUrl,
        hreflangLinks,
        ogLocale:
          LOCALE_TO_OG_LOCALE[locale as keyof typeof LOCALE_TO_OG_LOCALE] ||
          'ru_RU',
        ogType: 'product',
        ogImage: imageUrls[0] || null,
        productJsonLd,
        breadcrumbJsonLd,
      };
    } catch (seoError) {
      console.error('Error generating SEO data:', seoError);
    }

    return {
      props: {
        product,
        seoData,
        messages,
      },
      revalidate: 300, // regenerate static pages every 5 minutes
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '';
    if (msg === "Couldn't find the product") {
      console.warn(`Product not found during build/SSR: ${productSlug}`);
    } else {
      console.error('Error fetching product during build:', error);
    }
    return { notFound: true, revalidate: 300 };
  }
};

interface ProductPageProps {
  product: Product;
}

export default function Product({ product: initialProduct }: ProductPageProps) {
  const [product, setProduct] = useState<Product | null>();
  const router = useRouter();
  const t = useTranslations();
  const { user, accessToken } = useUserContext();
  const { setPrevCategory, setPrevProducts } = usePrevProductContext();
  const [showDeleteProductDialog, setShowDeleteProductDialog] = useState<{
    show: boolean;
    productId: string;
  }>();
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<SnackbarProps>();
  const { setProducts } = useProductContext();
  const { categories: allCategories, selectedCategoryId } =
    useCategoryContext();
  const [addEditProductDialog, setAddEditProductDialog] =
    useState<AddEditProductProps>({ open: false, imageUrls: [] });
  const [description, setDescription] = useState<{ [key: string]: string[] }>();
  const [categoryPath, setCategoryPath] = useState<ExtendedCategory[]>([]);
  const { network } = useNetworkContext();

  const displayImgUrls = useMemo(() => {
    if (!product?.imgUrls?.length) return [];
    const tier = tierForProductList(network);
    return product.imgUrls.map((u) =>
      u.startsWith('http') ? u : getProductMediaUrl(tier, u) ?? u,
    );
  }, [product?.imgUrls, network]);
  const fetchWithCreds = useFetchWithCreds();
  const platform = usePlatform();
  const [dialogStatus, setDialogStatus] = useState(false);
  const [carouselDialogImage, setCarouselDialogImage] = useState<string>('');

  // Selectable variants derived from the product's tags ("<spec> [priceId]{colorId}")
  const [variants, setVariants] = useState<
    {
      raw: string;
      specText: string;
      colorId?: string;
      priceTmt?: string;
    }[]
  >([]);
  // Selection is two-dimensional: a spec (e.g. "128GB 12GB RAM") and a color
  const [selectedSpec, setSelectedSpec] = useState<string>();
  const [selectedColorId, setSelectedColorId] = useState<string | undefined>();
  const [colorsMap, setColorsMap] = useState<Map<string, Color>>(new Map());

  useEffect(() => {
    (async () => {
      const cs = await fetchColors();
      setColorsMap(new Map(cs.map((c) => [c.id, c])));
    })();
  }, []);

  useEffect(() => {
    if (initialProduct == null) return;
    (async () => {
      const resolved = await Promise.all(
        (initialProduct.tags ?? []).map(async (raw) => {
          const { specText, priceId, colorId } = parseVariantTag(raw);
          const priceTmt = priceId
            ? await computePrice({ priceId, accessToken, fetchWithCreds })
            : undefined;
          return { raw, specText, colorId, priceTmt };
        }),
      );
      setVariants(resolved);
      setSelectedSpec(resolved[0]?.specText);
      setSelectedColorId(resolved[0]?.colorId);
    })();
    // accessToken intentionally omitted: prices are public
  }, [initialProduct]);

  // Distinct spec options (variant chips), in first-seen order
  const specOptions = useMemo(
    () => [...new Set(variants.map((v) => v.specText))],
    [variants],
  );
  // All distinct colors used by the product (color chips). Some may be
  // unavailable for the currently selected spec — those are shown disabled.
  const colorOptions = useMemo(
    () => [...new Set(variants.map((v) => v.colorId).filter(Boolean))],
    [variants],
  ) as string[];
  // Colors available for the selected spec
  const availableColorIds = useMemo(
    () =>
      new Set(
        variants
          .filter((v) => v.specText === selectedSpec)
          .map((v) => v.colorId)
          .filter(Boolean),
      ),
    [variants, selectedSpec],
  );

  const selectedVariant =
    variants.find(
      (v) => v.specText === selectedSpec && v.colorId === selectedColorId,
    ) ?? variants.find((v) => v.specText === selectedSpec);

  // Pick a valid color when switching spec
  const handleSelectSpec = (spec: string) => {
    setSelectedSpec(spec);
    const colorsForSpec = variants
      .filter((v) => v.specText === spec)
      .map((v) => v.colorId);
    if (!colorsForSpec.includes(selectedColorId)) {
      setSelectedColorId(colorsForSpec[0]);
    }
  };

  // Price shown / sent to cart: selected variant's price when variants exist,
  // otherwise the product's base resolved price.
  const displayPrice =
    variants.length > 0 ? selectedVariant?.priceTmt ?? '' : product?.price;

  // Brand name (real data — included by getStaticProps, not on the base type)
  const brandName = (product as ExtendedProduct | null)?.brand?.name;

  // Split description sections into short (spec cards) vs long (prose) using the
  // same >35-char heuristic as the web sidebar. Drives the mobile mockup layout.
  const { shortSpecKeys, longSpecKeys } = useMemo(() => {
    const shortK: string[] = [];
    const longK: string[] = [];
    Object.keys(description ?? {}).forEach((key) => {
      const lines = description?.[key];
      if (!lines || lines.length === 0) return;
      const isLong = lines.some((line) => line.length > 35);
      (isLong ? longK : shortK).push(key);
    });
    return { shortSpecKeys: shortK, longSpecKeys: longK };
  }, [description]);

  // Pill/chip styling per design: selected = navy border+text on #F7F6FC,
  // disabled = faint hairline, default = hairline border + muted text.
  const chipSx = (selected: boolean, disabled: boolean) => {
    let borderColor = hairline;
    let color = muted;
    let bg = 'transparent';
    if (disabled) {
      borderColor = '#F0EFF4';
      color = '#C4C3CE';
    } else if (selected) {
      borderColor = navy;
      color = navy;
      bg = '#F7F6FC';
    }
    return {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      px: 2,
      py: 1,
      borderRadius: '12px',
      border: '1.5px solid',
      borderColor,
      backgroundColor: bg,
      color,
      fontWeight: selected ? 700 : 600,
      fontSize: '14px',
      lineHeight: 1.2,
      cursor: disabled ? 'default' : 'pointer',
      userSelect: 'none' as const,
      transition: 'border-color 0.15s, color 0.15s, background-color 0.15s',
    };
  };

  const handleDialogClose = () => {
    setDialogStatus(false);
  };

  const handleDialogOpen = (index: number) => {
    if (!product?.imgUrls[index]) return;
    const raw = product.imgUrls[index];
    const full = raw.startsWith('http')
      ? raw
      : getProductMediaUrl('original', raw) ?? raw;
    setCarouselDialogImage(full);
    setDialogStatus(true);
  };

  // Build category path when categoryId is available
  useEffect(() => {
    if (!product?.categoryId || !allCategories || allCategories.length === 0) {
      setCategoryPath([]);
      return;
    }

    const path = buildCategoryPath(product.categoryId, allCategories);
    setCategoryPath(path);
  }, [product?.categoryId, allCategories]);

  useEffect(() => {
    const desc = parseName(product?.description ?? '{}', router.locale ?? 'tk');
    if (desc == null || desc === '') return;

    const paragraphs = desc.split(/\[(.*?)\]/).filter(Boolean);
    const result: { [key: string]: string } = {};

    for (let i = 0; i < paragraphs.length; i += 2) {
      if (i >= paragraphs.length || i + 1 >= paragraphs.length) break;
      const header = paragraphs[i].trim();
      const content = paragraphs[i + 1].trim();
      result[header] = content;
    }

    const descObj: { [key: string]: string[] } = {};
    Object.keys(result).forEach((key) => {
      descObj[key] = result[key].split('\n').filter(Boolean);
    });

    setDescription(descObj);
  }, [product?.description, router.locale]);

  useEffect(() => {
    // accessToken is intentionally left out as GET /api/prices and /api/prices/rate is public
    if (initialProduct == null) return;
    (async () => {
      setProduct(
        await computeProductPriceTags({
          fetchWithCreds,
          product: initialProduct,
          accessToken,
        }),
      );
    })();
    // No need to include accessToken as logged out users don't have a token
  }, [initialProduct]);

  return product ? (
    <Layout
      handleHeaderBackButton={() => {
        router.back();
      }}
    >
      <SimpleBreadcrumbs
        currentProductName={product.name}
        categoryPath={categoryPath}
      />
      <Box className={detailPageClasses.boxes.main[platform]}>
        {['SUPERUSER', 'ADMIN'].includes(user?.grade) && (
          <Box>
            <IconButton
              onClick={() => {
                if (initialProduct == null) return;
                setAddEditProductDialog({
                  open: true,
                  id: initialProduct.id,
                  description: initialProduct.description,
                  dialogType: 'edit',
                  imageUrls: initialProduct.imgUrls,
                  name: initialProduct.name,
                  price: (() => {
                    const priceMatch =
                      initialProduct.price?.match(squareBracketRegex);
                    if (priceMatch != null) {
                      return priceMatch[0]; // initialProduct.price = [id]{value}
                    }
                    return initialProduct.price;
                  })(),
                  tags: initialProduct.tags,
                  videoUrls: initialProduct.videoUrls,
                  brandId: initialProduct.brandId,
                  categoryId: initialProduct.categoryId,
                  isOutOfStock: initialProduct.isOutOfStock,
                });
              }}
            >
              <EditIcon color="primary" fontSize="medium" />
            </IconButton>
            <IconButton
              onClick={() => {
                setShowDeleteProductDialog({
                  show: true,
                  productId: product.id,
                });
              }}
            >
              <DeleteIcon color="error" fontSize="medium" />
            </IconButton>
          </Box>
        )}
        <IconButton
          aria-label="Back"
          className={detailPageClasses.backButton[platform]}
          onClick={() => router.back()}
        >
          <ArrowLeft className={detailPageClasses.backIcon[platform]} />
        </IconButton>
        {/* images */}
        <Box className={detailPageClasses.boxes.images[platform]}>
          {displayImgUrls.length > 0 && (
            <ProductImageGallery
              displayImgUrls={displayImgUrls}
              altText={product?.name ?? ''}
              onExpand={handleDialogOpen}
            />
          )}
          <Dialog open={dialogStatus} onClose={handleDialogClose}>
            <CardMedia
              component="img"
              image={carouselDialogImage}
              alt={product?.name}
              className={detailPageClasses.dialogImg[platform]}
              onError={(e) => {
                const el = e.currentTarget;
                el.onerror = null;
                el.src = PRODUCT_IMAGE_FALLBACK;
              }}
            />
          </Dialog>

          {product.videoUrls.some((videoUrl) => videoUrl.length !== 0) && (
            <Box className={detailPageClasses.boxes.video[platform]}>
              {product.videoUrls.map(
                (videoUrl, index) =>
                  videoUrl.length !== 0 && (
                    <Link
                      key={index}
                      target="_blank"
                      href={videoUrl}
                      className={detailPageClasses.link[platform]}
                    >
                      <IconButton>
                        {(() => {
                          if (index === 0) return <TikTokIcon />;
                          if (index === 1)
                            return <InstagramIcon className="text-black" />;
                          return <YouTubeIcon className="text-black" />;
                        })()}
                      </IconButton>
                    </Link>
                  ),
              )}
            </Box>
          )}
        </Box>

        {/* side details */}
        <Box className={detailPageClasses.boxes.sideInfo[platform]}>
          <Box className={detailPageClasses.boxes.info[platform]}>
            {platform === 'mobile' ? (
              <>
                {brandName && (
                  <Typography
                    className={`${fontClassName.className} text-[13px] font-semibold text-muted mb-2`}
                  >
                    {brandName}
                  </Typography>
                )}
                <Typography
                  variant="h5"
                  className={`${fontClassName.className} ${detailPageClasses.productName.mobile}`}
                >
                  {parseName(product?.name ?? '{}', router.locale ?? 'tk')}
                </Typography>
                <Box className="flex items-baseline gap-2 mt-[10px]">
                  {displayPrice == null || displayPrice?.includes('[') ? (
                    <CircularProgress
                      className={detailPageClasses.circProgress.mobile}
                    />
                  ) : (
                    <>
                      <Typography
                        className={`${fontClassName.className} text-[26px] font-bold text-navy leading-none`}
                      >
                        {displayPrice === '' || displayPrice.includes('null')
                          ? t('nullPrice')
                          : displayPrice}
                      </Typography>
                      {displayPrice !== '' &&
                        !displayPrice.includes('null') && (
                          <Typography
                            className={`${fontClassName.className} text-[13px] font-medium text-muted`}
                          >
                            {t('manat')}
                          </Typography>
                        )}
                    </>
                  )}
                </Box>
              </>
            ) : (
              <>
                <Box className={detailPageClasses.detail.name.web}>
                  <Typography
                    variant="h5"
                    className={`${fontClassName.className} ${detailPageClasses.productName.web}`}
                  >
                    {parseName(product?.name ?? '{}', router.locale ?? 'tk')}
                  </Typography>
                </Box>
                <Divider className={detailPageClasses.divider.web} />
                <Box className={detailPageClasses.price.web}>
                  {displayPrice == null || displayPrice?.includes('[') ? (
                    <CircularProgress
                      className={detailPageClasses.circProgress.web}
                    />
                  ) : (
                    <Typography
                      className={`${detailPageClasses.typographs.price.web} ${fontClassName.className}`}
                    >
                      {displayPrice === '' || displayPrice.includes('null')
                        ? t('nullPrice')
                        : `${displayPrice} ${t('manat')}`}
                    </Typography>
                  )}
                </Box>
              </>
            )}
          </Box>

          {specOptions.length > 0 && (
            <Box className="flex flex-col items-start gap-4 my-2 w-full">
              {/* Variant (spec) chips */}
              <Box>
                <Typography
                  className={`${fontClassName.className}`}
                  sx={{ fontWeight: 700, mb: 1.5, fontSize: '13px' }}
                >
                  {t('tags')}
                </Typography>
                <Box className="flex flex-col items-start gap-2">
                  {specOptions.map((spec) => (
                    <Box
                      key={spec}
                      onClick={() => handleSelectSpec(spec)}
                      className={fontClassName.className}
                      sx={chipSx(spec === selectedSpec, false)}
                    >
                      {spec}
                    </Box>
                  ))}
                </Box>
              </Box>

              {/* Colors of the selected variant */}
              {colorOptions.length > 0 && (
                <Box>
                  <Typography
                    className={`${fontClassName.className}`}
                    sx={{ fontWeight: 700, mb: 1.5, fontSize: '13px' }}
                  >
                    {t('color')}
                  </Typography>
                  <Box className="flex flex-col items-start gap-2">
                    {colorOptions.map((colorId) => {
                      const color = colorsMap.get(colorId);
                      const available = availableColorIds.has(colorId);
                      const isSel = colorId === selectedColorId && available;
                      return (
                        <Box
                          key={colorId}
                          onClick={() =>
                            available && setSelectedColorId(colorId)
                          }
                          className={fontClassName.className}
                          sx={chipSx(isSel, !available)}
                        >
                          {color?.hex && (
                            <Box
                              sx={{
                                width: 16,
                                height: 16,
                                borderRadius: '50%',
                                border: '1px solid rgba(0,0,0,0.15)',
                                backgroundColor: color.hex,
                                flexShrink: 0,
                                opacity: available ? 1 : 0.4,
                              }}
                            />
                          )}
                          {color?.name ?? colorId}
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              )}
            </Box>
          )}

          {description && Object.keys(description).length > 0 && (
            <Box className={detailPageClasses.boxes.detailSide[platform]}>
              {Object.keys(description ?? {})
                .filter((key) => {
                  const line = description[key];
                  if (!line || line.length === 0) return false;
                  const long = line.some((descLine) => descLine.length > 35);
                  return !long;
                })
                .slice(0, 3)
                .map((key) => (
                  <Box key={key} className={detailPageClasses.detailSide.part}>
                    <Box className={detailPageClasses.detailSide.head}>
                      <Typography
                        className={`${detailPageClasses.detailSide.desc} ${fontClassName.className}`}
                      >
                        {key}
                      </Typography>
                    </Box>
                    <Box className={detailPageClasses.detailSide.val}>
                      {description[key].map((descLine, index) => (
                        <Typography
                          key={index}
                          className={`${detailPageClasses.detailSide.font2} ${fontClassName.className}`}
                        >
                          {descLine}
                        </Typography>
                      ))}
                    </Box>
                  </Box>
                ))}
            </Box>
          )}
          {platform === 'web' &&
            (product.isOutOfStock ? (
              <Box className="mt-[2vw]">
                <Box className="max-w-[20vw] h-[3.5vw] bg-fill rounded-[10px] py-[16px] px-[2vw] flex items-center justify-center">
                  <Typography
                    className={`${fontClassName.className} font-[700] text-[1vw] leading-[30px] tracking-widest text-muted uppercase whitespace-nowrap`}
                  >
                    {t('outOfStock')}
                  </Typography>
                </Box>
              </Box>
            ) : (
              <AddToCart
                productId={product.id}
                cartAction="detail"
                price={displayPrice ?? product.price}
                selectedVariant={selectedVariant?.raw}
              />
            ))}
        </Box>
      </Box>
      {description &&
        Object.keys(description).length > 0 &&
        (platform === 'mobile' ? (
          <Box className="w-full px-4 mt-4 mb-[120px]">
            {shortSpecKeys.length > 0 && (
              <>
                <Typography
                  className={`${fontClassName.className} text-[13px] font-bold text-ink mb-3`}
                >
                  {t('specification')}
                </Typography>
                <Box className="grid grid-cols-2 gap-[10px] mb-6">
                  {shortSpecKeys.map((key) => (
                    <Box
                      key={key}
                      className="bg-fill rounded-[12px] px-[14px] py-[12px]"
                    >
                      <Typography
                        className={`${fontClassName.className} text-[11px] text-muted mb-[3px]`}
                      >
                        {key}
                      </Typography>
                      <Typography
                        className={`${fontClassName.className} text-[13px] font-semibold text-ink leading-snug`}
                      >
                        {description[key].join(' · ')}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </>
            )}
            {longSpecKeys.map((key) => (
              <Box key={key} className="mb-5">
                <Typography
                  className={`${fontClassName.className} text-[13px] font-bold text-ink mb-2`}
                >
                  {key}
                </Typography>
                {description[key].map((descLine, index) => (
                  <Typography
                    key={index}
                    className={`${fontClassName.className} text-[14px] leading-[1.6] text-[#4A4959] mb-1`}
                  >
                    {descLine}
                  </Typography>
                ))}
              </Box>
            ))}
          </Box>
        ) : (
          <Box className={detailPageClasses.boxes.detail[platform]}>
            <Typography
              className={`${fontClassName.className} ${detailPageClasses.specs[platform]}`}
            >
              {t('specification')}
            </Typography>
            <Box className={detailPageClasses.detail.specs[platform]}>
              {Object.keys(description ?? {})
                .filter(
                  (key) =>
                    description[key] != null && description[key].length > 0,
                )
                .map((key) => (
                  <Box
                    key={key}
                    className={detailPageClasses.detail.part[platform]}
                  >
                    <Box className={detailPageClasses.detail.head[platform]}>
                      <Typography
                        className={`${detailPageClasses.typographs.desc[platform]} ${fontClassName.className}`}
                      >
                        {key}
                      </Typography>
                    </Box>
                    <Box className={detailPageClasses.detail.val[platform]}>
                      {description[key].map((descLine, index) => (
                        <Typography
                          key={index}
                          className={`${detailPageClasses.typographs.font2[platform]} ${fontClassName.className}`}
                        >
                          {descLine}
                        </Typography>
                      ))}
                    </Box>
                  </Box>
                ))}
            </Box>
          </Box>
        ))}
      {platform === 'mobile' &&
        (product.isOutOfStock ? (
          <Box className="w-full fixed bottom-0 left-0 right-0 z-10">
            <Box
              className="bg-white rounded-t-[24px] px-4 pt-3 shadow-[0px_-6px_20px_0px_rgba(20,16,60,0.06)] flex items-center justify-center"
              sx={{ paddingBottom: `${mobileBottomNavHeight}px` }}
            >
              <Box className="w-full bg-fill h-[clamp(44px,_11.2vw,_52px)] rounded-[15px] px-[10px] flex items-center justify-center">
                <Typography
                  className={`${fontClassName.className} font-[600] text-[clamp(2vw,_3.5vw,_16px)] leading-[100%] tracking-widest text-muted uppercase whitespace-nowrap`}
                >
                  {t('outOfStock')}
                </Typography>
              </Box>
            </Box>
          </Box>
        ) : (
          <AddToCart
            productId={product.id}
            cartAction="detail"
            price={displayPrice ?? product.price}
            selectedVariant={selectedVariant?.raw}
          />
        ))}
      {showDeleteProductDialog?.show && (
        <DeleteDialog
          title={t('deleteProduct')}
          description={t('confirmDeleteProduct')}
          blueButtonText={t('cancel')}
          redButtonText={t('delete')}
          handleDelete={async () => {
            try {
              const {
                success: deleteSuccess,
                message: deleteMessage,
              }: ResponseApi = await (
                await fetch(
                  `${BASE_URL}/api/product?productId=${showDeleteProductDialog.productId}`,
                  {
                    method: 'DELETE',
                  },
                )
              ).json();
              if (!deleteSuccess) {
                setSnackbarOpen(true);
                setSnackbarMessage({
                  message:
                    deleteMessage === 'productHasActiveBanner'
                      ? deleteMessage
                      : 'deleteProductError',
                  severity: 'error',
                });
                return;
              }
              const refreshCategoryId =
                product.categoryId ?? selectedCategoryId ?? undefined;
              if (refreshCategoryId != null) {
                const prods = await fetchProducts({
                  categoryIds: [refreshCategoryId],
                });
                setProducts(prods);
                setPrevCategory(refreshCategoryId);
                setPrevProducts(prods);
              }

              setSnackbarOpen(true);
              setSnackbarMessage({
                message: 'deleteProductSuccess',
                severity: 'success',
              });
              setTimeout(() => {
                router.push('/');
              }, 2000);
            } catch (error) {
              console.error(error);
              setSnackbarOpen(true);
              setSnackbarMessage({
                message: t('deleteProductError'),
                severity: 'error',
              });
            } finally {
              setShowDeleteProductDialog({ show: false, productId: '' });
            }
          }}
          handleClose={() =>
            setShowDeleteProductDialog({ show: false, productId: '' })
          }
        />
      )}
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
          className="w-full"
        >
          {snackbarMessage?.message && t(snackbarMessage.message)}
        </Alert>
      </Snackbar>
      {addEditProductDialog.open && (
        <AddEditProductDialog
          args={addEditProductDialog}
          setProduct={setProduct}
          handleClose={() =>
            setAddEditProductDialog({
              open: false,
              id: undefined,
              description: undefined,
              dialogType: undefined,
              imageUrls: [],
              name: undefined,
            })
          }
          snackbarErrorHandler={(message: string) => {
            setSnackbarOpen(true);
            setSnackbarMessage({
              message,
              severity: 'error',
            });
          }}
        />
      )}
    </Layout>
  ) : (
    <Layout
      handleHeaderBackButton={() => {
        router.push('/');
      }}
    >
      <ProductDetailSkeleton />
    </Layout>
  );
}
