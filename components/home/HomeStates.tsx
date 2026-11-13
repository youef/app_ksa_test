import { OasisPressable as Pressable } from '@/components/oasis/OasisPrimitives';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Text, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { styles } from './homeStyles';

/* -------------------------------------------------------------------------- */
/*                               FeedSkeleton                                 */
/* -------------------------------------------------------------------------- */

type FeedSkeletonProps = {
  count?: number;
  /** ارتفاع السطر الأول كنسبة (افتراضي 45%) */
  titleWidth?: `${number}%`;
};

export function FeedSkeleton({ count = 3, titleWidth = '45%' }: FeedSkeletonProps) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.5)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    if (reduceMotion) { opacity.setValue(1); return; }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    // تنظيف كامل: إيقاف + إعادة القيمة الأصلية
    return () => {
      animation.stop();
      opacity.stopAnimation();
      opacity.setValue(0.5);
    };
  }, [opacity, reduceMotion]);

  // مفاتيح ثابتة لا تتغير بين الـ renders
  const items = useMemo(
    () => Array.from({ length: count }, (_, i) => i),
    [count],
  );

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="جارٍ تحميل المحتوى"
      accessibilityLiveRegion="polite"
      pointerEvents="none"
      style={{ gap: 12 }}
    >
      {items.map((key) => (
        <Animated.View
          key={key}
          style={[styles.skeletonCard, { opacity, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 18, padding: 16, gap: 12 }]}
          // أخفِ العناصر الفردية عن قارئ الشاشة، الحاوية تكفي
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.soft }} />
            <View style={{ flex: 1, gap: 7, alignItems: 'flex-end' }}>
              <View style={[styles.skeletonLine, { width: titleWidth, backgroundColor: colors.soft }]} />
              <View style={[styles.skeletonLine, { width: '30%', backgroundColor: colors.soft }]} />
            </View>
          </View>
          <View style={[styles.skeletonLine, { width: '90%', backgroundColor: colors.soft, alignSelf: 'flex-end' }]} />
          <View style={[styles.skeletonLine, { width: '70%', backgroundColor: colors.soft, alignSelf: 'flex-end' }]} />
        </Animated.View>
      ))}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*                                ErrorBanner                                 */
/* -------------------------------------------------------------------------- */

type ErrorBannerProps = {
  message: string;
  onRetry: () => void;
  /** نص زر إعادة المحاولة (قابل للتخصيص) */
  retryLabel?: string;
  /** تعطيل الزر أثناء إعادة المحاولة */
  retrying?: boolean;
};

export function ErrorBanner({
  message,
  onRetry,
  retryLabel = 'إعادة المحاولة',
  retrying = false,
}: ErrorBannerProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.errorBanner, { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 18, padding: 16, gap: 10 }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      accessibilityLabel={`خطأ: ${message}`}
    >
      <Pressable
        oasisKind="action"
        style={[styles.errorRetryBtn, { minHeight: 44, minWidth: 120, borderRadius: 12, opacity: retrying ? 0.6 : 1, alignItems: 'center', justifyContent: 'center' }]}
        onPress={onRetry}
        disabled={retrying}
        accessibilityRole="button"
        accessibilityLabel={retryLabel}
        accessibilityState={{ disabled: retrying, busy: retrying }}
        hitSlop={8}
        // يعطّل الزر بصرياً أثناء إعادة المحاولة

      >
        {retrying && <ActivityIndicator size="small" color={colors.primary} />}
        <Text style={styles.errorRetryText}>
          {retrying ? 'جارٍ المحاولة…' : retryLabel}
        </Text>
      </Pressable>

      <Text style={[styles.errorBannerText, { color: colors.ink, textAlign: 'right', fontSize: 14, lineHeight: 22, flexShrink: 1 }]} numberOfLines={4}>
        {message}
      </Text>
    </View>
  );
}