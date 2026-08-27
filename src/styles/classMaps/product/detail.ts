export const detailPageClasses = {
  boxes: {
    // Spec 1504: gallery | info | buy box. The mockup's fixed 520/1fr/340 needs
    // ~1300px, but `web` starts at MUI's md (900px) — so below xl the buy box
    // takes its own column beside a stacked gallery+info instead of a third one.
    // Children are placed explicitly by grid line (see the col-start/row-start
    // classes on images / sideInfo / buyBox / detail) so both shapes reuse one DOM.
    main: {
      web: 'w-full grid gap-8 pb-10 grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,520px)_minmax(0,1fr)_340px]',
      // pb-[60px] clears the fixed AddToCart bar; the bottom nav's own 64px comes from Layout
      mobile:
        'w-full h-full flex flex-col px-4 justify-center items-center mx-auto mt-[16px] pb-[60px]',
    },
    images: {
      web: 'col-start-1 row-start-1 flex flex-col min-w-0',
      mobile: 'relative flex flex-col w-full h-auto -mx-4',
    },
    video: {
      web: 'flex flex-row h-auto mt-4 justify-center items-center',
      mobile: 'flex mt-[30px] mb-[-40px] flex-row justify-center items-center',
    },
    sideInfo: {
      web: 'col-start-1 row-start-2 xl:col-start-2 xl:row-start-1 flex flex-col min-w-0',
      mobile:
        'flex flex-col min-w-[88.78vw] min-h-[11.7vw] p-0 justify-start items-center mt-[16px]',
    },
    // Spec 1528: sticky-feeling card holding price / stock / promises / cart.
    // row-span-2 below xl so it sits alongside the stacked gallery+info.
    buyBox: {
      web: 'col-start-2 row-start-1 row-end-3 xl:col-start-3 xl:row-end-2 h-fit flex flex-col gap-[18px] border border-hairline rounded-[18px] p-6 shadow-[0_14px_34px_rgba(20,16,60,0.06)]',
      mobile: 'hidden',
    },
    // Spec 1540: specs strip. Spans the gallery+info columns only, so the rows
    // keep the mockup's width instead of stretching across the whole viewport.
    detail: {
      web: 'col-start-1 col-end-3 row-start-3 xl:row-start-2 flex flex-col pb-6',
      mobile:
        'min-w-[88.78vw] h-auto flex p-0 gap-0 justify-start items-start mx-auto mt-[-30px] mb-[100px]',
    },
    info: {
      web: 'flex flex-col',
      mobile: 'flex flex-col items-start w-full',
    },
  },
  circProgress: {
    web: 'w-[30px] h-[30px]',
    mobile: 'w-[24px] h-[24px]',
  },
  // Web info column (spec 1517-1524)
  brandEyebrow:
    'text-[13px] font-semibold text-muted uppercase tracking-[0.1em] mb-2',
  webDescription: 'text-[15px] leading-[1.65] text-[#4A4959] max-w-[440px]',
  optionGroup: 'mt-[22px]',
  optionLabel: 'text-[14px] font-bold text-ink mb-3',
  optionRow: 'flex flex-row flex-wrap gap-3',
  // Circular color swatches (spec 1523) — backgroundColor comes from the real
  // Color.hex, so only the ring/opacity states live here.
  swatch: {
    base: 'w-[38px] h-[38px] rounded-full flex-shrink-0 transition-all',
    selected:
      'border-2 border-navy shadow-[inset_0_0_0_3px_#fff] cursor-pointer',
    default: 'border border-hairline cursor-pointer',
    disabled: 'border border-hairline opacity-40 cursor-default',
  },
  // Web buy box (spec 1528-1533)
  buyBox: {
    priceRow: 'flex flex-row items-baseline gap-[10px]',
    price:
      'font-[800] text-[32px] leading-none tracking-[-0.02em] text-navy whitespace-nowrap',
    priceUnit: 'text-[16px] font-semibold text-muted',
    stockIn:
      'flex flex-row items-center gap-2 text-[14px] font-semibold text-[#1F8A5B]',
    stockOut:
      'flex flex-row items-center gap-2 text-[14px] font-semibold text-muted',
    stockIcon: 'w-[18px] h-[18px] flex-shrink-0',
    promises: 'flex flex-col gap-[10px]',
    promiseRow:
      'flex flex-row items-center gap-[10px] text-[13px] text-[#4A4959]',
    promiseIcon: 'w-[17px] h-[17px] text-navy flex-shrink-0',
    outOfStock:
      'w-full h-[54px] bg-fill rounded-[14px] flex items-center justify-center font-[700] text-[15px] tracking-widest text-muted uppercase',
  },
  link: {
    web: 'flex flex-row no-underline text-[#000]',
    mobile: 'px-3 pb-3 flex items-center flex-col',
  },
  productName: {
    web: 'text-ink font-[800] text-[30px] leading-[1.15] tracking-[-0.02em] mb-3',
    mobile:
      'text-ink font-bold text-[23px] leading-[1.2] tracking-[-0.01em] text-left',
  },
  cardMedia: {
    web: 'w-full h-full object-contain cursor-pointer',
    mobile: 'w-full h-full object-contain',
  },
  // Web specs strip (spec 1542-1552). Web-only — the mobile spec cards are
  // rendered inline in [slug].page.tsx, they never read these keys.
  specs: {
    // "Reviews" / "Delivery & returns" tabs are skipped (no Review model, no
    // per-product delivery data), so the single remaining tab renders as an
    // underlined section heading rather than a one-item tab bar.
    tabBar: 'flex flex-row gap-7 border-b border-hairline mb-[22px]',
    tabActive:
      'text-[15px] font-bold text-navy pb-3 border-b-2 border-navy -mb-px',
    grid: 'grid grid-cols-2 gap-x-10',
    row: 'flex flex-row justify-between items-start gap-4 py-[13px] border-b border-[#F4F3F7]',
    rowKey: 'text-[14px] text-muted',
    rowVal: 'text-[14px] font-semibold text-ink text-right',
    proseBlock: 'mt-6',
    proseTitle: 'text-[15px] font-bold text-ink mb-2',
    proseLine: 'text-[14px] leading-[1.65] text-[#4A4959]',
  },
  dialogImg: {
    web: 'w-[90vw] h-auto',
    mobile: 'w-auto h-[90vw] object-contain',
  },
  // Floating back button over the mobile gallery (sole back affordance on mobile —
  // the mobile Appbar returns null on non-home pages). Web uses the app header instead.
  backButton: {
    web: 'hidden',
    mobile:
      'self-start mt-1 mb-2 w-10 h-10 rounded-full bg-white shadow-[0_2px_10px_rgba(20,16,60,0.10)] flex items-center justify-center active:scale-95 transition-transform',
  },
  backIcon: {
    web: 'hidden',
    mobile: 'w-5 h-5 text-navy',
  },
  gallery: {
    // Web (spec 1506-1513): 72px thumbnail rail on the left, rounded-20 fill
    // frame on the right. The rail is absolutely positioned so the square main
    // image is the only in-flow child — otherwise a product with more than ~4
    // images makes the rail taller than the frame and it hangs off the bottom.
    wrapper: {
      web: 'relative w-full',
      mobile: 'relative w-full',
    },
    // Gutter for the rail (72px + 14px gap), applied to the WRAPPER as padding
    // rather than as a margin/width on the frame — the frame already carries
    // `w-full`, and a second width utility on the same element is decided by
    // stylesheet order, not class order, so it silently lost and the frame
    // overflowed into the info column.
    wrapperWithRail: 'pl-[86px]',
    mainImage: {
      web: 'relative w-full aspect-square rounded-[20px] bg-fill overflow-hidden flex justify-center items-center',
      mobile:
        'relative w-full aspect-square bg-fill flex justify-center items-center overflow-hidden',
    },
    // mobile gallery overlays (design: dot indicators + "n / total" pill)
    counter:
      'absolute bottom-4 right-4 text-[11px] font-semibold text-white bg-[rgba(15,12,40,0.55)] px-3 py-1 rounded-full',
    dots: 'absolute bottom-4 left-0 right-0 flex justify-center items-center gap-[6px]',
    // inactive dots need contrast against the light #F5F5F8 gallery fill
    dot: 'w-[7px] h-[7px] rounded-full bg-[#C4C3CE] cursor-pointer transition-all',
    dotActive:
      'w-[20px] h-[7px] rounded-full bg-navy cursor-pointer transition-all',
    thumbnailStrip: {
      web: 'absolute left-0 top-0 bottom-0 w-[72px] flex flex-col gap-3 overflow-y-auto',
      mobile:
        'flex flex-row gap-3 mt-6 mb-3 justify-center overflow-x-auto px-2 w-full',
    },
    thumbnail: {
      // border-2 on every state so selecting one doesn't shift the rail by 1px
      base: 'cursor-pointer border-2 rounded-[12px] bg-white flex-shrink-0 overflow-hidden',
      inactive: 'border-hairline',
      active: 'border-navy',
      size: {
        web: 'w-[72px] h-[72px]',
        mobile: 'w-[80px] h-[80px]',
      },
    },
  },
};
