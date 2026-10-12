import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, Switch } from 'react-native';
import {
  CloudSun,
  Store,
  Car,
  Images,
  AlertTriangle,
  Gift,
  Power,
  Save,
  DatabaseZap,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { ADMIN_COLORS as C } from './adminStyles';

const FLAGS: Array<{ key: string; label: string; icon: React.ReactNode }> = [
  { key: 'weather', label: 'الطقس والتنبيهات الجوية', icon: <CloudSun size={16} color={C.info} /> },
  { key: 'market', label: 'السوق والخدمات', icon: <Store size={16} color={C.accent} /> },
  { key: 'carpooling', label: 'النقل التشاركي', icon: <Car size={16} color={C.purple} /> },
  { key: 'stories', label: 'القصص اليومية', icon: <Images size={16} color={C.warning} /> },
  { key: 'urgent_alerts', label: 'التنبيهات الطارئة', icon: <AlertTriangle size={16} color={C.danger} /> },
  { key: 'rewards', label: 'المكافآت والتحفيز', icon: <Gift size={16} color={C.accentDark} /> },
];

export function AdminFeatureFlags({ onSaved }: { onSaved: (msg: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [maintenance, setMaintenance] = useState({ enabled: false, message: '' });
  const [flags, setFlags] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.from('app_config').select('key,value');
        if (error) {
          setUnavailable(true);
        } else {
          const map: Record<string, any> = {};
          (data || []).forEach((r: any) => (map[r.key] = r.value));
          setMaintenance({ enabled: false, message: '', ...(map.maintenance_mode || {}) });
          setFlags(map.feature_flags || {});
        }
      } catch {
        setUnavailable(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const now = new Date().toISOString();
      const { error } = await supabase.from('app_config').upsert(
        [
          { key: 'maintenance_mode', value: maintenance, updated_by: auth.user?.id || null, updated_at: now },
          { key: 'feature_flags', value: flags, updated_by: auth.user?.id || null, updated_at: now },
        ],
        { onConflict: 'key' }
      );
      if (error) throw error;
      onSaved('تم حفظ إعدادات المنصة ✅');
    } catch (e: any) {
      onSaved('تعذّر الحفظ: ' + (e?.message || 'خطأ غير معروف'));
    } finally {
      setSaving(false);
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
          <Text style={styles.noticeTitle}>جداول الحوكمة غير مفعّلة بعد</Text>
          <Text style={styles.noticeText}>
            لتشغيل مفاتيح الميزات ووضع الصيانة، نفّذ ملف الترحيل
            {' '}
            <Text style={styles.code}>supabase/migrations/202610120001_platform_governance.sql</Text>
            {' '}في محرّر SQL بمشروع Supabase ثم أعد فتح اللوحة.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {/* Maintenance */}
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <View style={styles.cardTitleRow}>
            <Power size={16} color={maintenance.enabled ? C.danger : C.accent} />
            <Text style={styles.cardTitle}>وضع الصيانة العام</Text>
          </View>
          <Switch
            value={maintenance.enabled}
            onValueChange={(v) => setMaintenance((m) => ({ ...m, enabled: v }))}
            trackColor={{ true: C.danger, false: C.border }}
            thumbColor="#fff"
          />
        </View>
        <Text style={styles.cardHint}>
          عند التفعيل سيظهر للمستخدمين إشعار صيانة وتعطَّل العمليات العامة مؤقتًا.
        </Text>
        <TextInput
          value={maintenance.message}
          onChangeText={(t) => setMaintenance((m) => ({ ...m, message: t }))}
          placeholder="رسالة الصيانة الظاهرة للمستخدمين"
          placeholderTextColor={C.subtle}
          style={styles.input}
          multiline
        />
      </View>

      {/* Feature flags */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>مفاتيح الميزات</Text>
        <Text style={styles.cardHint}>شغّل أو أوقف أقسام التطبيق مباشرة دون نشر إصدار جديد.</Text>
        <View style={{ gap: 8, marginTop: 10 }}>
          {FLAGS.map((f) => {
            const enabled = flags[f.key] !== false;
            return (
              <View key={f.key} style={styles.flagRow}>
                <View style={styles.flagLeft}>{f.icon}</View>
                <Text style={styles.flagLabel}>{f.label}</Text>
                <Switch
                  value={enabled}
                  onValueChange={(v) => setFlags((prev) => ({ ...prev, [f.key]: v }))}
                  trackColor={{ true: C.accent, false: C.border }}
                  thumbColor="#fff"
                />
              </View>
            );
          })}
        </View>
      </View>

      <Pressable style={styles.saveBtn} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator size="small" color="#fff" /> : <Save size={16} color="#fff" />}
        <Text style={styles.saveText}>حفظ إعدادات المنصة</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 14, gap: 12, paddingBottom: 40 },
  center: { paddingVertical: 60, alignItems: 'center' },
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    gap: 6,
  },
  cardHead: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  cardTitleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  cardTitle: { fontSize: 14, fontWeight: '900', color: C.ink, textAlign: 'right' },
  cardHint: { fontSize: 11, color: C.muted, textAlign: 'right', lineHeight: 17 },
  input: {
    backgroundColor: C.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12.5,
    color: C.ink,
    textAlign: 'right',
    marginTop: 6,
    minHeight: 54,
  },
  flagRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.bg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  flagLeft: { width: 30, height: 30, borderRadius: 10, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  flagLabel: { flex: 1, fontSize: 12.5, fontWeight: '800', color: C.ink, textAlign: 'right' },
  saveBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.accent,
    borderRadius: 14,
    paddingVertical: 14,
  },
  saveText: { color: '#fff', fontSize: 13.5, fontWeight: '900' },
  noticeCard: {
    backgroundColor: C.warningLight,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    gap: 8,
  },
  noticeTitle: { fontSize: 14, fontWeight: '900', color: '#92400E', textAlign: 'center' },
  noticeText: { fontSize: 12, color: '#92400E', textAlign: 'center', lineHeight: 20 },
  code: { fontWeight: '900', color: '#7C2D12' },
});
