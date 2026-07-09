// Shared button style strings, see xmobile-app-redesign/project/XMobile.dc.html:143-154
// Full-width form buttons scale up on web (54px/16px/700) vs mobile (52px/15px/600) —
// confirmed at checkout "Place order" (line ~1683) and sign-in "Sign in" (line ~2130).
const fullWidth = {
  radius: 'rounded-[14px]',
  mobile: 'h-[52px] text-[15px] font-semibold',
  web: 'h-[54px] text-[16px] font-bold',
};

export const buttonClasses = {
  primary: {
    web: `w-full ${fullWidth.web} ${fullWidth.radius} bg-navy text-white`,
    mobile: `w-full ${fullWidth.mobile} ${fullWidth.radius} bg-navy text-white`,
  },
  buyNow: {
    web: `w-full ${fullWidth.web} ${fullWidth.radius} bg-red text-white`,
    mobile: `w-full ${fullWidth.mobile} ${fullWidth.radius} bg-red text-white`,
  },
  secondary: {
    web: `w-full ${fullWidth.web} ${fullWidth.radius} bg-[#F0EFF5] text-navy`,
    mobile: `w-full ${fullWidth.mobile} ${fullWidth.radius} bg-[#F0EFF5] text-navy`,
  },
  outlined: {
    web: `w-full ${fullWidth.web} ${fullWidth.radius} border-[1.5px] border-navy bg-white text-navy`,
    mobile: `w-full ${fullWidth.mobile} ${fullWidth.radius} border-[1.5px] border-navy bg-white text-navy`,
  },
  // Compact variants: no web/mobile size difference in spec (mobile component doc
  // and web wishlist "Add all to cart" both use 44px), kept flat.
  textLink:
    'h-[44px] rounded-[12px] bg-transparent text-navy text-[14px] font-semibold',
  danger:
    'h-[44px] rounded-[12px] bg-[#FDECEE] text-red text-[14px] font-semibold',
};
