import { SORT_OPTIONS } from '@/pages/lib/constants';
import { fontClassName, hairline, ink, muted, navy } from '@/styles/theme';
import {
  FormControl,
  MenuItem,
  Select,
  SelectChangeEvent,
} from '@mui/material';
import { useTranslations } from 'next-intl';

interface SortDropdownProps {
  value: string;
  onChange: (value: string) => void;
  variant?: 'dropdown' | 'chips';
}

// mobile
const SortChip = ({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) => (
  <span
    onClick={onClick}
    className={`${fontClassName.className} cursor-pointer whitespace-nowrap rounded-full px-4 py-2 text-[13px] transition-colors ${
      isActive
        ? 'bg-navy font-semibold text-white'
        : 'bg-fill font-medium text-[#4A4959]'
    }`}
  >
    {label}
  </span>
);

export default function SortDropdown({
  value,
  onChange,
  variant = 'dropdown',
}: SortDropdownProps) {
  const t = useTranslations();

  const handleChange = (event: SelectChangeEvent) => {
    onChange(event.target.value);
  };

  const sortOptions = [
    {
      value: SORT_OPTIONS.PRICE_ASC,
      label: t('priceLowToHigh') || 'Cheap first',
    },
    {
      value: SORT_OPTIONS.PRICE_DESC,
      label: t('priceHighToLow') || 'Expensive first',
    },
    { value: SORT_OPTIONS.NEWEST, label: t('newest') || 'New' },
    { value: SORT_OPTIONS.A_Z, label: t('aToZ') || 'A to Z' },
  ];

  // mobile
  if (variant === 'chips') {
    return (
      <div className="flex flex-wrap gap-2">
        {sortOptions.map((sortOption) => (
          <SortChip
            key={sortOption.value}
            label={sortOption.label}
            isActive={
              value === sortOption.value ||
              (!value && sortOption.value === SORT_OPTIONS.NEWEST)
            }
            onClick={() => onChange(sortOption.value)}
          />
        ))}
      </div>
    );
  }

  // desktop — pill trigger, see xmobile-app-redesign/project/XMobile.dc.html:1458
  const selectedLabel =
    sortOptions.find((o) => o.value === value)?.label ||
    sortOptions.find((o) => o.value === SORT_OPTIONS.NEWEST)?.label;

  return (
    <FormControl sx={{ minWidth: 170 }}>
      <Select
        value={value}
        onChange={handleChange}
        displayEmpty
        inputProps={{ 'aria-label': 'Sort by' }}
        renderValue={() => `${t('sortBy') || 'Sort'}: ${selectedLabel}`}
        className={fontClassName.className}
        sx={{
          height: '38px',
          fontSize: '14px',
          fontWeight: 600,
          color: ink,
          bgcolor: '#fff',
          borderRadius: '10px',
          '& .MuiSelect-select': {
            paddingTop: 0,
            paddingBottom: 0,
            paddingLeft: '14px',
            display: 'flex',
            alignItems: 'center',
            height: '38px !important',
          },
          '& .MuiSelect-icon': { color: muted },
          '& .MuiOutlinedInput-notchedOutline': { borderColor: hairline },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: hairline,
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: navy,
          },
        }}
        MenuProps={{
          PaperProps: {
            sx: {
              mt: 1,
              borderRadius: '12px',
              border: `1px solid ${hairline}`,
              boxShadow: '0 8px 24px rgba(23,22,29,0.08)',
              '& .MuiMenuItem-root': {
                fontSize: '14px',
                fontFamily: fontClassName.style.fontFamily,
                fontWeight: 400,
                color: ink,
                paddingLeft: '16px',
                paddingRight: '16px',
                paddingTop: '8px',
                paddingBottom: '8px',
                '&.Mui-selected': {
                  backgroundColor: '#F7F6FA',
                  borderLeft: `3px solid ${navy}`,
                  paddingLeft: '13px',
                  fontWeight: 700,
                  '&:hover': {
                    backgroundColor: '#F7F6FA',
                  },
                },
                '&:hover': {
                  backgroundColor: '#F7F6FA',
                },
              },
            },
          },
        }}
      >
        {sortOptions.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
