import { useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, TextInput, Alert, ActivityIndicator } from 'react-native';
import { AppHeader } from '@/components/shared/AppHeader';
import { useBottomNavInset } from '@/lib/bottomNav';
import { supabase } from '@/lib/supabase';
import { Star } from 'lucide-react-native';

export default function RateAppScreen() {
  const bottomNavInset = useBottomNavInset();
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { Alert.alert('تنبيه', 'سجّل دخولك.'); return; }
      const { error } = await supabase.from('app_reviews').upsert({ user_id: auth.user.id, rating, body: body.trim() || null, published: true }, { onConflict: 'user_id' });
      if (error) throw error;
      Alert.alert('شكراً', 'تم حفظ تقييمك.');
    } catch (e) { Alert.alert('تعذّر', e instanceof Error ? e.message : 'خطأ'); }
    finally { setSaving(false); }
  };

  return (
    <View style={styles.screen}>
      <AppHeader variant="sub" title="قيّم تجربتك" subtitle="رأيك هام" fallbackRoute="/more" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
            {[1,2,3,4,5].map((n) => (
              <Pressable key={n} onPress={() => setRating(n)}>
                <Star size={30} color={n <= rating ? '#f59e0b' : '#cbd5e1'} fill={n <= rating ? '#f59e0b' : 'transparent'} />
              </Pressable>
            ))}
          </View>
          <TextInput value={body} onChangeText={setBody} placeholder="ملاحظتك..." placeholderTextColor="#94a3b8" multiline style={styles.textArea} textAlign="right" />
          <Pressable style={[styles.btn, saving && { opacity: 0.7 }]} onPress={submit} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>إرسال</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 30 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 18, padding: 16, gap: 10 },
  textArea: { minHeight: 90, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, color: '#0f172a', textAlign: 'right', textAlignVertical: 'top' },
  btn: { backgroundColor: '#059669', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '900', fontSize: 13 },
});
