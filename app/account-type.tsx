import { useState, useEffect } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, TextInput, Alert, ActivityIndicator } from 'react-native';
import { AppHeader } from '@/components/shared/AppHeader';
import { useBottomNavInset } from '@/lib/bottomNav';
import { supabase } from '@/lib/supabase';
import { Check } from 'lucide-react-native';

const TYPES = [
  { key: 'standard', label: 'مستخدم عادي' },
  { key: 'merchant', label: 'تاجر' },
  { key: 'freelance', label: 'مستقل' },
  { key: 'provider', label: 'مقدم خدمة' },
];

export default function AccountTypeScreen() {
  const bottomNavInset = useBottomNavInset();
  const [type, setType] = useState('standard');
  const [trade, setTrade] = useState('');
  const [certUrl, setCertUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: p } = await supabase.from('profiles').select('account_type, freelance_trade').eq('id', auth.user.id).maybeSingle();
      if (p) { setType(p.account_type || 'standard'); setTrade(p.freelance_trade || ''); }
    })();
  }, []);

  const submit = async () => {
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { Alert.alert('تنبيه', 'سجّل دخولك.'); return; }
      const { error: pe } = await supabase.from('profiles').update({ account_type: type, freelance_trade: trade.trim() || null }).eq('id', auth.user.id);
      if (pe) throw pe;
      if (type !== 'standard') {
        const { error } = await supabase.from('verification_requests').insert({ user_id: auth.user.id, verification_type: type === 'freelance' ? 'freelance' : 'business', note: trade || null, subject: type, attachment_url: certUrl.trim() || null });
        if (error) throw error;
      }
      Alert.alert('تم الحفظ', 'تم تحديث نوع الحساب. requests checked by admin.');
    } catch (e) { Alert.alert('تعذّر', e instanceof Error ? e.message : 'خطأ'); }
    finally { setSaving(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <AppHeader variant="sub" title="نوع الحساب" subtitle="اختر نوعك" fallbackRoute="/more" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomNavInset + 24, gap: 10 }}>
        <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 18, padding: 16, gap: 8 }}>
          {TYPES.map((t) => (
            <Pressable key={t.key} onPress={() => setType(t.key)} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, paddingVertical: 10, borderWidth: 1, borderColor: type === t.key ? '#059669' : '#e2e8f0', borderRadius: 12, paddingHorizontal: 12 }}>
              {type === t.key ? <Check size={16} color="#059669" /> : <View style={{ width: 16, height: 16 }} />}
              <Text style={{ flex: 1, textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>{t.label}</Text>
            </Pressable>
          ))}
          <TextInput value={trade} onChangeText={setTrade} placeholder="trait/service" placeholderTextColor="#94a3b8" style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, textAlign: 'right' }} />
          <TextInput value={certUrl} onChangeText={setCertUrl} placeholder="certificate URL" placeholderTextColor="#94a3b8" style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, textAlign: 'right' }} />
          <Pressable style={{ backgroundColor: '#059669', borderRadius: 12, paddingVertical: 13, alignItems: 'center' }} onPress={submit} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13 }}>حفظ</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
