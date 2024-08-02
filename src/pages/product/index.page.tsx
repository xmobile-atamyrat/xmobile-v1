import BASE_URL from '@/lib/ApiEndpoints';
import AddEditProductDialog from '@/pages/components/AddEditProductDialog';
import Carousel from '@/pages/components/Carousel';
import DeleteDialog from '@/pages/components/DeleteDialog';
import Layout from '@/pages/components/Layout';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import {
  AddEditProductProps,
  ResponseApi,
  SnackbarProps,
} from '@/pages/lib/types';
import { useUserContext } from '@/pages/lib/UserContext';
import { parseName } from '@/pages/lib/utils';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import {
  Alert,
  Box,
  CardMedia,
  IconButton,
  Snackbar,
  Typography,
} from '@mui/material';
import { Product as PrismaProduct } from '@prisma/client';
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
  const { selectedProduct: product, setSelectedProduct } = useProductContext();
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
  }, [product]);

  return (
    product && (
      <Layout
        handleHeaderBackButton={() => {
          setSelectedProduct(undefined);
          router.push('/');
        }}
      >
        <Box className="w-full h-full flex flex-col px-4 gap-4">
          <Box className="w-full flex flex-col gap-2">
            <Box className="w-full flex flex-row justify-between items-center">
              <Typography variant="h5" className="text-center">
                {parseName(product?.name ?? '{}', router.locale ?? 'tk')}
              </Typography>
              {user?.grade === 'ADMIN' && (
                <Box>
                  <IconButton
                    onClick={() => {
                      setAddEditProductDialog({
                        open: true,
                        id: product.id,
                        description: product.description,
                        dialogType: 'edit',
                        imageUrls: product.imgUrls,
                        name: product.name,
                        price: product.price,
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
                  sx={{
                    width: '80%',
                  }}
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
                    sx={{
                      width: '100%',
                    }}
                    key={index}
                  />
                ))}
              </Carousel>
            )}
          </Box>
          {product?.price != null && (
            <Box className="w-full mt-4">
              <Typography
                fontWeight={600}
              >{`${product.price} ${t('manat')}`}</Typography>
            </Box>
          )}
          <Box className="w-full">
            {parseName(product?.description ?? '{}', router.locale ?? 'tk')
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
                const { success, data }: ResponseApi<PrismaProduct[]> = await (
                  await fetch(
                    `${BASE_URL}/api/product?categoryId=${selectedCategoryId}`,
                  )
                ).json();
                if (success && data != null) {
                  setProducts(data);
                  setSnackbarOpen(true);
                  setSnackbarMessage({
                    message: 'deleteProductSuccess',
                    severity: 'success',
                  });
                }
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
