import BASE_URL from '@/lib/ApiEndpoints';
import AddEditProductDialog from '@/pages/components/AddEditProductDialog';
import Carousel from '@/pages/components/Carousel';
import DeleteDialog from '@/pages/components/DeleteDialog';
import Layout from '@/pages/components/Layout';
import SimpleBreadcrumbs from '@/pages/components/SimpleBreadcrumbs';
import TikTokIcon from '@/pages/components/TikTokIcon';
import { useAbortControllerContext } from '@/pages/lib/AbortControllerContext';
import { fetchProducts } from '@/pages/lib/apis';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { buildCategoryPath } from '@/pages/lib/categoryPathUtils';
import { curlyBracketRegex, squareBracketRegex } from '@/pages/lib/constants';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { useNetworkContext } from '@/pages/lib/NetworkContext';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { usePrevProductContext } from '@/pages/lib/PrevProductContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import {
  AddEditProductProps,
  ExtendedCategory,
  ResponseApi,
  SnackbarProps,
} from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { parseName } from '@/pages/lib/utils';
import {
  computeProductPriceTags,
  computeVariantColor,
  extractColorIdFromTag,
  parseTagParts,
} from '@/pages/product/utils';
import { appbarClasses } from '@/styles/classMaps/components/appbar';
import { productIndexPageClasses } from '@/styles/classMaps/product';
import { detailPageClasses } from '@/styles/classMaps/product/detail';
import { colors, interClassname } from '@/styles/theme';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import InstagramIcon from '@mui/icons-material/Instagram';
import YouTubeIcon from '@mui/icons-material/YouTube';
import {
  Alert,
  Box,
  Button,
  CardMedia,
  Dialog,
  Divider,
  IconButton,
  Snackbar,
  Typography,
} from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import type { Colors, Product } from '@prisma/client';
import { GetStaticPaths, GetStaticProps } from 'next';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { lazy, useEffect, useMemo, useState } from 'react';
import 'slick-carousel/slick/slick-theme.css';
import 'slick-carousel/slick/slick.css';

const AddToCart = lazy(() => import('@/pages/components/AddToCart'));

