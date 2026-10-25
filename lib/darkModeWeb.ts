/**
 * Runtime dark-mode fixer for react-native-web.
 *
 * React Native Web compiles `StyleSheet.create` styles into generated atomic
 * classes (`.r-color-…`, `.r-backgroundColor-…`).  Those styles never appear
 * in the `style=""` attribute, so the attribute selectors that used to live in
 * `<Head>` could not override them and screens stayed half-light (white cards,
 * dark ink, grey muted text).
 *
 * This module patches the rendered DOM instead:
 *   • light surface / border declarations (class based or inline) are remapped
 *     to dark tints, and
 *   • every text element that sits on a dark surface is tagged with
 *     `data-hayna-dark-text`, which forces its colour to pure white.
 *
 * A MutationObserver keeps the result correct for lazily rendered screens and
 * for route changes.  Everything is removed again when light mode is selected.
 */

const STYLE_ID = 'hayna-dark-mode-runtime';
const TEXT_ATTR = 'data-hayna-dark-text';

type Rgba = { r: number; g: number; b: number; a: number };

const PAGE_BG = '#0F0F10';
const DARK_BORDER = '#2C2C2E';

const BORDER_PROPS = [
  'border-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'border-block-color',
  'border-inline-color',
];

// ─── colour helpers ─────────────────────────────────────────────────────────

function parseColor(value: string | null | undefined): Rgba | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (!v || v === 'inherit' || v === 'initial' || v === 'unset' || v === 'currentcolor') return null;
  if (v === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  if (v === 'white') return { r: 255, g: 255, b: 255, a: 1 };
  if (v === 'black') return { r: 0, g: 0, b: 0, a: 1 };

  const hex = /^#([0-9a-f]{3,8})$/.exec(v);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
    };
  }

  const alpha = (raw: string | undefined) => {
    if (!raw) return 1;
    return raw.endsWith('%') ? Number.parseFloat(raw) / 100 : Number.parseFloat(raw);
  };

  const rgb = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)$/.exec(v);
  if (rgb) {
    return { r: +rgb[1], g: +rgb[2], b: +rgb[3], a: alpha(rgb[4]) };
  }

  const hsl = /^hsla?\(\s*([\d.]+)(?:deg)?[,\s]+([\d.]+)%[,\s]+([\d.]+)%(?:[,\s/]+([\d.]+%?))?\s*\)$/.exec(v);
  if (hsl) {
    const { r, g, b } = hslToRgb(+hsl[1], +hsl[2] / 100, +hsl[3] / 100);
    return { r, g, b, a: alpha(hsl[4]) };
  }

  return null;
}

function rgbToHsl(r: number, g: number, b: number) {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rr) h = (gg - bb) / d + (gg < bb ? 6 : 0);
  else if (max === gg) h = (bb - rr) / d + 2;
  else h = (rr - gg) / d + 4;
  return { h: h * 60, s, l };
}

function hslToRgb(h: number, s: number, l: number) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
}

