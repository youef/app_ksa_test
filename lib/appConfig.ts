import { supabase } from '@/lib/supabase';

export interface MaintenanceState {
  enabled: boolean;
  message: string;
}

export interface AppConfig {
  maintenance: MaintenanceState;
  flags: Record<string, boolean>;
  available: boolean;
}

const DEFAULTS: AppConfig = {
  maintenance: { enabled: false, message: '' },
  flags: {},
  available: false,
};

/**
 * Reads DB-driven config (feature flags + maintenance mode).
 * Degrades gracefully to defaults when the table is missing or unreachable.
 */
export async function loadAppConfig(): Promise<AppConfig> {
  try {
    const { data, error } = await supabase.from('app_config').select('key,value');
    if (error || !data) return DEFAULTS;
    const map: Record<string, any> = {};
    (data as Array<{ key: string; value: any }>).forEach((row) => {
      map[row.key] = row.value;
    });
    return {
      maintenance: { ...DEFAULTS.maintenance, ...(map.maintenance_mode || {}) },
      flags: map.feature_flags || {},
      available: true,
    };
  } catch {
    return DEFAULTS;
  }
}

/** Returns whether a given feature flag is enabled (defaults to enabled). */
export async function isFeatureEnabled(flag: string): Promise<boolean> {
  const cfg = await loadAppConfig();
  if (!cfg.available) return true;
  return cfg.flags[flag] !== false;
}
