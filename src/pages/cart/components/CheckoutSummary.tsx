import { mobileBottomNavHeight } from '@/pages/lib/constants';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { cartCheckoutClasses } from '@/styles/classMaps/cart/checkout';
import { colors, fontClassName } from '@/styles/theme';
import { Box, Button, Typography } from '@mui/material';
import { useTranslations } from 'next-intl';

interface CheckoutSummaryProps {
  totalPrice: number;
  onCheckoutClick: () => void;
}

export default function CheckoutSummary({
  totalPrice,
  onCheckoutClick,
}: CheckoutSummaryProps) {
  const t = useTranslations();
  const platform = usePlatform();

  return (
    <Box className={cartCheckoutClasses.container[platform]}>
      <Box
        className={cartCheckoutClasses.summaryBox[platform]}
        sx={
          platform === 'mobile'
            ? { paddingBottom: `${mobileBottomNavHeight}px` }
            : undefined
        }
      >
        <Box className={cartCheckoutClasses.subtotalRow[platform]}>
          <Typography
            className={`${fontClassName.className} ${cartCheckoutClasses.subtotalLabel[platform]}`}
          >
            {t('totalAmount')}:
          </Typography>
          <Typography
            className={`${fontClassName.className} ${cartCheckoutClasses.subtotalValue[platform]}`}
            sx={{
              color: platform === 'web' ? colors.main : '#1b1b1b',
            }}
          >
            {totalPrice.toFixed(2)} TMT
          </Typography>
        </Box>
        <Button
          className={cartCheckoutClasses.checkoutButton[platform]}
          onClick={onCheckoutClick}
          sx={{
            backgroundColor: colors.main,
            color: colors.white,
            '&:hover': {
              backgroundColor: colors.buttonHoverBg,
            },
          }}
        >
          <Typography
            className={`${fontClassName.className} ${cartCheckoutClasses.checkoutButtonText[platform]}`}
          >
            {t('checkout')}
          </Typography>
        </Button>
      </Box>
    </Box>
  );
}
