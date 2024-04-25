import {
  Card,
  CardMedia,
  CardContent,
  Typography,
  CardActions,
} from '@mui/material';
import { Product } from '@prisma/client';

export default function ProductCard({
  product: { description, imgUrl, name, price },
}: {
  product: Product;
}) {
  return (
    <Card sx={{ maxWidth: 250 }}>
      {imgUrl != null && (
        <CardMedia sx={{ height: 140 }} image={imgUrl} title={name} />
      )}
      <CardContent>
        <Typography gutterBottom variant="h5" component="div">
          {name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </CardContent>
      <CardActions>
        <Typography>Price: {price}</Typography>
      </CardActions>
    </Card>
  );
}
