import { OasisPressable as Pressable, OasisSurface } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Briefcase, Camera, Map, MessageCircle, Wrench } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { styles } from './homeStyles';
import { requireAccount } from '@/lib/authGate';

type PillProps = {
  icon: ReactNode;
  bg: string;
  label: string;
  badge?: string;
  badgeBg?: string;
  onPress?: () => void;
};

function ServicePill({ icon, bg, label, badge, badgeBg, onPress }: PillProps) {
  return (
    <Pressable oasisKind="chip" style={styles.servicePill} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <OasisSurface oasisSurface="icon" style={[styles.serviceIconBox, { backgroundColor: bg }]}>
        {icon}
        {badge ? (
          <View style={[styles.servicePillBadge, badgeBg ? { backgroundColor: badgeBg } : {}]}>
            <Text style={styles.servicePillBadgeText}>{badge}</Text>
          </View>
        ) : null}
      </OasisSurface>
      <Text style={styles.serviceLabel} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export default function ServicesGrid({ onTools, isGuest }: { onTools: () => void; isGuest: boolean }) {
  return (
    <View style={styles.servicesGrid}>
      <ServicePill icon={<MessageCircle size={22} color={OASIS.colors.primary} />} bg={OASIS.colors.soft} label="اسأل الحي" badge="فوري" badgeBg={OASIS.colors.primary} onPress={() => isGuest ? requireAccount('سجّل الدخول أو أنشئ حساباً لنشر سؤالك.') : router.push('/ask')} />
      {!isGuest && <ServicePill icon={<Camera size={22} color="#8b5cf6" />} bg="#f5f3ff" label="يوميات الحي" badge="24 ساعة" badgeBg="#7c3aed" onPress={() => router.push('/create-story')} />}
      <ServicePill icon={<Wrench size={22} color={OASIS.colors.primary} />} bg={OASIS.colors.soft} label="إعارة أدوات" badge="سلفني" badgeBg={OASIS.colors.primary} onPress={() => router.push('/tools')} />
      {!isGuest && <ServicePill icon={<Briefcase size={22} color={OASIS.colors.info} />} bg={OASIS.colors.infoSoft} label="خدمات الحي" badge="مهنيون" badgeBg={OASIS.colors.info} onPress={() => router.push('/market')} />}
      <ServicePill icon={<Map size={22} color={OASIS.colors.primary} />} bg={OASIS.colors.soft} label="خريطة الحي" badge="مباشر" badgeBg={OASIS.colors.primary} onPress={() => router.push('/map')} />
    </View>
  );
}
