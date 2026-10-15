import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

type Props = { emoji: string; name?: string; style: StyleProp<ViewStyle>; duration?: number };

export default function FloatingEffect({ emoji, name, style, duration = 1900 }: Props) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(progress, { toValue: 1, duration, useNativeDriver: false });
    animation.start();
    return () => animation.stop();
  }, [duration, progress]);

  return (
    <Animated.View pointerEvents="none" style={[style, {
      opacity: progress.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] }),
      transform: [
        { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [10, -110] }) },
        { scale: progress.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0.6, 1.1, 0.9] }) },
      ],
    }]}>
      {name ? (
        <View style={styles.effectBubble}>
          <Text style={styles.effectName} numberOfLines={1}>{name}</Text>
          <Text style={styles.giftBurstText}>{emoji}</Text>
        </View>
      ) : <Text style={styles.giftBurstText}>{emoji}</Text>}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  effectBubble: { alignItems: 'center' },
  effectName: { color: '#fff', fontSize: 9, fontWeight: '800', maxWidth: 62, backgroundColor: 'rgba(2,6,23,0.55)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 7, marginBottom: 2 },
  giftBurstText: { fontSize: 22 },
});
