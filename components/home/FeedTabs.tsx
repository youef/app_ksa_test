import { Pressable, ScrollView, Text, View } from 'react-native';
import { Flame, Layers3, MessageCircle, Package, UserRound, Wrench } from 'lucide-react-native';
import { styles } from './homeStyles';
import type { HomeTab } from '@/lib/homeUtils';

type Props = {
  activeTab: HomeTab;
  onChange: (tab: HomeTab) => void;
  counts: { mine: number; emergency: number; tools: number; questions: number; requests: number };
  isGuest: boolean;
};

export default function FeedTabs({ activeTab, onChange, counts, isGuest }: Props) {
  const tabs: { key: HomeTab; label: string; count?: number; Icon: typeof Layers3; tone?: 'red' | 'green' | 'purple' }[] = [
    { key: 'all', label: 'الكل', Icon: Layers3 },
    ...(!isGuest ? [{ key: 'mine' as const, label: 'منشوراتي', count: counts.mine, Icon: UserRound, tone: 'purple' as const }] : []),
    ...(counts.emergency > 0 ? [{ key: 'emergency' as const, label: 'طوارئ', count: counts.emergency, Icon: Flame, tone: 'red' as const }] : []),
    { key: 'tools', label: 'إعارة', count: counts.tools, Icon: Wrench, tone: 'green' },
    { key: 'questions', label: 'استفسارات', count: counts.questions, Icon: MessageCircle },
    { key: 'requests', label: 'طلبات', count: counts.requests, Icon: Package },
  ];

  return (
    <View style={styles.filterWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterChips}
        keyboardShouldPersistTaps="handled"
      >
        {tabs.map(({ key, label, count, Icon, tone }) => {
          const active = activeTab === key;
          return (
            <Pressable
              key={key}
              style={[
                styles.filterChip,
                active && styles.filterChipActive,
                active && tone === 'red' && styles.filterChipActiveRed,
                active && tone === 'green' && styles.filterChipActiveGreen,
                active && tone === 'purple' && styles.filterChipActivePurple,
              ]}
              onPress={() => onChange(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={count === undefined ? label : `${label}، ${count}`}
            >
              <Icon size={15} color={active ? '#fff' : '#64748b'} strokeWidth={2.2} />
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
              {count !== undefined && count > 0 && (
                <View style={[styles.filterCount, active && styles.filterCountActive]}>
                  <Text style={[styles.filterCountText, active && styles.filterCountTextActive]}>
                    {count > 99 ? '99+' : count}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
