import { userOrdersComponentClasses } from './components';
import { userOrdersDetailClasses } from './detail';

export const userOrdersIndexClasses = {
  box: {
    web: 'w-full min-h-screen py-8',
    mobile: 'w-full min-h-screen px-4 py-4',
  },
  header: {
    web: 'flex flex-row justify-between items-center mb-6',
    mobile: 'flex flex-col gap-4 mb-4',
  },
  title: {
    web: 'text-2xl font-semibold',
    mobile: 'text-xl font-semibold',
  },
  filtersContainer: {
    web: 'mb-6',
    mobile: 'mb-4',
  },
  filtersBox: {
    web: 'flex flex-row gap-4 items-end',
    mobile: 'flex flex-col gap-3',
  },
  filterField: {
    web: 'min-w-[200px]',
    mobile: 'w-full',
  },
  emptyState: {
    web: 'text-center py-12',
    mobile: 'text-center py-8',
  },
  pagination: {
    web: 'flex flex-row justify-between items-center mt-6',
    mobile: 'flex flex-col gap-4 mt-4',
  },
};

export { userOrdersComponentClasses, userOrdersDetailClasses };
