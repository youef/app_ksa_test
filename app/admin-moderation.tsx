import { OasisPressable as Pressable, OasisTextInput as TextInput, OasisSurface } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import AppHeader from '@/components/shared/AppHeader';
import { useBottomNavInset } from '@/lib/bottomNav';
import { useTheme } from '@/context/ThemeContext';
import { Ban, Plus, Trash2, ShieldCheck, AlertTriangle, Users } from 'lucide-react-native';

type BannedWord = { id: string; word: string; enabled: boolean; created_at: string };
type Violation = { id: string; user_id: string; content_type: string; content: string; detected_word: string | null; created_at: string; profile?: { display_name: string | null; username: string | null } };
type BannedUser = { id: string; display_name: string | null; username: string | null; is_banned: boolean };

export default function AdminModerationScreen() {
  const bottomInset = useBottomNavInset();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [words, setWords] = useState<BannedWord[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  const [newWord, setNewWord] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: w, error: wErr } = await supabase.from('banned_words').select('*').order('created_at', { ascending: false });
      if (wErr) throw wErr;
      setWords((w as BannedWord[]) || []);

      const { data: v, error: vErr } = await supabase
        .from('moderation_violations')
        .select('id,user_id,content_type,content,detected_word,created_at, profile:user_id(display_name,username)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (vErr) throw vErr;
      setViolations((v as any) || []);

      const { data: u } = await supabase.from('profiles').select('id,display_name,username,is_banned').eq('is_banned', true).limit(100);
      setBannedUsers((u as BannedUser[]) || []);
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل بيانات الفلترة. تأكد من تطبيق migration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const addWord = async () => {
    const w = newWord.trim();
    if (!w) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('banned_words').insert({ word: w });
      if (error) throw error;
      setNewWord('');
      await load();
    } catch (e: any) {
      Alert.alert('تعذر الإضافة', e?.message || 'حاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  const toggleWord = async (id: string, enabled: boolean) => {
    try {
      const { error } = await supabase.from('banned_words').update({ enabled }).eq('id', id);
      if (error) throw error;
      setWords((prev) => prev.map((x) => (x.id === id ? { ...x, enabled } : x)));
    } catch (e: any) {
      Alert.alert('تعذر التحديث', e?.message || '');
    }
  };

  const deleteWord = async (id: string) => {
    try {
      const { error } = await supabase.from('banned_words').delete().eq('id', id);
      if (error) throw error;
      setWords((prev) => prev.filter((x) => x.id !== id));
    } catch (e: any) {
      Alert.alert('تعذر الحذف', e?.message || '');
    }
  };

  const unban = async (id: string) => {
    try {
      const { error } = await supabase.from('profiles').update({ is_banned: false }).eq('id', id);
      if (error) throw error;
      setBannedUsers((prev) => prev.filter((x) => x.id !== id));
    } catch (e: any) {
      Alert.alert('تعذر رفع الحظر', e?.message || '');
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader variant="sub" title="إدارة الفلترة والمخالفين" subtitle="الكلمات المحظورة والمتابعات" fallbackRoute="/admin" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomInset + 28 }]} showsVerticalScrollIndicator={false}>
        {loading ? <ActivityIndicator size="large" color={OASIS.colors.primary} /> : null}

        {error ? (
          <OasisSurface oasisSurface="card" style={styles.card}>
            <Text style={[styles.errorText, isDark && { color: colors.danger }]}>{error}</Text>
            <Text style={[styles.hint, isDark && { color: colors.muted }]}>
              طبّق migration `202610260001_moderation_filter.sql` في Supabase (SQL Editor) لإنشاء الجداول.
            </Text>
          </OasisSurface>
        ) : null}

        {/* Add word */}
        <OasisSurface oasisSurface="card" style={[styles.card, isDark && { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <View style={styles.cardHeader}>
            <Plus size={18} color={OASIS.colors.primary} />
            <Text style={[styles.cardTitle, isDark && { color: colors.ink }]}>إضافة كلمة محظورة</Text>
          </View>
          <View style={styles.addRow}>
            <TextInput value={newWord} onChangeText={setNewWord} placeholder="كلمة..." placeholderTextColor="#94A3B8" style={[styles.input, isDark && { backgroundColor: colors.background, borderColor: colors.line, color: colors.ink }]} />
            <Pressable oasisKind="action" oasisVariant="primary" style={styles.addBtn} onPress={() => void addWord()} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color={OASIS.colors.surface} /> : <Plus size={16} color={OASIS.colors.surface} />}
            </Pressable>
          </View>
        </OasisSurface>

        {/* Banned words */}
        <OasisSurface oasisSurface="card" style={[styles.card, isDark && { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <View style={styles.cardHeader}>
            <ShieldCheck size={18} color={OASIS.colors.primary} />
            <Text style={[styles.cardTitle, isDark && { color: colors.ink }]}>الكلمات المحظورة ({words.length})</Text>
          </View>
          {words.length === 0 ? (
            <Text style={[styles.empty, isDark && { color: colors.muted }]}>لا توجد كلمات. أضف أعلاه.</Text>
          ) : words.map((w) => (
            <View key={w.id} style={styles.row}>
              <Text style={[styles.word, isDark && { color: colors.ink }, !w.enabled && styles.wordDisabled]}>{w.word}</Text>
              <View style={styles.rowActions}>
                <Pressable style={[styles.toggle, w.enabled ? styles.toggleOn : styles.toggleOff]} onPress={() => void toggleWord(w.id, !w.enabled)}>
                  <Text style={styles.toggleText}>{w.enabled ? 'مفعل' : 'معطل'}</Text>
                </Pressable>
                <Pressable style={styles.deleteBtn} onPress={() => void deleteWord(w.id)}>
                  <Trash2 size={14} color={OASIS.colors.danger} />
                </Pressable>
              </View>
            </View>
          ))}
        </OasisSurface>

        {/* Violations */}
        <OasisSurface oasisSurface="card" style={[styles.card, isDark && { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <View style={styles.cardHeader}>
            <AlertTriangle size={18} color={OASIS.colors.warning} />
            <Text style={[styles.cardTitle, isDark && { color: colors.ink }]}>المخالفات ({violations.length})</Text>
          </View>
          {violations.length === 0 ? (
            <Text style={[styles.empty, isDark && { color: colors.muted }]}>لا توجد مخالفات.</Text>
          ) : violations.map((v) => (
            <View key={v.id} style={styles.violationRow}>
              <View style={styles.violationCopy}>
                <Text style={[styles.violationUser, isDark && { color: colors.ink }]}>
                  {v.profile?.display_name || v.profile?.username || 'مستخدم'} · {v.content_type}
                </Text>
                <Text style={[styles.violationContent, isDark && { color: colors.muted }]} numberOfLines={2}>{v.content}</Text>
                {v.detected_word ? <Text style={styles.detected}>كلمة: {v.detected_word}</Text> : null}
                <Text style={[styles.violationDate, isDark && { color: colors.muted }]}>{new Date(v.created_at).toLocaleString('ar-SA')}</Text>
              </View>
            </View>
          ))}
        </OasisSurface>

        {/* Banned users */}
        <OasisSurface oasisSurface="card" style={[styles.card, isDark && { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <View style={styles.cardHeader}>
            <Users size={18} color={OASIS.colors.danger} />
            <Text style={[styles.cardTitle, isDark && { color: colors.ink }]}>المحظورون ({bannedUsers.length})</Text>
          </View>
          {bannedUsers.length === 0 ? (
            <Text style={[styles.empty, isDark && { color: colors.muted }]}>لا يوجد محظورون.</Text>
          ) : bannedUsers.map((u) => (
            <View key={u.id} style={styles.row}>
              <Text style={[styles.word, isDark && { color: colors.ink }]}>{u.display_name || u.username || u.id}</Text>
              <Pressable style={styles.unbanBtn} onPress={() => void unban(u.id)}>
                <Text style={styles.unbanText}>رفع الحظر</Text>
              </Pressable>
            </View>
          ))}
        </OasisSurface>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F9F8' },
  content: { padding: 14, gap: 12, maxWidth: 920, width: '100%', alignSelf: 'center' },
  card: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#DDEAE4', backgroundColor: '#FFFFFF', gap: 10 },
  cardHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  cardTitle: { color: '#1C1C1E', fontSize: 15, fontWeight: '800', textAlign: 'right', flex: 1 },
  addRow: { flexDirection: 'row-reverse', gap: 8, alignItems: 'center' },
  input: { flex: 1, minHeight: 42, borderWidth: 1, borderColor: '#DDEAE4', borderRadius: 10, paddingHorizontal: 10, color: '#1C1C1E', fontSize: 12, fontWeight: '700', backgroundColor: '#FFFFFF' },
  addBtn: { width: 42, height: 42, borderRadius: 10, backgroundColor: OASIS.colors.primary, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  word: { color: '#1C1C1E', fontSize: 13, fontWeight: '700', flex: 1, textAlign: 'right' },
  wordDisabled: { textDecorationLine: 'line-through', color: '#94A3B8' },
  rowActions: { flexDirection: 'row-reverse', gap: 6, alignItems: 'center' },
  toggle: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  toggleOn: { backgroundColor: '#EAF5EF' },
  toggleOff: { backgroundColor: '#F1F5F9' },
  toggleText: { color: OASIS.colors.primary, fontSize: 11, fontWeight: '700' },
  deleteBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: OASIS.colors.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  empty: { color: '#636366', fontSize: 12, textAlign: 'center', paddingVertical: 8 },
  errorText: { color: OASIS.colors.danger, fontSize: 12, fontWeight: '700', textAlign: 'right' },
  hint: { color: '#636366', fontSize: 11, textAlign: 'right', lineHeight: 17 },
  violationRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  violationCopy: { gap: 2 },
  violationUser: { color: '#1C1C1E', fontSize: 12, fontWeight: '800', textAlign: 'right' },
  violationContent: { color: '#636366', fontSize: 11, textAlign: 'right' },
  detected: { color: OASIS.colors.danger, fontSize: 11, fontWeight: '700', textAlign: 'right' },
  violationDate: { color: '#94A3B8', fontSize: 10, textAlign: 'right' },
  unbanBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: OASIS.colors.soft },
  unbanText: { color: OASIS.colors.primary, fontSize: 11, fontWeight: '700' },
});
