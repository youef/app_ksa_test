import LogRocket from '@logrocket/react-native';

const LOGROCKET_APP_ID = '6aeahy/hyana';
let initialized = false;
let consentEnabled = false;

function originOnly(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** Starts session replay only after the user explicitly opts in. */
export function initLogRocket() {
  consentEnabled = true;
  if (initialized) {
    void LogRocket.startNewSession();
    return;
  }
  LogRocket.init(LOGROCKET_APP_ID, {
    textSanitizer: 'excluded',
    captureRedactedViewTouches: false,
    network: {
      requestSanitizer: request => {
        const url = originOnly(request.url);
        if (!url) return null;
        return { ...request, url, headers: {}, body: null };
      },
      responseSanitizer: response => ({ ...response, headers: {}, body: null }),
    },
    console: {
      isEnabled: { log: false, info: false, debug: false, warn: true, error: true },
      shouldAggregateConsoleErrors: true,
    },
  });
  initialized = true;
}

/** Stops future capture when consent is withdrawn. */
export function shutdownLogRocket() {
  consentEnabled = false;
  if (initialized) {
    void LogRocket.shutdown().catch(() => {});
  }
}
