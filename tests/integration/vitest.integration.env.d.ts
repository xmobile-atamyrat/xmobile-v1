declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface ProvidedContext {
    integrationDatabaseUrl: string;
    integrationCatalog: import('./shared/integration-types').IntegrationCatalog;
  }
}

export {};
