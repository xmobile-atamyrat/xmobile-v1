import BASE_URL from '@/lib/ApiEndpoints';
import AddEditProductDialog from '@/pages/components/AddEditProductDialog';
import Carousel from '@/pages/components/Carousel';
import DeleteDialog from '@/pages/components/DeleteDialog';
import Layout from '@/pages/components/Layout';
import { fetchProducts } from '@/pages/lib/apis';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import {
  appBarHeight,
  POLL_PRODUCT_INTERVAL,
  PRODUCT_IMAGE_WIDTH_RESP,
} from '@/pages/lib/constants';
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
import { GetStaticProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import 'slick-carousel/slick/slick-theme.css';
import 'slick-carousel/slick/slick.css';

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
  const { user } = useUserContext();
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

  useEffect(() => {
    if (product == null) {
      router.push('/');
      return;
    }

    (async () => {
      const initImgUrls: string[] = await Promise.all(
        product.imgUrls.map(async (imgUrl) => {
          if (imgUrl.startsWith('http')) {
            return imgUrl;
          }
          const imgFetcher = fetch(
            `${BASE_URL}/api/localImage?imgUrl=${imgUrl}`,
          );
          return URL.createObjectURL(await (await imgFetcher).blob());
        }),
      );
      setImgUrls(initImgUrls);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product]);

  useEffect(() => {
    const desc = parseName(product?.description ?? '{}', router.locale ?? 'tk');
    if (desc == null || desc === '') return;

    const descArr = desc.split('\n').flatMap((el) => el.split(/[[\]]/));
    const descObj: { [key: string]: string[] } = {};
    let key: string | undefined;
    while (descArr.length > 0) {
      const value = descArr.shift();
      if (value === undefined) break;
      if (value === '') {
        key = descArr.shift();
        if (key === undefined) break;
        descObj[key] = [];
      } else {
        if (key === undefined) break;
        descObj[key].push(value);
      }
    }

    setDescription(descObj);
  }, [product?.description, router.locale]);

  useEffect(() => {
    if (initialProduct == null) return () => undefined;
    (async () => {
      setProduct(await computeProductPriceTags(initialProduct));
    })();

    const fetchProduct = async () => {
      try {
        const prod = await fetchProducts({ productId: initialProduct.id });
        setProduct(await computeProductPriceTags(prod[0]));
      } catch (error) {
        console.error('Error fetching product', error);
      }
    };

    const intervalId = setInterval(fetchProduct, POLL_PRODUCT_INTERVAL);

    return () => clearInterval(intervalId);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProduct]);

  return (
    product && (
      <Layout
        handleHeaderBackButton={() => {
          setSelectedProduct(undefined);
          router.push('/');
        }}
      >
        <Box
          className={`w-full h-full flex flex-${isMdUp ? 'row' : 'col'} px-4 gap-4`}
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
              {user?.grade === 'ADMIN' && (
                <Box>
                  <IconButton
                    onClick={() => {
                      if (initialProduct == null) return;
                      console.info(initialProduct);
                      setAddEditProductDialog({
                        open: true,
                        id: initialProduct.id,
                        description: initialProduct.description,
                        dialogType: 'edit',
                        imageUrls: initialProduct.imgUrls,
                        name: initialProduct.name,
                        price: initialProduct.price,
                        tags: initialProduct.tags,
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
          <Box className="flex flex-col">
            <Box className="w-full my-4">
              <Typography
                fontWeight={600}
                fontSize={isMdUp ? 22 : 18}
              >{`${product.price} ${t('manat')}`}</Typography>
            </Box>
            {product.tags.length > 0 && (
              <List className="p-0 pb-10">
                {product.tags.map((tag, index) => (
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
                        <Typography fontSize={isMdUp ? 20 : 16}>
                          {tag}
                        </Typography>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
            {description && Object.keys(description).length > 0
              ? Object.keys(description ?? {}).map((key) => (
                  <Box key={key} className="w-full flex flex-col pb-4">
                    <Box className="w-full flex flex-row gap-2 justify-between">
                      <Box className="w-[30%]">
                        <Typography
                          fontWeight={600}
                          fontSize={isMdUp ? 18 : 15}
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
