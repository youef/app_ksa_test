import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { BACKGROUND_CONFIG_KEY, DEFAULT_PAGE_BACKGROUNDS, parsePageBackgrounds, type PageBackgrounds } from '@/lib/pageBackgrounds';

type Config = { maintenance: { enabled: boolean; message: string }; flags: Record<string, boolean>; branding: { name?: string; description?: string; headers?: Record<string, string> }; backgrounds: PageBackgrounds; ready: boolean };
const defaults: Config = { maintenance: { enabled: false, message: '' }, flags: {}, branding: {}, backgrounds: DEFAULT_PAGE_BACKGROUNDS, ready: true };
const Context = createContext<Config & { refresh: () => Promise<void> }>({ ...defaults, refresh: async () => {} });
export const usePlatformConfig = () => useContext(Context);
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

export function PlatformConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState(defaults);
  const mounted = useRef(false);
  const sequence = useRef(0);
  const request = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    const current = ++sequence.current;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const { data, error } = await supabase.from('app_config').select('key,value').in('key', ['maintenance_mode', 'feature_flags', 'site_branding', BACKGROUND_CONFIG_KEY]).abortSignal(controller.signal);
      if (error || !mounted.current || current !== sequence.current) return;
      const values = Object.fromEntries((data || []).map(row => [row.key, row.value]));
      const maintenance = object(values.maintenance_mode), branding = object(values.site_branding);
      const flags = Object.fromEntries(Object.entries(object(values.feature_flags)).filter(([, value]) => typeof value === 'boolean')) as Record<string, boolean>;
      const headers = Object.fromEntries(Object.entries(object(branding.headers)).filter(([, value]) => typeof value === 'string')) as Record<string, string>;
      setConfig({ ready: true, flags, backgrounds: parsePageBackgrounds(values[BACKGROUND_CONFIG_KEY]), maintenance: { enabled: maintenance.enabled === true, message: typeof maintenance.message === 'string' ? maintenance.message : '' }, branding: { name: typeof branding.name === 'string' ? branding.name : undefined, description: typeof branding.description === 'string' ? branding.description : undefined, headers } });
    } catch { /* Defaults keep the application usable during a configuration outage. */ }
    finally { clearTimeout(timeout); }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    const channel = supabase.channel('public-platform-config')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_config' }, () => { void refresh(); })
      .subscribe(status => { if (status === 'SUBSCRIBED') void refresh(); });
    const appState = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    const syncVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    const syncOnline = () => { void refresh(); };
    if (Platform.OS === 'web') { document.addEventListener('visibilitychange', syncVisible); window.addEventListener('online', syncOnline); }
    return () => {
      mounted.current = false;
      ++sequence.current;
      request.current?.abort();
      appState.remove();
      void supabase.removeChannel(channel);
      if (Platform.OS === 'web') { document.removeEventListener('visibilitychange', syncVisible); window.removeEventListener('online', syncOnline); }
    };
  }, [refresh]);
  return <Context.Provider value={{ ...config, refresh }}>{children}</Context.Provider>;
}
