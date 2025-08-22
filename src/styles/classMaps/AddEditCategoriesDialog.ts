export const AddEditCategoriesDialogClasses = {
  dialog: {
    title: 'w-full flex justify-center',
    actions: 'mb-4 mr-4',
  },
  box: {
    flex: {
      gap: 'flex flex-col gap-2',
      gapP: 'flex flex-col gap-4 p-2',
      gapFull: 'flex flex-col gap-2 w-full',
      list: {
        web: 'flex flex-row justify-between items-start w-full',
        mobile: 'flex flex-col justify-between items-start w-full',
      },
    },
    item: 'h-full w-full p-2 relative',
  },
  textField: {
    web: 'my-1 mr-2 min-w-[250px] w-1/3',
    mobile: 'my-1 min-w-[250px] w-full',
  },
  button: {
    web: 'my-1 mr-2 min-w-[250px] text-[16px] h-[56px] w-1/3',
    mobile: 'my-1 min-w-[250px] text-[16px] h-[56px] w-full',
  },
  imgTxtField: {
    web: 'w-[250px]',
    mobile: 'w-full',
  },
  icon: 'absolute right-0 top-0',
};
