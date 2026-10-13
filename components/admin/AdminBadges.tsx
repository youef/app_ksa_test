import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet, TextInput } from 'react-native';
import {
  Award,
  Search,
  Plus,
  X,
  Users,
  Sparkles,
  DatabaseZap,
  RefreshCw,
  Trophy,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { ADMIN_COLORS as C } from './adminStyles';

interface BadgeRow {
  id: number;
  user_id: string;
  badge_key: string;
  badge_label: string;
  badge_description: string | null;
  badge_icon: string | null;
  tier: number;
  earned_at: string;
  user?: { id: string; display_name: string | null; username: string | null; avatar_url: string | null };
}

interface CatalogEntry {
  key: string;
  label: string;
  emoji: string;
  desc: string;
}

const CATALOG: CatalogEntry[] = [
  { key: 'service_provider_5', label: 'مزوّد خدمات — برونزي', emoji: '🛠️', desc: 'أكمل 5 خدمات' },
  { key: 'service_provider_10', label: 'مزوّد خدمات — فضي', emoji: '🧰', desc: 'أكمل 10 خدمات' },
  { key: 'service_provider_25', label: 'مزوّد خدمات — ذهبي', emoji: '🏅', desc: 'أكمل 25 خدمة' },
  { key: 'request_completer_5', label: 'منجز فزعات — برونزي', emoji: '🤝', desc: 'أنجز 5 فزعات' },
  { key: 'request_completer_10', label: 'منجز فزعات — فضي', emoji: '💪', desc: 'أنجز 10 فزعات' },
  { key: 'helpful_neighbor_10', label: 'جار مفيد — برونزي', emoji: '🌟', desc: '10 تفاعلات مفيدة' },
  { key: 'helpful_neighbor_50', label: 'جار مفيد — ذهبي', emoji: '🌠', desc: '50 تفاعلًا مفيدًا' },
  { key: 'ambassador', label: 'سفير الحي', emoji: '📣', desc: 'دعوة وتفعيل أعضاء' },
  { key: 'verified_contributor', label: 'مساهم موثّق', emoji: '✅', desc: 'مساهمات موثّقة' },
];

const TIERS: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: 'برونزي', color: '#B45309', bg: '#FEF3C7' },
  2: { label: 'فضي', color: '#475569', bg: '#F1F5F9' },
  3: { label: 'ذهبي', color: '#A16207', bg: '#FEF9C3' },
};

function name(u?: BadgeRow['user'] | null): string {
  return u?.display_name || u?.username || 'جار';
}

