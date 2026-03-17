import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import CookieManager from '@react-native-cookies/cookies';
import messaging from '@react-native-firebase/messaging';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Image,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

async function getOrRequestNativeFcmToken() {
  if (Number(Platform.Version) >= 33) {
    const hasPermission = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );

    if (!hasPermission) {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      if (result !== PermissionsAndroid.RESULTS.GRANTED) {
        return null;
      }
    }
  }

  try {
    const token = await messaging().getToken();
    if (token) {
      console.log(
        '\n\n==== YOUR DEVICE FCM TOKEN ====\n' +
          token +
          '\n===============================\n\n',
      );
      return token;
    }
    console.error('Failed to get FCM token');
    return null;
  } catch (error) {
    console.error('Failed to get FCM token from native:', error);
    return null;
  }
}

function WebAppScreen() {
  const insets = useSafeAreaInsets();
  const webViewRef = React.useRef<WebView>(null);
  const [storedToken, setStoredToken] = useState<string | null>(null);
  const [storedLocale, setStoredLocale] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [hasWebviewError, setHasWebviewError] = useState(false);
  const canGoBackRef = useRef(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [pendingClickAction, setPendingClickAction] = useState<string | null>(
    null,
  );
  const [isWebAppReady, setIsWebAppReady] = useState(false);
  const isWebAppReadyRef = useRef(false);

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
        type: 'DEEP_LINK',
        payload: targetPath,
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

  useEffect(() => {
    const unsubscribeOnMessage = messaging().onMessage(async remoteMessage => {
      const title = remoteMessage.notification?.title || 'Täze bildiriş';
      const dataContent = remoteMessage.data?.content;
      const body =
        remoteMessage.notification?.body ||
        (typeof dataContent === 'string' ? dataContent : undefined) ||
        'Täze bildiriş aldyňyz.';

      setNotificationQueue(prev => [
        ...prev,
        { title, body, data: remoteMessage.data || {} },
      ]);

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

    const unsubscribeTokenRefresh = messaging().onTokenRefresh(token => {
      if (token && webViewRef.current) {
        const payload = JSON.stringify({
          type: 'FCM_TOKEN_REFRESHED',
          payload: { token },
        });
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
      // isConnected will be false when there's no internet
      const offline = !(state.isConnected && state.isInternetReachable);
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
        const locale = await AsyncStorage.getItem('NEXT_LOCALE');

        setStoredToken(token);
        setStoredLocale(locale);
      } catch (error) {
        console.error('Failed to load storage data:', error);
      } finally {
        setIsReady(true);
      }
    };

    loadStoredData();
  }, []);

  const cookieDomain = isDevMode ? null : '.xmobile.com.tm';

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

  const cookieInjectionJS = useMemo(() => {
    const domainAttr = cookieDomain ? `; domain=${cookieDomain}` : '';
    const secureAttr = isDevMode ? '' : '; Secure';

    return `
      ${
        storedToken
          ? `document.cookie = "REFRESH_TOKEN=${storedToken}; path=/${domainAttr}; max-age=31536000${secureAttr}; SameSite=Strict";`
          : ''
      }
      ${
        storedLocale
          ? `document.cookie = "NEXT_LOCALE=${storedLocale}; path=/${domainAttr}; max-age=31536000${secureAttr}; SameSite=Strict";`
          : ''
      }
      true;
    `;
  }, [storedToken, storedLocale, cookieDomain, isDevMode]);

  useEffect(() => {
    if (cookieInjectionJS && webViewRef.current) {
      webViewRef.current.injectJavaScript(cookieInjectionJS);
    }
  }, [cookieInjectionJS]);

  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#d32f2f" />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      {!isOffline && !hasWebviewError ? (
        <>
          {activeNotification && (
            <TouchableOpacity
              activeOpacity={0.95}
              style={[
                styles.fcmBanner,
                {
                  top: insets.top + 12,
                  left: insets.left + 12,
                  right: insets.right + 12,
                },
              ]}
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
            source={{ uri: baseUrl }}
            sharedCookiesEnabled={true}
            thirdPartyCookiesEnabled={true}
            cacheEnabled={true}
            incognito={false}
            domStorageEnabled={true}
            onNavigationStateChange={navState => {
              setCanGoBack(navState.canGoBack);
            }}
            style={styles.webview}
            startInLoadingState={true}
            javaScriptEnabled={true}
            renderLoading={() => (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#d32f2f" />
              </View>
            )}
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
                        type: 'DEEP_LINK',
                        payload: pendingClickAction,
                      });
                      scripts.push(`window.dispatchEvent(new MessageEvent('message', {
                        data: ${deepLinkPayload}
                    }));`);
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
                  const token = await getOrRequestNativeFcmToken();

                  if (token && webViewRef.current) {
                    const payload = JSON.stringify({
                      type: 'FCM_TOKEN',
                      payload: { token },
                    });

                    webViewRef.current.injectJavaScript(`
                    (function() {
                      window.dispatchEvent(new MessageEvent('message', {
                        data: JSON.stringify(${payload})
                      }));
                    })();
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
                    await CookieManager.clearAll(true);
                    setStoredToken(null);
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
                  await AsyncStorage.removeItem('NEXT_LOCALE');
                  await CookieManager.clearAll(true);
                  setStoredToken(null);
                  setStoredLocale(null);
                }
              } catch (err) {
                console.error('Failed to parse WebView message:', err);
              }
            }}
            injectedJavaScriptBeforeContentLoaded={cookieInjectionJS}
          />
        </>
      ) : (
        <View style={styles.offlineContainer}>
          <Image
            source={require('../assets/images/connectionErr.png')}
            style={styles.offlineImage}
            resizeMode="contain"
          />
          <Text style={styles.offlineTitle}>Baglanyşyk Kesildi</Text>
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.retryButton}
            onPress={() => {
              setHasWebviewError(false);
              // Force NetInfo to fetch current state (NetInfo addEventListener is sometimes lazy on VPNs)
              NetInfo.fetch().then(state => {
                setIsOffline(!(state.isConnected && state.isInternetReachable));
              });
            }}
          >
            <Text style={styles.retryButtonText}>Täzeden synanyş</Text>
          </TouchableOpacity>
        </View>
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  offlineContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    zIndex: 10,
  },
  offlineImage: {
    width: 180,
    height: 180,
    marginBottom: 24,
  },
  offlineTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#000000',
    marginTop: 0,
    marginBottom: 40,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#ff624c',
    paddingVertical: 16,
    paddingHorizontal: 40,
    width: '100%',
    borderRadius: 12,
    shadowColor: '#ff624c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  fcmBanner: {
    position: 'absolute',
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
