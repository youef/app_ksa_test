import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

/** Supabase TUS 1.0 uploader. Persists the upload URL so interrupted uploads resume. */
export async function uploadResumableStory(input: {
  file: Blob;
  path: string;
  mime: string;
  onProgress?: (percent: number) => void;
}): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('انتهت جلسة تسجيل الدخول');
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!base) throw new Error('إعدادات التخزين غير متوفرة');
  const endpoint = base.replace('.supabase.co', '.storage.supabase.co').replace(/\/$/, '') + '/storage/v1/upload/resumable';
  const key = 'hayna:tus:story-media:' + input.path;
  const headers: Record<string, string> = {
    Authorization: 'Bearer ' + session.access_token,
    'Tus-Resumable': '1.0.0',
  };
  const metadata = (value: string) => {
    const chars = new TextEncoder().encode(value);
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let output = '';
    for (let i = 0; i < chars.length; i += 3) {
      const n = (chars[i] << 16) | ((chars[i + 1] || 0) << 8) | (chars[i + 2] || 0);
      output += alphabet[(n >>> 18) & 63] + alphabet[(n >>> 12) & 63] +
        (i + 1 < chars.length ? alphabet[(n >>> 6) & 63] : '=') +
        (i + 2 < chars.length ? alphabet[n & 63] : '=');
    }
    return output;
  };
  let url = await AsyncStorage.getItem(key);
  let offset = 0;
  if (url) {
    try {
      const head = await fetch(url, { method: 'HEAD', headers });
      if (!head.ok) throw new Error('expired');
      offset = Number(head.headers.get('Upload-Offset'));
      if (!Number.isFinite(offset) || offset < 0 || offset > input.file.size) throw new Error('bad offset');
    } catch {
      url = null;
      await AsyncStorage.removeItem(key);
    }
  }
  if (!url) {
    const created = await fetch(endpoint, {
      method: 'POST',
      headers: {
        ...headers,
        'Upload-Length': String(input.file.size),
        'Upload-Metadata': [
          'bucketName ' + metadata('story-media'),
          'objectName ' + metadata(input.path),
          'contentType ' + metadata(input.mime),
          'cacheControl ' + metadata('3600'),
        ].join(','),
      },
    });
    if (!created.ok) throw new Error('تعذر بدء الرفع القابل للاستكمال (' + created.status + ')');
    const location = created.headers.get('Location');
    if (!location) throw new Error('خادم التخزين لم يرجع رابط استكمال');
    url = new URL(location, endpoint).toString();
    await AsyncStorage.setItem(key, url);
  }
  // Supabase requires 6 MiB TUS chunks; story images are currently capped at 2 MiB.
  const chunkSize = 6 * 1024 * 1024;
  let failures = 0;
  while (offset < input.file.size) {
    try {
      const end = Math.min(offset + chunkSize, input.file.size);
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/offset+octet-stream', 'Upload-Offset': String(offset) },
        body: input.file.slice(offset, end),
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const next = Number(response.headers.get('Upload-Offset'));
      if (!Number.isFinite(next) || next <= offset || next > input.file.size) throw new Error('تقدم الرفع غير صالح');
      offset = next;
      failures = 0;
      input.onProgress?.(Math.round(offset / input.file.size * 100));
    } catch (error) {
      if (++failures >= 4) throw new Error('توقف الرفع؛ يمكن استكماله عند إعادة المحاولة: ' + String(error));
      await new Promise(resolve => setTimeout(resolve, failures * 1000));
      const head = await fetch(url, { method: 'HEAD', headers });
      if (head.ok) {
        const serverOffset = Number(head.headers.get('Upload-Offset'));
        if (Number.isFinite(serverOffset) && serverOffset >= offset && serverOffset <= input.file.size) offset = serverOffset;
      }
    }
  }
  await AsyncStorage.removeItem(key);
  input.onProgress?.(100);
}
