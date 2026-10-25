import { OASIS } from '@/lib/oasis';
import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

export type SupportStatus = 'open' | 'reviewing' | 'resolved' | 'closed';

export const SUPPORT_STATUSES: Record<SupportStatus, { label: string; color: string; bg: string }> = {
  open: { label: 'جديدة', color: '#B45309', bg: '#FEF3C7' },
  reviewing: { label: 'قيد المعالجة', color: '#1D4ED8', bg: '#DBEAFE' },
  resolved: { label: 'تم الحل', color: OASIS.colors.primary, bg: OASIS.colors.soft },
  closed: { label: 'مغلقة', color: OASIS.colors.muted, bg: OASIS.colors.line },
};

export function SupportStatusBadge({ status, compact = false }: { status: SupportStatus; compact?: boolean }) {
  const item = SUPPORT_STATUSES[status] ?? SUPPORT_STATUSES.open;
  return <View style={{ backgroundColor: item.bg, borderRadius: 99, paddingHorizontal: compact ? 8 : 10, paddingVertical: compact ? 5 : 7, alignSelf: 'flex-start' }}>
    <Text style={{ color: item.color, fontSize: compact ? 10 : 11, fontWeight: '700' }}>{item.label}</Text>
  </View>;
}

export function SupportEmptyState({ title, description, icon }: { title: string; description?: string; icon?: React.ReactNode }) {
  return <View style={{ backgroundColor: OASIS.colors.surface, borderWidth: 1, borderColor: OASIS.colors.line, borderRadius: 14, padding: 16, alignItems: 'center', justifyContent: 'center', gap: 9 }}>
    {icon}
    <Text style={{ color: OASIS.colors.ink, fontSize: 15, fontWeight: '700', textAlign: 'center' }}>{title}</Text>
    {!!description && <Text style={{ color: OASIS.colors.muted, fontSize: 12, lineHeight: 20, textAlign: 'center' }}>{description}</Text>}
  </View>;
}

export function SupportSectionHeading({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
    <View style={{ flex: 1, gap: 3 }}>
      <Text style={{ color: OASIS.colors.ink, fontSize: 15, fontWeight: '700', textAlign: 'right' }}>{title}</Text>
      {!!subtitle && <Text style={{ color: OASIS.colors.muted, fontSize: 11, textAlign: 'right' }}>{subtitle}</Text>}
    </View>
    {action}
  </View>;
}

export function SupportLoadingState() {
  return <View style={{ padding: 24, alignItems: 'center' }}><ActivityIndicator size="large" color="#0F766E" /></View>;
}
