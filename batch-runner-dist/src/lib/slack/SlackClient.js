'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.SlackClient = void 0;
const https_1 = __importDefault(require('https'));
const url_1 = require('url');
const ipCache_1 = require('./ipCache');
class SlackClient {
  webhookUrl;
  name;
  REQUEST_TIMEOUT_MS = 10000; // 10 seconds
  constructor(name, webhookUrl) {
    this.name = name;
    this.webhookUrl = webhookUrl;
  }
  /**
   * Sends a simple text message to Slack
   */
  async send(text) {
    return this.sendMessage({ text });
  }
  /**
   * Sends a structured message to Slack
   * Uses https.request instead of fetch to explicitly close connections,
   * which is more reliable in strict firewall environments.
   * Implements IP rotation to work around firewall restrictions.
   */
  async sendMessage(message) {
    try {
      const url = new url_1.URL(this.webhookUrl);
      const data = JSON.stringify(message);
      const hostname = url.hostname;
      // Get IPs to try (working IPs first, then all IPs)
      let ipsToTry = [];
      try {
        ipsToTry = await ipCache_1.slackIpCache.getIpsToTry(hostname);
      } catch (dnsError) {
        // If DNS resolution fails, fall back to hostname-based request
        console.warn(
          `[SlackClient:${this.name}] DNS resolution failed, using hostname:`,
          dnsError instanceof Error ? dnsError.message : String(dnsError),
        );
        return this.sendRequestWithHostname(url, data, hostname);
      }
      // Try each IP sequentially until one succeeds
      let lastError = null;
      for (let i = 0; i < ipsToTry.length; i += 1) {
        const ip = ipsToTry[i];
        const result = await this.sendRequestWithIp(url, data, hostname, ip);
        if (result.success) {
          // Mark this IP as working for future requests
          ipCache_1.slackIpCache.markIpAsWorking(hostname, ip);
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
  sendRequestWithIp(url, data, originalHostname, ip) {
    return new Promise((resolve) => {
      const options = {
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
      const req = https_1.default.request(options, (res) => {
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
  sendRequestWithHostname(url, data, hostname) {
    return new Promise((resolve) => {
      const options = {
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
      const req = https_1.default.request(options, (res) => {
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
  getName() {
    return this.name;
  }
  /**
   * Gets the webhook URL (for debugging purposes)
   */
  getWebhookUrl() {
    return this.webhookUrl;
  }
}
exports.SlackClient = SlackClient;
