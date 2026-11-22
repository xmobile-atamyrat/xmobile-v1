import {
  isCrawler,
  localeFromAcceptLanguage,
  localeFromCountry,
  localizedPath,
} from '@/lib/localeDetection';
import { describe, expect, it } from 'vitest';

describe('localeFromAcceptLanguage', () => {
  it.each([
    ['ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7', 'ru'],
    ['tk', 'tk'],
    ['tr-TR', 'tr'],
    ['en-GB,en;q=0.9', 'en'],
    ['EN_us', 'en'],
    ['  tk-TM ;q=1, ru', 'tk'],
    // The first entry decides, as in nginx; browsers list the main one first.
    ['en;q=0.5,tk;q=0.9', 'en'],
  ])('reads %s as %s', (header, expected) => {
    expect(localeFromAcceptLanguage(header)).toBe(expected);
  });

  // Only the main language counts: Chrome tacks `en` onto most lists, which
  // would otherwise make every German or Chinese browser "English".
  it.each([
    'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
    'zh-CN',
    '*',
    '',
    // 'ch' is a dialect we define; ISO 'ch' is Chamorro.
    'ch',
    // A language we ship further down doesn't count.
    'de,ru',
  ])('has no answer for %j', (header) => {
    expect(localeFromAcceptLanguage(header)).toBeNull();
  });

  it('has no answer without the header', () => {
    expect(localeFromAcceptLanguage(undefined)).toBeNull();
    expect(localeFromAcceptLanguage(null)).toBeNull();
  });
});

describe('localeFromCountry', () => {
  it.each([
    ['TR', 'tr'],
    ['TM', 'ru'],
    ['RU', 'ru'],
    ['DE', 'en'],
  ])('maps %s to %s', (country, expected) => {
    expect(localeFromCountry(country)).toBe(expected);
  });
});

describe('isCrawler', () => {
  it.each([
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)',
    'TelegramBot (like TwitterBot)',
    'WhatsApp/2.23.20.0',
    'facebookexternalhit/1.1',
    'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
    'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
    'Mozilla/5.0 (compatible; YandexImages/3.0; +http://yandex.com/bots)',
    'Pinterest/0.2 (+http://www.pinterest.com/bot.html)',
    'Mozilla/5.0 (compatible; Pinterestbot/1.0; +http://www.pinterest.com/bot.html)',
    '',
  ])('treats %j as a crawler', (ua) => {
    expect(isCrawler(ua)).toBe(true);
  });

  it.each([
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 10; CUBOT X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
    // The mobile app's WebView.
    'Mozilla/5.0 (Linux; Android 14; SM-A546E Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0 Mobile Safari/537.36',
    // In-app browsers of the Yandex and Pinterest apps.
    'Mozilla/5.0 (Linux; Android 11; M2101K6G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0 YandexSearch/21.124.1 YandexSearchBrowser/21.124.1 BroPP/1.0 SA/3 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 13; SM-G991B; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0 Mobile Safari/537.36 [Pinterest/Android]',
  ])('treats %j as a person', (ua) => {
    expect(isCrawler(ua)).toBe(false);
  });
});

describe('localizedPath', () => {
  it.each([
    ['en', '/product/x?brand=b1', '/en/product/x?brand=b1'],
    ['tk', '/', '/tk'],
    ['tk', '/?brand=b1', '/tk?brand=b1'],
    ['ru', '/product/x', '/product/x'],
    ['ru', '/', '/'],
  ] as const)('puts %s on %s', (locale, path, expected) => {
    expect(localizedPath(locale, path)).toBe(expected);
  });
});
