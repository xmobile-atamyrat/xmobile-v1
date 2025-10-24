import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { parseName } from '@/pages/lib/utils';
import { simpleBreadcrumbsClasses } from '@/styles/classMaps/components/simpleBreadcrumbs';
import { interClassname } from '@/styles/theme';
import { Breadcrumbs } from '@mui/material';
import Chip from '@mui/material/Chip';
import { styled } from '@mui/material/styles';
import { useRouter } from 'next/router';

const StyledBreadcrumb = styled(Chip)(({ theme }) => {
  return {
    backgroundColor: '#f5f5f5',
    height: '24px',
    color: '#1b1b1b',
    fontWeight: theme.typography.fontWeightMedium,
  };
}) as typeof Chip;

export default function StyledBreadcrumbs() {
  const { stack, setStack, parentCategory } = useCategoryContext();
  const router = useRouter();
  const platform = usePlatform();

  return (
    <Breadcrumbs
      className={simpleBreadcrumbsClasses.styled[platform]}
      separator=" "
    >
      {stack.map((combo) => (
        <StyledBreadcrumb
          className={`${interClassname.className} ${simpleBreadcrumbsClasses.breadcrumbMobile}`}
          component="a"
          label={parseName(combo[1], router.locale ?? 'ru')}
          key={combo[1]}
          onClick={() => {
            setStack([...stack.slice(0, stack.indexOf(combo) + 1)]);
            router.push('/');
          }}
        />
      ))}
      {stack.length && stack[stack.length - 1][0].id !== parentCategory?.id && (
        <StyledBreadcrumb
          className={`${interClassname.className} ${simpleBreadcrumbsClasses.breadcrumbMobile}`}
          component="a"
          label={parseName(parentCategory?.name, router.locale ?? 'ru')}
          onClick={() => {
            router.push('/');
          }}
        />
      )}
    </Breadcrumbs>
  );
}
