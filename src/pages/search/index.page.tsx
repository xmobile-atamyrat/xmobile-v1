import Layout from '@/pages/components/Layout';
import { fetchBrands } from '@/pages/lib/apis';
import { usePlatform } from '@/pages/lib/PlatformContext';
import { useProductContext } from '@/pages/lib/ProductContext';
import {
  addRecentSearch,
  clearRecentSearches,
  getRecentSearches,
  removeRecentSearch,
} from '@/pages/lib/recentSearches';
import { BrandProps } from '@/pages/lib/types';
import { searchPageClasses } from '@/styles/classMaps/search';
import { fontClassName } from '@/styles/theme';
import { Box, InputBase } from '@mui/material';
import {
  ArrowUpRight,
  Clock,
  Search as SearchIcon,
  TrendingUp,
  X,
} from 'lucide-react';
import { GetServerSideProps } from 'next';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';

export const getServerSideProps: GetServerSideProps = async (context) => {
  return {
    props: {
      messages: (await import(`../../i18n/${context.locale}.json`)).default,
    },
  };
};

// Static, always-on trending topics — no real trending source, deliberately fixed.
const TRENDING = ['iPhone', 'Samsung', 'Redmi', 'AirPods', 'Xiaomi'];

export default function SearchPage() {
  const platform = usePlatform();
  const router = useRouter();
  const t = useTranslations();
  const { setSearchKeyword } = useProductContext();
  const [keyword, setKeyword] = useState('');
  const [recent, setRecent] = useState<string[]>([]);
  const [brands, setBrands] = useState<BrandProps[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Web keeps its search in the header — this entry screen is mobile-only.
  useEffect(() => {
    if (platform === 'web') router.replace('/product');
  }, [platform, router]);

  useEffect(() => {
    setRecent(getRecentSearches());
    inputRef.current?.focus();
    fetchBrands().then((data) =>
      setBrands(
        [...data].sort((a, b) => b.productCount - a.productCount).slice(0, 8),
      ),
    );
  }, []);

  const runSearch = (term: string) => {
    const q = term.trim();
    if (!q) return;
    setRecent(addRecentSearch(q));
    setSearchKeyword(q);
    router.push('/product');
  };

  if (platform === 'web') return null;

  return (
    <Layout>
      <Box className={searchPageClasses.container}>
        {/* Search field + Cancel */}
        <Box className={searchPageClasses.topRow}>
          <Box className={searchPageClasses.inputWrap}>
            <SearchIcon size={18} className="text-[#20166E] flex-shrink-0" />
            <InputBase
              inputRef={inputRef}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  runSearch(keyword);
                }
              }}
              placeholder={t('search')}
              className={`${searchPageClasses.input} ${fontClassName.className}`}
            />
            {keyword && (
              <button
                type="button"
                aria-label="clear"
                onClick={() => {
                  setKeyword('');
                  inputRef.current?.focus();
                }}
                className={searchPageClasses.clearBtn}
              >
                <X size={12} className="text-white" />
              </button>
            )}
          </Box>
          <button
            type="button"
            onClick={() => router.back()}
            className={`${searchPageClasses.cancel} ${fontClassName.className}`}
          >
            {t('cancel')}
          </button>
        </Box>

        <Box className={searchPageClasses.scroll}>
          {/* Recent searches */}
          {recent.length > 0 && (
            <>
              <Box className={searchPageClasses.sectionHead}>
                <span className={searchPageClasses.sectionTitle}>
                  {t('recentSearches')}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    clearRecentSearches();
                    setRecent([]);
                  }}
                  className={searchPageClasses.clearLink}
                >
                  {t('clear')}
                </button>
              </Box>
              <Box className={searchPageClasses.chipRow}>
                {recent.map((term) => (
                  <span key={term} className={searchPageClasses.chip}>
                    <Clock size={14} className="text-[#B6B5C2] flex-shrink-0" />
                    <button
                      type="button"
                      onClick={() => runSearch(term)}
                      className={fontClassName.className}
                    >
                      {term}
                    </button>
                    <button
                      type="button"
                      aria-label="remove"
                      onClick={() => setRecent(removeRecentSearch(term))}
                    >
                      <X size={13} className="text-[#B6B5C2]" />
                    </button>
                  </span>
                ))}
              </Box>
            </>
          )}

          {/* Trending now (static) */}
          <Box
            className={`${searchPageClasses.sectionTitle} ${searchPageClasses.trendingHead}`}
          >
            {t('trendingNow')}
          </Box>
          <Box>
            {TRENDING.map((topic) => (
              <button
                key={topic}
                type="button"
                onClick={() => runSearch(topic)}
                className={`${searchPageClasses.trendingItem} ${fontClassName.className}`}
              >
                <span className={searchPageClasses.trendingIcon}>
                  <TrendingUp size={15} className="text-[#E41E2B]" />
                </span>
                <span className={searchPageClasses.trendingText}>{topic}</span>
                <ArrowUpRight size={16} className="text-[#B6B5C2]" />
              </button>
            ))}
          </Box>

          {/* Popular brands */}
          {brands.length > 0 && (
            <>
              <Box
                className={`${searchPageClasses.sectionTitle} ${searchPageClasses.brandsHead}`}
              >
                {t('brands')}
              </Box>
              <Box className={searchPageClasses.brandRow}>
                {brands.map((brand) => (
                  <button
                    key={brand.id}
                    type="button"
                    onClick={() =>
                      router.push({
                        pathname: '/product',
                        query: { brandIds: brand.id },
                      })
                    }
                    className={`${searchPageClasses.brandChip} ${fontClassName.className}`}
                  >
                    {brand.name}
                  </button>
                ))}
              </Box>
            </>
          )}
        </Box>
      </Box>
    </Layout>
  );
}
