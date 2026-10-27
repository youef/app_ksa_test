import { uploadResumableStory } from './storyTus';
import { Image, Platform } from 'react-native';
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
  // Decode dimensions before network upload; reject malformed and decompression-bomb images.
  const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    Image.getSize(options.uri, (width, height) => resolve({ width, height }), reject);
  }).catch(() => { throw new Error('تعذر قراءة أبعاد الصورة'); });
  if (dimensions.width < 1 || dimensions.height < 1 ||
      dimensions.width > 8000 || dimensions.height > 8000 ||
      dimensions.width * dimensions.height > 32_000_000) {
    throw new Error('أبعاد الصورة غير مسموحة');
  }
  const response = await fetch(options.uri);
  if (!response.ok) throw new Error('تعذر قراءة الصورة');
  const source = await response.blob();
  if (source.size > MAX_SOURCE_BYTES) throw new Error('الصورة الأصلية أكبر من 12 ميجابايت');
  const optimized = await optimizeForWeb(source);
  if (optimized.size > MAX_UPLOAD_BYTES) throw new Error('الصورة أكبر من 2 ميجابايت بعد المعالجة');
  const header = new Uint8Array(await optimized.slice(0, 16).arrayBuffer());
  const jpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  const png = header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47;
  const webp = String.fromCharCode(...header.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...header.slice(8, 12)) === 'WEBP';
  if (!jpeg && !png && !webp) throw new Error('الملف ليس صورة JPEG أو PNG أو WebP صالحة');
  const isWebp = webp;
  const isPng = png;
  const mime = isWebp ? 'image/webp' : isPng ? 'image/png' : 'image/jpeg';
  if (!isWebp && !isPng && !['image/jpeg', 'image/jpg'].includes(optimized.type)) {
    throw new Error('صيغة الصورة غير مدعومة. استخدم JPEG أو WebP.');
  }
  // Stable within the publishing window so a second attempt can resume the same TUS URL.
  const identity = options.uri + ':' + optimized.size + ':' + options.index;
  let hash = 2166136261;
  for (let i = 0; i < identity.length; i++) hash = Math.imul(hash ^ identity.charCodeAt(i), 16777619);
  const path = `${options.userId}/${Math.floor(Date.now() / 10800000)}-${(hash >>> 0).toString(36)}.${isWebp ? 'webp' : isPng ? 'png' : 'jpg'}`;
  await uploadResumableStory({ file: optimized, path, mime });
  return { url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl, strategy: 'bucket', bucket: BUCKET };
}
