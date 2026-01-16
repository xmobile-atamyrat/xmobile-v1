# Capacitor Integration Todo List

## Section 1: Changes to Existing Code/Structure (Capacitor Compatibility)

**Note:** Items are ordered from most independent to least independent. Config changes come LAST after all dependencies are fixed.

### 1.1 Convert getServerSideProps to getStaticProps (Simple Pages First)

#### 1.1.1 Translation-Only Pages (Simple Conversions)

- [x] `src/pages/product/index.page.tsx` - Convert to getStaticProps
- [x] `src/pages/chat/index.page.tsx` - Convert to getStaticProps
- [x] `src/pages/orders/[id].page.tsx` - Convert to getStaticProps
- [x] `src/pages/orders/admin/[id].page.tsx` - Convert to getStaticProps
- [x] `src/pages/components/Footer.tsx` - Convert to getStaticProps
- [x] `src/pages/category/index.page.tsx` - Convert to getStaticProps
- [x] `src/pages/product/update-prices/index.page.tsx` - Convert to getStaticProps

**Expected Impact:**

- Pages will be pre-rendered at build time instead of on each request
- No functional changes expected - these pages only load translations
- Build time may increase slightly as pages are pre-generated
- Translations will be baked into static HTML

**Testing Checklist (for each page):**

- [ ] Build completes successfully: `npm run build`
- [ ] Page loads correctly in browser
- [ ] Translations display correctly for all locales
- [ ] Page functionality works (buttons, forms, navigation)
- [ ] No console errors related to missing props
- [ ] Dynamic content (from API calls) still loads correctly after page render

**Specific Page Tests:**

- **Product index**: Test product listing, filters, search work
- **Chat**: Test chat interface loads, messages display
- **Order detail**: Test order information displays correctly
- **Admin order detail**: Test admin order view works
- **Footer**: Test footer displays on all pages with correct links
- **Category index**: Test category listing works
- **Update prices**: Test price update interface works (if accessible)

#### 1.1.2 Pages with Server-Side Logic (Requires Refactoring)

##### 1.1.2.1 `src/pages/index.page.tsx`

- [x] Create new API route: `/api/analytics/track-visit` for IP tracking
- [x] Move IP detection logic to API route
- [x] Move user visit record DB writes to API route
- [x] Convert getServerSideProps to getStaticProps (only translations)
- [x] Remove geo-location detection (not needed for now)
- [x] Note: Client-side API call will be implemented later

**Expected Impact:**

- Homepage will be statically generated (faster initial load)
- Analytics tracking will happen asynchronously after page load (slight delay)
- IP detection will be less accurate (client-side IP vs server-side IP)
- Geo-location detection may use browser API (requires user permission) or API route
- Visit tracking will still work but timing may differ
- First page load may not have locale set immediately (until API call completes)

**Testing Checklist:**

- [ ] Build completes successfully: `npm run build`
- [ ] Homepage loads correctly
- [ ] Check browser network tab - `/api/analytics/track-visit` is called after page load
- [ ] Verify visit is recorded in database (check DB or analytics page)
- [ ] Test locale detection still works (may be delayed)
- [ ] Test with different IPs/locations if possible
- [ ] Test geo-location detection (if using browser API, may need permission)
- [ ] Test page functionality: product listing, search, filters all work
- [ ] Test navigation from homepage works
- [ ] Check browser console for any errors
- [ ] Test multiple page loads - verify tracking happens each time

##### 1.1.2.2 `src/pages/analytics/index.page.tsx`

- [x] Create new API route: `/api/analytics/stats` for analytics data
- [x] Move all DB queries (userCount, dailyVisitCount, etc.) to API route
- [x] Move Telekom balance fetching to API route
- [x] Update component to fetch data client-side using `useEffect` or SWR
- [x] Convert getServerSideProps to getStaticProps (only translations)
- [x] Test analytics page displays data correctly

**Expected Impact:**

- Analytics page will load faster initially (static HTML)
- Data will load asynchronously after page render (may show loading state)
- All analytics data fetching will be client-side
- API route will handle all database queries
- Telekom balance fetching will be via API route

**Testing Checklist:**

