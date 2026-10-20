import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Check,
  ChevronLeft,
  Clock3,
  ShieldCheck,
} from 'lucide-react-native';
import {
  AccountIdentityBadge,
  AccountVerificationBadge,
  getAccountIdentityMeta,
  type AccountKind,
} from './AccountIdentityBadge';

const ACCOUNT_TYPES: AccountKind[] = ['standard', 'merchant', 'freelance', 'provider', 'idea'];

export function ProfileIdentityCard({
  role,
  accountType,
  isVerified,
  descriptor,
  pending = false,
  rejected = false,
  owner = false,
  onManage,
  onSelectType,
}: {
  role?: string | null;
  accountType?: string | null;
  isVerified?: boolean;
  descriptor?: string | null;
  pending?: boolean;
  rejected?: boolean;
  owner?: boolean;
  onManage?: () => void;
  onSelectType?: (type: AccountKind) => void;
}) {
  const meta = getAccountIdentityMeta(role, accountType, isVerified);
  const Icon = meta.Icon;

  const statusText = pending
    ? 'طلب تغيير الصفة قيد مراجعة الإدارة'
    : rejected
      ? 'آخر طلب تغيير لم يُعتمد'
      : isVerified || role === 'admin'
        ? 'تمت مراجعة هوية الحساب واعتمادها'
        : 'نوع الحساب ظاهر، والتوثيق الرسمي غير مكتمل';

  return (
    <View style={[styles.card, { borderColor: meta.color + '26' }]}>
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: meta.softColor, borderColor: meta.color + '26' }]}>
          <Icon size={26} color={meta.color} />
        </View>

        <View style={styles.headingText}>
          <Text style={styles.eyebrow}>هوية الحساب</Text>
          <Text style={styles.title}>{meta.publicTitle}</Text>
          <Text style={styles.description}>
            {descriptor?.trim() || meta.description}
          </Text>
        </View>
      </View>

      <View style={styles.badgesRow}>
        <AccountIdentityBadge
          role={role}
          accountType={accountType}
          isVerified={isVerified}
        />
        <AccountVerificationBadge
          role={role}
          accountType={accountType}
          isVerified={isVerified}
        />
      </View>

      <View
        style={[
          styles.statusBox,
          {
            backgroundColor: pending
              ? '#FFFBEB'
              : rejected
                ? '#FFF7ED'
                : isVerified || role === 'admin'
                  ? meta.softColor
                  : '#F8FAFC',
            borderColor: pending
              ? '#FDE68A'
              : rejected
                ? '#FED7AA'
                : isVerified || role === 'admin'
                  ? meta.color + '26'
                  : '#E2E8F0',
          },
        ]}
      >
        {pending ? (
          <Clock3 size={15} color="#B45309" />
        ) : (
          <ShieldCheck
            size={15}
            color={isVerified || role === 'admin' ? meta.verificationColor : '#64748B'}
          />
        )}
        <Text
          style={[
            styles.statusText,
            {
              color: pending
                ? '#92400E'
                : rejected
                  ? '#C2410C'
                  : isVerified || role === 'admin'
                    ? meta.color
                    : '#64748B',
            },
          ]}
        >
          {statusText}
        </Text>
      </View>

      {owner && role !== 'admin' ? (
        <View style={styles.ownerSection}>
          <View style={styles.ownerHeading}>
            <Text style={styles.ownerTitle}>غيّر نوع الحساب</Text>
            <Text style={styles.ownerSub}>اختر الصفة التي تمثلك. الصفات المهنية تُعتمد بعد مراجعة الإدارة.</Text>
          </View>

          <View style={styles.typeGrid}>
            {ACCOUNT_TYPES.map((type) => {
              const item = getAccountIdentityMeta('user', type, false);
              const TypeIcon = item.Icon;
              const active = (accountType || 'standard') === type;

              return (
                <Pressable
                  key={type}
                  onPress={() => onSelectType?.(type)}
                  accessibilityRole="button"
                  accessibilityLabel={`اختيار ${item.label}`}
                  style={[
                    styles.typeOption,
                    active && { backgroundColor: item.softColor, borderColor: item.color + '55' },
                  ]}
                >
                  <View style={[styles.typeOptionIcon, { backgroundColor: item.backgroundColor }]}>
                    <TypeIcon size={17} color={item.color} />
                  </View>
                  <Text
                    numberOfLines={1}
                    style={[styles.typeOptionText, active && { color: item.color }]}
                  >
                    {item.shortLabel}
                  </Text>
                  {active ? (
                    <View style={[styles.activeMark, { backgroundColor: item.color }]}>
                      <Check size={9} color="#FFFFFF" />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {onManage ? (
        <Pressable
          onPress={onManage}
          accessibilityRole="button"
          accessibilityLabel={owner ? 'إدارة نوع الحساب والتوثيق' : 'عرض إعدادات الهوية'}
          style={[styles.manageButton, { backgroundColor: meta.softColor }]}
        >
          <Text style={[styles.manageText, { color: meta.color }]}>
            {owner ? 'إدارة الهوية والتوثيق' : 'تفاصيل الهوية'}
          </Text>
          <ChevronLeft size={16} color={meta.color} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    padding: 15,
    gap: 12,
    shadowColor: '#0F172A',
    shadowOpacity: 0.045,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingText: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 2,
  },
  eyebrow: {
    color: '#94A3B8',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  title: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'right',
  },
  description: {
    color: '#64748B',
    fontSize: 10.5,
    lineHeight: 17,
    fontWeight: '600',
    textAlign: 'right',
  },
  badgesRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 7,
  },
  statusBox: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 7,
  },
  statusText: {
    flex: 1,
    fontSize: 10.5,
    fontWeight: '800',
    textAlign: 'right',
  },
  ownerSection: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 11,
    gap: 10,
  },
  ownerHeading: {
    alignItems: 'flex-end',
    gap: 2,
  },
  ownerTitle: {
    color: '#0F172A',
    fontSize: 12.5,
    fontWeight: '900',
  },
  ownerSub: {
    color: '#64748B',
    fontSize: 9.5,
    lineHeight: 15,
    fontWeight: '600',
    textAlign: 'right',
  },
  typeGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 7,
  },
  typeOption: {
    minWidth: 92,
    flexGrow: 1,
    flexBasis: '30%',
    minHeight: 42,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 7,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    position: 'relative',
  },
  typeOptionIcon: {
    width: 27,
    height: 27,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeOptionText: {
    flex: 1,
    color: '#475569',
    fontSize: 10.5,
    fontWeight: '900',
    textAlign: 'right',
  },
  activeMark: {
    width: 15,
    height: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageButton: {
    minHeight: 42,
    borderRadius: 13,
    paddingHorizontal: 12,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  manageText: {
    fontSize: 11.5,
    fontWeight: '900',
  },
});
