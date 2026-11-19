// @vitest-environment jsdom

import AppDownloadBanner from '@/pages/components/AppDownloadBanner';
import AppInstallBar, {
  INSTALL_BAR_DISMISSED_KEY,
} from '@/pages/components/AppInstallBar';
import { APP_STORE_URL, PLAY_STORE_URL } from '@/pages/lib/appDownload';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from './helpers/renderWithProviders';

const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1';
const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const DESKTOP =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

type BridgeWindow = Window & { ReactNativeWebView?: unknown };

const useAgent = (ua: string) =>
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua);

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  delete (window as BridgeWindow).ReactNativeWebView;
});

describe('AppDownloadBanner', () => {
  it("shows both stores, the phone's own first", async () => {
    useAgent(ANDROID);
    renderWithProviders(createElement(AppDownloadBanner));

    await screen.findByRole('link', { name: /google play/i });
    const hrefs = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual([PLAY_STORE_URL, APP_STORE_URL]);
  });

  it('puts the App Store first on an iPhone', async () => {
    useAgent(IPHONE_SAFARI);
    renderWithProviders(createElement(AppDownloadBanner));

    await screen.findByRole('link', { name: /app store/i });
    const hrefs = screen
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual([APP_STORE_URL, PLAY_STORE_URL]);
  });

  it('stays hidden on a desktop', () => {
    useAgent(DESKTOP);
    const { container } = renderWithProviders(createElement(AppDownloadBanner));
    expect(container.innerHTML).toBe('');
  });

  it('stays hidden inside our own app', () => {
    useAgent(ANDROID);
    (window as BridgeWindow).ReactNativeWebView = { postMessage: vi.fn() };
    const { container } = renderWithProviders(createElement(AppDownloadBanner));
    expect(container.innerHTML).toBe('');
  });
});

describe('AppInstallBar', () => {
  it('links an iPhone outside Safari to the App Store', async () => {
    useAgent(IPHONE_CHROME);
    renderWithProviders(createElement(AppInstallBar));

    const cta = await screen.findByRole('link', { name: /install/i });
    expect(cta.getAttribute('href')).toBe(APP_STORE_URL);
  });

  it('leaves Safari to its own banner', () => {
    useAgent(IPHONE_SAFARI);
    const { container } = renderWithProviders(createElement(AppInstallBar));
    expect(container.innerHTML).toBe('');
  });

  it('stays closed once dismissed', async () => {
    const user = userEvent.setup();
    useAgent(ANDROID);
    const first = renderWithProviders(createElement(AppInstallBar));

    await user.click(await screen.findByRole('button', { name: /close/i }));
    expect(screen.queryByRole('link', { name: /install/i })).toBeNull();
    expect(localStorage.getItem(INSTALL_BAR_DISMISSED_KEY)).not.toBeNull();
    first.unmount();

    const { container } = renderWithProviders(createElement(AppInstallBar));
    expect(container.innerHTML).toBe('');
  });
});
