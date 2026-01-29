import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, BackHandler, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

function WebAppScreen() {
  const insets = useSafeAreaInsets();
  const webViewRef = React.useRef<WebView>(null);
  const [storedToken, setStoredToken] = React.useState<string | null>(null);
  const [storedLocale, setStoredLocale] = React.useState<string | null>(null);
  const [isTokenLoaded, setIsTokenLoaded] = React.useState(false);
  const [canGoBack, setCanGoBack] = React.useState(false);

  useEffect(() => {
    const backButton = () => {
      if (canGoBack && webViewRef.current) {
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
  }, [canGoBack]);

  useEffect(() => {
    const loadStoredData = async () => {
      try {
        const token = await AsyncStorage.getItem('REFRESH_TOKEN');
        const locale = await AsyncStorage.getItem('NEXT_LOCALE');
        setStoredToken(token);
        setStoredLocale(locale);
      } catch (error) {
        console.error('Failed to load token:', error);
      } finally {
        setIsTokenLoaded(true);
      }
    };

    loadStoredData();
  }, []);

  const cookieInjectionJS = useMemo(() => {
    if (!storedToken) return undefined;

    return `
      document.cookie = "REFRESH_TOKEN=${storedToken}; path=/; domain=.xmobile.com.tm; max-age=604800; Secure; SameSite=Lax";
      ${
        storedLocale
          ? `document.cookie = "NEXT_LOCALE=${storedLocale}; path=/; domain=.xmobile.com.tm; max-age=604800; Secure; SameSite=Lax";`
          : ''
      }
      true;
    `;
  }, [storedToken, storedLocale]);

  if (storedToken === null && !isTokenLoaded) {
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
        ref={webViewRef}
        source={{ uri: 'https://xmobile.com.tm' }}
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
              }
              if (NEXT_LOCALE) {
                await AsyncStorage.setItem('NEXT_LOCALE', NEXT_LOCALE);
                setStoredLocale(NEXT_LOCALE);
              }
            } else if (data.type === 'LOGOUT') {
              await AsyncStorage.removeItem('REFRESH_TOKEN');
              await AsyncStorage.removeItem('NEXT_LOCALE');
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
