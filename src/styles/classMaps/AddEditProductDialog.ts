export const AddEditProductDialogClasses = {
  box: {
    flex: {
      gapP: 'flex flex-col gap-4 p-2',
      gap: 'flex flex-col gap-2',
      pad: 'flex flex-col p-2',
      col: 'flex flex-col',
      rowGapP: 'flex flex-row gap-2 p-2',
      rowGap: 'flex flex-row gap-2',
      rowEnd: 'flex flex-row justify-end',
      inline: 'inline-flex p-2 items-center text-xl',
      colGapP: {
        web: 'flex flex-col w-[600px] gap-2 p-2',
        mobile: 'flex flex-col w-[300px] gap-2 p-2',
      },
    },
    fullRel: 'h-full w-full p-2 relative',
    absZero: 'absolute right-0 top-0',
  },
  textField: {
    usual: {
      web: 'my-1 mr-2 w-1/3 min-w-[250px]',
      mobile: 'my-1 w-full',
    },
    price: {
      web: 'my-1 mr-2 w-2/3',
      mobile: 'my-1 w-full',
    },
    imageButton: {
      web: 'my-1 mr-2 w-[250px] text-[16px] h-[56px]',
      mobile: 'my-1 w-full text-[16px] h-[56px]',
    },
    absZeroLeft: 'absolute top-0 left-0 w-14',
  },
};
