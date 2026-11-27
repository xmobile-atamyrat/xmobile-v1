import crypto from 'node:crypto';

import dbClient from '@/lib/dbClient';
import { sealAuthCode, openAuthCode } from '@/lib/mcp/authCode';
import {
  clientRotatesRefreshTokens,
  findClient,
  McpClientConfig,
} from '@/lib/mcp/clients';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  AUTH_CODE_TTL_SECONDS,
  AUTHORIZE_PARAM_NAMES,
  GRANT_MAX_AGE_SECONDS,
  isAllowedRedirectUri,
  MCP_SCOPE,
  mcpResourceUrl,
  urlHost,
  REFRESH_TOKEN_TTL_SECONDS,
} from '@/lib/mcp/config';
import {
  ACCESS_TOKEN_PREFIX,
  hashSecret,
  isValidCodeChallenge,
  isValidCodeVerifier,
  parseRefreshToken,
  pkceS256,
  safeEqual,
  tokenPairFor,
  TokenPair,
} from '@/lib/mcp/oauthTokens';
import { Prisma, UserRole } from '@prisma/client';

/**
 * An RFC 6749 error, sent as `{ error, error_description }`. One found once
 * the client and its redirect are confirmed also has `redirectTo`: RFC 6749
 * §4.1.2.1 sends it back to the client's `redirect_uri` (with `state`), so
 * the AI app learns what went wrong instead of waiting on a dead page.
 */
export class OAuthError extends Error {
  constructor(
    public readonly code: string,
    description: string,
    public readonly status: number = 400,
    public readonly redirectTo: string | null = null,
  ) {
    super(description);
  }
}

const secondsToMs = (n: number) => n * 1000;

/**
 * Superusers only, read from the database on every use, never from a token:
 * checked on the user row loaded with the grant (`include: { user:
 * userStanding }`), so it costs no second query.
 */
const userStanding = { select: { grade: true, deletedAt: true } } as const;

function isActiveSuperuser(
  user: { grade: UserRole; deletedAt: Date | null } | null,
): boolean {
  return (
    user != null && user.deletedAt == null && user.grade === UserRole.SUPERUSER
  );
}

// ---------------------------------------------------------------------------
// Authorization request (shown on /oauth/authorize, approved by the API)

export type AuthorizeParams = Partial<
  Record<(typeof AUTHORIZE_PARAM_NAMES)[number], string>
>;

export type ValidAuthorizeRequest = {
  clientId: string;
  clientName: string;
  redirectUri: string;
  redirectHost: string;
  codeChallenge: string;
  state: string | null;
  scope: string;
};

function sameResource(requested: string, expected: string): boolean {
  return requested.replace(/\/+$/, '') === expected;
}

export function buildRedirect(
  origin: string,
  request: Pick<ValidAuthorizeRequest, 'redirectUri' | 'state'>,
  values: Record<string, string>,
): string {
  const url = new URL(request.redirectUri);
  Object.entries(values).forEach(([key, value]) =>
    url.searchParams.set(key, value),
  );
  if (request.state != null) url.searchParams.set('state', request.state);
  // RFC 9207: names the issuer, so a client talking to several servers can't
  // be tricked into sending this code to the wrong one.
  url.searchParams.set('iss', origin);
  return url.toString();
}

/**
 * Checks a request before anything is shown or redirected. Until the client
 * and its redirect are confirmed, that URI is just something a link claimed,
 * so those errors are thrown as plain `OAuthError`s and shown on the page.
 * Everything after comes with a `redirectTo` for the client.
 */
