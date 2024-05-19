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

interface ProductCardProps {
  product?: Product;
  handleClickAddProduct?: () => void;
}

// const getImageDimensionsRatioFromUrl = (url: string) => {
//   return new Promise<number>((resolve) => {
//     const img = new Image();
//     img.onload = () => {
//       resolve(img.width / img.height);
//     };
//     img.src = url;
//   });
// };

// const getImageDimensionsRatioFromBlob = (blob: Blob) => {
//   return new Promise<number>((resolve) => {
//     const img = new Image();
//     img.onload = () => {
//       resolve(img.width / img.height);
//     };
//     img.src = URL.createObjectURL(blob);
//   });
// };

export default function ProductCard({
  product,
  handleClickAddProduct,
}: ProductCardProps) {
  // const [imgDimensionsRatio, setImgDimensionsRatio] = useState<number>();

  // useEffect(() => {
  //   if (product?.imgUrl == null) return;
  //   (async () => {
  //     const dimensionsRatio = await getImageDimensionsRatioFromUrl(
  //       product.imgUrl!,
  //     );
  //     setImgDimensionsRatio(dimensionsRatio);
  //   })();
  // }, [product?.imgUrl]);
  return (
    <Card
      sx={{
        width: 250,
        ':hover': { boxShadow: 10 },
      }}
      className="border-[1px] p-2"
    >
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
      {product != null ? (
        <Box>
          <CardContent>
            <Typography gutterBottom variant="h5" component="div">
              {product?.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {product?.description}
            </Typography>
          </CardContent>
          <CardActions>
            <Typography>Price: {product?.price}</Typography>
          </CardActions>
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
              Add new product
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