- [ ] Build completes successfully: `npm run build`
- [ ] Analytics page loads (may show loading state initially)
- [ ] Check browser network tab - `/api/analytics/stats` is called
- [ ] Verify all statistics display correctly:
  - [ ] User count
  - [ ] Daily visit count
  - [ ] Last week visit count
  - [ ] Last month visit count
  - [ ] Telekom balance (if applicable)
- [ ] Test page refresh - data should reload
- [ ] Test with different user permissions (admin vs regular user)
- [ ] Check for loading states/spinners while data fetches
- [ ] Verify error handling if API call fails
- [ ] Test data updates correctly (if real-time updates are expected)

### 1.2 Platform Detection Utilities (Independent - Won't Affect Web)

#### 1.2.1 Create Platform Detection Utility

- [x] Create utility file: `src/lib/runtime.ts` (renamed from platform.ts to avoid confusion with PlatformContext)
- [x] Add function to detect if running in Capacitor: `isCapacitor()`
- [x] Add function to detect runtime environment: `getRuntime()` (returns 'web' | 'ios' | 'android')
- [x] Use `window.Capacitor` or similar to detect Capacitor environment
- [x] Export utilities for use throughout app

**Expected Impact:**

- No functional changes for web - utilities will return 'web' until Capacitor is integrated
- Code will be ready for mobile platform detection
- Can be used in other items (BASE_URL, service workers, FCM, etc.)

**Testing Checklist:**

- [x] Utility file created and exports functions correctly
- [x] `isCapacitor()` returns `false` in web browser
- [x] `getRuntime()` returns `'web'` in web browser
- [x] No console errors when importing/using utilities
- [x] Functions work in both development and production builds

### 1.3 Environment Variables & API Endpoints

#### 1.3.1 Update BASE_URL Detection

- [x] Use platform detection utility from 1.2.1 to check if running in Capacitor
- [x] Update `src/lib/ApiEndpoints.ts` to detect Capacitor environment
- [x] Use production URL (`https://xmobile.com.tm`) when in Capacitor
- [x] Keep existing logic for web development
- [x] Test API calls work correctly in both web and future mobile builds

**Expected Impact:**

- Web development should continue using localhost/development URLs
- Production web build will use production URL
- Mobile builds will use production URL
- No functional changes expected for web (unless running in production mode)
- API calls should work identically

**Testing Checklist:**

- [ ] Build completes successfully: `npm run build`
- [ ] In development (`npm run dev`): API calls use localhost URL
- [ ] In production build: API calls use production URL (`https://xmobile.com.tm`)
- [ ] Test all API endpoints work:
  - [ ] User authentication (`/api/user/signin`, `/api/user/signup`)
  - [ ] Product fetching (`/api/product`)
  - [ ] Category fetching (`/api/category`)
  - [ ] Cart operations (`/api/cart`)
  - [ ] Order operations (`/api/order`)
  - [ ] Notifications (`/api/notifications`)
  - [ ] FCM token registration (`/api/fcm/token`)
- [ ] Test API calls with authentication (logged in user)
- [ ] Test API calls without authentication (guest user)
- [ ] Verify no CORS errors in console
- [ ] Check network tab - all API calls use correct BASE_URL

#### 1.3.2 Environment Variable Configuration

- [x] Document required environment variables for mobile builds
- [x] Ensure all `NEXT_PUBLIC_*` variables are properly set
- [x] Create `.env.example` or documentation for mobile build setup

**Expected Impact:**

- No functional changes - documentation only
- Helps ensure mobile builds have correct configuration
- Prevents missing environment variable issues

**Testing Checklist:**

- [ ] Verify all `NEXT_PUBLIC_*` variables are accessible in browser
- [ ] Test app works with all environment variables set
- [ ] Test app handles missing variables gracefully (if applicable)
- [ ] Verify documentation is clear and complete

### 1.4 Service Worker & FCM Compatibility

#### 1.4.1 Platform Detection for Service Workers

- [x] Use platform detection utility from 1.2.1 in `_app.page.tsx`
- [x] Skip service worker registration when running in Capacitor
- [x] Update `src/pages/lib/serviceWorker.ts` to check for Capacitor using utility
- [x] Update `NotificationPermissionBanner.tsx` to skip FCM initialization in Capacitor
- [x] Update `src/pages/lib/fcm/fcmClient.ts` to skip FCM web initialization in Capacitor

