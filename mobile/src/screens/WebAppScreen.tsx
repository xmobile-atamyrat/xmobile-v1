import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect } from 'react';
import { ActivityIndicator, BackHandler, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

function WebAppScreen() {
  const insets = useSafeAreaInsets();
  const webViewRef = React.useRef<WebView>(null);
  const injectedJavaScript = `
    (function() {
      const meta = document.createElement('meta');
      meta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
      meta.setAttribute('name', 'viewport');
      document.getElementsByTagName('head')[0].appendChild(meta);
      
      document.addEventListener('gesturestart', (e) => e.preventDefault());
      document.addEventListener('touchmove', (event) => {
        if (event.scale !== 1) event.preventDefault();
      }, { passive: false });
    })();
    
    true;
  `;
  const [storedToken, setStoredToken] = React.useState<string | null>(null);
  const [storedLocale, setStoredLocale] = React.useState<string | null>(null);
  const [isTokenLoaded, setIsTokenLoaded] = React.useState(false);

  useEffect(() => {
    const backButton = () => {
      if (webViewRef.current) {
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
  });

  useEffect(() => {
    const loadStoredData = async () => {
      try {
        const token = await AsyncStorage.getItem('auth_refresh_token');
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

  if (!isTokenLoaded) {
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
        injectedJavaScript={injectedJavaScript}
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        style={styles.webview}
        cacheEnabled={true}
        startInLoadingState={true}
        javaScriptEnabled={true}
        domStorageEnabled={true}
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
        injectedJavaScriptBeforeContentLoaded={
          storedToken || storedLocale
            ? `
        ${
          storedToken
            ? `document.cookie = "refreshToken=${storedToken}; path=/; max-age=31536000";`
            : ''
        }
        ${
          storedLocale
            ? `document.cookie = "NEXT_LOCALE=${storedLocale}; path=/; max-age=31536000";`
            : ''
        }
        true;
      `
            : undefined
        }
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
