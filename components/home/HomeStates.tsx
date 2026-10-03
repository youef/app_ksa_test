import { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { styles } from './homeStyles';

export function FeedSkeleton({ count = 3 }: { count?: number }) {
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Animated.View key={i} style={[styles.skeletonCard, { opacity }]} accessibilityLabel="جارٍ التحميل">
          <View style={[styles.skeletonLine, { width: '45%' }]} />
          <View style={[styles.skeletonLine, { width: '90%' }]} />
          <View style={[styles.skeletonLine, { width: '70%' }]} />
        </Animated.View>
      ))}
    </>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.errorBanner} accessibilityRole="alert">
      <Pressable style={styles.errorRetryBtn} onPress={onRetry} accessibilityRole="button">
        <Text style={styles.errorRetryText}>إعادة المحاولة</Text>
      </Pressable>
      <Text style={styles.errorBannerText}>{message}</Text>
    </View>
  );
}
