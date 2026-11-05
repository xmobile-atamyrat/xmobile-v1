import { catalogClasses as cc } from '@/styles/classMaps/procurement/catalog';
import { fontClassName } from '@/styles/theme';
import { Box, ButtonBase, CircularProgress } from '@mui/material';
import { Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef } from 'react';

interface CatalogSearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  searching: boolean;
}

/** The app's search pill (fill, radius 14, icon, clear) pinned at the sheet top. */
export default function CatalogSearchField({
  value,
  onChange,
  placeholder,
  searching,
}: CatalogSearchFieldProps) {
  const t = useTranslations();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Box className={cc.searchWrap}>
      <Box className={cc.search}>
        <Search className={cc.searchIcon} aria-hidden />
        <input
          ref={inputRef}
          // The sheet opens to search; phones should raise the keyboard at once.
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          type="text"
          enterKeyHint="search"
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          aria-label={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            // Enter just hides the phone keyboard; results update as you type.
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          className={`${cc.searchInput} ${fontClassName.className}`}
        />
        {searching && (
          <Box className={cc.searchSpinner} role="progressbar">
            <CircularProgress size={18} sx={{ color: '#8B8A98' }} />
          </Box>
        )}
        {value !== '' && (
          <ButtonBase
            disableRipple
            className={cc.searchClear}
            aria-label={t('clear')}
            onClick={() => {
              onChange('');
              inputRef.current?.focus();
            }}
          >
            <X className="w-[18px] h-[18px]" />
          </ButtonBase>
        )}
      </Box>
    </Box>
  );
}
