import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect, Path } from 'react-native-svg';

type Props = { children: React.ReactNode; style?: ViewStyle };
/** Transparent, content-free glass frame. Text and icons remain live above it. */
export default function OasisGlassFrame({ children, style }: Props) {
  return (
    <View style={[styles.outer, style]}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 320 100" pointerEvents="none">
        <Defs>
          <LinearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.94" />
            <Stop offset="0.48" stopColor="#ECF9F3" stopOpacity="0.67" />
            <Stop offset="1" stopColor="#C4EBDD" stopOpacity="0.64" />
          </LinearGradient>
          <LinearGradient id="rim" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.98" />
            <Stop offset="0.52" stopColor="#8FD9B8" stopOpacity="0.75" />
            <Stop offset="1" stopColor="#19865F" stopOpacity="0.72" />
          </LinearGradient>
        </Defs>
        <Rect x="2" y="3" width="316" height="94" rx="27" fill="url(#glass)" stroke="url(#rim)" strokeWidth="2.5" />
        <Rect x="8" y="9" width="304" height="82" rx="22" fill="none" stroke="#FFFFFF" strokeOpacity="0.88" strokeWidth="2" />
        <Path d="M29 14 Q160 2 291 14" fill="none" stroke="#FFFFFF" strokeOpacity="0.85" strokeWidth="2.5" />
        <Path d="M31 86 Q160 98 289 86" fill="none" stroke="#409C78" strokeOpacity="0.25" strokeWidth="2" />
      </Svg>
      <View style={styles.content}>{children}</View>
    </View>
  );
}
const styles = StyleSheet.create({
  outer: { position: 'relative', overflow: 'hidden', borderRadius: 25, backgroundColor: 'rgba(240,250,246,0.35)', shadowColor: '#187A57', shadowOpacity: 0.10, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  content: { flex: 1, justifyContent: 'center' },
});
