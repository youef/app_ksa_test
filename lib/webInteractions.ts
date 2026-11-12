export const WEB_VIEWPORT = 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';

const textFields = 'textarea, input:not([type]), input:is([type="text"], [type="search"], [type="email"], [type="url"], [type="tel"], [type="password"], [type="number"]), [contenteditable="true"], [contenteditable="plaintext-only"]';

export const WEB_INTERACTION_STYLES = `
  html { touch-action: pan-x pan-y; -webkit-text-size-adjust: 100%; }
  body, body * {
    -webkit-user-select: none !important;
    user-select: none !important;
    -webkit-touch-callout: none;
  }
  :is(${textFields}), :is(${textFields}) * {
    -webkit-user-select: text !important;
    user-select: text !important;
    -webkit-touch-callout: default;
  }
  img, svg { -webkit-user-drag: none; }
`;

export function installWebInteractions() {
  const existingViewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  const viewport = existingViewport ?? document.createElement('meta');
  const previousContent = viewport.content;
  viewport.name = 'viewport';
  viewport.content = WEB_VIEWPORT;
  if (!existingViewport) document.head.append(viewport);

  const fieldOf = (target: EventTarget | null) =>
    target instanceof Element ? target.closest(textFields) : null;
  const restrictCopy = (event: Event) => {
    const field = fieldOf(event.target);
    if (!field) {
      event.preventDefault();
      return;
    }
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed &&
        (!field.contains(selection.anchorNode) || !field.contains(selection.focusNode))) {
      event.preventDefault();
    }
  };
  const restrictOutsideFields = (event: Event) => {
    if (!fieldOf(event.target)) event.preventDefault();
  };
  const stopZoomShortcut = (event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) &&
        ['+', '=', '-', '_', '0', 'Add', 'Subtract'].includes(event.key)) event.preventDefault();
  };
  const stopWheelZoom = (event: WheelEvent) => {
    if (event.ctrlKey || event.metaKey) event.preventDefault();
  };
  const stopGestureZoom = (event: Event) => event.preventDefault();
  const stopPinch = (event: TouchEvent) => {
    if (event.touches.length > 1) event.preventDefault();
  };

  const listeners = new AbortController();
  const options = { signal: listeners.signal, capture: true, passive: false };
  document.addEventListener('copy', restrictCopy, options);
  document.addEventListener('cut', restrictCopy, options);
  document.addEventListener('contextmenu', restrictOutsideFields, options);
  document.addEventListener('dragstart', restrictOutsideFields, options);
  window.addEventListener('keydown', stopZoomShortcut, options);
  window.addEventListener('wheel', stopWheelZoom, options);
  window.addEventListener('touchmove', stopPinch, options);
  window.addEventListener('gesturestart', stopGestureZoom, options);
  window.addEventListener('gesturechange', stopGestureZoom, options);
  return () => {
    listeners.abort();
    if (existingViewport) viewport.content = previousContent;
    else viewport.remove();
  };
}
