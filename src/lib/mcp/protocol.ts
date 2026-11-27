import { clientCanSendFiles } from '@/lib/mcp/clients';
import { callTool, hasTool, listTools, ToolContext } from '@/lib/mcp/tools';

/**
 * The slice of the Model Context Protocol this server needs: stateless
 * Streamable HTTP with plain JSON answers, tools only. Written here rather than
 * pulled in as the SDK, which brings its own web server stack, so everything
 * that faces the internet is in this repo and short enough to read.
 * https://modelcontextprotocol.io/specification
 */

export const SUPPORTED_PROTOCOL_VERSIONS = [
  '2025-11-25',
  '2025-06-18',
  '2025-03-26',
  '2024-11-05',
];
const LATEST_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];

const SERVER_INFO = { name: 'xmobile', title: 'xmobile', version: '1.0.0' };

const INSTRUCTIONS_WITH_FILES =
  'Tools for xmobile.com.tm product images. Find the product with search_products, look at its current images with get_product_images, then add, replace, reorder or remove images. Changes go live on the public site. Image arguments must be images from this conversation.';
const INSTRUCTIONS_WITHOUT_FILES =
  'Tools for xmobile.com.tm product images. Find the product with search_products, look at its current images with get_product_images, then reorder or remove images. Changes go live on the public site. Adding or replacing an image needs ChatGPT, which can hand an image from the chat to the server; this app cannot.';

type JsonRpcId = string | number;

type JsonRpcRequest = {
  jsonrpc: '2.0';
  id?: JsonRpcId | null;
  method: string;
  params?: Record<string, unknown>;
};

export type JsonRpcResponse =
  | { jsonrpc: '2.0'; id: JsonRpcId | null; result: unknown }
  | {
      jsonrpc: '2.0';
      id: JsonRpcId | null;
      error: { code: number; message: string };
    };

export const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;

export function rpcError(
  id: JsonRpcId | null,
  code: number,
  message: string,
): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

function isRequest(value: unknown): value is JsonRpcRequest {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const message = value as Record<string, unknown>;
  return (
    message.jsonrpc === '2.0' &&
    typeof message.method === 'string' &&
    (message.id === undefined ||
      typeof message.id === 'string' ||
      typeof message.id === 'number') &&
    (message.params === undefined ||
      (typeof message.params === 'object' &&
        message.params !== null &&
        !Array.isArray(message.params)))
  );
}

/** A JSON-RPC response sent by the client. This server never asks it anything, so it is ignored. */
function isResponse(value: unknown): boolean {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const message = value as Record<string, unknown>;
  return (
    message.jsonrpc === '2.0' &&
    !('method' in message) &&
    ('result' in message || 'error' in message)
  );
}

/**
 * Answers one JSON-RPC message, or returns null when it needs no answer
 * (notifications and responses). Batches are not accepted (removed from MCP
 * in 2025-06-18).
 */
export async function handleMessage(
  ctx: ToolContext,
  message: unknown,
): Promise<JsonRpcResponse | null> {
  if (!isRequest(message)) {
    if (isResponse(message)) return null;
    return rpcError(null, INVALID_REQUEST, 'Invalid JSON-RPC request');
  }
  if (message.id === undefined) return null;
  const { id } = message;
  const params = message.params ?? {};
  const canSendFiles = clientCanSendFiles(ctx.principal.client);

  switch (message.method) {
    case 'initialize': {
      const requested = params.protocolVersion;
      const protocolVersion =
        typeof requested === 'string' &&
        SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
          ? requested
          : LATEST_PROTOCOL_VERSION;
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: canSendFiles
            ? INSTRUCTIONS_WITH_FILES
            : INSTRUCTIONS_WITHOUT_FILES,
        },
      };
    }
    case 'ping':
      return { jsonrpc: '2.0', id, result: {} };
    case 'tools/list':
      return { jsonrpc: '2.0', id, result: { tools: listTools(canSendFiles) } };
    case 'tools/call': {
      const { name } = params;
      if (typeof name !== 'string' || !hasTool(name, canSendFiles)) {
        return rpcError(id, INVALID_PARAMS, `Unknown tool: ${String(name)}`);
      }
      return {
        jsonrpc: '2.0',
        id,
        result: await callTool(ctx, name, params.arguments),
      };
    }
    // Not offered, but some clients list them regardless; empty beats an error.
    case 'resources/list':
      return { jsonrpc: '2.0', id, result: { resources: [] } };
    case 'resources/templates/list':
      return { jsonrpc: '2.0', id, result: { resourceTemplates: [] } };
    case 'prompts/list':
      return { jsonrpc: '2.0', id, result: { prompts: [] } };
    default:
      return rpcError(
        id,
        METHOD_NOT_FOUND,
        `Method not found: ${message.method}`,
      );
  }
}
