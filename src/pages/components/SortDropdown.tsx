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
}

export default function SortDropdown({ value, onChange }: SortDropdownProps) {
  const t = useTranslations();

  const handleChange = (event: SelectChangeEvent) => {
    onChange(event.target.value);
  };

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
                    paddingLeft: '12px', // Adjust for border
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
          <MenuItem value="price_asc">
            {t('priceLowToHigh') || 'Price Low-to-High'}
          </MenuItem>
          <MenuItem value="price_desc">
            {t('priceHighToLow') || 'Price High-to-Low'}
          </MenuItem>
          <MenuItem value="newest">{t('new') || 'New'}</MenuItem>
          <MenuItem value="a_z">{t('aToZ') || 'A to Z'}</MenuItem>
        </Select>
      </FormControl>
    </Box>
  );
}
