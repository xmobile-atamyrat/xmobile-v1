import BASE_URL from '@/lib/ApiEndpoints';
import AddEditProductDialog from '@/pages/components/AddEditProductDialog';
import Carousel from '@/pages/components/Carousel';
import DeleteDialog from '@/pages/components/DeleteDialog';
import Layout from '@/pages/components/Layout';
import TikTokIcon from '@/pages/components/TikTokIcon';
import { useAbortControllerContext } from '@/pages/lib/AbortControllerContext';
import { fetchProducts } from '@/pages/lib/apis';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import {
  PRODUCT_IMAGE_WIDTH_RESP,
  squareBracketRegex,
} from '@/pages/lib/constants';
import { useFetchWithCreds } from '@/pages/lib/fetch';
import { useNetworkContext } from '@/pages/lib/NetworkContext';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { usePrevProductContext } from '@/pages/lib/PrevProductContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import {
  AddEditProductProps,
  ResponseApi,
  SnackbarProps,
} from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { parseName } from '@/pages/lib/utils';
import { computeProductPriceTags } from '@/pages/product/utils';
import { detailPageClasses } from '@/styles/classMaps/product/detail.page';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import InstagramIcon from '@mui/icons-material/Instagram';
import YouTubeIcon from '@mui/icons-material/YouTube';
import {
  Alert,
  Box,
  CardMedia,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Snackbar,
  Typography,
  useMediaQuery,
  useTheme,
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
    };
  } catch (error) {
    console.error('Error fetching product during build:', error);

    return {
      props: {
        product: null,
        messages: null,
      },
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
  const { selectedCategoryId, stack, parentCategory } = useCategoryContext();
  const [addEditProductDialog, setAddEditProductDialog] =
    useState<AddEditProductProps>({ open: false, imageUrls: [] });
  const [description, setDescription] = useState<{ [key: string]: string[] }>();
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const { network } = useNetworkContext();
  const { createAbortController, clearAbortController } =
    useAbortControllerContext();
  const fetchWithCreds = useFetchWithCreds();
  const platform = usePlatform();

  // Check if user landed directly (no category context)
  const isDirectLanding = stack.length === 0 && !parentCategory;

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
  }, [initialProduct]);

  return product ? (
    <Layout
      handleHeaderBackButton={() => {
        if (isDirectLanding) {
          router.push('/');
        } else {
          router.push('/product');
        }
      }}
    >
      <Box className={detailPageClasses.boxes.main[platform]}>
        {/* title, images */}
        <Box className={detailPageClasses.boxes.title[platform]}>
          <Box className={detailPageClasses.boxes.typo}>
            <Typography variant="h5" className="text-center">
              {parseName(product?.name ?? '{}', router.locale ?? 'tk')}
            </Typography>
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
          </Box>
          {imgUrls.length === 1 && (
            <Box className={detailPageClasses.boxes.img}>
              <CardMedia
                component="img"
                image={imgUrls[0]}
                alt={product?.name}
                sx={PRODUCT_IMAGE_WIDTH_RESP}
              />
            </Box>
          )}
          {imgUrls.length > 1 && (
            <Carousel isMdUp={isMdUp}>
              {imgUrls.map((imgUrl, index) => (
                <CardMedia
                  component="img"
                  image={imgUrl}
                  alt={product?.name}
                  className="w-full"
                  key={index}
                />
              ))}
            </Carousel>
          )}
        </Box>

        {/* price, description */}
        <Box className={detailPageClasses.boxes.price[platform]}>
          <Box className="w-full my-4 flex">
            {product.price?.includes('[') ? (
              <CircularProgress
                className={detailPageClasses.circProgress[platform]}
              />
            ) : (
              <Typography
                className={detailPageClasses.typographs.price[platform]}
              >{`${product.price} ${t('manat')}`}</Typography>
            )}

            <Box className="ml-10">
              <AddToCart productId={product.id} cartAction="add" />
            </Box>
          </Box>
          {product.tags.length > 0 && product.tags[0].includes('[') ? (
            <CircularProgress
              className={detailPageClasses.circProgress[platform]}
            />
          ) : (
            <List className="p-0 pb-10">
              {product.tags.map((tag, index) => {
                const words = tag.split(' ');
                const beginning = words.slice(0, -2).join(' ');
                const end = words.slice(-2).join(' ');
                return (
                  <ListItem key={index} className="p-0">
                    <FiberManualRecordIcon
                      className="w-[16px] h-[16px]"
                      color="disabled"
                    />
                    <ListItemText
                      sx={{ pl: 1 }}
                      primary={
                        <Box className="flex flex-row gap-4">
                          <Typography
                            className={
                              detailPageClasses.typographs.font[platform]
                            }
                          >
                            {beginning}
                          </Typography>
                          <Typography
                            className={
                              (detailPageClasses.typographs.font[platform],
                              'font-semibold')
                            }
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

          <Box>
            {product.videoUrls.some((videoUrl) => videoUrl.length !== 0) && (
              <Typography
                className={detailPageClasses.typographs.prodVideo[platform]}
              >{`${t('productVideo')}:`}</Typography>
            )}

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
                      <Typography fontSize={isMdUp ? 18 : 15}>
                        {(() => {
                          if (index === 0) return 'TikTok';
                          if (index === 1) return 'Instagram';
                          return 'Youtube';
                        })()}
                      </Typography>
                    </Link>
                  ),
              )}
            </Box>
          </Box>

          {description && Object.keys(description).length > 0
            ? Object.keys(description ?? {})
                .filter(
                  (key) =>
                    description[key] != null && description[key].length > 0,
                )
                .map((key) => (
                  <Box key={key} className="w-full flex flex-col pb-4">
                    <Box className="w-full flex flex-row gap-2 justify-between">
                      <Box className="w-[30%]">
                        <Typography
                          className={
                            detailPageClasses.typographs.prodVideo[platform]
                          }
                        >
                          {key}
                        </Typography>
                      </Box>
                      <Box className="flex flex-col w-[70%]">
                        {description[key].map((descLine, index) => (
                          <Typography
                            key={index}
                            className={
                              detailPageClasses.typographs.font2[platform]
                            }
                          >
                            {descLine}
                          </Typography>
                        ))}
                      </Box>
                    </Box>
                  </Box>
                ))
            : parseName(product?.description ?? '{}', router.locale ?? 'tk')
                ?.split('\n')
                .map((desc, index) => (
                  <Typography key={`${desc}-${index}`}>{desc}</Typography>
                ))}
        </Box>
      </Box>
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
        if (isDirectLanding) {
          router.push('/');
        } else {
          router.push('/product');
        }
      }}
    >
      <Box className="flex justify-center items-center h-64">
        <CircularProgress />
      </Box>
    </Layout>
  );
}
