import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { ShieldCheck, Plus, X, DatabaseZap, Search, Crown } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { ADMIN_COLORS as C } from './adminStyles';

const PERM_LABELS: Record<string, string> = {
  all: 'كل الصلاحيات',
  reports: 'البلاغات',
  content: 'المحتوى',
  search: 'البحث الشامل',
  users: 'المستخدمون',
  verifications: 'التوثيق',
  broadcast: 'البث والتعميم',
  config: 'إعدادات المنصة',
};

export function AdminRbacPanel({ onSaved }: { onSaved: (msg: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [roles, setRoles] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data: rData, error: rErr } = await supabase.from('admin_roles').select('*').order('key');
      if (rErr) {
        setUnavailable(true);
        return;
      }
      setRoles(rData || []);
      const { data: aData } = await supabase
        .from('admin_role_assignments')
        .select('user_id,role_key,created_at,user:user_id(id,display_name,username,avatar_url)')
        .order('created_at', { ascending: false })
        .limit(100);
      setAssignments(aData || []);
    } catch {
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const searchUsers = async () => {
    const term = query.replace(/[,()%*"'\\]/g, ' ').trim();
    if (term.length < 2) return;
    const like = `%${term}%`;
    const { data } = await supabase
      .from('profiles')
      .select('id,display_name,username,avatar_url,city')
      .or(`display_name.ilike.${like},username.ilike.${like}`)
      .limit(8);
    setCandidates(data || []);
  };

  const assign = async () => {
    if (!selectedUser || !selectedRole) return;
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from('admin_role_assignments').upsert(
        { user_id: selectedUser.id, role_key: selectedRole, assigned_by: auth.user?.id || null },
        { onConflict: 'user_id,role_key' }
      );
      if (error) throw error;
      onSaved('تم إسناد الدور ✅');
      setSelectedUser(null);
      setSelectedRole(null);
      setCandidates([]);
      setQuery('');
      await load();
    } catch (e: any) {
      onSaved('تعذّر الإسناد: ' + (e?.message || 'خطأ'));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (a: any) => {
    setBusy(true);
    try {
      const { error } = await supabase
        .from('admin_role_assignments')
        .delete()
        .eq('user_id', a.user_id)
        .eq('role_key', a.role_key);
      if (error) throw error;
      onSaved('تم سحب الدور');
      await load();
    } catch (e: any) {
      onSaved('تعذّر السحب: ' + (e?.message || 'خطأ'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={C.accent} />
      </View>
    );
  }

  if (unavailable) {
    return (
      <View style={styles.wrap}>
        <View style={styles.noticeCard}>
          <DatabaseZap size={26} color={C.warning} />
          <Text style={styles.noticeTitle}>جداول الأدوار غير مفعّلة بعد</Text>
          <Text style={styles.noticeText}>
            نفّذ ملف الترحيل
            {' '}
            <Text style={styles.code}>supabase/migrations/202610120001_platform_governance.sql</Text>
            {' '}
            في Supabase لتشغيل نظام الأدوار والصلاحيات.
          </Text>
        </View>
      </View>
    );
  }

  const roleLabel = (key: string) => roles.find((r) => r.key === key)?.label || key;

  return (
    <View style={styles.wrap}>
      {/* Roles catalogue */}
      <Text style={styles.sectionTitle}>الأدوار المتاحة</Text>
      <View style={{ gap: 8 }}>
        {roles.map((r) => (
          <View key={r.key} style={styles.roleCard}>
            <View style={styles.roleHead}>
              <View style={styles.roleTitleRow}>
                <Crown size={15} color={C.purple} />
                <Text style={styles.roleName}>{r.label}</Text>
              </View>
              <Text style={styles.roleKey}>{r.key}</Text>
            </View>
            {r.description ? <Text style={styles.roleDesc}>{r.description}</Text> : null}
            <View style={styles.permRow}>
              {Object.keys(r.permissions || {})
                .filter((k) => r.permissions[k])
                .map((k) => (
                  <View key={k} style={styles.permChip}>
                    <Text style={styles.permChipText}>{PERM_LABELS[k] || k}</Text>
                  </View>
                ))}
            </View>
          </View>
        ))}
      </View>

      {/* Assign */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>إسناد دور لمستخدم</Text>
        <View style={styles.inputRow}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={searchUsers}
            placeholder="ابحث عن مستخدم بالاسم أو المعرّف…"
            placeholderTextColor={C.subtle}
            style={styles.input}
            returnKeyType="search"
          />
          <Pressable style={styles.searchBtn} onPress={searchUsers}>
            <Search size={16} color="#fff" />
          </Pressable>
        </View>

        {candidates.map((u) => (
          <Pressable
            key={u.id}
            style={[styles.candidate, selectedUser?.id === u.id && { borderColor: C.accent, backgroundColor: C.accentLight }]}
            onPress={() => setSelectedUser(u)}
          >
            <Text style={styles.candidateName}>{u.display_name || u.username || 'مستخدم'}</Text>
            <Text style={styles.candidateSub}>{u.city || 'غير محدد'}</Text>
          </Pressable>
        ))}

        {selectedUser ? (
          <>
            <Text style={styles.picked}>المستخدم المحدد: {selectedUser.display_name || selectedUser.username}</Text>
            <View style={styles.permRow}>
              {roles.map((r) => (
                <Pressable
                  key={r.key}
                  style={[styles.rolePick, selectedRole === r.key && { backgroundColor: C.accent, borderColor: C.accent }]}
                  onPress={() => setSelectedRole(r.key)}
                >
                  <Text style={[styles.rolePickText, selectedRole === r.key && { color: '#fff' }]}>{r.label}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              style={[styles.assignBtn, (!selectedRole || busy) && { opacity: 0.5 }]}
              onPress={assign}
              disabled={!selectedRole || busy}
            >
              <Plus size={15} color="#fff" />
              <Text style={styles.assignText}>إسناد الدور</Text>
            </Pressable>
          </>
        ) : null}
      </View>

      {/* Assignments */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>الأدوار المُسنَدة ({assignments.length})</Text>
        {assignments.length === 0 ? (
          <Text style={styles.emptyText}>لا توجد أدوار مُسنَدة بعد.</Text>
        ) : (
          assignments.map((a) => (
            <View key={`${a.user_id}-${a.role_key}`} style={styles.assignRow}>
              <View style={styles.assignInfo}>
                <Text style={styles.assignName}>{a.user?.display_name || a.user?.username || 'مستخدم'}</Text>
                <View style={styles.assignRoleChip}>
                  <ShieldCheck size={11} color={C.accentDark} />
                  <Text style={styles.assignRoleText}>{roleLabel(a.role_key)}</Text>
                </View>
              </View>
              <Pressable style={styles.revokeBtn} onPress={() => revoke(a)} disabled={busy}>
                <X size={14} color={C.danger} />
              </Pressable>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 14, gap: 12, paddingBottom: 40 },
  center: { paddingVertical: 60, alignItems: 'center' },
  sectionTitle: { fontSize: 13.5, fontWeight: '900', color: C.ink, textAlign: 'right', marginBottom: 4 },
  card: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14, gap: 10 },
  roleCard: { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 12, gap: 6 },
  roleHead: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  roleTitleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  roleName: { fontSize: 13.5, fontWeight: '900', color: C.ink },
  roleKey: { fontSize: 10, color: C.subtle, fontWeight: '700' },
  roleDesc: { fontSize: 11, color: C.muted, textAlign: 'right', lineHeight: 17 },
  permRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 },
  permChip: { backgroundColor: C.purpleLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  permChipText: { fontSize: 10, fontWeight: '800', color: C.purple },
  inputRow: { flexDirection: 'row-reverse', gap: 8 },
  input: { flex: 1, backgroundColor: C.bg, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 12.5, color: C.ink, textAlign: 'right' },
  searchBtn: { width: 44, borderRadius: 12, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  candidate: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  candidateName: { fontSize: 12.5, fontWeight: '800', color: C.ink, textAlign: 'right' },
  candidateSub: { fontSize: 10.5, color: C.muted },
  picked: { fontSize: 12, fontWeight: '800', color: C.accentDark, textAlign: 'right' },
  rolePick: { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  rolePickText: { fontSize: 11, fontWeight: '800', color: C.inkMuted },
  assignBtn: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.accent, borderRadius: 12, paddingVertical: 12 },
  assignText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  assignRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.bg, borderRadius: 12, padding: 10 },
  assignInfo: { flex: 1, gap: 4, alignItems: 'flex-end' },
  assignName: { fontSize: 12.5, fontWeight: '800', color: C.ink, textAlign: 'right' },
  assignRoleChip: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, backgroundColor: C.accentLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  assignRoleText: { fontSize: 10, fontWeight: '800', color: C.accentDark },
  revokeBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.dangerLight, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 12, color: C.muted, textAlign: 'right' },
  noticeCard: { backgroundColor: C.warningLight, borderRadius: 16, padding: 18, alignItems: 'center', gap: 8 },
  noticeTitle: { fontSize: 14, fontWeight: '900', color: '#92400E', textAlign: 'center' },
  noticeText: { fontSize: 12, color: '#92400E', textAlign: 'center', lineHeight: 20 },
  code: { fontWeight: '900', color: '#7C2D12' },
});
