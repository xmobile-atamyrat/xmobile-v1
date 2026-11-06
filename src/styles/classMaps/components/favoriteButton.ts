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
};
