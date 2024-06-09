import {
  Card,
  CardContent,
  Typography,
  CardActions,
  Box,
  IconButton,
  Divider,
  Menu,
  MenuItem,
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
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';

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
  const [showEditIcon, setShowEditIcon] = useState(false);
  const { setProducts } = useProductContext();
  const { selectedCategoryId } = useCategoryContext();
  const { user } = useUserContext();
  const t = useTranslations();
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState<HTMLElement>();
  const openEditMenu = Boolean(anchorEl);

  return (
    <Card
      sx={{
        width: { xs: '47%', sm: 250 },
        height: { xs: 250, sm: 300 },
        ':hover': { boxShadow: 10 },
      }}
      className={classNames('border-[1px] px-2 py-4 relative', cardClassName)}
      onMouseEnter={() => setShowEditIcon(true)}
      onMouseLeave={() => setShowEditIcon(false)}
    >
      {product != null ? (
        <Box className="relative h-full w-full flex flex-col justify-between p-1">
          {user?.grade === 'ADMIN' && showEditIcon && (
            <Box>
              <IconButton
                aria-label="more"
                id="long-button"
                aria-controls={openEditMenu ? 'long-menu' : undefined}
                aria-expanded={openEditMenu ? 'true' : undefined}
                aria-haspopup="true"
                onClick={(event) => setAnchorEl(event.currentTarget)}
                className="px-0"
                style={{ position: 'absolute', right: 0 }}
              >
                <MoreVertIcon color="primary" fontSize="small" />
              </IconButton>
              <Menu
                open={openEditMenu}
                onClose={() => setAnchorEl(undefined)}
                anchorEl={anchorEl}
              >
                <MenuItem className="flex flex-row justify-start gap-2 items-center px-2 w-[120px] bg-[#F8F9FA]">
                  <EditIcon color="primary" fontSize="medium" />
                  <Typography className="overflow-x-scroll">
                    {t('edit')}
                  </Typography>
                </MenuItem>
                <MenuItem
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
                  className="flex flex-row justify-start gap-2 items-center px-2 w-[120px] bg-[#F8F9FA]"
                >
                  <DeleteIcon color="error" fontSize="medium" />
                  <Typography className="overflow-x-scroll">
                    {t('delete')}
                  </Typography>
                </MenuItem>
              </Menu>
            </Box>
          )}

          <Box className="h-5/6">
            {product.imgUrl != null && (
              <Box className="w-full h-1/3 sm:h-1/2 flex justify-center">
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
              <Typography
                gutterBottom
                sx={{ fontSize: { xs: 16, sm: 20 }, mt: 1 }}
                component="div"
              >
                {parseName(product?.name, router.locale ?? 'tk')}
              </Typography>
            </Box>
            <Box
              className={`w-full overflow-y-scroll overflow-x-hidden ${product.imgUrl != null ? 'h-1/2 sm:h-1/3' : 'h-full'}`}
            >
              <Typography variant="body2" color="text.secondary">
                {parseName(product?.description ?? '{}', router.locale ?? 'tk')}
              </Typography>
            </Box>
          </Box>
          {product?.price != null && (
            <Box className="h-1/6 flex items-end ">
              <Typography sx={{ fontSize: { xs: 12, sm: 16 } }}>
                {t('price')}: {product?.price} {t('manat')}
              </Typography>
            </Box>
          )}
        </Box>
      ) : (
        <Box className="w-full h-full flex flex-col justify-between">
          <CardContent>
            <Typography gutterBottom className="flex justify-center">
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
