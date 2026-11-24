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

/** Persist the choice before enabling optional diagnostics; withdrawal stops capture even if storage fails. */
export async function setTelemetryConsent(granted: boolean): Promise<void> {
  let saved = false;
  try {
    await AsyncStorage.setItem(TELEMETRY_CONSENT_KEY, granted ? 'granted' : 'denied');
    saved = true;
  } finally {
    if (granted && saved) initLogRocket();
    else shutdownLogRocket();
  }
  if (!saved) throw new Error('Unable to save the privacy preference.');
}
