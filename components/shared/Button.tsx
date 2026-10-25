import { ActivityIndicator, StyleSheet, Text, type StyleProp, type ViewStyle, type TextStyle } from 'react-native';
import type { ReactNode } from 'react';
import { OasisPressable } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
type Props = { children: ReactNode; onPress?: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; textStyle?: StyleProp<TextStyle> };
export default function Button({ children, onPress, variant = 'primary', loading = false, disabled = false, style, textStyle }: Props) {
  const color = variant === 'primary' || variant === 'danger' ? OASIS.colors.surface : OASIS.colors.deep;
  return <OasisPressable oasisKind="action" oasisVariant={variant} onPress={onPress} disabled={disabled || loading} accessibilityState={{ busy: loading, disabled: disabled || loading }} style={[styles.base, style]}>
    {loading ? <ActivityIndicator size="small" color={color} /> : <Text style={[styles.text, { color }, textStyle]}>{children}</Text>}
  </OasisPressable>;
}
const styles = StyleSheet.create({ base: { minHeight: 44, borderRadius: 10, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row-reverse', gap: 8 }, text: { fontSize: 16, fontWeight: '600', textAlign: 'center', flexShrink: 1 } });
