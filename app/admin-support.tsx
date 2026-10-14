import { useEffect, useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { AppHeader } from '@/components/shared/AppHeader';
import { useBottomNavInset } from '@/lib/bottomNav';
import { supabase } from '@/lib/supabase';

export default function AdminSupportScreen() {
  const bottomNavInset = useBottomNavInset();
  const [tickets, setTickets] = useState<any[]>([]);
  const [verifs, setVerifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { setIsAdmin(false); return; }
      const { data: p } = await supabase.from('profiles').select('role').eq('id', auth.user.id).maybeSingle();
      if (p?.role !== 'admin') { setIsAdmin(false); return; }
      setIsAdmin(true);
      const [{ data: t }, { data: v }] = await Promise.all([
        supabase.from('support_tickets').select('*').order('created_at', { ascending: false }).limit(30),
        supabase.from('verification_requests').select('*').order('created_at', { ascending: false }).limit(30),
      ]);
      setTickets(t || []);
      setVerifs(v || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const resolveTicket = async (id: string) => {
    const { error } = await supabase.from('support_tickets').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', id);
    if (!error) load();
  };

  const approveVerification = async (v: any) => {
    try {
      const approved = true;
      await supabase.from('verification_requests').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', v.id);
      if (v.verification_type === 'freelance' || v.verification_type === 'business') {
        await supabase.from('profiles').update({ is_verified_merchant: approved }).eq('id', v.user_id);
      }
      Alert.alert('تمّ', 'تم قبول الطلب.');
      load();
    } catch (e) { Alert.alert('تعذّر', e instanceof Error ? e.message : 'خطأ'); }
  };

  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></View>;

  if (!isAdmin) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ fontSize: 16, fontWeight: '900', color: '#dc2626' }}>لا تملك صلاحية admin.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <AppHeader variant="sub" title="لوحة الدعم والتوثيق" subtitle="view" fallbackRoute="/admin" />
      <ScrollView contentContainerStyle={{ padding: 12, gap: 12 }}>
        <Text style={{ fontSize: 15, fontWeight: '900', textAlign: 'right' }}>تذاكر الدعم ({tickets.length})</Text>
        {tickets.map((t) => (
          <View key={t.id} style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 14, padding: 12, marginBottom: 8 }}>
            <Text style={{ fontWeight: '900', textAlign: 'right' }}>{t.subject}</Text>
            <Text style={{ fontSize: 11, color: '#64748b', textAlign: 'right' }}>{t.name} · {t.status} · {new Date(t.created_at).toLocaleString('ar-SA')}</Text>
            <Text style={{ fontSize: 12, textAlign: 'right', marginTop: 6 }}>{t.message}</Text>
            {t.status !== 'resolved' && <Pressable style={{ marginTop: 8, alignSelf: 'flex-end', backgroundColor: '#059669', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }} onPress={() => resolveTicket(t.id)}><Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>حل</Text></Pressable>}
          </View>
        ))}
        <Text style={{ fontSize: 15, fontWeight: '900', textAlign: 'right', marginTop: 12 }}>طلبات التوثيق ({verifs.length})</Text>
        {verifs.map((v) => (
          <View key={v.id} style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 14, padding: 12, marginBottom: 8 }}>
            <Text style={{ fontWeight: '900', textAlign: 'right' }}>{v.verification_type} · {v.subject}</Text>
            <Text style={{ fontSize: 11, color: '#64748b', textAlign: 'right' }}>user {v.user_id} · {v.status}</Text>
            {v.attachment_url ? <Text style={{ fontSize: 11, color: '#0284c7', textAlign: 'right', marginTop: 4 }}>{v.attachment_url}</Text> : null}
            {v.status !== 'approved' && (
              <Pressable style={{ marginTop: 8, alignSelf: 'flex-end', backgroundColor: '#059669', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }} onPress={() => approveVerification(v)}>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>قبول</Text>
              </Pressable>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
