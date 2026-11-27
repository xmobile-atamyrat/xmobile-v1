import { describe, expect, it } from 'vitest';

import { detectPlatform, isBot } from '@/lib/analytics/server/userAgent';

const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 13; SM-A135F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.6045.163 Mobile Safari/537.36';
const ANDROID_WEBVIEW =
  'Mozilla/5.0 (Linux; Android 13; SM-A135F Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.6045.163 Mobile Safari/537.36';
const IOS_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1';
const IOS_WKWEBVIEW =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const IOS_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/119.0.6045.169 Mobile/15E148 Safari/604.1';
const DESKTOP_CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const DESKTOP_FIREFOX =
  'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0';
const YANDEX_BROWSER =
  'Mozilla/5.0 (Linux; Android 12; M2101K6G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 YaBrowser/23.11.3.88.00 SA/3 Mobile Safari/537.36';
const OPERA_MINI =
  'Opera/9.80 (Android; Opera Mini/7.5.33361/31.1448; U; en) Presto/2.8.119 Version/11.1010';
const CUBOT_PHONE =
  'Mozilla/5.0 (Linux; Android 10; CUBOT X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36';
const INSTAGRAM_ANDROID =
  'Mozilla/5.0 (Linux; Android 13; SM-A135F Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.6045.163 Mobile Safari/537.36 Instagram 309.1.0.41.113 Android';
const FACEBOOK_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/440.0.0.33.116;]';

describe('isBot', () => {
  it.each([
    ['empty', ''],
    ['whitespace', '   '],
    ['null', null],
    ['undefined', undefined],
    [
      'Googlebot',
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    ],
    [
      'Googlebot smartphone',
      'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    ],
    [
      'bingbot',
      'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    ],
    [
      'YandexBot',
      'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)',
    ],
    [
      'Baiduspider',
      'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)',
    ],
    [
      'Applebot',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Safari/605.1.15 (Applebot/0.1)',
    ],
    [
      'AhrefsBot',
      'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
    ],
    [
      'GPTBot',
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.0; +https://openai.com/gptbot)',
    ],
    [
      'facebook preview',
      'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    ],
    ['Telegram preview', 'TelegramBot (like TwitterBot)'],
    ['WhatsApp preview', 'WhatsApp/2.23.20.0 A'],
    [
      'Slack preview',
      'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
    ],
    [
      'Discord preview',
      'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
    ],
    [
      'BingPreview',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) BingPreview/1.0b',
    ],
    ['curl', 'curl/8.4.0'],
    ['wget', 'Wget/1.21.4'],
    ['python-requests', 'python-requests/2.31.0'],
    ['Go', 'Go-http-client/1.1'],
    ['node fetch', 'node'],
    ['undici', 'undici'],
    ['okhttp', 'okhttp/4.9.2'],
    [
      'HeadlessChrome',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36',
    ],
    [
      'Lighthouse',
      'Mozilla/5.0 (Linux; Android 7.0; Moto G (4)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse',
    ],
    [
      'UptimeRobot',
      'Mozilla/5.0+(compatible; UptimeRobot/2.0; http://www.uptimerobot.com/)',
    ],
  ])('flags %s', (_label, ua) => {
    expect(isBot(ua)).toBe(true);
  });

  it.each([
    ['Android Chrome', ANDROID_CHROME],
    ['Android WebView (our app)', ANDROID_WEBVIEW],
    ['iOS Safari', IOS_SAFARI],
    ['iOS WKWebView (our app)', IOS_WKWEBVIEW],
    ['iOS Chrome', IOS_CHROME],
    ['desktop Chrome', DESKTOP_CHROME],
    ['desktop Firefox', DESKTOP_FIREFOX],
    ['Yandex Browser', YANDEX_BROWSER],
    ['Opera Mini', OPERA_MINI],
    ['a CUBOT phone', CUBOT_PHONE],
    ['the Instagram in-app browser', INSTAGRAM_ANDROID],
    ['the Facebook in-app browser', FACEBOOK_IOS],
  ])('lets %s through', (_label, ua) => {
    expect(isBot(ua)).toBe(false);
  });
});

describe('detectPlatform', () => {
  it.each([
    ['Android WebView', ANDROID_WEBVIEW],
    ['iOS WKWebView', IOS_WKWEBVIEW],
    ['an explicit app marker', `${ANDROID_CHROME} XMobileApp/2.3.0`],
    ['a ReactNative marker', `${DESKTOP_CHROME} ReactNative`],
  ])('is APP for %s', (_label, ua) => {
    expect(detectPlatform(ua)).toBe('APP');
  });

  it.each([
    ['Android Chrome', ANDROID_CHROME],
    ['iOS Safari', IOS_SAFARI],
    ['iOS Chrome', IOS_CHROME],
    ['desktop Chrome', DESKTOP_CHROME],
    ['desktop Firefox', DESKTOP_FIREFOX],
    ['Instagram in-app browser (a WebView, not ours)', INSTAGRAM_ANDROID],
    ['Facebook in-app browser on iOS', FACEBOOK_IOS],
    ['no user agent', ''],
    ['null', null],
  ])('is WEB for %s', (_label, ua) => {
    expect(detectPlatform(ua)).toBe('WEB');
  });

  it('does not take a "wv" inside another token for a WebView', () => {
    // isWebView() in serviceWorker.ts tests /wv/i, which a model name can hit.
    expect(
      detectPlatform(
        'Mozilla/5.0 (Linux; Android 12; WVX-1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36',
      ),
    ).toBe('WEB');
  });
});
