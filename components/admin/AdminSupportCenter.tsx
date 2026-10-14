import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { CheckCircle2, ChevronDown, ChevronUp, Clock3, LifeBuoy, Mail, RefreshCw, Search, ShieldCheck, XCircle } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

type TicketStatus = 'open' | 'reviewing' | 'resolved' | 'closed';
type SupportTicket = {
  id: string;
  user_id: string | null;
  name: string;
  email: string | null;
  subject: string;
  message: string;
  status: TicketStatus;
  created_at: string;
  resolved_at: string | null;
};
type FilterKey = 'all' | TicketStatus;
const STATUS: Record<TicketStatus, { label: string; color: string; bg: string }> = {
  open: { label: 'جديدة', color: '#B45309', bg: '#FEF3C7' },
  reviewing: { label: 'قيد المراجعة', color: '#1D4ED8', bg: '#DBEAFE' },
  resolved: { label: 'تم الحل', color: '#047857', bg: '#D1FAE5' },
  closed: { label: 'مغلقة', color: '#475569', bg: '#E2E8F0' },
};
const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'الكل' }, { key: 'open', label: 'جديدة' },
  { key: 'reviewing', label: 'قيد المراجعة' }, { key: 'resolved', label: 'تم الحل' },
  { key: 'closed', label: 'مغلقة' },
];
const fmtDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'تاريخ غير متاح' : date.toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' });
};