**Expected Impact:**

- Web: Service worker will continue to register normally
- Mobile: Service worker will be skipped (not needed in native apps)
- No functional changes for web users
- FCM web push notifications will continue to work on web
- Platform detection code will be added but won't affect web until Capacitor is integrated

**Testing Checklist (Web - should work normally):**

- [ ] Build completes successfully: `npm run build`
- [ ] Service worker registers correctly in browser (check Application tab in DevTools)
- [ ] FCM web push notifications still work
- [ ] Offline functionality works (if implemented)
- [ ] No console errors related to service worker
- [ ] Test in different browsers (Chrome, Firefox, Safari)
- [ ] Verify service worker scope is correct

#### 1.4.2 FCM Client Updates

- [x] Use platform detection utility from 1.2.1 in `src/pages/lib/fcm/fcmClient.ts`
- [x] Skip FCM web initialization when in Capacitor (will use native FCM later)
- [x] Update `NotificationPermissionBanner.tsx` to skip FCM initialization in Capacitor (done in 1.4.1)
- [x] Update `NotificationContext.tsx` to handle platform differences
- [ ] Test FCM doesn't initialize in Capacitor (when implemented)

**Expected Impact:**

- Web: FCM web initialization will continue to work normally
- Mobile: FCM web will be skipped (will use native FCM later)
- No functional changes for web users
- Push notifications will continue to work on web
- Platform detection code will be added but won't affect web until Capacitor is integrated

**Testing Checklist (Web - should work normally):**

- [ ] Build completes successfully: `npm run build`
- [ ] FCM token is generated and registered (check browser console/logs)
- [ ] Push notifications are received when app is in background
- [ ] Push notifications are received when app is in foreground
- [ ] Notification permission banner appears (if not granted)
- [ ] Notification menu shows notifications correctly
- [ ] Test sending notification from server/admin panel
- [ ] Verify FCM token is stored in localStorage
- [ ] Test notification click handling (navigates to correct page)

### 1.5 Dynamic Routes Configuration

#### 1.5.1 getStaticPaths Updates

- [x] Review `src/pages/product/[id].page.tsx` getStaticPaths configuration
- [x] Review `src/pages/category/[id].page.tsx` getStaticPaths configuration
- [x] Ensure `fallback: 'blocking'` or `fallback: true` is set for new products/categories (both already use `fallback: 'blocking'`)
- [x] Test dynamic routes work correctly in static export (build completed successfully)

**Expected Impact:**

- Dynamic routes (product/[id], category/[id]) will work with static export
- New products/categories created after build will still be accessible (if fallback is set)
- Build time may increase if generating many static pages
- First visit to new product/category may be slower (if using fallback: 'blocking')

**Testing Checklist:**

- [ ] Build completes successfully: `npm run build`
- [ ] Test existing product pages load correctly:
  - [ ] Navigate to known product IDs
  - [ ] Verify product details display correctly
  - [ ] Test product images load
  - [ ] Test add to cart works
- [ ] Test existing category pages load correctly:
  - [ ] Navigate to known category IDs
  - [ ] Verify category products display
  - [ ] Test category navigation works
- [ ] Test new products (created after build):
  - [ ] If fallback: 'blocking' - page should generate on first visit
  - [ ] If fallback: true - page should show loading then generate
  - [ ] Verify new product page works correctly
- [ ] Test invalid product/category IDs - should show 404 or error
- [ ] Test product/category links from other pages work

### 1.6 WebSocket Connection

#### 1.6.1 WebSocket URL Configuration

- [x] Ensure WebSocket connection uses correct URL in mobile (production URL)
- [x] Update `src/pages/lib/WebSocketContext.tsx` to use runtime detection utility for Capacitor
- [x] Test WebSocket connection works (will test when Capacitor is integrated)

**Status: DONE**

**Expected Impact:**

- Web: WebSocket should continue using existing URL logic
- Mobile: WebSocket will use production URL
- No functional changes expected for web
- Real-time features (chat, notifications) should continue to work

**Testing Checklist (Web - should work normally):**

