import type { McpClientConfig } from '@/lib/mcp/clients';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/dbClient', () => ({ default: {} }));

const chatgpt: McpClientConfig = {
  id: 'c',
  name: 'ChatGPT',
  app: 'chatgpt',
  secretHash: '0'.repeat(64),
  redirectUris: ['https://chatgpt.com/connector_platform_oauth_redirect'],
};
const claude: McpClientConfig = {
  id: 'k',
  name: 'Claude',
  app: 'claude',
  secretHash: '1'.repeat(64),
  redirectUris: ['https://claude.ai/api/mcp/auth_callback'],
};

const ctx = {
  principal: { grantId: 'g', userId: 'u', client: chatgpt },
  origin: 'https://xmobile.example',
  res: {} as never,
};
const claudeCtx = {
  ...ctx,
  principal: { ...ctx.principal, client: claude },
};

describe('MCP protocol', () => {
  it('offers the image-adding tools only to ChatGPT, which can hand over files', async () => {
    const { handleMessage } = await import('@/lib/mcp/protocol');
    const names = async (context: typeof ctx) => {
      const reply = (await handleMessage(context, {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      })) as { result: { tools: { name: string }[] } };
      return reply.result.tools.map((tool) => tool.name).sort();
    };
    expect(await names(claudeCtx)).toEqual([
      'get_product_images',
      'remove_product_image',
      'reorder_product_images',
      'search_products',
    ]);
    expect(await names(ctx)).toContain('add_product_image');
    const call = await handleMessage(claudeCtx, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'add_product_image', arguments: {} },
    });
    expect(call).toMatchObject({ error: { code: -32602 } });
    const init = (await handleMessage(claudeCtx, {
      jsonrpc: '2.0',
      id: 3,
      method: 'initialize',
      params: { protocolVersion: '2025-11-25' },
    })) as { result: { instructions: string } };
    expect(init.result.instructions).toContain('needs ChatGPT');
  });

  it('negotiates the protocol version', async () => {
    const { handleMessage } = await import('@/lib/mcp/protocol');
    const known = await handleMessage(ctx, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-06-18' },
    });
    expect(known).toMatchObject({
      id: 1,
      result: {
        protocolVersion: '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'xmobile' },
      },
    });
    const unknown = await handleMessage(ctx, {
      jsonrpc: '2.0',
      id: 2,
      method: 'initialize',
      params: { protocolVersion: '1999-01-01' },
    });
    expect(unknown).toMatchObject({
      result: { protocolVersion: '2025-11-25' },
    });
  });

  it('answers nothing to notifications and responses', async () => {
    const { handleMessage } = await import('@/lib/mcp/protocol');
    expect(
      await handleMessage(ctx, {
        jsonrpc: '2.0',
        method: 'notifications/initialized',
      }),
    ).toBeNull();
    expect(
      await handleMessage(ctx, { jsonrpc: '2.0', id: 3, result: {} }),
    ).toBeNull();
  });

  it('rejects malformed messages and unknown methods', async () => {
    const { handleMessage } = await import('@/lib/mcp/protocol');
    expect(await handleMessage(ctx, { id: 1, method: 'ping' })).toMatchObject({
      error: { code: -32600 },
    });
    expect(await handleMessage(ctx, 'ping')).toMatchObject({
      error: { code: -32600 },
    });
    expect(
      await handleMessage(ctx, { jsonrpc: '2.0', id: 4, method: 'sampling/x' }),
    ).toMatchObject({ id: 4, error: { code: -32601 } });
    expect(
      await handleMessage(ctx, {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: { name: 'drop_database' },
      }),
    ).toMatchObject({ id: 5, error: { code: -32602 } });
  });

  it('lists the six tools with honest hints', async () => {
    const { handleMessage } = await import('@/lib/mcp/protocol');
    const reply = (await handleMessage(ctx, {
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/list',
    })) as {
      result: {
        tools: {
          name: string;
          annotations: { readOnlyHint: boolean; destructiveHint: boolean };
          _meta?: Record<string, unknown>;
          inputSchema: { required: string[] };
        }[];
      };
    };
    const tools = new Map(reply.result.tools.map((tool) => [tool.name, tool]));
    expect([...tools.keys()].sort()).toEqual([
      'add_product_image',
      'get_product_images',
      'remove_product_image',
      'reorder_product_images',
      'replace_product_image',
      'search_products',
    ]);
    expect(tools.get('search_products')!.annotations.readOnlyHint).toBe(true);
    expect(tools.get('get_product_images')!.annotations.readOnlyHint).toBe(
      true,
    );
    ['add_product_image', 'reorder_product_images'].forEach((name) => {
      expect(tools.get(name)!.annotations).toMatchObject({
        readOnlyHint: false,
        destructiveHint: false,
      });
    });
    ['remove_product_image', 'replace_product_image'].forEach((name) => {
      expect(tools.get(name)!.annotations.destructiveHint).toBe(true);
    });
    ['add_product_image', 'replace_product_image'].forEach((name) => {
      expect(tools.get(name)).toMatchObject({
        _meta: { 'openai/fileParams': ['image'] },
      });
    });
  });

  it('returns bad arguments as a tool error the model can read', async () => {
    const { handleMessage } = await import('@/lib/mcp/protocol');
    const reply = await handleMessage(ctx, {
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: { name: 'get_product_images', arguments: { productId: 'x' } },
    });
    expect(reply).toMatchObject({
      id: 7,
      result: { isError: true, content: [{ type: 'text' }] },
    });
  });
});
