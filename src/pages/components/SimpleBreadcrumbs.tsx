import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { HIGHEST_LEVEL_CATEGORY_ID } from '@/pages/lib/constants';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { ExtendedCategory } from '@/pages/lib/types';
import { parseName } from '@/pages/lib/utils';
import { simpleBreadcrumbsClasses } from '@/styles/classMaps/components/simpleBreadcrumbs';
import { interClassname, units } from '@/styles/theme';
import { Box, Breadcrumbs, Link, Typography } from '@mui/material';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';

interface SimpleBreadcrumbsProps {
  onClick?: (combo: [ExtendedCategory, string]) => void;
  currentProductName?: string;
}

export default function SimpleBreadcrumbs({
  onClick,
  currentProductName,
}: SimpleBreadcrumbsProps) {
  const {
    stack,
    setStack,
    setParentCategory,
    parentCategory,
    setSelectedCategoryId,
  } = useCategoryContext();
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
            setParentCategory(undefined);
            setSelectedCategoryId(HIGHEST_LEVEL_CATEGORY_ID);
            setStack([]);
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

        {stack.map((combo) => (
          <Link
            key={combo[1]}
            onClick={() => {
              if (onClick) {
                onClick(combo);
                return;
              }
              setStack([...stack.slice(0, stack.indexOf(combo) + 1)]);
              router.push('/');
            }}
            className={simpleBreadcrumbsClasses.link}
          >
            <Typography
              className={`${interClassname.className} ${simpleBreadcrumbsClasses.text}`}
            >
              {parseName(combo[1], router.locale ?? 'ru')}
            </Typography>
          </Link>
        ))}

        <Typography
          className={`${interClassname.className} ${simpleBreadcrumbsClasses.text} mx-2`}
        >
          {parentCategory == null
            ? t('allProducts')
            : parseName(parentCategory?.name, router.locale ?? 'ru')}
        </Typography>

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
