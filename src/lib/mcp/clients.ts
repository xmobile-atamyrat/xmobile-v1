import { z } from 'zod';

// Relative imports only: `scripts/mcp-create-client.ts` loads this through
// ts-node, which doesn't resolve the `@/` alias.
import { isAllowedRedirectUri } from './config';
import {
  CLIENT_SECRET_PREFIX,
  hashSecret,
  newClientId,
  newSecret,
} from './oauthTokens';

/**
 * Which AI app a client is. It decides what differs between them: only
 * ChatGPT hands files to tools (`openai/fileParams`), so only it gets the
 * tools that add images; and Google requires that Gemini's refresh token
 * stays the same on refresh, where the others rotate. Stored with the client
 * rather than read from its callback host, so a moved or extra callback host
 * can't quietly change what a client may do.
 */
export const MCP_APPS = ['chatgpt', 'claude', 'gemini', 'other'] as const;
export type McpApp = (typeof MCP_APPS)[number];

/**
 * The OAuth clients (AI apps) allowed to connect, from `MCP_CLIENTS` in
 * `.env`: a JSON array made with `yarn mcp:create-client-*`. There is no
 * self-registration. Open (dynamic) registration can't tell one ChatGPT
 * account from another, so anyone could register their own connector, name
 * it "ChatGPT" and send a superuser the consent link. Every client here has a
 * secret the token endpoint requires, which such a connector doesn't hold.
 * Removing a client from the list and restarting cuts off its connections.
 */
export type McpClientConfig = {
  id: string;
  name: string;
  app: McpApp;
  /** SHA-256 (hex) of the client secret; the secret itself is never stored. */
  secretHash: string;
  redirectUris: string[];
};

const clientSchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().min(1).max(100),
  app: z.enum(MCP_APPS),
  secretHash: z.string().regex(/^[0-9a-f]{64}$/),
  redirectUris: z.array(z.string().max(2000)).min(1).max(5),
});
const clientsSchema = z.array(clientSchema).max(20);

/**
 * Why `clients` would not load as `MCP_CLIENTS`, or null if it would. A list
 * that doesn't load leaves every app unable to connect (see `mcpClients`).
 */
export function clientListProblem(clients: McpClientConfig[]): string | null {
  const result = clientsSchema.safeParse(clients);
  if (result.success) return null;
  return result.error.issues
    .map((issue) => `${issue.path.join('.') || 'list'}: ${issue.message}`)
    .join('; ');
}

let cache: { raw: string; clients: McpClientConfig[] } | null = null;

/** Parsed once per distinct value, so a bad value is logged once, not per request. */
export function mcpClients(): McpClientConfig[] {
  const raw = process.env.MCP_CLIENTS?.trim() ?? '';
  if (cache?.raw === raw) return cache.clients;
  let clients: McpClientConfig[] = [];
  if (raw !== '') {
    try {
      // The schema requires every field; without strictNullChecks zod types
      // them as optional.
      clients = clientsSchema.parse(JSON.parse(raw)) as McpClientConfig[];
    } catch (error) {
      console.error(
        '[mcp] MCP_CLIENTS is not a valid client list; no AI app can connect',
        error instanceof z.ZodError ? error.issues : String(error),
      );
    }
  }
  cache = { raw, clients };
  return clients;
}

/**
 * The app a callback URL belongs to, used only to suggest one when a client
 * is made (`newClientEntry`). What the server allows reads `client.app`.
 */
export function appOfRedirectUri(uri: string): McpApp {
  let host: string;
  try {
    host = new URL(uri).hostname.toLowerCase();
  } catch {
    return 'other';
  }
  if (host === 'chatgpt.com') return 'chatgpt';
  if (host === 'claude.ai') return 'claude';
  if (/^oauth-redirect(-sandbox|-test)?\.googleusercontent\.com$/.test(host)) {
    return 'gemini';
  }
  return 'other';
}

/** Only ChatGPT passes files to tools as links this server can download. */
export function clientCanSendFiles(
  client: Pick<McpClientConfig, 'app'> | null,
): boolean {
  return client?.app === 'chatgpt';
}

/**
 * Google's MCP OAuth guide: "you must avoid rotating the Refresh Token ...
 * return the exact same Refresh Token". Every other client gets a new one
 * on each refresh.
 */
export function clientRotatesRefreshTokens(
  client: Pick<McpClientConfig, 'app'>,
): boolean {
  return client.app !== 'gemini';
}

export function findClient(id: string | undefined): McpClientConfig | null {
  if (!id) return null;
  return mcpClients().find((client) => client.id === id) ?? null;
}

export function cleanClientName(name: string): string {
  // Control characters and quotes go: the name ends up on the consent page
  // and inside a single-quoted line of `.env`.
  // eslint-disable-next-line no-control-regex
  const cleaned = name.replace(/[\u0000-\u001f\u007f'"`\\]/g, '').trim();
  return cleaned.slice(0, 100) || 'Unnamed client';
}

/**
 * A new client entry and its secret, for the operator to paste: the entry
 * into `MCP_CLIENTS`, the client ID and secret into the AI app.
 */
export function newClientEntry(input: {
  name: string;
  redirectUris: string[];
  /** Read from the redirect URIs when not given. */
  app?: McpApp;
}): { entry: McpClientConfig; secret: string } {
  const redirectUris = [
    ...new Set(input.redirectUris.map((uri) => uri.trim())),
  ];
  if (redirectUris.length === 0 || redirectUris.length > 5) {
    throw new Error('Give 1 to 5 redirect URIs');
  }
  const bad = redirectUris.find((uri) => !isAllowedRedirectUri(uri));
  if (bad != null) {
    throw new Error(
      `${bad} is not an https URL on MCP_ALLOWED_REDIRECT_HOSTS (no port, credentials or fragment)`,
    );
  }
  // One app per client: what the server allows depends on which app it is.
  const apps = new Set(redirectUris.map(appOfRedirectUri));
  if (input.app == null && apps.size > 1) {
    throw new Error(
      'Give redirect URIs of one AI app per client (make one client per app), or pass --app',
    );
  }
  const app = input.app ?? [...apps][0];
  // The entry goes into a single-quoted .env line, which a quote would end.
  const quoted = redirectUris.find((uri) => uri.includes("'"));
  if (quoted != null) {
    throw new Error(`${quoted} contains a single quote, which .env can't hold`);
  }
  const secret = newSecret(CLIENT_SECRET_PREFIX);
  return {
    entry: {
      id: newClientId(),
      name: cleanClientName(input.name),
      app,
      secretHash: hashSecret(secret),
      redirectUris,
    },
    secret,
  };
}
