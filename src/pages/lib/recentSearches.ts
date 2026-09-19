// Per-device recent search history for the mobile search screen.
// ponytail: sessionStorage keeps it to the current browser session — swap
// `store()` to window.localStorage (one line) if it should persist longer.
const KEY = 'xm_recent_searches';
const MAX = 8;

const store = (): Storage | null =>
  typeof window === 'undefined' ? null : window.sessionStorage;

export const getRecentSearches = (): string[] => {
  try {
    const raw = store()?.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
};

const save = (list: string[]): string[] => {
  try {
    store()?.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable (private mode, quota) — keep the in-memory list */
  }
  return list;
};

/** Newest first, deduped case-insensitively, capped at MAX. */
export const addRecentSearch = (term: string): string[] => {
  const q = term.trim();
  if (!q) return getRecentSearches();
  const rest = getRecentSearches().filter(
    (t) => t.toLowerCase() !== q.toLowerCase(),
  );
  return save([q, ...rest].slice(0, MAX));
};

export const removeRecentSearch = (term: string): string[] =>
  save(getRecentSearches().filter((t) => t !== term));

export const clearRecentSearches = (): string[] => save([]);
