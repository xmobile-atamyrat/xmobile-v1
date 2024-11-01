import { useCategoryContext } from '@/pages/lib/CategoryContext';
import { parseName } from '@/pages/lib/utils';
import HomeIcon from '@mui/icons-material/Home';
import { Breadcrumbs } from '@mui/material';
import Chip from '@mui/material/Chip';
import { emphasize, styled } from '@mui/material/styles';
import { useRouter } from 'next/router';

const StyledBreadcrumb = styled(Chip)(({ theme }) => {
  const backgroundColor =
    theme.palette.mode === 'light'
      ? theme.palette.grey[100]
      : theme.palette.grey[800];
  return {
    backgroundColor,
    height: theme.spacing(3),
    color: theme.palette.text.primary,
    fontWeight: theme.typography.fontWeightRegular,
    '&:hover, &:focus': {
      backgroundColor: emphasize(backgroundColor, 0.06),
    },
    '&:active': {
      boxShadow: theme.shadows[1],
      backgroundColor: emphasize(backgroundColor, 0.12),
    },
  };
}) as typeof Chip;

export default function StyledBreadcrumbs() {
  const { stack, setStack, setParentCategory, parentCategory } =
    useCategoryContext();
  const router = useRouter();

  return (
    <Breadcrumbs className="mx-2">
      <StyledBreadcrumb
        component="a"
        label="Home"
        icon={<HomeIcon fontSize="small" />}
        onClick={() => {
          setParentCategory(undefined);
          setStack([]);
          router.push('/');
        }}
      />
      {stack.map((combo) => (
        <StyledBreadcrumb
          className="my-2"
          component="a"
          label={parseName(combo[1], router.locale ?? 'ru')}
          key={combo[1]}
          onClick={() => {
            setStack([...stack.slice(0, stack.indexOf(combo) + 1)]);
            router.push('/');
          }}
        />
      ))}
      {stack[stack.length - 1][0].id !== parentCategory?.id && (
        <StyledBreadcrumb
          className="my-2"
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
