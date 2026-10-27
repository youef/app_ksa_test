import { OASIS } from '@/lib/oasis';
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import {
  BadgeCheck,
  BriefcaseBusiness,
  CheckCircle2,
  Crown,
  FileCheck2,
  Lightbulb,
  ShieldCheck,
  Sparkles,
  Store,
  UserRound,
  Wrench,
} from 'lucide-react-native';

export type AccountKind = 'standard' | 'merchant' | 'freelance' | 'provider' | 'idea';

type AccountIdentityMeta = {
  key: AccountKind | 'admin';
  label: string;
  shortLabel: string;
  publicTitle: string;
  verifiedTitle: string;
  description: string;
  color: string;
  verificationColor: string;
  backgroundColor: string;
  softColor: string;
  heroColors: [string, string, string];
  Icon: any;
  VerificationIcon: any;
};

export function getAccountIdentityMeta(
  role?: string | null,
  accountType?: string | null,
  isVerified?: boolean,
): AccountIdentityMeta {
  if (role === 'admin') {
    return {
      key: 'admin',
      label: 'إدارة المنصة',
      shortLabel: 'إدارة',
      publicTitle: 'حساب إداري',
      verifiedTitle: 'إدارة حيّنا الرسمية',
      description: 'حساب إداري رسمي تابع لمنصة حيّنا.',
      color: '#6D28D9',
      verificationColor: '#7C3AED',
      backgroundColor: '#F3E8FF',
      softColor: '#FAF5FF',
      heroColors: ['#2E1065', '#5B21B6', '#7C3AED'],
      Icon: Crown,
      VerificationIcon: Crown,
    };
  }

  switch (accountType) {
    case 'merchant':
      return {
        key: 'merchant',
        label: 'مؤسسة / نشاط تجاري',
        shortLabel: 'تجاري',
        publicTitle: 'حساب تجاري',
        verifiedTitle: 'حساب تجاري معتمد لدى حيّنا',
        description: 'منشأة أو متجر محلي يمثّل نشاطًا تجاريًا في حيّنا.',
        color: OASIS.colors.primary,
        verificationColor: '#B7791F',
        backgroundColor: OASIS.colors.soft,
        softColor: OASIS.colors.soft,
        heroColors: ['#052E2B', OASIS.colors.deep, '#B7791F'],
        Icon: Store,
        VerificationIcon: ShieldCheck,
      };
    case 'freelance':
      return {
        key: 'freelance',
        label: 'عمل حر',
        shortLabel: 'عمل حر',
        publicTitle: 'حساب عمل حر',
        verifiedTitle: 'حساب عمل حر معتمد لدى حيّنا',
        description: 'مستقل أو صاحب مهنة يقدم أعماله باسمه المهني.',
        color: '#1D4ED8',
        verificationColor: '#2563EB',
        backgroundColor: '#DBEAFE',
        softColor: OASIS.colors.infoSoft,
        heroColors: ['#172554', '#1D4ED8', '#3B82F6'],
        Icon: BriefcaseBusiness,
        VerificationIcon: FileCheck2,
      };
    case 'provider':
      return {
        key: 'provider',
        label: 'مقدم خدمة',
        shortLabel: 'خدمات',
        publicTitle: 'حساب مقدم خدمة',
        verifiedTitle: 'مقدم خدمة موثّق',
        description: 'حساب مهني لخدمة سكان الحي وتقديم الخدمات المحلية.',
        color: '#7C3AED',
        verificationColor: '#7C3AED',
        backgroundColor: '#EDE9FE',
        softColor: '#F5F3FF',
        heroColors: ['#2E1065', '#6D28D9', '#8B5CF6'],
        Icon: Wrench,
        VerificationIcon: CheckCircle2,
      };
    case 'idea':
      return {
        key: 'idea',
        label: 'مبادرة / مشروع',
        shortLabel: 'مبادرة',
        publicTitle: 'حساب مبادرة',
        verifiedTitle: 'مبادرة موثّقة',
        description: 'مبادرة مجتمعية أو مشروع ناشئ له حضور في المجتمع.',
        color: '#B45309',
        verificationColor: '#D97706',
        backgroundColor: '#FEF3C7',
        softColor: OASIS.colors.warningSoft,
        heroColors: ['#451A03', '#92400E', '#D97706'],
        Icon: Lightbulb,
        VerificationIcon: Sparkles,
      };
    default:
      return {
        key: 'standard',
        label: 'حساب فردي',
        shortLabel: 'فردي',
        publicTitle: 'حساب شخصي',
        verifiedTitle: 'هوية فردية موثّقة',
        description: 'حساب شخصي لأحد أفراد مجتمع حيّنا.',
        color: '#0F766E',
        verificationColor: '#0891B2',
        backgroundColor: '#CCFBF1',
        softColor: '#F0FDFA',
        heroColors: ['#083344', '#0F766E', '#0D9488'],
        Icon: UserRound,
        VerificationIcon: BadgeCheck,
      };
  }
}

