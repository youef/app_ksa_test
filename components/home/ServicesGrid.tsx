import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Briefcase, Camera, Map, MessageCircle, Truck, Wrench } from 'lucide-react-native';
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
    <Pressable style={styles.servicePill} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <View style={[styles.serviceIconBox, { backgroundColor: bg }]}>
        {icon}
        {badge ? (
          <View style={[styles.servicePillBadge, badgeBg ? { backgroundColor: badgeBg } : {}]}>
            <Text style={styles.servicePillBadgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.serviceLabel} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export default function ServicesGrid({ onTools, isGuest }: { onTools: () => void; isGuest: boolean }) {
  return (
    <View style={styles.servicesGrid}>
      <ServicePill icon={<MessageCircle size={22} color="#059669" />} bg="#ecfdf5" label="اسأل الحي" badge="فوري" badgeBg="#059669" onPress={() => isGuest ? requireAccount('سجّل الدخول أو أنشئ حساباً لنشر سؤالك.') : router.push('/ask')} />
      {!isGuest && <ServicePill icon={<Camera size={22} color="#8b5cf6" />} bg="#f5f3ff" label="يوميات الحي" badge="24 ساعة" badgeBg="#7c3aed" onPress={() => router.push('/create-story')} />}
      <ServicePill icon={<Wrench size={22} color="#16a34a" />} bg="#f0fdf4" label="إعارة أدوات" badge="مجاني" badgeBg="#16a34a" onPress={onTools} />
      {!isGuest && <ServicePill icon={<Briefcase size={22} color="#0284c7" />} bg="#f0f9ff" label="خدمات الحي" badge="مهنيون" badgeBg="#0284c7" onPress={() => router.push('/market')} />}
      <ServicePill icon={<Truck size={22} color="#d97706" />} bg="#fffbeb" label="فزعة وطلبات" badge="تعاون" badgeBg="#d97706" onPress={() => router.push('/requests')} />
      <ServicePill icon={<Map size={22} color="#059669" />} bg="#ecfdf5" label="خريطة الحي" badge="مباشر" badgeBg="#059669" onPress={() => router.push('/map')} />
    </View>
  );
}
