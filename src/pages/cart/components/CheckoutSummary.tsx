import { mobileBottomNavHeight } from '@/pages/lib/constants';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { cartCheckoutClasses } from '@/styles/classMaps/cart/checkout';
import { colors, fontClassName } from '@/styles/theme';
import { Box, Button, Typography } from '@mui/material';
import { ArrowRight, Banknote } from 'lucide-react';
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
        {platform === 'web' && (
          <>
            <Typography
              className={`${fontClassName.className} ${cartCheckoutClasses.web.title}`}
            >
              {t('orderSummary')}
            </Typography>
            <Box className={cartCheckoutClasses.web.rows}>
              <Box className={cartCheckoutClasses.web.row}>
                <Typography
                  className={`${fontClassName.className} ${cartCheckoutClasses.web.rowLabel}`}
                >
                  {t('subtotal')}
                </Typography>
                <Typography
                  className={`${fontClassName.className} ${cartCheckoutClasses.web.rowValue}`}
                >
                  {totalPrice.toFixed(2)} TMT
                </Typography>
              </Box>
              <Box className={cartCheckoutClasses.web.row}>
                <Typography
                  className={`${fontClassName.className} ${cartCheckoutClasses.web.rowLabel}`}
                >
                  {t('delivery')}
                </Typography>
                <Typography
                  className={`${fontClassName.className} ${cartCheckoutClasses.web.rowFree}`}
                >
                  {t('free')}
                </Typography>
              </Box>
            </Box>
          </>
        )}
        <Box className={cartCheckoutClasses.subtotalRow[platform]}>
          <Typography
            className={`${fontClassName.className} ${cartCheckoutClasses.subtotalLabel[platform]}`}
          >
            {platform === 'web' ? t('total') : `${t('totalAmount')}:`}
          </Typography>
          <Typography
            className={`${fontClassName.className} ${cartCheckoutClasses.subtotalValue[platform]}`}
            sx={{ color: colors.main }}
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
          <ArrowRight size={18} />
        </Button>
        {platform === 'web' && (
          <Box className={cartCheckoutClasses.web.note}>
            <Banknote className={cartCheckoutClasses.web.noteIcon} />
            <Typography
              className={`${fontClassName.className} ${cartCheckoutClasses.web.noteText}`}
              component="span"
            >
              {t('cashOnDelivery')}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