export function AccountIdentityBadge({
  role,
  accountType,
  isVerified,
  compact = false,
  style,
}: {
  role?: string | null;
  accountType?: string | null;
  isVerified?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const meta = getAccountIdentityMeta(role, accountType, isVerified);
  const verified = Boolean(isVerified) || role === 'admin';
  const Icon = verified ? meta.VerificationIcon : meta.Icon;
  const label = verified ? meta.verifiedTitle : compact ? meta.shortLabel : meta.label;

  return (
    <View accessible accessibilityLabel={label}
      style={[
        styles.badge,
        compact && styles.badgeCompact,
        { backgroundColor: meta.backgroundColor, borderColor: meta.color + '33' },
        style,
      ]}
    >
      <Icon size={compact ? 12 : 14} color={meta.color} />
      <Text style={[styles.badgeText, compact && styles.badgeTextCompact, { color: meta.color }]}>
        {label}
      </Text>
    </View>
  );
}

/** Compatibility entry point; render either this or AccountIdentityBadge, never both. */
export function AccountVerificationBadge(props: React.ComponentProps<typeof AccountIdentityBadge>) {
  if (!props.isVerified && props.role !== 'admin') return null;
  return <AccountIdentityBadge {...props} />;
}

/** The sole account mark next to a name; no avatar overlay or secondary seal. */
export function AccountStatusMark({role,accountType,isVerified,size=20}:{role?:string|null;accountType?:string|null;isVerified?:boolean;size?:number}) {
  if (role !== 'admin' && !isVerified && (!accountType || accountType === 'standard')) return null;
  const meta = getAccountIdentityMeta(role,accountType,isVerified);
  const verified=Boolean(isVerified) || role === 'admin';
  const Icon=verified ? meta.VerificationIcon : meta.Icon;
  return <View accessible accessibilityLabel={verified ? meta.verifiedTitle : meta.publicTitle} testID="account-status-mark" style={{alignItems:'center',justifyContent:'center',width:size+4,height:size+4}}><Icon size={size} color={verified ? meta.verificationColor : meta.color} /></View>;
}

export function AccountIdentityIcon({
  role,
  accountType,
  isVerified,
  size = 28,
  style,
}: {
  role?: string | null;
  accountType?: string | null;
  isVerified?: boolean;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const meta = getAccountIdentityMeta(role, accountType, isVerified);
  const Icon = isVerified || role === 'admin' ? meta.VerificationIcon : meta.Icon;

  return (
    <View
      style={[
        styles.icon,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: meta.color,
        },
        style,
      ]}
    >
      <Icon size={Math.max(12, Math.round(size * 0.5))} color={OASIS.colors.surface} />

    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  badgeTextCompact: {
    fontSize: 11,
  },
  verificationBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  verificationBadgeCompact: {
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    gap: 4,
  },
  verificationSeal: {
    width: 19,
    height: 19,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verificationText: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
  },
  verificationTextCompact: {
    fontSize: 11,
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: OASIS.colors.surface,
  },
  verifiedDot: {
    position: 'absolute',
    right: -5,
    bottom: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: OASIS.colors.surface,
  },
});