function channelLuminance(channel: number) {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance({ r, g, b }: Rgba) {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

function formatRgba({ r, g, b, a }: Rgba) {
  const alpha = Math.round(a * 1000) / 1000;
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;
}

function parsePageBackground() {
  return parseColor(PAGE_BG) || { r: 15, g: 15, b: 16, a: 1 };
}

/**
 * Light surfaces become dark, hue-preserving tints.  Saturated bright accents
 * (primary buttons, gold actions) keep their colour because they are still
 * readable with dark text.
 */
function transformBackground(value: string | null | undefined): string | null {
  const color = parseColor(value);
  if (!color || color.a <= 0.02) return null;
  if (luminance(color) <= 0.55) return null;
  const { h, s } = rgbToHsl(color.r, color.g, color.b);
  const rgb = hslToRgb(h, Math.min(s, 0.16), 0.12);
  return formatRgba({ ...rgb, a: color.a });
}

function transformBorder(value: string | null | undefined): string | null {
  const color = parseColor(value);
  if (!color || color.a <= 0.02) return null;
  if (luminance(color) <= 0.5) return null;
  return DARK_BORDER;
}

// ─── stylesheet generation ──────────────────────────────────────────────────

function cssRuleOverrides(): string[] {
  const rules: string[] = [];
  const sheets = Array.from(document.styleSheets);
  for (const sheet of sheets) {
    const owner = sheet.ownerNode as HTMLElement | null;
    if (owner && owner.id === STYLE_ID) continue;
    let list: CSSRuleList;
    try {
      list = sheet.cssRules;
    } catch {
      continue;
    }
    for (let i = 0; i < list.length; i += 1) {
      const rule = list[i] as CSSStyleRule;
      if (!rule || !rule.selectorText || !rule.style) continue;
      const selector = rule.selectorText;
      const background = transformBackground(rule.style.getPropertyValue('background-color'));
      if (background) rules.push(`${selector}{background-color:${background} !important;}`);
      for (const prop of BORDER_PROPS) {
        const border = transformBorder(rule.style.getPropertyValue(prop));
        if (border) rules.push(`${selector}{${prop}:${border} !important;}`);
      }
    }
  }
  return rules;
}

function styleAttributeVariants(prop: string, value: string) {
  const compact = value.replace(/,\s+/g, ',');
  return new Set([
    `[style*="${prop}: ${value}"]`,
    `[style*="${prop}:${value}"]`,
    `[style*="${prop}: ${compact}"]`,
    `[style*="${prop}:${compact}"]`,
  ]);
}

/**
 * Inline styles are not part of RNW's atomic sheet, so collect the values that
 * actually occur in the DOM and generate matching attribute selectors.
 */
function inlineOverrides(root: ParentNode): string[] {
  const rules: string[] = [];
  const seen = new Set<string>();
  const nodes = root.querySelectorAll<HTMLElement>('[style]');
  for (let i = 0; i < nodes.length; i += 1) {
    const raw = nodes[i].getAttribute('style');
    if (!raw) continue;
    const declarations = raw.split(';');
    for (const declaration of declarations) {
      const colon = declaration.indexOf(':');
      if (colon < 1) continue;
      const prop = declaration.slice(0, colon).trim().toLowerCase();
      const value = declaration.slice(colon + 1).trim();
      if (!value) continue;
      if (prop === 'background-color' || prop === 'background') {
        if (prop === 'background' && /url\(|gradient\(/i.test(value)) continue;
        const next = transformBackground(value);
        if (!next) continue;
        for (const selector of styleAttributeVariants(prop, value)) {
          const rule = `${selector}{${prop}:${next} !important;}`;
          if (!seen.has(rule)) {
            seen.add(rule);
            rules.push(rule);
          }
        }
      } else if (BORDER_PROPS.includes(prop)) {
        const next = transformBorder(value);
        if (!next) continue;
        for (const selector of styleAttributeVariants(prop, value)) {
          const rule = `${selector}{${prop}:${next} !important;}`;
          if (!seen.has(rule)) {
            seen.add(rule);
            rules.push(rule);
          }
        }
      }
    }
  }
  return rules;
}

// ─── per-element text colouring ─────────────────────────────────────────────

function hasDirectText(el: HTMLElement) {
  const children = el.childNodes;
  for (let i = 0; i < children.length; i += 1) {
    const node = children[i];
    if (node.nodeType === 3 && (node.textContent || '').trim().length > 0) return true;
  }
  return false;
}

function isSkipped(el: HTMLElement) {
  if (el.closest('svg, iframe, .leaflet-container, .gm-style')) return true;
  const tag = el.tagName;
  return tag === 'IMG' || tag === 'VIDEO' || tag === 'CANVAS' || tag === 'SCRIPT' || tag === 'STYLE';
}

function backgroundLuminance(el: HTMLElement): number | null {
  const layers: Rgba[] = [];
  let node: HTMLElement | null = el;
  while (node) {
    const computed = getComputedStyle(node);
    if (computed.backgroundImage && computed.backgroundImage !== 'none') return null;
    const color = parseColor(computed.backgroundColor);
    if (color && color.a > 0.01) {
      layers.push(color);
      if (color.a >= 0.99) break;
    }
    node = node.parentElement;
  }

  let base: Rgba = layers.length ? layers[layers.length - 1] : parsePageBackground();
  let r = base.r;
  let g = base.g;
  let b = base.b;
  let a = base.a;
  for (let i = layers.length - 2; i >= 0; i -= 1) {
    const top = layers[i];
    const outAlpha = top.a + a * (1 - top.a);
    r = outAlpha ? (top.r * top.a + r * a * (1 - top.a)) / outAlpha : 0;
    g = outAlpha ? (top.g * top.a + g * a * (1 - top.a)) / outAlpha : 0;
    b = outAlpha ? (top.b * top.a + b * a * (1 - top.a)) / outAlpha : 0;
    a = outAlpha;
  }
  if (a < 0.99) {
    const page = parsePageBackground();
    r = r * a + page.r * (1 - a);
    g = g * a + page.g * (1 - a);
    b = b * a + page.b * (1 - a);
  }
  return luminance({ r, g, b, a: 1 });
}

function updateTextColors(root: ParentNode) {
  const nodes = root.querySelectorAll<HTMLElement>('*');
  for (let i = 0; i < nodes.length; i += 1) {
    const el = nodes[i];
    if (isSkipped(el)) continue;
    if (!hasDirectText(el)) {
      if (el.hasAttribute(TEXT_ATTR)) el.removeAttribute(TEXT_ATTR);
      continue;
    }
    const background = backgroundLuminance(el);
    if (background != null && background < 0.3) el.setAttribute(TEXT_ATTR, '1');
    else if (el.hasAttribute(TEXT_ATTR)) el.removeAttribute(TEXT_ATTR);
  }
}

// ─── runtime ────────────────────────────────────────────────────────────────

let animationFrame = 0;
let observer: MutationObserver | null = null;
let styleElement: HTMLStyleElement | null = null;

function buildCss() {
  const root = document.getElementById('root') || document.body;
  const parts = [
    `[${TEXT_ATTR}="1"], [${TEXT_ATTR}="1"] * { color: #FFFFFF !important; }`,
    `[${TEXT_ATTR}="1"]::placeholder { color: rgba(255, 255, 255, 0.62) !important; }`,
    `input, textarea, select { color: #FFFFFF !important; caret-color: #34D399 !important; }`,
    `input::placeholder, textarea::placeholder { color: rgba(255, 255, 255, 0.62) !important; }`,
    '::-webkit-scrollbar-track { background: #1C1C1E; }',
    '::-webkit-scrollbar-thumb { background: #3A3A3C; border-radius: 3px; }',
    ...cssRuleOverrides(),
    ...inlineOverrides(root),
  ];
  return parts.join('\n');
}

function flush() {
  animationFrame = 0;
  if (!styleElement) return;
  const css = buildCss();
  if (styleElement.textContent !== css) styleElement.textContent = css;
  updateTextColors(document.getElementById('root') || document.body);
}

function schedule() {
  if (animationFrame) return;
  animationFrame = window.requestAnimationFrame(flush);
}

export function installDarkModeWebFixes(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};

  document.documentElement.classList.add('dark');
  document.documentElement.setAttribute('data-theme', 'dark');
  document.documentElement.style.colorScheme = 'dark';
  document.body.style.backgroundColor = PAGE_BG;

  styleElement = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = STYLE_ID;
    document.head.appendChild(styleElement);
  }

  flush();

  observer = new MutationObserver(schedule);
  observer.observe(document.getElementById('root') || document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
  });

  return () => {
    observer?.disconnect();
    observer = null;
    if (animationFrame) {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    }
    styleElement?.remove();
    styleElement = null;
    document.querySelectorAll(`[${TEXT_ATTR}]`).forEach((node) => node.removeAttribute(TEXT_ATTR));
    document.documentElement.classList.remove('dark');
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.style.colorScheme = 'light';
    document.body.style.backgroundColor = '#F2F2F7';
  };
}
