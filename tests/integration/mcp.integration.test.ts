import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, UserRole } from '@prisma/client';
import { createMocks, RequestMethod } from 'node-mocks-http';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { resetPrismaGlobalSingleton } from './helpers/reset-prisma-global';
import { createStaffPrincipal, StaffPrincipal } from './shared/staff-token';
import {
  prepareIntegrationWorker,
  teardownIntegrationWorker,
} from './shared/worker-env';

const ORIGIN = 'https://xmobile.test';
const REDIRECT = 'https://chatgpt.com/connector_platform_oauth_redirect';
const CLAUDE_REDIRECT = 'https://claude.ai/api/mcp/auth_callback';
const GEMINI_REDIRECT =
  'https://oauth-redirect.googleusercontent.com/r/xmobile-test';
const FILE_URL =
  'https://oaisdmntprseasia.blob.core.windows.net/files/generated.png?sig=x';

type Handler = (req: NextApiRequest, res: NextApiResponse) => unknown;

type Reply = {
  status: number;
  headers: Record<string, unknown>;
  json: Record<string, unknown>;
};

async function call(
  modulePath: string,
  options: {
    method: RequestMethod;
    headers?: Record<string, string>;
    body?: unknown;
    query?: Record<string, string>;
  },
): Promise<Reply> {
  const handler = (await import(/* @vite-ignore */ modulePath))
    .default as Handler;
  const { req, res } = createMocks({
    method: options.method,
    headers: options.headers ?? {},
    body: options.body as never,
    query: options.query ?? {},
  });
  Object.assign(res, { revalidate: vi.fn().mockResolvedValue(undefined) });
  await handler(
    req as unknown as NextApiRequest,
    res as unknown as NextApiResponse,
  );
  const raw = res._getData() as string;
  return {
    status: res._getStatusCode(),
    headers: res._getHeaders(),
    json: raw ? (JSON.parse(raw) as Record<string, unknown>) : {},
  };
}

const sha256 = (value: string) =>
  crypto.createHash('sha256').update(value).digest('hex');

function pkcePair() {
  const verifier = crypto.randomBytes(48).toString('base64url');
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
  return { verifier, challenge };
}

let rpcId = 0;
async function rpc(
  accessToken: string | null,
  method: string,
  params?: Record<string, unknown>,
  extraHeaders: Record<string, string> = {},
): Promise<Reply> {
  rpcId += 1;
  return call('@/pages/api/mcp/index.page', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(accessToken != null
        ? { authorization: `Bearer ${accessToken}` }
        : {}),
      ...extraHeaders,
    },
    body: { jsonrpc: '2.0', id: rpcId, method, ...(params ? { params } : {}) },
  });
}

type ToolReply = {
  isError?: boolean;
  content: { type: string; text?: string; data?: string; mimeType?: string }[];
  structuredContent?: {
    images?: { key: string; position: number; isMain: boolean }[];
    results?: { productId: string }[];
  };
};

