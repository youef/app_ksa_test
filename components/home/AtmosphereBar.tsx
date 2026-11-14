import { OasisPressable as Pressable } from '@/components/oasis/OasisPrimitives';
import { memo, useMemo } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router } from 'expo-router';
import { CloudSun } from 'lucide-react-native';
import { styles } from './homeStyles';
import OasisGlassFrame from './OasisGlassFrame';
import { describeWeatherCode, type CurrentWeather } from '@/lib/weather';
import { useTheme } from '@/context/ThemeContext';

type Props = {
  weather: CurrentWeather | null;
  weatherLoading: boolean;
  compact?: boolean;
};

const ATMO_TEXT_FALLBACK = '#345348';

function AtmosphereBarBase({ weather, weatherLoading, compact = false }: Props) {
  const { colors, isDark } = useTheme();

  const displayText = useMemo(() => {
    if (!weather) {
      return weatherLoading ? 'جارٍ جلب الطقس…' : 'الطقس غير متاح';
    }

    const description = describeWeatherCode(weather.weatherCode);
    const temperature = `${Math.round(weather.temperature)}°`;
    if (compact) return description ? `${temperature} · ${description}` : temperature;

    const parts = [`${temperature}C`];
    if (description) parts.push(description);
    const location = weather.locationName?.trim();
    if (location) parts.push(location);
    return parts.join(' · ');
  }, [weather, weatherLoading, compact]);

  const textColor = isDark
    ? colors.ink
    : (colors as { atmoText?: string }).atmoText ?? ATMO_TEXT_FALLBACK;

  const accessibleStatus = weather
    ? `الطقس الحالي: ${displayText}${weatherLoading ? '، جارٍ تحديث القراءة' : ''}`
    : weatherLoading
      ? 'جارٍ تحميل حالة الطقس'
      : 'حالة الطقس غير متاحة حالياً';

  return (
    <OasisGlassFrame style={compact ? styles.glassFrameCompact : styles.glassFrameDefault}>
      <Pressable
        onPress={() => router.push('/weather')}
        accessibilityRole="button"
        accessibilityLabel={`${accessibleStatus}، عرض تفاصيل الطقس`}
        accessibilityHint="يفتح صفحة الطقس في حيّك"
        accessibilityState={{ busy: weatherLoading }}
        style={[
          styles.atmoBarBase,
          compact ? styles.atmoBarCompact : styles.atmoBarFull,
          { minHeight: 44, justifyContent: 'center' },
        ]}
        hitSlop={4}
      >
        <View style={[styles.atmoContent, { flexDirection: 'row-reverse', alignItems: 'center', minWidth: 0 }]}>
          {weatherLoading ? (
            <ActivityIndicator size="small" color={colors.primary} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
          ) : (
            <CloudSun size={compact ? 16 : 18} color={colors.primary} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
          )}
          <Text
            style={[
              styles.atmoBarText,
              { color: textColor, flexShrink: 1, textAlign: 'right' },
              compact ? styles.atmoBarTextCompact : styles.atmoBarTextFull,
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {displayText}
          </Text>
        </View>
      </Pressable>
    </OasisGlassFrame>
  );
}

export default memo(AtmosphereBarBase);
