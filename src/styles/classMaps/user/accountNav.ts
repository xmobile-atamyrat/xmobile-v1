// Web account nav rail — profile card + nav card, see
// xmobile-app-redesign/project/XMobile.dc.html:1745-1755.
// Web-only by construction (the rail has no mobile counterpart: mobile's
// equivalent is the whole `/user` page), so this map has no platform keys.
export const accountNavClasses = {
  rail: 'flex flex-col gap-4 h-fit',
  profileCard:
    'bg-white border border-hairline rounded-[18px] p-[22px] flex items-center gap-[14px]',
  avatar:
    'w-14 h-14 rounded-full bg-navy text-white flex items-center justify-center flex-none',
  avatarTxt: 'text-[22px] font-bold leading-none',
  avatarIcon: 'w-7 h-7',
  identity: 'flex flex-col min-w-0',
  name: 'text-[16px] font-bold text-ink truncate',
  contact: 'text-[13px] text-muted truncate',
  navCard:
    'bg-white border border-hairline rounded-[18px] p-[10px] flex flex-col',
  row: 'flex items-center gap-3 px-[14px] py-[13px] rounded-[12px] text-[14px] w-full normal-case justify-start text-left',
  rowIdle: 'font-medium text-[#4A4959] hover:bg-fill',
  rowActive: 'font-semibold text-white bg-navy',
  rowDanger: 'font-medium text-red hover:bg-[#FDECEE]',
  icon: 'w-[19px] h-[19px] flex-none',
  iconIdle: 'text-muted',
  iconActive: 'text-white',
  iconDanger: 'text-red',
  label: 'flex-1 min-w-0 truncate',
  divider: 'h-px bg-[#F0EFF4] mx-[14px] my-[6px]',
};