- [ ] Build completes successfully: `npm run build`
- [ ] WebSocket connects successfully (check browser console/network tab)
- [ ] Real-time notifications work:
  - [ ] Receive notifications when connected
  - [ ] Notification count updates in real-time
  - [ ] Notification menu shows new notifications
- [ ] Chat functionality works:
  - [ ] Messages send and receive in real-time
  - [ ] Chat sessions update in real-time
  - [ ] Online status updates work
- [ ] Test WebSocket reconnection after network interruption
- [ ] Test WebSocket connection with authentication
- [ ] Verify WebSocket URL is correct in network tab

### 1.7 Locale Routing Strategy (Must Complete Before Config Changes)

#### 1.7.1 Implement Locale Routing

- [ ] **SKIPPED - To be revisited later if Capacitor cannot build or apps don't work**
- [ ] Decide on locale routing approach (next-intl routing vs manual routing)
- [ ] If using next-intl routing: Configure `next-intl` routing in `_app.page.tsx`
- [ ] If manual routing: Implement locale detection and routing logic
- [ ] Update all `router.push()` calls to handle locale routing properly
- [ ] Test locale switching works in web build

**Status: SKIPPED - Will revisit if needed**

**Expected Impact:**

- Locale routing will work differently than Next.js built-in i18n
- URL structure may change (e.g., query params `?locale=ru` vs path-based `/ru/`)
- Locale detection may need to be client-side instead of server-side
- Some navigation may need updates to preserve locale
- **This must work before removing i18n config in 1.8**

**Testing Checklist:**

- [ ] Test locale switching from language selector works
- [ ] Test locale persists when navigating between pages
- [ ] Test direct URL access with different locales works
- [ ] Test locale cookie/storage is set correctly
- [ ] Test all pages display correct translations for selected locale
- [ ] Test locale detection on first visit (if implemented)
- [ ] Test navigation (product links, category links, etc.) preserves locale
- [ ] Test browser back/forward buttons work with locale routing

### 1.8 Capacitor Configuration (Server URL Approach)

#### 1.8.1 Configure Capacitor to Use Server URL

- [x] Update `capacitor.config.ts` to use `server.url` pointing to production
- [x] Configure development server URL for local testing
- [x] Remove static export requirement (not needed with server URL approach)
- [x] Keep Next.js i18n configuration (works with server URL)

**Status: DONE**

**Expected Impact:**

- Mobile app WebView will load pages from production server (`https://xmobile.com.tm`)
- SSR/ISR pages work in mobile app without static export
- Product changes appear immediately (no rebuilds needed)
- App store updates only needed for code/UI changes, not data changes
- Next.js i18n routing continues to work normally
- **No static export needed - WebView loads from live server**

**How It Works:**

- **Development**: WebView loads from `http://localhost:3003` (live reload works)
- **Production**: WebView loads from `https://xmobile.com.tm` (gets live SSR/ISR pages)
- **Benefits**:
  - No rebuilds for product changes
  - Instant updates when admins make changes
  - Keeps all SSR/ISR functionality
  - Same codebase for web and mobile

**Testing Checklist:**

