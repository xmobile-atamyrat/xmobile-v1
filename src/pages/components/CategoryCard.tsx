import BASE_URL from '@/lib/ApiEndpoints';
import { blobToBase64, parseName } from '@/pages/lib/utils';
import { useMediaQuery, useTheme } from '@mui/material';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardMedia from '@mui/material/CardMedia';
import Typography from '@mui/material/Typography';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

interface CategoryCardProps {
  name: string;
  id: string;
  initialImgUrl?: string;
}

export default function CategoryCard({
  initialImgUrl,
  id,
  name,
}: CategoryCardProps) {
  const [imgUrl, setImgUrl] = useState<string>();
  const router = useRouter();
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));

  useEffect(() => {
    if (initialImgUrl != null) {
      const cacheImgUrl = sessionStorage.getItem(id);
      if (cacheImgUrl != null) {
        setImgUrl(cacheImgUrl);
      } else {
        setImgUrl('/xmobile-original-logo.jpeg');
        (async () => {
          if (initialImgUrl.startsWith('http')) {
            setImgUrl(initialImgUrl);
          } else {
            const imgFetcher = fetch(
              `${BASE_URL}/api/localImage?imgUrl=${initialImgUrl}`,
            );
            const resp = await imgFetcher;
            if (resp.ok) {
              const imgBlob = await resp.blob();
              const base64 = await blobToBase64(imgBlob);
              setImgUrl(base64);
              sessionStorage.setItem(id, base64);
            }
          }
        })();
      }
    }
  }, [initialImgUrl, id]);

  return (
    <Card
      sx={{
        width: { sm: 400 },
        height: { xs: 100, sm: 130 },
        ':hover': { boxShadow: 10 },
      }}
      className={`border-[1px] ${isMdUp ? 'px-6' : 'px-4'}`}
    >
      <Box
        className={`flex flex-row justify-center items-center ${isMdUp ? 'gap-4' : 'gap-2'} w-full h-full`}
      >
        <Typography
          fontWeight={600}
          fontSize={isMdUp ? 20 : 18}
          className="flex justify-center items-center"
        >
          {parseName(name, router.locale ?? 'tk')}
        </Typography>
        <CardMedia
          component="img"
          sx={{ width: { xs: 150, sm: 200 } }}
          image={imgUrl}
          alt="Live from space album cover"
        />
      </Box>
    </Card>
  );
}
