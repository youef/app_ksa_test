import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Config = { maintenance: { enabled: boolean; message: string }; flags: Record<string, boolean>; branding: { name?: string; description?: string; headers?: Record<string, string> }; ready: boolean };
const defaults: Config = { maintenance: { enabled: false, message: '' }, flags: {}, branding: {}, ready: false };
const Context = createContext<Config>(defaults);
export const usePlatformConfig = () => useContext(Context);

export function PlatformConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState(defaults);
  const [ready, setReady] = useState(false);
  const refresh = useCallback(async () => {
    const { data } = await supabase.from('app_config').select('key,value').in('key', ['maintenance_mode', 'feature_flags', 'site_branding']);
    const values: Record<string, any> = {};
    (data || []).forEach((row: any) => { values[row.key] = row.value; });
    setConfig({ maintenance: { ...defaults.maintenance, ...(values.maintenance_mode || {}) }, flags: values.feature_flags || {}, branding: values.site_branding || {} });
    setReady(true);
  }, []);
  useEffect(() => { void refresh(); const timer = setInterval(() => void refresh(), 15000); return () => clearInterval(timer); }, [refresh]);
  return <Context.Provider value={{ ...config, ready }}>{children}</Context.Provider>;
}
