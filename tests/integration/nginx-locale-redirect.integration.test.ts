import * as http from 'node:http';
import * as path from 'node:path';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * The production language redirect (scripts/prod_scripts/nginx-locale-*) in a real nginx.
 * The site is a stand-in: `location /` includes the snippet the VM includes,
 * then answers "app" -- so "app" means the request would reach Next untouched.
 */

const CONF_DIR = path.resolve(__dirname, '../../scripts/prod_scripts');

const NGINX_CONF = `
events {}
http {
  include /etc/nginx/xmobile/nginx-locale-maps.conf;
  server {
    listen 80;
    location / {
      include /etc/nginx/xmobile/nginx-locale-redirect.conf;
      return 200 "app";
    }
  }
}
`;

const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

type Req = {
  ua?: string;
  lang?: string;
  cookie?: string;
  method?: string;
  headers?: Record<string, string>;
};

let nginx: StartedTestContainer;

/** `-> /where` for a 307, `app` for a pass-through, `HTTP n` otherwise. */
function hit(
  urlPath: string,
  { ua = CHROME, lang, cookie, method = 'GET', headers = {} }: Req = {},
): Promise<{ got: string; headers: http.IncomingHttpHeaders }> {
  const sent: Record<string, string> = { 'user-agent': ua, ...headers };
  if (lang) sent['accept-language'] = lang;
  if (cookie) sent.cookie = cookie;
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: nginx.getHost(),
        port: nginx.getMappedPort(80),
        path: urlPath,
        method,
        headers: sent,
      },
      (res) => {
        res.resume();
        res.on('end', () => {
          let got = `HTTP ${res.statusCode}`;
          if (res.statusCode === 307) got = `-> ${res.headers.location}`;
          if (res.statusCode === 200) got = 'app';
          resolve({ got, headers: res.headers });
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

beforeAll(async () => {
  nginx = await new GenericContainer('nginx:1.24-alpine')
    .withCopyContentToContainer([
      { content: NGINX_CONF, target: '/etc/nginx/nginx.conf' },
    ])
    .withCopyFilesToContainer(
      ['nginx-locale-maps.conf', 'nginx-locale-redirect.conf'].map((file) => ({
        source: path.join(CONF_DIR, file),
        target: `/etc/nginx/xmobile/${file}`,
      })),
    )
    .withExposedPorts(80)
    .start();
});

afterAll(async () => {
  await nginx?.stop();
});

const cases: [name: string, urlPath: string, req: Req, expected: string][] = [
  // Browser language, no pick, plain link.
  [
    'tk browser, plain product link',
    '/product/iphone?c=red',
    { lang: 'tk-TM,tk;q=0.9,en;q=0.8' },
    '-> /tk/product/iphone?c=red',
  ],
  ['tk browser, home', '/', { lang: 'tk' }, '-> /tk'],
  [
    'en browser, home with a query',
    '/?brand=b1',
    { lang: 'en-US,en;q=0.9' },
    '-> /en?brand=b1',
  ],
  [
    'tr browser, upper-case tag',
    '/category/phones',
    { lang: 'TR-tr' },
    '-> /tr/category/phones',
  ],
  [
    'ru browser, plain link stays',
    '/product/iphone',
    { lang: 'ru-RU,ru;q=0.9' },
    'app',
  ],
  [
    'de browser stays (English further down does not count)',
    '/product/iphone',
    { lang: 'de-DE,de;q=0.9,en;q=0.8' },
    'app',
  ],
  ['de browser home is left to GeoIP in Next', '/', { lang: 'de-DE' }, 'app'],
  ['"ch" is never detected', '/', { lang: 'ch' }, 'app'],
  ['no Accept-Language stays', '/product/iphone', {}, 'app'],
  [
    'an encoded path reaches the Location as sent',
    '/product/%D0%B0%20b?q=%D1%8F',
    { lang: 'en' },
    '-> /en/product/%D0%B0%20b?q=%D1%8F',
  ],
  [
    'a slug starting with a locale is not a prefix',
    '/english-phone',
    { lang: 'tk' },
    '-> /tk/english-phone',
  ],

  // The browser's language beats the link's; the link's only counts for a
  // browser language we don't ship.
  [
    'ru browser, shared /en link opens in Russian',
    '/en/product/iphone',
    { lang: 'ru-RU,ru;q=0.9' },
    '-> /product/iphone',
  ],
  [
    'ru browser, /en home opens the Russian home',
    '/en',
    { lang: 'ru' },
    '-> /',
  ],
  [
    'tk browser, shared /en link opens in Turkmen',
    '/en/product/iphone?c=red',
    { lang: 'tk' },
    '-> /tk/product/iphone?c=red',
  ],
  [
    'en browser, shared /ch link opens in English',
    '/ch/product/iphone',
    { lang: 'en' },
    '-> /en/product/iphone',
  ],
  [
    'tk browser, explicit /ru link opens in Turkmen',
    '/ru/product/iphone',
    { lang: 'tk' },
    '-> /tk/product/iphone',
  ],
  [
    'tk browser, upper-case /EN link opens in Turkmen',
    '/EN/product/iphone',
    { lang: 'tk' },
    '-> /tk/product/iphone',
  ],
  [
    'browser already matches the link: stays',
    '/tk/product/iphone',
    { lang: 'tk-TM' },
    'app',
  ],
  [
    'de browser keeps the /en link',
    '/en/product/iphone',
    { lang: 'de-DE,de;q=0.9' },
    'app',
  ],
  ['no Accept-Language keeps the /tk link', '/tk/product/iphone', {}, 'app'],
  [
    'Googlebot keeps the /en link, whatever its language',
    '/en/product/iphone',
    {
      ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      lang: 'ru',
    },
    'app',
  ],

  // The visitor's pick beats everything.
  [
    'pick ch, shared /en link, tk browser',
    '/en/product/iphone',
    { lang: 'tk', cookie: 'NEXT_LOCALE=ch' },
    '-> /ch/product/iphone',
  ],
  ['pick ru on /en home', '/en', { cookie: 'NEXT_LOCALE=ru' }, '-> /'],
  [
    'pick ru on /en home with a query',
    '/en?brand=b1',
    { cookie: 'NEXT_LOCALE=ru' },
    '-> /?brand=b1',
  ],
  [
    'pick ru on /en/product keeps the query',
    '/en/product/x?a=1&b=2',
    { cookie: 'NEXT_LOCALE=ru' },
    '-> /product/x?a=1&b=2',
  ],
  [
    'pick tk on /en/ (trailing slash)',
    '/en/',
    { cookie: 'NEXT_LOCALE=tk' },
    '-> /tk',
  ],
  [
    'pick matches the link: stays',
    '/tk/product/x',
    { lang: 'en', cookie: 'NEXT_LOCALE=tk' },
    'app',
  ],
  [
    'pick ru on a plain link: stays',
    '/product/x',
    { lang: 'en', cookie: 'NEXT_LOCALE=ru' },
    'app',
  ],
  [
    'a bogus pick is ignored, browser used',
    '/product/x',
    { lang: 'en', cookie: 'NEXT_LOCALE=xx' },
    '-> /en/product/x',
  ],
  [
    'pick among other cookies',
    '/product/x',
    { cookie: 'REFRESH_TOKEN=abc; NEXT_LOCALE=tr; GUEST_SESSION_ID=z' },
    '-> /tr/product/x',
  ],

  // Never redirected.
  [
    'Googlebot',
    '/product/x',
    {
      ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      lang: 'en',
      cookie: 'NEXT_LOCALE=tk',
    },
    'app',
  ],
  [
    'Googlebot smartphone',
    '/',
    {
      ua: 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      lang: 'en',
    },
    'app',
  ],
  [
    'YandexBot',
    '/',
    {
      ua: 'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)',
      lang: 'en',
    },
    'app',
  ],
  [
    'Telegram link preview',
    '/product/x',
    { ua: 'TelegramBot (like TwitterBot)', lang: 'en' },
    'app',
  ],
  [
    'WhatsApp link preview',
    '/product/x',
    { ua: 'WhatsApp/2.23.20.0', lang: 'en' },
    'app',
  ],
  [
    'no user agent (scripts, monitors)',
    '/product/x',
    { ua: '', lang: 'en' },
    'app',
  ],
  [
    'client navigation',
    '/product/x',
    { lang: 'en', headers: { 'x-nextjs-data': '1' } },
    'app',
  ],
  [
    'prefetch',
    '/product/x',
    { lang: 'en', headers: { purpose: 'prefetch' } },
    'app',
  ],
  ['POST', '/product/x', { lang: 'en', method: 'POST' }, 'app'],
  ['API', '/api/product', { lang: 'en' }, 'app'],
  ['Next data request', '/_next/data/b/en/product.json', { lang: 'tk' }, 'app'],
  ['Next static file', '/_next/static/chunks/main.js', { lang: 'tk' }, 'app'],
  [
    'uploaded media without an extension',
    '/media/product/good/abc',
    { lang: 'en' },
    'app',
  ],
  ['chat socket', '/ws/', { lang: 'en' }, 'app'],
  [
    'certificate check file',
    '/.well-known/pki-validation/x',
    { lang: 'en' },
    'app',
  ],
  ['robots.txt', '/robots.txt', { lang: 'en' }, 'app'],
  ['sitemap.xml', '/sitemap.xml', { lang: 'en' }, 'app'],

  // People, not crawlers.
  [
    'a CUBOT phone is a person',
    '/product/x',
    {
      ua: 'Mozilla/5.0 (Linux; Android 10; CUBOT X30) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36',
      lang: 'en',
    },
    '-> /en/product/x',
  ],
  [
    'Android WebView (the app) is a person',
    '/',
    {
      ua: 'Mozilla/5.0 (Linux; Android 14; SM-A546E Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0 Mobile Safari/537.36',
      lang: 'tk-TM',
    },
    '-> /tk',
  ],
  [
    'iPhone Safari is a person',
    '/category/x',
    {
      ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1',
      lang: 'tr-TR,tr;q=0.9',
    },
    '-> /tr/category/x',
  ],
  [
    'HEAD is a page load too',
    '/product/x',
    { lang: 'en', method: 'HEAD' },
    '-> /en/product/x',
  ],
];

describe('nginx language redirect (integration)', () => {
  it.each(cases)('%s', async (_name, urlPath, req, expected) => {
    expect((await hit(urlPath, req)).got).toBe(expected);
  });

  it('is temporary, relative, and never cached for others', async () => {
    const { got, headers } = await hit('/product/x', {
      lang: 'en',
      headers: { host: 'www.xmobile.com.tm' },
    });
    expect(got).toBe('-> /en/product/x');
    expect(headers['cache-control']).toBe('private, no-store');
    expect(headers.vary).toBe('Cookie, Accept-Language, User-Agent');
  });
});
