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
  langList: 'min-w-[110px] border-0 flex flex-col mt-[12px]',
  langListItem: 'px-[12px] gap-[10px] rounded-[10px]',
  langOptionRow: 'flex flex-row justify-start w-full items-center gap-[12px]',
  langOptionTxt: 'text-ink text-[15px] font-medium',
  langImg: 'w-[24px] h-[18px] rounded-[3px]',
};
