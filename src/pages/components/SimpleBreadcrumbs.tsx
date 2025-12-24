import { usePlatform } from '@/pages/lib/PlatformContext';
import { ExtendedCategory } from '@/pages/lib/types';
import { parseName } from '@/pages/lib/utils';
import { simpleBreadcrumbsClasses } from '@/styles/classMaps/components/simpleBreadcrumbs';
import { interClassname, units } from '@/styles/theme';
import { Box, Breadcrumbs, Link, Typography } from '@mui/material';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';

interface SimpleBreadcrumbsProps {
  currentProductName?: string;
  categoryPath?: ExtendedCategory[]; // Category path for URL-based navigation
}

export default function SimpleBreadcrumbs({
  currentProductName,
  categoryPath,
}: SimpleBreadcrumbsProps) {
  const router = useRouter();
  const t = useTranslations();
  const platform = usePlatform();

  return (
    <Box
      className="px-[10.31vw] w-full flex items-center mb-[32px]"
      style={{
        marginTop: router.pathname.includes('product')
          ? units.mt[platform]
          : undefined,
      }}
    >
      <Breadcrumbs
        separator="|"
        maxItems={units.breadcrumbs[platform]}
        className={simpleBreadcrumbsClasses.breadcrumbs[platform]}
      >
        <Link
          onClick={() => {
            router.push('/');
          }}
          className={simpleBreadcrumbsClasses.link}
        >
          <Typography
            className={`${interClassname.className} ${simpleBreadcrumbsClasses.text}`}
          >
            {t('home')}
          </Typography>
        </Link>

        {categoryPath && categoryPath.length > 0
          ? // URL-based navigation: show all categories in path except the last one (current)
            categoryPath.map((cat) => (
              <Link
                key={cat.id}
                onClick={() => {
                  router.push(`/category/${cat.id}`);
                }}
                className={simpleBreadcrumbsClasses.link}
              >
                <Typography
                  className={`${interClassname.className} ${simpleBreadcrumbsClasses.text}`}
                >
                  {parseName(cat.name, router.locale ?? 'ru')}
                </Typography>
              </Link>
            ))
          : null}

        {currentProductName ? (
          <Typography
            className={`${interClassname.className} ${simpleBreadcrumbsClasses.productName[platform]} mx-2`}
            aria-current="page"
            title={parseName(currentProductName, router.locale ?? 'ru')}
          >
            {parseName(currentProductName, router.locale ?? 'ru')}
          </Typography>
        ) : (
          ''
        )}
      </Breadcrumbs>
    </Box>
  );
}
