import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  appOfRedirectUri,
  clientCanSendFiles,
  clientListProblem,
  clientRotatesRefreshTokens,
  findClient,
  mcpClients,
  newClientEntry,
} from '@/lib/mcp/clients';
import { hashSecret } from '@/lib/mcp/oauthTokens';

const REDIRECT = 'https://chatgpt.com/connector_platform_oauth_redirect';

describe('MCP clients from MCP_CLIENTS', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('has no clients when the variable is unset or blank', () => {
    vi.stubEnv('MCP_CLIENTS', undefined);
    expect(mcpClients()).toEqual([]);
    vi.stubEnv('MCP_CLIENTS', '');
    expect(mcpClients()).toEqual([]);
    expect(findClient('anything')).toBeNull();
  });

  it('finds a client made by newClientEntry', () => {
    const { entry, secret } = newClientEntry({
      name: 'ChatGPT',
      redirectUris: [REDIRECT, REDIRECT],
    });
    expect(entry.redirectUris).toEqual([REDIRECT]);
    expect(entry.secretHash).toBe(hashSecret(secret));
    vi.stubEnv('MCP_CLIENTS', JSON.stringify([entry]));
    expect(findClient(entry.id)).toEqual(entry);
    expect(findClient('xmcp_client_other')).toBeNull();
    expect(findClient(undefined)).toBeNull();
  });

  it('says when a client list would not load', () => {
    const make = () =>
      newClientEntry({ name: 'ChatGPT', redirectUris: [REDIRECT] }).entry;
    const twenty = Array.from({ length: 20 }, make);
    expect(clientListProblem(twenty)).toBeNull();
    // What mcp:create-client would print with one more: it must refuse.
    expect(clientListProblem([...twenty, make()])).toMatch(/20/);
  });

  it('refuses a redirect off the allowed hosts', () => {
    expect(() =>
      newClientEntry({ name: 'x', redirectUris: ['https://evil.example/cb'] }),
    ).toThrow(/MCP_ALLOWED_REDIRECT_HOSTS/);
    expect(() => newClientEntry({ name: 'x', redirectUris: [] })).toThrow();
  });

  it('suggests the app from the callback host only when making a client', () => {
    expect(appOfRedirectUri(REDIRECT)).toBe('chatgpt');
    expect(appOfRedirectUri('https://claude.ai/api/mcp/auth_callback')).toBe(
      'claude',
    );
    expect(
      appOfRedirectUri('https://oauth-redirect.googleusercontent.com/r/12345'),
    ).toBe('gemini');
    expect(
      appOfRedirectUri(
        'https://oauth-redirect-sandbox.googleusercontent.com/r/1',
      ),
    ).toBe('gemini');
    // A lookalike host is no one's.
    expect(
      appOfRedirectUri('https://oauth-redirectXgoogleusercontent.com/r/1'),
    ).toBe('other');
    expect(
      newClientEntry({ name: 'x', redirectUris: [REDIRECT] }).entry.app,
    ).toBe('chatgpt');
  });

  it('decides what a client may do from its stored app, not its callback host', () => {
    // A Gemini client on a test host the operator added, and a ChatGPT one
    // whose callback moved: both keep their app's behaviour.
    vi.stubEnv('MCP_ALLOWED_REDIRECT_HOSTS', 'chatgpt.com,test.example');
    const gemini = newClientEntry({
      name: 'Gemini test',
      redirectUris: ['https://test.example/cb'],
      app: 'gemini',
    }).entry;
    expect(gemini.app).toBe('gemini');
    expect(clientRotatesRefreshTokens(gemini)).toBe(false);
    expect(clientCanSendFiles(gemini)).toBe(false);
    const chatgpt = { app: 'chatgpt' as const };
    const claude = { app: 'claude' as const };
    expect(clientCanSendFiles(chatgpt)).toBe(true);
    expect(clientCanSendFiles(claude)).toBe(false);
    expect(clientCanSendFiles(null)).toBe(false);
    expect(clientRotatesRefreshTokens(chatgpt)).toBe(true);
    expect(clientRotatesRefreshTokens(claude)).toBe(true);
  });

  it('refuses an entry without an app', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { entry } = newClientEntry({ name: 'x', redirectUris: [REDIRECT] });
    const { app, ...withoutApp } = entry;
    vi.stubEnv('MCP_CLIENTS', JSON.stringify([withoutApp]));
    expect(app).toBe('chatgpt');
    expect(mcpClients()).toEqual([]);
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('makes clients for Claude and Gemini with the default hosts, one app each', () => {
    vi.stubEnv('MCP_ALLOWED_REDIRECT_HOSTS', '');
    expect(
      newClientEntry({
        name: 'Claude',
        redirectUris: ['https://claude.ai/api/mcp/auth_callback'],
      }).entry.redirectUris,
    ).toEqual(['https://claude.ai/api/mcp/auth_callback']);
    expect(() =>
      newClientEntry({
        name: 'Gemini',
        redirectUris: ['https://oauth-redirect.googleusercontent.com/r/12345'],
      }),
    ).not.toThrow();
    expect(() =>
      newClientEntry({
        name: 'Mixed',
        redirectUris: [REDIRECT, 'https://claude.ai/api/mcp/auth_callback'],
      }),
    ).toThrow(/one AI app per client/);
    expect(
      newClientEntry({
        name: 'Mixed',
        redirectUris: [REDIRECT, 'https://claude.ai/api/mcp/auth_callback'],
        app: 'chatgpt',
      }).entry.app,
    ).toBe('chatgpt');
  });

  it('refuses a redirect with a quote, which would end the .env line', () => {
    expect(() =>
      newClientEntry({
        name: 'x',
        redirectUris: ["https://chatgpt.com/cb/it's"],
      }),
    ).toThrow(/single quote/);
  });

  it('treats a malformed list as no clients and logs it once', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubEnv('MCP_CLIENTS', '[{"id":"a","name":"b"');
    expect(mcpClients()).toEqual([]);
    expect(mcpClients()).toEqual([]);
    vi.stubEnv(
      'MCP_CLIENTS',
      JSON.stringify([
        { id: 'a', name: 'b', secretHash: 'plain', redirectUris: [] },
      ]),
    );
    expect(mcpClients()).toEqual([]);
    expect(log).toHaveBeenCalledTimes(2);
  });
});
