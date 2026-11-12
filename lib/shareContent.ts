import { Linking, Platform, Share } from 'react-native';

export async function shareContent({ title, message, url }: { title?: string; message: string; url?: string }) {
  if (Platform.OS !== 'web') {
    await Share.share({ title, message, url });
    return;
  }

  const text = url && message.endsWith(url) ? message.slice(0, -url.length).trimEnd() : message;
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
    }
  }

  const body = url ? [text, url].filter(Boolean).join('\n') : text;
  await Linking.openURL(`mailto:?subject=${encodeURIComponent(title || 'حيّنا')}&body=${encodeURIComponent(body)}`);
}
