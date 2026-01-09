import https from 'https';
import { URL } from 'url';
import { slackIpCache } from './ipCache';
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
   * Implements IP rotation to work around firewall restrictions.
   */
  async sendMessage(message: SlackMessage): Promise<SlackSendResult> {
    try {
      const url = new URL(this.webhookUrl);
      const data = JSON.stringify(message);
      const hostname = url.hostname;

      // Get IPs to try (working IPs first, then all IPs)
      let ipsToTry: string[] = [];
      try {
        ipsToTry = await slackIpCache.getIpsToTry(hostname);
      } catch (dnsError) {
        // If DNS resolution fails, fall back to hostname-based request
        console.warn(
          `[SlackClient:${this.name}] DNS resolution failed, using hostname:`,
          dnsError instanceof Error ? dnsError.message : String(dnsError),
        );
        return this.sendRequestWithHostname(url, data, hostname);
      }

      // Try each IP sequentially until one succeeds
      let lastError: SlackSendResult | null = null;

      for (let i = 0; i < ipsToTry.length; i += 1) {
        const ip = ipsToTry[i];
        const result = await this.sendRequestWithIp(url, data, hostname, ip);

        if (result.success) {
          // Mark this IP as working for future requests
          slackIpCache.markIpAsWorking(hostname, ip);
          return result;
        }

        // Store the error but continue trying other IPs
        lastError = result;
      }

      // If all IPs failed (or no IPs were available), try hostname as fallback
      console.warn(
        `[SlackClient:${this.name}] All IPs: ${ipsToTry} failed, trying hostname as fallback`,
      );

      const hostnameResult = await this.sendRequestWithHostname(
        url,
        data,
        hostname,
      );

      if (hostnameResult.success) {
        return hostnameResult;
      }

      // Return the last error if everything failed
      return (
        lastError || {
          success: false,
          error: 'All IP attempts failed',
        }
      );
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
   * Sends a request using a specific IP address.
   * Requires SNI (Server Name Indication) and Host header for TLS.
   */
  private sendRequestWithIp(
    url: URL,
    data: string,
    originalHostname: string,
    ip: string,
  ): Promise<SlackSendResult> {
    return new Promise<SlackSendResult>((resolve) => {
      const options: https.RequestOptions = {
        hostname: ip,
        servername: originalHostname, // SNI for TLS
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          Host: originalHostname, // HTTP Host header
          Connection: 'close',
        },
        timeout: this.REQUEST_TIMEOUT_MS,
      };

      const req = https.request(options, (res) => {
        let body = '';

        res.on('data', (chunk) => {
          body += chunk;
        });

        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
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

      req.write(data);
      req.end();
    });
  }

  /**
   * Sends a request using the hostname (fallback method).
   */
  private sendRequestWithHostname(
    url: URL,
    data: string,
    hostname: string,
  ): Promise<SlackSendResult> {
    return new Promise<SlackSendResult>((resolve) => {
      const options: https.RequestOptions = {
        hostname,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          Connection: 'close',
        },
        timeout: this.REQUEST_TIMEOUT_MS,
      };

      const req = https.request(options, (res) => {
        let body = '';

        res.on('data', (chunk) => {
          body += chunk;
        });

        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
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

      req.write(data);
      req.end();
    });
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
