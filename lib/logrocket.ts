import LogRocket from '@logrocket/react-native';

let initialized = false;

/** Initialize session replay only when an app-specific project ID is configured. */
export function initLogRocket() {
  const appId = process.env.EXPO_PUBLIC_LOGROCKET_APP_ID;
  if (initialized || !appId) return;
  try {
    LogRocket.init(appId);
    initialized = true;
  } catch (error) {
    if (__DEV__) console.warn('LogRocket initialization skipped:', error);
  }
}
