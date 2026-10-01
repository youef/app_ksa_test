import { supabase } from '@/lib/supabase';

export const FALLBACK_LOGO_URI = '/assets/branding/HAYNA_LOGO.png?v=2';

export async function getBrandingLogo(): Promise<string> {
  try {
    const { data } = await supabase
      .from('app_branding')
      .select('logo_url, updated_at')
      .eq('id', 'global')
      .maybeSingle();

    if (data?.logo_url) {
      const separator = data.logo_url.includes('?') ? '&' : '?';
      return `${data.logo_url}${separator}v=${encodeURIComponent(data.updated_at || Date.now())}`;
    }
  } catch {}
  return FALLBACK_LOGO_URI;
}
