import { SORT_OPTIONS } from '@/pages/lib/constants';
import {
  Box,
  Divider,
  FormControl,
  MenuItem,
  Select,
  SelectChangeEvent,
  Typography,
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
  <Box
    onClick={onClick}
    sx={{
      px: 2,
      py: 1,
      borderRadius: '4px',
      border: '1px solid',
      borderColor: isActive ? '#000' : '#E0E0E0',
      backgroundColor: isActive ? '#000' : '#FFF',
      color: isActive ? '#FFF' : '#000',
      cursor: 'pointer',
      fontFamily: 'Inter, sans-serif',
      fontSize: '14px',
      fontWeight: 500,
      whiteSpace: 'nowrap',
      transition: 'all 0.2s',
    }}
  >
    {label}
  </Box>
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
      <Box>
        <Box display="flex" flexWrap="wrap" gap={1}>
          {sortOptions.map((opt) => (
            <SortChip
              key={opt.value}
              label={opt.label}
              isActive={
                value === opt.value ||
                (!value && opt.value === SORT_OPTIONS.NEWEST)
              }
              onClick={() => onChange(opt.value)}
            />
          ))}
        </Box>
      </Box>
    );
  }

  // desktop
  return (
    <Box display="flex" alignItems="center" gap={1}>
      <Typography
        sx={{
          fontFamily: 'Inter, sans-serif',
          fontSize: '14px',
          fontWeight: 600,
          color: '#303030',
        }}
      >
        {t('sortBy') || 'Sort by'}
      </Typography>
      <Divider
        orientation="vertical"
        flexItem
        sx={{ height: 20, bgcolor: '#BDBDBD', my: 'auto' }}
      />
      <FormControl variant="standard" sx={{ minWidth: 150 }}>
        <Select
          value={value}
          onChange={handleChange}
          displayEmpty
          inputProps={{ 'aria-label': 'Sort by' }}
          disableUnderline
          sx={{
            fontSize: '14px',
            fontWeight: 500,
            '& .MuiSelect-select': {
              paddingTop: '2px',
              paddingBottom: '2px',
            },
          }}
          MenuProps={{
            PaperProps: {
              sx: {
                '& .MuiMenuItem-root': {
                  fontSize: '16px',
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 400,
                  color: '#303030',
                  paddingLeft: '16px',
                  paddingRight: '16px',
                  paddingTop: '8px',
                  paddingBottom: '8px',
                  '&.Mui-selected': {
                    backgroundColor: '#f5f5f5',
                    borderLeft: '4px solid #FF624C',
                    paddingLeft: '12px',
                    fontWeight: 700,
                    '&:hover': {
                      backgroundColor: '#f5f5f5',
                    },
                  },
                  '&:hover': {
                    backgroundColor: '#fafafa',
                  },
                },
              },
            },
          }}
        >
          {sortOptions.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
}
