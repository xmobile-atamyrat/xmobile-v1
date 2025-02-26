import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { appBarHeight, HIGHEST_LEVEL_CATEGORY_ID } from '@/pages/lib/constants';
import { ExtendedCategory } from '@/pages/lib/types';
import { parseName } from '@/pages/lib/utils';
import HomeIcon from '@mui/icons-material/Home';
import {
  Box,
  Breadcrumbs,
  Link,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';

interface SimpleBreadcrumbsProps {
  onClick?: (combo: [ExtendedCategory, string]) => void;
}

export default function SimpleBreadcrumbs({ onClick }: SimpleBreadcrumbsProps) {
  const {
    stack,
    setStack,
    setParentCategory,
    parentCategory,
    setSelectedCategoryId,
  } = useCategoryContext();
  const router = useRouter();
  const t = useTranslations();
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));

  return (
    <Box
      className={`w-full px-3`}
      style={{
        marginTop:
          isMdUp && router.pathname.includes('product')
            ? appBarHeight
            : undefined,
      }}
    >
      <Breadcrumbs separator="›" maxItems={3}>
        <Link
          onClick={() => {
            setParentCategory(undefined);
            setSelectedCategoryId(HIGHEST_LEVEL_CATEGORY_ID);
            setStack([]);
            router.push('/');
          }}
          className="flex fle-row justify-center items-center gap-1 py-2"
        >
          <HomeIcon sx={{ fontSize: 18 }} />
          <Typography fontSize={15}>{t('home')}</Typography>
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
            className="py-2"
          >
            <Typography fontSize={15}>
              {parseName(combo[1], router.locale ?? 'ru')}
            </Typography>
          </Link>
        ))}
        {stack.length > 0 ? (
          stack[stack.length - 1][0].id !== parentCategory?.id && (
            <Typography fontSize={15}>
              {parseName(parentCategory?.name, router.locale ?? 'ru')}
            </Typography>
          )
        ) : (
          <Typography fontSize={15}>
            {parseName(parentCategory?.name, router.locale ?? 'ru')}
          </Typography>
        )}
      </Breadcrumbs>
    </Box>
  );
}
