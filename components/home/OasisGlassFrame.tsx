import React from 'react';
import { ImageBackground, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

type Props = { children: React.ReactNode; style?: ViewStyle; variant?: 'weather' | 'location' };
/**
 * Upload assets/images/weather-glass-frame.png and location-glass-frame.png manually.
 * Expo's static require needs the files to exist at build time, so public paths
 * are used for web and URI images for native, with an SVG fallback.
 */
const paths = {
  weather: '/images/weather-glass-frame.png',
  location: '/images/location-glass-frame.png',
};
export default function OasisGlassFrame({ children, style, variant = 'weather' }: Props) {
  const [failed, setFailed] = React.useState(false);
  const source = { uri: paths[variant] };
  return (
    <View style={[styles.outer, style]}>
      {!failed ? (
        <ImageBackground source={source} resizeMode="stretch" onError={() => setFailed(true)} style={StyleSheet.absoluteFill} imageStyle={styles.image} />
      ) : (
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} viewBox="0 0 320 100" preserveAspectRatio="none" pointerEvents="none">
          <Defs><LinearGradient id="fallbackGlass" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.94"/><Stop offset="1" stopColor="#B8E6D2" stopOpacity="0.72"/></LinearGradient></Defs>
          <Rect x="2" y="3" width="316" height="94" rx="27" fill="url(#fallbackGlass)" stroke="#69B999" strokeWidth="2"/>
          <Rect x="8" y="9" width="304" height="82" rx="22" fill="none" stroke="#FFFFFF" strokeWidth="2"/>
        </Svg>
      )}
      <View style={styles.content}>{children}</View>
    </View>
  );
}
const styles = StyleSheet.create({
  outer: { position: 'relative', overflow: 'hidden', borderRadius: 25, backgroundColor: 'rgba(240,250,246,0.35)', minHeight: 54 },
  image: { borderRadius: 25 },
  content: { flex: 1, justifyContent: 'center', paddingTop: 12 },
});
