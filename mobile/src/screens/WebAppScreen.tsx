import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import CookieManager from '@react-native-cookies/cookies';
import messaging from '@react-native-firebase/messaging';
import { RefreshCw, ServerCrash, WifiOff } from 'lucide-react-native';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  BackHandler,
  DevSettings,
  Linking,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { WebView } from 'react-native-webview';
import { resolveLocale } from '../i18n/locale';
import { getStrings } from '../i18n/strings';
import OnboardingScreen, { ONBOARDING_SEEN_KEY } from './OnboardingScreen';

const NAVY = '#20166E';
const RED = '#E41E2B';
const INK = '#17161D';
const MUTED = '#8B8A98';
const FILL = '#F5F5F8';
const RED_TINT = '#FDECEE';
const ICON_MUTED = '#B6B5C2';

// XMobile support line — matches SUPPORT_PHONES[0] in src/pages/support.page.tsx
const SUPPORT_PHONE = '+99361004933';

/**
 * Cross-platform notification permission check.
 *
 * - Android 13+ (API 33+): uses PermissionsAndroid.
 * - iOS: uses the Firebase Messaging SDK which maps to
 *   UNUserNotificationCenter.getNotificationSettings().
 * - Older Android: always granted (no runtime permission needed).
 */
async function checkNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    if (Number(Platform.Version) >= 33) {
      return await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
    }
    return true;
  }

  // iOS — AuthorizationStatus values:
  // AUTHORIZED = 1, PROVISIONAL = 3  → treat as granted
  // NOT_DETERMINED = 0, DENIED = -1  → treat as not granted
  const status = await messaging().hasPermission();
  return (
    status === messaging.AuthorizationStatus.AUTHORIZED ||
    status === messaging.AuthorizationStatus.PROVISIONAL
  );
}

/**
 * Cross-platform notification permission request.
 *
 * On iOS this triggers the native system alert (only shown once by the OS).
 * On Android 13+ it shows the runtime permission dialog.
 */
async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    if (Number(Platform.Version) >= 33) {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  }

  // iOS — requestPermission shows the system alert the very first time.
  // Subsequent calls return the already-stored status without showing the alert.
  const status = await messaging().requestPermission({
    alert: true,
    badge: true,
    sound: true,
    provisional: false,
  });
  return (
    status === messaging.AuthorizationStatus.AUTHORIZED ||
    status === messaging.AuthorizationStatus.PROVISIONAL
  );
}

/**
 * iOS requires explicit remote-message registration before getToken().
 * APNs must also succeed (Push capability + aps-environment in the signed app).
 */
async function ensureIOSRegisteredForRemoteMessages(): Promise<void> {
  if (Platform.OS !== 'ios') {
    return;
  }
  if (!messaging().isDeviceRegisteredForRemoteMessages) {
    await messaging().registerDeviceForRemoteMessages();
  }
}

function LoadingView() {
  const logoScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(logoScale, {
          toValue: 1.06,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    );
    breathe.start();
    return () => breathe.stop();
  }, [logoScale]);

  return (
    <View style={styles.loadingContainer}>
      <Animated.Image
        source={require('../assets/images/xmobile-logo.png')}
        style={[styles.loadingLogo, { transform: [{ scale: logoScale }] }]}
        resizeMode="contain"
      />
    </View>
  );
}

