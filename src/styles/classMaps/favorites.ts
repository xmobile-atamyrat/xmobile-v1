export const favoritesClasses = {
  // ordersIndexClasses.web.grid, but side by side from `xl` rather than `lg`:
  // with the filter rail beside the cards, the account rail would leave room
  // for only one card per row at 1024px.
  grid: 'w-full grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)] gap-7 pt-7 pb-12 items-start',
  mobileHeader: 'flex items-center justify-between gap-3',
};
