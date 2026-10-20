import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import {
  BadgeCheck,
  BriefcaseBusiness,
  Crown,
  Lightbulb,
  Store,
  UserRound,
  Wrench,
} from 'lucide-react-native';

export type AccountKind = 'standard' | 'merchant' | 'freelance' | 'provider' | 'idea';

export function getAccountIdentityMeta(
  role?: string | null,
  accountType?: string | null,
  isVerified?: boolean,
) {
  if (role === 'admin') {
    return {
      label: 'مدير النظام',
      shortLabel: 'إدارة',
      color: '#7C3AED',
      backgroundColor: '#F3E8FF',
      Icon: Crown,
    };
  }

  switch (accountType) {
    case 'merchant':
      return {
        label: isVerified ? 'منشأة موثقة' : 'منشأة',
        shortLabel: 'تجاري',
        color: '#047857',
        backgroundColor: '#D1FAE5',
        Icon: Store,
      };
    case 'freelance':
      return {
        label: isVerified ? 'عمل حر موثّق' : 'عمل حر',
        shortLabel: 'عمل حر',
        color: '#1D4ED8',
        backgroundColor: '#DBEAFE',
        Icon: BriefcaseBusiness,
      };
    case 'provider':
      return {
        label: isVerified ? 'مقدم خدمة موثّق' : 'مقدم خدمة',
        shortLabel: 'خدمات',
        color: '#7C3AED',
        backgroundColor: '#EDE9FE',
        Icon: Wrench,
      };
    case 'idea':
      return {
        label: isVerified ? 'مبادرة موثقة' : 'مبادرة',
        shortLabel: 'مبادرة',
        color: '#B45309',
        backgroundColor: '#FEF3C7',
        Icon: Lightbulb,
      };
    default:
      return {
        label: isVerified ? 'حساب فردي موثّق' : 'حساب فردي',
        shortLabel: 'فردي',
        color: '#0F766E',
        backgroundColor: '#CCFBF1',
        Icon: UserRound,
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
  const Icon = meta.Icon;

  return (
    <View
      style={[
        styles.badge,
        compact && styles.badgeCompact,
        { backgroundColor: meta.backgroundColor, borderColor: meta.color + '33' },
        style,
      ]}
    >
      <Icon size={compact ? 12 : 14} color={meta.color} />
      <Text style={[styles.badgeText, compact && styles.badgeTextCompact, { color: meta.color }]}>
        {compact ? meta.shortLabel : meta.label}
      </Text>
      {isVerified ? <BadgeCheck size={compact ? 12 : 14} color={meta.color} /> : null}
    </View>
  );
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
  const Icon = meta.Icon;

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
      <Icon size={Math.max(12, Math.round(size * 0.5))} color="#FFFFFF" />
      {isVerified ? (
        <View style={styles.verifiedDot}>
          <BadgeCheck size={10} color="#FFFFFF" />
        </View>
      ) : null}
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
    fontWeight: '800',
    textAlign: 'right',
  },
  badgeTextCompact: {
    fontSize: 10,
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  verifiedDot: {
    position: 'absolute',
    right: -5,
    bottom: -4,
    width: 15,
    height: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
});
