declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface ProvidedContext {
    integrationDatabaseUrl: string;
    integrationCatalog: {
      categoryId: string;
      categorySlug: string;
      priceId: string;
      productId: string;
      productSlug: string;
    };
  }
}

export {};
