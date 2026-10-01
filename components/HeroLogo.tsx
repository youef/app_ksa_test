import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Home } from 'lucide-react-native';

type Props = { size: number };

export default function HeroLogo({ size }: Props) {
  const badge = size * 0.5;
  return (
    <View style={styles.wrap}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <LinearGradient
          colors={['#34d399', '#059669']}
          style={{ width: badge, height: badge, borderRadius: badge / 2, alignItems: 'center', justifyContent: 'center' }}
        >
          <Home size={badge * 0.5} color="#fff" />
        </LinearGradient>
      </View>
      <Text style={styles.title}>حيّنا</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  title: { color: '#a7f3d0', fontSize: 56, fontWeight: '900', letterSpacing: 1 },
});
