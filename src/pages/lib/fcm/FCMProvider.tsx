import { useUserContext } from '@/pages/lib/UserContext';
import { ReactNode, useEffect } from 'react';
import { useFCM } from './useFCM';

/**
 * FCM Provider component
 * Initializes FCM when user is logged in
 * Handles token registration and permission requests
 */
export function FCMProvider({ children }: { children: ReactNode }) {
  const { user, accessToken } = useUserContext();
  const { isInitialized, hasPermission, permissionStatus, registerToken } =
    useFCM();

  // Request permission if user is logged in and permission is not granted
  useEffect(() => {
    if (
      user &&
      accessToken &&
      isInitialized &&
      !hasPermission &&
      permissionStatus === 'default'
    ) {
      // Don't auto-request permission, let user do it manually
      // Or you can auto-request here if desired
      // requestPermission().catch(console.error);
    }
  }, [user, accessToken, isInitialized, hasPermission, permissionStatus]);

  // Register token when user logs in and has permission
  useEffect(() => {
    if (user && accessToken && hasPermission && isInitialized) {
      registerToken().catch(console.error);
    }
  }, [user, accessToken, hasPermission, isInitialized, registerToken]);

  return <>{children}</>;
}
