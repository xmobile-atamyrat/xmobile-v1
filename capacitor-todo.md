# Capacitor Migration Todo

## 1) Changes to existing code and structure

1. Replace `getServerSideProps` with `getStaticProps` in translation-only pages.
2. Move home-page IP tracking/geo-locale logic out of SSR into API + client.
3. Move analytics page data-fetching from SSR to API + client.
4. Replace `/api/localImage` usage with a CDN/static asset strategy.
5. Update `next.config.mjs` for static export compatibility.
6. Remove/replace Next.js built-in `i18n` config for static export.
7. Update `BASE_URL` to use a mobile-safe production API base URL.
8. Review auth cookies/refresh flow to ensure it works in WebView.
9. Audit dynamic routes `getStaticPaths` to ensure new products/categories can load.

## 2) New changes to integrate Capacitor

A. Add Capacitor dependencies and config (`capacitor.config.ts`).
B. Configure build output folder for Capacitor (`next export` output).
C. Add `ios/` and `android/` native projects (`npx cap add`).
D. Configure native push notifications (FCM) for Android + iOS.
E. Add environment handling for native (API base URL, keys).
F. Add deep links and universal links setup.
G. Configure app icons/splash screens for both platforms.
H. Add native storage or secure storage for tokens if needed.
I. Add build scripts for local iOS/Android builds.
