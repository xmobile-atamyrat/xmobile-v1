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
import { squareBracketRegex } from '@/pages/lib/constants';
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
import { computeProductPriceTags } from '@/pages/product/utils';
import { appbarClasses } from '@/styles/classMaps/components/appbar';
import { productIndexPageClasses } from '@/styles/classMaps/product';
import { detailPageClasses } from '@/styles/classMaps/product/detail';
import { colors, interClassname } from '@/styles/theme';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import InstagramIcon from '@mui/icons-material/Instagram';
import YouTubeIcon from '@mui/icons-material/YouTube';
import {
  Alert,
  Box,
  CardMedia,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Snackbar,
  Typography,
} from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import type { Product } from '@prisma/client';
import { GetStaticPaths, GetStaticProps } from 'next';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { lazy, useEffect, useState } from 'react';
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
              />
            </Box>
          )}
          {imgUrls.length > 1 && (
            <Carousel>
              {imgUrls.map((imgUrl, index) => (
                <CardMedia
                  component="img"
                  image={imgUrl}
                  alt={product?.name}
                  className={detailPageClasses.cardMedia[platform]}
                  key={index}
                />
              ))}
            </Carousel>
          )}
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
                >{`${product.price} ${t('manat')}`}</Typography>
              )}
            </Box>
          </Box>

          {product.tags[0]?.includes('[') ? (
            <CircularProgress
              className={detailPageClasses.circProgress[platform]}
            />
          ) : (
            <List className={detailPageClasses.list[platform]}>
              {product.tags.map((tag, index) => {
                const words = tag.split(' ');
                const n = words[words.length - 1].length < 1 ? 3 : 2;
                const beginning = words.slice(0, -n).join(' ');
                const end = words.slice(-n).join(' ');
                return (
                  <ListItem key={index} className="p-0">
                    <FiberManualRecordIcon
                      className={detailPageClasses.listItemIcon[platform]}
                    />
                    <ListItemText
                      className={detailPageClasses.listItemText[platform]}
                      primary={
                        <Box className={detailPageClasses.boxes.tag[platform]}>
                          <Typography
                            className={`${detailPageClasses.typographs.font[platform]} ${interClassname.className}`}
                          >
                            {beginning}
                          </Typography>
                          <Typography
                            className={`${detailPageClasses.typographs.font[platform]} font-semibold min-w-[50px] text-end ${interClassname.className}`}
                            color={colors.mainWebMobile[platform]}
                          >
                            {end}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                );
              })}
            </List>
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
          {user && platform === 'web' && (
            <AddToCart productId={product.id} cartAction="detail" />
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
      {user && platform === 'mobile' && (
        <AddToCart productId={product.id} cartAction="detail" />
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
                categoryId: selectedCategoryId,
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
