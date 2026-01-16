import { fetchBrands } from '@/pages/lib/apis';
import { FILTER_MAX_PRICE, SORT_OPTIONS } from '@/pages/lib/constants';
import { useLocale } from '@/pages/lib/hooks/useLocale';
import { ExtendedCategory } from '@/pages/lib/types';
import { parseName } from '@/pages/lib/utils';
import CheckIcon from '@mui/icons-material/Check';
import ExpandLess from '@mui/icons-material/ExpandLess';
import {
  Box,
  Checkbox,
  Collapse,
  FormControlLabel,
  InputAdornment,
  Paper,
  Slider,
  TextField,
  Typography,
} from '@mui/material';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import SortDropdown from './SortDropdown';

interface FilterSidebarProps {
  categories: ExtendedCategory[];
  selectedCategoryIds: string[];
  selectedBrandIds: string[];
  minPrice: string;
  maxPrice: string;
  sortBy?: string;
  onFilterChange: (filters: {
    categoryIds?: string[];
    brandIds?: string[];
    minPrice?: string;
    maxPrice?: string;
    sortBy?: string;
  }) => void;
  hideSections?: ('categories' | 'brands')[];
  variant?: 'sidebar' | 'mobile';
}

const FilterSection = ({
  title,
  children,
  open,
  onToggle,
  variant = 'sidebar',
}: {
  title: string;
  children: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  variant?: 'sidebar' | 'mobile';
}) => {
  return (
    <>
      <Box>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
          onClick={onToggle}
          sx={{ cursor: 'pointer' }}
        >
          <Typography
            variant="h6"
            fontFamily="Inter, sans-serif"
            fontWeight={700}
            fontSize={variant === 'mobile' ? '18px' : '20px'}
            lineHeight={variant === 'mobile' ? '24px' : '30px'}
            color="#303030"
          >
            {title}
          </Typography>
          <ExpandLess
            sx={{
              transform: open ? 'rotate(0deg)' : 'rotate(180deg)',
              transition: 'transform 0.2s',
            }}
          />
        </Box>
        <Collapse
          in={open}
          timeout="auto"
          unmountOnExit
          sx={{ pb: variant === 'mobile' ? 2 : 0 }}
        >
          {children}
        </Collapse>
      </Box>

      {variant !== 'mobile' && (
        <Box my={3} sx={{ borderBottom: '1px solid rgba(48, 48, 48, 0.25)' }} />
      )}
    </>
  );
};

