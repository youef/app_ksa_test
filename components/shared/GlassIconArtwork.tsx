import { Image, StyleSheet, View } from 'react-native';

/** Approved PNG material; decoration never intercepts button presses. */
export function GlassIconArtwork() {
  return <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { zIndex: 0 }]}><Image accessible={false} source={require('../../assets/headers/glass-icon.png')} resizeMode="stretch" style={styles.image} /></View>;
}
const styles = StyleSheet.create({ image: { width: '100%', height: '100%' } });
