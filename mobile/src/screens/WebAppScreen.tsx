import AsyncStorage from '@react-native-async-storage/async-storage';
import CookieManager from '@react-native-cookies/cookies';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

function WebAppScreen() {
  const insets = useSafeAreaInsets();
  const webViewRef = React.useRef<WebView>(null);
  const [storedToken, setStoredToken] = useState<string | null>(null);
  const [storedLocale, setStoredLocale] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
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

  const cookieInjectionJS = useMemo(() => {
    if (!storedToken) return undefined;

    const domainAttr = cookieDomain ? `; domain=${cookieDomain}` : '';
    const secureAttr = isDevMode ? '' : '; Secure';

    return `
      document.cookie = "REFRESH_TOKEN=${storedToken}; path=/${domainAttr}; max-age=31536000${secureAttr}; SameSite=Strict";
      ${
        storedLocale
          ? `document.cookie = "NEXT_LOCALE=${storedLocale}; path=/${domainAttr}; max-age=31536000${secureAttr}; SameSite=Strict";` //Change Strict to Lax when you integrate oAuth
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
});

export default WebAppScreen;
