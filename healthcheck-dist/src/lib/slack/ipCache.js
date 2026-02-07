'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.slackIpCache = exports.SlackIpCache = void 0;
const promises_1 = __importDefault(require('dns/promises'));
/**
 * Manages DNS resolution cache and working IP tracking for Slack webhooks.
 * Implements a hybrid approach: cached DNS + smart IP pool + fallback.
 */
class SlackIpCache {
  static DNS_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
  static WORKING_IP_TTL_MS = 60 * 60 * 1000; // 1 hour
  // Seed IPs that always work on Telekom network (manually managed)
  static SEED_IPS_FOR_HOOKS_SLACK_COM = [
    '3.68.124.95',
    '52.29.238.212',
    '3.68.170.153',
    '3.68.175.98',
    '3.68.124.168',
  ];
  // Infinite expiration (far future timestamp)
  static INFINITE_EXPIRATION = Number.MAX_SAFE_INTEGER;
  // DNS cache: hostname -> { ips, expiresAt }
  dnsCache = new Map();
  // Working IPs cache: hostname -> Set of working IPs with expiration
  workingIps = new Map();
  /**
   * Resolves a hostname to IPv4 addresses, using cache when available.
   */
  async resolveHostname(hostname) {
    const cached = this.dnsCache.get(hostname);
    const now = Date.now();
    // Return cached result if still valid
    if (cached && cached.expiresAt > now) {
      return cached.ips;
    }
    // Resolve DNS
    try {
      const addresses = await promises_1.default.resolve4(hostname);
      const ipv4Addresses = addresses.filter((ip) => {
        // Ensure it's a valid IPv4 address
        return /^(\d{1,3}\.){3}\d{1,3}$/.test(ip);
      });
      // Cache the result
      this.dnsCache.set(hostname, {
        ips: ipv4Addresses,
        expiresAt: now + SlackIpCache.DNS_CACHE_TTL_MS,
      });
      return ipv4Addresses;
    } catch (error) {
      // If DNS resolution fails but we have cached IPs, use them even if expired
      if (cached) {
        console.warn(
          `[SlackIpCache] DNS resolution failed for ${hostname}, using expired cache`,
        );
        return cached.ips;
      }
      throw error;
    }
  }
  /**
   * Gets IPs to try for a hostname, prioritizing known working IPs.
   */
  async getIpsToTry(hostname) {
    const allIps = await this.resolveHostname(hostname);
    const working = this.getWorkingIps(hostname);
    if (working.length === 0) {
      return allIps;
    }
    // Put working IPs first, then add remaining IPs
    const workingSet = new Set(working);
    const remaining = allIps.filter((ip) => !workingSet.has(ip));
    return [...working, ...remaining];
  }
  /**
   * Marks an IP as working for a hostname.
   */
  markIpAsWorking(hostname, ip) {
    let workingSet = this.workingIps.get(hostname);
    if (!workingSet) {
      workingSet = new Set();
      this.workingIps.set(hostname, workingSet);
    }
    // Remove expired entries and add/update this IP
    this.cleanupExpiredIps(hostname);
    workingSet.add({
      ip,
      expiresAt: Date.now() + SlackIpCache.WORKING_IP_TTL_MS,
    });
  }
  /**
   * Gets currently valid working IPs for a hostname.
   * Always includes seed IPs for hooks.slack.com.
   */
  getWorkingIps(hostname) {
    // Ensure seed IPs are initialized for hooks.slack.com
    if (hostname === 'hooks.slack.com') {
      this.ensureSeedIpsInitialized(hostname);
    }
    const workingSet = this.workingIps.get(hostname);
    if (!workingSet) {
      // Return seed IPs if available for this hostname
      if (hostname === 'hooks.slack.com') {
        return [...SlackIpCache.SEED_IPS_FOR_HOOKS_SLACK_COM];
      }
      return [];
    }
    this.cleanupExpiredIps(hostname);
    const working = Array.from(workingSet).map((entry) => entry.ip);
    // Always include seed IPs for hooks.slack.com (they never expire)
    if (hostname === 'hooks.slack.com') {
      const seedSet = new Set(working);
      SlackIpCache.SEED_IPS_FOR_HOOKS_SLACK_COM.forEach((seedIp) => {
        if (!seedSet.has(seedIp)) {
          working.push(seedIp);
        }
      });
      // Put seed IPs first
      return [
        ...SlackIpCache.SEED_IPS_FOR_HOOKS_SLACK_COM.filter((seedIp) =>
          working.includes(seedIp),
        ),
        ...working.filter(
          (ip) => !SlackIpCache.SEED_IPS_FOR_HOOKS_SLACK_COM.includes(ip),
        ),
      ];
    }
    return working;
  }
  /**
   * Ensures seed IPs are initialized in the working IPs cache for hooks.slack.com.
   */
  ensureSeedIpsInitialized(hostname) {
    if (hostname !== 'hooks.slack.com') {
      return;
    }
    let workingSet = this.workingIps.get(hostname);
    if (!workingSet) {
      workingSet = new Set();
      this.workingIps.set(hostname, workingSet);
    }
    // Add seed IPs with infinite expiration if not already present
    SlackIpCache.SEED_IPS_FOR_HOOKS_SLACK_COM.forEach((seedIp) => {
      const exists = Array.from(workingSet).some(
        (entry) => entry.ip === seedIp,
      );
      if (!exists) {
        workingSet.add({
          ip: seedIp,
          expiresAt: SlackIpCache.INFINITE_EXPIRATION,
        });
      } else {
        // Update existing entry to have infinite expiration
        const entries = Array.from(workingSet);
        const entry = entries.find((e) => e.ip === seedIp);
        if (entry) {
          workingSet.delete(entry);
          workingSet.add({
            ip: seedIp,
            expiresAt: SlackIpCache.INFINITE_EXPIRATION,
          });
        }
      }
    });
  }
  /**
   * Removes expired IP entries from the working IPs cache.
   * Never removes seed IPs (they have infinite expiration).
   */
  cleanupExpiredIps(hostname) {
    const workingSet = this.workingIps.get(hostname);
    if (!workingSet) {
      return;
    }
    const now = Date.now();
    const expired = [];
    workingSet.forEach((entry) => {
      // Never expire seed IPs (they have INFINITE_EXPIRATION)
      if (
        entry.expiresAt <= now &&
        entry.expiresAt !== SlackIpCache.INFINITE_EXPIRATION
      ) {
        expired.push(entry);
      }
    });
    expired.forEach((entry) => workingSet.delete(entry));
  }
  /**
   * Clears all caches (useful for testing or manual refresh).
   */
  clearCache() {
    this.dnsCache.clear();
    this.workingIps.clear();
  }
  /**
   * Forces a DNS re-resolution for a hostname (bypasses cache).
   */
  async forceResolve(hostname) {
    this.dnsCache.delete(hostname);
    return this.resolveHostname(hostname);
  }
}
exports.SlackIpCache = SlackIpCache;
// Singleton instance
exports.slackIpCache = new SlackIpCache();
