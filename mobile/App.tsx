/**
 * XMobile React Native App
 * WebView wrapper for XMobile ecommerce web app
 *
 * @format
 */

import React from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import WebAppScreen from './src/screens/WebAppScreen';

/**
 * Owns safe-area padding and bar styling for every screen in the app.
 *
 * WebAppScreen returns early for the loading and onboarding states, so inset
 * handling that lives inside it is skipped on those paths -- that is how the
 * onboarding screen ended up drawing under the status bar. Padding here, above
 * the first conditional return, makes it impossible for a new pre-webview
 * screen to miss it.
 */
function AppFrame() {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.frame,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
    >
      {/*
        Always dark-on-light. The WebView renders the light web app whatever the
        OS theme is, so following useColorScheme() here painted white status bar
        icons onto a white page in dark mode.
      */}
      <StatusBar barStyle="dark-content" />
      <WebAppScreen />
    </View>
  );
}

function App() {
  return (
    <SafeAreaProvider>
      <AppFrame />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  // Fills the inset gutters behind the system bars, which are transparent
  // under Android's edge-to-edge enforcement.
  frame: { flex: 1, backgroundColor: '#ffffff' },
});

export default App;
