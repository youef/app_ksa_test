import LogRocket from '@logrocket/react-native';

let initialized = false;

/** Initialize session replay only when called after explicit user consent. */
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

/** Best-effort shutdown for non-platform-specific runtimes. */
export function shutdownLogRocket() {
  if (!initialized) return;
  try {
    // The React Native SDK exposes shutdown as a synchronous void method.
    LogRocket.shutdown();
  } catch {
    // The app remains usable if telemetry shutdown is unavailable.
  }
}
