import { useState } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { usePlatformConfig } from '@/lib/platformConfig';
import { BACKGROUND_BUCKET, DEFAULT_PAGE_BACKGROUNDS, type BackgroundSlot } from '@/lib/pageBackgrounds';
import { supabase } from '@/lib/supabase';

export const DEFAULT_BACKGROUND_SOURCES = {
  welcome: require('../public/design-system/hayna-v1/artwork/welcome-art.png'),
  login: require('../public/design-system/hayna-v1/artwork/welcome-art.png'),
  app: require('../public/welcome/hayna-app-background.png'),
  chat: require('../public/welcome/hayna-app-background.png'),
};

export function usePageBackground(slot: BackgroundSlot) {
  const { backgrounds } = usePlatformConfig();
  const { isDark } = useTheme();
  const [failedPath, setFailedPath] = useState<string | null>(null);
  const setting = backgrounds[slot];
  const failed = Boolean(setting.path && failedPath === setting.path);
  const custom = setting.path && !failed;
  const opacity = failed ? DEFAULT_PAGE_BACKGROUNDS[slot] : setting;
  return {
    source: custom ? { uri: supabase.storage.from(BACKGROUND_BUCKET).getPublicUrl(setting.path!).data.publicUrl } : DEFAULT_BACKGROUND_SOURCES[slot],
    opacity: isDark ? opacity.darkOpacity : opacity.lightOpacity,
    onError: () => { if (setting.path) setFailedPath(setting.path); },
  };
}
