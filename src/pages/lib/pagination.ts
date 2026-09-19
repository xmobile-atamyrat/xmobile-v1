export const PAGINATION_ELLIPSIS = 'ellipsis' as const;

export type PaginationItem = number | typeof PAGINATION_ELLIPSIS;

/**
 * Page numbers to render in the desktop pagination control, with gaps
 * collapsed to a single ellipsis — see XMobile.dc.html:1473 (`‹ 1 2 3 … 12 ›`).
 *
 * Always keeps the first page, the last page, and the current page with one
 * neighbour on each side. Returns `[]` when there is nothing to paginate.
 */
export function buildPaginationItems(
  currentPage: number,
  totalPages: number,
): PaginationItem[] {
  if (!Number.isFinite(totalPages) || totalPages < 2) return [];

  const current = Math.min(Math.max(Math.round(currentPage), 1), totalPages);

  const wanted = new Set<number>([
    1,
    totalPages,
    current - 1,
    current,
    current + 1,
  ]);

  const pages = [...wanted]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);

  const items: PaginationItem[] = [];
  let previous = 0;
  pages.forEach((page) => {
    // A gap of exactly one page is cheaper to render than an ellipsis.
    if (previous > 0 && page - previous === 2) {
      items.push(previous + 1);
    } else if (previous > 0 && page - previous > 2) {
      items.push(PAGINATION_ELLIPSIS);
    }
    items.push(page);
    previous = page;
  });

  return items;
}

/** Total pages for a result set, given the API's fixed page size. */
export function getTotalPages(totalCount: number, perPage: number): number {
  if (!totalCount || totalCount < 1 || perPage < 1) return 0;
  return Math.ceil(totalCount / perPage);
}
