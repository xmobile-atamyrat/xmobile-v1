import { SlackClient } from './SlackClient';

// Cache for initialized Slack clients
const slackClients: Map<string, SlackClient> = new Map();

/**
 * Discovers all SLACK_* environment variables and returns a map of names to webhook URLs
 * Example: SLACK_order_bot -> { name: 'order_bot', webhookUrl: '...' }
 */
function discoverSlackWebhooks(): Map<string, string> {
  const webhooks = new Map<string, string>();

  // Iterate through all environment variables
  Object.keys(process.env).forEach((key) => {
    if (key.startsWith('SLACK_')) {
      const name = key.substring(6); // Remove 'SLACK_' prefix
      const webhookUrl = process.env[key];

      if (webhookUrl && webhookUrl.trim()) {
        webhooks.set(name, webhookUrl.trim());
      }
    }
  });

  return webhooks;
}

/**
 * Initializes a Slack client for the given name
 */
function initializeSlackClient(name: string): SlackClient | null {
  const envKey = `SLACK_${name}`;
  const webhookUrl = process.env[envKey];

  if (!webhookUrl || !webhookUrl.trim()) {
    console.warn(
      `[SlackService] No webhook URL found for ${envKey}. Make sure it's set in your environment variables.`,
    );
    return null;
  }

  return new SlackClient(name, webhookUrl.trim());
}

/**
 * Gets a Slack client by name. Initializes it on first access (lazy loading).
 * @param name - The name of the Slack client (e.g., 'order_bot', 'admin_alerts')
 * @returns The SlackClient instance, or null if not found
 * @example
 * ```typescript
 * const slack = getSlack('order_bot');
 * if (slack) {
 *   await slack.send('New order created!');
 * }
 * ```
 */
export function getSlack(name: string): SlackClient | null {
  // Check cache first
  if (slackClients.has(name)) {
    return slackClients.get(name)!;
  }

  // Initialize and cache
  const client = initializeSlackClient(name);
  if (client) {
    slackClients.set(name, client);
  }

  return client;
}

/**
 * Gets all available Slack client names from environment variables
 * @returns Array of Slack client names
 */
export function getAvailableSlackClients(): string[] {
  const webhooks = discoverSlackWebhooks();
  return Array.from(webhooks.keys());
}

/**
 * Pre-initializes all Slack clients (useful for testing or ensuring all are ready)
 * @returns Map of initialized clients
 */
export function initializeAllSlackClients(): Map<string, SlackClient> {
  const webhooks = discoverSlackWebhooks();

  webhooks.forEach((webhookUrl, name) => {
    if (!slackClients.has(name)) {
      const client = new SlackClient(name, webhookUrl);
      slackClients.set(name, client);
    }
  });

  return new Map(slackClients);
}

/**
 * Clears the cache of Slack clients (useful for testing)
 */
export function clearSlackClientsCache(): void {
  slackClients.clear();
}
