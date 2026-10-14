import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

export type SupportStatus = 'open' | 'reviewing' | 'resolved' | 'closed';

export const SUPPORT_STATUSES: Record<SupportStatus, { label: string; color: string; bg: string }> = {
  open: { label: 'جديدة', color: '#B45309', bg: '#FEF3C7' },
  reviewing: { label: 'قيد المعالجة', color: '#1D4ED8', bg: '#DBEAFE' },
  resolved: { label: 'تم الحل', color: '#047857', bg: '#D1FAE5' },
  closed: { label: 'مغلقة', color: '#475569', bg: '#E2E8F0' },
};

export function SupportStatusBadge({ status, compact = false }: { status: SupportStatus; compact?: boolean }) {
  const item = SUPPORT_STATUSES[status] ?? SUPPORT_STATUSES.open;
  return <View style={{ backgroundColor: item.bg, borderRadius: 99, paddingHorizontal: compact ? 8 : 10, paddingVertical: compact ? 5 : 7, alignSelf: 'flex-start' }}>
    <Text style={{ color: item.color, fontSize: compact ? 10 : 11, fontWeight: '900' }}>{item.label}</Text>
  </View>;
}

export function SupportEmptyState({ title, description, icon }: { title: string; description?: string; icon?: React.ReactNode }) {
  return <View style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 18, padding: 26, alignItems: 'center', justifyContent: 'center', gap: 9 }}>
    {icon}
    <Text style={{ color: '#0F172A', fontSize: 15, fontWeight: '900', textAlign: 'center' }}>{title}</Text>
    {!!description && <Text style={{ color: '#64748B', fontSize: 12, lineHeight: 20, textAlign: 'center' }}>{description}</Text>}
  </View>;
}

export function SupportSectionHeading({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
    <View style={{ flex: 1, gap: 3 }}>
      <Text style={{ color: '#0F172A', fontSize: 15, fontWeight: '900', textAlign: 'right' }}>{title}</Text>
      {!!subtitle && <Text style={{ color: '#64748B', fontSize: 11, textAlign: 'right' }}>{subtitle}</Text>}
    </View>
    {action}
  </View>;
}

export function SupportLoadingState() {
  return <View style={{ padding: 36, alignItems: 'center' }}><ActivityIndicator size="large" color="#0F766E" /></View>;
}
