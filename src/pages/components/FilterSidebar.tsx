import {
  fetchBrands,
  fetchColors,
  fetchProductFilterOptions,
  ProductFilterOptions,
} from '@/pages/lib/apis';
import { FILTER_MAX_PRICE, SORT_OPTIONS } from '@/pages/lib/constants';
import { ExtendedCategory } from '@/pages/lib/types';
import { Color } from '@prisma/client';
import { parseName } from '@/pages/lib/utils';
import { fontClassName, hairline, ink, muted, navy, red } from '@/styles/theme';
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
import { Check, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import SortDropdown from './SortDropdown';

interface FilterSidebarProps {
  categories: ExtendedCategory[];
  selectedCategoryIds: string[];
  selectedBrandIds: string[];
  selectedColorIds?: string[];
  minPrice: string;
  maxPrice: string;
  sortBy?: string;
  onFilterChange: (filters: {
    categoryIds?: string[];
    brandIds?: string[];
    colorIds?: string[];
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
            className={fontClassName.className}
            fontWeight={700}
            fontSize={variant === 'mobile' ? '13px' : '14px'}
            lineHeight="20px"
            color={ink}
          >
            {title}
          </Typography>
          <ChevronDown
            size={18}
            color={muted}
            style={{
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
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
        <Box my={3} sx={{ borderBottom: `1px solid ${hairline}` }} />
      )}
    </>
  );
};

export default function FilterSidebar({
  categories,
  selectedCategoryIds,
  selectedBrandIds,
  selectedColorIds = [],
  minPrice,
  maxPrice,
  sortBy,
  onFilterChange,
  hideSections = [],
  variant = 'sidebar',
}: FilterSidebarProps) {
  const t = useTranslations();
  const router = useRouter();
  const locale = router.locale || 'en';

  const [brands, setBrands] = useState<
    { id: string; name: string; productCount: number }[]
  >([]);
  const [limitBrands, setLimitBrands] = useState(true);
  const [limitCategories, setLimitCategories] = useState(true);

  const [colors, setColors] = useState<Color[]>([]);
  const [filterOptions, setFilterOptions] = useState<ProductFilterOptions>({
    colors: [],
  });
  const [colorsOpen, setColorsOpen] = useState(true);

  useEffect(() => {
    (async () => {
      setColors(await fetchColors());
      setFilterOptions(await fetchProductFilterOptions());
    })();
  }, []);

  // Only show colors that are actually used by some product
  const colorsToShow = colors.filter((c) =>
    filterOptions.colors.includes(c.id),
  );

  const toggleColor = (value: string) => {
    const next = selectedColorIds.includes(value)
      ? selectedColorIds.filter((v) => v !== value)
      : [...selectedColorIds, value];
    onFilterChange({ colorIds: next });
  };

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
      colorIds: [],
      sortBy: SORT_OPTIONS.NEWEST,
    });
  };

  // Show ONLY Top Level Categories (Level 1, no parent)
  const topLevelCategories = categories.filter(
    (category) => !category.predecessorId,
  );
  const categoriesToShow = limitCategories
    ? topLevelCategories.slice(0, 7)
    : topLevelCategories;

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
            backgroundColor: navy,
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Check size={13} color="#fff" strokeWidth={2.5} />
        </Box>
      }
      icon={
        <Box
          sx={{
            width: 20,
            height: 20,
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1.5px solid #D6D5DE',
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
    isSelected,
    onClick,
  }: {
    label: string;
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
              className={fontClassName.className}
              fontSize="14px"
              fontWeight={isSelected ? 700 : 400}
              lineHeight="22px"
              color={isSelected ? ink : '#4A4959'}
              sx={{ ml: 1 }}
            >
              {label}
            </Typography>
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
          bgcolor: variant === 'mobile' ? '#fff' : '#F5F5F8',
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
            <Box display="flex" flexDirection="column">
              {categoriesToShow.map((cat) => (
                <FilterItem
                  key={cat.id}
                  label={parseName(cat.name, locale)}
                  isSelected={selectedCategoryIds.includes(cat.id)}
                  onClick={() => handleCategoryClick(cat.id)}
                />
              ))}
            </Box>
            {topLevelCategories.length > 7 && (
              <Box mt={1} pl={1}>
                <Typography
                  className={fontClassName.className}
                  fontWeight={700}
                  fontSize="13px"
                  lineHeight="20px"
                  color={navy}
                  sx={{
                    cursor: 'pointer',
                    '&:hover': {
                      color: red,
                    },
                  }}
                  onClick={() => setLimitCategories(!limitCategories)}
                >
                  {limitCategories
                    ? t('moreCategories') || 'More Categories'
                    : t('lessCategories') || 'Less Categories'}
                </Typography>
              </Box>
            )}
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
              <Typography
                className={fontClassName.className}
                fontSize="14px"
                color={muted}
                sx={{ pl: 1 }}
              >
                {t('noBrands') || 'No brands found'}
              </Typography>
            )}
            {brandsToShow.map((brand) => (
              <FilterItem
                key={brand.id}
                label={brand.name}
                isSelected={selectedBrandIds.includes(brand.id)}
                onClick={() => handleBrandToggle(brand.id)}
              />
            ))}
            {brands.length > 7 && (
              <Box mt={1} pl={1}>
                <Typography
                  className={fontClassName.className}
                  fontWeight={700}
                  fontSize="13px"
                  lineHeight="20px"
                  color={navy}
                  sx={{
                    cursor: 'pointer',
                    '&:hover': {
                      color: red,
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

        {colorsToShow.length > 0 && (
          <FilterSection
            title={t('color') || 'Color'}
            open={colorsOpen}
            onToggle={() => setColorsOpen(!colorsOpen)}
            variant={variant}
          >
            <Box
              display="flex"
              flexDirection="column"
              sx={{ maxHeight: '300px', overflowY: 'auto' }}
            >
              {colorsToShow.map((color) => (
                <Box key={color.id} display="flex" alignItems="center" pl={2}>
                  <CustomCheckbox
                    checked={selectedColorIds.includes(color.id)}
                    onChange={() => toggleColor(color.id)}
                  />
                  <Box
                    title={color.name}
                    onClick={() => toggleColor(color.id)}
                    sx={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      border: selectedColorIds.includes(color.id)
                        ? `2px solid ${navy}`
                        : '1px solid #D6D5DE',
                      backgroundColor: color.hex,
                      mx: 1,
                      cursor: 'pointer',
                    }}
                  />
                </Box>
              ))}
            </Box>
          </FilterSection>
        )}

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
                  bgcolor: '#fff',
                  borderRadius: '11px',
                  '& .MuiOutlinedInput-root': {
                    fontFamily: fontClassName.style.fontFamily,
                    fontSize: '14px',
                    fontWeight: 400,
                    lineHeight: '22px',
                    color: ink,
                    borderRadius: '11px',
                    '& fieldset': {
                      borderColor: hairline,
                    },
                    '&:hover fieldset': {
                      borderColor: '#D6D5DE',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: navy,
                    },
                  },
                }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Typography
                        className={fontClassName.className}
                        fontSize="13px"
                        fontWeight={400}
                        color={muted}
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
                  bgcolor: '#fff',
                  borderRadius: '11px',
                  '& .MuiOutlinedInput-root': {
                    fontFamily: fontClassName.style.fontFamily,
                    fontSize: '14px',
                    fontWeight: 400,
                    lineHeight: '22px',
                    color: ink,
                    borderRadius: '11px',
                    '& fieldset': {
                      borderColor: hairline,
                    },
                    '&:hover fieldset': {
                      borderColor: '#D6D5DE',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: navy,
                    },
                  },
                }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Typography
                        className={fontClassName.className}
                        fontSize="13px"
                        fontWeight={400}
                        color={muted}
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
                color: navy,
                height: 4,
                '& .MuiSlider-thumb': {
                  width: 18,
                  height: 18,
                  backgroundColor: '#fff',
                  border: `2px solid ${navy}`,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                  '&:hover, &.Mui-focusVisible': {
                    boxShadow: '0 0 0 8px rgba(32, 22, 110, 0.12)',
                  },
                },
                '& .MuiSlider-track': {
                  backgroundColor: navy,
                  border: 'none',
                },
                '& .MuiSlider-rail': {
                  backgroundColor: hairline,
                  opacity: 1,
                },
              }}
            />
          </Box>
        </FilterSection>

        <Box display="flex" justifyContent="flex-start" mt={3}>
          <Typography
            className={fontClassName.className}
            onClick={handleClearFilters}
            sx={{
              fontSize: '13px',
              fontWeight: 600,
              color: red,
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
