import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';
// Keep the glass dock compact even when mobile web reports an inflated safe-area inset.
export const BOTTOM_NAV_HEIGHT = 68;
export function getBottomDockInset(bottom: number, platform: string = Platform.OS): number {
  if (platform === 'web') return 24;
  const safe = Number.isFinite(bottom) ? Math.max(bottom, 0) : 0;
  return Math.min(Math.max(safe, 8), 34);
}
export function useBottomNavInset(extra = 16) {
  const insets = useSafeAreaInsets();
  const path = usePathname();
  const hidden = path === '/' || ['/auth','/questions','/question','/conversation','/ask','/service','/new-service','/new-listing','/admin','/admin-pro','/admin-support','/admin-marketplace','/map','/live','/stories','/create-story','/story','/story-viewers','/story-settings'].some(route => path === route || path.startsWith(route + '/'));
  const safeBottom = getBottomDockInset(insets.bottom);
  return (hidden ? 0 : BOTTOM_NAV_HEIGHT + safeBottom) + extra;
}
