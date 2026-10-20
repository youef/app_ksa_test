import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Config = { maintenance: { enabled: boolean; message: string }; flags: Record<string, boolean>; branding: { name?: string; description?: string; headers?: Record<string, string> }; ready: boolean };
const defaults: Config = { maintenance: { enabled: false, message: '' }, flags: {}, branding: {}, ready: true };
const Context = createContext<Config>(defaults);
export const usePlatformConfig = () => useContext(Context);
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

export function PlatformConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState(defaults);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    void (async () => {
      try {
        const { data, error } = await supabase.from('app_config').select('key,value').in('key', ['maintenance_mode', 'feature_flags', 'site_branding']).abortSignal(controller.signal);
        if (error || !active) return;
        const values = Object.fromEntries((data || []).map(row => [row.key, row.value]));
        const maintenance = object(values.maintenance_mode), branding = object(values.site_branding);
        const flags = Object.fromEntries(Object.entries(object(values.feature_flags)).filter(([, value]) => typeof value === 'boolean')) as Record<string, boolean>;
        const headers = Object.fromEntries(Object.entries(object(branding.headers)).filter(([, value]) => typeof value === 'string')) as Record<string, string>;
        setConfig({ ready: true, flags, maintenance: { enabled: maintenance.enabled === true, message: typeof maintenance.message === 'string' ? maintenance.message : '' }, branding: { name: typeof branding.name === 'string' ? branding.name : undefined, description: typeof branding.description === 'string' ? branding.description : undefined, headers } });
      } catch { /* Defaults keep the application usable during a configuration outage. */ }
      finally { clearTimeout(timeout); }
    })();
    return () => { active = false; controller.abort(); clearTimeout(timeout); };
  }, []);
  return <Context.Provider value={config}>{children}</Context.Provider>;
}
