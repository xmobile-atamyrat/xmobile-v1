/**
 * Runtime environment detection utilities
 * Distinguishes between web browser and native mobile apps (Capacitor)
 *
 * Note: This is different from PlatformContext which detects UI viewport size (mobile/web).
 * This utility detects the actual runtime environment (web/ios/android).
 */

export type RuntimeEnvironment = 'web' | 'ios' | 'android';

/**
 * Checks if the app is running in a Capacitor environment
 * @returns true if running in Capacitor, false otherwise
 */
export function isCapacitor(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  // Check for Capacitor global object
  // @ts-expect-error - Capacitor will be available when integrated
  return typeof window.Capacitor !== 'undefined';
}

/**
 * Gets the current runtime environment
 * @returns 'web' | 'ios' | 'android'
 */
export function getRuntime(): RuntimeEnvironment {
  if (!isCapacitor()) {
    return 'web';
  }

  if (typeof window === 'undefined') {
    return 'web';
  }

  try {
    // @ts-expect-error - Capacitor will be available when integrated
    const platform = window.Capacitor?.getPlatform?.();

    if (platform === 'ios') {
      return 'ios';
    }

    if (platform === 'android') {
      return 'android';
    }

    // Fallback: check user agent if Capacitor platform detection fails
    const userAgent = window.navigator?.userAgent?.toLowerCase() || '';
    if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
      return 'ios';
    }
    if (userAgent.includes('android')) {
      return 'android';
    }

    // Default to web if we can't determine
    return 'web';
  } catch (error) {
    console.warn('Error detecting runtime environment:', error);
    return 'web';
  }
}

/**
 * Checks if running on iOS (native app)
 * @returns true if running on iOS native app
 */
export function isIOS(): boolean {
  return getRuntime() === 'ios';
}

/**
 * Checks if running on Android (native app)
 * @returns true if running on Android native app
 */
export function isAndroid(): boolean {
  return getRuntime() === 'android';
}

/**
 * Checks if running on a native mobile app (iOS or Android)
 * @returns true if running on native mobile app
 */
export function isNative(): boolean {
  const runtime = getRuntime();
  return runtime === 'ios' || runtime === 'android';
}
