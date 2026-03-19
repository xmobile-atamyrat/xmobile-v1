/**
 * @format
 */

import messaging from '@react-native-firebase/messaging';
import { AppRegistry, Platform } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

/**
 * Create the notification channel for Android 8+ (API 26+).
 * Without this, notifications may not appear as heads-up / pop-ups.
 * The channelId MUST match the one sent from the server in fcmService.ts
 * and declared in AndroidManifest.xml as default_notification_channel_id.
 */
if (Platform.OS === 'android') {
  messaging()
    .android.createChannel({
      channelId: 'xmobile_notifications',
      channelName: 'XMobile Notifications',
      importance: 4, // HIGH — enables heads-up display
      vibration: true,
      sound: 'default',
    })
    .then(created => {
      if (created) {
        console.log('[FCM] Notification channel created');
      }
    })
    .catch(error => {
      console.error('[FCM] Failed to create notification channel:', error);
    });
}

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
