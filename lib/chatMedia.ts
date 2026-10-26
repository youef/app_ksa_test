export type ChatImage = { type: 'image'; storage_path?: string; url?: string; name?: string };

export function parseChatImage(body: string): ChatImage | null {
  try {
    const value = JSON.parse(body);
    if (value?.type !== 'image' || (typeof value.storage_path !== 'string' && typeof value.url !== 'string')) return null;
    return value;
  } catch { return null; }
}

export function chatImagePath(image: ChatImage): string | null {
  let path = image.storage_path;
  if (!path && image.url) {
    const marker = '/storage/v1/object/public/chat-media/';
    const index = image.url.indexOf(marker);
    if (index >= 0) {
      try { path = decodeURIComponent(image.url.slice(index + marker.length).split('?')[0]); }
      catch { return null; }
    }
  }
  if (!path || path.split('/').some(part => !part || part === '.' || part === '..') || path.includes('\\')) return null;
  return path;
}
