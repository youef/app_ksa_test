import { Image, Platform, Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import React from 'react';
import { HAYNA_BUTTON, HAYNA_BUTTON_IMAGES } from './haynaButtonTokens';

export type HaynaButtonVariant = 'primary' | 'secondary';
type Props = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  variant?: HaynaButtonVariant;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  height?: number;
  fontSize?: number;
};

const getArtwork = (variant: HaynaButtonVariant) => ({
  uri: Platform.OS === 'web'
    ? HAYNA_BUTTON_IMAGES[variant]
    : 'https://appksatest.vercel.app' + HAYNA_BUTTON_IMAGES[variant],
});

/** Both variants share exact outer dimensions; PNG is visual fill, never layout. */
export function HaynaActionButton({ title, variant = 'primary', icon, style, height = HAYNA_BUTTON.heroHeight, fontSize = HAYNA_BUTTON.fontSize, disabled, ...props }: Props) {
  return (
    <Pressable {...props} disabled={disabled} accessibilityRole="button" accessibilityLabel={props.accessibilityLabel || title}
      style={({ pressed }) => [styles.button, { height }, style, (pressed || disabled) && styles.dimmed]}>
      <Image source={getArtwork(variant)} resizeMode="stretch" style={styles.artwork} pointerEvents="none" />
      <View pointerEvents="none" style={styles.content}>
        <Text style={[styles.label, { fontSize }, variant === 'secondary' && styles.secondaryLabel]}>{title}</Text>
        {icon}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: '100%', backgroundColor: 'transparent', borderWidth: 0, borderRadius: 0, overflow: 'visible', alignItems: 'center', justifyContent: 'center' },
  artwork: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  content: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: HAYNA_BUTTON.contentGap, paddingHorizontal: HAYNA_BUTTON.horizontalPadding },
  label: { fontWeight: '900', color: '#FFFFFF', textAlign: 'center' },
  secondaryLabel: { color: '#064E3B' },
  dimmed: { opacity: 0.78 },
});
