import { useLocale } from '@/pages/lib/hooks/useLocale';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { ExtendedCategory } from '@/pages/lib/types';
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

interface StyledBreadcrumbsProps {
  categoryPath?: ExtendedCategory[];
}

export default function StyledBreadcrumbs({
  categoryPath,
}: StyledBreadcrumbsProps) {
  const router = useRouter();
  const locale = useLocale();
  const platform = usePlatform();

  if (!categoryPath || categoryPath.length === 0) {
    return null;
  }

  return (
    <Breadcrumbs
      className={simpleBreadcrumbsClasses.styled[platform]}
      separator=" "
    >
      {categoryPath.slice(0, -1).map((cat) => (
        <StyledBreadcrumb
          className={`${interClassname.className} ${simpleBreadcrumbsClasses.breadcrumbMobile}`}
          component="a"
          label={parseName(cat.name, locale)}
          key={cat.id}
          onClick={() => {
            router.push(`/category/${cat.id}`);
          }}
        />
      ))}
      <StyledBreadcrumb
        className={`${interClassname.className} ${simpleBreadcrumbsClasses.breadcrumbMobile}`}
        component="span"
        label={parseName(categoryPath[categoryPath.length - 1].name, locale)}
      />
    </Breadcrumbs>
  );
}
