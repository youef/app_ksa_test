import { Image, StyleSheet, View } from 'react-native';

/** Bundled locally so every header can render without a remote asset request. */
export function HeaderArtwork({ dark = false }: { dark?: boolean }) {
  return <View pointerEvents="none" style={styles.layer}>
    <Image accessible={false} source={require('../../assets/headers/home-navigation.png')} resizeMode="cover" style={styles.image} />
    {dark ? <View style={[StyleSheet.absoluteFillObject, styles.shade]} /> : null}
  </View>;
}
const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  shade: { backgroundColor: 'rgba(7, 45, 33, 0.78)' },
});
