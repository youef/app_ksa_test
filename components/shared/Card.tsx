import type { ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { OasisSurface } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
export default function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) { return <OasisSurface style={[styles.card, style]}>{children}</OasisSurface>; }
const styles = StyleSheet.create({ card: { backgroundColor: OASIS.colors.surface, borderRadius: 14, borderWidth: 1, borderColor: OASIS.colors.line, padding: 14, shadowColor: OASIS.colors.deep, shadowOpacity: 0, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1 } });
