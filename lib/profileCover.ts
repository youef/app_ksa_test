import { supabase } from '@/lib/supabase';

export const PROFILE_COVER_FILE = 'cover.jpg';
export const PROFILE_COVER_PATH = (userId: string) => `${userId}/${PROFILE_COVER_FILE}`;

export function profileCoverUrl(userId?: string | null, version?: number | null) {
  if (!userId) return '';
  const { data } = supabase.storage.from('avatars').getPublicUrl(PROFILE_COVER_PATH(userId));
  const base = data.publicUrl;
  return version ? `${base}?v=${encodeURIComponent(String(version))}` : base;
}

export async function uploadProfileCover(userId: string, asset: { uri: string; mimeType?: string | null }) {
  const body = await (await fetch(asset.uri)).arrayBuffer();
  const path = PROFILE_COVER_PATH(userId);
  const upload = await supabase.storage.from('avatars').upload(path, body, {
    contentType: asset.mimeType || 'image/jpeg',
    upsert: true,
  });
  if (upload.error) throw upload.error;
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}

export async function removeProfileCover(userId: string) {
  const { error } = await supabase.storage.from('avatars').remove([PROFILE_COVER_PATH(userId)]);
  if (error) throw error;
}
