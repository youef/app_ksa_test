import { OasisPressable as Pressable } from '@/components/oasis/OasisPrimitives';
import { memo, useMemo } from 'react';
import { Text, View } from 'react-native';
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

function AtmosphereBarBase({
  weather,
  weatherLoading,
  compact = false,
}: Props) {
  const { colors, isDark } = useTheme();

  // كل الحسابات النصية في useMemo واحد لتقليل overhead
  const { description, displayText } = useMemo(() => {
    if (!weather) {
      return {
        description: null,
        displayText: compact
          ? weatherLoading
            ? 'جارٍ الطقس...'
            : 'الطقس غير متاح'
          : weatherLoading
            ? 'جارٍ جلب الطقس الحالي...'
            : 'الطقس غير متاح حالياً',
      };
    }

    const desc = describeWeatherCode(weather.weatherCode);
    const tempValue = `${Math.round(weather.temperature)}°`;

    if (compact) {
      return {
        description: desc,
        displayText: desc ? `${tempValue} · ${desc}` : tempValue,
      };
    }

    const parts: string[] = [`${tempValue}C`];
    if (desc) parts.push(desc);
    const loc = weather.locationName?.trim();
    if (loc) parts.push(loc);

    return { description: desc, displayText: parts.join(' · ') };
  }, [weather, weatherLoading, compact]);

  // لون النص: احترام الثيم مع fallback آمن
  const textColor = isDark
    ? colors.ink
    : (colors as { atmoText?: string }).atmoText ?? ATMO_TEXT_FALLBACK;

  const frameStyle = compact
    ? styles.glassFrameCompact
    : styles.glassFrameDefault;

  return (
    <OasisGlassFrame style={frameStyle}>
      <Pressable
        onPress={() => router.push('/weather')}
        accessibilityRole="button"
        accessibilityLabel="فتح صفحة الطقس"
        accessibilityHint="يعرض تفاصيل حالة الطقس في حيّك"
        accessibilityState={{ busy: weatherLoading }}
        style={[
          styles.atmoBarBase,
          compact ? styles.atmoBarCompact : styles.atmoBarFull,
        ]}
        hitSlop={4}
      >
        <View style={styles.atmoContent}>
          <CloudSun size={compact ? 14 : 16} color={colors.primary} />
          <Text
            style={[
              styles.atmoBarText,
              { color: textColor },
              compact ? styles.atmoBarTextCompact : styles.atmoBarTextFull,
            ]}
            numberOfLines={compact ? 1 : 1}
            ellipsizeMode="tail"
            accessibilityLiveRegion="polite"
          >
            {displayText}
          </Text>
        </View>
      </Pressable>
    </OasisGlassFrame>
  );
}

export default memo(AtmosphereBarBase);