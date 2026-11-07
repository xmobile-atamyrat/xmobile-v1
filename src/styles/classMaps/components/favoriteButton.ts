export const favoriteButtonClasses = {
  // `!` because these render on MUI ButtonBase, whose emotion rule resets the
  // background and border and would otherwise win.
  button: {
    card: 'absolute top-2 right-2 w-8 h-8 rounded-full !bg-white/90 !border !border-solid !border-hairline',
    detail:
      'shrink-0 w-11 h-11 rounded-full !bg-white !border !border-solid !border-hairline',
  },
  icon: {
    card: 'w-[18px] h-[18px]',
    detail: 'w-[22px] h-[22px]',
  },
  iconActive: 'text-red fill-current',
  iconIdle: 'text-muted',
  iconAdded: 'motion-safe:animate-favorite-pop',
  iconRemoved: 'motion-safe:animate-favorite-shrink',
  // Grid so the card still fills its row, as it does as a direct grid item.
  cardSlot: 'grid grid-cols-1 min-w-0',
  // The page drops the card when this ends, so it has to run even with reduced
  // motion, where it finishes at once instead.
  cardLeaving:
    'animate-favorite-card-leave motion-reduce:[animation-duration:1ms] pointer-events-none',
};
