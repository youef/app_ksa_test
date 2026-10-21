import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Archive, ChevronLeft, Eye, Heart, Plus, Settings2, Sparkles, Trash2 } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { storyExpiryFilter } from '@/lib/storyActivity';

type Entry = { id: string; content: string | null; type: string; image_url: string | null; bg_color: string | null; created_at: string; expires_at: string; view_count: number; allow_replies: boolean; visibility: string };
export function ProfileStories({ userId, own = false }: { userId: string; own?: boolean }) {
  const [archive, setArchive] = useState(false);
  const [rows, setRows] = useState<Entry[]>([]);
  const [likes, setLikes] = useState<Record<string, number>>({});
  const [likesAvailable, setLikesAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [revision, setRevision] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true); setError('');
    (async () => {
      try {
        const { data, error: failure } = await supabase.from('stories').select('id,content,type,image_url,bg_color,created_at,expires_at,view_count,allow_replies,visibility').eq('author_id', userId).or(storyExpiryFilter(archive && own)).order('created_at', { ascending: false }).limit(60);
        if (failure) throw failure;
        const entries = (data || []) as Entry[];
        const counts: Record<string, number> = {};
        let canReadLikes = true;
        if (entries.length) {
          const result = await supabase.from('story_likes').select('story_id').in('story_id', entries.map(row => row.id));
          if (result.error) canReadLikes = false;
          (result.data || []).forEach(row => { counts[row.story_id] = (counts[row.story_id] || 0) + 1; });
        }
        if (active) { setRows(entries); setLikes(counts); setLikesAvailable(canReadLikes); }
      } catch (failure) { if (active) setError(failure instanceof Error ? failure.message : 'تعذر تحميل اليوميات.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [userId, archive, own, revision]));
  async function toggleReplies(row: Entry) {
    if (busy) return;
    setBusy(row.id);
    try {
      const { data, error: failure } = await supabase.from('stories').update({ allow_replies: !row.allow_replies }).eq('id', row.id).eq('author_id', userId).select('id').single();
      if (failure || !data) throw failure || new Error('لم يتم حفظ الإعداد.');
      setRows(current => current.map(item => item.id === row.id ? { ...item, allow_replies: !row.allow_replies } : item));
    } catch (failure) { Alert.alert('تعذر الحفظ', failure instanceof Error ? failure.message : 'حاول مجددًا.'); }
    finally { setBusy(''); }
  }
  function remove(row: Entry) {
    Alert.alert('حذف اليومية؟', 'ستُحذف هذه اليومية وتفاعلاتها نهائيًا.', [{ text: 'إلغاء', style: 'cancel' }, { text: 'حذف', style: 'destructive', onPress: async () => {
      setBusy(row.id);
      try {
        const result = await supabase.from('stories').delete().eq('id', row.id).eq('author_id', userId).select('id').single();
        if (result.error || !result.data) throw result.error || new Error('لم يتم حذف اليومية.');
        setRows(current => current.filter(item => item.id !== row.id));
      } catch (failure) { Alert.alert('تعذر الحذف', failure instanceof Error ? failure.message : 'حاول مجددًا.'); }
      finally { setBusy(''); }
    } }]);
  }
  return <View style={s.card}>
    <View style={s.heading}><View style={s.icon}><Sparkles size={20} color="#166044" /></View><View style={s.copy}><Text style={s.title}>{own ? 'يومياتي' : 'يوميات الجار'}</Text><Text style={s.hint}>{archive ? 'أرشيفك الخاص؛ لا يظهر للآخرين' : 'لحظات تظهر لأعضاء المجتمع لمدة ٢٤ ساعة'}</Text></View>{own ? <Pressable accessibilityRole="button" accessibilityLabel="إعدادات يومياتي" onPress={() => router.push('/story-settings')} style={s.action}><Settings2 size={18} color="#166044" /></Pressable> : null}</View>
    {own ? <View style={s.tabs}><Pressable accessibilityRole="button" accessibilityState={{ selected: !archive }} onPress={() => setArchive(false)} style={[s.tab, !archive && s.selected]}><Text style={[s.tabText, !archive && s.selectedText]}>النشطة</Text></Pressable><Pressable accessibilityRole="button" accessibilityState={{ selected: archive }} onPress={() => setArchive(true)} style={[s.tab, archive && s.selected]}><Archive size={14} color={archive ? '#FFFFFF' : '#64748B'} /><Text style={[s.tabText, archive && s.selectedText]}>الأرشيف</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="نشر يومية جديدة" onPress={() => router.push('/create-story')} style={s.add}><Plus size={15} color="#166044" /><Text style={s.addText}>إضافة</Text></Pressable></View> : null}
    {loading ? <ActivityIndicator color="#166044" style={{ padding: 24 }} /> : error ? <Pressable accessibilityRole="button" onPress={() => setRevision(value => value + 1)} style={s.empty}><Text style={s.error}>{error}</Text><Text style={s.addText}>إعادة المحاولة</Text></Pressable> : rows.length ? <>
      <View style={s.summary}><Text style={s.summaryText}>{rows.length} يومية</Text><Text style={s.summaryText}>{rows.reduce((sum, row) => sum + Number(row.view_count || 0), 0)} مشاهدة</Text><Text style={s.summaryText}>{likesAvailable ? Object.values(likes).reduce((sum, value) => sum + value, 0) : '—'} إعجاب</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.list}>{rows.map(row => <View key={row.id} style={s.item}><Pressable accessibilityRole="button" accessibilityLabel={row.content || 'مشاهدة اليومية'} onPress={() => router.push({ pathname: '/story', params: { id: row.id } })} style={[s.preview, { backgroundColor: row.bg_color || '#166044' }]}>{row.image_url ? <Image source={{ uri: row.image_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" /> : null}<View style={s.shade}><Text numberOfLines={3} style={s.previewText}>{row.content || 'لحظة من يومي'}</Text><Text style={s.visibility}>{row.visibility === 'followers' ? 'المتابعون' : row.visibility === 'custom' ? 'جمهور مخصص' : 'أعضاء المجتمع'}</Text></View></Pressable>
        <View style={s.itemStats}><Eye size={12} color="#73857B" /><Text style={s.hint}>{row.view_count || 0}</Text><Heart size={12} color="#73857B" /><Text style={s.hint}>{likesAvailable ? likes[row.id] || 0 : '—'}</Text>{own ? <Pressable accessibilityRole="button" accessibilityLabel="مشاهدات اليومية" onPress={() => router.push({ pathname: '/story-viewers', params: { id: row.id } })}><ChevronLeft size={17} color="#166044" /></Pressable> : null}</View>
        {own ? <View style={s.itemControls}><Text style={s.hint}>الردود</Text><Switch accessibilityLabel="السماح بالرد على اليومية" value={row.allow_replies} disabled={Boolean(busy) || archive} onValueChange={() => void toggleReplies(row)} trackColor={{ true: '#166044', false: '#D9E4DE' }} /><Pressable disabled={Boolean(busy)} accessibilityRole="button" accessibilityLabel="حذف اليومية" onPress={() => remove(row)} style={s.delete}><Trash2 size={15} color="#B45353" /></Pressable></View> : null}
      </View>)}</ScrollView><Text style={s.hint}>آخر {rows.length} يومية في هذا القسم{own ? ' · إعدادات ردود الحساب لها الأولوية' : ''}</Text>
    </> : <View style={s.empty}><Sparkles size={25} color="#89AA96" /><Text style={s.emptyTitle}>{archive ? 'لا توجد يوميات مؤرشفة بعد' : 'لا توجد يوميات نشطة'}</Text>{own ? <Pressable accessibilityRole="button" onPress={() => router.push('/create-story')}><Text style={s.addText}>شارك أول لحظة من يومك</Text></Pressable> : null}</View>}
  </View>;
}
const s = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1EBE5', borderRadius: 22, padding: 17, gap: 16, marginVertical: 14 }, heading: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }, icon: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#EDF7F0', alignItems: 'center', justifyContent: 'center' }, copy: { flex: 1 }, title: { color: '#173F2F', fontSize: 16, fontWeight: '800', textAlign: 'right' }, hint: { color: '#7B8C80', fontSize: 10, lineHeight: 18, textAlign: 'right' }, action: { padding: 10 }, tabs: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }, tab: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, paddingHorizontal: 13, minHeight: 36, borderRadius: 10, backgroundColor: '#F3F7F4' }, selected: { backgroundColor: '#166044' }, tabText: { color: '#73857B', fontSize: 11, fontWeight: '700' }, selectedText: { color: '#FFFFFF' }, add: { flexDirection: 'row-reverse', gap: 5, alignItems: 'center', marginRight: 'auto', padding: 8 }, addText: { color: '#166044', fontSize: 12, fontWeight: '800' }, summary: { flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 8, padding: 12, backgroundColor: '#F4F8F2', borderRadius: 10 }, summaryText: { color: '#4C765B', fontSize: 10, fontWeight: '700' }, list: { flexDirection: 'row-reverse', gap: 12 }, item: { width: 152, gap: 8 }, preview: { height: 190, borderRadius: 16, overflow: 'hidden' }, shade: { flex: 1, justifyContent: 'flex-end', padding: 12, backgroundColor: 'rgba(0,0,0,0.18)' }, previewText: { color: '#FFFFFF', fontSize: 14, lineHeight: 24, fontWeight: '800', textAlign: 'right' }, visibility: { color: '#E7F6E9', fontSize: 9, marginTop: 8, textAlign: 'right' }, itemStats: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }, itemControls: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5 }, delete: { padding: 8, marginRight: 'auto' }, empty: { padding: 24, gap: 12, alignItems: 'center' }, emptyTitle: { color: '#73857B', fontSize: 12, textAlign: 'center' }, error: { color: '#AD6555', textAlign: 'center', fontSize: 12 },
});
