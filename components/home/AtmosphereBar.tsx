import { Text, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { CloudSun, ShieldCheck } from 'lucide-react-native';
import { styles } from './homeStyles';
import { describeWeatherCode, type CurrentWeather } from '@/lib/weather';

type Props = {
  weather: CurrentWeather | null;
  weatherLoading: boolean;
  activeNeighbors?: number;
  emergencyCount: number;
};

export default function AtmosphereBar({ weather, weatherLoading, emergencyCount }: Props) {
  const weatherText = weather
    ? `${Math.round(weather.temperature)}°C · ${describeWeatherCode(weather.weatherCode)} · ${weather.locationName}`
    : weatherLoading
      ? 'جارٍ جلب الطقس الحالي...'
      : 'الطقس غير متاح حالياً';

  return (
    <View style={styles.atmosphereBar}>
      <View style={styles.atmoItem}>
        <CloudSun size={15} color="#059669" />
        <Text style={styles.atmoText} numberOfLines={1}>{weatherText}</Text>
      </View>
      <View style={styles.atmoDivider} />
      <Pressable
        style={styles.atmoItem}
        onPress={() => router.push('/emergency-alert')}
        accessibilityRole="button"
        accessibilityLabel="تنبيه الحي العاجل"
      >
        <ShieldCheck size={15} color={emergencyCount > 0 ? '#dc2626' : '#059669'} />
        <Text style={styles.atmoText}>
          {emergencyCount > 0 ? `${emergencyCount} بلاغ طارئ` : 'تنبيه طارئ 🚨'}
        </Text>
      </Pressable>
    </View>
  );
}
