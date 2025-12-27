import https from 'https';
import { URL } from 'url';
import { SlackMessage, SlackSendResult } from './types';

export class SlackClient {
  private webhookUrl: string;

  private name: string;

  private readonly REQUEST_TIMEOUT_MS = 10000; // 10 seconds

  constructor(name: string, webhookUrl: string) {
    this.name = name;
    this.webhookUrl = webhookUrl;
  }

  /**
   * Sends a simple text message to Slack
   */
  async send(text: string): Promise<SlackSendResult> {
    return this.sendMessage({ text });
  }

  /**
   * Sends a structured message to Slack
   * Uses https.request instead of fetch to explicitly close connections,
   * which is more reliable in strict firewall environments.
   */
  async sendMessage(message: SlackMessage): Promise<SlackSendResult> {
    try {
      const url = new URL(this.webhookUrl);
      const data = JSON.stringify(message);

      const result = await new Promise<SlackSendResult>((resolve) => {
        const options = {
          hostname: url.hostname,
          path: url.pathname + url.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data),
            Connection: 'close', // Explicitly close connection after request
          },
          timeout: this.REQUEST_TIMEOUT_MS,
        };

        const req = https.request(options, (res) => {
          let body = '';

          res.on('data', (chunk) => {
            body += chunk;
          });

          res.on('end', () => {
            // Slack webhooks return "ok" on success
            if (
              res.statusCode &&
              res.statusCode >= 200 &&
              res.statusCode < 300
            ) {
              if (body === 'ok') {
                resolve({
                  success: true,
                  message: 'Message sent successfully',
                });
              } else {
                resolve({
                  success: true,
                  message: body,
                });
              }
            } else {
              resolve({
                success: false,
                error: `Slack API error: ${res.statusCode} - ${body}`,
              });
            }
          });
        });

        req.on('error', (error) => {
          resolve({
            success: false,
            error:
              error instanceof Error
                ? error.message
                : 'Unknown error sending Slack message',
          });
        });

        req.on('timeout', () => {
          req.destroy();
          resolve({
            success: false,
            error: 'Request timeout',
          });
        });

        // Write data and explicitly end the request
        req.write(data);
        req.end();
      });

      return result;
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error sending Slack message',
      };
    }
  }

  /**
   * Gets the name of this Slack client
   */
  getName(): string {
    return this.name;
  }

  /**
   * Gets the webhook URL (for debugging purposes)
   */
  getWebhookUrl(): string {
    return this.webhookUrl;
  }
}
