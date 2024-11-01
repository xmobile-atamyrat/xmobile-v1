import { Category, Product, User } from '@prisma/client';
import { Dispatch, ReactElement, SetStateAction } from 'react';

export interface ResponseApi<K = any> {
  success: boolean;
  data?: K;
  message?: string;
}

export interface ExtendedCategory extends Category {
  products?: Product[];
  successorCategories?: ExtendedCategory[];
}

export type CategoryLayers = { [key: number]: ExtendedCategory[] };

export type CategoryStack = [ExtendedCategory, string][]; // [category, name][]

export interface CategoryContextProps {
  categories: ExtendedCategory[];
  setCategories: Dispatch<SetStateAction<ExtendedCategory[]>>;
  selectedCategoryId?: string;
  setSelectedCategoryId: Dispatch<SetStateAction<string | undefined>>;
  stack: CategoryStack;
  setStack: Dispatch<SetStateAction<CategoryStack>>;
  parentCategory: ExtendedCategory;
  setParentCategory: Dispatch<SetStateAction<ExtendedCategory>>;
}

export interface UserContextProps {
  user?: User;
  setUser: Dispatch<SetStateAction<User>>;
}

export interface DollarRateProps {
  rate: number;
  setRate: Dispatch<SetStateAction<number>>;
}

export interface EditCategoriesProps {
  open: boolean;
  dialogType?: 'add' | 'edit';
  categoryId?: string;
  categoryName?: string;
  imageUrl?: string | null;
}

export interface AddEditProductProps {
  open: boolean;
  dialogType?: 'add' | 'edit';
  id?: string;
  name?: string;
  imageUrls: string[];
  description?: string | null;
  price?: string | null;
  tags?: string[];
}

export interface DeleteCategoriesProps {
  categoryId?: string;
  open: boolean;
  imgUrl?: string | null;
}

export interface ProductContextProps {
  products: Product[];
  setProducts: Dispatch<SetStateAction<Product[]>>;
  selectedProduct?: Product;
  setSelectedProduct: Dispatch<SetStateAction<Product | undefined>>;
  searchKeyword?: string | undefined;
  setSearchKeyword: Dispatch<SetStateAction<string | undefined>>;
}

export interface CategoryName {
  en: string;
  ru: string;
  tk: string;
  ch: string;
}

export interface SnackbarProps {
  message: string;
  severity: 'success' | 'error' | 'info' | 'warning';
}

export interface CarouselArrowProps {
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export interface CarouselSettings {
  accessibility?: boolean; // Default: true; Enable tabbing and arrow key navigation
  adaptiveHeight?: boolean; // Default: false; Adjust the slide's height automatically
  arrows?: boolean; // Default: true; Display arrow navigation
  autoplay?: boolean; // Default: false; Enable auto play
  autoplaySpeed?: number; // Default: 3000; Auto play speed in milliseconds
  centerMode?: boolean; // Default: false; Enable center mode
  centerPadding?: string; // Default: '50px'; Side padding when center mode is enabled
  dots?: boolean; // Default: false; Display dot navigation
  dotsClass?: string; // Default: 'slick-dots'; Class name for the dot navigation container
  draggable?: boolean; // Default: true; Enable dragging/swiping
  fade?: boolean; // Default: false; Enable fade effect
  infinite?: boolean; // Default: true; Infinite loop sliding
  initialSlide?: number; // Default: 0; Index of the initial slide
  lazyLoad?: 'ondemand' | 'progressive'; // Default: 'ondemand'; Lazy load images
  pauseOnHover?: boolean; // Default: true; Pause auto play on hover
  responsive?: Array<{
    breakpoint: number; // Breakpoint value in pixels
    settings: Partial<CarouselSettings>; // Settings for the specific breakpoint
  }>;
  rtl?: boolean; // Default: false; Enable right-to-left mode
  slidesToShow?: number; // Default: 1; Number of slides to show at a time
  slidesToScroll?: number; // Default: 1; Number of slides to scroll at a time
  speed?: number; // Default: 500; Transition speed in milliseconds
  swipe?: boolean; // Default: true; Enable swipe navigation
  swipeToSlide?: boolean; // Default: false; Swipe to slide regardless of slidesToScroll
  touchMove?: boolean; // Default: true; Enable touch swipe/dragging
  touchThreshold?: number; // Default: 5; Amount of touch movement required to scroll
  useCSS?: boolean; // Default: true; Use CSS transitions/animations
  variableWidth?: boolean; // Default: false; Enable variable width slides
  vertical?: boolean; // Default: false; Enable vertical mode
  waitForAnimate?: boolean; // Default: true; Wait for animations to complete before allowing user interaction
  prevArrow?: ReactElement<CarouselArrowProps>; // Custom previous arrow
  nextArrow?: ReactElement<CarouselArrowProps>; // Custom previous arrow
}
