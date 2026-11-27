/**
 * Makes an OAuth client for an AI app to connect to the MCP server with
 * (docs/mcp.md). Writes nothing: it prints the client ID and secret for the
 * AI app, and the `MCP_CLIENTS` line for `.env` with the new client added to
 * the ones already there. Only the secret's hash goes into `.env`, so a lost
 * secret means making a new client.
 *
 *   yarn mcp:create-client-dev --name ChatGPT --redirect-uri <callback URL>
 *   yarn mcp:create-client-prod --name ChatGPT --redirect-uri <callback URL>
 *
 * The callback URL is the one the AI app shows in its OAuth settings. Pass
 * --redirect-uri up to 5 times. Each must be https on
 * MCP_ALLOWED_REDIRECT_HOSTS (default chatgpt.com, claude.ai and
 * oauth-redirect.googleusercontent.com). The app (chatgpt, claude, gemini or
 * other) is read from the callback host; pass --app when the host isn't one
 * of those, e.g. a test host.
 */
import {
  clientListProblem,
  MCP_APPS,
  McpApp,
  mcpClients,
  newClientEntry,
} from '../src/lib/mcp/clients';

const isApp = (value: string): value is McpApp =>
  (MCP_APPS as readonly string[]).includes(value);

function parseArgs(argv: string[]) {
  let name = '';
  let app: McpApp | undefined;
  const redirectUris: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (
      (flag === '--name' || flag === '--redirect-uri' || flag === '--app') &&
      value != null
    ) {
      if (flag === '--name') name = value;
      else if (flag === '--redirect-uri') redirectUris.push(value);
      else if (isApp(value)) app = value;
      else throw new Error(`--app must be one of ${MCP_APPS.join(', ')}`);
      i += 1;
    } else {
      throw new Error(`Unknown or incomplete argument: ${flag}`);
    }
  }
  if (name === '' || redirectUris.length === 0) {
    throw new Error(
      'Usage: --name <name> --redirect-uri <url> [--redirect-uri <url> ...] [--app <app>]',
    );
  }
  return { name, redirectUris, app };
}

function main() {
  const input = parseArgs(process.argv.slice(2));
  // Every env file sets DATABASE_URL. Without it the file wasn't loaded, so
  // MCP_CLIENTS reads as empty and the line printed below would drop every
  // client already there.
  if (!process.env.DATABASE_URL) {
    throw new Error('No env file was loaded; run this through yarn');
  }
  const existing = mcpClients();
  if (process.env.MCP_CLIENTS?.trim() && existing.length === 0) {
    throw new Error(
      'MCP_CLIENTS is set but not a valid client list; fix or empty it first',
    );
  }
  const { entry, secret } = newClientEntry(input);
  // Checked before anything is printed: pasted, a list the server can't load
  // would cut off every client already there.
  const clients = [...existing, entry];
  const problem = clientListProblem(clients);
  if (problem != null) {
    throw new Error(
      `MCP_CLIENTS would not load with this client added (${problem}). Remove a client you no longer use first.`,
    );
  }
  console.log(
    `Client "${entry.name}" (${entry.app}) for ${entry.redirectUris.join(', ')}`,
  );
  console.log('');
  console.log('1. In the AI app (token auth method client_secret_basic):');
  console.log(`   OAuth client ID:     ${entry.id}`);
  console.log(`   OAuth client secret: ${secret}`);
  console.log('   The secret is not shown again.');
  console.log('');
  console.log(
    `2. In .env, replace the MCP_CLIENTS line with this one (${existing.length} existing client(s) kept), then restart the app:`,
  );
  console.log(`MCP_CLIENTS='${JSON.stringify(clients)}'`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
