/**
 * Web-only Google Maps JavaScript API loader.
 * Loaded once per document; the key can be overridden with EXPO_PUBLIC_GOOGLE_MAPS_API_KEY.
 */

export const GOOGLE_MAPS_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  'AIzaSyD3dbOJXEPgG1qyNi4Z_sLO46kj6c5bnY8';

const SCRIPT_ID = 'hayna-google-maps-js';

let pending: Promise<any> | null = null;

export function loadGoogleMaps(timeoutMs = 15000): Promise<any> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('خرائط جوجل تعمل على الويب فقط.'));
  }

  const scope = window as any;
  if (scope.google?.maps) return Promise.resolve(scope.google.maps);
  if (pending) return pending;

  pending = new Promise<any>((resolve, reject) => {
    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.async = true;
      script.defer = true;
      script.src =
        `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}` +
        '&libraries=marker&v=weekly&language=ar&region=SA';
      document.head.appendChild(script);
    }

    const startedAt = Date.now();
    const poll = () => {
      if (scope.google?.maps) {
        resolve(scope.google.maps);
        return;
      }
      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error('انتهت مهلة تحميل خرائط جوجل.'));
        return;
      }
      setTimeout(poll, 120);
    };

    script.addEventListener('load', poll);
    script.addEventListener('error', () =>
      reject(new Error('تعذّر تحميل خرائط جوجل. تحقق من مفتاح الـ API.')),
    );
    poll();
  }).catch((error) => {
    pending = null;
    throw error;
  });

  return pending;
}

/** Pin graphic used by both the advanced and the legacy marker implementations. */
export function pinSvg(color: string, emoji: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="52" viewBox="0 0 40 52">
    <filter id="s" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="2" stdDeviation="2.4" flood-color="rgba(15,23,42,0.35)" />
    </filter>
    <path filter="url(#s)" fill="${color}" stroke="#ffffff" stroke-width="2.2"
      d="M20 1.6c-9.6 0-17.4 7.6-17.4 17 0 12.3 15.3 29.9 16.2 31.1a1.7 1.7 0 0 0 2.4 0c.9-1.2 16.2-18.8 16.2-31.1 0-9.4-7.8-17-17.4-17z"/>
    <circle cx="20" cy="18.4" r="9.6" fill="#ffffff" />
    <text x="20" y="23.4" font-size="13" font-weight="700" text-anchor="middle"
      font-family="Segoe UI, Tahoma, sans-serif" fill="${color}">${emoji}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

/** DOM node used as AdvancedMarkerElement content. */
export function pinElement(color: string, emoji: string, urgent: boolean): HTMLElement {
  const root = document.createElement('div');
  root.style.cssText = 'position:relative;width:40px;height:52px;';

  const halo = document.createElement('div');
  halo.style.cssText = [
    'position:absolute',
    'left:50%',
    'top:16px',
    'width:34px',
    'height:34px',
    'margin-left:-17px',
    'border-radius:50%',
    'background:rgba(5,150,105,0.18)',
  ].join(';');
  root.appendChild(halo);

  if (urgent) {
    const pulse = document.createElement('div');
    pulse.style.cssText = [
      'position:absolute',
      'left:50%',
      'top:16px',
      'width:34px',
      'height:34px',
      'margin-left:-17px',
      'border-radius:50%',
      'border:2px solid ' + color,
      'animation:hayna-pulse 1.8s ease-out infinite',
    ].join(';');
    root.appendChild(pulse);
  }

  const img = document.createElement('img');
  img.src = pinSvg(color, emoji);
  img.width = 40;
  img.height = 52;
  img.style.cssText = 'position:absolute;inset:0;';
  root.appendChild(img);

  if (!document.getElementById('hayna-pin-keyframes')) {
    const style = document.createElement('style');
    style.id = 'hayna-pin-keyframes';
    style.textContent =
      '@keyframes hayna-pulse{0%{transform:scale(1);opacity:.85}100%{transform:scale(2.1);opacity:0}}';
    document.head.appendChild(style);
  }

  return root;
}