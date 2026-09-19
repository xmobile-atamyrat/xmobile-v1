// Web branch follows the mockup's 404 screen (XMobile.dc.html:2214-2224):
// oversized ghost numeral, icon tile, heading, real search + home button, and
// a row of real popular-category pills.
export const notFoundClasses = {
  container: {
    // The web 404 renders inside <Layout>, so it sits between the app header
    // and the footer — 560px of centred body rather than a full viewport.
    web: 'w-full flex flex-col items-center justify-center min-h-[560px] relative overflow-hidden px-12 py-16 bg-white',
    mobile: 'w-full h-[100dvh] flex flex-col bg-white',
  },
  header: {
    mobile: 'flex items-center w-full p-4',
    web: 'hidden',
  },
  // Mockup:2221 — 340px numeral washed into the page behind the content.
  ghost:
    'absolute inset-0 flex items-center justify-center pointer-events-none select-none text-[340px] leading-none font-extrabold tracking-[-0.04em] text-[#F3F2F8]',
  content: {
    web: 'relative flex flex-col items-center text-center max-w-[560px]',
    mobile: 'flex flex-col items-center justify-center flex-1 pb-[15vh]',
  },
  // Web replaces the illustration with the mockup's icon tile.
  image: {
    web: 'hidden',
    mobile: 'w-auto h-[180px] object-contain mb-6',
  },
  iconTile: {
    web: 'w-20 h-20 rounded-[22px] bg-[#EDEBF7] flex items-center justify-center mb-6',
    mobile: 'hidden',
  },
  heading: {
    web: 'font-extrabold text-[34px] leading-[1.15] tracking-[-0.02em] text-ink mb-3',
    mobile:
      'font-bold text-[22px] leading-[1.2] tracking-[-0.02em] text-ink mb-2',
  },
  subheading: {
    web: 'text-[16px] leading-[1.6] text-muted max-w-[420px] mb-7',
    mobile: 'text-[14px] leading-[1.5] text-muted text-center px-8 mb-10',
  },
  // Mockup:2223 — 360px fill-grey search + red action button. Ours is navy to
  // match every other primary CTA shipped in this redesign.
  searchRow: {
    web: 'flex flex-row items-center gap-3 justify-center mb-[26px]',
    mobile: 'hidden',
  },
  searchField:
    'w-[360px] max-w-full h-[50px] bg-fill rounded-[13px] flex flex-row items-center gap-[10px] px-4',
  searchInput: 'flex-1 text-[14px] text-ink',
  buttonContainer: {
    web: '',
    mobile: 'w-full px-5 mb-8',
  },
  button: {
    web: 'h-[50px] px-[26px] rounded-[13px] bg-navy hover:bg-[#1A1258] text-white font-bold text-[15px] normal-case whitespace-nowrap',
    mobile:
      'bg-navy hover:bg-[#1A1258] text-white font-semibold py-3.5 px-8 rounded-[14px] w-full normal-case text-[16px]',
  },
  // Real popular root categories (Category.popular), not the mockup's
  // hardcoded Phones/Laptops/Audio/Flash deals.
  pills: {
    web: 'flex flex-row flex-wrap gap-[10px] justify-center',
    mobile: 'hidden',
  },
  pill: 'text-[13px] font-semibold bg-white !border !border-solid !border-hairline text-navy px-4 py-[9px] rounded-full normal-case hover:!border-navy',
};
