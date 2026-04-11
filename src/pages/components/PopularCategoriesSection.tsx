import BASE_URL from '@/lib/ApiEndpoints';
import {
  ALL_PRODUCTS_CATEGORY_CARD,
  DEFAULT_LOCALE,
} from '@/pages/lib/constants';
import { buildPopularCategoriesSectionModel } from '@/pages/lib/popularCategoriesLayout';
import { ExtendedCategory } from '@/pages/lib/types';
import { blobToBase64, parseName } from '@/pages/lib/utils';
import { popularCategoriesSectionClasses as cls } from '@/styles/classMaps/components/popularCategoriesSection';
import { interClassname } from '@/styles/theme';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';

interface CategoryImageProps {
  initialImgUrl?: string | null;
  className: string;
}

function CategoryImage({ initialImgUrl, className }: CategoryImageProps) {
  const [imgUrl, setImgUrl] = useState<string>(
    '/logo/xmobile-original-logo.jpeg',
  );

  useEffect(() => {
    if (
      initialImgUrl == null ||
      initialImgUrl === '' ||
      initialImgUrl === ALL_PRODUCTS_CATEGORY_CARD
    ) {
      return undefined;
    }

    let cancelled = false;

    (async () => {
      if (initialImgUrl.startsWith('http')) {
        if (!cancelled) setImgUrl(initialImgUrl);
        return;
      }
      const resp = await fetch(
        `${BASE_URL}/api/localImage?imgUrl=${initialImgUrl}`,
      );
      if (cancelled || !resp.ok) return;
      const blob = await resp.blob();
      const base64 = await blobToBase64(blob);
      if (!cancelled) setImgUrl(base64);
    })();

    return () => {
      cancelled = true;
    };
  }, [initialImgUrl]);

  return <img src={imgUrl} alt="" className={className} />;
}

interface PopularCategoriesSectionProps {
  categories: ExtendedCategory[];
}

export default function PopularCategoriesSection({
  categories,
}: PopularCategoriesSectionProps) {
  const t = useTranslations();
  const router = useRouter();
  const locale = router.locale ?? DEFAULT_LOCALE;

  const handleNavigate = useCallback(
    (categorySlug: string) => {
      router.push(`/category/${categorySlug}`);
    },
    [router],
  );

  const handleMore = useCallback(() => {
    router.push('/category');
  }, [router]);

  const { shouldRender, fullWidthItems, showFullWidthMore } =
    buildPopularCategoriesSectionModel(categories);

  if (!shouldRender) return null;

  return (
    <Box className={cls.section}>
      <Typography className={`${interClassname.className} ${cls.sectionTitle}`}>
        {t('popularCategories')}
      </Typography>

      <Box className={cls.grid}>
        {fullWidthItems.map((cat) => (
          <Box
            key={cat.id}
            className={cls.fullWidthCard}
            onClick={() => handleNavigate(cat.slug)}
          >
            <Box className={cls.fullWidthImageBox}>
              <CategoryImage
                initialImgUrl={cat.imgUrl}
                className={cls.fullWidthImage}
              />
            </Box>
            <Typography
              className={`${interClassname.className} ${cls.fullWidthName}`}
            >
              {parseName(cat.name, locale)}
            </Typography>
            <ChevronRightIcon className={cls.chevron} />
          </Box>
        ))}

        {showFullWidthMore && (
          <Box className={cls.fullWidthMoreCard} onClick={handleMore}>
            <Box className={cls.moreDotsBox}>
              <Typography className={cls.moreDotsText}>···</Typography>
            </Box>
            <Typography
              className={`${interClassname.className} ${cls.fullWidthName}`}
              sx={{ color: 'text.secondary' }}
            >
              {t('moreCategories')}
            </Typography>
            <ChevronRightIcon className={cls.chevron} />
          </Box>
        )}
      </Box>
    </Box>
  );
}