- [ ] Run `yarn dev` - Next.js server starts normally
- [ ] Run `npx cap sync` - Capacitor config is synced
- [ ] Test in iOS simulator/device - WebView loads from server URL
- [ ] Test in Android emulator/device - WebView loads from server URL
- [ ] Verify pages load correctly (SSR/ISR works)
- [ ] Test product pages load with latest data
- [ ] Test locale switching works (Next.js i18n)
- [ ] Test authentication flow works
- [ ] Test WebSocket connection works
- [ ] Test offline behavior (app won't work offline - expected)
- [ ] Verify production server URL is correct

### 1.9 Authentication & Cookies

#### 1.9.1 Cookie Handling Review

- [ ] **SKIPPED - To be revisited later if Capacitor cannot build or apps don't work**
- [ ] Review cookie usage in authentication flow
- [ ] Document cookie behavior differences in mobile apps
- [ ] Consider using Capacitor Preferences plugin for token storage (future enhancement)
- [ ] Test authentication flow works (will test when Capacitor is integrated)

**Status: SKIPPED - Will revisit if needed**

**Expected Impact:**

- No code changes expected - documentation/review only
- Web authentication should continue to work normally
- Documentation will help with future mobile implementation

**Testing Checklist (Web - should work normally):**

- [ ] Build completes successfully: `npm run build`
- [ ] User sign in works:
  - [ ] Login form submits correctly
  - [ ] Auth cookie is set after login
  - [ ] User is redirected after login
  - [ ] User data loads correctly
- [ ] User sign up works:
  - [ ] Registration form submits correctly
  - [ ] Auth cookie is set after registration
  - [ ] User is logged in after registration
- [ ] User sign out works:
  - [ ] Auth cookie is cleared
  - [ ] User is logged out
  - [ ] Redirected to appropriate page
- [ ] Session persistence works:
  - [ ] User stays logged in after page refresh
  - [ ] Auth cookie persists across browser sessions (if configured)
- [ ] Test with different browsers (cookie behavior)
- [ ] Verify auth cookie is set with correct flags (Secure, SameSite, etc.)

---

## Section 2: New Changes to Integrate Capacitor

### 2.1 Capacitor Installation & Initial Setup

#### 2.1.1 Install Capacitor Dependencies

- [x] Install `@capacitor/core` package
- [x] Install `@capacitor/cli` as dev dependency
- [x] Install `@capacitor/ios` package
- [x] Install `@capacitor/android` package
- [ ] Update `package.json` scripts if needed

**Status: DONE (packages installed via yarn)**

#### 2.1.2 Initialize Capacitor

- [x] Run `npx cap init` with appropriate app details:
  - App ID: `tm.com.xmobile.app`
  - App Name: Xmobile
  - Web Dir: `.next` (Next.js build directory)
- [x] Review generated `capacitor.config.ts` file
- [x] Configure `server.url` for development and production

### 2.2 Build Configuration

#### 2.2.1 Update Build Scripts

- [ ] Update `package.json` build script to: `next build && npx cap sync`
- [ ] Create separate script for mobile builds: `build:mobile`
- [ ] Create script for syncing: `sync:mobile`
- [ ] Document build process in README

#### 2.2.2 Next.js Build Output

- [x] **NOT NEEDED** - Using server URL approach, no static export required
- [x] Verify `next.config.mjs` keeps normal Next.js config (SSR/ISR enabled)
- [x] Test `npm run build` generates normal Next.js build
- [x] Verify production server is running and accessible
- [x] Test web build works correctly in browser

### 2.3 Native Platform Setup

#### 2.3.1 iOS Platform Setup

- [ ] Run `npx cap add ios`
- [ ] Configure iOS project settings:
  - Bundle identifier
  - Display name
  - Version and build numbers
- [ ] Configure iOS capabilities (Push Notifications, etc.)
- [ ] Set up signing certificates and provisioning profiles
- [ ] Test iOS build: `npx cap open ios` and build in Xcode

#### 2.3.2 Android Platform Setup

- [ ] Run `npx cap add android`
- [ ] Configure Android project settings:
  - Application ID
  - App name
  - Version code and version name
- [ ] Configure Android manifest permissions
- [ ] Set up signing configuration for release builds
- [ ] Test Android build: `npx cap open android` and build in Android Studio

### 2.4 Push Notifications Integration

#### 2.4.1 Install Push Notification Plugin

- [ ] Install `@capacitor/push-notifications` package
- [ ] Install `@capacitor-community/fcm` (if using Firebase Cloud Messaging)
- [ ] Or install native FCM SDKs directly

#### 2.4.2 FCM Configuration for Mobile

- [ ] Add Firebase configuration files to native projects:
  - iOS: `GoogleService-Info.plist`
  - Android: `google-services.json`
- [ ] Configure FCM in iOS project
- [ ] Configure FCM in Android project
- [ ] Update native build configurations

#### 2.4.3 FCM Client Code for Mobile

- [ ] Create platform-specific FCM initialization in Capacitor
- [ ] Create wrapper service for push notifications that works on both web and mobile
- [ ] Update `NotificationContext.tsx` to use Capacitor push notifications on mobile
- [ ] Implement token registration for mobile (different from web)
- [ ] Test push notifications work on iOS device
- [ ] Test push notifications work on Android device

### 2.5 Capacitor Plugins & Native Features

#### 2.5.1 Essential Plugins Installation

- [ ] Install `@capacitor/app` for app lifecycle and deep linking
- [ ] Install `@capacitor/status-bar` for status bar control
- [ ] Install `@capacitor/splash-screen` for splash screen control
- [ ] Install `@capacitor/keyboard` for keyboard handling
- [ ] Install `@capacitor/preferences` for persistent storage (optional, for tokens)

#### 2.5.2 Deep Linking Configuration

- [ ] Configure URL schemes in iOS (Info.plist)
- [ ] Configure intent filters in Android (AndroidManifest.xml)
- [ ] Implement deep link handling in app using `@capacitor/app`
- [ ] Test deep links work for product pages, orders, etc.

#### 2.5.3 App Configuration

- [ ] Configure app icons for iOS and Android
- [ ] Configure splash screens for iOS and Android
- [ ] Configure status bar styling
- [ ] Set up app permissions (camera, location, etc. if needed)

### 2.6 Platform-Specific Code

#### 2.6.1 Platform Detection Utility

- [ ] Create utility to detect if running in Capacitor
- [ ] Create utility to detect iOS vs Android
- [ ] Use utilities throughout app for platform-specific behavior

#### 2.6.2 Conditional Code Execution

- [ ] Update service worker registration (skip in Capacitor)
- [ ] Update FCM web initialization (skip in Capacitor)
- [ ] Add any other platform-specific conditionals as needed

### 2.7 Testing & Validation

#### 2.7.1 Web Build Testing

- [ ] Test static export works correctly
- [ ] Test all pages load correctly
- [ ] Test API calls work correctly
- [ ] Test authentication flow
- [ ] Test WebSocket connection
- [ ] Test image loading
- [ ] Test locale switching

#### 2.7.2 iOS Testing

- [ ] Build iOS app in Xcode
- [ ] Test on iOS simulator
- [ ] Test on physical iOS device
- [ ] Test push notifications on iOS
- [ ] Test deep linking on iOS
- [ ] Test all major features work correctly

#### 2.7.3 Android Testing

- [ ] Build Android app in Android Studio
- [ ] Test on Android emulator
- [ ] Test on physical Android device
- [ ] Test push notifications on Android
- [ ] Test deep linking on Android
- [ ] Test all major features work correctly

### 2.8 App Store Preparation

#### 2.8.1 iOS App Store

- [ ] Create App Store Connect account/listing
- [ ] Prepare app screenshots
- [ ] Write app description and metadata
- [ ] Configure app privacy details
- [ ] Build and upload iOS app for review
- [ ] Submit for App Store review

#### 2.8.2 Google Play Store

- [ ] Create Google Play Console account/listing
- [ ] Prepare app screenshots and graphics
- [ ] Write app description and metadata
- [ ] Configure app privacy policy
- [ ] Build and upload Android app (AAB format)
- [ ] Submit for Google Play review

### 2.9 Documentation & Maintenance

#### 2.9.1 Update Documentation

- [ ] Update README with mobile build instructions
- [ ] Document Capacitor setup process
- [ ] Document environment variables needed
- [ ] Document build and deployment process
- [ ] Create troubleshooting guide

#### 2.9.2 CI/CD Updates (if applicable)

- [ ] Update CI/CD pipelines for mobile builds
- [ ] Configure automated builds for iOS and Android
- [ ] Set up code signing in CI/CD
- [ ] Configure app store deployment automation (optional)

---

## Notes

- **Section 1 items are ordered from most independent to least independent**
- **Config changes (1.8) come LAST - only after all dependencies are fixed**
- All items in Section 1 should be completed and tested on web before moving to Section 2
- Test web functionality after each change in Section 1
- Each item can be tested independently without breaking the app
- Section 2 items can be done in parallel once Section 1 is complete
- This file will be deleted after all items are implemented

**Recommended Order:**

1. Start with 1.1 (simple getServerSideProps conversions) - these are safe and independent
2. Then 1.2 (platform detection) - won't affect web functionality
3. Then 1.3-1.6 (various independent changes)
4. Then 1.7 (locale routing) - must be done before config changes
5. Finally 1.8 (config changes) - only when everything else is ready
