import { afterEach, describe, expect, it, vi } from 'vitest';

import { allowedRedirectHosts, isAllowedRedirectUri } from '@/lib/mcp/config';

describe('MCP config', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('falls back to the ChatGPT, Claude and Gemini hosts when unset or blank', () => {
    const defaults = [
      'chatgpt.com',
      'claude.ai',
      'oauth-redirect.googleusercontent.com',
    ];
    vi.stubEnv('MCP_ALLOWED_REDIRECT_HOSTS', undefined);
    expect(allowedRedirectHosts()).toEqual(defaults);
    // What `.env.example` ships: the line is there, the value is empty.
    vi.stubEnv('MCP_ALLOWED_REDIRECT_HOSTS', '');
    expect(allowedRedirectHosts()).toEqual(defaults);
    vi.stubEnv('MCP_ALLOWED_REDIRECT_HOSTS', '   ');
    expect(allowedRedirectHosts()).toEqual(defaults);
    expect(
      isAllowedRedirectUri(
        'https://chatgpt.com/connector_platform_oauth_redirect',
      ),
    ).toBe(true);
  });

  it('reads a list of hosts', () => {
    vi.stubEnv('MCP_ALLOWED_REDIRECT_HOSTS', ' ChatGPT.com , claude.ai ,');
    expect(allowedRedirectHosts()).toEqual(['chatgpt.com', 'claude.ai']);
    expect(
      isAllowedRedirectUri('https://claude.ai/api/mcp/auth_callback'),
    ).toBe(true);
    expect(isAllowedRedirectUri('https://evil.example/cb')).toBe(false);
    expect(isAllowedRedirectUri('https://claude.ai:8443/cb')).toBe(false);
  });
});
