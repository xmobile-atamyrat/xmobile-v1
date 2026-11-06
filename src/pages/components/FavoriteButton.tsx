import { useFavoritesContext } from '@/pages/lib/FavoritesContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { favoriteButtonClasses } from '@/styles/classMaps/components/favoriteButton';
import { ButtonBase } from '@mui/material';
import { Heart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';

interface FavoriteButtonProps {
  productId: string;
  variant: 'card' | 'detail';
}

export default function FavoriteButton({
  productId,
  variant,
}: FavoriteButtonProps) {
  const t = useTranslations();
  const router = useRouter();
  const { user, isLoading } = useUserContext();
  const { isFavorite, toggleFavorite } = useFavoritesContext();
  const favorite = isFavorite(productId);

  const handleClick = () => {
    if (isLoading) return;
    // Favorites live on the account, so a guest has nowhere to keep one.
    if (user == null) {
      router.push('/user/signin');
      return;
    }
    toggleFavorite(productId);
  };

  return (
    <ButtonBase
      disableRipple
      aria-label={favorite ? t('removeFromFavorites') : t('addToFavorites')}
      aria-pressed={favorite}
      onClick={handleClick}
      className={favoriteButtonClasses.button[variant]}
    >
      <Heart
        className={`${favoriteButtonClasses.icon[variant]} ${
          favorite
            ? favoriteButtonClasses.iconActive
            : favoriteButtonClasses.iconIdle
        }`}
      />
    </ButtonBase>
  );
}
