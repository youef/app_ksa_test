import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';

type Props = {
  title: string;
  fallbackRoute: string;
  rightAction?: ReactNode;
  subtitle?: string;
  variant?: 'gradient' | 'plain';
};

export default function ScreenHeader({ title, fallbackRoute, rightAction, subtitle, variant = 'gradient' }: Props) {
  const plain = variant === 'plain';
  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(fallbackRoute as never);
    }
  };

  return (
    <View style={[styles.row, plain && styles.plainRow]}>
      <Pressable
        onPress={goBack}
        style={[styles.action, plain && styles.plainAction]}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="رجوع"
      >
        <ChevronRight size={24} color={plain ? '#059669' : '#fff'} />
      </Pressable>
      <View style={styles.titleWrap}>
        <Text style={[styles.title, plain && styles.plainTitle]} numberOfLines={1} ellipsizeMode="tail">
          {title}
        </Text>
        {subtitle ? <Text style={[styles.subtitle, plain && styles.plainSubtitle]} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {rightAction ? <View style={styles.rightAction}>{rightAction}</View> : <View style={styles.actionSpacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 48,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  plainRow: {
    paddingHorizontal: 16,
  },
  action: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSpacer: {
    width: 40,
    height: 40,
  },
  plainAction: {
    backgroundColor: '#ecfdf5',
  },
  rightAction: {
    minWidth: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  plainTitle: {
    color: '#0f172a',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    textAlign: 'center',
  },
  plainSubtitle: {
    color: '#64748b',
  },
});