export async function validateAuthorizeRequest(
  origin: string,
  params: AuthorizeParams,
): Promise<ValidAuthorizeRequest> {
  if (!params.client_id || params.client_id.length > 200) {
    throw new OAuthError('invalid_request', 'client_id is missing');
  }
  const client = findClient(params.client_id);
  if (client == null) throw new OAuthError('invalid_client', 'Unknown client');
  const redirectUri = params.redirect_uri ?? '';
  if (
    !client.redirectUris.includes(redirectUri) ||
    !isAllowedRedirectUri(redirectUri)
  ) {
    throw new OAuthError('invalid_request', 'redirect_uri is not registered');
  }

  // An oversized state is not echoed back: the error goes without it.
  const stateTooLong = params.state != null && params.state.length > 1000;
  const state = stateTooLong ? null : params.state ?? null;
  const fail = (code: string, description: string): never => {
    throw new OAuthError(
      code,
      description,
      400,
      buildRedirect(
        origin,
        { redirectUri, state },
        { error: code, error_description: description },
      ),
    );
  };
  if (stateTooLong) fail('invalid_request', 'state is too long');
  if (params.response_type !== 'code') {
    fail('unsupported_response_type', 'response_type must be code');
  }
  if (
    params.code_challenge_method !== 'S256' ||
    !isValidCodeChallenge(params.code_challenge)
  ) {
    fail('invalid_request', 'PKCE with S256 is required');
  }
  const scopes = (params.scope ?? '').split(' ').filter(Boolean);
  if (scopes.some((scope) => scope !== MCP_SCOPE)) {
    fail('invalid_scope', `Only the ${MCP_SCOPE} scope exists`);
  }
  if (
    params.resource != null &&
    !sameResource(params.resource, mcpResourceUrl(origin))
  ) {
    fail('invalid_target', 'Unknown resource');
  }
  return {
    clientId: client.id,
    clientName: client.name,
    redirectUri,
    redirectHost: new URL(redirectUri).hostname,
    codeChallenge: params.code_challenge,
    state,
    scope: MCP_SCOPE,
  };
}

/**
 * Seals the superuser's approval into a code (see `authCode.ts`) and returns
 * the URL to send them back to. Nothing is written until the code is traded.
 * `actor` is who the approve route authenticated, with the grade it just read
 * from the database.
 */
export function approveAuthorization(
  origin: string,
  actor: { userId: string; grade: UserRole | undefined },
  request: ValidAuthorizeRequest,
): string {
  if (actor.grade !== UserRole.SUPERUSER) {
    throw new OAuthError('access_denied', 'Only superusers can connect', 403);
  }
  const code = sealAuthCode({
    clientId: request.clientId,
    userId: actor.userId,
    redirectUri: request.redirectUri,
    codeChallenge: request.codeChallenge,
    scope: request.scope,
    expiresAt: Date.now() + secondsToMs(AUTH_CODE_TTL_SECONDS),
  });
  return buildRedirect(origin, request, { code });
}

