import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import CookieManager from '@react-native-cookies/cookies';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

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

  // Dev mode is determined automatically by React Native's __DEV__ flag.
  // __DEV__ = true in debug/Metro builds, false in release/production builds.
  const isDevMode = __DEV__;

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

  const appUrl = isDevMode ? 'http://localhost:3003' : 'https://xmobile.com.tm';
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
    const appVersion = DeviceInfo.getVersion();

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
      // Send app version to web app
      (function() {
        if (window) {
          window.dispatchEvent(new MessageEvent('message', {
            data: JSON.stringify({ type: 'APP_VERSION', payload: '${appVersion}' })
          }));
        }
      })();
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
        <WebView
          key={isDevMode ? 'dev' : 'prod'}
          ref={webViewRef}
          source={{ uri: appUrl }}
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

              if (data.type === 'AUTH_STATE') {
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
      ) : (
        <View style={styles.offlineContainer}>
          <Image
            source={require('../assets/images/connectionErr.png')}
            style={styles.offlineImage}
            resizeMode="contain"
          />
          <Text style={styles.offlineTitle}>No Internet!</Text>
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
            <Text style={styles.retryButtonText}>Check Again</Text>
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
});

export default WebAppScreen;
