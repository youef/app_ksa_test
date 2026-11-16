import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';
// Height of the tappable dock above the device's bottom safe-area glass extension.
export const BOTTOM_NAV_HEIGHT = 72;
export function useBottomNavInset(extra = 16) {
  const insets = useSafeAreaInsets();
  const path = usePathname();
  const hidden = path === '/' || ['/auth','/questions','/question','/conversation','/ask','/service','/new-service','/new-listing','/admin','/admin-pro','/admin-support','/admin-marketplace','/map','/live','/stories','/create-story','/story','/story-viewers','/story-settings'].some(route => path === route || path.startsWith(route + '/'));
  const safeBottom = Math.max(insets.bottom, Platform.OS === 'web' ? 14 : 8);
  return (hidden ? 0 : BOTTOM_NAV_HEIGHT + safeBottom) + extra;
}
