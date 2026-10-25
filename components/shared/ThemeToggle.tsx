/**
 * ThemeToggle — Three-way mode selector: Light / System / Dark
 * Used in the Settings tab of AccountCenter.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View, Animated, Platform } from 'react-native';
import { Sun, Moon, Smartphone } from 'lucide-react-native';
import { useTheme, type ThemeMode } from '@/context/ThemeContext';

interface Option {
  mode: ThemeMode;
  label: string;
  Icon: React.ComponentType<{ size: number; color: string }>;
}

const OPTIONS: Option[] = [
  { mode: 'light', label: 'فاتح', Icon: Sun },
  { mode: 'system', label: 'تلقائي', Icon: Smartphone },
  { mode: 'dark', label: 'داكن', Icon: Moon },
];

export function ThemeToggle() {
  const { mode, setMode, isDark, colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA' }]}>
      {OPTIONS.map(({ mode: m, label, Icon }) => {
        const active = mode === m;
        return (
          <Pressable
            key={m}
            onPress={() => setMode(m)}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: active }}
            style={[
              styles.option,
              active && [styles.optionActive, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', shadowColor: isDark ? '#000' : 'rgba(0,0,0,0.12)' }],
            ]}
          >
            <Icon
              size={18}
              color={active ? colors.primary : colors.muted}
            />
            <Text style={[
              styles.label,
              { color: active ? colors.ink : colors.muted },
              active && styles.labelActive,
            ]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row-reverse',
    borderRadius: 14,
    padding: 4,
    gap: 3,
  },
  option: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 11,
  },
  optionActive: {
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
  labelActive: {
    fontWeight: '700',
  },
});
