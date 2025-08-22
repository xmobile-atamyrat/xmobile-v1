export const AddEditCategoriesDialogClasses = {
  dialog: {
    title: 'w-full flex justify-center',
    actions: 'mb-4 mr-4',
  },
  box: {
    in: 'flex flex-col gap-2',
    out: 'flex flex-col gap-4 p-2',
    full: 'flex flex-col gap-2 w-full',
    list: {
      mobile: 'flex flex-row justify-between items-start w-full',
      web: 'flex flex-col justify-between items-start w-full',
    },
    item: 'h-full w-full p-2 relative',
  },
  textField: {
    mobile: 'my-1 mr-2 min-w-[250px] w-1/3',
    web: 'my-1 min-w-[250px] w-full',
  },
  button: {
    mobile: 'my-1 mr-2 min-w-[250px] text-[16px] h-[56px] w-1/3',
    web: 'my-1 min-w-[250px] text-[16px] h-[56px] w-full',
  },
  imgTxtField: {
    mobile: 'w-[250px]',
    web: 'w-full',
  },
  icon: 'absolute right-0 top-0',
};
