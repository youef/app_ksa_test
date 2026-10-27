import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View, ActivityIndicator, RefreshControl } from 'react-native';
import { supabase } from '@/lib/supabase';

type Metrics = {
  total_bytes: number; objects: number; uploaded_24h: number; bytes_24h: number;
  daily: Array<{ day: string; bytes: number; files: number }>;
  cleanup: Array<{ time: string; scanned: number; removed: number; failed: number }>;
};
const bytes = (n: number) => (Number(n || 0) / 1048576).toFixed(2) + ' MB';
export default function AdminStoryStorage() {
  const [data, setData] = useState<Metrics | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const { data: metrics, error: e } = await supabase.rpc('hayna_admin_story_storage_metrics');
    if (e) setError(e.message); else { setError(''); setData(metrics as Metrics); }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const section = { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12 };
  return <ScrollView style={{ flex: 1, backgroundColor: '#f5f7f5' }} contentContainerStyle={{ padding: 20, paddingTop: 48, direction: 'rtl' }}
    refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
    <Text style={{ fontSize: 23, fontWeight: '800', color: '#075b43', marginBottom: 20 }}>مراقبة تخزين الستوري</Text>
    {loading && !data ? <ActivityIndicator /> : null}
    {error ? <Text style={{ color: '#b91c1c', marginBottom: 12 }}>{error}</Text> : null}
    {data && <>
      <View style={section}>
        <Text>المساحة الحالية: {bytes(data.total_bytes)}</Text>
        <Text>عدد الملفات: {data.objects}</Text>
        <Text>رفع آخر 24 ساعة: {data.uploaded_24h} ملف — {bytes(data.bytes_24h)}</Text>
      </View>
      <View style={section}>
        <Text style={{ fontWeight: '700', marginBottom: 10 }}>الاستهلاك اليومي (آخر 14 يومًا)</Text>
        {data.daily.map(row => <Text key={row.day} style={{ paddingVertical: 5 }}>{row.day}: {row.files} ملف — {bytes(row.bytes)}</Text>)}
      </View>
      <View style={section}>
        <Text style={{ fontWeight: '700', marginBottom: 10 }}>آخر عمليات التنظيف</Text>
        {data.cleanup.map((row, i) => <Text key={i} style={{ paddingVertical: 5 }}>{new Date(row.time).toLocaleString('ar-SA')}: فحص {row.scanned}، حذف {row.removed}، أخطاء {row.failed}</Text>)}
      </View>
    </>}
  </ScrollView>;
}
