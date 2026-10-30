import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Expo Router single-output exports use a default index.html, not app/+html.tsx.
export function ensureHaynaWebMetadata(source) {
  if (!/<html\b[^>]*>/i.test(source) || !/<\/head\s*>/i.test(source)) {
    throw new Error('Invalid Expo web export: missing html/head tags');
  }
  let html = source.replace(/<html\b[^>]*>/i, tag => {
    const withoutLang = tag.replace(/\s+lang\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i, '');
    return withoutLang.replace(/>$/, ' lang="ar">');
  });
  const required = [
    [/<meta\s+name=["']description["']/i, '<meta name="description" content="منصة حيّنا المجتمعية للتواصل، الفزعة، سوق الحي، ودليل الخدمات في المملكة العربية السعودية." />'],
    [/<link\s+rel=["']manifest["']/i, '<link rel="manifest" href="/manifest.json" />'],
    [/<meta\s+name=["']theme-color["']/i, '<meta name="theme-color" content="#059669" />'],
    [/<meta\s+name=["']apple-mobile-web-app-capable["']/i, '<meta name="apple-mobile-web-app-capable" content="yes" />'],
    [/<meta\s+name=["']apple-mobile-web-app-status-bar-style["']/i, '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />'],
    [/<meta\s+name=["']apple-mobile-web-app-title["']/i, '<meta name="apple-mobile-web-app-title" content="حيّنا" />'],
    [/<link\s+rel=["']apple-touch-icon["']/i, '<link rel="apple-touch-icon" href="/brand/HAYNA_LOGO.png" />'],
  ];
  const missing = required.filter(([regex]) => !regex.test(html)).map(([, tag]) => tag);
  if (missing.length) html = html.replace(/<\/head\s*>/i, missing.join('\n') + '\n</head>');
  return html;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = resolve('dist/index.html');
  if (!existsSync(resolve('public/manifest.json'))) throw new Error('Missing public/manifest.json');
  const before = readFileSync(target, 'utf8');
  const after = ensureHaynaWebMetadata(before);
  if (after !== before) writeFileSync(target, after);
  console.log('Verified Hayna Arabic language and PWA metadata in dist/index.html');
}
