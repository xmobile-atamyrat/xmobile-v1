import { usePlatform } from '@/pages/lib/PlatformContext';
import ProcurementSheet from '@/pages/procurement/components/ProcurementSheet';
import { useProcurement } from '@/pages/procurement/lib/ProcurementContext';
import {
  isDecimalDraft,
  parseDecimal,
} from '@/pages/procurement/lib/decimalInput';
import { procurementNumberFieldSx } from '@/styles/classMaps/procurement';
import { procurementShellClasses as s } from '@/styles/classMaps/procurement/shell';
import { fontClassName } from '@/styles/theme';
import {
  Box,
  ButtonBase,
  Menu,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { CURRENCY } from '@prisma/client';
import { Check, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ChangeEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';

interface CurrencyOption {
  currency: CURRENCY;
  name: string;
  rate: number | undefined;
}

/**
 * "1 USD = [rate] [currency]" for the open order. The rate is the shared
 * DollarRate of that currency and the TMT one recalculates the site's prices,
 * so it is saved only on commit (blur / Enter), never mid-typing ("19" on the
 * way to "19.7"). A USD order needs no rate, so it is read-only.
 */
export default function RateCard() {
  const t = useTranslations();
  const platform = usePlatform();
  const {
    selectedHistory,
    orderCurrencyRate,
    rates,
    changeRate,
    changeCurrency,
  } = useProcurement();
  const font = fontClassName.className;
  const currency = selectedHistory?.currency;
  const storedRate =
    orderCurrencyRate != null && orderCurrencyRate.currency === currency
      ? orderCurrencyRate.rate
      : undefined;

  const [text, setText] = useState(storedRate != null ? `${storedRate}` : '');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const lastCurrency = useRef(currency);

  // Follow the stored rate (initial load, currency switch, revert after a
  // failed save) without rewriting what was typed: "3.0" stays "3.0" once 3
  // is saved.
  useEffect(() => {
    const currencyChanged = lastCurrency.current !== currency;
    lastCurrency.current = currency;
    setText((prev) =>
      !currencyChanged &&
      storedRate != null &&
      parseDecimal(prev) === storedRate
        ? prev
        : `${storedRate ?? ''}`,
    );
  }, [currency, storedRate]);

  if (selectedHistory == null || currency == null) return null;

  const isUsd = currency === CURRENCY.USD;
  const parsed = parseDecimal(text);
  const invalid = text.trim() !== '' && (parsed == null || parsed <= 0);

  const options: CurrencyOption[] = [
    {
      currency: CURRENCY.USD,
      name: rates.find((r) => r.currency === CURRENCY.USD)?.name ?? 'US Dollar',
      rate: 1,
    },
    ...rates
      .filter((r) => r.currency !== CURRENCY.USD)
      .map((r) => ({ currency: r.currency, name: r.name, rate: r.rate })),
  ];

  const dirty = !invalid && parsed != null && parsed !== storedRate;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (isDecimalDraft(e.target.value)) setText(e.target.value);
  };

  const commit = () => {
    if (parsed == null || parsed <= 0) {
      // Empty / zero is never saved: put the stored rate back.
      setText(`${storedRate ?? ''}`);
      return;
    }
    if (parsed !== storedRate) changeRate(parsed);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
  };

  const pickCurrency = (next: CURRENCY) => {
    setSheetOpen(false);
    setMenuAnchor(null);
    if (next !== currency) changeCurrency(next);
  };

  const hints: { text: string; error?: boolean }[] = [];
  if (isUsd) hints.push({ text: t('procurementRateUsdHint') });
  else if (storedRate == null) {
    hints.push({ text: t('procurementRateMissing') });
  } else {
    if (invalid) hints.push({ text: t('procurementRateInvalid'), error: true });
    if (dirty) hints.push({ text: t('procurementRateSaveHint') });
    // The TMT rate is the store's default price rate (see api/prices/rate).
    if (currency === CURRENCY.TMT) {
      hints.push({ text: t('procurementRateSharedHint') });
    }
  }

  return (
    <Box className={s.rateCard[platform]} data-testid="procurement-rate-card">
      <Typography component="h2" className={`${font} ${s.rateLabel}`}>
        {t('rate')}
      </Typography>
      <Box className={s.rateRow}>
        <Typography className={`${font} ${s.rateFrom}`}>1 USD =</Typography>
        {isUsd || storedRate == null ? (
          <Box
            className={`${font} ${s.rateReadOnly}`}
            aria-label={t('rate')}
            data-testid="procurement-rate-readonly"
          >
            {isUsd ? '1' : '—'}
          </Box>
        ) : (
          <TextField
            value={text}
            onChange={handleChange}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            error={invalid}
            size="small"
            className={s.rateInputWrap}
            sx={procurementNumberFieldSx}
            inputProps={{
              inputMode: 'decimal',
              enterKeyHint: 'done',
              autoComplete: 'off',
              'aria-label': t('rate'),
              className: font,
            }}
          />
        )}
        <ButtonBase
          disableRipple
          onClick={(e) =>
            platform === 'mobile'
              ? setSheetOpen(true)
              : setMenuAnchor(e.currentTarget)
          }
          className={`${font} ${s.currencyBtn}`}
          aria-label={`${t('procurementOrderCurrency')}: ${currency}`}
          aria-haspopup={platform === 'mobile' ? 'dialog' : 'menu'}
        >
          {currency}
          <ChevronDown className={s.currencyIcon} />
        </ButtonBase>
      </Box>
      {hints.map((hint) => (
        <Typography
          key={hint.text}
          className={`${font} ${hint.error ? s.rateHintError : s.rateHint}`}
          role={hint.error ? 'alert' : undefined}
        >
          {hint.text}
        </Typography>
      ))}

      {platform === 'mobile' && (
        <ProcurementSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title={t('procurementOrderCurrency')}
          data-testid="procurement-currency-sheet"
        >
          <Box className={s.currencyList} role="radiogroup">
            {options.map((option) => {
              const active = option.currency === currency;
              return (
                <ButtonBase
                  key={option.currency}
                  disableRipple
                  role="radio"
                  aria-checked={active}
                  onClick={() => pickCurrency(option.currency)}
                  className={`${font} ${s.currencyRow} ${
                    active ? s.currencyRowActive : s.currencyRowIdle
                  }`}
                >
                  <span className={s.currencyCode}>{option.currency}</span>
                  <span
                    className={`${s.currencyName} ${
                      active ? 'font-semibold' : 'font-medium'
                    }`}
                  >
                    {option.name}
                  </span>
                  {option.currency !== CURRENCY.USD && option.rate != null && (
                    <span className={s.currencyRate}>{option.rate}</span>
                  )}
                  <span
                    className={`${s.radio} ${
                      active ? s.radioActive : s.radioIdle
                    }`}
                  >
                    {active && <Check className={s.radioIcon} />}
                  </span>
                </ButtonBase>
              );
            })}
          </Box>
        </ProcurementSheet>
      )}

      {platform === 'web' && (
        <Menu
          anchorEl={menuAnchor}
          open={menuAnchor != null}
          onClose={() => setMenuAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          PaperProps={{
            sx: {
              mt: '6px',
              minWidth: 240,
              borderRadius: '14px',
              border: '1px solid #ECECF1',
              boxShadow: '0 8px 30px rgba(23,22,29,0.10)',
            },
          }}
        >
          {options.map((option) => {
            const active = option.currency === currency;
            return (
              <MenuItem
                key={option.currency}
                selected={active}
                onClick={() => pickCurrency(option.currency)}
                className={`${font} flex items-center gap-3 min-h-[44px] text-[14px]`}
              >
                <span className={s.currencyCode}>{option.currency}</span>
                <span className="flex-1 min-w-0 text-ink">{option.name}</span>
                {active && <Check className="w-4 h-4 text-navy" />}
              </MenuItem>
            );
          })}
        </Menu>
      )}
    </Box>
  );
}
