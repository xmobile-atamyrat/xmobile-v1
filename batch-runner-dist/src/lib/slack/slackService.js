'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.clearSlackClientsCache =
  exports.initializeAllSlackClients =
  exports.getAvailableSlackClients =
  exports.getSlack =
    void 0;
const SlackClient_1 = require('./SlackClient');
// Cache for initialized Slack clients
const slackClients = new Map();
/**
 * Discovers all SLACK_* environment variables and returns a map of names to webhook URLs
 * Example: SLACK_order_bot -> { name: 'order_bot', webhookUrl: '...' }
 */
function discoverSlackWebhooks() {
  const webhooks = new Map();
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
function initializeSlackClient(name) {
  const envKey = `SLACK_${name}`;
  const webhookUrl = process.env[envKey];
  if (!webhookUrl || !webhookUrl.trim()) {
    console.warn(
      `[SlackService] No webhook URL found for ${envKey}. Make sure it's set in your environment variables.`,
    );
    return null;
  }
  return new SlackClient_1.SlackClient(name, webhookUrl.trim());
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
function getSlack(name) {
  // Check cache first
  if (slackClients.has(name)) {
    return slackClients.get(name);
  }
  // Initialize and cache
  const client = initializeSlackClient(name);
  if (client) {
    slackClients.set(name, client);
  }
  return client;
}
exports.getSlack = getSlack;
/**
 * Gets all available Slack client names from environment variables
 * @returns Array of Slack client names
 */
function getAvailableSlackClients() {
  const webhooks = discoverSlackWebhooks();
  return Array.from(webhooks.keys());
}
exports.getAvailableSlackClients = getAvailableSlackClients;
/**
 * Pre-initializes all Slack clients (useful for testing or ensuring all are ready)
 * @returns Map of initialized clients
 */
function initializeAllSlackClients() {
  const webhooks = discoverSlackWebhooks();
  webhooks.forEach((webhookUrl, name) => {
    if (!slackClients.has(name)) {
      const client = new SlackClient_1.SlackClient(name, webhookUrl);
      slackClients.set(name, client);
    }
  });
  return new Map(slackClients);
}
exports.initializeAllSlackClients = initializeAllSlackClients;
/**
 * Clears the cache of Slack clients (useful for testing)
 */
function clearSlackClientsCache() {
  slackClients.clear();
}
exports.clearSlackClientsCache = clearSlackClientsCache;
