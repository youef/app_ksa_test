import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';

export const SERVICE_IMAGES_BUCKET = 'service-images';
export const MAX_SERVICE_IMAGES = 5;

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64ToBytes(b64: string) {
  const clean = b64.replace(/[^A-Za-z0-9+/=]/g, '');
  const pad = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4) - pad);
  let buffer = 0, bits = 0, index = 0;
  for (const ch of clean) {
    if (ch === '=') break;
    buffer = (buffer << 6) | B64.indexOf(ch);
    bits += 6;
    if (bits >= 8) { bits -= 8; bytes[index++] = (buffer >> bits) & 255; }
  }
  return bytes;
}

/** Picked locally, not uploaded yet */
export type LocalServiceImage = { uri: string; base64?: string | null; mimeType?: string | null; remoteUrl?: string };

export async function pickServiceImages(remaining: number, fromCamera = false): Promise<LocalServiceImage[]> {
  if (remaining <= 0) return [];
  const opts: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.6, // compress before upload
    base64: true,
  };
  let result: ImagePicker.ImagePickerResult;
  if (fromCamera) {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('اسمح للتطبيق باستخدام الكاميرا.');
    result = await ImagePicker.launchCameraAsync(opts);
  } else {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) throw new Error('اسمح للتطبيق بالوصول إلى الصور.');
    result = await ImagePicker.launchImageLibraryAsync({ ...opts, allowsMultipleSelection: true, selectionLimit: remaining });
  }
  if (result.canceled || !result.assets?.length) return [];
  return result.assets.slice(0, remaining).map((a) => ({ uri: a.uri, base64: a.base64, mimeType: a.mimeType }));
}

async function toBytes(img: LocalServiceImage): Promise<Uint8Array | ArrayBuffer> {
  if (img.base64) return base64ToBytes(img.base64);
  const res = await fetch(img.uri);
  return res.arrayBuffer();
}

export async function uploadServiceImages(userId: string, images: LocalServiceImage[]): Promise<string[]> {
  const urls: string[] = [];
  for (const img of images) {
    if (img.remoteUrl) { urls.push(img.remoteUrl); continue; }
    const mime = img.mimeType || 'image/jpeg';
    const ext = (mime.split('/')[1] || 'jpg').replace('jpeg', 'jpg').replace(/[^a-z0-9]/gi, '');
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const body = await toBytes(img);
    const { error } = await supabase.storage.from(SERVICE_IMAGES_BUCKET).upload(path, body, {
      contentType: mime, cacheControl: '31536000', upsert: false,
    });
    if (error) throw error;
    urls.push(supabase.storage.from(SERVICE_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl);
  }
  return urls;
}
