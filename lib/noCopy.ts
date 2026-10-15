import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * Disables text selection, image dragging and the context menu on web so that
 * stream content and media cannot be copied or saved. Text inputs stay usable.
 */
export function useNoCopy(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    if (Platform.OS !== 'web') return;
    if (typeof document === 'undefined') return;

    const styleId = 'hayna-no-copy';
    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      style.textContent = [
        '*, *::before, *::after {',
        '  -webkit-user-select: none !important;',
        '  -moz-user-select: none !important;',
        '  -ms-user-select: none !important;',
        '  user-select: none !important;',
        '  -webkit-touch-callout: none !important;',
        '}',
        'input, textarea, [contenteditable="true"] {',
        '  -webkit-user-select: text !important;',
        '  user-select: text !important;',
        '}',
        'img { -webkit-user-drag: none !important; }',
      ].join('\n');
      document.head.appendChild(style);
    }

    const isField = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el || !el.tagName) return false;
      return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable === true;
    };
    const block = (event: Event) => {
      if (isField(event.target)) return;
      event.preventDefault();
    };

    document.addEventListener('contextmenu', block);
    document.addEventListener('copy', block);
    document.addEventListener('cut', block);
    document.addEventListener('dragstart', block);

    return () => {
      document.removeEventListener('contextmenu', block);
      document.removeEventListener('copy', block);
      document.removeEventListener('cut', block);
      document.removeEventListener('dragstart', block);
    };
  }, [enabled]);
}
