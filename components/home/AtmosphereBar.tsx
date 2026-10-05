import { Text, View } from 'react-native';
import { CloudSun, Flame, ShieldCheck } from 'lucide-react-native';
import { styles } from './homeStyles';
import { describeWeatherCode, type CurrentWeather } from '@/lib/weather';

type Props = {
  weather: CurrentWeather | null;
  weatherLoading: boolean;
  activeNeighbors: number;
  emergencyCount: number;
};

export default function AtmosphereBar({ weather, weatherLoading, activeNeighbors, emergencyCount }: Props) {
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
      <View style={styles.atmoItem}>
        <Flame size={15} color="#f59e0b" />
        <Text style={styles.atmoText}>
          {activeNeighbors > 0 ? `${activeNeighbors} جار نشط اليوم` : 'كن أول المشاركين اليوم'}
        </Text>
      </View>
      <View style={styles.atmoDivider} />
      <View style={styles.atmoItem}>
        <ShieldCheck size={15} color={emergencyCount > 0 ? '#dc2626' : '#059669'} />
        <Text style={styles.atmoText}>
          {emergencyCount > 0 ? `${emergencyCount} بلاغ طارئ` : 'لا بلاغات طارئة'}
        </Text>
      </View>
    </View>
  );
}
