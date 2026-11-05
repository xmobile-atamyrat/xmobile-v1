// Procurement → workflow stepper (components/WorkflowPanel.tsx +
// components/workflow/*): the four file steps (empty files → upload filled →
// calculate → final files) as a white card of numbered rows. On phones the
// card folds to its progress bar + the next step; desktop always shows all.
//
// Green = done, same tint as the prices tab's "buy here" mark.
export const workflowClasses = {
  card: {
    mobile: 'bg-white rounded-[16px] px-4 pt-2 pb-1',
    web: 'bg-white border border-hairline rounded-[18px] px-5 pt-3 pb-1',
  },
  header: 'flex items-center gap-3 w-full min-h-[44px] text-left normal-case',
  title: 'flex-1 min-w-0 text-[15px] font-bold text-ink leading-5',
  progressText:
    'text-[12px] font-semibold text-muted whitespace-nowrap [font-variant-numeric:tabular-nums]',
  toggle:
    'w-10 h-10 -mr-2 rounded-full flex items-center justify-center flex-none text-muted transition-transform',
  toggleOpen: 'rotate-180',
  progress: 'flex gap-1 mb-1',
  progressSegment: 'h-1 flex-1 rounded-full',
  progressDone: 'bg-[#16A34A]',
  progressTodo: 'bg-hairline',

  // --- step row ---
  step: 'flex items-center gap-3 py-3 w-full min-w-0',
  stepBorder: 'border-t border-fill',
  badge:
    'w-8 h-8 rounded-full flex items-center justify-center flex-none text-[13px] font-bold [font-variant-numeric:tabular-nums]',
  badgeDone: 'bg-[#EAF7EF] text-[#15803D]',
  badgeNext: 'bg-navy text-white',
  badgeIdle: 'bg-fill text-muted',
  stepText: 'flex-1 min-w-0',
  stepTitle: 'text-[14px] font-semibold text-ink leading-[18px] break-words',
  stepStatus: 'text-[12px] text-muted leading-4 mt-[3px] break-words',
  stepStatusDone: 'text-[12px] text-[#15803D] leading-4 mt-[3px] break-words',
  stepStatusWarn: 'text-[12px] text-[#B45309] leading-4 mt-[3px] break-words',
  // 40px tall touch target; labels are one short word so it fits at 360px.
  action:
    'h-10 px-3 rounded-[12px] text-[13px] font-semibold normal-case flex items-center justify-center gap-[6px] flex-none whitespace-nowrap disabled:opacity-40',
  actionPrimary: 'bg-navy text-white',
  actionSoft: 'bg-[#EDEBF7] text-navy',
  actionIcon: 'w-4 h-4 flex-none',

  // --- files sheet / upload result sheet ---
  fileRow: 'flex items-center gap-3 py-3 min-h-[60px] w-full min-w-0',
  fileRowBorder: 'border-t border-fill',
  fileTile:
    'w-[38px] h-[38px] rounded-[12px] flex items-center justify-center flex-none',
  fileTileOk: 'bg-[#EAF7EF] text-[#15803D]',
  fileTileError: 'bg-[#FDECEE] text-red',
  fileTileNeutral: 'bg-[#EDEBF7] text-navy',
  fileText: 'flex-1 min-w-0',
  fileName: 'text-[14px] font-semibold text-ink leading-[18px] break-words',
  fileMeta:
    'text-[12px] text-muted leading-4 mt-[2px] break-words [overflow-wrap:anywhere]',
  fileMetaError: 'text-[12px] text-red leading-4 mt-[2px] break-words',
  footerBtn: 'flex-1 min-w-0 !px-3 whitespace-nowrap',
};