// getStaticPaths for dynamic routes
export const getStaticPaths: GetStaticPaths = async () => {
  try {
    // Fetch all products to generate static pages at build time
    const products = await fetchProducts({});

    // Generate paths for all products
    const paths =
      products?.map((product) => ({
        params: { id: product.id },
      })) || [];

    return {
      paths,
      fallback: 'blocking', // Use blocking fallback for better error handling
    };
  } catch (error) {
    console.error('Error fetching products for static generation:', error);
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
  const productId = params?.id as string;

  try {
    // Fetch the specific product at build time
    const products = await fetchProducts({ productId });
    const product = products && products.length > 0 ? products[0] : null;

    // Load messages with fallback
    let messages;
    try {
      messages = (await import(`../../i18n/${locale}.json`)).default;
    } catch (messageError) {
      console.error(
        `Error loading messages for locale ${locale}:`,
        messageError,
      );
    }

    return {
      props: {
        product,
        messages,
      },
      revalidate: 300, // regenerate static pages every 5 minutes
    };
  } catch (error) {
    console.error('Error fetching product during build:', error);
    return {
      props: {
        product: null,
        messages: null,
      },
      revalidate: 300, // regenerate static pages every 5 minutes
    };
  }
};

interface ProductPageProps {
  product?: Product | null;
}

export default function Product({ product: initialProduct }: ProductPageProps) {
  const [product, setProduct] = useState<Product | null>();
  const router = useRouter();
  const [imgUrls, setImgUrls] = useState<string[]>([]);
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
  const { createAbortController, clearAbortController } =
    useAbortControllerContext();
  const fetchWithCreds = useFetchWithCreds();
  const platform = usePlatform();
  const [dialogStatus, setDialogStatus] = useState(false);
  const [carouselDialogImage, setCarouselDialogImage] = useState<string>('');
  const [selectedTagIndex, setSelectedTagIndex] = useState(0);
  const [selectedColor, setSelectedColor] = useState<Colors | null>(null);
  const [availableColors, setAvailableColors] = useState<Colors[]>([]);

  useEffect(() => {
    if (!router.isReady || !product?.tags) return;

    const { v } = router.query;

    if (v != null) {
      const index = parseInt(v as string, 10);
      if (!Number.isNaN(index) && index >= 0 && index < product.tags.length) {
        setSelectedTagIndex(index);
        return;
      }
    }

    setSelectedTagIndex(0);
  }, [product?.id, router.isReady, router.query]);

  // Update URL when selectedTagIndex changes manually
  const updateVariantInUrl = (index: number) => {
    setSelectedTagIndex(index);
    router.replace(
      {
        pathname: router.pathname,
        query: { ...router.query, v: index },
      },
      undefined,
      { shallow: true },
    );
  };

  const handleDialogClose = () => {
    setDialogStatus(false);
  };

  const handleDialogOpen = (imgUrl: string) => {
    setDialogStatus(true);
    setCarouselDialogImage(imgUrl);
  };

  // Get categoryId from query params
  const categoryIdFromQuery =
    (router.query.categoryId as string) || product?.categoryId;

  // Build category path when categoryId is available
  useEffect(() => {
    if (!categoryIdFromQuery || !allCategories || allCategories.length === 0) {
      setCategoryPath([]);
      return;
    }

    const path = buildCategoryPath(categoryIdFromQuery, allCategories);
    setCategoryPath(path);
  }, [categoryIdFromQuery, allCategories]);

  // Check if user landed directly (no category context)
  useEffect(() => {
    if (product == null) {
      return;
    }
    const abortController = createAbortController();

    (async () => {
      try {
        const initImgUrls: string[] = await Promise.all(
          product.imgUrls.map(async (imgUrl) => {
            if (imgUrl.startsWith('http')) {
              return imgUrl;
            }
            const imgFetcher = fetch(
              `${BASE_URL}/api/localImage?imgUrl=${imgUrl}&network=${network}`,
              { signal: abortController.signal },
            );
            return URL.createObjectURL(await (await imgFetcher).blob());
          }),
        );
        setImgUrls(initImgUrls);
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error(error);
        }
      } finally {
        clearAbortController(abortController);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, network]);

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
      const computedProduct = await computeProductPriceTags({
        fetchWithCreds,
        product: initialProduct,
        accessToken,
      });
      setProduct(computedProduct);
    })();
    // No need to include accessToken as logged out users don't have a token
  }, [initialProduct]);

  const processedTags = useMemo(() => {
    if (!product?.tags) return [];
    return product.tags.map((tag, index) => {
      const colorId = extractColorIdFromTag(tag);
      let specName = '';
      let pricePart = '';
      const tmtIndex = tag.indexOf('TMT');

      if (tmtIndex !== -1) {
        const partBeforeTmt = tag.substring(0, tmtIndex).trim();
        const parts = partBeforeTmt.split(' ');

        if (parts.length > 1) {
          const priceVal = parts.pop();
          pricePart = `${priceVal} TMT`;
          specName = parts.join(' ').trim();
        } else {
          specName = partBeforeTmt;
          pricePart = 'TMT';
        }
      } else {
        const parsed = parseTagParts(tag);
        const nameP = parsed.namePart;
        specName = nameP.replace(curlyBracketRegex, '').trim();
        pricePart = parsed.pricePart;
      }

      specName = specName.replace(curlyBracketRegex, '').trim();

      return { index, originalTag: tag, specName, pricePart, colorId };
    });
  }, [product?.tags]);

  const uniqueSpecs = useMemo(() => {
    const specs = new Set<string>();
    const result: { specName: string; firstIndex: number }[] = [];
    processedTags.forEach((tag) => {
      if (!specs.has(tag.specName)) {
        specs.add(tag.specName);
        result.push({ specName: tag.specName, firstIndex: tag.index });
      }
    });
    return result;
  }, [processedTags]);

  const currentSpecName = useMemo(() => {
    if (!processedTags[selectedTagIndex]) return '';
    return processedTags[selectedTagIndex].specName;
  }, [processedTags, selectedTagIndex]);

  useEffect(() => {
    if (!product?.tags || !accessToken || !currentSpecName) return;

    const variantsForSpec = processedTags.filter(
      (tag) => tag.specName === currentSpecName,
    );

    const colorIds = new Set<string>();
    variantsForSpec.forEach((v) => {
      if (v.colorId) colorIds.add(v.colorId);
    });

    if (colorIds.size > 0) {
      (async () => {
        const productColors = await Promise.all(
          Array.from(colorIds).map((id) =>
            computeVariantColor({
              tag: `{${id}}`,
              accessToken,
              fetchWithCreds,
            }),
          ),
        );
        const validColors = productColors.filter(
          (color) => color !== null,
        ) as Colors[];
        setAvailableColors(validColors);

        const currentColorId = processedTags[selectedTagIndex]?.colorId;
        if (currentColorId) {
          const currentColor = validColors.find(
            (color) => color.id === currentColorId,
          );
          setSelectedColor(currentColor || null);
        } else {
          setSelectedColor(null);
        }
      })();
    } else {
      setAvailableColors([]);
      setSelectedColor(null);
    }
  }, [
    product?.tags,
    currentSpecName,
    accessToken,
    processedTags,
    selectedTagIndex,
  ]);

  return product ? (
    <Layout
      handleHeaderBackButton={() => {
        router.push(`/product?categoryId=${categoryIdFromQuery}`);
      }}
    >
      <SimpleBreadcrumbs
        currentProductName={product.name}
        categoryPath={categoryPath}
      />
      <Box className={productIndexPageClasses.boxes.appbar[platform]}>
        <Box className="w-1/6 flex justify-start">
          <IconButton
            size="medium"
            edge="start"
            color="inherit"
            className={appbarClasses.backButton[platform]}
            aria-label="open drawer"
            onClick={() => {
              if (categoryPath.length > 1) {
                // Navigate to the parent category page
                const parentCategory = categoryPath[categoryPath.length - 2];
                router.push(`/category/${parentCategory.id}`);
              } else {
                // If we're at the root category, go to home
                router.push('/');
              }
            }}
          >
            <ArrowBackIosIcon
              className={appbarClasses.arrowBackIos[platform]}
            />
          </IconButton>
        </Box>
      </Box>
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
        {/* images */}
        <Box className={detailPageClasses.boxes.images[platform]}>
          {imgUrls.length === 1 && (
            <Box className={detailPageClasses.boxes.img[platform]}>
              <CardMedia
                component="img"
                image={imgUrls[0]}
                alt={product?.name}
                className={detailPageClasses.cardMedia[platform]}
                onClick={() => handleDialogOpen(imgUrls[0])}
              />
            </Box>
          )}
          {imgUrls.length > 1 && (
            <Box className={detailPageClasses.boxes.img[platform]}>
              <Carousel>
                {imgUrls.map((imgUrl, index) => (
                  <CardMedia
                    component="img"
                    image={imgUrl}
                    alt={product?.name}
                    className={detailPageClasses.cardMedia[platform]}
                    key={index}
                    onClick={() => handleDialogOpen(imgUrl)}
                  />
                ))}
              </Carousel>
            </Box>
          )}
          <Dialog open={dialogStatus} onClose={handleDialogClose}>
            <CardMedia
              component="img"
              image={carouselDialogImage}
              alt={product?.name}
              className={detailPageClasses.dialogImg[platform]}
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
            <Box className={detailPageClasses.detail.name[platform]}>
              <Typography
                variant="h5"
                className={`${interClassname.className} ${detailPageClasses.productName[platform]}`}
              >
                {parseName(product?.name ?? '{}', router.locale ?? 'tk')}
              </Typography>
            </Box>
            <Divider className={detailPageClasses.divider[platform]} />
            <Box className={detailPageClasses.price[platform]}>
              {product.price?.includes('[') ? (
                <CircularProgress
                  className={detailPageClasses.circProgress[platform]}
                />
              ) : (
                <Typography
                  className={`${detailPageClasses.typographs.price[platform]} ${interClassname.className}`}
                >
                  {(() => {
                    if (processedTags[selectedTagIndex]) {
                      const { pricePart } = processedTags[selectedTagIndex];
                      if (!pricePart.startsWith(' ') && pricePart.length > 0) {
                        return pricePart.replace(curlyBracketRegex, '').trim();
                      }
                    }
                    const cleanPrice = product.price
                      ?.replace(curlyBracketRegex, '')
                      .trim();
                    return `${cleanPrice} ${t('manat')}`;
                  })()}
                </Typography>
              )}
            </Box>
          </Box>

          {product.tags[0]?.includes('[') ? (
            <CircularProgress
              className={detailPageClasses.circProgress[platform]}
            />
          ) : (
            <Box className="flex flex-wrap gap-2 my-2 mb-[20px] w-[80%]">
              {uniqueSpecs.map((spec, uniqueIndex) => {
                const isSelected = spec.specName === currentSpecName;

                return (
                  <Button
                    key={uniqueIndex}
                    variant={isSelected ? 'contained' : 'outlined'}
                    onClick={() => {
                      const currentColorId =
                        processedTags[selectedTagIndex]?.colorId;
                      const variantsForNewSpec = processedTags.filter(
                        (tag) => tag.specName === spec.specName,
                      );

                      let newIndex = variantsForNewSpec[0].index;

                      if (currentColorId) {
                        const sameColorVariant = variantsForNewSpec.find(
                          (variant) => variant.colorId === currentColorId,
                        );
                        if (sameColorVariant) {
                          newIndex = sameColorVariant.index;
                        }
                      }
                      updateVariantInUrl(newIndex);
                    }}
                    className={`${interClassname.className} capitalize`}
                    sx={{
                      borderColor: colors.mainWebMobile[platform],
                      color: isSelected
                        ? '#fff'
                        : colors.mainWebMobile[platform],
                      backgroundColor: isSelected
                        ? colors.mainWebMobile[platform]
                        : 'transparent',
                      '&:hover': {
                        backgroundColor: isSelected
                          ? colors.mainWebMobile[platform]
                          : 'rgba(0, 0, 0, 0.04)',
                        borderColor: colors.mainWebMobile[platform],
                      },
                    }}
                  >
                    {spec.specName}
                  </Button>
                );
              })}
            </Box>
          )}

          {availableColors.length > 0 && (
            <Box className="flex flex-col gap-2 my-2 mb-[20px] w-[80%]">
              <Typography
                className={`${interClassname.className}`}
                variant="body2"
                fontWeight={500}
              >
                {t('color') || 'Color'}:
              </Typography>
              <Box className="flex flex-wrap gap-2">
                {availableColors.map((color) => {
                  const isSelected = selectedColor?.id === color.id;
                  return (
                    <Box
                      key={color.id}
                      onClick={() => {
                        const variantWithColor = processedTags.find(
                          (tag) =>
                            tag.specName === currentSpecName &&
                            tag.colorId === color.id,
                        );

                        if (variantWithColor) {
                          updateVariantInUrl(variantWithColor.index);
                        }
                      }}
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        backgroundColor: color.hex,
                        border: isSelected
                          ? `3px solid ${colors.mainWebMobile[platform]}`
                          : '2px solid #ccc',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        '&:hover': {
                          transform: 'scale(1.1)',
                          border: `3px solid ${colors.mainWebMobile[platform]}`,
                        },
                      }}
                      title={color.name}
                    />
                  );
                })}
              </Box>
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
                        className={`${detailPageClasses.detailSide.desc} ${interClassname.className}`}
                      >
                        {key}
                      </Typography>
                    </Box>
                    <Box className={detailPageClasses.detailSide.val}>
                      {description[key].map((descLine, index) => (
                        <Typography
                          key={index}
                          className={`${detailPageClasses.detailSide.font2} ${interClassname.className}`}
                        >
                          {descLine}
                        </Typography>
                      ))}
                    </Box>
                  </Box>
                ))}
            </Box>
          )}
          {platform === 'web' && (
            <AddToCart
              productId={product.id}
              cartAction="detail"
              selectedTag={(() => {
                if (!initialProduct?.tags || initialProduct.tags.length === 0) {
                  return undefined;
                }
                let tag = initialProduct.tags[selectedTagIndex];
                if (selectedColor) {
                  const colorId = extractColorIdFromTag(tag);
                  if (colorId !== selectedColor.id) {
                    if (colorId) {
                      tag = tag.replace(
                        `{${colorId}}`,
                        `{${selectedColor.id}}`,
                      );
                    } else {
                      tag = `${tag} {${selectedColor.id}}`;
                    }
                  }
                }
                return tag;
              })()}
            />
          )}
        </Box>
      </Box>
      {description && Object.keys(description).length > 0 && (
        <Box className={detailPageClasses.boxes.detail[platform]}>
          <Typography
            className={`${interClassname.className} ${detailPageClasses.specs[platform]}`}
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
                      className={`${detailPageClasses.typographs.desc[platform]} ${interClassname.className}`}
                    >
                      {key}
                    </Typography>
                  </Box>
                  <Box className={detailPageClasses.detail.val[platform]}>
                    {description[key].map((descLine, index) => (
                      <Typography
                        key={index}
                        className={`${detailPageClasses.typographs.font2[platform]} ${interClassname.className}`}
                      >
                        {descLine}
                      </Typography>
                    ))}
                  </Box>
                </Box>
              ))}
          </Box>
        </Box>
      )}
      {platform === 'mobile' && (
        <AddToCart
          productId={product.id}
          cartAction="detail"
          selectedTag={(() => {
            if (!initialProduct?.tags || initialProduct.tags.length === 0) {
              return undefined;
            }
            let tag = initialProduct.tags[selectedTagIndex];
            if (selectedColor) {
              const colorId = extractColorIdFromTag(tag);
              if (colorId !== selectedColor.id) {
                if (colorId) {
                  tag = tag.replace(`{${colorId}}`, `{${selectedColor.id}}`);
                } else {
                  tag = `${tag} {${selectedColor.id}}`;
                }
              }
            }
            return tag;
          })()}
        />
      )}
      {showDeleteProductDialog?.show && (
        <DeleteDialog
          title={t('deleteProduct')}
          description={t('confirmDeleteProduct')}
          blueButtonText={t('cancel')}
          redButtonText={t('delete')}
          handleDelete={async () => {
            try {
              const { success: deleteSuccess }: ResponseApi = await (
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
                  message: 'deleteProductError',
                  severity: 'error',
                });
                return;
              }
              const prods = await fetchProducts({
                categoryIds: [selectedCategoryId],
              });
              setProducts(prods);
              setPrevCategory(selectedCategoryId);
              setPrevProducts(prods);

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
      <Box className="flex justify-center items-center h-64">
        <CircularProgress />
      </Box>
    </Layout>
  );
}
