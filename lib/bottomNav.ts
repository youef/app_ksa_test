import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const BOTTOM_NAV_HEIGHT = 62;

export function useBottomNavInset(extra = 16) {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, extra);
}
