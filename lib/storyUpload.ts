import { supabase } from './supabase';

export type UploadStrategy = 'bucket' | 'base64' | 'local';

export interface UploadResult {
  url: string;
  strategy: UploadStrategy;
  bucket?: string;
  error?: string;
}

const BUCKETS = ['stories', 'avatars'] as const;

async function tryBucket(
  bucket: string,
  objectPath: string,
  body: ArrayBuffer,
): Promise<string | null> {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(objectPath, body, { contentType: 'image/jpeg', upsert: true });

  if (error) return null;
  return supabase.storage.from(bucket).getPublicUrl(objectPath).data.publicUrl;
}

export async function uploadStoryImage(options: {
  uri: string;
  base64?: string | null;
  userId: string;
  index: number;
}): Promise<UploadResult> {
  const { uri, base64, userId, index } = options;
  const objectPath = `${userId}/${Date.now()}_${index}.jpg`;
  let lastError = '';

  try {
    const response = await fetch(uri);
    const blob = await response.arrayBuffer();

    for (const bucket of BUCKETS) {
      const path = bucket === 'stories' ? objectPath : `story_${objectPath}`;
      const publicUrl = await tryBucket(bucket, path, blob);
      if (publicUrl) return { url: publicUrl, strategy: 'bucket', bucket };
      lastError = `فشل الرفع إلى حاوية ${bucket}`;
    }
  } catch (err) {
    lastError = err instanceof Error ? err.message : 'تعذر قراءة ملف الصورة';
  }

  if (base64) {
    return { url: `data:image/jpeg;base64,${base64}`, strategy: 'base64', error: lastError };
  }

  return { url: uri, strategy: 'local', error: lastError };
}