function WebAppScreen() {
  const webViewRef = React.useRef<WebView>(null);
  const [storedToken, setStoredToken] = useState<string | null>(null);
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [storedLocale, setStoredLocale] = useState<string | null>(null);
  const [storedGuestSession, setStoredGuestSession] = useState<string | null>(
    null,
  );
  const [isReady, setIsReady] = useState(false);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);

  // Language for the native screens (onboarding, offline, error). A stored
  // NEXT_LOCALE -- an explicit pick in the web app's language switcher -- always
  // wins; otherwise we read the OS language. Detection is re-run each launch
  // rather than written back to storage, so it stays a guess we can revise when
  // the user changes their phone's language, and never masquerades as a choice.
  const locale = useMemo(() => resolveLocale(storedLocale), [storedLocale]);
  const t = useMemo(() => getStrings(locale).app, [locale]);

  // Path the WebView opens on. Onboarding sets this when the user leaves via
  // the sign-in link so they land on sign-in instead of the home page.
  const [initialPath, setInitialPath] = useState('');
  const [isOffline, setIsOffline] = useState(false);
  const [hasWebviewError, setHasWebviewError] = useState(false);
  const canGoBackRef = useRef(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [pendingClickAction, setPendingClickAction] = useState<string | null>(
    null,
  );
  const [isWebAppReady, setIsWebAppReady] = useState(false);
  const isWebAppReadyRef = useRef(false);
  const fcmTokenFetchedRef = useRef(false);

  // Notification queue: multiple foreground notifications are queued and shown one at a time
  type FcmNotification = {
    title: string;
    body: string;
    data?: { [key: string]: any };
  };
  const [notificationQueue, setNotificationQueue] = useState<FcmNotification[]>(
    [],
  );
  const activeNotification = notificationQueue[0] ?? null;
  const dismissNotification = useCallback(() => {
    setNotificationQueue(prev => prev.slice(1));
  }, []);

  // Auto-dismiss the current banner after 4 seconds
  useEffect(() => {
    if (!activeNotification) return;
    const timer = setTimeout(dismissNotification, 4000);
    return () => clearTimeout(timer);
  }, [activeNotification, dismissNotification]);

  // Dev mode is determined automatically by React Native's __DEV__ flag.
  // __DEV__ = true in debug/Metro builds, false in release/production builds.
  const isDevMode = __DEV__;
  const baseUrl = isDevMode
    ? 'http://localhost:3003'
    : 'https://xmobile.com.tm';

  const persistGuestSessionFromCookie = useCallback(async () => {
    try {
      const cookies = await CookieManager.get(baseUrl, true);
      const guestSession = cookies?.GUEST_SESSION_ID?.value;
      if (guestSession) {
        await AsyncStorage.setItem('GUEST_SESSION_ID', guestSession);
        setStoredGuestSession(guestSession);
      }
    } catch (error) {
      console.warn('Failed to persist guest session cookie:', error);
    }
  }, [baseUrl]);

  const handleNotificationNavigationFromData = (data?: {
    [key: string]: any;
  }) => {
    if (!data) {
      return;
    }

    const rawClickAction = data.click_action;
    const rawOrderId = data.orderId;
    const rawSessionId = data.sessionId;

    const clickAction =
      typeof rawClickAction === 'string' ? rawClickAction : undefined;
    const orderId = typeof rawOrderId === 'string' ? rawOrderId : undefined;
    const sessionId =
      typeof rawSessionId === 'string' ? rawSessionId : undefined;
    let targetPath: string | null = null;
    if (clickAction) {
      targetPath = clickAction;
    } else if (orderId) {
      targetPath = `/orders/${orderId}`;
    } else if (sessionId) {
      targetPath = `/chat?sessionId=${sessionId}`;
    }
    if (!targetPath) {
      return;
    }

    if (isWebAppReadyRef.current && webViewRef.current) {
      const payload = JSON.stringify({
        type: 'NOTIFICATION_CLICK',
        payload: { target: targetPath },
      });
      webViewRef.current.injectJavaScript(`
            (function() {
                window.dispatchEvent(new MessageEvent('message', {
                    data: ${payload}
                }));
            })();
            true;
        `);
    } else {
      setPendingClickAction(targetPath);
    }
  };

  const fetchAndCacheToken = useCallback(async (): Promise<string | null> => {
    try {
      await ensureIOSRegisteredForRemoteMessages();
      const token = await messaging().getToken();
      if (token) {
        setFcmToken(token);
        await AsyncStorage.setItem('FCM_TOKEN_CACHE', token);
        console.log('[Native] FCM Token fetched & cached:', token);

        if (isWebAppReadyRef.current && webViewRef.current) {
          const uniqueId = await DeviceInfo.getUniqueId();
          const payload = JSON.stringify({
            type: 'FCM_TOKEN_AVAILABLE',
            payload: { token, uniqueId },
          });
          webViewRef.current.injectJavaScript(`
            (function() {
              window.dispatchEvent(new MessageEvent('message', { data: ${payload} }));
            })();
            true;
          `);
        }
        return token;
      }
    } catch (error) {
      console.warn('[Native] Could not fetch FCM token:', error);
    } finally {
      fcmTokenFetchedRef.current = true;
    }
    return null;
  }, []);

  // Initial token fetch on app start
  useEffect(() => {
    const initToken = async () => {
      const cached = await AsyncStorage.getItem('FCM_TOKEN_CACHE');
      if (cached) {
        setFcmToken(cached);
      }
      fetchAndCacheToken();
    };
    initToken();
  }, [fetchAndCacheToken]);

  useEffect(() => {
    const unsubscribeOnMessage = messaging().onMessage(async remoteMessage => {
      console.log('[Native] Foreground FCM message received:', remoteMessage);

      const title =
        remoteMessage.notification?.title ||
        (remoteMessage.data?.title as string) ||
        'Täze bildiriş';
      const body =
        remoteMessage.notification?.body ||
        (remoteMessage.data?.body as string) ||
        'Täze bildiriş aldyňyz.';

      // Use notificationId for deduplication in the queue
      const notificationId =
        (remoteMessage.data?.notificationId as string) ||
        remoteMessage.messageId;

      setNotificationQueue(prev => {
        // Prevent duplicate notifications in the queue
        if (
          prev.some(
            notification =>
              notification.data?.notificationId === notificationId,
          )
        ) {
          return prev;
        }
        return [...prev, { title, body, data: remoteMessage.data || {} }];
      });

      if (webViewRef.current && remoteMessage.data) {
        const payload = {
          type: 'FCM_FOREGROUND_MESSAGE',
          payload: remoteMessage.data,
        };
        webViewRef.current.injectJavaScript(`
          (function() {
            window.dispatchEvent(new MessageEvent('message', {
              data: ${JSON.stringify(payload)}
            }));
          })();
          true;
        `);
      }
    });

    const unsubscribeOpened = messaging().onNotificationOpenedApp(
      remoteMessage => {
        if (remoteMessage?.data) {
          handleNotificationNavigationFromData(remoteMessage.data);
        }
      },
    );

    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage?.data) {
          handleNotificationNavigationFromData(remoteMessage.data);
        }
      })
      .catch(error => {
        console.error('Failed to get initial notification:', error);
      });

    const unsubscribeTokenRefresh = messaging().onTokenRefresh(async token => {
      if (token) {
        setFcmToken(token);
        AsyncStorage.setItem('FCM_TOKEN_CACHE', token);
        if (webViewRef.current) {
          const uniqueId = await DeviceInfo.getUniqueId();
          const payload = JSON.stringify({
            type: 'FCM_TOKEN_AVAILABLE',
            payload: { token, uniqueId },
          });
          webViewRef.current.injectJavaScript(`
            (function() {
              window.dispatchEvent(new MessageEvent('message', {
                data: ${payload}
              }));
            })();
            true;
          `);
        }
      }
    });

    return () => {
      unsubscribeOnMessage();
      unsubscribeOpened();
      unsubscribeTokenRefresh();
    };
  }, []);

  useEffect(() => {
    isWebAppReadyRef.current = isWebAppReady;
  }, [isWebAppReady]);

  useEffect(() => {
    canGoBackRef.current = canGoBack;
  }, [canGoBack]);

  useEffect(() => {
    const backButton = () => {
      if (canGoBackRef.current && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    };
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backButton,
    );
    return () => backHandler.remove();
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      // isConnected will be false when there's no internet interface connection
      const offline = state.isConnected === false;
      setIsOffline(offline);
      // If internet comes back, clear the webview error so it can retry rendering
      if (!offline) {
        setHasWebviewError(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const loadStoredData = async () => {
      try {
        const token = await AsyncStorage.getItem('REFRESH_TOKEN');
        const savedLocale = await AsyncStorage.getItem('NEXT_LOCALE');
        const guestSession = await AsyncStorage.getItem('GUEST_SESSION_ID');
        const seenOnboarding = await AsyncStorage.getItem(ONBOARDING_SEEN_KEY);

        setStoredToken(token);
        setStoredLocale(savedLocale);
        setStoredGuestSession(guestSession);
        setHasSeenOnboarding(!!seenOnboarding);

        if (guestSession) {
          const domain = isDevMode ? 'localhost' : '.xmobile.com.tm';
          const expiresAt = new Date();
          expiresAt.setFullYear(expiresAt.getFullYear() + 10);
          await CookieManager.set(baseUrl, {
            name: 'GUEST_SESSION_ID',
            value: guestSession,
            path: '/',
            domain,
            expires: expiresAt.toISOString(),
            httpOnly: true,
            secure: !isDevMode,
          });
        }
      } catch (error) {
        console.error('Failed to load storage data:', error);
      } finally {
        setIsReady(true);
      }
    };

    loadStoredData();
  }, [baseUrl, isDevMode]);

  const cookieDomain = isDevMode ? null : '.xmobile.com.tm';

  useEffect(() => {
    const syncStoredGuestSessionCookie = async () => {
      if (!storedGuestSession) return;
      try {
        const domain = isDevMode ? 'localhost' : '.xmobile.com.tm';
        const expiresAt = new Date();
        expiresAt.setFullYear(expiresAt.getFullYear() + 10);
        await CookieManager.set(baseUrl, {
          name: 'GUEST_SESSION_ID',
          value: storedGuestSession,
          path: '/',
          domain,
          expires: expiresAt.toISOString(),
          httpOnly: true,
          secure: !isDevMode,
        });
      } catch (error) {
        console.warn('Failed to sync stored guest session cookie:', error);
      }
    };
    syncStoredGuestSessionCookie();
  }, [storedGuestSession, baseUrl, isDevMode]);

  useEffect(() => {
    const checkAndReload = async () => {
      const currentVersion = DeviceInfo.getVersion();
      const lastVersion = await AsyncStorage.getItem('APP_VERSION');

      if (currentVersion !== lastVersion) {
        await AsyncStorage.setItem('APP_VERSION', currentVersion);
        if (webViewRef.current) {
          webViewRef.current.reload();
        }
      }
    };
    checkAndReload();
  }, []);

  // Onboarding is native-only and shows exactly once, on the first launch after
  // install -- nothing in the web app can trigger it, and there is deliberately
  // no way back into it in a release build. That leaves it untestable without a
  // reinstall, so expose a replay in the in-app dev menu (shake / Cmd+D).
  // __DEV__ only: no release build has this entry.
  useEffect(() => {
    if (!__DEV__) {
      return;
    }
    DevSettings.addMenuItem('Show onboarding again', async () => {
      await AsyncStorage.removeItem(ONBOARDING_SEEN_KEY);
      setInitialPath('');
      setHasSeenOnboarding(false);
    });
  }, []);

  const cookieInjectionJS = useMemo(() => {
    const domainAttr = cookieDomain ? `; domain=${cookieDomain}` : '';
    const secureAttr = isDevMode ? '' : '; Secure';

    // Sits outside the auth branches on purpose. This used to be written only
    // when a token existed, so a fresh install -- always the logged-out branch,
    // and the only time onboarding runs -- handed the WebView no locale at all
    // and the web app fell back to its Russian default. The native screens
    // would then be in one language and the page that followed in another.
    // `locale` is always set, since resolveLocale() ends at DEFAULT_LOCALE.
    const localeCookie = `document.cookie = "NEXT_LOCALE=${locale}; path=/${domainAttr}; max-age=315360000${secureAttr}; SameSite=Strict";`;

    if (storedToken) {
      return `
        document.cookie = "REFRESH_TOKEN=${storedToken}; path=/${domainAttr}; max-age=315360000${secureAttr}; SameSite=Strict";
        ${localeCookie}
        true;
      `;
    } else {
      return `
        document.cookie = "REFRESH_TOKEN=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT${secureAttr}; SameSite=Strict";
        ${
          cookieDomain
            ? `document.cookie = "REFRESH_TOKEN=; path=/; domain=${cookieDomain}; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT${secureAttr}; SameSite=Strict";`
            : ''
        }
        ${localeCookie}
        true;
      `;
    }
  }, [storedToken, locale, cookieDomain, isDevMode]);

  useEffect(() => {
    if (cookieInjectionJS && webViewRef.current) {
      webViewRef.current.injectJavaScript(cookieInjectionJS);
    }
  }, [cookieInjectionJS]);

  if (!isReady) {
    return <LoadingView />;
  }

  if (!hasSeenOnboarding) {
    return (
      <OnboardingScreen
        locale={locale}
        onDone={landingPath => {
          setInitialPath(landingPath ?? '');
          setHasSeenOnboarding(true);
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      {isOffline ? (
        <View style={styles.stateContainer}>
          <View style={[styles.iconCircle, { backgroundColor: FILL }]}>
            <WifiOff width={52} height={52} color={ICON_MUTED} />
          </View>
          <Text style={styles.stateTitle}>{t.offlineTitle}</Text>
          <Text style={styles.stateBody}>{t.offlineBody}</Text>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.stateButton}
            onPress={() => {
              // NetInfo addEventListener is sometimes lazy on VPNs — force a fresh fetch
              NetInfo.fetch().then(state => {
                setIsOffline(state.isConnected === false);
              });
            }}
          >
            <RefreshCw width={18} height={18} color="#ffffff" />
            <Text style={styles.stateButtonText}>{t.retry}</Text>
          </TouchableOpacity>
        </View>
      ) : hasWebviewError ? (
        <View style={styles.stateContainer}>
          <View style={[styles.iconCircle, { backgroundColor: RED_TINT }]}>
            <ServerCrash width={50} height={50} color={RED} />
          </View>
          <Text style={styles.stateTitle}>{t.errorTitle}</Text>
          <Text style={styles.stateBody}>{t.errorBody}</Text>
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.stateButton, styles.stateButtonSpaced]}
            onPress={() => {
              // WebView is unmounted while this state shows, so there's no ref to
              // reload() — remounting it against the same uri is the retry.
              setHasWebviewError(false);
            }}
          >
            <RefreshCw width={18} height={18} color="#ffffff" />
            <Text style={styles.stateButtonText}>{t.retry}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => Linking.openURL(`tel:${SUPPORT_PHONE}`)}
          >
            <Text style={styles.stateSupportText}>{t.supportLink}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {activeNotification && (
            <TouchableOpacity
              activeOpacity={0.95}
              style={styles.fcmBanner}
              onPress={() => {
                if (activeNotification.data) {
                  handleNotificationNavigationFromData(activeNotification.data);
                }
                dismissNotification();
              }}
            >
              <View style={styles.fcmBannerContent}>
                <Text style={styles.fcmBannerTitle} numberOfLines={1}>
                  {activeNotification.title}
                </Text>
                <Text style={styles.fcmBannerBody} numberOfLines={2}>
                  {activeNotification.body}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          <WebView
            key={isDevMode ? 'dev' : 'prod'}
            ref={webViewRef}
            source={{ uri: `${baseUrl}${initialPath}` }}
            sharedCookiesEnabled={true}
            thirdPartyCookiesEnabled={true}
            cacheEnabled={true}
            incognito={false}
            domStorageEnabled={true}
            onNavigationStateChange={navState => {
              setCanGoBack(navState.canGoBack);
              persistGuestSessionFromCookie();
            }}
            style={styles.webview}
            startInLoadingState={true}
            javaScriptEnabled={true}
            renderLoading={() => <LoadingView />}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            onError={syntheticEvent => {
              const { nativeEvent } = syntheticEvent;
              console.warn('WebView error: ', nativeEvent);
              setHasWebviewError(true);
            }}
            onHttpError={syntheticEvent => {
              const { nativeEvent } = syntheticEvent;
              console.warn('WebView HTTP error: ', nativeEvent);
            }}
            onMessage={async event => {
              try {
                const data = JSON.parse(event.nativeEvent.data);
                console.log('WebView Message received:', data.type);

                if (data.type === 'REQUEST_APP_VERSION') {
                  // Web app is ready, now it's safe to send the version
                  setIsWebAppReady(true);
                  const appVersion = DeviceInfo.getVersion();
                  if (webViewRef.current) {
                    const appVersionPayload = {
                      type: 'APP_VERSION',
                      payload: appVersion,
                    };
                    const scripts: string[] = [
                      `window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(
                        appVersionPayload,
                      )} }));`,
                    ];

                    if (pendingClickAction) {
                      const deepLinkPayload = JSON.stringify({
                        type: 'NOTIFICATION_CLICK',
                        payload: { target: pendingClickAction },
                      });
                      scripts.push(`window.dispatchEvent(new MessageEvent('message', {
                        data: ${deepLinkPayload}
                    }));`);
                    }

                    if (fcmToken) {
                      const uniqueId = DeviceInfo.getUniqueIdSync();
                      const tokenPayload = JSON.stringify({
                        type: 'FCM_TOKEN_AVAILABLE',
                        payload: { token: fcmToken, uniqueId },
                      });
                      scripts.push(
                        `window.dispatchEvent(new MessageEvent('message', { data: ${tokenPayload} }));`,
                      );
                    }

                    webViewRef.current.injectJavaScript(`
                    (function() {
                      ${scripts.join('\n')}
                    })();
                    true;
                  `);
                    if (pendingClickAction) {
                      setPendingClickAction(null);
                    }
                  }
                } else if (data.type === 'REQUEST_FCM_TOKEN') {
                  const uniqueId = await DeviceInfo.getUniqueId();
                  let token = fcmToken;
                  if (!token) {
                    token = await fetchAndCacheToken();
                  }
                  if (token && webViewRef.current) {
                    const payload = JSON.stringify({
                      type: 'FCM_TOKEN',
                      payload: { token, uniqueId },
                    });

                    webViewRef.current.injectJavaScript(`
                    (function() {
                      window.dispatchEvent(new MessageEvent('message', {
                        data: ${payload}
                      }));
                    })();
                    true;
                  `);
                  }
                } else if (data.type === 'CHECK_PERMISSION') {
                  const status = await checkNotificationPermission();
                  if (webViewRef.current) {
                    const payload = JSON.stringify({
                      type: 'NOTIFICATION_PERMISSION_STATUS',
                      payload: {
                        status: status ? 'GRANTED' : 'NOT_DETERMINED',
                      },
                    });
                    webViewRef.current.injectJavaScript(`
                        window.dispatchEvent(new MessageEvent('message', { data: ${payload} }));
                        true;
                       `);
                  }
                } else if (data.type === 'REQUEST_PERMISSION') {
                  const granted = await requestNotificationPermission();
                  if (granted) {
                    fetchAndCacheToken();
                  }
                  if (webViewRef.current) {
                    const payload = JSON.stringify({
                      type: 'NOTIFICATION_PERMISSION_STATUS',
                      payload: { status: granted ? 'GRANTED' : 'DENIED' },
                    });
                    webViewRef.current.injectJavaScript(`
                         window.dispatchEvent(new MessageEvent('message', { data: ${payload} }));
                         true;
                        `);
                  }
                } else if (data.type === 'AUTH_STATE') {
                  const { REFRESH_TOKEN, NEXT_LOCALE } = data.payload;
                  if (REFRESH_TOKEN) {
                    await AsyncStorage.setItem('REFRESH_TOKEN', REFRESH_TOKEN);
                    setStoredToken(REFRESH_TOKEN);
                  } else {
                    // Token was deleted on web side — clear everything
                    await AsyncStorage.removeItem('REFRESH_TOKEN');
                    await AsyncStorage.removeItem('FCM_TOKEN_CACHE');
                    await CookieManager.clearAll(true);
                    setStoredToken(null);
                    setFcmToken(null);
                  }

                  if (NEXT_LOCALE) {
                    await AsyncStorage.setItem('NEXT_LOCALE', NEXT_LOCALE);
                    setStoredLocale(NEXT_LOCALE);
                  } else {
                    await AsyncStorage.removeItem('NEXT_LOCALE');
                    setStoredLocale(null);
                  }
                } else if (data.type === 'LOGOUT') {
                  await AsyncStorage.removeItem('REFRESH_TOKEN');
                  await AsyncStorage.removeItem('FCM_TOKEN_CACHE');
                  await AsyncStorage.removeItem('NEXT_LOCALE');
                  await AsyncStorage.removeItem('GUEST_SESSION_ID');
                  await CookieManager.clearAll(true);
                  setStoredToken(null);
                  setStoredLocale(null);
                  setStoredGuestSession(null);
                  setFcmToken(null);
                }
                await persistGuestSessionFromCookie();
              } catch (err) {
                console.error('Failed to parse WebView message:', err);
              }
            }}
            injectedJavaScriptBeforeContentLoaded={cookieInjectionJS}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    zIndex: 10,
  },
  loadingLogo: {
    width: 300,
    height: 90,
  },
  stateContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    zIndex: 10,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 26,
  },
  stateTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: INK,
    marginBottom: 10,
    textAlign: 'center',
  },
  stateBody: {
    fontSize: 15,
    lineHeight: 23,
    color: MUTED,
    textAlign: 'center',
    marginBottom: 26,
  },
  stateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    paddingHorizontal: 34,
    borderRadius: 15,
    backgroundColor: NAVY,
  },
  stateButtonSpaced: {
    marginBottom: 12,
  },
  stateButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  stateSupportText: {
    fontSize: 13,
    fontWeight: '600',
    color: MUTED,
  },
  fcmBanner: {
    position: 'absolute',
    // Offsets are inset-free: AppFrame already pads past the system bars, so
    // this is 12pt in from the safe area rather than from the screen edge.
    top: 12,
    left: 12,
    right: 12,
    zIndex: 100,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderLeftWidth: 5,
    borderLeftColor: '#ff624c',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  fcmBannerContent: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  fcmBannerTitle: {
    color: '#1a1a1a',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  fcmBannerBody: {
    color: '#4a4a4a',
    fontSize: 14,
    lineHeight: 18,
  },
});

export default WebAppScreen;
