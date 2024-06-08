import {
  Card,
  CardContent,
  Typography,
  CardActions,
  Box,
  IconButton,
  Divider,
} from '@mui/material';
import { Product } from '@prisma/client';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import BASE_URL from '@/lib/ApiEndpoints';
import DeleteIcon from '@mui/icons-material/Delete';
import { useState } from 'react';
import { useProductContext } from '@/pages/lib/ProductContext';
import { ResponseApi } from '@/pages/lib/types';
import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { useUserContext } from '@/pages/lib/UserContext';
import classNames from 'classnames';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { parseName } from '@/pages/lib/utils';

interface ProductCardProps {
  product?: Product;
  handleClickAddProduct?: () => void;
  cardClassName?: string;
}

export default function ProductCard({
  product,
  handleClickAddProduct,
  cardClassName,
}: ProductCardProps) {
  const [showDeleteIcon, setShowDeleteIcon] = useState(false);
  const { setProducts } = useProductContext();
  const { selectedCategoryId } = useCategoryContext();
  const { user } = useUserContext();
  const t = useTranslations();
  const router = useRouter();

  return (
    <Card
      sx={{
        width: 250,
        ':hover': { boxShadow: 10 },
      }}
      className={classNames(
        'border-[1px] px-2 py-4 relative h-[300px]',
        cardClassName,
      )}
      onMouseEnter={() => setShowDeleteIcon(true)}
      onMouseLeave={() => setShowDeleteIcon(false)}
    >
      {product != null ? (
        <Box className="relative h-full w-full flex flex-col justify-between p-1">
          {user?.grade === 'ADMIN' && showDeleteIcon && (
            <IconButton
              style={{ position: 'absolute', right: 0 }}
              onClick={async () => {
                try {
                  await fetch(
                    `${BASE_URL}/api/product?productId=${product.id}`,
                    {
                      method: 'DELETE',
                    },
                  );
                  const { success, data }: ResponseApi<Product[]> = await (
                    await fetch(
                      `${BASE_URL}/api/product?categoryId=${selectedCategoryId}`,
                    )
                  ).json();
                  if (success && data != null) setProducts(data);
                } catch (error) {
                  console.error(error);
                }
              }}
            >
              <DeleteIcon color="error" fontSize="large" />
            </IconButton>
          )}

          <Box className="h-5/6">
            {product.imgUrl != null && (
              <Box className="w-full h-1/2 flex justify-center">
                <img
                  src={product?.imgUrl}
                  alt={product?.name}
                  onError={async (error) => {
                    error.currentTarget.onerror = null;
                    const imgFetcher = fetch(
                      `${BASE_URL}/api/localImage?imgUrl=${product.imgUrl}`,
                    );

                    error.currentTarget.src = URL.createObjectURL(
                      await (await imgFetcher).blob(),
                    );
                  }}
                />
              </Box>
            )}
            <Box>
              <Typography gutterBottom variant="h6" component="div">
                {parseName(product?.name, router.locale ?? 'tk')}
              </Typography>
            </Box>
            <Box
              className={`w-full overflow-scroll ${product.imgUrl != null ? 'h-1/3' : ''}`}
            >
              <Typography variant="body2" color="text.secondary">
                {parseName(product?.description ?? '{}', router.locale ?? 'tk')}
              </Typography>
            </Box>
          </Box>
          {product?.price != null && (
            <Box className="p-1 h-1/6 flex items-end ">
              <Typography>
                {t('price')}: {product?.price} {t('manat')}
              </Typography>
            </Box>
          )}
        </Box>
      ) : (
        <Box className="w-full h-full flex flex-col justify-between">
          <CardContent>
            <Typography
              gutterBottom
              variant="h6"
              component="div"
              className="flex justify-center"
            >
              {t('addNewProduct')}
            </Typography>
          </CardContent>
          <Box>
            <Divider />
            <CardActions className="w-full flex justify-center items-end">
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
