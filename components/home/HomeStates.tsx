import { OasisPressable as Pressable } from '@/components/oasis/OasisPrimitives';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
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
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
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
  }, [opacity]);

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
    >
      {items.map((key) => (
        <Animated.View
          key={key}
          style={[styles.skeletonCard, { opacity }]}
          // أخفِ العناصر الفردية عن قارئ الشاشة، الحاوية تكفي
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <View style={[styles.skeletonLine, { width: titleWidth }]} />
          <View style={[styles.skeletonLine, { width: '90%' }]} />
          <View style={[styles.skeletonLine, { width: '70%' }]} />
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
  return (
    <View
      style={styles.errorBanner}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      accessibilityLabel={`خطأ: ${message}`}
    >
      <Pressable
        oasisKind="action"
        style={styles.errorRetryBtn}
        onPress={onRetry}
        disabled={retrying}
        accessibilityRole="button"
        accessibilityLabel={retryLabel}
        accessibilityState={{ disabled: retrying, busy: retrying }}
        hitSlop={8}
        // يعطّل الزر بصرياً أثناء إعادة المحاولة
        {...(retrying ? { opacity: 0.6 } : null)}
      >
        <Text style={styles.errorRetryText}>
          {retrying ? 'جارٍ المحاولة…' : retryLabel}
        </Text>
      </Pressable>

      <Text style={styles.errorBannerText} numberOfLines={4}>
        {message}
      </Text>
    </View>
  );
}