import { Pressable, ScrollView, Text, View } from 'react-native';
import { Flame, Map, MessageCircle, Truck, User, Wrench } from 'lucide-react-native';
import { styles } from './homeStyles';
import type { HomeTab } from '@/lib/homeUtils';

type Props = {
  activeTab: HomeTab;
  onChange: (tab: HomeTab) => void;
  counts: { mine: number; emergency: number; tools: number; questions: number; requests: number };
  isGuest: boolean;
};

export default function FeedTabs({ activeTab, onChange, counts, isGuest }: Props) {
  const tab = (
    key: HomeTab,
    label: string,
    Icon: any,
    activeStyle: any,
  ) => {
    const active = activeTab === key;
    return (
      <Pressable
        key={key}
        style={[styles.fTab, active && activeStyle]}
        onPress={() => onChange(key)}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={label}
      >
        <View style={styles.fTabLabelRow}>
          <Icon size={15} color={active ? '#fff' : '#475569'} />
          <Text style={[styles.fTabText, active && styles.fTabTextActive]}>{label}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.floatingTabs}>
      {tab('all', 'الكل', Map, styles.fTabActive)}
      {!isGuest && tab('mine', `منشوراتي (${counts.mine})`, User, styles.fTabActiveMine)}
      {counts.emergency > 0 && tab('emergency', `طوارئ (${counts.emergency})`, Flame, styles.fTabActiveRed)}
      {tab('tools', `إعارة (${counts.tools})`, Wrench, styles.fTabActiveGreen)}
      {tab('questions', `استفسارات (${counts.questions})`, MessageCircle, styles.fTabActive)}
      {tab('requests', `فزعة (${counts.requests})`, Truck, styles.fTabActive)}
    </ScrollView>
  );
}
