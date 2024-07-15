import BASE_URL from '@/lib/ApiEndpoints';
import { useUserContext } from '@/pages/lib/UserContext';
import { parseName } from '@/pages/lib/utils';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import {
  Box,
  Card,
  CardActions,
  CardContent,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material';
import { Product } from '@prisma/client';
import classNames from 'classnames';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

interface ProductCardProps {
  product?: Product;
  handleClickAddProduct?: () => void;
  cardClassName?: string;
  handleDeleteProduct?: (productId: string) => void;
  handleEditProduct?: () => void;
}

export default function ProductCard({
  product,
  handleClickAddProduct,
  cardClassName,
  handleDeleteProduct,
  handleEditProduct,
}: ProductCardProps) {
  const { user } = useUserContext();
  const t = useTranslations();
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState<HTMLElement>();
  const openEditMenu = Boolean(anchorEl);
  const [imgUrl, setImgUrl] = useState<string>('/xmobile-original-logo.jpeg');

  useEffect(() => {
    (async () => {
      setTimeout(async () => {
        if (product?.imgUrl != null) {
          if (product.imgUrl.startsWith('http')) {
            setImgUrl(product.imgUrl);
          } else {
            const imgFetcher = fetch(
              `${BASE_URL}/api/localImage?imgUrl=${product.imgUrl}`,
            );

            setImgUrl(URL.createObjectURL(await (await imgFetcher).blob()));
          }
        }
      }, 2000);
    })();
  }, [product?.imgUrl]);

  return (
    <Card
      sx={{
        width: { xs: '47%', sm: 250 },
        height: { xs: 250, sm: 300 },
        ':hover': { boxShadow: 10 },
      }}
      className={classNames('border-[1px] px-2 py-4 relative', cardClassName)}
    >
      {product != null ? (
        <Box className="relative h-full w-full flex flex-col justify-between p-1">
          {user?.grade === 'ADMIN' && (
            <Box style={{ position: 'absolute', right: 0 }}>
              <IconButton
                aria-label="more"
                id="long-button"
                aria-controls={openEditMenu ? 'long-menu' : undefined}
                aria-expanded={openEditMenu ? 'true' : undefined}
                aria-haspopup="true"
                onClick={(event) => setAnchorEl(event.currentTarget)}
                className="px-0"
              >
                <MoreVertIcon color="primary" fontSize="small" />
              </IconButton>
              <Menu
                open={openEditMenu}
                onClose={() => setAnchorEl(undefined)}
                anchorEl={anchorEl}
              >
                <MenuItem
                  className="flex flex-row justify-start gap-2 items-center px-2 w-[120px] bg-[#F8F9FA]"
                  onClick={handleEditProduct}
                >
                  <EditIcon color="primary" fontSize="medium" />
                  <Typography className="overflow-x-scroll">
                    {t('edit')}
                  </Typography>
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    if (handleDeleteProduct) handleDeleteProduct(product.id);
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
            {imgUrl != null && (
              <Box className="w-full h-1/3 sm:h-1/2 flex justify-center">
                <Image
                  src={imgUrl}
                  alt={product?.name}
                  width={100}
                  height={100}
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
