import { Text, View } from 'react-native';
import { CloudSun } from 'lucide-react-native';
import { styles } from './homeStyles';
import { describeWeatherCode, type CurrentWeather } from '@/lib/weather';

type Props = {
  weather: CurrentWeather | null;
  weatherLoading: boolean;
};

export default function AtmosphereBar({ weather, weatherLoading }: Props) {
  const weatherText = weather
    ? `${Math.round(weather.temperature)}°C · ${describeWeatherCode(weather.weatherCode)} · ${weather.locationName}`
    : weatherLoading
      ? 'جارٍ جلب الطقس الحالي...'
      : 'الطقس غير متاح حالياً';

  return (
    <View style={[styles.atmosphereBar, { justifyContent: 'flex-start' }]>
      <View style={styles.atmoItem}>
        <CloudSun size={15} color="#059669" />
        <Text style={styles.atmoText} numberOfLines={1}>{weatherText}</Text>
      </View>
    </View>
  );
}