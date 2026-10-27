import { Platform } from 'react-native';
import { supabase } from './supabase';

export type UploadStrategy = 'bucket' | 'base64' | 'local';
export interface UploadResult { url: string; strategy: UploadStrategy; bucket?: string; error?: string; }
const BUCKET = 'story-media';
const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

async function optimizeForWeb(blob: Blob): Promise<Blob> {
  if (Platform.OS !== 'web' || typeof document === 'undefined' || typeof createImageBitmap !== 'function') return blob;
  const bitmap = await createImageBitmap(blob);
  try {
    const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('تعذر تجهيز الصورة');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.8, 0.65, 0.5]) {
      const output = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', quality));
      if (output && output.type === 'image/webp' && output.size <= MAX_UPLOAD_BYTES) return output;
    }
    throw new Error('الصورة كبيرة جدًا بعد الضغط. اختر صورة أصغر.');
  } finally { bitmap.close(); }
}

export async function uploadStoryImage(options: {
  uri: string; base64?: string | null; userId: string; index: number;
}): Promise<UploadResult> {
  const response = await fetch(options.uri);
  if (!response.ok) throw new Error('تعذر قراءة الصورة');
  const source = await response.blob();
  if (source.size > MAX_SOURCE_BYTES) throw new Error('الصورة الأصلية أكبر من 12 ميجابايت');
  const optimized = await optimizeForWeb(source);
  if (optimized.size > MAX_UPLOAD_BYTES) throw new Error('الصورة أكبر من 2 ميجابايت بعد المعالجة');
  const isWebp = optimized.type === 'image/webp';
  const isPng = optimized.type === 'image/png';
  const mime = isWebp ? 'image/webp' : isPng ? 'image/png' : 'image/jpeg';
  if (!isWebp && !isPng && !['image/jpeg', 'image/jpg'].includes(optimized.type)) {
    throw new Error('صيغة الصورة غير مدعومة. استخدم JPEG أو WebP.');
  }
  const path = `${options.userId}/${Date.now()}-${options.index}-${Math.random().toString(36).slice(2, 10)}.${isWebp ? 'webp' : isPng ? 'png' : 'jpg'}`;
  const bytes = await optimized.arrayBuffer();
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: mime, cacheControl: '3600', upsert: false,
  });
  if (error) throw new Error(`تعذر رفع الصورة: ${error.message}`);
  return { url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl, strategy: 'bucket', bucket: BUCKET };
}
