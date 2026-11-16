import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Platform, Text, View, type GestureResponderEvent } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

/**
 * App-level pull refresh for pages that do not own a native RefreshControl.
 * Keep the gesture on the header edge to avoid hijacking nested lists,
 * carousels, maps, and horizontal gestures.
 */
export default function GlobalSwipeRefresh({
  children,
  onRefresh,
  disabled = false,
}: {
  children: ReactNode;
  onRefresh: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const initial = useRef<{ x: number; y: number; at: number } | null>(null);
  const busy = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    return () => progress.stopAnimation();
  }, [progress]);

  const begin = useCallback((event: GestureResponderEvent) => {
    if (disabled || busy.current) return;
    const { pageX, pageY } = event.nativeEvent;
    // Only start in the page-header area, not in forms and scrollable feeds.
    initial.current = pageY <= 110 ? { x: pageX, y: pageY, at: Date.now() } : null;
  }, [disabled]);

  const end = useCallback((event: GestureResponderEvent) => {
    const start = initial.current;
    initial.current = null;
    if (!start || busy.current || disabled) return;
    const { pageX, pageY } = event.nativeEvent;
    const dy = pageY - start.y;
    const dx = Math.abs(pageX - start.x);
    // A deliberate downward pull, rather than a horizontal swipe or a tap.
    if (dy < 85 || dx > 65 || dy < dx * 1.5 || Date.now() - start.at > 2400) return;
    busy.current = true;
    setRefreshing(true);
    progress.setValue(0);
    Animated.sequence([
      Animated.timing(progress, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(650),
      Animated.timing(progress, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => {
      busy.current = false;
      setRefreshing(false);
    });
    onRefresh();
  }, [disabled, onRefresh, progress]);

  return (
    <View style={{ flex: 1 }} onTouchStart={begin} onTouchEnd={end} onTouchCancel={() => { initial.current = null; }}>
      {children}
      {refreshing && (
        <Animated.View pointerEvents="none" accessibilityLiveRegion="polite"
          style={{
            position: 'absolute', top: Platform.OS === 'ios' ? 52 : 24,
            alignSelf: 'center', zIndex: 1000, opacity: progress,
            transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-15, 0] }) }],
            flexDirection: 'row', gap: 9, alignItems: 'center',
            borderRadius: 24, paddingHorizontal: 17, paddingVertical: 11,
            backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line,
            shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 14, elevation: 9,
          }}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '700' }}>جارٍ تحديث البيانات…</Text>
        </Animated.View>
      )}
    </View>
  );
}
