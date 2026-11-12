import { Platform, type ViewStyle } from 'react-native';

/**
 * RTL helpers for horizontal rows.
 *
 * Native supports the Yoga `direction` style, but React Native Web rejects it
 * ("Invalid style property of direction") and ignores it. On web we therefore
 * fall back to `flexDirection: 'row-reverse'`, which gives the same visual
 * order (first item on the right) without console errors.
 */

/** Style for the outer horizontal ScrollView. */
export const rtlScrollStyle: ViewStyle | undefined =
  Platform.OS === 'web' ? undefined : { direction: 'rtl' };

/** Style for the content container of an RTL horizontal ScrollView. */
export const rtlContentStyle: ViewStyle =
  Platform.OS === 'web' ? { flexDirection: 'row-reverse' } : { direction: 'ltr' };

/** Style for any non-scroll container that should lay out right-to-left. */
export const rtlLayoutStyle: ViewStyle | undefined =
  Platform.OS === 'web' ? undefined : { direction: 'rtl' };
