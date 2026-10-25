import { OASIS } from '@/lib/oasis';
import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * This file is web-only and used to configure the root HTML for every web page during static export.
 * The <head> elements defined here provide critical PWA and iOS Web Push support.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <style>{`
          html, body { width: 100%; min-height: 100%; -webkit-text-size-adjust: 100%; }
          input, textarea, select { font-size: 16px !important; }
          input:focus, textarea:focus, select:focus { font-size: 16px !important; }
        `}</style>

        <title>حيّنا | مجتمع وسوق وخدمات الحي</title>
        <meta name="description" content="منصة حيّنا المجتمعية للتواصل، الفزعة، سوق الحي، ودليل الخدمات في المملكة العربية السعودية." />

        {/* PWA / Web Manifest */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content={OASIS.colors.deep} />

        {/* Apple iOS Web App & Push Notification Requirements */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="حيّنا" />
        <link rel="apple-touch-icon" href="/brand/HAYNA_LOGO.png" />
        <link rel="icon" type="image/png" href="/brand/HAYNA_LOGO.png" />

        {/* Disable body scrolling when using ScrollView */}
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
