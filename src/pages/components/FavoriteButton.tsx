import { useFavoritesContext } from '@/pages/lib/FavoritesContext';
import { useUserContext } from '@/pages/lib/UserContext';
import { favoriteButtonClasses } from '@/styles/classMaps/components/favoriteButton';
import { ButtonBase } from '@mui/material';
import { Heart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useState } from 'react';

interface FavoriteButtonProps {
  productId: string;
  variant: 'card' | 'detail';
  onRemove?: () => void;
}

export default function FavoriteButton({
  productId,
  variant,
  onRemove,
}: FavoriteButtonProps) {
  const t = useTranslations();
  const router = useRouter();
  const { user, isLoading } = useUserContext();
  const { isFavorite, toggleFavorite } = useFavoritesContext();
  const favorite = isFavorite(productId);
  // Set by a tap, not by `favorite` changing, or every heart would animate when
  // the ids arrive after load.
  const [animating, setAnimating] = useState(false);

  const handleClick = () => {
    if (isLoading) return;
    // Favorites live on the account, so a guest has nowhere to keep one.
    if (user == null) {
      router.push('/user/signin');
      return;
    }
    setAnimating(true);
    if (favorite) onRemove?.();
    toggleFavorite(productId);
  };

  const animation = favorite
    ? favoriteButtonClasses.iconAdded
    : favoriteButtonClasses.iconRemoved;

  return (
    <ButtonBase
      disableRipple
      aria-label={favorite ? t('removeFromFavorites') : t('addToFavorites')}
      aria-pressed={favorite}
      onClick={handleClick}
      className={favoriteButtonClasses.button[variant]}
    >
      <Heart
        onAnimationEnd={() => setAnimating(false)}
        className={`${favoriteButtonClasses.icon[variant]} ${
          favorite
            ? favoriteButtonClasses.iconActive
            : favoriteButtonClasses.iconIdle
        } ${animating ? animation : ''}`}
      />
    </ButtonBase>
  );
}
