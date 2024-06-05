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
        <Box className="relative h-full w-full flex flex-col justify-between">
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

          <Box className="h-5/6 overflow-hidden">
            {product?.imgUrl != null && (
              <Box className="w-full h-[100px] flex justify-center">
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
            <Box className="p-2">
              <Box>
                <Typography gutterBottom variant="h5" component="div">
                  {product?.name}
                </Typography>
              </Box>

              <Box className="">
                <Typography variant="body2" color="text.secondary">
                  {product?.description}
                </Typography>
              </Box>
            </Box>
          </Box>
          <Box className="p-1 h-1/6 flex items-end ">
            <Typography>Price: {product?.price} manat</Typography>
          </Box>
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
