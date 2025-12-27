import { SlackMessage, SlackSendResult } from './types';

export class SlackClient {
  private webhookUrl: string;

  private name: string;

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
   */
  async sendMessage(message: SlackMessage): Promise<SlackSendResult> {
    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Slack API error: ${response.status} - ${errorText}`,
        };
      }

      const responseText = await response.text();

      // Slack webhooks return "ok" on success
      if (responseText === 'ok') {
        return {
          success: true,
          message: 'Message sent successfully',
        };
      }

      return {
        success: true,
        message: responseText,
      };
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
