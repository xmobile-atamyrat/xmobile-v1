import { SearchBar } from '@/pages/components/Appbar';
import { useEffect, useRef, useState } from 'react';

// How long typing has to pause before the search is sent.
export const PRICE_SEARCH_DELAY_MS = 300;

interface PriceSearchBoxProps {
  placeholder: string;
  /** Called with the typed text once typing pauses. */
  onSearch: (keyword: string) => void;
}

/**
 * The price table's search field.
 *
 * It holds the typed text itself, so a keystroke re-renders only this box. The
 * page hears about the text once typing pauses: re-rendering every row on every
 * letter froze the field. To empty it, remount it with a new `key`, which also
 * drops a search that is still waiting.
 */
export default function PriceSearchBox({
  placeholder,
  onSearch,
}: PriceSearchBoxProps) {
  const [text, setText] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <SearchBar
      searchKeyword={text}
      setSearchKeyword={setText}
      handleSearch={(keyword) => {
        clearTimeout(timer.current);
        timer.current = setTimeout(
          () => onSearch(keyword),
          PRICE_SEARCH_DELAY_MS,
        );
      }}
      searchPlaceholder={placeholder}
      width="100%"
    />
  );
}
