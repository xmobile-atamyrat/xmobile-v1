import {
  Brand,
  Category,
  DollarRate,
  Product,
  User,
  UserRole,
} from '@prisma/client';
import { JwtPayload } from 'jsonwebtoken';
import { Dispatch, ReactElement, SetStateAction } from 'react';

import { SORT_OPTIONS } from './constants';

export interface ResponseApi<K = any> {
  success: boolean;
  data?: K;
  message?: string;
}

export interface BrandProps {
  id: string;
  name: string;
  productCount: number;
  createdAt: string | Date;
}

export type SortOption = (typeof SORT_OPTIONS)[keyof typeof SORT_OPTIONS];

export interface ExtendedCategory extends Category {
  products?: Product[];
  successorCategories?: ExtendedCategory[];
}

export interface ExtendedProduct extends Product {
  brand?: Brand | null;
}

export interface ProtectedUser extends Omit<User, 'password'> {}

export interface ChatSession {
  id: string;
  status: 'PENDING' | 'ACTIVE' | 'CLOSED';
  createdAt: string | Date;
  updatedAt: string | Date;
  users?: ProtectedUser[];
}

export interface GetMessagesRequest {
  type: 'get_messages';
  sessionId: string;
  cursorId?: string;
}

export interface ChatMessage {
  type: 'message';
  sessionId: string;
  senderId: string;
  senderRole: UserRole;
  content: string;
  tempId?: string;

  isRead?: boolean;
  messageId?: string;
  date?: Date | string;
  timestamp?: string;
  updatedAt?: Date | string;
  status?: 'sending' | 'sent' | 'error';
}

export interface HistoryResponseMessage {
  type: 'history';
  sessionId: string;
  messages: ChatMessage[];
}

export interface InAppNotification {
  id: string;
  userId: string;
  sessionId?: string | null; // Optional - only for CHAT_MESSAGE type
  orderId?: string | null; // Optional - only for ORDER_STATUS_UPDATE type
  type: 'CHAT_MESSAGE' | 'ORDER_STATUS_UPDATE';
  title?: string | null;
  content: string;
  isRead: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  readAt?: Date | string | null;
  session?: ChatSession; // Optional, when included in API response
  order?: {
    id: string;
    orderNumber: string;
    status: string;
  }; // Optional, when included in API response
}

export type ChatEvent =
  | ChatMessage
  | {
      type: 'ack';
      tempId?: string;
      timestamp?: string;
      success: boolean;

      date?: Date;
      messageId?: string;
      error?: string;
    }
  | {
      type: 'read';
      sessionId: string;
      messageIds: string[];
    }
  | {
      type: 'read_ack';
      sessionId: string;
      messageIds: string[];
    }
  | {
      type: 'session_update';
      sessionId: string;
      status: 'PENDING' | 'ACTIVE' | 'CLOSED';
      users?: ProtectedUser[];
    }
  | {
      type: 'new_session';
      session: ChatSession;
    }
  | {
      type: 'typing';
      sessionId: string;
      userId: string;
      isTyping: boolean;
    }
  | {
      type: 'error';
      errorMessage: string;
      errorCode?: number;
    }
  | {
      type: 'auth_refresh';
      accessToken: string;
      refreshToken: string;
    }
  | {
      type: 'notification';
      notification: InAppNotification;
    }
  | {
      type: 'notifications';
      notifications: InAppNotification[];
      unreadCount: number;
    }
  | {
      type: 'mark_notification_read';
      notificationIds: string[];
    }
  | {
      type: 'mark_notification_read_ack';
      notificationIds: string[];
      success: boolean;
    }
  | HistoryResponseMessage;

// Legacy alias to ease refactoring (deprecated)
export type ChatMessageProps = ChatEvent;

export type CategoryLayers = { [key: number]: ExtendedCategory[] };

export type CategoryStack = [ExtendedCategory, string][]; // [category, name][]

export type JwtExpiration = number | `${number}${'s' | 'm' | 'h' | 'd' | 'w'}`;
export interface JwtPayloadData extends JwtPayload {
  id: string;
}

export interface CategoryContextProps {
  categories: ExtendedCategory[];
  setCategories: Dispatch<SetStateAction<ExtendedCategory[]>>;
  selectedCategoryId?: string;
  setSelectedCategoryId: Dispatch<SetStateAction<string | undefined>>;
}

