export const BACKGROUND_BUCKET = 'branding';
export const BACKGROUND_CONFIG_KEY = 'page_backgrounds';
export const MAX_BACKGROUND_BYTES = 5 * 1024 * 1024;
export const BACKGROUND_SLOTS = ['welcome', 'login', 'app'] as const;
export type BackgroundSlot = typeof BACKGROUND_SLOTS[number];
export type PageBackground = { path: string | null; lightOpacity: number; darkOpacity: number };
export type PageBackgrounds = Record<BackgroundSlot, PageBackground>;
export const DEFAULT_PAGE_BACKGROUNDS: PageBackgrounds = {
  welcome: { path: null, lightOpacity: 1, darkOpacity: 1 },
  login: { path: null, lightOpacity: 0.32, darkOpacity: 0.32 },
  app: { path: null, lightOpacity: 0.27, darkOpacity: 0.16 },
};

export function isBackgroundPath(path: unknown): path is string {
  return typeof path === 'string' && /^backgrounds\/[a-zA-Z0-9_-]+\.(?:png|jpe?g|webp|gif)$/.test(path);
}

export function parsePageBackgrounds(value: unknown): PageBackgrounds {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return Object.fromEntries(BACKGROUND_SLOTS.map(slot => {
    const fallback = DEFAULT_PAGE_BACKGROUNDS[slot];
    const entry = source[slot] && typeof source[slot] === 'object' ? source[slot] as Record<string, unknown> : {};
    const opacity = (v: unknown, defaultValue: number) => typeof v === 'number' && Number.isFinite(v) && v >= 0.05 && v <= 1 ? v : defaultValue;
    return [slot, { path: isBackgroundPath(entry.path) ? entry.path : null, lightOpacity: opacity(entry.lightOpacity, fallback.lightOpacity), darkOpacity: opacity(entry.darkOpacity, fallback.darkOpacity) }];
  })) as PageBackgrounds;
}

/** Check actual file signatures rather than trusting the filename or picker MIME. */
export function detectBackgroundImage(bytes: Uint8Array): { mime: string; extension: string } | null {
  if (bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((v, i) => bytes[i] === v)) return { mime: 'image/png', extension: 'png' };
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { mime: 'image/jpeg', extension: 'jpg' };
  const text = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (bytes.length >= 6 && ['GIF87a','GIF89a'].includes(text(0,6))) return { mime: 'image/gif', extension: 'gif' };
  if (bytes.length >= 12 && text(0,4) === 'RIFF' && text(8,12) === 'WEBP') return { mime: 'image/webp', extension: 'webp' };
  return null;
}
