/**
 * @format
 */

import messaging from '@react-native-firebase/messaging';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

/**
 * Register background/quit-state message handler.
 *
 * NOTE: This handler intentionally does NOT call showNotification().
 * When the server sends a message with a `notification` key (title/body),
 * Android automatically displays it as an OS notification — no extra code needed.
 * This handler exists only to satisfy the Firebase SDK requirement and to allow
 * future data-only processing (e.g., badge count updates, silent data sync).
 */
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('[FCM] Background message received:', remoteMessage.messageId);
});

AppRegistry.registerComponent(appName, () => App);
