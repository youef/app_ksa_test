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
    <OasisGlassFrame style={{ flex: compact ? 1 : undefined, height: 68 }}>
    <Pressable onPress={() => router.push('/weather')} accessibilityRole="button" accessibilityLabel="فتح صفحة الطقس" style={[styles.atmosphereBar, compact && { marginHorizontal: 0, marginTop: 0, marginBottom: 0, paddingHorizontal: 18, paddingVertical: 0, height: 68, borderRadius: 14, flex: 1 }, { justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent', borderWidth: 0 }]}>
      <View style={[styles.atmoItem, { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', flexDirection: 'row-reverse', gap: 5 }]}>
        <CloudSun size={16} color="#059669" />
        <Text style={[styles.atmoText, compact && { fontSize: 11, flexShrink: 1, textAlign: 'center', lineHeight: 16 }]} numberOfLines={1}>{compact && weather ? `${Math.round(weather.temperature)}° · ${describeWeatherCode(weather.weatherCode)}` : weatherText}</Text>
      </View>
    </Pressable>
    </OasisGlassFrame>
  );
}