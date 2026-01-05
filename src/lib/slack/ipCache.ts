import dns from 'dns/promises';

interface CachedDnsResult {
  ips: string[];
  expiresAt: number;
}

interface WorkingIpEntry {
  ip: string;
  expiresAt: number;
}

/**
 * Manages DNS resolution cache and working IP tracking for Slack webhooks.
 * Implements a hybrid approach: cached DNS + smart IP pool + fallback.
 */
export class SlackIpCache {
  private static readonly DNS_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

  private static readonly WORKING_IP_TTL_MS = 60 * 60 * 1000; // 1 hour

  // DNS cache: hostname -> { ips, expiresAt }
  private dnsCache: Map<string, CachedDnsResult> = new Map();

  // Working IPs cache: hostname -> Set of working IPs with expiration
  private workingIps: Map<string, Set<WorkingIpEntry>> = new Map();

  /**
   * Resolves a hostname to IPv4 addresses, using cache when available.
   */
  async resolveHostname(hostname: string): Promise<string[]> {
    const cached = this.dnsCache.get(hostname);
    const now = Date.now();

    // Return cached result if still valid
    if (cached && cached.expiresAt > now) {
      return cached.ips;
    }

    // Resolve DNS
    try {
      const addresses = await dns.resolve4(hostname);
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
  async getIpsToTry(hostname: string): Promise<string[]> {
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
  markIpAsWorking(hostname: string, ip: string): void {
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
   */
  private getWorkingIps(hostname: string): string[] {
    const workingSet = this.workingIps.get(hostname);
    if (!workingSet) {
      return [];
    }

    this.cleanupExpiredIps(hostname);
    return Array.from(workingSet).map((entry) => entry.ip);
  }

  /**
   * Removes expired IP entries from the working IPs cache.
   */
  private cleanupExpiredIps(hostname: string): void {
    const workingSet = this.workingIps.get(hostname);
    if (!workingSet) {
      return;
    }

    const now = Date.now();
    const expired: WorkingIpEntry[] = [];

    workingSet.forEach((entry) => {
      if (entry.expiresAt <= now) {
        expired.push(entry);
      }
    });

    expired.forEach((entry) => workingSet.delete(entry));
  }

  /**
   * Clears all caches (useful for testing or manual refresh).
   */
  clearCache(): void {
    this.dnsCache.clear();
    this.workingIps.clear();
  }

  /**
   * Forces a DNS re-resolution for a hostname (bypasses cache).
   */
  async forceResolve(hostname: string): Promise<string[]> {
    this.dnsCache.delete(hostname);
    return this.resolveHostname(hostname);
  }
}

// Singleton instance
export const slackIpCache = new SlackIpCache();
