import AsyncStorage from '@react-native-async-storage/async-storage';
import { initLogRocket, shutdownLogRocket } from '@/lib/logrocket';

const TELEMETRY_CONSENT_KEY = 'hayna.telemetry-consent.v1';

/** Analytics/session replay is opt-in. Missing or unreadable consent is treated as denied. */
export async function getTelemetryConsent(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(TELEMETRY_CONSENT_KEY)) === 'granted';
  } catch {
    return false;
  }
}

/** Persist the choice and immediately apply it to the optional diagnostics SDK. */
export async function setTelemetryConsent(granted: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(TELEMETRY_CONSENT_KEY, granted ? 'granted' : 'denied');
  } finally {
    if (granted) initLogRocket();
    else shutdownLogRocket();
  }
}
