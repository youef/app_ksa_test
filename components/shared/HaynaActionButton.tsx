import React from 'react';
import { Text, StyleSheet, type StyleProp, type ViewStyle, type PressableProps } from 'react-native';
import { OasisPressable } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';

type Props = Omit<PressableProps, 'children' | 'style'> & { title: string; variant?: 'primary' | 'secondary'; icon?: React.ReactNode; style?: StyleProp<ViewStyle>; height?: number; fontSize?: number };
export function HaynaActionButton({ title, variant = 'primary', icon, style, height = OASIS.heights.hero, fontSize = 16, ...props }: Props) {
  return <OasisPressable {...props} oasisKind="action" oasisVariant={variant} oasisSize={height >= 60 ? 'hero' : 'form'} accessibilityLabel={props.accessibilityLabel || title} style={[styles.button, { height }, style]}>
    <Text style={[styles.label, { fontSize, color: variant === 'primary' ? OASIS.colors.surface : OASIS.colors.deep }]}>{title}</Text>{icon}
  </OasisPressable>;
}
const styles = StyleSheet.create({ button: { width: '100%', flexShrink: 0, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18 }, label: { fontWeight: '600', textAlign: 'center', flexShrink: 1 } });
