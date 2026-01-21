/**
 * XMobile React Native App
 * WebView wrapper for XMobile ecommerce web app
 *
 * @format
 */

import React from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import WebAppScreen from './src/screens/WebAppScreen';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <WebAppScreen />
    </SafeAreaProvider>
  );
}

export default App;
