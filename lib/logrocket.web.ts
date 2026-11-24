import LogRocket from 'logrocket';

const LOGROCKET_APP_ID = '6aeahy/hyana';
let initialized = false;
let consentEnabled = false;

function originOnly(url: string): string | null {
  try {
    return new URL(url, window.location.href).origin;
  } catch {
    return null;
  }
}

/** Starts session replay only after the user explicitly opts in. */
export function initLogRocket() {
  consentEnabled = true;
  if (initialized) {
    LogRocket.startNewSession();
    return;
  }
  LogRocket.init(LOGROCKET_APP_ID, {
    shouldSendData: () => consentEnabled,
    dom: {
      textSanitizer: true,
      inputSanitizer: true,
      imageSanitizer: true,
    },
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

/** Prevents further session data from being sent after consent is withdrawn. */
export function shutdownLogRocket() {
  consentEnabled = false;
  if (initialized) LogRocket.startNewSession();
}
