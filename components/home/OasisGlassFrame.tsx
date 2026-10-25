import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { OasisSurface } from '@/components/oasis/OasisPrimitives';
export default function OasisGlassFrame({ children, style, variant = 'weather' }: { children: ReactNode; style?: ViewStyle; variant?: 'weather' | 'location' }) { return <OasisSurface oasisAsset={variant === 'weather' ? 'cards/notice-small' : 'cards/default-small'} style={[styles.outer, style]}><View style={styles.content}>{children}</View></OasisSurface>; }
const styles = StyleSheet.create({ outer: { position: 'relative', overflow: 'hidden', borderRadius: 12, minHeight: 44 }, content: { flex: 1, justifyContent: 'center' } });