export default function FilterSidebar({
  categories,
  selectedCategoryIds,
  selectedBrandIds,
  minPrice,
  maxPrice,
  sortBy,
  onFilterChange,
  hideSections = [],
  variant = 'sidebar',
}: FilterSidebarProps) {
  const t = useTranslations();
  const locale = useLocale();

  const [brands, setBrands] = useState<
    { id: string; name: string; productCount: number }[]
  >([]);
  const [limitBrands, setLimitBrands] = useState(true);

  // -- Section Visibility Logic --
  const [categoriesOpen, setCategoriesOpen] = useState(
    !hideSections.includes('categories'),
  );
  const [brandsOpen, setBrandsOpen] = useState(
    !hideSections.includes('brands'),
  );
  const [sortByOpen, setSortByOpen] = useState(true);
  const [priceOpen, setPriceOpen] = useState(true);

  // Sync with prop changes (e.g. Mode switch)
  useEffect(() => {
    if (hideSections.includes('categories')) {
      setCategoriesOpen(false);
    }
    if (hideSections.includes('brands')) {
      setBrandsOpen(false);
    }
  }, [hideSections]);

  useEffect(() => {
    (async () => {
      const data = await fetchBrands();
      setBrands(data);
    })();
  }, []);

  const [localPriceRange, setLocalPriceRange] = useState<number[]>([
    0,
    FILTER_MAX_PRICE,
  ]);

  useEffect(() => {
    const min = minPrice ? parseFloat(minPrice) : 0;
    const max = maxPrice ? parseFloat(maxPrice) : FILTER_MAX_PRICE;
    setLocalPriceRange([min, max]);
  }, [minPrice, maxPrice]);

  const handlePriceCommit = (
    _: Event | React.SyntheticEvent | Event,
    value: number | number[],
  ) => {
    const [min, max] = value as number[];
    onFilterChange({ minPrice: min.toString(), maxPrice: max.toString() });
  };

  const handleMinInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ minPrice: e.target.value });
  };
  const handleMaxInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ maxPrice: e.target.value });
  };

  const handleClearFilters = () => {
    onFilterChange({
      minPrice: '',
      maxPrice: '',
      categoryIds: [],
      brandIds: [],
      sortBy: SORT_OPTIONS.NEWEST,
    });
  };

  // Show ONLY Top Level Categories (Level 1, no parent)
  const topLevelCategories = categories.filter(
    (category) => !category.predecessorId,
  );

  const handleCategoryClick = (categoryId: string) => {
    const newIds = selectedCategoryIds.includes(categoryId)
      ? selectedCategoryIds.filter((cid) => cid !== categoryId)
      : [...selectedCategoryIds, categoryId];

    onFilterChange({
      categoryIds: newIds,
    });
  };

  const CustomCheckbox = ({
    checked,
    onChange,
  }: {
    checked: boolean;
    onChange?: () => void;
  }) => (
    <Checkbox
      checked={checked}
      onChange={onChange}
      disableRipple
      checkedIcon={
        <Box
          sx={{
            width: 20,
            height: 20,
            backgroundColor: variant === 'mobile' ? '#191919' : '#FF624C',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CheckIcon sx={{ color: 'white', fontSize: 16 }} />
        </Box>
      }
      icon={
        <Box
          sx={{
            width: 20,
            height: 20,
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid #BDBDBD',
            backgroundColor: 'white',
          }}
        />
      }
      sx={{ p: 0.5 }}
    />
  );

  // -- Brand Logic --
  const brandsToShow = limitBrands ? brands.slice(0, 7) : brands;

  const handleBrandToggle = (brandId: string) => {
    const newBrands = selectedBrandIds.includes(brandId)
      ? selectedBrandIds.filter((id) => id !== brandId)
      : [...selectedBrandIds, brandId];
    onFilterChange({ brandIds: newBrands });
  };

  const FilterItem = ({
    label,
    count,
    isSelected,
    onClick,
  }: {
    label: string;
    count?: number;
    isSelected: boolean;
    onClick: () => void;
  }) => (
    <Box display="flex" flexDirection="column">
      <FormControlLabel
        sx={{
          pl: 2,
          py: 0.5,
          mr: 0,
          alignItems: 'center',
          width: '100%',
        }}
        control={<CustomCheckbox checked={isSelected} onChange={onClick} />}
        label={
          <Box
            display="flex"
            justifyContent="space-between"
            width="100%"
            minWidth={180}
            alignItems="center"
          >
            <Typography
              variant="body2"
              fontFamily="Inter, sans-serif"
              fontSize="16px"
              fontWeight={isSelected ? 700 : 400}
              lineHeight="24px"
              color="#303030"
              sx={{ ml: 1 }}
            >
              {label}
            </Typography>
            {count !== undefined && (
              <Typography
                variant="body2"
                fontFamily="Inter, sans-serif"
                fontSize="16px"
                fontWeight={400}
                lineHeight="24px"
                color="#303030"
                sx={{ ml: 1 }}
              >
                ( {count} )
              </Typography>
            )}
          </Box>
        }
      />
    </Box>
  );

  return (
    <Box
      sx={{
        minWidth: variant === 'sidebar' ? 300 : '100%',
        display: variant === 'sidebar' ? { xs: 'none', md: 'block' } : 'block',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: variant === 'mobile' ? '100%' : 525,
          bgcolor: variant === 'mobile' ? '#fff' : '#f5f5f5',
          borderRadius: variant === 'mobile' ? 0 : '16px',
          p: variant === 'mobile' ? 0 : 3,
          position: variant === 'sidebar' ? 'sticky' : 'static',
          top: variant === 'sidebar' ? '20px' : 'auto',
          maxHeight: variant === 'sidebar' ? 'calc(100vh - 40px)' : 'none',
          overflowY: variant === 'sidebar' ? 'auto' : 'visible',
        }}
      >
        {!hideSections.includes('categories') && (
          <FilterSection
            title={t('categories') || 'Categories'}
            open={categoriesOpen}
            onToggle={() => setCategoriesOpen(!categoriesOpen)}
            variant={variant}
          >
            <Box sx={{ maxHeight: '300px', overflowY: 'auto' }}>
              {topLevelCategories.map((cat) => (
                <FilterItem
                  key={cat.id}
                  label={parseName(cat.name, locale)}
                  isSelected={selectedCategoryIds.includes(cat.id)}
                  onClick={() => handleCategoryClick(cat.id)}
                />
              ))}
            </Box>
          </FilterSection>
        )}

        <FilterSection
          title={t('brands') || 'Brands'}
          open={brandsOpen}
          onToggle={() => setBrandsOpen(!brandsOpen)}
          variant={variant}
        >
          <Box
            display="flex"
            flexDirection="column"
            sx={{ maxHeight: '300px', overflowY: 'auto' }}
          >
            {brands.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ pl: 1 }}>
                {t('noBrands') || 'No brands found'}
              </Typography>
            )}
            {brandsToShow.map((brand) => (
              <FilterItem
                key={brand.id}
                label={brand.name}
                count={brand.productCount}
                isSelected={selectedBrandIds.includes(brand.id)}
                onClick={() => handleBrandToggle(brand.id)}
              />
            ))}
            {brands.length > 7 && (
              <Box mt={1} pl={1}>
                <Typography
                  variant="body2"
                  fontFamily="Inter, sans-serif"
                  fontWeight={700}
                  fontSize="16px"
                  lineHeight="24px"
                  color="#303030"
                  sx={{
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    '&:hover': {
                      color: '#FF624C',
                    },
                  }}
                  onClick={() => setLimitBrands(!limitBrands)}
                >
                  {limitBrands
                    ? t('moreBrands') || 'More Brands'
                    : t('lessBrands') || 'Less Brands'}
                </Typography>
              </Box>
            )}
          </Box>
        </FilterSection>

        {variant === 'mobile' && (
          <>
            <FilterSection
              title={t('sortBy') || 'Sort by'}
              open={sortByOpen}
              onToggle={() => setSortByOpen(!sortByOpen)}
              variant={variant}
            >
              <SortDropdown
                variant="chips"
                value={sortBy || SORT_OPTIONS.NEWEST}
                onChange={(v) => onFilterChange({ sortBy: v })}
              />
            </FilterSection>
          </>
        )}

        <FilterSection
          title={t('price') || 'Price'}
          open={priceOpen}
          onToggle={() => setPriceOpen(!priceOpen)}
          variant={variant}
        >
          <Box px={1} pt={1}>
            <Box display="flex" gap={2} mb={2}>
              <TextField
                size="small"
                value={minPrice}
                onChange={handleMinInputChange}
                placeholder="0"
                sx={{
                  bgcolor: '#f4f4f4',
                  borderRadius: '10px',
                  opacity: 0.5,
                  '& .MuiOutlinedInput-root': {
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '16px',
                    fontWeight: 400,
                    lineHeight: '24px',
                    color: '#303030',
                    '& fieldset': {
                      borderColor: '#303030',
                    },
                    '&:hover fieldset': {
                      borderColor: '#303030',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#303030',
                    },
                  },
                }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Typography
                        fontFamily="Inter, sans-serif"
                        fontSize="16px"
                        fontWeight={400}
                        color="#303030"
                      >
                        TMT
                      </Typography>
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                size="small"
                value={maxPrice}
                onChange={handleMaxInputChange}
                placeholder={FILTER_MAX_PRICE.toString()}
                sx={{
                  bgcolor: '#f4f4f4',
                  borderRadius: '10px',
                  opacity: 0.5,
                  '& .MuiOutlinedInput-root': {
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '16px',
                    fontWeight: 400,
                    lineHeight: '24px',
                    color: '#303030',
                    '& fieldset': {
                      borderColor: '#303030',
                    },
                    '&:hover fieldset': {
                      borderColor: '#303030',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#303030',
                    },
                  },
                }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Typography
                        fontFamily="Inter, sans-serif"
                        fontSize="16px"
                        fontWeight={400}
                        color="#303030"
                      >
                        TMT
                      </Typography>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
            <Slider
              value={localPriceRange}
              onChange={(_, value) => setLocalPriceRange(value as number[])}
              onChangeCommitted={handlePriceCommit}
              valueLabelDisplay="auto"
              min={0}
              max={FILTER_MAX_PRICE}
              sx={{
                color: variant === 'mobile' ? '#191919' : '#FF624C',
                height: 6,
                '& .MuiSlider-thumb': {
                  width: 16,
                  height: 16,
                  backgroundColor: variant === 'mobile' ? '#191919' : '#FF624C',
                  border: '3px solid white',
                  boxShadow:
                    variant === 'mobile'
                      ? '0 0 0 1px #191919'
                      : '0 0 0 1px #FF624C',
                  '&:hover, &.Mui-focusVisible': {
                    boxShadow:
                      variant === 'mobile'
                        ? '0 0 0 8px rgba(25, 25, 25, 0.16)'
                        : '0 0 0 8px rgba(255, 98, 76, 0.16)',
                  },
                },
                '& .MuiSlider-track': {
                  backgroundColor: variant === 'mobile' ? '#191919' : '#FF624C',
                  border: 'none',
                },
                '& .MuiSlider-rail': {
                  backgroundColor: '#d9d9d9',
                  opacity: 1,
                },
              }}
            />
          </Box>
        </FilterSection>

        <Box display="flex" justifyContent="flex-start" mt={3}>
          <Typography
            onClick={handleClearFilters}
            sx={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '14px',
              fontWeight: 700,
              textDecoration: 'underline',
              color: '#303030',
              cursor: 'pointer',
              '&:hover': {
                opacity: 0.8,
              },
            }}
          >
            {t('clearFilters') || 'Clear Filters'}
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}