export function AdminSupportCenter({ onToast }: { onToast: (message: string) => void }) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');

  const loadTickets = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true); else setLoading(true);
    setLoadError('');
    try {
      const { data, error } = await supabase.from('support_tickets')
        .select('id,user_id,name,email,subject,message,status,created_at,resolved_at')
        .order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      setTickets((data || []) as SupportTicket[]);
    } catch (error: any) {
      setLoadError(error?.message || 'تعذر تحميل تذاكر الدعم. تحقق من اتصال قاعدة البيانات وسياسات الصلاحيات.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useEffect(() => { void loadTickets(); }, [loadTickets]);

  const counts = useMemo(() => ({
    all: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    reviewing: tickets.filter(t => t.status === 'reviewing').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    closed: tickets.filter(t => t.status === 'closed').length,
  }), [tickets]);
  const visibleTickets = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return tickets.filter(ticket => {
      if (filter !== 'all' && ticket.status !== filter) return false;
      if (!term) return true;
      return [ticket.subject, ticket.message, ticket.name, ticket.email || '', ticket.id]
        .some(value => value.toLocaleLowerCase().includes(term));
    });
  }, [tickets, filter, query]);

  const updateStatus = async (ticket: SupportTicket, nextStatus: TicketStatus) => {
    setBusyId(ticket.id);
    try {
      const patch = {
        status: nextStatus,
        resolved_at: nextStatus === 'resolved' || nextStatus === 'closed' ? new Date().toISOString() : null,
      };
      const { error } = await supabase.from('support_tickets').update(patch).eq('id', ticket.id);
      if (error) throw error;
      setTickets(prev => prev.map(item => item.id === ticket.id ? { ...item, ...patch } : item));
      onToast(nextStatus === 'resolved' ? 'تم حل التذكرة وتوثيق الإجراء بنجاح' : nextStatus === 'reviewing' ? 'تم نقل التذكرة إلى قيد المراجعة' : nextStatus === 'closed' ? 'تم إغلاق التذكرة' : 'تمت إعادة فتح التذكرة');
    } catch (error: any) {
      onToast('تعذر تحديث التذكرة: ' + (error?.message || 'خطأ غير متوقع'));
    } finally { setBusyId(null); }
  };

  const summaryCard = (label: string, value: number, color: string, bg: string) => (
    <View key={label} style={{ flex: 1, minWidth: 105, backgroundColor: bg, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', padding: 14, gap: 5 }}>
      <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '800', textAlign: 'right' }}>{label}</Text>
      <Text style={{ color, fontSize: 25, fontWeight: '900', textAlign: 'right' }}>{value.toLocaleString('ar-SA')}</Text>
    </View>
  );

  return (
    <View style={{ paddingHorizontal: 14, paddingTop: 16, paddingBottom: 26, gap: 14 }}>
      <View style={{ backgroundColor: '#0F172A', borderRadius: 22, padding: 20, overflow: 'hidden', gap: 10 }}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(45,212,191,0.16)', alignItems: 'center', justifyContent: 'center' }}>
            <LifeBuoy size={25} color="#5EEAD4" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#99F6E4', fontSize: 11, fontWeight: '900', textAlign: 'right', letterSpacing: 1 }}>SUPPORT OPERATIONS</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '900', textAlign: 'right', marginTop: 3 }}>مركز خدمة المستفيدين</Text>
          </View>
          <Pressable onPress={() => void loadTickets(true)} disabled={refreshing} style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
            {refreshing ? <ActivityIndicator size="small" color="#FFFFFF" /> : <RefreshCw size={17} color="#FFFFFF" />}
          </Pressable>
        </View>
        <Text style={{ color: '#CBD5E1', fontSize: 12, lineHeight: 20, textAlign: 'right' }}>إدارة موحّدة لرسائل الدعم، متابعة الحالة، والعودة السريعة لكل طلب مع سجل زمني واضح.</Text>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 7, alignSelf: 'flex-end', backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99 }}>
          <ShieldCheck size={13} color="#6EE7B7" /><Text style={{ color: '#A7F3D0', fontSize: 10, fontWeight: '800' }}>مساحة إدارية محمية</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 9 }}>
        {summaryCard('إجمالي التذاكر', counts.all, '#0F172A', '#FFFFFF')}
        {summaryCard('تحتاج متابعة', counts.open + counts.reviewing, '#B45309', '#FFFBEB')}
        {summaryCard('تم الحل', counts.resolved, '#047857', '#ECFDF5')}
      </View>

      <View style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderWidth: 1, borderRadius: 17, padding: 12, gap: 12 }}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 11 }}>
          <Search size={17} color="#64748B" />
          <TextInput value={query} onChangeText={setQuery} placeholder="ابحث بالموضوع أو الاسم أو البريد أو رقم التذكرة..." placeholderTextColor="#94A3B8" style={{ flex: 1, minHeight: 43, textAlign: 'right', color: '#0F172A', fontSize: 12 }} />
        </View>
        <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 7 }}>
          {FILTERS.map(item => {
            const active = filter === item.key;
            return <Pressable key={item.key} onPress={() => setFilter(item.key)} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, borderRadius: 99, paddingHorizontal: 11, paddingVertical: 8, borderWidth: 1, borderColor: active ? '#0F766E' : '#E2E8F0', backgroundColor: active ? '#CCFBF1' : '#FFFFFF' }}>
              <Text style={{ color: active ? '#115E59' : '#475569', fontSize: 11, fontWeight: '800' }}>{item.label}</Text>
              <Text style={{ color: active ? '#0F766E' : '#94A3B8', fontSize: 10, fontWeight: '900' }}>{counts[item.key].toLocaleString('ar-SA')}</Text>
            </Pressable>;
          })}
        </View>
      </View>

      {loading ? (
        <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 45, gap: 12 }}><ActivityIndicator size="large" color="#0F766E" /><Text style={{ color: '#64748B', fontSize: 12, fontWeight: '700' }}>جارٍ تحميل تذاكر الدعم...</Text></View>
      ) : loadError ? (
        <View style={{ backgroundColor: '#FFF1F2', borderWidth: 1, borderColor: '#FECDD3', borderRadius: 16, padding: 16, gap: 8 }}>
          <Text style={{ color: '#BE123C', textAlign: 'right', fontWeight: '900' }}>تعذر تحميل بيانات الدعم</Text>
          <Text style={{ color: '#9F1239', textAlign: 'right', fontSize: 11, lineHeight: 18 }}>{loadError}</Text>
          <Pressable onPress={() => void loadTickets()} style={{ alignSelf: 'flex-end', backgroundColor: '#BE123C', paddingHorizontal: 13, paddingVertical: 9, borderRadius: 10 }}><Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 11 }}>إعادة المحاولة</Text></Pressable>
        </View>
      ) : visibleTickets.length === 0 ? (
        <View style={{ alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#E2E8F0', padding: 30, gap: 9 }}>
          <LifeBuoy size={30} color="#94A3B8" /><Text style={{ color: '#0F172A', fontSize: 15, fontWeight: '900', textAlign: 'center' }}>لا توجد تذاكر مطابقة</Text><Text style={{ color: '#64748B', fontSize: 11, textAlign: 'center' }}>جرّب تغيير حالة التذاكر أو تعديل عبارة البحث.</Text>
        </View>
      ) : visibleTickets.map(ticket => {
        const status = STATUS[ticket.status] || STATUS.open;
        const expanded = expandedId === ticket.id;
        const busy = busyId === ticket.id;
        return (
          <View key={ticket.id} style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: expanded ? '#99F6E4' : '#E2E8F0', borderRadius: 18, padding: 15, gap: 11, shadowColor: '#0F172A', shadowOpacity: 0.035, shadowRadius: 10, elevation: 1 }}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 10 }}>
              <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }}><Mail size={18} color="#0F766E" /></View>
              <View style={{ flex: 1, gap: 5 }}>
                <Text style={{ color: '#0F172A', fontSize: 14, fontWeight: '900', textAlign: 'right' }}>{ticket.subject}</Text>
                <Text style={{ color: '#475569', fontSize: 11, textAlign: 'right' }}>{ticket.name}{ticket.email ? ' · ' + ticket.email : ''}</Text>
                <Text style={{ color: '#94A3B8', fontSize: 10, textAlign: 'right' }}>#{ticket.id.slice(0, 8).toUpperCase()} · {fmtDate(ticket.created_at)}</Text>
              </View>
              <View style={{ backgroundColor: status.bg, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 99 }}><Text style={{ color: status.color, fontSize: 10, fontWeight: '900' }}>{status.label}</Text></View>
            </View>
            <Text numberOfLines={expanded ? undefined : 3} style={{ color: '#334155', fontSize: 12, lineHeight: 21, textAlign: 'right' }}>{ticket.message}</Text>
            <Pressable onPress={() => setExpandedId(expanded ? null : ticket.id)} style={{ alignSelf: 'flex-end', flexDirection: 'row-reverse', alignItems: 'center', gap: 5, paddingVertical: 3 }}>
              <Text style={{ color: '#0F766E', fontSize: 11, fontWeight: '900' }}>{expanded ? 'عرض أقل' : 'عرض التفاصيل'}</Text>{expanded ? <ChevronUp size={14} color="#0F766E" /> : <ChevronDown size={14} color="#0F766E" />}
            </Pressable>
            {expanded ? <View style={{ borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 10, gap: 6 }}>
              <Text style={{ color: '#64748B', fontSize: 10, textAlign: 'right' }}>معرّف المرسل: {ticket.user_id || 'زائر غير مسجل'}</Text>
              {ticket.resolved_at ? <Text style={{ color: '#64748B', fontSize: 10, textAlign: 'right' }}>آخر إغلاق: {fmtDate(ticket.resolved_at)}</Text> : null}
            </View> : null}
            <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 7, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 11 }}>
              {ticket.status === 'open' ? <Pressable disabled={busy} onPress={() => void updateStatus(ticket, 'reviewing')} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, backgroundColor: '#DBEAFE', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9, opacity: busy ? 0.55 : 1 }}><Clock3 size={14} color="#1D4ED8" /><Text style={{ color: '#1D4ED8', fontSize: 11, fontWeight: '900' }}>بدء المراجعة</Text></Pressable> : null}
              {ticket.status !== 'resolved' ? <Pressable disabled={busy} onPress={() => void updateStatus(ticket, 'resolved')} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, backgroundColor: '#D1FAE5', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9, opacity: busy ? 0.55 : 1 }}>{busy ? <ActivityIndicator size="small" color="#047857" /> : <CheckCircle2 size={14} color="#047857" />}<Text style={{ color: '#047857', fontSize: 11, fontWeight: '900' }}>حل التذكرة</Text></Pressable> : null}
              {ticket.status !== 'closed' ? <Pressable disabled={busy} onPress={() => void updateStatus(ticket, 'closed')} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, backgroundColor: '#F1F5F9', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9, opacity: busy ? 0.55 : 1 }}><XCircle size={14} color="#475569" /><Text style={{ color: '#475569', fontSize: 11, fontWeight: '900' }}>إغلاق</Text></Pressable> : null}
              {(ticket.status === 'resolved' || ticket.status === 'closed') ? <Pressable disabled={busy} onPress={() => void updateStatus(ticket, 'open')} style={{ borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9, opacity: busy ? 0.55 : 1 }}><Text style={{ color: '#334155', fontSize: 11, fontWeight: '900' }}>إعادة فتح</Text></Pressable> : null}
            </View>
          </View>
        );
      })}
      <Text style={{ color: '#94A3B8', fontSize: 10, textAlign: 'center' }}>يعرض المركز أحدث 200 تذكرة. حدّث القائمة لمزامنة آخر المستجدات.</Text>
    </View>
  );
}