export interface UserContextProps {
  user?: User;
  setUser: Dispatch<SetStateAction<ProtectedUser>>;
  accessToken: string;
  setAccessToken: Dispatch<SetStateAction<string>>;
  isLoading: boolean;
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
  videoUrls?: string[];
  categoryId?: string;
  brandId?: string;
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

export interface PrevProductContextProps {
  prevProducts: Product[];
  setPrevProducts: Dispatch<SetStateAction<Product[]>>;
  prevSearchKeyword: string | undefined;
  setPrevSearchKeyword: Dispatch<SetStateAction<string | undefined>>;
  prevCategory: string | undefined;
  setPrevCategory: Dispatch<SetStateAction<string | undefined>>;
  prevPage: number | undefined;
  setPrevPage: Dispatch<SetStateAction<number | undefined>>;
}

export interface NavigatorConnection {
  effectiveType: 'slow-2g' | '2g' | '3g' | '4g';
  type:
    | 'bluetooth'
    | 'cellular'
    | 'ethernet'
    | 'none'
    | 'other'
    | 'unknown'
    | 'wifi'
    | 'wimax';
  onchange: () => void;
}

export interface NavigatorExtended extends Navigator {
  connection: NavigatorConnection;
}

type NetworkType = 'slow' | 'fast' | 'unknown';
export interface NetworkContextProps {
  network: NetworkType;
  setNetwork: Dispatch<SetStateAction<NetworkType>>;
}

export interface AbortControllerContextProp {
  abortControllersRef: React.MutableRefObject<Set<AbortController>>;
  createAbortController: () => AbortController;
  clearAbortController: (controller: AbortController) => void;
  clearAllAborts: () => void;
}

export interface CategoryName {
  en: string;
  ru: string;
  tk: string;
  ch: string;
}

export interface AddToCartProps {
  cartItemId?: string;
  userId?: string;
  quantity?: number;
  productId?: string;
  cartAction: 'add' | 'delete' | 'detail';
  price?: string;
  onDelete?: (message: string) => void;
  setTotalPrice?: Dispatch<SetStateAction<number>>;
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

export type FetchWithCredsType = <K>({
  accessToken,
  path,
  method,
  body,
}: {
  accessToken: string;
  path: string;
  method: string;
  body?: object;
}) => Promise<ResponseApi<K>>;

export interface DollarRateContextProps {
  rates: DollarRate[];
  setRates: Dispatch<SetStateAction<DollarRate[]>>;
}

// ============================================
// SEO TYPE DEFINITIONS
// ============================================

/**
 * @see https://schema.org/Product
 */
export interface ProductJsonLdData {
  '@context': 'https://schema.org';
  '@type': 'Product';
  name: string;
  description?: string;
  brand?: {
    '@type': 'Brand';
    name: string;
  };
  offers: {
    '@type': 'Offer';
    price: string;
    priceCurrency: 'TMT';
    url: string;
  };
  image: string[];
}

/**
 * @see https://schema.org/BreadcrumbList
 */
export interface BreadcrumbJsonLdItem {
  '@type': 'ListItem';
  position: number;
  name: string;
  item?: string; // URL - only present for non-current pages
}

/**
 * @see https://schema.org/BreadcrumbList
 */
export interface BreadcrumbListJsonLd {
  '@context': 'https://schema.org';
  '@type': 'BreadcrumbList';
  itemListElement: BreadcrumbJsonLdItem[];
}

export interface HreflangLink {
  locale: string;
  url: string;
}

export interface PageSeoData {
  // meta tags
  title: string;
  description: string;
  canonicalUrl: string;
  noIndex?: boolean; // If true, rendering <meta name="robots" content="noindex" />

  // og (social media sharing)
  ogTitle: string;
  ogDescription: string;
  ogImage?: string;
  ogLocale: string;
  ogType?: string;

  // multilanguage links
  hreflangLinks: HreflangLink[];

  // JSON-LD
  productJsonLd?: ProductJsonLdData;
  breadcrumbJsonLd?: BreadcrumbListJsonLd;
  organizationJsonLd?: Record<string, any>;
  localBusinessJsonLd?: Record<string, any> | Record<string, any>[];
}
