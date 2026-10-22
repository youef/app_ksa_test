import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { CloudSun } from 'lucide-react-native';
import { styles } from './homeStyles';
import OasisGlassFrame from './OasisGlassFrame';
import { describeWeatherCode, type CurrentWeather } from '@/lib/weather';

type Props = {
  weather: CurrentWeather | null;
  weatherLoading: boolean;
  compact?: boolean;
};

export default function AtmosphereBar({ weather, weatherLoading, compact = false }: Props) {
  const weatherText = weather
    ? `${Math.round(weather.temperature)}°C · ${describeWeatherCode(weather.weatherCode)} · ${weather.locationName}`
    : weatherLoading
      ? 'جارٍ جلب الطقس الحالي...'
      : 'الطقس غير متاح حالياً';

  return (
    <OasisGlassFrame style={{ flex: compact ? 1 : undefined, minHeight: compact ? 54 : 62 }}>
    <Pressable onPress={() => router.push('/weather')} accessibilityRole="button" accessibilityLabel="فتح صفحة الطقس" style={[styles.atmosphereBar, compact && { marginHorizontal: 0, marginTop: 0, marginBottom: 0, paddingHorizontal: 8, paddingVertical: 7, minHeight: 54, borderRadius: 14, flex: 1 }, { justifyContent: 'flex-start', backgroundColor: 'transparent', borderWidth: 0 }]}>
      <View style={[styles.atmoItem, { flex: 1, minWidth: 0 }]}>
        <CloudSun size={16} color="#059669" />
        <Text style={[styles.atmoText, compact && { fontSize: 10.5, flexShrink: 1 }]} numberOfLines={compact ? 2 : 1}>{compact && weather ? `${Math.round(weather.temperature)}° · ${describeWeatherCode(weather.weatherCode)}` : weatherText}</Text>
      </View>
    </Pressable>
    </OasisGlassFrame>
  );
}