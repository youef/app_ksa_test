import {
  OasisPressable as Pressable,
  OasisSurface,
} from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { memo } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Briefcase, Camera, Map, MessageCircle, Wrench } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { styles } from './homeStyles';
import { requireAccount } from '@/lib/authGate';

/* -------------------------------------------------------------------------- */
/*                              Types & Config                                */
/* -------------------------------------------------------------------------- */

type PillProps = {
  icon: ReactNode;
  bg: string;
  label: string;
  badge?: string;
  badgeBg?: string;
  hint?: string;
  onPress?: () => void;
};

type ServiceConfig = {
  key: string;
  icon: ReactNode;
  bg: string;
  label: string;
  badge?: string;
  badgeBg?: string;
  hint?: string;
  /** هل الخدمة تحتاج حساباً؟ */
  requiresAccount: boolean;
  /** نص حوار تسجيل الدخول (إن احتاج) */
  authMessage?: string;
  /** مسار الانتقال */
  route: string;
  /** عرضها للزوار؟ */
  showToGuests?: boolean;
};

/* -------------------------------------------------------------------------- */
/*                              ServicePill                                   */
/* -------------------------------------------------------------------------- */

function ServicePillBase({
  icon,
  bg,
  label,
  badge,
  badgeBg,
  hint,
  onPress,
}: PillProps) {
  return (
    <Pressable
      oasisKind="chip"
      style={styles.servicePill}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}، ${badge}` : label}
      accessibilityHint={hint}
      hitSlop={4}
    >
      <OasisSurface
        oasisSurface="icon"
        style={[styles.serviceIconBox, { backgroundColor: bg }]}
      >
        {icon}
        {badge ? (
          <View
            style={[
              styles.servicePillBadge,
              badgeBg ? { backgroundColor: badgeBg } : undefined,
            ]}
          >
            <Text style={styles.servicePillBadgeText} numberOfLines={1}>
              {badge}
            </Text>
          </View>
        ) : null}
      </OasisSurface>
      <Text style={styles.serviceLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const ServicePill = memo(ServicePillBase);

/* -------------------------------------------------------------------------- */
/*                              ServicesGrid                                  */
/* -------------------------------------------------------------------------- */

type ServicesGridProps = {
  isGuest: boolean;
  /** يُستدعى لفتح شاشة الأدوات بدل router.push مباشرة إن أردت */
  onTools?: () => void;
};

function ServicesGridBase({ isGuest, onTools }: ServicesGridProps) {
  // تعريف الخدمات مرة واحدة
  const services: ServiceConfig[] = [
    {
      key: 'ask',
      icon: <MessageCircle size={22} color={OASIS.colors.primary} />,
      bg: OASIS.colors.soft,
      label: 'اسأل الحي',
      badge: 'فوري',
      badgeBg: OASIS.colors.primary,
      hint: 'انشر سؤالاً لجيرانك',
      requiresAccount: true,
      authMessage: 'سجّل الدخول أو أنشئ حساباً لنشر سؤالك.',
      route: '/ask',
    },
    {
      key: 'story',
      icon: <Camera size={22} color="#8b5cf6" />,
      bg: '#f5f3ff',
      label: 'يوميات الحي',
      badge: '24 ساعة',
      badgeBg: '#7c3aed',
      hint: 'أضف يوماً جديداً لحيّك',
      requiresAccount: true,
      route: '/create-story',
      // تُخفى للزوار حالياً — عدّل إلى true لإظهارها مع بوابة تسجيل الدخول
      showToGuests: false,
    },
    {
      key: 'tools',
      icon: <Wrench size={22} color={OASIS.colors.primary} />,
      bg: OASIS.colors.soft,
      label: 'إعارة أدوات',
      badge: 'سلفني',
      badgeBg: OASIS.colors.primary,
      hint: 'استعر أو أعر أدوات من جيرانك',
      requiresAccount: false,
      route: '/tools',
    },
    {
      key: 'market',
      icon: <Briefcase size={22} color={OASIS.colors.info} />,
      bg: OASIS.colors.infoSoft,
      label: 'خدمات الحي',
      badge: 'مهنيون',
      badgeBg: OASIS.colors.info,
      hint: 'اكتشف مهنيي حيّك',
      requiresAccount: true,
      route: '/market',
      showToGuests: false,
    },
    {
      key: 'map',
      icon: <Map size={22} color={OASIS.colors.primary} />,
      bg: OASIS.colors.soft,
      label: 'خريطة الحي',
      badge: 'مباشر',
      badgeBg: OASIS.colors.primary,
      hint: 'استكشف حيّك على الخريطة',
      requiresAccount: false,
      route: '/map',
    },
  ];

  const visible = services.filter((s) => !isGuest || s.showToGuests !== false);

  const handlePress = (service: ServiceConfig) => {
    if (service.requiresAccount && isGuest) {
      requireAccount(service.authMessage);
      return;
    }
    if (service.key === 'tools' && onTools) {
      onTools();
      return;
    }
    router.push(service.route);
  };

  return (
    <View style={styles.servicesGrid}>
      {visible.map((service) => (
        <ServicePill
          key={service.key}
          icon={service.icon}
          bg={service.bg}
          label={service.label}
          badge={service.badge}
          badgeBg={service.badgeBg}
          hint={service.hint}
          onPress={() => handlePress(service)}
        />
      ))}
    </View>
  );
}

export default memo(ServicesGridBase);