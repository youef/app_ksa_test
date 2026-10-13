import LogRocket from '@logrocket/react-native';

const LOGROCKET_APP_ID = '6aeahy/hyana';

function originOnly(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function initLogRocket() {
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
}
