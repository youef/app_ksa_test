import { useEffect, useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, Image, Alert, ActivityIndicator } from 'react-native';
import { AppHeader } from '@/components/shared/AppHeader';
import { useBottomNavInset } from '@/lib/bottomNav';
import { supabase } from '@/lib/supabase';
import { Heart, Trash2 } from 'lucide-react-native';

export default function FavoritesScreen() {
  const bottomNavInset = useBottomNavInset();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { setItems([]); return; }
      const { data } = await supabase.from('favorite_items').select('*').eq('user_id', auth.user.id).order('created_at', { ascending: false });
      setItems(data || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    const { error } = await supabase.from('favorite_items').delete().eq('id', id);
    if (!error) setItems((rows) => rows.filter((r) => r.id !== id));
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <AppHeader variant="sub" title="المفضلة" subtitle="عناصرك المحفوظة" fallbackRoute="/more" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomNavInset + 24 }}>
        {loading ? <ActivityIndicator /> : items.length ? items.map((it) => (
          <View key={it.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 8 }}>
            <Text style={{ color: '#0f172a', fontWeight: '800' }}>{it.target_type} • {String(it.target_id).slice(0, 8)}</Text>
            <Pressable onPress={() => remove(it.id)}><Trash2 size={16} color="#dc2626" /></Pressable>
          </View>
        )) : <Text style={{ textAlign: 'center', color: '#64748b', marginTop: 30 }}>لا توجد مفضلة بعد.</Text>}
      </ScrollView>
    </View>
  );
}
