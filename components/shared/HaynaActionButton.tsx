import React from 'react';
import { HAYNA_BUTTON } from './haynaButtonTokens';
import { Image, Platform, Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

const ART = { uri: Platform.OS === 'web' ? '/images/buttons/hayna-login-button-bg.png' : 'https://appksatest.vercel.app/images/buttons/hayna-login-button-bg.png' };

type Props = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  height?: number;
};

/** Use only for dark emerald primary actions; leave secondary, warning and destructive buttons unchanged. */
export function HaynaActionButton({ title, icon, style, height = HAYNA_BUTTON.heroHeight, disabled, ...props }: Props) {
  return (
    <Pressable {...props} disabled={disabled} accessibilityRole="button" accessibilityLabel={props.accessibilityLabel || title}
      style={({ pressed }) => [styles.button, { height }, style, (pressed || disabled) && styles.dimmed]}>
      <Image source={ART} resizeMode="stretch" style={styles.artwork} pointerEvents="none" />
      <View pointerEvents="none" style={styles.content}>
        <Text style={styles.label}>{title}</Text>
        {icon}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: '100%', backgroundColor: 'transparent', borderWidth: 0, overflow: 'visible', alignItems: 'center', justifyContent: 'center' },
  artwork: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  content: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8 },
  label: { fontSize: HAYNA_BUTTON.fontSize, fontWeight: '900', color: '#FFFFFF', textAlign: 'center' },
  dimmed: { opacity: 0.78 },
});
