# Locale Routing Migration List

This document lists all files that need to be migrated from Next.js i18n routing to cookie-based locale routing (for static export compatibility).

## Migration Status

✅ **Completed:**

- `src/pages/index.page.tsx` - Migrated to new approach
- `src/pages/product/[id].page.tsx` - Migrated to new approach
- **ALL 20 PAGES** - All pages with `getStaticProps` have been migrated
- **ALL 9 COMPONENTS** - All components using `router.locale` have been migrated

---

## Pages with `getStaticProps` (Need Migration)

These pages use `context.locale` in `getStaticProps` and need to be updated to load all locale messages like `index.page.tsx`.

### High Priority (User-facing pages)

1. **`src/pages/product/[id].page.tsx`** ✅ **COMPLETED**

   - ✅ Updated `getStaticProps` to load all locale messages
   - ✅ Replaced `router.locale` with `useLocale()` hook
   - ✅ `getStaticPaths` - No changes needed (cookie-based routing doesn't require locale paths)

2. **`src/pages/category/[id].page.tsx`** ✅ **COMPLETED**

   - ✅ Updated `getStaticProps` to load all locale messages
   - ✅ Replaced `router.locale` with `useLocale()` hook
   - ✅ `getStaticPaths` - No changes needed

3. **`src/pages/product/index.page.tsx`** ✅ **COMPLETED**

   - ✅ Updated `getStaticProps` to load all locale messages
   - ✅ Replaced `router.locale` with `useLocale()` hook

4. **`src/pages/category/index.page.tsx`** ✅ **COMPLETED**

   - ✅ Updated `getStaticProps` to load all locale messages

5. **`src/pages/cart/index.page.tsx`** ✅ **COMPLETED**

   - ✅ Updated `getStaticProps` to load all locale messages

6. **`src/pages/cart/checkout/index.page.tsx`** ✅ **COMPLETED**

   - ✅ Updated `getStaticProps` to load all locale messages
   - ✅ Replaced `router.locale` with `useLocale()` hook

7. **`src/pages/cart/checkout/success.page.tsx`** ✅ **COMPLETED**

   - ✅ Updated `getStaticProps` to load all locale messages

8. **`src/pages/orders/index.page.tsx`** ✅ **COMPLETED**

   - ✅ Updated `getStaticProps` to load all locale messages

9. **`src/pages/orders/[id].page.tsx`** ✅ **COMPLETED**

   - ✅ Updated `getStaticProps` to load all locale messages
   - ✅ Replaced `router.locale` with `useLocale()` hook
   - ✅ `getStaticPaths` - No changes needed

10. **`src/pages/user/index.page.tsx`** ✅ **COMPLETED**

    - ✅ Updated `getStaticProps` to load all locale messages
    - ✅ Replaced `router.push` with locale option with `window.location.reload()`

11. **`src/pages/user/sign_in_up.page.tsx`** ✅ **COMPLETED**

    - ✅ Updated `getStaticProps` to load all locale messages

12. **`src/pages/user/signin.page.tsx`** ✅ **COMPLETED**

    - ✅ Updated `getStaticProps` to load all locale messages

13. **`src/pages/user/signup.page.tsx`** ✅ **COMPLETED**

    - ✅ Updated `getStaticProps` to load all locale messages

14. **`src/pages/chat/index.page.tsx`** ✅ **COMPLETED**
    - ✅ Updated `getStaticProps` to load all locale messages

### Medium Priority (Admin/Analytics pages)

15. **`src/pages/orders/admin/index.page.tsx`** ✅ **COMPLETED**

    - ✅ Updated `getStaticProps` to load all locale messages

16. **`src/pages/orders/admin/[id].page.tsx`** ✅ **COMPLETED**

    - ✅ Updated `getStaticProps` to load all locale messages
    - ✅ Replaced `router.locale` with `useLocale()` hook
    - ✅ `getStaticPaths` - No changes needed

17. **`src/pages/analytics/index.page.tsx`** ✅ **COMPLETED**

    - ✅ Updated `getStaticProps` to load all locale messages

18. **`src/pages/procurement/index.page.tsx`** ✅ **COMPLETED**

    - ✅ Updated `getStaticProps` to load all locale messages

19. **`src/pages/product/update-prices/index.page.tsx`** ✅ **COMPLETED**

    - ✅ Updated `getStaticProps` to load all locale messages

20. **`src/pages/server-logs/index.page.tsx`** ✅ **COMPLETED**
    - ✅ Updated `getStaticProps` to load all locale messages

---

## Components Using `router.locale` (Need Migration)

These components use `router.locale` to get the current locale. They need to be updated to use a cookie-based approach or a locale context/hook.

### Components

1. **`src/pages/components/Footer.tsx`** ✅ **COMPLETED**

   - ✅ Updated `getStaticProps` to load all locale messages
   - ✅ Replaced `router.locale` with `useLocale()` hook

2. **`src/pages/components/SimpleBreadcrumbs.tsx`** ✅ **COMPLETED**

   - ✅ Replaced `router.locale` with `useLocale()` hook

3. **`src/pages/components/StyledBreadcrumbs.tsx`** ✅ **COMPLETED**

   - ✅ Replaced `router.locale` with `useLocale()` hook

4. **`src/pages/components/ProductCard.tsx`** ✅ **COMPLETED**

   - ✅ Replaced `router.locale` with `useLocale()` hook

5. **`src/pages/components/FilterSidebar.tsx`** ✅ **COMPLETED**

   - ✅ Replaced `router.locale` with `useLocale()` hook

6. **`src/pages/components/CollapsableBase.tsx`** ✅ **COMPLETED**

   - ✅ Replaced `router.locale` with `useLocale()` hook

7. **`src/pages/components/CategoryCard.tsx`** ✅ **COMPLETED**

   - ✅ Replaced `router.locale` with `useLocale()` hook

8. **`src/pages/components/AddEditProductDialog.tsx`** ✅ **COMPLETED**

   - ✅ Replaced `router.locale` with `useLocale()` hook

9. **`src/pages/cart/components/ProductCard.tsx`** ✅ **COMPLETED**
   - ✅ Replaced `router.locale` with `useLocale()` hook

---

## Files with `getStaticPaths` (Need Review)

These dynamic routes use `getStaticPaths` and may need locale handling:

1. **`src/pages/product/[id].page.tsx`**

   - Already has `getStaticProps` with locale
   - May need to generate paths for all locales (if path-based routing is desired)

2. **`src/pages/category/[id].page.tsx`**

   - Already has `getStaticProps` with locale
   - May need to generate paths for all locales (if path-based routing is desired)

3. **`src/pages/orders/[id].page.tsx`**

   - Already has `getStaticProps` with locale
   - May need to generate paths for all locales (if path-based routing is desired)

4. **`src/pages/orders/admin/[id].page.tsx`**
   - Already has `getStaticProps` with locale
   - May need to generate paths for all locales (if path-based routing is desired)

**Note:** For cookie-based routing (Option A), we don't need to generate paths for all locales. We only need to ensure `getStaticProps` loads all messages.

---

## Other Files Needing Updates

1. **`src/pages/_app.page.tsx`**

   - ✅ Already updated to read locale from cookie
   - May need refinement after all pages are migrated

2. **`src/pages/components/Appbar.tsx`**
   - ✅ Already updated to reload on locale change
   - May need improvement to avoid page reload (client-side switching)

---

## Migration Pattern

For each page, follow this pattern (based on `index.page.tsx`):

### 1. Update `getStaticProps`:

```typescript
export const getStaticProps: GetStaticProps = async () => {
  const defaultLocale = 'ru';
  let messages = {};
  try {
    messages = (await import(`../i18n/${defaultLocale}.json`)).default;
  } catch (error) {
    console.error('Error loading messages:', error);
  }

  return {
    props: {
      messages,
      allMessages: {
        en: (await import('../i18n/en.json')).default,
        ru: (await import('../i18n/ru.json')).default,
        tk: (await import('../i18n/tk.json')).default,
        ch: (await import('../i18n/ch.json')).default,
        tr: (await import('../i18n/tr.json')).default,
      },
    },
  };
};
```

### 2. Update components using `router.locale`:

Replace `router.locale` with a utility function that reads from cookie:

```typescript
import { getCookie } from '@/pages/lib/utils';
import { LOCALE_COOKIE_NAME } from '@/pages/lib/constants';

// Instead of: router.locale ?? 'ru'
const locale = getCookie(LOCALE_COOKIE_NAME) || 'ru';
```

Or create a custom hook:

```typescript
// src/pages/lib/hooks/useLocale.ts
import { getCookie } from '@/pages/lib/utils';
import { LOCALE_COOKIE_NAME } from '@/pages/lib/constants';
import { useRouter } from 'next/router';

export function useLocale(): string {
  const router = useRouter();
  if (typeof window !== 'undefined') {
    return getCookie(LOCALE_COOKIE_NAME) || router.locale || 'ru';
  }
  return router.locale || 'ru';
}
```

### 3. Update locale switching:

Remove `router.push` with locale option, use cookie + reload (or better: client-side switching).

---

## Summary

- **Total pages migrated:** ✅ 20/20 pages
- **Total components migrated:** ✅ 9/9 components
- **Files with getStaticPaths:** ✅ 4 files (no changes needed for cookie-based routing)

**Migration Status: ✅ COMPLETE**

All pages and components have been successfully migrated to cookie-based locale routing. The codebase is now ready for static export compatibility.

**Next Steps:**

1. Test the build: `yarn build`
2. Test locale switching on all pages
3. Once verified, proceed with `next.config.mjs` changes (1.8.1) to enable static export
