import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

export const STORAGE_BUCKET = 'branding';
export const STORAGE_LOGO_PATH = 'global/logo.png';
export const PUBLIC_STORAGE_LOGO_URL = 'https://vkeuyompnddqfvulalkk.supabase.co/storage/v1/object/public/branding/global/logo.png';
export const FALLBACK_LOGO_URI = Platform.OS === 'web' ? '/brand/HAYNA_LOGO.png?v=2' : PUBLIC_STORAGE_LOGO_URL;

const CACHE_KEY = '@hayna_branding_logo_url';
const REALTIME_CHANNEL_NAME = 'global-branding-live';

let memoryCachedLogoUrl: string = FALLBACK_LOGO_URI;

// Asynchronously hydrate from AsyncStorage at startup
void AsyncStorage.getItem(CACHE_KEY).then((stored) => {
  if (stored && typeof stored === 'string' && stored.trim().length > 0) {
    memoryCachedLogoUrl = stored;
  }
}).catch(() => {});

export function getCachedBrandingLogo(): string {
  return memoryCachedLogoUrl || FALLBACK_LOGO_URI;
}

export async function setCachedBrandingLogo(url: string): Promise<void> {
  if (!url) return;
  memoryCachedLogoUrl = url;
  try {
    await AsyncStorage.setItem(CACHE_KEY, url);
  } catch {}
}

export function withVersion(url: string, version?: string | number | null): string {
  if (!url) return url;
  const cleanUrl = url.split('?v=')[0];
  const separator = cleanUrl.includes('?') ? '&' : '?';
  return `${cleanUrl}${separator}v=${encodeURIComponent(String(version || Date.now()))}`;
}

/**
 * Robust fetch for the branding logo:
 * 1. Checks `app_branding` DB table.
 * 2. If table is empty or restricted by RLS, checks Supabase Storage `branding/global` directly.
 * 3. Falls back to cached or default public URL.
 */
export async function getBrandingLogo(): Promise<string> {
  // 1. Try DB table
  try {
    const { data, error } = await supabase
      .from('app_branding')
      .select('logo_url, updated_at')
      .eq('id', 'global')
      .maybeSingle();

    if (!error && data?.logo_url) {
      const versioned = withVersion(data.logo_url, data.updated_at);
      await setCachedBrandingLogo(versioned);
      return versioned;
    }
  } catch {}

  // 2. Direct fallback to Supabase Storage (publicly readable)
  try {
    const { data: files, error: storageErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .list('global');

    if (!storageErr && Array.isArray(files) && files.length > 0) {
      const logoFile = files.find((f: any) => f.name === 'logo.png') || files[0];
      if (logoFile) {
        const { data: pubData } = supabase.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(STORAGE_LOGO_PATH);

        if (pubData?.publicUrl) {
          const versioned = withVersion(pubData.publicUrl, logoFile.updated_at || Date.now());
          await setCachedBrandingLogo(versioned);
          return versioned;
        }
      }
    }
  } catch {}

  // 3. Cached or platform default fallback
  if (memoryCachedLogoUrl && memoryCachedLogoUrl !== FALLBACK_LOGO_URI) {
    return memoryCachedLogoUrl;
  }

  return FALLBACK_LOGO_URI;
}

/**
 * Broadcast an instant update across all screens and active clients
 */
export async function broadcastLogoUpdate(newUrl: string): Promise<void> {
  await setCachedBrandingLogo(newUrl);
  try {
    const ch = supabase.channel(REALTIME_CHANNEL_NAME);
    await ch.send({
      type: 'broadcast',
      event: 'logo_updated',
      payload: { logoUrl: newUrl, timestamp: Date.now() },
    });
  } catch {}
}

/**
 * Subscribes to live logo updates across the app (broadcasts + db changes + polling)
 */
export function subscribeBrandingLogo(onChange: (logoUrl: string) => void) {
  let lastUrl = memoryCachedLogoUrl;

  const refresh = async () => {
    const next = await getBrandingLogo();
    if (next && next !== lastUrl) {
      lastUrl = next;
      onChange(next);
    }
  };

  void refresh();
  const poll = setInterval(refresh, 10000);

  const channel = supabase
    .channel(`${REALTIME_CHANNEL_NAME}-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'app_branding', filter: 'id=eq.global' },
      (payload: any) => {
        const row = payload.new;
        if (row?.logo_url) {
          const versioned = withVersion(row.logo_url, row.updated_at);
          lastUrl = versioned;
          void setCachedBrandingLogo(versioned);
          onChange(versioned);
        }
      },
    )
    .on(
      'broadcast',
      { event: 'logo_updated' },
      (payload: any) => {
        const url = payload?.payload?.logoUrl;
        if (url) {
          lastUrl = url;
          void setCachedBrandingLogo(url);
          onChange(url);
        }
      },
    )
    .subscribe();

  return () => {
    clearInterval(poll);
    void supabase.removeChannel(channel);
  };
}
