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
  appBarHeight,
  PRODUCT_IMAGE_WIDTH_RESP,
  squareBracketRegex,
} from '@/pages/lib/constants';
import { useNetworkContext } from '@/pages/lib/NetworkContext';
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
import { GetStaticProps } from 'next';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { lazy, useEffect, useState } from 'react';
import 'slick-carousel/slick/slick-theme.css';
import 'slick-carousel/slick/slick.css';

// use lazy() not to load the same compononets and functions in AddToCart
const AddToCart = lazy(() => import('@/pages/components/AddToCart'));

// getStaticProps because translations are static
export const getStaticProps = (async (context) => {
  return {
    props: {
      messages: (await import(`../../i18n/${context.locale}.json`)).default,
    },
  };
}) satisfies GetStaticProps<object>;

export default function Product() {
  const { selectedProduct: initialProduct, setSelectedProduct } =
    useProductContext();
  const [product, setProduct] = useState(initialProduct);
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
  const { selectedCategoryId } = useCategoryContext();
  const [addEditProductDialog, setAddEditProductDialog] =
    useState<AddEditProductProps>({ open: false, imageUrls: [] });
  const [description, setDescription] = useState<{ [key: string]: string[] }>();
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const { network } = useNetworkContext();
  const { createAbortController, clearAbortController } =
    useAbortControllerContext();

  useEffect(() => {
    if (product == null) {
      // router.push('/');
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
      setProduct(await computeProductPriceTags(initialProduct, accessToken));
    })();
  }, [initialProduct]);

  return (
    product && (
      <Layout
        handleHeaderBackButton={() => {
          setSelectedProduct(undefined);
          router.push('/product');
        }}
      >
        <Box
          className={`w-full h-full flex flex-${isMdUp ? 'row' : 'col'} px-4 gap-4 pb-10`}
          pt={{ xs: `${appBarHeight}px`, md: `${appBarHeight * 1.25}px` }}
        >
          {/* title, images */}
          <Box
            className={`flex flex-col gap-2`}
            style={{
              width: isMdUp ? '50%' : '100%',
            }}
          >
            <Box className="w-full flex flex-row justify-between items-center pb-4">
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
              <Box className="flex w-full justify-center flex-row">
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
                    sx={{
                      width: '100%',
                    }}
                    key={index}
                  />
                ))}
              </Carousel>
            )}
          </Box>

          {/* price, description */}
          <Box
            className="flex flex-col"
            style={{
              width: isMdUp ? '50%' : '100%',
            }}
          >
            <Box className="w-full my-4 flex">
              {product.price?.includes('[') ? (
                <CircularProgress size={isMdUp ? 30 : 24} />
              ) : (
                <Typography
                  fontWeight={600}
                  fontSize={isMdUp ? 22 : 18}
                  alignItems="center"
                  display="flex"
                >{`${product.price} ${t('manat')}`}</Typography>
              )}

              <Box className="ml-10">
                <AddToCart productId={product.id} cartAction="add" />
              </Box>
            </Box>
            {product.tags.length > 0 && product.tags[0].includes('[') ? (
              <CircularProgress size={isMdUp ? 30 : 24} />
            ) : (
              <List className="p-0 pb-10">
                {product.tags.map((tag, index) => {
                  const words = tag.split(' ');
                  const beginning = words.slice(0, -2).join(' ');
                  const end = words.slice(-2).join(' ');
                  return (
                    <ListItem key={index} sx={{ p: 0 }}>
                      <FiberManualRecordIcon
                        sx={{
                          width: 16,
                          height: 16,
                        }}
                        color="disabled"
                      />
                      <ListItemText
                        sx={{ pl: 1 }}
                        primary={
                          <Box className="flex flex-row gap-4">
                            <Typography fontSize={isMdUp ? 20 : 16}>
                              {beginning}
                            </Typography>
                            <Typography
                              fontSize={isMdUp ? 20 : 16}
                              fontWeight={600}
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
                  fontWeight={600}
                  fontSize={isMdUp ? 18 : 15}
                  sx={{ wordBreak: 'break-word' }}
                >{`${t('productVideo')}:`}</Typography>
              )}

              <Box className="flex sm:w-1/2 p-2">
                {product.videoUrls.map(
                  (videoUrl, index) =>
                    videoUrl.length !== 0 && (
                      <Link
                        key={index}
                        target="_blank"
                        href={videoUrl}
                        className="px-3 pb-3 flex items-center flex-col md:flex-row"
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
                            fontWeight={600}
                            fontSize={isMdUp ? 18 : 15}
                            sx={{ wordBreak: 'break-word' }}
                          >
                            {key}
                          </Typography>
                        </Box>
                        <Box className="flex flex-col w-[70%]">
                          {description[key].map((descLine, index) => (
                            <Typography key={index} fontSize={isMdUp ? 18 : 15}>
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
            sx={{ width: '100%' }}
          >
            {snackbarMessage?.message && t(snackbarMessage.message)}
          </Alert>
        </Snackbar>
        {addEditProductDialog.open && (
          <AddEditProductDialog
            args={addEditProductDialog}
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
    )
  );
}
