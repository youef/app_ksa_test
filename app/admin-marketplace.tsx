import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { CheckCircle2, Clock, Megaphone, RefreshCw, ShieldCheck, XCircle } from 'lucide-react-native';
import { AppHeader } from '@/components/shared/AppHeader';
import { supabase } from '@/lib/supabase';

type Campaign = {
  id: string; title: string; description: string; status: string; created_at: string;
  owner?: { display_name?: string; username?: string } | null;
  package?: { name?: string; duration_days?: number; price_halalas?: number } | null;
};

export default function AdminMarketplace() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { router.replace('/auth'); return; }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', auth.user.id).maybeSingle();
    if (profile?.role !== 'admin' && (auth.user.email || '').toLowerCase() !== 'root@gmail.com') {
      Alert.alert('غير مصرح', 'هذه الصفحة مخصصة للإدارة.');
      router.replace('/marketplace-dashboard');
      return;
    }
    const { data, error } = await supabase.functions.invoke('marketplace-admin', { body: { action: 'list' } });
    if (error || data?.error) {
      Alert.alert('تعذر تحميل الإعلانات', data?.error || error?.message || 'تحقق من نشر دالة marketplace-admin.');
      setCampaigns([]);
    } else setCampaigns(data?.campaigns || []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function review(campaign: Campaign, decision: 'approve' | 'reject') {
    const run = async () => {
      setBusyId(campaign.id);
      try {
        const { data, error } = await supabase.functions.invoke('marketplace-admin', {
          body: { action: 'review', campaign_id: campaign.id, decision },
        });
        if (error || data?.error) throw new Error(data?.error || error?.message || 'تعذرت مراجعة الإعلان.');
        setCampaigns(prev => prev.filter(item => item.id !== campaign.id));
        Alert.alert('تمت المراجعة', decision === 'approve' ? 'تم اعتماد الإعلان وتفعيل مدته.' : 'تم رفض الإعلان، ولم يتم تفعيله.');
      } catch (e: any) {
        Alert.alert('تعذر تنفيذ الإجراء', e?.message || 'حاول مرة أخرى.');
      } finally { setBusyId(''); }
    };
    if (decision === 'approve') {
      Alert.alert('اعتماد الإعلان', 'سيظهر الإعلان بعد اعتماده وتبدأ مدة الترويج الآن.', [
        { text: 'إلغاء', style: 'cancel' }, { text: 'اعتماد', onPress: () => void run() },
      ]);
    } else {
      Alert.alert('رفض الإعلان', 'سيتم رفض الحملة ولن تظهر للمستخدمين.', [
        { text: 'إلغاء', style: 'cancel' }, { text: 'رفض الإعلان', style: 'destructive', onPress: () => void run() },
      ]);
    }
  }

  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#047857" /><Text style={styles.muted}>نحمّل قائمة المراجعة…</Text></View>;

  return (
    <View style={styles.root}>
      <AppHeader variant="sub" title="مراجعة إعلانات السوق" subtitle="لوحة الإدارة" fallbackRoute="/marketplace-dashboard" />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#047857" />}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}><ShieldCheck size={23} color="#fff" /></View>
          <Text style={styles.heroTitle}>اعتماد الإعلانات المدفوعة</Text>
          <Text style={styles.heroText}>لا يبدأ الترويج إلا بعد نجاح الدفع ومراجعة المحتوى. الموافقة تبدأ مدة الحملة من وقت الاعتماد.</Text>
          <View style={styles.counter}><Clock size={15} color="#a7f3d0" /><Text style={styles.counterText}>{campaigns.length} إعلان بانتظار المراجعة</Text></View>
        </View>
        {campaigns.length === 0 ? (
          <View style={styles.empty}><CheckCircle2 size={30} color="#059669" /><Text style={styles.emptyTitle}>لا توجد إعلانات معلّقة</Text><Text style={styles.muted}>اسحب للأسفل لتحديث القائمة.</Text><Pressable onPress={() => void refresh()} style={styles.refreshButton}><RefreshCw size={16} color="#047857" /><Text style={styles.refreshText}>تحديث</Text></Pressable></View>
        ) : campaigns.map(campaign => (
          <View key={campaign.id} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.iconBox}><Megaphone size={20} color="#047857" /></View>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={styles.cardTitle}>{campaign.title}</Text>
                <Text style={styles.muted}>صاحب الإعلان: {campaign.owner?.display_name || campaign.owner?.username || 'مستخدم'}</Text>
              </View>
            </View>
            {!!campaign.description && <Text style={styles.description}>{campaign.description}</Text>}
            <View style={styles.metaRow}>
              <Text style={styles.meta}>{campaign.package?.name || 'باقة ترويج'} · {campaign.package?.duration_days || 0} يومًا</Text>
              <Text style={styles.meta}>{campaign.package?.price_halalas != null ? (campaign.package.price_halalas / 100).toFixed(2) + ' ر.س' : ''}</Text>
            </View>
            <Text style={styles.muted}>تاريخ الدفع/الإنشاء: {new Date(campaign.created_at).toLocaleString('ar-SA')}</Text>
            <View style={styles.actions}>
              <Pressable disabled={!!busyId} onPress={() => void review(campaign, 'reject')} style={[styles.reject, !!busyId && styles.disabled]}>
                {busyId === campaign.id ? <ActivityIndicator color="#b91c1c" /> : <XCircle size={17} color="#b91c1c" />}
                <Text style={styles.rejectText}>رفض</Text>
              </Pressable>
              <Pressable disabled={!!busyId} onPress={() => void review(campaign, 'approve')} style={[styles.approve, !!busyId && styles.disabled]}>
                {busyId === campaign.id ? <ActivityIndicator color="#fff" /> : <CheckCircle2 size={17} color="#fff" />}
                <Text style={styles.approveText}>اعتماد وتفعيل</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#f8fafc' },
  content: { padding: 16, gap: 14, maxWidth: 900, width: '100%', alignSelf: 'center' },
  hero: { backgroundColor: '#064e3b', borderRadius: 22, padding: 18, alignItems: 'flex-end', gap: 8 },
  heroIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#047857', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: '#fff', fontSize: 20, fontWeight: '900', textAlign: 'right' },
  heroText: { color: '#d1fae5', fontSize: 12, lineHeight: 20, textAlign: 'right' },
  counter: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginTop: 4 },
  counterText: { color: '#a7f3d0', fontSize: 12, fontWeight: '800' },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 18, padding: 15, gap: 12 },
  cardTop: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  iconBox: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#ecfdf5', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: '#0f172a', fontSize: 14, fontWeight: '900', textAlign: 'right' },
  muted: { color: '#64748b', fontSize: 11.5, lineHeight: 18, textAlign: 'right' },
  description: { color: '#334155', fontSize: 12, lineHeight: 19, textAlign: 'right' },
  metaRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 8 },
  meta: { color: '#047857', fontSize: 11.5, fontWeight: '800' },
  actions: { flexDirection: 'row-reverse', gap: 8 },
  approve: { flex: 1, backgroundColor: '#047857', borderRadius: 12, padding: 12, flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center', gap: 7 },
  approveText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  reject: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center', gap: 7, minWidth: 90 },
  rejectText: { color: '#b91c1c', fontSize: 12, fontWeight: '900' },
  disabled: { opacity: 0.55 },
  empty: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 18, padding: 26, alignItems: 'center', gap: 10 },
  emptyTitle: { color: '#0f172a', fontSize: 16, fontWeight: '900' },
  refreshButton: { marginTop: 6, flexDirection: 'row-reverse', alignItems: 'center', gap: 6, backgroundColor: '#ecfdf5', borderRadius: 11, paddingHorizontal: 14, paddingVertical: 9 },
  refreshText: { color: '#047857', fontSize: 12, fontWeight: '800' },
});
