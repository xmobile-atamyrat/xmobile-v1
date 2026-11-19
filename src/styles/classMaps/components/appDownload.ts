export const appDownloadClasses = {
  badge: {
    base: 'inline-flex flex-row items-center rounded-[10px] border shrink-0 transition-opacity hover:opacity-90',
    // Apple's own black badge carries a thin grey keyline.
    dark: 'bg-black text-white border-[#A6A6A6]',
    light: 'bg-white text-black border-white',
    textCol: 'flex flex-col items-start leading-none',
    caption: 'font-medium tracking-[0.02em] whitespace-nowrap',
    name: 'font-semibold tracking-[-0.01em] mt-[2px] whitespace-nowrap',
    // sm fits two side by side on a 360px phone.
    size: {
      md: {
        box: 'h-[44px] gap-2 pl-3 pr-4',
        icon: 'w-[22px] h-[22px]',
        caption: 'text-[9px]',
        name: 'text-[17px]',
      },
      sm: {
        box: 'h-[40px] gap-1.5 pl-2.5 pr-3',
        icon: 'w-[18px] h-[18px]',
        caption: 'text-[8px]',
        name: 'text-[15px]',
      },
    },
  },

  // Mobile home card, between the categories and the brand chips.
  homeBanner: {
    wrap: 'w-full px-5 mt-2 mb-6',
    card: 'relative overflow-hidden rounded-[20px] p-4 bg-gradient-to-br from-[#20166E] via-[#2A1F8A] to-[#3A2DA8] text-white shadow-[0_8px_24px_rgba(32,22,110,0.25)]',
    // Soft red and white glows in the corner give the flat navy some depth.
    glowRed:
      'pointer-events-none absolute -top-10 -right-8 w-[150px] h-[150px] rounded-full bg-[#E41E2B] opacity-30 blur-[40px]',
    glowWhite:
      'pointer-events-none absolute -bottom-14 right-10 w-[120px] h-[120px] rounded-full bg-white opacity-10 blur-[30px]',
    row: 'relative flex flex-row items-center gap-3',
    icon: 'w-[52px] h-[52px] rounded-[14px] ring-2 ring-white/25 shrink-0',
    title: 'text-[16px] font-bold leading-[1.25]',
    subtitle: 'text-[12px] leading-[1.4] text-white/70 mt-1',
    badgeRow: 'relative mt-4 flex flex-row flex-wrap items-center gap-2',
  },

  // Slim bar above the mobile header on every page except home.
  installBar: {
    bar: 'w-full flex flex-row items-center gap-2.5 h-[60px] pl-1.5 pr-3 bg-fill border-b border-hairline',
    close:
      'w-8 h-8 flex items-center justify-center rounded-full text-muted shrink-0',
    icon: 'w-[40px] h-[40px] rounded-[10px] shrink-0',
    textCol: 'flex flex-col min-w-0 flex-1',
    title: 'text-[14px] font-bold text-ink leading-tight truncate',
    subtitle: 'text-[12px] text-muted leading-tight truncate mt-0.5',
    cta: 'h-[32px] px-4 rounded-full bg-navy text-white text-[13px] font-semibold flex items-center shrink-0',
  },

  // Desktop footer column: QR code for the phone, plus both badges.
  footer: {
    col: 'flex flex-col items-start',
    body: 'flex flex-row items-start gap-4',
    qrBox: 'w-[104px] h-[104px] p-2 rounded-[12px] bg-white shrink-0',
    qr: 'w-full h-full',
    badges: 'flex flex-col gap-2',
    hint: 'text-[12px] leading-[1.5] text-white/55 mt-3 max-w-[260px]',
  },
};
