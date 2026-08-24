// Support & Privacy policy — shared classMap (see docs/redesign-plan.md architecture notes).
// Support mobile layout follows mockup XMobile.dc.html:2061-2082 (hero action cards + card-grouped
// contact rows + FAQ accordion); privacy-policy has no dedicated mockup screen, so it's retokenized
// plain legal text, wrapped in the app's established white-card-on-fill mobile convention.
export const privacyPolicyClasses = {
  boxes: {
    page: {
      web: 'w-full flex justify-center py-[60px]',
      mobile: 'w-full flex flex-col flex-1 bg-fill min-h-screen',
    },
    main: {
      web: 'w-[clamp(590px,_60vw,_1200px)] flex flex-col items-center',
      mobile: 'w-full flex flex-col items-center',
    },
    section: {
      web: 'flex flex-col w-full text-left gap-[12px] mb-[24px]',
      mobile:
        'flex flex-col w-full text-left gap-[8px] bg-white rounded-[16px] p-4 mb-3',
    },
    sectionsWrapper: {
      web: 'flex flex-col w-full px-[48px] py-[48px] items-center',
      mobile: 'flex flex-col w-full px-4 pt-4 pb-6',
    },
    list: {
      web: 'pl-[24px] mt-[4px]',
      mobile: 'pl-[20px] mt-[4px]',
    },
    listItem: {
      web: 'mb-[6px]',
      mobile: 'mb-[6px]',
    },
    subsection: {
      web: 'mt-[10px]',
      mobile: 'mt-[10px]',
    },
    subList: {
      web: 'pl-[24px]',
      mobile: 'pl-[20px]',
    },
    subListItem: {
      web: 'mb-[4px]',
      mobile: 'mb-[4px]',
    },
    deletionBox: {
      web: 'w-full mt-[8px] p-[20px] rounded-[16px] border border-hairline bg-fill flex flex-col gap-[10px]',
      mobile:
        'w-full mt-[6px] p-[14px] rounded-[14px] border border-hairline bg-fill flex flex-col gap-[8px]',
    },
  },
  h1: {
    web: 'font-bold text-[48px] leading-[60px] tracking-[0] mb-[40px] text-center text-ink',
    mobile:
      'font-bold text-[18px] leading-[24px] tracking-[0] text-left text-ink',
  },
  h2: {
    web: 'font-bold text-[22px] leading-[30px] text-ink',
    mobile: 'font-bold text-[15px] leading-[20px] text-ink',
  },
  p: {
    web: 'text-[16px] leading-[1.6] text-[#4A4959] whitespace-pre-line',
    mobile: 'text-[13px] leading-[1.6] text-[#4A4959] whitespace-pre-line',
  },
  subtitle: {
    web: 'text-[16px] leading-[1.6] text-[#4A4959] whitespace-pre-line font-semibold',
    mobile:
      'text-[13px] leading-[1.6] text-[#4A4959] whitespace-pre-line font-semibold',
  },
  link: 'text-navy underline hover:text-[#1A1258]',
  // Shared mobile header: circular back button + left-aligned title (matches orders/profile pattern).
  headerWrap: {
    web: 'hidden',
    mobile: 'flex items-center gap-3.5 bg-white px-4 pt-3 pb-4',
  },
  backButton: {
    web: 'hidden',
    mobile:
      'w-10 h-10 rounded-full bg-fill flex items-center justify-center flex-none',
  },
  headerTitle: {
    web: 'hidden',
    mobile: 'text-[18px] font-bold text-ink',
  },
  // Support-only pieces (mobile hero cards + contact card + FAQ), mockup 2061-2082.
  support: {
    intro: 'text-[13px] text-muted text-center mb-4',
    heroRow: 'flex gap-3 mb-5',
    heroChat: 'flex-1 bg-navy rounded-[16px] p-[16px] text-white flex flex-col',
    heroCall:
      'flex-1 bg-white border border-hairline rounded-[16px] p-[16px] flex flex-col',
    heroIconChat: 'w-[24px] h-[24px] mb-[10px] text-white',
    heroIconCall: 'w-[24px] h-[24px] mb-[10px] text-navy',
    heroTitleChat: 'text-[14px] font-bold text-white',
    heroTitleCall: 'text-[14px] font-bold text-ink',
    heroSubtitleChat: 'text-[11px] text-white/75 mt-[2px]',
    heroSubtitleCall: 'text-[11px] text-muted mt-[2px]',
    sectionLabel:
      'text-[12px] font-bold uppercase tracking-[0.06em] text-muted mb-[10px] mt-1',
    card: 'bg-white rounded-[16px] overflow-hidden mb-5',
    row: 'flex items-center gap-[14px] px-4 py-[14px] border-b border-fill last:border-b-0',
    rowIcon:
      'w-[38px] h-[38px] rounded-[11px] bg-[#F3F2F8] flex items-center justify-center flex-none text-navy',
    rowLabel: 'flex-1 text-left text-[14px] font-semibold text-ink',
    rowValue: 'text-[13px] text-muted',
    faqLabel:
      'text-[12px] font-bold uppercase tracking-[0.06em] text-muted mb-[10px] mt-1',
  },
};
