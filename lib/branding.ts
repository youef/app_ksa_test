import { supabase } from '@/lib/supabase';

export const FALLBACK_LOGO_URI = '/brand/HAYNA_LOGO.png?v=2';

function withVersion(url: string, version?: string | null) {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${encodeURIComponent(version || Date.now())}`;
}

export async function getBrandingLogo(): Promise<string> {
  try {
    const { data } = await supabase
      .from('app_branding')
      .select('logo_url, updated_at')
      .eq('id', 'global')
      .maybeSingle();

    if (data?.logo_url) return withVersion(data.logo_url, data.updated_at);
  } catch {}
  return FALLBACK_LOGO_URI;
}

export function subscribeBrandingLogo(onChange: (logoUrl: string) => void) {
  let lastUrl = '';
  const refresh = async () => {
    const next = await getBrandingLogo();
    if (next !== lastUrl) {
      lastUrl = next;
      onChange(next);
    }
  };
  void refresh();
  const poll = setInterval(refresh, 8000);

  const channel = supabase
    .channel(`global-branding-live-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'app_branding', filter: 'id=eq.global' },
      (payload: any) => {
        const row = payload.new;
        if (row?.logo_url) onChange(withVersion(row.logo_url, row.updated_at));
      },
    )
    .subscribe();

  return () => {
    clearInterval(poll);
    void supabase.removeChannel(channel);
  };
}
