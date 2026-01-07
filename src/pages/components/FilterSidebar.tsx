import { fetchBrands } from '@/pages/lib/apis';
import { SORT_OPTIONS } from '@/pages/lib/constants';
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
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Slider,
  TextField,
  Typography,
} from '@mui/material';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

interface FilterSidebarProps {
  categories: ExtendedCategory[];
  selectedCategoryIds: string[];
  selectedBrandIds: string[];
  minPrice: string;
  maxPrice: string;
  onFilterChange: (filters: {
    categoryIds?: string[];
    brandIds?: string[];
    minPrice?: string;
    maxPrice?: string;
    sortBy?: string;
  }) => void;
  hideSections?: ('categories' | 'brands')[];
}

const FilterSection = ({
  title,
  children,
  open,
  onToggle,
}: {
  title: string;
  children: React.ReactNode;
  open: boolean;
  onToggle: () => void;
}) => {
  return (
    <Box>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={1}
        onClick={onToggle}
        sx={{ cursor: 'pointer' }}
      >
        <Typography
          variant="h6"
          fontFamily="Inter, sans-serif"
          fontWeight={700}
          fontSize="20px"
          lineHeight="30px"
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
      <Collapse in={open} timeout="auto" unmountOnExit>
        {children}
      </Collapse>
    </Box>
  );
};

export default function FilterSidebar({
  categories,
  selectedCategoryIds,
  selectedBrandIds,
  minPrice,
  maxPrice,
  onFilterChange,
  hideSections = [],
}: FilterSidebarProps) {
  const t = useTranslations();
  const router = useRouter();
  const locale = router.locale || 'en';

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

  const [localPriceRange, setLocalPriceRange] = useState<number[]>([0, 5000]); // Arbitrary default max

  useEffect(() => {
    const min = minPrice ? parseFloat(minPrice) : 0;
    const max = maxPrice ? parseFloat(maxPrice) : 5000;
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
  const topLevelCategories = categories.filter((c) => !c.predecessorId);

  const handleCategoryClick = (id: string) => {
    const newIds = selectedCategoryIds.includes(id)
      ? selectedCategoryIds.filter((cid) => cid !== id)
      : [...selectedCategoryIds, id];

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
            backgroundColor: '#FF624C',
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

  const CategoryItem = ({ cat }: { cat: ExtendedCategory }) => {
    const isSelected = selectedCategoryIds.includes(cat.id);
    const displayName = parseName(cat.name, locale);

    return (
      <ListItemButton
        onClick={() => handleCategoryClick(cat.id)}
        sx={{ pl: 2, py: 0.5 }}
      >
        <CustomCheckbox checked={isSelected} />
        <ListItemText
          primary={displayName}
          primaryTypographyProps={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: isSelected ? 700 : 400,
            fontSize: '16px',
            lineHeight: '24px',
            color: '#303030',
            ml: 1,
          }}
        />
      </ListItemButton>
    );
  };

  // -- Brand Logic --
  const brandsToShow = limitBrands ? brands.slice(0, 7) : brands;

  const handleBrandToggle = (brandId: string) => {
    const newBrands = selectedBrandIds.includes(brandId)
      ? selectedBrandIds.filter((id) => id !== brandId)
      : [...selectedBrandIds, brandId];
    onFilterChange({ brandIds: newBrands });
  };

  return (
    <Paper
      elevation={0}
      sx={{
        width: '100%',
        maxWidth: 300,
        bgcolor: '#f5f5f5',
        borderRadius: '16px',
        p: 3,
      }}
    >
      {/* Categories */}
      <FilterSection
        title={t('categories') || 'Categories'}
        open={categoriesOpen}
        onToggle={() => setCategoriesOpen(!categoriesOpen)}
      >
        <List dense>
          {topLevelCategories.map((cat) => (
            <CategoryItem key={cat.id} cat={cat} />
          ))}
        </List>
      </FilterSection>

      <Box my={3} sx={{ borderBottom: '1px solid rgba(48, 48, 48, 0.25)' }} />

      {/* Explicit Brands */}
      <FilterSection
        title={t('brands') || 'Brands'}
        open={brandsOpen}
        onToggle={() => setBrandsOpen(!brandsOpen)}
      >
        <Box display="flex" flexDirection="column">
          {brands.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ pl: 1 }}>
              {t('noBrands') || 'No brands found'}
            </Typography>
          )}
          {brandsToShow.map((brand) => {
            const isSelected = selectedBrandIds.includes(brand.id);
            return (
              <Box key={brand.id} display="flex" flexDirection="column">
                <FormControlLabel
                  sx={{ ml: 0.5, mr: 0, alignItems: 'center' }}
                  control={
                    <CustomCheckbox
                      checked={isSelected}
                      onChange={() => handleBrandToggle(brand.id)}
                    />
                  }
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
                        {brand.name}
                      </Typography>
                      <Typography
                        variant="body2"
                        fontFamily="Inter, sans-serif"
                        fontSize="16px"
                        fontWeight={400}
                        lineHeight="24px"
                        color="#303030"
                        sx={{ ml: 1 }}
                      >
                        ( {brand.productCount} )
                      </Typography>
                    </Box>
                  }
                />
              </Box>
            );
          })}
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

      <Box my={3} sx={{ borderBottom: '1px solid rgba(48, 48, 48, 0.25)' }} />

      {/* Price */}
      <FilterSection
        title={t('price') || 'Price'}
        open={priceOpen}
        onToggle={() => setPriceOpen(!priceOpen)}
      >
        <Box px={1} pt={1}>
          <Box display="flex" gap={2} mb={2}>
            <TextField
              size="small"
              value={minPrice}
              onChange={handleMinInputChange}
              placeholder="100"
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
              placeholder="5,000"
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
            onChange={(_, val) => setLocalPriceRange(val as number[])}
            onChangeCommitted={handlePriceCommit}
            valueLabelDisplay="auto"
            min={0}
            max={20000}
            sx={{
              color: '#FF624C',
              height: 6,
              '& .MuiSlider-thumb': {
                width: 16,
                height: 16,
                backgroundColor: '#FF624C',
                border: '3px solid white',
                boxShadow: '0 0 0 1px #FF624C',
                '&:hover, &.Mui-focusVisible': {
                  boxShadow: '0 0 0 8px rgba(255, 98, 76, 0.16)',
                },
              },
              '& .MuiSlider-track': {
                backgroundColor: '#FF624C',
                border: 'none',
              },
              '& .MuiSlider-rail': {
                backgroundColor: '#d9d9d9',
                opacity: 1,
              },
            }}
          />
          <Box display="flex" justifyContent="flex-start" mt={2}>
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
        </Box>
      </FilterSection>
    </Paper>
  );
}
