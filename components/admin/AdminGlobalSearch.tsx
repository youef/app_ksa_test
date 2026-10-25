import { OasisTextInput as TextInput, OasisPressable as Pressable, OasisSurface } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import {
  Search,
  Download,
  Check,
  X,
  User,
  FileText,
  Wrench,
  Truck,
  ShieldCheck,
  Ban,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { exportCsv } from '@/lib/csvExport';
import { ADMIN_COLORS as C } from './adminStyles';

type Any = Record<string, any>;

interface SearchResults {
  users: Any[];
  questions: Any[];
  services: Any[];
  requests: Any[];
}

const EMPTY: SearchResults = { users: [], questions: [], services: [], requests: [] };

function sanitize(term: string): string {
  return term.replace(/[,()%*"'\\]/g, ' ').trim();
}

function name(u?: Any | null): string {
  return u?.display_name || u?.username || 'أحد الجيران';
}

export function AdminGlobalSearch({
  onOpenUser,
  onBulkUsers,
}: {
  onOpenUser: (user: Any) => void;
  onBulkUsers: (users: Any[], patch: { is_verified?: boolean; is_banned?: boolean }) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const runSearch = async () => {
    const term = sanitize(query);
    if (term.length < 2) return;
    setLoading(true);
    setSelected([]);
    try {
      // Use new full-text search RPC
      const { data: ftsResults, error: ftsErr } = await supabase.rpc('admin_global_search', {
        p_query: term,
        p_limit: 60,
      });

      let users: Any[] = [], questions: Any[] = [], services: Any[] = [], requests: Any[] = [];

      if (!ftsErr && ftsResults) {
        for (const r of ftsResults) {
          const item = { id: r.id, title: r.title, subtitle: r.subtitle, city: r.city, district: r.district, created_at: r.created_at };
          if (r.type === 'question') questions.push(item);
          else if (r.type === 'service') services.push(item);
          else if (r.type === 'request') requests.push(item);
        }
      } else {
        console.warn('FTS RPC failed, falling back to ilike:', ftsErr);
        // Fallback to ilike (original logic)
        const like = `%${term}%`;
        const [u, qs, sv, rq] = await Promise.all([
          supabase.from('profiles').select('id,username,display_name,avatar_url,city,district,role,is_verified,is_banned,created_at').or(`display_name.ilike.${like},username.ilike.${like},city.ilike.${like}`).limit(20),
          supabase.from('questions').select('id,title,body,city,district,author_id,created_at').or(`title.ilike.${like},body.ilike.${like}`).limit(20),
          supabase.from('services').select('id,name,description,city,district,provider_id,created_at').or(`name.ilike.${like},description.ilike.${like}`).limit(20),
          supabase.from('requests').select('id,title,description,city,district,requester_id,created_at').or(`title.ilike.${like},description.ilike.${like}`).limit(20),
        ]);
        users = (u.data || []) as Any[];
        questions = (qs.data || []) as Any[];
        services = (sv.data || []) as Any[];
        requests = (rq.data || []) as Any[];
      }

      // Also search users by name/city (FTS doesn't cover profiles yet)
      const like = `%${term}%`;
      const { data: userData } = await supabase
        .from('profiles')
        .select('id,username,display_name,avatar_url,city,district,role,is_verified,is_banned,created_at')
        .or(`display_name.ilike.${like},username.ilike.${like},city.ilike.${like}`)
        .limit(20);
      users = (userData || []) as Any[];

      setResults({ users, questions, services, requests });
      setSearched(true);
    } catch (e) {
      console.warn('Global search failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const applyBulk = async (patch: { is_verified?: boolean; is_banned?: boolean }) => {
    const targets = results.users.filter((u) => selected.includes(u.id));
    if (!targets.length) return;
    setBusy(true);
    try {
      await onBulkUsers(targets, patch);
      setSelected([]);
      await runSearch();
    } finally {
      setBusy(false);
    }
  };

  const total = results.users.length + results.questions.length + results.services.length + results.requests.length;

  return (
    <View style={styles.wrap}>
      {/* Search bar */}
      <OasisSurface oasisSurface="card" style={styles.searchCard}>
        <Text style={styles.title}>البحث الشامل 🔎</Text>
        <Text style={styles.subtitle}>ابحث عن مستخدم أو منشور أو خدمة أو طلب في كل أنحاء المنصة.</Text>
        <View style={styles.inputRow}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={runSearch}
            placeholder="اكتب اسمًا، مدينة، أو كلمة مفتاحية…"
            placeholderTextColor={C.subtle}
            style={styles.input}
            returnKeyType="search"
          />
          <Pressable oasisKind="icon" style={styles.searchBtn} onPress={runSearch} disabled={loading}>
            {loading ? <ActivityIndicator size="small" color={OASIS.colors.surface} /> : <Search size={16} color={OASIS.colors.surface} />}
          </Pressable>
        </View>
      </OasisSurface>

      {searched && !loading ? (
        <Text style={styles.totalLine}>النتائج: {total} عنصر</Text>
      ) : null}

      {/* Bulk action bar */}
      {selected.length > 0 ? (
        <View style={styles.bulkBar}>
          <Text style={styles.bulkCount}>تم تحديد {selected.length} مستخدم</Text>
          <View style={styles.bulkBtns}>
            <Pressable oasisKind="action" style={[styles.bulkBtn, { backgroundColor: C.successLight }]} disabled={busy} onPress={() => applyBulk({ is_verified: true })}>
              <ShieldCheck size={14} color={C.accentDark} />
              <Text style={[styles.bulkBtnText, { color: C.accentDark }]}>توثيق</Text>
            </Pressable>
            <Pressable oasisKind="action" style={[styles.bulkBtn, { backgroundColor: C.warningLight }]} disabled={busy} onPress={() => applyBulk({ is_verified: false })}>
              <X size={14} color="#B45309" />
              <Text style={[styles.bulkBtnText, { color: '#B45309' }]}>إلغاء التوثيق</Text>
            </Pressable>
            <Pressable oasisKind="action" style={[styles.bulkBtn, { backgroundColor: C.dangerLight }]} disabled={busy} onPress={() => applyBulk({ is_banned: true })}>
              <Ban size={14} color={C.danger} />
              <Text style={[styles.bulkBtnText, { color: C.danger }]}>حظر</Text>
            </Pressable>
            <Pressable oasisKind="action" style={[styles.bulkBtn, { backgroundColor: C.borderLight }]} disabled={busy} onPress={() => applyBulk({ is_banned: false })}>
              <Check size={14} color={C.inkMuted} />
              <Text style={[styles.bulkBtnText, { color: C.inkMuted }]}>فك الحظر</Text>
            </Pressable>
            <Pressable oasisKind="action" style={[styles.bulkBtn, { backgroundColor: C.borderLight }]} onPress={() => setSelected([])}>
              <Text style={[styles.bulkBtnText, { color: C.inkMuted }]}>إلغاء</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Users */}
      {results.users.length > 0 ? (
        <Section
          icon={<User size={15} color={C.info} />}
          title={`المستخدمون (${results.users.length})`}
          onExport={() =>
            exportCsv('hayna_users', ['id', 'name', 'username', 'role', 'verified', 'banned', 'city', 'district', 'created_at'], results.users.map((u) => [u.id, name(u), u.username, u.role, u.is_verified, u.is_banned, u.city, u.district, u.created_at]))
          }
        >
          {results.users.map((u) => {
            const active = selected.includes(u.id);
            return (
              <View key={u.id} style={[styles.row, active && { borderColor: C.accent }]}>
                <Pressable style={[styles.checkbox, active && { backgroundColor: C.accent, borderColor: C.accent }]} onPress={() => toggleSelect(u.id)}>
                  {active ? <Check size={13} color={OASIS.colors.surface} /> : null}
                </Pressable>
                <View style={styles.rowBody}>
                  <View style={styles.rowTitleRow}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{name(u)}</Text>
                    {u.is_verified ? <ShieldCheck size={13} color={C.accent} /> : null}
                    {u.is_banned ? <Ban size={13} color={C.danger} /> : null}
                  </View>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    @{u.username || '—'} · {u.city || 'غير محدد'}{u.district ? ' · ' + u.district : ''} · {u.role === 'admin' ? 'مدير' : 'مواطن'}
                  </Text>
                </View>
                <Pressable oasisKind="action" style={styles.openBtn} onPress={() => onOpenUser(u)}>
                  <Text style={styles.openBtnText}>الملف</Text>
                </Pressable>
              </View>
            );
          })}
        </Section>
      ) : null}

      {/* Questions */}
      {results.questions.length > 0 ? (
        <Section
          icon={<FileText size={15} color={C.accent} />}
          title={`المنشورات (${results.questions.length})`}
          onExport={() =>
            exportCsv('hayna_questions', ['id', 'title', 'city', 'district', 'created_at'], results.questions.map((q) => [q.id, q.title, q.city, q.district, q.created_at]))
          }
        >
          {results.questions.map((q) => (
            <View key={q.id} style={styles.row}>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={1}>{q.title || 'منشور'}</Text>
                <Text style={styles.rowSub}>{q.city || 'غير محدد'}{q.district ? ' · ' + q.district : ''} · {new Date(q.created_at).toLocaleDateString('ar-SA')}</Text>
              </View>
            </View>
          ))}
        </Section>
      ) : null}

      {/* Services */}
      {results.services.length > 0 ? (
        <Section
          icon={<Wrench size={15} color={C.purple} />}
          title={`الخدمات (${results.services.length})`}
          onExport={() =>
            exportCsv('hayna_services', ['id', 'name', 'city', 'district', 'created_at'], results.services.map((s) => [s.id, s.name || s.title, s.city, s.district, s.created_at]))
          }
        >
          {results.services.map((s) => (
            <View key={s.id} style={styles.row}>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={1}>{s.name || s.title || 'خدمة'}</Text>
                <Text style={styles.rowSub}>{s.city || 'غير محدد'} · {new Date(s.created_at).toLocaleDateString('ar-SA')}</Text>
              </View>
            </View>
          ))}
        </Section>
      ) : null}

      {/* Requests */}
      {results.requests.length > 0 ? (
        <Section
          icon={<Truck size={15} color={C.warning} />}
          title={`الطلبات (${results.requests.length})`}
          onExport={() =>
            exportCsv('hayna_requests', ['id', 'title', 'city', 'district', 'created_at'], results.requests.map((r) => [r.id, r.title, r.city, r.district, r.created_at]))
          }
        >
          {results.requests.map((r) => (
            <View key={r.id} style={styles.row}>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={1}>{r.title || 'طلب'}</Text>
                <Text style={styles.rowSub}>{r.city || 'غير محدد'} · {new Date(r.created_at).toLocaleDateString('ar-SA')}</Text>
              </View>
            </View>
          ))}
        </Section>
      ) : null}

      {searched && !loading && total === 0 ? (
        <View style={styles.empty}>
          <Search size={38} color={C.subtle} />
          <Text style={styles.emptyTitle}>لا نتائج مطابقة</Text>
          <Text style={styles.emptySub}>جرّب كلمة مختلفة أو اسم مدينة.</Text>
        </View>
      ) : null}
    </View>
  );
}

function Section({
  icon,
  title,
  onExport,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  onExport: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={styles.sectionTitleRow}>
          {icon}
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        <Pressable oasisKind="action" style={styles.exportBtn} onPress={onExport}>
          <Download size={13} color={C.accentDark} />
          <Text style={styles.exportText}>CSV</Text>
        </Pressable>
      </View>
      <View style={{ gap: 8 }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 14, gap: 12, paddingBottom: 24 },
  searchCard: { backgroundColor: C.navyMid, borderRadius: 14, padding: 14, gap: 6 },
  title: { fontSize: 16, fontWeight: '700', color: OASIS.colors.surface, textAlign: 'right' },
  subtitle: { fontSize: 11, color: '#94A3B8', textAlign: 'right', lineHeight: 17, marginBottom: 6 },
  inputRow: { flexDirection: 'row-reverse', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: OASIS.colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 13,
    color: C.ink,
    textAlign: 'right',
  },
  searchBtn: { width: 46, borderRadius: 12, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },

  totalLine: { fontSize: 12, fontWeight: '600', color: C.inkMuted, textAlign: 'right' },

  bulkBar: { backgroundColor: C.navyMid, borderRadius: 14, padding: 12, gap: 10 },
  bulkCount: { color: OASIS.colors.surface, fontSize: 12.5, fontWeight: '700', textAlign: 'right' },
  bulkBtns: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 },
  bulkBtn: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10 },
  bulkBtnText: { fontSize: 11, fontWeight: '700' },

  section: { gap: 8 },
  sectionHead: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 13.5, fontWeight: '700', color: C.ink },
  exportBtn: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, backgroundColor: C.accentLight, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 9 },
  exportText: { fontSize: 11, fontWeight: '700', color: C.accentDark },

  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 11,
  },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, gap: 3, alignItems: 'flex-end' },
  rowTitleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5 },
  rowTitle: { fontSize: 12.5, fontWeight: '700', color: C.ink, textAlign: 'right' },
  rowSub: { fontSize: 11, color: C.muted, textAlign: 'right' },
  openBtn: { backgroundColor: C.infoLight, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9 },
  openBtnText: { fontSize: 11, fontWeight: '700', color: C.info },

  empty: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: C.ink },
  emptySub: { fontSize: 12, color: C.muted, textAlign: 'center' },
});