export async function revokeGrant(grantId: string): Promise<boolean> {
  const { count } = await dbClient.mcpGrant.updateMany({
    where: { id: grantId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return count === 1;
}

export async function revokeAllGrants(): Promise<number> {
  const { count } = await dbClient.mcpGrant.updateMany({
    where: { revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return count;
}

// ---------------------------------------------------------------------------
// Token endpoint

export type TokenResponse = {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string;
  scope: string;
};

type ClientCredentials = { clientId?: string; clientSecret?: string };

/** Every client has a secret (see `clients.ts`), and it is always required. */
function authenticateClient({
  clientId,
  clientSecret,
}: ClientCredentials): McpClientConfig {
  if (!clientId) {
    throw new OAuthError('invalid_client', 'client_id is missing', 401);
  }
  const client = findClient(clientId);
  if (client == null) {
    throw new OAuthError('invalid_client', 'Unknown client', 401);
  }
  if (
    clientSecret == null ||
    !safeEqual(hashSecret(clientSecret), client.secretHash)
  ) {
    throw new OAuthError('invalid_client', 'Client authentication failed', 401);
  }
  return client;
}

/**
 * The pair for a grant's generation (its access expiry), with the hashes to
 * store. See `tokenPairFor`: the same grant and generation always give the
 * same pair, which is what lets a repeated request get the same answer.
 */
function pairFor(grantId: string, accessExpiresAt: Date) {
  const tokens = tokenPairFor(grantId, accessExpiresAt.getTime());
  return {
    ...tokens,
    accessTokenHash: hashSecret(tokens.accessToken),
    refreshTokenHash: hashSecret(tokens.refreshToken),
  };
}

function tokenResponse(
  tokens: TokenPair,
  scope: string,
  expiresIn: number = ACCESS_TOKEN_TTL_SECONDS,
): TokenResponse {
  return {
    access_token: tokens.accessToken,
    token_type: 'Bearer',
    expires_in: expiresIn,
    refresh_token: tokens.refreshToken,
    scope,
  };
}

const invalidGrant = () =>
  new OAuthError('invalid_grant', 'The code or token is invalid or expired');

type HeldGrant = {
  id: string;
  scope: string;
  accessExpiresAt: Date;
  accessTokenHash: string;
  refreshTokenHash: string;
  refreshGeneration: Date;
};

/**
 * The access expiry of a grant's next generation: a full lifetime from now,
 * and always later than the last even within one millisecond, so two
 * renewals never derive the same pair.
 */
function nextAccessExpiry(grant: { accessExpiresAt: Date }, now: number) {
  return new Date(
    Math.max(
      now + secondsToMs(ACCESS_TOKEN_TTL_SECONDS),
      grant.accessExpiresAt.getTime() + 1,
    ),
  );
}

/** A refresh pushes the refresh token's expiry out, never past the grant's. */
function extendedRefreshExpiry(grant: { expiresAt: Date }, now: number) {
  return new Date(
    Math.min(
      now + secondsToMs(REFRESH_TOKEN_TTL_SECONDS),
      grant.expiresAt.getTime(),
    ),
  );
}

/**
 * The pair a grant holds now, sent again to a request that repeats one
 * already answered, with what is left of its life. The access token is of
 * the grant's current generation (its access expiry), the refresh token of
 * the stored `refreshGeneration`: the same for a client that rotates, the
 * first one for a Gemini grant. Null if either stored hash doesn't match (the
 * row was changed by hand), so nothing dead is handed out.
 */
function heldPair(grant: HeldGrant, now: number): TokenResponse | null {
  const { accessToken } = tokenPairFor(
    grant.id,
    grant.accessExpiresAt.getTime(),
  );
  const { refreshToken } = tokenPairFor(
    grant.id,
    grant.refreshGeneration.getTime(),
  );
  if (
    !safeEqual(hashSecret(accessToken), grant.accessTokenHash) ||
    !safeEqual(hashSecret(refreshToken), grant.refreshTokenHash)
  ) {
    return null;
  }
  return tokenResponse(
    { accessToken, refreshToken },
    grant.scope,
    Math.max(0, Math.floor((grant.accessExpiresAt.getTime() - now) / 1000)),
  );
}

/**
 * The VM's link drops responses, and clients repeat requests (a retry after
 * a lost answer, possibly after a backoff, or two calls racing). Within this
 * long of a code trade or a rotation, the same request proven by the same
 * client gets the same pair again, and the access token that was replaced
 * still works, so calls already in flight with it don't fail. After that, or
 * without the proof, the code or token leaked and the grant ends. A longer
 * window gives a stolen previous refresh token longer to be used unnoticed.
 * A refresh repeated later still gets the pair while its access token has
 * never been used (see `refreshAccessToken`).
 */
const REPEAT_GRACE_MS = 5 * 60_000;

/**
 * Another refresh changed the grant between this one's read and its write.
 * The winner's pair is this one's answer too, if `stillValid` says the
 * presented token is one the winner accepts.
 */
async function winnerPair(
  grantId: string,
  now: number,
  stillValid: (winner: { previousRefreshTokenHash: string | null }) => boolean,
): Promise<TokenResponse> {
  const winner = await dbClient.mcpGrant.findUnique({ where: { id: grantId } });
  const again =
    winner != null && winner.revokedAt == null && stillValid(winner)
      ? heldPair(winner, now)
      : null;
  if (again == null) throw invalidGrant();
  return again;
}

/**
 * The columns that keep a replaced access token working for
 * `REPEAT_GRACE_MS`, or until it would have run out if that is sooner. One
 * already out of date is not kept.
 */
function retiredAccess(
  grant: { accessTokenHash: string; accessExpiresAt: Date },
  now: number,
) {
  const until = Math.min(
    grant.accessExpiresAt.getTime(),
    now + REPEAT_GRACE_MS,
  );
  return until > now
    ? {
        previousAccessTokenHash: grant.accessTokenHash,
        previousAccessExpiresAt: new Date(until),
      }
    : { previousAccessTokenHash: null, previousAccessExpiresAt: null };
}

export async function exchangeAuthorizationCode(
  origin: string,
  input: ClientCredentials & {
    code?: string;
    redirectUri?: string;
    codeVerifier?: string;
    resource?: string;
  },
  raced = false,
): Promise<TokenResponse> {
  const client = authenticateClient(input);
  if (!input.code || !isValidCodeVerifier(input.codeVerifier)) {
    throw new OAuthError(
      'invalid_request',
      'code and code_verifier are required',
    );
  }
  const code = openAuthCode(input.code);
  // The client comes first: otherwise anyone holding a spent code could post
  // it under some other client and end the connection it was traded for.
  if (code == null || code.clientId !== client.id) throw invalidGrant();
  const matches =
    code.redirectUri === input.redirectUri &&
    safeEqual(pkceS256(input.codeVerifier), code.codeChallenge) &&
    (input.resource == null ||
      sameResource(input.resource, mcpResourceUrl(origin)));
  const authCodeHash = hashSecret(input.code);
  const spent = await dbClient.mcpGrant.findUnique({
    where: { authCodeHash },
    select: {
      id: true,
      scope: true,
      createdAt: true,
      accessExpiresAt: true,
      accessTokenHash: true,
      refreshTokenHash: true,
      refreshGeneration: true,
      previousRefreshTokenHash: true,
      revokedAt: true,
    },
  });
  const now = Date.now();
  if (spent != null) {
    // The same trade again: the PKCE verifier (which only the client holds),
    // soon after, and the pair not yet refreshed. Anything else means the
    // code leaked: what it bought goes too.
    const repeat =
      matches &&
      spent.revokedAt == null &&
      spent.previousRefreshTokenHash == null &&
      now - spent.createdAt.getTime() <= REPEAT_GRACE_MS;
    if (!repeat) {
      await revokeGrant(spent.id);
      throw invalidGrant();
    }
  } else if (code.expiresAt < now || !matches) {
    throw invalidGrant();
  }
  const user = await dbClient.user.findUnique({
    where: { id: code.userId },
    ...userStanding,
  });
  if (!isActiveSuperuser(user)) throw invalidGrant();

  if (spent != null) {
    // A Gemini grant may have renewed its access token since: the current
    // one comes back, with the refresh token it was given first.
    const again = heldPair(spent, now);
    if (again == null) throw invalidGrant();
    return again;
  }

  const grantId = crypto.randomUUID();
  const accessExpiresAt = new Date(now + secondsToMs(ACCESS_TOKEN_TTL_SECONDS));
  const tokens = pairFor(grantId, accessExpiresAt);
  try {
    await dbClient.mcpGrant.create({
      data: {
        id: grantId,
        clientId: client.id,
        userId: code.userId,
        scope: code.scope,
        authCodeHash,
        accessTokenHash: tokens.accessTokenHash,
        accessIssuedAt: new Date(now),
        accessExpiresAt,
        refreshTokenHash: tokens.refreshTokenHash,
        refreshGeneration: accessExpiresAt,
        refreshExpiresAt: new Date(
          now + secondsToMs(REFRESH_TOKEN_TTL_SECONDS),
        ),
        expiresAt: new Date(now + secondsToMs(GRANT_MAX_AGE_SECONDS)),
        createdAt: new Date(now),
      },
    });
  } catch (error) {
    // Two trades of one code racing: the unique hash lets one create the
    // grant, and the other, run again, answers with that grant's pair.
    if (
      !raced &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return exchangeAuthorizationCode(origin, input, true);
    }
    throw error;
  }
  return tokenResponse(tokens, code.scope);
}

/**
 * A refresh for a client whose refresh token must not change (Gemini, see
 * `clientRotatesRefreshTokens`): the token it holds keeps working and only
 * the access token is new. Within `REPEAT_GRACE_MS` of the last renewal the
 * same access token comes back, so a retry, or two refreshes racing, get one
 * answer.
 */
async function renewAccessOnly(
  grant: HeldGrant & { expiresAt: Date; accessIssuedAt: Date },
  refreshToken: string,
  now: number,
): Promise<TokenResponse> {
  if (now - grant.accessIssuedAt.getTime() <= REPEAT_GRACE_MS) {
    const again = heldPair(grant, now);
    if (again != null) return again;
  }
  const accessExpiresAt = nextAccessExpiry(grant, now);
  const { accessToken } = tokenPairFor(grant.id, accessExpiresAt.getTime());
  const renewed = await dbClient.mcpGrant.updateMany({
    where: {
      id: grant.id,
      accessExpiresAt: grant.accessExpiresAt,
      revokedAt: null,
    },
    data: {
      accessTokenHash: hashSecret(accessToken),
      accessIssuedAt: new Date(now),
      accessExpiresAt,
      accessUsedAt: null,
      ...retiredAccess(grant, now),
      // "extend its expiration date on your backend", as Google asks.
      refreshExpiresAt: extendedRefreshExpiry(grant, now),
    },
  });
  if (renewed.count !== 1) {
    // Another refresh renewed it first: same answer as that one.
    return winnerPair(grant.id, now, () => true);
  }
  return tokenResponse({ accessToken, refreshToken }, grant.scope);
}

/**
 * Refresh tokens rotate. The current one gets a new pair. The one before it
 * is the same request again (a retry, or a second call that raced the first)
 * and gets the pair that rotation issued, within `REPEAT_GRACE_MS` of the
 * rotation, or later while that pair's access token has never been used: a
 * client whose answer was lost, and who retries only on its next tool call,
 * still holds just the old token. Any other token this server made for the
 * grant (an older one, or the previous one once the new pair is in use and
 * the window is over) is a leaked token coming back, and ends the grant.
 */
export async function refreshAccessToken(
  input: ClientCredentials & { refreshToken?: string },
): Promise<TokenResponse> {
  const client = authenticateClient(input);
  if (!input.refreshToken) {
    throw new OAuthError('invalid_request', 'refresh_token is required');
  }
  const parsed = parseRefreshToken(input.refreshToken);
  if (parsed == null) throw invalidGrant();
  const grant = await dbClient.mcpGrant.findUnique({
    where: { id: parsed.grantId },
    include: { user: userStanding },
  });
  if (grant == null || grant.clientId !== client.id) throw invalidGrant();
  const presented = hashSecret(input.refreshToken);
  const isCurrent = safeEqual(presented, grant.refreshTokenHash);
  const isPrevious =
    !isCurrent &&
    grant.previousRefreshTokenHash != null &&
    safeEqual(presented, grant.previousRefreshTokenHash);
  const now = Date.now();
  const rotatedAt = grant.accessIssuedAt.getTime();
  const retryOfLostAnswer =
    isPrevious &&
    (now - rotatedAt <= REPEAT_GRACE_MS || grant.accessUsedAt == null);
  if (!isCurrent && !retryOfLostAnswer) {
    await revokeGrant(grant.id);
    throw invalidGrant();
  }
  if (
    grant.revokedAt != null ||
    grant.refreshExpiresAt.getTime() < now ||
    grant.expiresAt.getTime() < now ||
    !isActiveSuperuser(grant.user)
  ) {
    throw invalidGrant();
  }
  if (isPrevious) {
    const again = heldPair(grant, now);
    if (again == null) throw invalidGrant();
    return again;
  }
  if (!clientRotatesRefreshTokens(client)) {
    return renewAccessOnly(grant, input.refreshToken, now);
  }

  const accessExpiresAt = nextAccessExpiry(grant, now);
  const tokens = pairFor(grant.id, accessExpiresAt);
  const rotated = await dbClient.mcpGrant.updateMany({
    where: { id: grant.id, refreshTokenHash: presented, revokedAt: null },
    data: {
      accessTokenHash: tokens.accessTokenHash,
      accessIssuedAt: new Date(now),
      accessExpiresAt,
      accessUsedAt: null,
      ...retiredAccess(grant, now),
      refreshTokenHash: tokens.refreshTokenHash,
      refreshGeneration: accessExpiresAt,
      previousRefreshTokenHash: presented,
      refreshExpiresAt: extendedRefreshExpiry(grant, now),
    },
  });
  if (rotated.count !== 1) {
    // Another request with this token rotated it first: same answer as that one.
    return winnerPair(
      grant.id,
      now,
      (winner) =>
        winner.previousRefreshTokenHash != null &&
        safeEqual(presented, winner.previousRefreshTokenHash),
    );
  }
  return tokenResponse(tokens, grant.scope);
}

// ---------------------------------------------------------------------------
// Resource server side

export type McpPrincipal = {
  grantId: string;
  userId: string;
  client: McpClientConfig;
};

const LAST_USED_RESOLUTION_MS = 60_000;

/**
 * The grant behind a bearer token, or null if it is unknown, expired or
 * revoked, or its client was taken out of `MCP_CLIENTS`. A grant's current
 * access token works, and so, briefly, does the one it replaced (see
 * `retiredAccess`).
 */
export async function verifyAccessToken(
  token: string | undefined,
): Promise<McpPrincipal | null> {
  if (!token || !token.startsWith(ACCESS_TOKEN_PREFIX) || token.length > 200) {
    return null;
  }
  const hash = hashSecret(token);
  // One query: the user's role comes with the grant.
  const grant = await dbClient.mcpGrant.findFirst({
    where: {
      OR: [{ accessTokenHash: hash }, { previousAccessTokenHash: hash }],
    },
    include: { user: userStanding },
  });
  const now = Date.now();
  const isCurrent = grant?.accessTokenHash === hash;
  const validUntil = isCurrent
    ? grant?.accessExpiresAt
    : grant?.previousAccessExpiresAt;
  const client = findClient(grant?.clientId);
  if (
    grant == null ||
    validUntil == null ||
    grant.revokedAt != null ||
    validUntil.getTime() < now ||
    grant.expiresAt.getTime() < now ||
    client == null ||
    !isActiveSuperuser(grant.user)
  ) {
    return null;
  }
  if (isCurrent && grant.accessUsedAt == null) {
    // Once per pair: from here on, the refresh token it replaced coming
    // back means a leak, not a retry (see `refreshAccessToken`). Awaited, so
    // the client can't refresh before it lands.
    await dbClient.mcpGrant.updateMany({
      where: { id: grant.id, accessTokenHash: hash, accessUsedAt: null },
      data: { accessUsedAt: new Date(now) },
    });
  }
  if (
    grant.lastUsedAt == null ||
    now - grant.lastUsedAt.getTime() > LAST_USED_RESOLUTION_MS
  ) {
    dbClient.mcpGrant
      .update({ where: { id: grant.id }, data: { lastUsedAt: new Date(now) } })
      .catch(() => undefined);
  }
  return { grantId: grant.id, userId: grant.userId, client };
}

/**
 * Connections not yet revoked or run out. One whose user is no longer an
 * active superuser, or whose client was taken out of `MCP_CLIENTS`, doesn't
 * work, but isn't over either: promoting the user again or putting the
 * client back makes it work again. So it is listed with `active: false` and
 * the reason, and can still be revoked.
 */
export async function listActiveGrants() {
  const now = new Date();
  const grants = await dbClient.mcpGrant.findMany({
    // A lapsed refresh token can't be renewed, so that connection is over too.
    where: {
      revokedAt: null,
      expiresAt: { gt: now },
      refreshExpiresAt: { gt: now },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      clientId: true,
      createdAt: true,
      lastUsedAt: true,
      refreshExpiresAt: true,
      user: { select: { id: true, name: true, ...userStanding.select } },
    },
  });
  return grants.map((grant) => {
    const client = findClient(grant.clientId);
    let inactiveReason: 'client_removed' | 'user_not_superuser' | null = null;
    if (client == null) inactiveReason = 'client_removed';
    else if (!isActiveSuperuser(grant.user)) {
      inactiveReason = 'user_not_superuser';
    }
    return {
      id: grant.id,
      clientId: grant.clientId,
      clientName: client?.name ?? null,
      clientHost: urlHost(client?.redirectUris[0]),
      userId: grant.user.id,
      userName: grant.user.name,
      createdAt: grant.createdAt,
      lastUsedAt: grant.lastUsedAt,
      refreshExpiresAt: grant.refreshExpiresAt,
      active: inactiveReason == null,
      inactiveReason,
    };
  });
}
