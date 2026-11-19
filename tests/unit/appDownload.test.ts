import { getServerSideProps } from '@/pages/app.page';
import {
  APP_STORE_URL,
  detectMobileOs,
  hasNativeAppBanner,
  PLAY_STORE_URL,
} from '@/pages/lib/appDownload';
import type { GetServerSidePropsContext } from 'next';
import { describe, expect, it } from 'vitest';

const UA = {
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1',
  iphoneInstagram:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 334.0.4.32.98',
  ipadDesktopMode:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  windowsChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
};

describe('detectMobileOs', () => {
  it('tells iPhone and Android apart', () => {
    expect(detectMobileOs(UA.iphoneSafari)).toBe('ios');
    expect(detectMobileOs(UA.iphoneInstagram)).toBe('ios');
    expect(detectMobileOs(UA.androidChrome)).toBe('android');
  });

  it('treats a desktop as no phone', () => {
    expect(detectMobileOs(UA.windowsChrome)).toBeNull();
    expect(detectMobileOs(UA.ipadDesktopMode)).toBeNull();
  });

  it('spots an iPad posing as a Mac by its touch screen', () => {
    expect(detectMobileOs(UA.ipadDesktopMode, 5)).toBe('ios');
  });
});

describe('hasNativeAppBanner', () => {
  it('is true only for Safari itself', () => {
    expect(hasNativeAppBanner(UA.iphoneSafari, 'ios')).toBe(true);
    expect(hasNativeAppBanner(UA.iphoneChrome, 'ios')).toBe(false);
    expect(hasNativeAppBanner(UA.iphoneInstagram, 'ios')).toBe(false);
    expect(hasNativeAppBanner(UA.androidChrome, 'android')).toBe(false);
  });
});

describe('/app redirect', () => {
  const visit = async (userAgent: string) =>
    getServerSideProps({
      req: { headers: { 'user-agent': userAgent } },
    } as unknown as GetServerSidePropsContext);

  it('sends each phone to its own store', async () => {
    expect(await visit(UA.iphoneSafari)).toEqual({
      redirect: { destination: APP_STORE_URL, permanent: false },
    });
    expect(await visit(UA.androidChrome)).toEqual({
      redirect: { destination: PLAY_STORE_URL, permanent: false },
    });
  });

  it('sends a desktop to the storefront', async () => {
    expect(await visit(UA.windowsChrome)).toEqual({
      redirect: { destination: '/', permanent: false },
    });
  });
});
