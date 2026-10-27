import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';
// Includes the glass surface and its 8-point top clearance.
export const BOTTOM_NAV_HEIGHT = 72;
export function useBottomNavInset(extra = 16) {
  const insets = useSafeAreaInsets();
  const path = usePathname();
  const hidden = path === '/' || ['/auth','/questions','/question','/conversation','/ask','/service','/new-service','/new-listing','/admin','/admin-pro','/admin-support','/admin-marketplace','/map','/live','/stories','/create-story','/story','/story-viewers','/story-settings'].some(route => path === route || path.startsWith(route + '/'));
  return (hidden ? 0 : BOTTOM_NAV_HEIGHT) + Math.max(insets.bottom, 8) + extra;
}