async function tool(
  accessToken: string,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolReply> {
  const reply = await rpc(accessToken, 'tools/call', { name, arguments: args });
  expect(reply.status).toBe(200);
  return (reply.json as { result: ToolReply }).result;
}

describe('MCP server and its OAuth flow (integration)', () => {
  let prisma: PrismaClient;
  let categoryId: string;
  let root: string;
  let superuser: StaffPrincipal;
  let admin: StaffPrincipal;
  let clientId: string;
  let clientSecret: string;
  let other: { client_id: string; client_secret: string };
  type AppClient = {
    client_id: string;
    client_secret: string;
    redirect: string;
  };
  let claude: AppClient;
  let gemini: AppClient;
  let clientsEnv: string;
  let productId: string;
  let tokens: { access_token: string; refresh_token: string };
  let pngBytes: Buffer;

  async function authorize(
    principal: StaffPrincipal,
    challenge: string,
    extra: Record<string, string> = {},
  ): Promise<Reply> {
    return call('@/pages/api/mcp/oauth/approve.page', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${principal.accessToken}`,
      },
      body: {
        response_type: 'code',
        client_id: clientId,
        redirect_uri: REDIRECT,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state: 'state-123',
        resource: `${ORIGIN}/api/mcp`,
        decision: 'approve',
        ...extra,
      },
    });
  }

  async function exchange(
    code: string,
    verifier: string,
    client: { client_id: string; client_secret?: string } = {
      client_id: clientId,
      client_secret: clientSecret,
    },
  ): Promise<Reply> {
    return call('@/pages/api/mcp/oauth/token.page', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: {
        grant_type: 'authorization_code',
        code,
        code_verifier: verifier,
        redirect_uri: REDIRECT,
        resource: `${ORIGIN}/api/mcp`,
        ...client,
      },
    });
  }

  async function connect(principal: StaffPrincipal) {
    const { verifier, challenge } = pkcePair();
    const approved = await authorize(principal, challenge);
    const code = new URL(approved.json.redirectTo as string).searchParams.get(
      'code',
    )!;
    const exchanged = await exchange(code, verifier);
    expect(exchanged.status).toBe(200);
    return exchanged.json as { access_token: string; refresh_token: string };
  }

  beforeAll(async () => {
    const { databaseUrl, catalog } = await prepareIntegrationWorker();
    categoryId = catalog.categoryId;
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();

    root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-int-'));
    vi.stubEnv('MCP_ENABLED', 'true');
    vi.stubEnv('MCP_PUBLIC_ORIGIN', ORIGIN);
    vi.stubEnv('PRODUCT_IMAGES_DIR', path.join(root, 'products'));
    vi.stubEnv('COMPRESSED_PRODUCT_IMAGES_DIR', path.join(root, 'compressed'));

    // Clients come from MCP_CLIENTS, the way `yarn mcp:create-client-*` makes them.
    const { newClientEntry } = await import('@/lib/mcp/clients');
    const main = newClientEntry({ name: 'ChatGPT', redirectUris: [REDIRECT] });
    const second = newClientEntry({ name: 'Other', redirectUris: [REDIRECT] });
    clientId = main.entry.id;
    clientSecret = main.secret;
    other = { client_id: second.entry.id, client_secret: second.secret };
    const claudeEntry = newClientEntry({
      name: 'Claude',
      redirectUris: [CLAUDE_REDIRECT],
    });
    const geminiEntry = newClientEntry({
      name: 'Gemini',
      redirectUris: [GEMINI_REDIRECT],
    });
    claude = {
      client_id: claudeEntry.entry.id,
      client_secret: claudeEntry.secret,
      redirect: CLAUDE_REDIRECT,
    };
    gemini = {
      client_id: geminiEntry.entry.id,
      client_secret: geminiEntry.secret,
      redirect: GEMINI_REDIRECT,
    };
    clientsEnv = JSON.stringify([
      main.entry,
      second.entry,
      claudeEntry.entry,
      geminiEntry.entry,
    ]);
    vi.stubEnv('MCP_CLIENTS', clientsEnv);

    superuser = await createStaffPrincipal(prisma, UserRole.SUPERUSER);
    admin = await createStaffPrincipal(prisma, UserRole.ADMIN);

    const { storeProductImage } = await import('@/lib/productImages');
    const image = (r: number) =>
      sharp({
        create: {
          width: 400,
          height: 400,
          channels: 3,
          background: { r, g: 0, b: 0 },
        },
      })
        .png()
        .toBuffer();
    const existing = [
      await storeProductImage(await image(10)),
      await storeProductImage(await image(200)),
    ];
    pngBytes = await image(90);
    const product = await prisma.product.create({
      data: {
        slug: `mcp-phone-${Date.now()}`,
        name: JSON.stringify({ ru: 'Zorbaphone', en: 'Zorbaphone Ultra' }),
        categoryId,
        imgUrls: existing,
      },
    });
    productId = product.id;
  }, 180_000);

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.user.deleteMany({
      where: { id: { in: [superuser?.userId, admin?.userId].filter(Boolean) } },
    });
    await prisma?.$disconnect();
    await resetPrismaGlobalSingleton();
    teardownIntegrationWorker();
    vi.unstubAllGlobals();
    fs.rmSync(root, { recursive: true, force: true });
  });

  describe('discovery and registration', () => {
    it('publishes metadata pointing at this origin', async () => {
      const resource = await call(
        '@/pages/api/mcp/well-known/protected-resource.page',
        { method: 'GET' },
      );
      expect(resource.json).toMatchObject({
        resource: `${ORIGIN}/api/mcp`,
        authorization_servers: [ORIGIN],
      });
      const server = await call(
        '@/pages/api/mcp/well-known/authorization-server.page',
        { method: 'GET' },
      );
      expect(server.json).toMatchObject({
        issuer: ORIGIN,
        authorization_endpoint: `${ORIGIN}/oauth/authorize`,
        code_challenge_methods_supported: ['S256'],
      });
    });

    it('names a registration endpoint (Gemini needs one) that registers nothing', async () => {
      const server = await call(
        '@/pages/api/mcp/well-known/authorization-server.page',
        { method: 'GET' },
      );
      expect(server.json.registration_endpoint).toBe(
        `${ORIGIN}/api/mcp/oauth/register`,
      );
      const registered = await call('@/pages/api/mcp/oauth/register.page', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: { client_name: 'ChatGPT', redirect_uris: [REDIRECT] },
      });
      expect(registered.status).toBe(400);
      expect(registered.json.error).toBe('invalid_client_metadata');
      expect(JSON.stringify(registered.json)).not.toContain('client_id');
      expect(server.json.token_endpoint_auth_methods_supported).toEqual([
        'client_secret_post',
        'client_secret_basic',
      ]);
    });

    it('makes client entries only for allowed redirects, without the secret', async () => {
      const { newClientEntry } = await import('@/lib/mcp/clients');
      expect(() =>
        newClientEntry({
          name: 'x',
          redirectUris: ['https://evil.example/cb'],
        }),
      ).toThrow();
      const { entry, secret } = newClientEntry({
        name: 'It\'s "ChatGPT"',
        redirectUris: [REDIRECT],
      });
      expect(JSON.stringify(entry)).not.toContain(secret);
      // Safe inside the single-quoted .env line.
      expect(entry.name).toBe('Its ChatGPT');
    });
  });

  describe('authorization', () => {
    it('lets only a superuser approve', async () => {
      const { challenge } = pkcePair();
      expect((await authorize(admin, challenge)).status).toBe(403);
    });

    it('refuses plain PKCE and an unregistered redirect', async () => {
      const { challenge } = pkcePair();
      const plain = await authorize(superuser, challenge, {
        code_challenge_method: 'plain',
      });
      // The client and redirect are fine, so the error goes back to them.
      expect(plain.status).toBe(200);
      const plainUrl = new URL(plain.json.redirectTo as string);
      expect(plainUrl.searchParams.get('error')).toBe('invalid_request');
      expect(plainUrl.searchParams.get('code')).toBeNull();
      const otherRedirect = await authorize(superuser, challenge, {
        redirect_uri: 'https://chatgpt.com/somewhere-else',
      });
      expect(otherRedirect.status).toBe(400);
    });

    it('refuses a client that is not in MCP_CLIENTS', async () => {
      const { challenge } = pkcePair();
      const reply = await authorize(superuser, challenge, {
        client_id: 'xmcp_client_unknown',
      });
      expect(reply.status).toBe(400);
      expect(reply.json.error).toBe('invalid_client');
    });

    it('needs the client secret to trade a code', async () => {
      const { verifier, challenge } = pkcePair();
      const approved = await authorize(superuser, challenge);
      const code = new URL(approved.json.redirectTo as string).searchParams.get(
        'code',
      )!;
      const noSecret = await exchange(code, verifier, { client_id: clientId });
      expect(noSecret.status).toBe(401);
      expect(noSecret.json.error).toBe('invalid_client');
      // RFC 6749 section 5.2: a 401 names the scheme to authenticate with.
      expect(noSecret.headers['www-authenticate']).toMatch(/^Basic /);
      const wrongSecret = await exchange(code, verifier, {
        client_id: clientId,
        client_secret: other.client_secret,
      });
      expect(wrongSecret.status).toBe(401);
      expect(wrongSecret.headers['www-authenticate']).toMatch(/^Basic /);
    });

    it('stores nothing until a code is traded, and refuses an altered code', async () => {
      const before = await prisma.mcpGrant.count();
      const { verifier, challenge } = pkcePair();
      const approved = await authorize(superuser, challenge);
      expect(await prisma.mcpGrant.count()).toBe(before);
      const code = new URL(approved.json.redirectTo as string).searchParams.get(
        'code',
      )!;
      // A middle character: the last one can carry only padding bits.
      const mid = Math.floor(code.length / 2);
      const flipped = code[mid] === 'A' ? 'B' : 'A';
      const altered = await exchange(
        `${code.slice(0, mid)}${flipped}${code.slice(mid + 1)}`,
        verifier,
      );
      expect(altered.json.error).toBe('invalid_grant');
      expect(await prisma.mcpGrant.count()).toBe(before);
      expect((await exchange(code, verifier)).status).toBe(200);
    });

    it('denies only for a signed-in user, and returns to the client', async () => {
      const { challenge } = pkcePair();
      // Without a login nobody can have the server sign an access_denied
      // for some client and state.
      const anonymous = await authorize(
        { ...superuser, accessToken: 'nope' },
        challenge,
        { decision: 'deny' },
      );
      expect(anonymous.status).toBe(401);
      expect(anonymous.json.redirectTo).toBeUndefined();
      // Any signed-in user may cancel; the page offers it to non-superusers.
      const reply = await authorize(admin, challenge, { decision: 'deny' });
      const url = new URL(reply.json.redirectTo as string);
      expect(url.searchParams.get('error')).toBe('access_denied');
      expect(url.searchParams.get('code')).toBeNull();
    });

    it('trades a code for tokens only with the right verifier, once', async () => {
      const { verifier, challenge } = pkcePair();
      const approved = await authorize(superuser, challenge);
      const redirect = new URL(approved.json.redirectTo as string);
      expect(redirect.origin + redirect.pathname).toBe(REDIRECT);
      expect(redirect.searchParams.get('state')).toBe('state-123');
      expect(redirect.searchParams.get('iss')).toBe(ORIGIN);
      const code = redirect.searchParams.get('code')!;

      const wrong = await exchange(code, pkcePair().verifier);
      expect(wrong.json.error).toBe('invalid_grant');

      const ok = await exchange(code, verifier);
      expect(ok.status).toBe(200);
      expect(ok.json).toMatchObject({ token_type: 'Bearer', expires_in: 900 });
      tokens = ok.json as typeof tokens;
      expect(tokens.access_token.startsWith('xmcp_at_')).toBe(true);

      const stored = await prisma.mcpGrant.findFirst({
        where: { userId: superuser.userId },
      });
      expect(JSON.stringify(stored)).not.toContain(tokens.access_token);
    });

    it('answers a repeated code trade with the same pair, only briefly', async () => {
      const { verifier, challenge } = pkcePair();
      const approved = await authorize(superuser, challenge);
      const code = new URL(approved.json.redirectTo as string).searchParams.get(
        'code',
      )!;
      const first = (await exchange(code, verifier)).json as typeof tokens;
      expect((await rpc(first.access_token, 'ping')).status).toBe(200);
      // Its answer was lost, or it went out twice: same pair, nothing replaced.
      const again = await exchange(code, verifier);
      expect(again.status).toBe(200);
      expect(again.json.access_token).toBe(first.access_token);
      expect(again.json.refresh_token).toBe(first.refresh_token);
      expect(again.json.expires_in).toBeLessThanOrEqual(900);
      expect((await rpc(first.access_token, 'ping')).status).toBe(200);
      // Six minutes on, the code coming back means it leaked.
      await prisma.mcpGrant.update({
        where: { accessTokenHash: sha256(first.access_token) },
        data: { createdAt: new Date(Date.now() - 360_000) },
      });
      expect((await exchange(code, verifier)).json.error).toBe('invalid_grant');
      expect((await rpc(first.access_token, 'ping')).status).toBe(401);
    });

    it('trades only the exact code it issued, so a code buys one grant', async () => {
      const { verifier, challenge } = pkcePair();
      const approved = await authorize(superuser, challenge);
      const code = new URL(approved.json.redirectTo as string).searchParams.get(
        'code',
      )!;
      const first = (await exchange(code, verifier)).json as typeof tokens;
      const before = await prisma.mcpGrant.count();
      // Each decodes to the same sealed approval, but hashes differently.
      const variants = [`${code}=`, `${code}==`, `${code}!`];
      const replies = await Promise.all(
        variants.map((variant) => exchange(variant, verifier)),
      );
      replies.forEach((reply) => {
        expect(reply.json.error).toBe('invalid_grant');
      });
      expect(await prisma.mcpGrant.count()).toBe(before);
      expect((await rpc(first.access_token, 'ping')).status).toBe(200);
    });

    it('answers two trades of one code racing with the same pair', async () => {
      const { verifier, challenge } = pkcePair();
      const approved = await authorize(superuser, challenge);
      const code = new URL(approved.json.redirectTo as string).searchParams.get(
        'code',
      )!;
      const [a, b] = await Promise.all([
        exchange(code, verifier),
        exchange(code, verifier),
      ]);
      expect([a.status, b.status]).toEqual([200, 200]);
      expect(a.json.access_token).toBe(b.json.access_token);
      expect(
        await prisma.mcpGrant.count({
          where: { accessTokenHash: sha256(a.json.access_token as string) },
        }),
      ).toBe(1);
      expect((await rpc(a.json.access_token as string, 'ping')).status).toBe(
        200,
      );
    });

    it('ends the connection when a spent code comes back without its verifier', async () => {
      const { verifier, challenge } = pkcePair();
      const approved = await authorize(superuser, challenge);
      const code = new URL(approved.json.redirectTo as string).searchParams.get(
        'code',
      )!;
      const live = (await exchange(code, verifier)).json.access_token as string;
      const replay = await exchange(code, pkcePair().verifier);
      expect(replay.json.error).toBe('invalid_grant');
      expect((await rpc(live, 'ping')).status).toBe(401);
    });

    it('sends errors to the client once its redirect checks out', async () => {
      const { OAuthError, validateAuthorizeRequest } = await import(
        '@/lib/mcp/oauthStore'
      );
      const { challenge } = pkcePair();
      const base = {
        response_type: 'code',
        client_id: clientId,
        redirect_uri: REDIRECT,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state: 'state-123',
      };
      const scope = await validateAuthorizeRequest(ORIGIN, {
        ...base,
        scope: 'catalog.images offline_access',
      }).catch((error: unknown) => error);
      expect(scope).toBeInstanceOf(OAuthError);
      const url = new URL(
        (scope as InstanceType<typeof OAuthError>).redirectTo!,
      );
      expect(url.origin + url.pathname).toBe(REDIRECT);
      expect(url.searchParams.get('error')).toBe('invalid_scope');
      expect(url.searchParams.get('state')).toBe('state-123');
      expect(url.searchParams.get('iss')).toBe(ORIGIN);
      expect(url.searchParams.get('code')).toBeNull();

      const longState = await validateAuthorizeRequest(ORIGIN, {
        ...base,
        state: 'x'.repeat(1001),
      }).catch((error: unknown) => error);
      const longUrl = new URL(
        (longState as InstanceType<typeof OAuthError>).redirectTo!,
      );
      expect(longUrl.searchParams.get('error')).toBe('invalid_request');
      expect(longUrl.searchParams.get('state')).toBeNull();

      // Before the redirect is confirmed, nothing is sent anywhere.
      const unregistered = await validateAuthorizeRequest(ORIGIN, {
        ...base,
        scope: 'nope',
        redirect_uri: 'https://chatgpt.com/somewhere-else',
      }).catch((error: unknown) => error);
      expect(unregistered).toBeInstanceOf(OAuthError);
      expect(
        (unregistered as InstanceType<typeof OAuthError>).redirectTo,
      ).toBeNull();
    });

    it('ignores a spent code posted under another client', async () => {
      const { verifier, challenge } = pkcePair();
      const approved = await authorize(superuser, challenge);
      const code = new URL(approved.json.redirectTo as string).searchParams.get(
        'code',
      )!;
      const live = (await exchange(code, verifier)).json.access_token as string;
      const replay = await exchange(code, verifier, other);
      expect(replay.json.error).toBe('invalid_grant');
      expect((await rpc(live, 'ping')).status).toBe(200);
    });
  });

  describe('the MCP endpoint', () => {
    it('challenges a request without a token', async () => {
      const reply = await rpc(null, 'initialize');
      expect(reply.status).toBe(401);
      expect(reply.headers['www-authenticate']).toContain(
        `resource_metadata="${ORIGIN}/.well-known/oauth-protected-resource/api/mcp"`,
      );
      const bad = await rpc('xmcp_at_forged', 'initialize');
      expect(bad.status).toBe(401);
      expect(bad.headers['www-authenticate']).toContain('invalid_token');
    });

    it('reads the auth scheme in any case', async () => {
      const reply = await call('@/pages/api/mcp/index.page', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `bearer ${tokens.access_token}`,
        },
        body: { jsonrpc: '2.0', id: 1, method: 'ping' },
      });
      expect(reply.status).toBe(200);
    });

    it('refuses calls from a web page', async () => {
      const reply = await rpc(tokens.access_token, 'ping', undefined, {
        origin: 'https://evil.example',
      });
      expect(reply.status).toBe(403);
    });

    it('initializes and lists tools', async () => {
      const init = await rpc(tokens.access_token, 'initialize', {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'test', version: '1' },
      });
      expect(init.json).toMatchObject({
        result: { protocolVersion: '2025-06-18' },
      });
      const initialized = await call('@/pages/api/mcp/index.page', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${tokens.access_token}`,
        },
        body: { jsonrpc: '2.0', method: 'notifications/initialized' },
      });
      expect(initialized.status).toBe(202);
      const list = await rpc(tokens.access_token, 'tools/list');
      expect(
        (list.json as { result: { tools: unknown[] } }).result.tools,
      ).toHaveLength(6);
    });

    it('finds the product and shows its images with previews', async () => {
      const found = await tool(tokens.access_token, 'search_products', {
        query: 'zorbaphone',
      });
      expect(found.structuredContent?.results?.[0]?.productId).toBe(productId);
      // The same data as text, for clients that never pass structuredContent
      // to the model.
      expect(JSON.parse(found.content[1].text!)).toEqual(
        found.structuredContent,
      );

      const images = await tool(tokens.access_token, 'get_product_images', {
        productId,
      });
      expect(images.structuredContent?.images).toHaveLength(2);
      expect(images.structuredContent?.images?.[0].key).toMatch(
        /^mcp-.*\.png$/,
      );
      const previews = images.content.filter((c) => c.type === 'image');
      expect(previews).toHaveLength(2);
      // Small PNGs are copied unchanged, so the previews are PNG, not JPEG.
      expect(previews.map((c) => c.mimeType)).toEqual([
        'image/png',
        'image/png',
      ]);
      expect(JSON.stringify(images)).not.toContain(root);
    });

    it('adds a ChatGPT image as the main image and logs it', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          new Response(new Uint8Array(pngBytes), { status: 200 }),
        );
      vi.stubGlobal('fetch', fetchMock);
      const added = await tool(tokens.access_token, 'add_product_image', {
        productId,
        image: { download_url: FILE_URL, file_id: 'sediment://file_1' },
        position: 1,
      });
      expect(added.isError).toBeUndefined();
      expect(fetchMock).toHaveBeenCalledWith(FILE_URL, expect.anything());
      const product = await prisma.product.findUniqueOrThrow({
        where: { id: productId },
      });
      expect(product.imgUrls).toHaveLength(3);
      expect(fs.existsSync(product.imgUrls[0])).toBe(true);
      expect(added.structuredContent?.images?.[0].isMain).toBe(true);

      await vi.waitFor(async () => {
        const row = await prisma.adminActivity.findFirst({
          where: { entityId: productId, userId: superuser.userId },
          orderBy: { createdAt: 'desc' },
        });
        expect(row?.meta).toMatchObject({ via: 'mcp', imagesAdded: 1 });
      });
    });

    it('never downloads from a host outside the allowlist', async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      const refused = await tool(tokens.access_token, 'add_product_image', {
        productId,
        image: { download_url: 'http://169.254.169.254/latest', file_id: 'x' },
      });
      expect(refused.isError).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects a file that is not an image and leaves nothing behind', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response('<svg/>', { status: 200 })),
      );
      const before = fs.readdirSync(path.join(root, 'products')).length;
      const refused = await tool(tokens.access_token, 'add_product_image', {
        productId,
        image: { download_url: FILE_URL, file_id: 'x' },
      });
      expect(refused.isError).toBe(true);
      expect(fs.readdirSync(path.join(root, 'products'))).toHaveLength(before);
    });

    it('reorders only when given exactly the current set', async () => {
      const { imgUrls } = await prisma.product.findUniqueOrThrow({
        where: { id: productId },
      });
      const keys = imgUrls.map((stored) => path.basename(stored));
      const partial = await tool(
        tokens.access_token,
        'reorder_product_images',
        {
          productId,
          imageKeys: keys.slice(1),
        },
      );
      expect(partial.isError).toBe(true);
      const foreign = await tool(
        tokens.access_token,
        'reorder_product_images',
        {
          productId,
          imageKeys: [...keys.slice(1), 'https://evil.example/x.png'],
        },
      );
      expect(foreign.isError).toBe(true);

      const reversed = await tool(
        tokens.access_token,
        'reorder_product_images',
        { productId, imageKeys: [...keys].reverse() },
      );
      expect(reversed.isError).toBeUndefined();
      const after = await prisma.product.findUniqueOrThrow({
        where: { id: productId },
      });
      expect(after.imgUrls).toEqual([...imgUrls].reverse());
    });

    it('replaces in place and removes, deleting files no product uses', async () => {
      const { createCompressedImgUrl } = await import('@/lib/productImages');
      const onDisk = (stored: string) =>
        [
          stored,
          createCompressedImgUrl(stored, 'bad')!,
          createCompressedImgUrl(stored, 'good')!,
        ].map((file) => fs.existsSync(file));
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(
            new Response(new Uint8Array(pngBytes), { status: 200 }),
          ),
      );
      const { imgUrls } = await prisma.product.findUniqueOrThrow({
        where: { id: productId },
      });
      const replaced = await tool(
        tokens.access_token,
        'replace_product_image',
        {
          productId,
          imageKey: path.basename(imgUrls[1]),
          image: { download_url: FILE_URL, file_id: 'x' },
        },
      );
      expect(replaced.isError).toBeUndefined();
      const afterReplace = await prisma.product.findUniqueOrThrow({
        where: { id: productId },
      });
      expect(afterReplace.imgUrls[0]).toBe(imgUrls[0]);
      expect(afterReplace.imgUrls[1]).not.toBe(imgUrls[1]);
      expect(onDisk(imgUrls[1])).toEqual([false, false, false]);
      expect(replaced.content[0].text).toMatch(/deleted from the server/);

      // A soft-deleted product can be restored, so a file it lists is kept.
      // Its stored path names another directory: /media serves the copies by
      // file name alone, so the name is what counts.
      const shared = afterReplace.imgUrls[1];
      const sibling = await prisma.product.create({
        data: {
          slug: `mcp-sibling-${Date.now()}`,
          name: JSON.stringify({ ru: 'Sibling' }),
          categoryId,
          imgUrls: [`C:\\old\\images\\products\\${path.basename(shared)}`],
          deletedAt: new Date(),
        },
      });
      for (const stored of afterReplace.imgUrls.slice(1)) {
        // eslint-disable-next-line no-await-in-loop
        const removed = await tool(
          tokens.access_token,
          'remove_product_image',
          {
            productId,
            imageKey: path.basename(stored),
          },
        );
        expect(removed.isError).toBeUndefined();
        const kept = stored === shared;
        expect(onDisk(stored)).toEqual([kept, kept, kept]);
        expect(removed.content[0].text).toMatch(
          kept ? /another product still uses it/ : /deleted from the server/,
        );
      }
      await prisma.product.delete({ where: { id: sibling.id } });
      const last = await tool(tokens.access_token, 'remove_product_image', {
        productId,
        imageKey: path.basename(afterReplace.imgUrls[0]),
      });
      expect(last.isError).toBe(true);
      expect(
        (await prisma.product.findUniqueOrThrow({ where: { id: productId } }))
          .imgUrls,
      ).toHaveLength(1);
    });
  });

  describe('Claude and Gemini', () => {
    async function connectAs(app: AppClient) {
      const { verifier, challenge } = pkcePair();
      const approved = await authorize(superuser, challenge, {
        client_id: app.client_id,
        redirect_uri: app.redirect,
      });
      const redirectTo = new URL(approved.json.redirectTo as string);
      expect(redirectTo.origin + redirectTo.pathname).toBe(app.redirect);
      const traded = await call('@/pages/api/mcp/oauth/token.page', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: {
          grant_type: 'authorization_code',
          code: redirectTo.searchParams.get('code')!,
          code_verifier: verifier,
          redirect_uri: app.redirect,
          client_id: app.client_id,
          client_secret: app.client_secret,
        },
      });
      expect(traded.status).toBe(200);
      return traded.json as { access_token: string; refresh_token: string };
    }
    const refreshAs = (app: AppClient, refreshToken: string) =>
      call('@/pages/api/mcp/oauth/token.page', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: {
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: app.client_id,
          client_secret: app.client_secret,
        },
      });

    it('connects Claude without the tools that need a file from the chat', async () => {
      const live = await connectAs(claude);
      const listed = await rpc(live.access_token, 'tools/list');
      const names = (listed.json.result as { tools: { name: string }[] }).tools
        .map((t) => t.name)
        .sort();
      expect(names).toEqual([
        'get_product_images',
        'remove_product_image',
        'reorder_product_images',
        'search_products',
      ]);
      const add = await rpc(live.access_token, 'tools/call', {
        name: 'add_product_image',
        arguments: {
          productId,
          image: { download_url: FILE_URL, file_id: 'sediment://x' },
        },
      });
      expect(add.json.error).toMatchObject({ code: -32602 });
      const images = await tool(live.access_token, 'get_product_images', {
        productId,
      });
      expect(images.isError).toBeUndefined();
      // Claude rotates refresh tokens like ChatGPT.
      const rotated = await refreshAs(claude, live.refresh_token);
      expect(rotated.json.refresh_token).not.toBe(live.refresh_token);
    });

    it("keeps Gemini's refresh token the same and renews only the access token", async () => {
      const live = await connectAs(gemini);
      const listed = await rpc(live.access_token, 'tools/list');
      expect(
        (listed.json.result as { tools: { name: string }[] }).tools.map(
          (t) => t.name,
        ),
      ).not.toContain('add_product_image');

      const grant = await prisma.mcpGrant.findUniqueOrThrow({
        where: { accessTokenHash: sha256(live.access_token) },
      });
      // As if the access token was issued 16 minutes ago and has run out.
      const ranOut = async () => {
        const current = await prisma.mcpGrant.findUniqueOrThrow({
          where: { id: grant.id },
        });
        const { tokenPairFor } = await import('@/lib/mcp/oauthTokens');
        const generation = Date.now() - 60_000;
        const fresh = { generation, ...tokenPairFor(grant.id, generation) };
        await prisma.mcpGrant.update({
          where: { id: grant.id },
          data: {
            accessIssuedAt: new Date(fresh.generation - 900_000),
            accessExpiresAt: new Date(fresh.generation),
            accessTokenHash: sha256(fresh.accessToken),
          },
        });
        return current;
      };

      await ranOut();
      const first = await refreshAs(gemini, live.refresh_token);
      expect(first.status).toBe(200);
      expect(first.json.refresh_token).toBe(live.refresh_token);
      expect(first.json.access_token).not.toBe(live.access_token);
      expect(
        (await rpc(first.json.access_token as string, 'ping')).status,
      ).toBe(200);
      // The same refresh again soon after gets the same access token.
      const again = await refreshAs(gemini, live.refresh_token);
      expect(again.json.access_token).toBe(first.json.access_token);
      expect(again.json.refresh_token).toBe(live.refresh_token);

      // Later, two refreshes racing get one new access token between them.
      await ranOut();
      const [a, b] = await Promise.all([
        refreshAs(gemini, live.refresh_token),
        refreshAs(gemini, live.refresh_token),
      ]);
      expect([a.status, b.status]).toEqual([200, 200]);
      expect(a.json.access_token).toBe(b.json.access_token);
      expect(a.json.refresh_token).toBe(live.refresh_token);
      expect((await rpc(a.json.access_token as string, 'ping')).status).toBe(
        200,
      );

      const after = await prisma.mcpGrant.findUniqueOrThrow({
        where: { id: grant.id },
      });
      expect(after.refreshTokenHash).toBe(grant.refreshTokenHash);
      expect(after.previousRefreshTokenHash).toBeNull();
      expect(after.refreshExpiresAt.getTime()).toBeGreaterThanOrEqual(
        grant.refreshExpiresAt.getTime(),
      );
    });

    it('answers a repeated Gemini code trade after a refresh with what it holds now', async () => {
      const { verifier, challenge } = pkcePair();
      const approved = await authorize(superuser, challenge, {
        client_id: gemini.client_id,
        redirect_uri: gemini.redirect,
      });
      const trade = () =>
        call('@/pages/api/mcp/oauth/token.page', {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: {
            grant_type: 'authorization_code',
            code: new URL(approved.json.redirectTo as string).searchParams.get(
              'code',
            )!,
            code_verifier: verifier,
            redirect_uri: gemini.redirect,
            client_id: gemini.client_id,
            client_secret: gemini.client_secret,
          },
        });
      const first = (await trade()).json as typeof tokens;
      // Its access token ran out and was renewed; the refresh token stays.
      const grant = await prisma.mcpGrant.findUniqueOrThrow({
        where: { accessTokenHash: sha256(first.access_token) },
      });
      const { tokenPairFor } = await import('@/lib/mcp/oauthTokens');
      const lapsed = Date.now() - 60_000;
      await prisma.mcpGrant.update({
        where: { id: grant.id },
        data: {
          accessIssuedAt: new Date(lapsed - 900_000),
          accessExpiresAt: new Date(lapsed),
          accessTokenHash: sha256(tokenPairFor(grant.id, lapsed).accessToken),
        },
      });
      const renewed = await refreshAs(gemini, first.refresh_token);
      expect(renewed.status).toBe(200);

      const again = await trade();
      expect(again.status).toBe(200);
      expect(again.json.refresh_token).toBe(first.refresh_token);
      expect(again.json.access_token).toBe(renewed.json.access_token);
      expect(
        (await rpc(again.json.access_token as string, 'ping')).status,
      ).toBe(200);
    });
  });

  describe('token lifecycle', () => {
    async function refresh(refreshToken: string): Promise<Reply> {
      return call('@/pages/api/mcp/oauth/token.page', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: {
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        },
      });
    }

    it('rotates on refresh and ends the grant when an old token comes back', async () => {
      const first = await connect(superuser);
      const rotated = await refresh(first.refresh_token);
      expect(rotated.status).toBe(200);
      const second = rotated.json as typeof first;
      // The replaced access token still works for a while, for calls
      // already on their way with it.
      expect((await rpc(first.access_token, 'ping')).status).toBe(200);
      expect((await rpc(second.access_token, 'ping')).status).toBe(200);

      const grant = await prisma.mcpGrant.findFirstOrThrow({
        where: { userId: superuser.userId, revokedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      expect(grant.previousRefreshTokenHash).not.toBeNull();

      // The old token again soon after (a retry after a lost answer, or a
      // second call that raced the first) gets the same pair, so whichever
      // answer the client keeps works. Nothing is written.
      const retried = await refresh(first.refresh_token);
      expect(retried.status).toBe(200);
      expect(retried.json.access_token).toBe(second.access_token);
      expect(retried.json.refresh_token).toBe(second.refresh_token);
      expect(retried.json.expires_in).toBeLessThanOrEqual(900);
      expect((await rpc(second.access_token, 'ping')).status).toBe(200);
      const afterRetry = await prisma.mcpGrant.findUniqueOrThrow({
        where: { id: grant.id },
      });
      expect(afterRetry.accessExpiresAt).toEqual(grant.accessExpiresAt);

      // Long after the rotation it means the token leaked. Six minutes ago:
      // the access token is still in date, so only the revocation stops it.
      // The replaced one has run out by then.
      await prisma.mcpGrant.update({
        where: { id: grant.id },
        data: {
          accessIssuedAt: new Date(Date.now() - 360_000),
          previousAccessExpiresAt: new Date(Date.now() - 60_000),
        },
      });
      expect((await rpc(first.access_token, 'ping')).status).toBe(401);
      expect((await rpc(second.access_token, 'ping')).status).toBe(200);
      expect((await refresh(first.refresh_token)).json.error).toBe(
        'invalid_grant',
      );
      expect((await rpc(second.access_token, 'ping')).status).toBe(401);
      expect((await refresh(second.refresh_token)).json.error).toBe(
        'invalid_grant',
      );
    });

    it('answers a late retry of a lost refresh until its pair is used', async () => {
      const first = await connect(superuser);
      const rotated = (await refresh(first.refresh_token)).json as typeof first;
      const grant = await prisma.mcpGrant.findFirstOrThrow({
        where: { accessTokenHash: sha256(rotated.access_token) },
      });
      // The answer was lost and the client retries on its next tool call,
      // long after the rotation. Its new pair was never used, so this is the
      // retry, not a leak.
      await prisma.mcpGrant.update({
        where: { id: grant.id },
        data: { accessIssuedAt: new Date(Date.now() - 20 * 60_000) },
      });
      const retried = await refresh(first.refresh_token);
      expect(retried.status).toBe(200);
      expect(retried.json.refresh_token).toBe(rotated.refresh_token);
      // Once the new pair is in use, the old token coming back is a leak.
      expect((await rpc(rotated.access_token, 'ping')).status).toBe(200);
      expect((await refresh(first.refresh_token)).json.error).toBe(
        'invalid_grant',
      );
      expect((await rpc(rotated.access_token, 'ping')).status).toBe(401);
    });

    it('answers two refreshes racing with the same pair', async () => {
      const live = await connect(superuser);
      const [a, b] = await Promise.all([
        refresh(live.refresh_token),
        refresh(live.refresh_token),
      ]);
      expect([a.status, b.status]).toEqual([200, 200]);
      expect(a.json.access_token).toBe(b.json.access_token);
      expect(a.json.refresh_token).toBe(b.json.refresh_token);
      expect((await rpc(a.json.access_token as string, 'ping')).status).toBe(
        200,
      );
      expect((await refresh(a.json.refresh_token as string)).status).toBe(200);
    });

    it('ends the grant when a token older than the previous one comes back', async () => {
      const first = await connect(superuser);
      const second = (await refresh(first.refresh_token)).json as typeof first;
      const third = (await refresh(second.refresh_token)).json as typeof first;
      expect((await rpc(third.access_token, 'ping')).status).toBe(200);
      expect((await refresh(first.refresh_token)).json.error).toBe(
        'invalid_grant',
      );
      expect((await rpc(third.access_token, 'ping')).status).toBe(401);
    });

    it('refuses a refresh token it did not make, without ending anything', async () => {
      const live = await connect(superuser);
      const [grantId] = live.refresh_token.slice('xmcp_rt_'.length).split('.');
      const forged = `xmcp_rt_${grantId}.1800000000000.${'b'.repeat(43)}`;
      expect((await refresh(forged)).json.error).toBe('invalid_grant');
      expect((await rpc(live.access_token, 'ping')).status).toBe(200);
      // Its own token with a leading zero: the same number, so the MAC
      // passes, but not the token issued. Refused, and it ends nothing.
      const [, generation, mac] = live.refresh_token
        .slice('xmcp_rt_'.length)
        .split('.');
      const padded = `xmcp_rt_${grantId}.0${generation}.${mac}`;
      expect((await refresh(padded)).json.error).toBe('invalid_grant');
      expect((await rpc(live.access_token, 'ping')).status).toBe(200);
      expect((await refresh(live.refresh_token)).status).toBe(200);
    });

    it('cuts off a superuser who is demoted', async () => {
      const live = await connect(superuser);
      expect((await rpc(live.access_token, 'ping')).status).toBe(200);
      await prisma.user.update({
        where: { id: superuser.userId },
        data: { grade: UserRole.ADMIN },
      });
      expect((await rpc(live.access_token, 'ping')).status).toBe(401);
      await prisma.user.update({
        where: { id: superuser.userId },
        data: { grade: UserRole.SUPERUSER },
      });
    });

    it('lists and revokes grants for superusers only', async () => {
      const live = await connect(superuser);
      const asAdmin = await call('@/pages/api/mcp/grants.page', {
        method: 'GET',
        headers: { authorization: `Bearer ${admin.accessToken}` },
      });
      expect(asAdmin.status).toBe(403);
      // A connection whose refresh token lapsed can't go on, so isn't listed.
      const lapsed = await connect(superuser);
      const lapsedGrant = await prisma.mcpGrant.update({
        where: {
          accessTokenHash: crypto
            .createHash('sha256')
            .update(lapsed.access_token)
            .digest('hex'),
        },
        data: { refreshExpiresAt: new Date(Date.now() - 1000) },
      });
      const listed = await call('@/pages/api/mcp/grants.page', {
        method: 'GET',
        headers: { authorization: `Bearer ${superuser.accessToken}` },
      });
      const grants = listed.json.data as {
        id: string;
        clientName: string;
        active: boolean;
      }[];
      expect(grants.length).toBeGreaterThan(0);
      expect(grants.map((grant) => grant.id)).not.toContain(lapsedGrant.id);
      expect(grants[0].clientName).toBe('ChatGPT');
      expect(grants[0].active).toBe(true);
      const revokeAll = await call('@/pages/api/mcp/grants.page', {
        method: 'DELETE',
        headers: { authorization: `Bearer ${superuser.accessToken}` },
        query: { all: 'true' },
      });
      expect(revokeAll.status).toBe(200);
      expect((await rpc(live.access_token, 'ping')).status).toBe(401);
    });

    it('cuts off a client taken out of MCP_CLIENTS', async () => {
      const live = await connect(superuser);
      expect((await rpc(live.access_token, 'ping')).status).toBe(200);
      vi.stubEnv(
        'MCP_CLIENTS',
        JSON.stringify(
          (JSON.parse(clientsEnv) as { id: string }[]).filter(
            (client) => client.id !== clientId,
          ),
        ),
      );
      try {
        expect((await rpc(live.access_token, 'ping')).status).toBe(401);
        expect((await refresh(live.refresh_token)).status).toBe(401);
        // Still listed, as not working, so it can be revoked: putting the
        // client back would revive it.
        const listed = await call('@/pages/api/mcp/grants.page', {
          method: 'GET',
          headers: { authorization: `Bearer ${superuser.accessToken}` },
        });
        const grant = await prisma.mcpGrant.findUniqueOrThrow({
          where: { accessTokenHash: sha256(live.access_token) },
        });
        const entry = (
          listed.json.data as {
            id: string;
            active: boolean;
            inactiveReason: string | null;
          }[]
        ).find((listedGrant) => listedGrant.id === grant.id);
        expect(entry).toMatchObject({
          active: false,
          inactiveReason: 'client_removed',
        });
      } finally {
        vi.stubEnv('MCP_CLIENTS', clientsEnv);
      }
    });

    it('goes dark when the kill switch is off', async () => {
      const live = await connect(superuser);
      vi.stubEnv('MCP_ENABLED', 'false');
      try {
        expect((await rpc(live.access_token, 'ping')).status).toBe(404);
        const metadata = await call(
          '@/pages/api/mcp/well-known/authorization-server.page',
          { method: 'GET' },
        );
        expect(metadata.status).toBe(404);
      } finally {
        vi.stubEnv('MCP_ENABLED', 'true');
      }
    });
  });
});
