import { usePlatform } from '@/pages/lib/PlatformContext';
import { profileClasses } from '@/styles/classMaps/user/profile';
import { colors, interClassname } from '@/styles/theme';
import { ArrowForwardIos } from '@mui/icons-material';
import { Button, CardMedia, Typography } from '@mui/material';
import { ReactNode } from 'react';

interface ProfileMenuItemProps {
  onClick: () => void;
  iconSrc?: string;
  IconComponent?: ReactNode;
  text: string;
  isLogOut?: boolean;
}

export default function ProfileMenuItem({
  onClick,
  iconSrc,
  IconComponent,
  text,
  isLogOut = false,
}: ProfileMenuItemProps) {
  const platform = usePlatform();

  const getButtonClass = () => {
    if (isLogOut) return profileClasses.boxes.sectionLogOut[platform];
    return profileClasses.boxes.sectionOrders[platform];
  };

  return (
    <Button
      className={getButtonClass()}
      disableRipple
      onClick={onClick}
      variant={platform === 'web' ? 'outlined' : 'text'}
      sx={{
        '&:hover': { backgroundColor: colors.lightRed },
      }}
    >
      {iconSrc ? (
        <CardMedia
          component="img"
          src={iconSrc}
          className={profileClasses.sectionIcon[platform]}
        />
      ) : (
        IconComponent
      )}

      <Typography
        className={`${interClassname.className} ${
          isLogOut
            ? profileClasses.typos.sectionTxtLogOut[platform]
            : profileClasses.typos.sectionTxt[platform]
        }`}
      >
        {text}
      </Typography>
      <ArrowForwardIos
        className={
          isLogOut
            ? profileClasses.iconLogOut[platform]
            : profileClasses.icons[platform]
        }
      />
    </Button>
  );
}
