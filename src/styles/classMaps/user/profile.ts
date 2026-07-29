// Profile & Settings, see xmobile-app-redesign/project/XMobile.dc.html:763-813
// Navy header + card-grouped menu rows (icon-avatar · label · chevron).
export const profileClasses = {
  page: {
    web: 'w-full flex flex-col items-center pb-16',
    mobile: 'w-full flex flex-col flex-1 bg-fill',
  },
  header: {
    web: 'w-full max-w-[600px] bg-navy px-8 pt-8 pb-8 rounded-b-[26px] flex flex-col',
    mobile: 'w-full bg-navy px-5 pt-3 pb-7 rounded-b-[26px] flex flex-col',
  },
  headerTitle: 'text-white font-bold text-[20px] mb-5',
  // Guest (signed-out) state: plain title + navy hero card, see mockup XMobile.dc.html:945-953
  guestHeader: {
    web: 'w-full max-w-[600px] bg-white px-8 pt-6 pb-3 flex',
    mobile: 'w-full bg-white px-5 pt-3 pb-3 flex',
  },
  guestTitle: 'text-ink font-bold text-[24px] tracking-[-0.01em]',
  heroCard:
    'bg-navy rounded-[20px] px-[22px] py-7 flex flex-col items-center text-center mb-5',
  heroAvatar:
    'w-[72px] h-[72px] rounded-full bg-white/[0.12] flex items-center justify-center mb-4',
  heroAvatarIcon: 'w-[34px] h-[34px] text-white',
  heroTitle: 'text-white font-bold text-[19px] mb-[6px]',
  heroSubtitle: 'text-white/70 text-[13px] leading-[1.5] mb-5',
  heroSignIn:
    'w-full h-[50px] rounded-[14px] bg-white text-navy text-[15px] font-bold normal-case flex items-center justify-center mb-[10px]',
  heroCreate:
    'w-full h-[50px] rounded-[14px] border-[1.5px] border-white/35 text-white text-[15px] font-semibold normal-case flex items-center justify-center',
  rowValue: 'text-[14px] text-muted flex-none',
  avatarRow: 'flex items-center gap-[14px]',
  avatar:
    'w-16 h-16 rounded-full bg-white/[0.14] border-2 border-white/30 flex items-center justify-center flex-none',
  avatarTxt: 'text-white font-bold text-[22px] tracking-[0.02em]',
  avatarIcon: 'w-8 h-8 text-white',
  name: 'text-white font-bold text-[18px] leading-tight',
  contact: 'text-white/70 text-[13px] leading-tight mt-[2px]',
  content: {
    web: 'w-full max-w-[600px] px-4 pt-4 flex flex-col',
    mobile: 'w-full px-4 pt-4 pb-[88px] flex flex-col',
  },
  sectionLabel:
    'text-[12px] font-bold uppercase tracking-[0.06em] text-muted mt-2 mb-[10px] ml-1',
  card: 'bg-white rounded-[16px] overflow-hidden mb-3',
  row: 'flex items-center gap-[14px] px-4 h-[54px] w-full normal-case',
  rowBorder: 'border-b border-fill',
  rowIcon: {
    primary:
      'w-[38px] h-[38px] rounded-[11px] bg-[#EDEBF7] flex items-center justify-center flex-none',
    muted:
      'w-[38px] h-[38px] rounded-[11px] bg-fill flex items-center justify-center flex-none',
  },
  icon: {
    primary: 'w-[19px] h-[19px] text-navy',
    muted: 'w-[19px] h-[19px] text-[#4A4959]',
  },
  rowLabel: 'flex-1 text-left text-[15px] font-medium text-ink normal-case',
  chevron: 'w-[18px] h-[18px] text-[#B6B5C2] flex-none',
  logout:
    'w-full h-[52px] rounded-[15px] bg-[#FDECEE] text-red text-[15px] font-semibold flex items-center justify-center gap-2 normal-case mb-2',
  deleteBtn:
    'w-full h-[46px] rounded-[12px] bg-transparent text-muted text-[13px] font-medium flex items-center justify-center gap-[7px] normal-case',
  // Dialogs (sign out / delete account / language) — restyled to tokens.
  dialog: {
    main: {
      mobile:
        'w-[75vw] h-auto rounded-[16px] bg-white flex mx-auto my-auto justify-center py-[30px] px-[20px]',
      web: 'w-[500px] h-auto rounded-[16px] bg-white flex mx-auto my-auto justify-center py-[30px] px-[20px]',
    },
  },
  dialogTitle:
    'flex justify-center font-bold text-[20px] leading-[26px] text-ink',
  dialogBody: 'flex justify-center mt-[16px] px-[10px]',
  dialogText:
    'flex justify-center text-center font-medium text-[15px] leading-[20px] text-muted',
  dialogActions:
    'w-[80%] flex flex-row justify-between mt-[24px] mx-auto gap-3',
  dialogOption:
    'flex justify-center items-center flex-1 h-[46px] rounded-[11px] text-[15px] font-semibold normal-case',
  dialogCancel: 'border-[1.5px] border-hairline text-ink',
  dialogConfirm: 'bg-red text-white',
  // Language bottom sheet (mockup XMobile.dc.html:979-987): handle · title+close · radio rows · Apply.
  langSheet: {
    mobile:
      'w-full max-w-[440px] rounded-t-[26px] bg-white px-[22px] pt-[10px] pb-[34px] flex flex-col',
    web: 'w-[420px] rounded-[20px] bg-white px-[22px] pt-[18px] pb-[26px] flex flex-col',
  },
  langHandle:
    'w-10 h-[5px] rounded-full bg-[#E4E3EB] mx-auto mt-[6px] mb-[18px]',
  langHeader: 'flex items-center justify-between mb-[18px]',
  langTitle: 'text-ink font-bold text-[19px]',
  langClose:
    'w-8 h-8 rounded-full bg-fill flex items-center justify-center flex-none',
  langCloseIcon: 'w-[17px] h-[17px] text-muted',
  langOptions: 'flex flex-col gap-[10px] mb-[22px]',
  langRow:
    'flex items-center gap-[14px] h-14 rounded-[14px] px-4 border-[1.5px] normal-case w-full',
  langRowIdle: 'border-hairline bg-white',
  langRowActive: 'border-navy bg-[#F7F6FC]',
  langRowName: 'flex-1 text-left text-[15px] text-ink',
  langRadio: 'w-6 h-6 rounded-full flex items-center justify-center flex-none',
  langRadioIdle: 'border-[1.5px] border-[#D7D6E0]',
  langRadioActive: 'bg-navy',
  langRadioIcon: 'w-[15px] h-[15px] text-white',
  langApply:
    'w-full h-[54px] rounded-[15px] bg-navy text-white text-[16px] font-semibold normal-case flex items-center justify-center',
  langImg: 'w-[26px] h-[20px] rounded-[4px] flex-none',
};
