import { StyleSheet, View } from 'react-native';
import { OASIS } from '@/lib/oasis';
export function HeaderArtwork({ dark = false }: { dark?: boolean }) { return <View pointerEvents="none" accessibilityElementsHidden style={[StyleSheet.absoluteFillObject, { backgroundColor: dark ? 'rgba(13,33,27,0.92)' : OASIS.colors.surface }]} />; }