export function AdminBadges({ onSaved }: { onSaved: (msg: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [badges, setBadges] = useState<BadgeRow[]>([]);

  // award form
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [selectedBadge, setSelectedBadge] = useState<CatalogEntry>(CATALOG[0]);
  const [tier, setTier] = useState(1);
  const [awarding, setAwarding] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_badges')
        .select('*, user:profiles!user_badges_user_id_fkey(id, display_name, username, avatar_url)')
        .order('earned_at', { ascending: false })
        .limit(300);
      if (error) {
        setUnavailable(true);
        setBadges([]);
      } else {
        setUnavailable(false);
        setBadges((data || []) as BadgeRow[]);
      }
    } catch {
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const searchUsers = async () => {
    const term = query.trim().replace(/[,()%*"'\\]/g, ' ');
    if (!term) return;
    setSearching(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url, city')
        .or(`display_name.ilike.%${term}%,username.ilike.%${term}%`)
        .limit(12);
      setCandidates(data || []);
    } finally {
      setSearching(false);
    }
  };

  const award = async () => {
    if (!selectedUser) {
      onSaved('اختر مستخدمًا أولاً');
      return;
    }
    setAwarding(true);
    try {
      const { error } = await supabase.from('user_badges').upsert(
        {
          user_id: selectedUser.id,
          badge_key: selectedBadge.key,
          badge_label: selectedBadge.label,
          badge_description: selectedBadge.desc,
          badge_icon: selectedBadge.emoji,
          tier,
        },
        { onConflict: 'user_id,badge_key,tier' }
      );
      if (error) {
        onSaved('تعذّر منح الوسام: ' + error.message);
      } else {
        onSaved(`تم منح وسام «${selectedBadge.label}» إلى ${name(selectedUser)} 🏅`);
        setSelectedUser(null);
        setQuery('');
        setCandidates([]);
        setShowForm(false);
        await load();
      }
    } finally {
      setAwarding(false);
    }
  };

  const countsByKey = useMemo(() => {
    const m = new Map<string, number>();
    badges.forEach((b) => m.set(b.badge_key, (m.get(b.badge_key) || 0) + 1));
    return m;
  }, [badges]);

  const distinctHolders = useMemo(() => new Set(badges.map((b) => b.user_id)).size, [badges]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={C.accent} />
        <Text style={styles.loadingText}>جارٍ تحميل الأوسمة...</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.headRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>الأوسمة والتحفيز 🏅</Text>
          <Text style={styles.sectionSub}>
            منح وتتبّع أوسمة الجيران: مزوّدو الخدمات، منجزو الفزعات، الجيران المفيدون وسفراء الحي.
          </Text>
        </View>
        <Pressable style={styles.refreshBtn} onPress={() => void load()}>
          <RefreshCw size={15} color={C.accentDark} />
        </Pressable>
      </View>

      <View style={styles.metricGrid}>
        <Metric icon={<Award size={16} color={C.accent} />} label="إجمالي الأوسمة الممنوحة" value={badges.length} />
        <Metric icon={<Users size={16} color={C.info} />} label="عدد الحائزين" value={distinctHolders} />
        <Metric icon={<Sparkles size={16} color={C.purple} />} label="أنواع الأوسمة" value={countsByKey.size} />
        <Metric icon={<Trophy size={16} color={C.warning} />} label="أوسمة ذهبية" value={badges.filter((b) => b.tier === 3).length} />
      </View>

      {unavailable ? (
        <View style={styles.notice}>
          <DatabaseZap size={24} color={C.warning} />
          <Text style={styles.noticeTitle}>جدول الأوسمة غير مفعّل بعد</Text>
          <Text style={styles.noticeText}>
            نفّذ ملف الترحيل <Text style={styles.code}>supabase/migrations/202610130003_admin_security.sql</Text> في
            محرّر SQL بمشروع Supabase لتفعيل جدول user_badges.
          </Text>
        </View>
      ) : null}

      <Pressable style={styles.awardBtn} onPress={() => setShowForm((v) => !v)}>
        {showForm ? <X size={16} color="#fff" /> : <Plus size={16} color="#fff" />}
        <Text style={styles.awardBtnText}>{showForm ? 'إغلاق نموذج المنح' : 'منح وسام لمستخدم'}</Text>
      </Pressable>

      {showForm ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>منح وسام جديد</Text>

          <Text style={styles.fieldLabel}>1) ابحث عن المستخدم</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.input}
              placeholder="اسم المستخدم أو المعرّف"
              placeholderTextColor={C.subtle}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => void searchUsers()}
              accessibilityLabel="بحث المستخدم"
            />
            <Pressable style={styles.searchBtn} onPress={() => void searchUsers()}>
              {searching ? <ActivityIndicator color="#fff" size="small" /> : <Search size={16} color="#fff" />}
            </Pressable>
          </View>

          {selectedUser ? (
            <View style={styles.selectedUser}>
              <Text style={styles.selectedUserText}>المحدد: {name(selectedUser)}</Text>
              <Pressable onPress={() => setSelectedUser(null)}>
                <X size={14} color={C.muted} />
              </Pressable>
            </View>
          ) : candidates.length ? (
            <View style={styles.candidatesWrap}>
              {candidates.map((u) => (
                <Pressable key={u.id} style={styles.candidate} onPress={() => setSelectedUser(u)}>
                  <Text style={styles.candidateName}>{name(u)}</Text>
                  <Text style={styles.candidateMeta}>{u.city || 'مدينة غير محددة'}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <Text style={styles.fieldLabel}>2) اختر الوسام</Text>
          <View style={styles.catGrid}>
            {CATALOG.map((b) => (
              <Pressable
                key={b.key}
                style={[styles.catChip, selectedBadge.key === b.key && styles.catChipActive]}
                onPress={() => setSelectedBadge(b)}
              >
                <Text style={styles.catEmoji}>{b.emoji}</Text>
                <Text style={[styles.catText, selectedBadge.key === b.key && styles.catTextActive]} numberOfLines={1}>
                  {b.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>3) اختر المستوى</Text>
          <View style={styles.tierRow}>
            {[1, 2, 3].map((t) => (
              <Pressable
                key={t}
                style={[styles.tierChip, tier === t && { backgroundColor: TIERS[t].bg, borderColor: TIERS[t].color }]}
                onPress={() => setTier(t)}
              >
                <Text style={[styles.tierText, tier === t && { color: TIERS[t].color }]}>{TIERS[t].label}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable style={[styles.submitBtn, awarding && { opacity: 0.6 }]} onPress={() => void award()} disabled={awarding}>
            {awarding ? <ActivityIndicator color="#fff" size="small" /> : <Award size={16} color="#fff" />}
            <Text style={styles.submitText}>منح الوسام</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Catalog overview */}
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>كتالوج الأوسمة</Text>
          <Text style={styles.cardSub}>توزيع الممنوح</Text>
        </View>
        <View style={styles.catOverviewGrid}>
          {CATALOG.map((b) => (
            <View key={b.key} style={styles.catOverview}>
              <Text style={styles.catOverviewEmoji}>{b.emoji}</Text>
              <Text style={styles.catOverviewName} numberOfLines={1}>{b.label}</Text>
              <Text style={styles.catOverviewCount}>{countsByKey.get(b.key) || 0}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Recent awards */}
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>أحدث الأوسمة</Text>
          <Text style={styles.cardSub}>{badges.length} سجل</Text>
        </View>
        {badges.length === 0 ? (
          <Text style={styles.emptyHint}>لا توجد أوسمة ممنوحة بعد.</Text>
        ) : (
          badges.slice(0, 25).map((b) => {
            const tierMeta = TIERS[b.tier] || TIERS[1];
            return (
              <View key={b.id} style={styles.awardRow}>
                <Text style={styles.awardEmoji}>{b.badge_icon || '🏅'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.awardTitle} numberOfLines={1}>
                    {b.badge_label || b.badge_key}
                  </Text>
                  <Text style={styles.awardSub} numberOfLines={1}>
                    {name(b.user)}
                    {b.badge_description ? ` · ${b.badge_description}` : ''}
                  </Text>
                </View>
                <View style={[styles.tierBadge, { backgroundColor: tierMeta.bg }]}>
                  <Text style={[styles.tierBadgeText, { color: tierMeta.color }]}>{tierMeta.label}</Text>
                </View>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <View style={styles.metricTile}>
      <View style={styles.metricTileHead}>
        {icon}
        <Text style={styles.metricTileLabel}>{label}</Text>
      </View>
      <Text style={styles.metricTileNum}>{value.toLocaleString('ar-EG')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 14, paddingBottom: 48, gap: 2 },
  center: { paddingVertical: 60, alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 12.5, color: C.muted, fontWeight: '700' },
  headRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '900', color: C.ink, textAlign: 'right' },
  sectionSub: { fontSize: 11, color: C.muted, textAlign: 'right', lineHeight: 17, marginTop: 3 },
  refreshBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.accentLight, alignItems: 'center', justifyContent: 'center' },

  metricGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  metricTile: { flexGrow: 1, flexBasis: 150, minWidth: 140, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14 },
  metricTileHead: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 6 },
  metricTileLabel: { flex: 1, fontSize: 11, fontWeight: '800', color: C.muted, textAlign: 'right' },
  metricTileNum: { fontSize: 22, fontWeight: '900', color: C.ink, textAlign: 'right' },

  awardBtn: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.accent, borderRadius: 14, paddingVertical: 12, marginBottom: 12 },
  awardBtnText: { color: '#fff', fontWeight: '900', fontSize: 13 },

  card: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 12 },
  cardHead: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  cardTitle: { fontSize: 13.5, fontWeight: '900', color: C.ink, textAlign: 'right' },
  cardSub: { fontSize: 10.5, color: C.subtle, fontWeight: '700' },

  fieldLabel: { fontSize: 11.5, fontWeight: '900', color: C.inkMuted, textAlign: 'right', marginTop: 10, marginBottom: 6 },
  searchRow: { flexDirection: 'row-reverse', gap: 8 },
  input: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 9, fontSize: 12.5, textAlign: 'right', color: C.ink },
  searchBtn: { width: 44, borderRadius: 12, backgroundColor: C.navyMid, alignItems: 'center', justifyContent: 'center' },
  selectedUser: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.accentLight, borderRadius: 12, padding: 10, marginTop: 8 },
  selectedUserText: { fontSize: 12, fontWeight: '900', color: C.accentDark },
  candidatesWrap: { marginTop: 8, gap: 6 },
  candidate: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: C.border },
  candidateName: { fontSize: 12, fontWeight: '800', color: C.ink },
  candidateMeta: { fontSize: 10, color: C.subtle, fontWeight: '700' },

  catGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  catChip: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 11, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: C.border, maxWidth: '100%' },
  catChipActive: { backgroundColor: C.navyMid, borderColor: C.navyMid },
  catEmoji: { fontSize: 14 },
  catText: { fontSize: 11, fontWeight: '800', color: C.inkMuted },
  catTextActive: { color: '#fff' },

  tierRow: { flexDirection: 'row-reverse', gap: 8 },
  tierChip: { flex: 1, paddingVertical: 9, borderRadius: 12, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  tierText: { fontSize: 11.5, fontWeight: '900', color: C.muted },

  submitBtn: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.navyMid, borderRadius: 14, paddingVertical: 12, marginTop: 14 },
  submitText: { color: '#fff', fontWeight: '900', fontSize: 13 },

  catOverviewGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  catOverview: { flexGrow: 1, flexBasis: 100, minWidth: 96, backgroundColor: '#F8FAFC', borderRadius: 14, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  catOverviewEmoji: { fontSize: 22 },
  catOverviewName: { fontSize: 10, fontWeight: '800', color: C.inkMuted, textAlign: 'center', marginTop: 2 },
  catOverviewCount: { fontSize: 15, fontWeight: '900', color: C.accentDark, marginTop: 2 },

  awardRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  awardEmoji: { fontSize: 22 },
  awardTitle: { fontSize: 12, fontWeight: '900', color: C.ink, textAlign: 'right' },
  awardSub: { fontSize: 10, color: C.subtle, fontWeight: '700', textAlign: 'right', marginTop: 1 },
  tierBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9 },
  tierBadgeText: { fontSize: 9.5, fontWeight: '900' },

  emptyHint: { fontSize: 11.5, color: C.subtle, textAlign: 'right', lineHeight: 18, paddingVertical: 6 },
  notice: { backgroundColor: C.warningLight, borderRadius: 16, padding: 18, alignItems: 'center', gap: 8, marginBottom: 14 },
  noticeTitle: { fontSize: 14, fontWeight: '900', color: '#92400E', textAlign: 'center' },
  noticeText: { fontSize: 12, color: '#92400E', textAlign: 'center', lineHeight: 20 },
  code: { fontWeight: '900', color: '#7C2D12' },
});
