import { OasisPressable as Pressable, OasisTextInput as TextInput, OasisSurface } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Switch } from 'react-native';
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
  Trash2,
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
  { key: 'search', label: 'البحث الشامل', icon: <Store size={16} color={C.info} /> },
  { key: 'directory', label: 'دليل الأنشطة والمتاجر', icon: <Store size={16} color={C.accent} /> },
  { key: 'requests', label: 'طلبات الفزعة والمساعدة', icon: <AlertTriangle size={16} color={C.warning} /> },
  { key: 'questions', label: 'أسئلة واستفسارات الحي', icon: <Images size={16} color={C.purple} /> },
  { key: 'live', label: 'البثوث المباشرة', icon: <Power size={16} color={C.danger} /> },
  { key: 'map', label: 'خريطة الحي', icon: <Store size={16} color={C.info} /> },
];

export function AdminFeatureFlags({ onSaved }: { onSaved: (msg: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [maintenance, setMaintenance] = useState({ enabled: false, message: '' });
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [branding, setBranding] = useState<{ name: string; description: string; headers: Record<string, string> }>({ name: '', description: '', headers: {} });

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
          setBranding({ name: '', description: '', headers: {}, ...(map.site_branding || {}) });
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
          { key: 'site_branding', value: branding, updated_by: auth.user?.id || null, updated_at: now },
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
        <OasisSurface oasisSurface="card" style={styles.noticeCard}>
          <DatabaseZap size={26} color={C.warning} />
          <Text style={styles.noticeTitle}>جداول الحوكمة غير مفعّلة بعد</Text>
          <Text style={styles.noticeText}>
            لتشغيل مفاتيح الميزات ووضع الصيانة، نفّذ ملف الترحيل
            {' '}
            <Text style={styles.code}>supabase/migrations/202610120001_platform_governance.sql</Text>
            {' '}في محرّر SQL بمشروع Supabase ثم أعد فتح اللوحة.
          </Text>
        </OasisSurface>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {/* Maintenance */}
      <OasisSurface oasisSurface="card" style={styles.card}>
        <View style={styles.cardHead}>
          <View style={styles.cardTitleRow}>
            <Power size={16} color={maintenance.enabled ? C.danger : C.accent} />
            <Text style={styles.cardTitle}>وضع الصيانة العام</Text>
          </View>
          <Switch
            value={maintenance.enabled}
            onValueChange={(v) => setMaintenance((m) => ({ ...m, enabled: v }))}
            trackColor={{ true: C.danger, false: C.border }}
            thumbColor={OASIS.colors.surface}
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
      </OasisSurface>

      {/* Feature flags */}
      <OasisSurface oasisSurface="card" style={styles.card}>
        <Text style={styles.cardTitle}>هوية المنصة والعناوين</Text>
        <Text style={styles.cardHint}>تظهر التغييرات للمستخدمين عند تحديث التطبيق.</Text>
        <TextInput value={branding.name} onChangeText={name => setBranding(b => ({ ...b, name }))} placeholder="اسم الموقع" placeholderTextColor={C.subtle} style={styles.input} />
        <TextInput value={branding.description} onChangeText={description => setBranding(b => ({ ...b, description }))} placeholder="وصف المنصة" placeholderTextColor={C.subtle} style={styles.input} multiline />
        {([['home', 'عنوان الرئيسية'], ['market', 'عنوان السوق'], ['search', 'عنوان البحث'], ['more', 'عنوان المزيد'], ['stories', 'عنوان اليوميات']] as const).map(([key, label]) => <TextInput key={key} value={branding.headers[key] || ''} onChangeText={value => setBranding(b => ({ ...b, headers: { ...b.headers, [key]: value } }))} placeholder={label} placeholderTextColor={C.subtle} style={styles.input} />)}
      </OasisSurface>

      {/* Feature flags */}
      <OasisSurface oasisSurface="card" style={styles.card}>
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
                  thumbColor={OASIS.colors.surface}
                />
              </View>
            );
          })}
        </View>
      </OasisSurface>

      {/* Test Data Purge Section */}
      <OasisSurface oasisSurface="card" style={[styles.card, { borderColor: '#fca5a5', backgroundColor: '#fff5f5' }]}>
        <View style={styles.cardHead}>
          <View style={styles.cardTitleRow}>
            <Trash2 size={16} color={C.danger} />
            <Text style={[styles.cardTitle, { color: C.danger }]}>تنظيف البيانات والحسابات التجريبية</Text>
          </View>
        </View>
        <Text style={[styles.cardHint, { color: '#991b1b' }]}>
          حذف كافة الحسابات الوهمية (80 حساباً تجريبياً)، وكافة الخدمات والطلبات والأسئلة التجريبية، ومنع النظام من إرسال أي مقترحات أو عروض تجريبية نهائياً.
        </Text>
        <Pressable oasisVariant="primary" oasisKind="action"
          style={[styles.saveBtn, { backgroundColor: C.danger, marginTop: 8 }]}
          onPress={async () => {
            try {
              const { data, error } = await supabase.rpc('admin_purge_test_data');
              if (error) {
                onSaved('يرجى تنفيذ ملف الترحيل 202610120002_purge_all_test_and_mock_data.sql أولاً في محرّر Supabase.');
              } else {
                onSaved(`تم تنظيف النظام بنجاح! تم حذف ${data?.deleted_profiles || 0} حساباً و${data?.deleted_services || 0} خدمة تجريبية.`);
              }
            } catch (err: any) {
              onSaved('حدث خطأ: ' + err.message);
            }
          }}
        >
          <Trash2 size={16} color={OASIS.colors.surface} />
          <Text style={styles.saveText}>تنظيف كافة البيانات التجريبية الآن</Text>
        </Pressable>
      </OasisSurface>

      <Pressable oasisVariant="primary" oasisKind="action" style={styles.saveBtn} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator size="small" color={OASIS.colors.surface} /> : <Save size={16} color={OASIS.colors.surface} />}
        <Text style={styles.saveText}>حفظ إعدادات المنصة</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 14, gap: 12, paddingBottom: 24 },
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
  cardTitle: { fontSize: 14, fontWeight: '700', color: C.ink, textAlign: 'right' },
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
    minHeight: 44,
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
  flagLabel: { flex: 1, fontSize: 12.5, fontWeight: '600', color: C.ink, textAlign: 'right' },
  saveBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.accent,
    borderRadius: 14,
    paddingVertical: 14,
  },
  saveText: { color: OASIS.colors.surface, fontSize: 13.5, fontWeight: '700' },
  noticeCard: {
    backgroundColor: C.warningLight,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    gap: 8,
  },
  noticeTitle: { fontSize: 14, fontWeight: '700', color: '#92400E', textAlign: 'center' },
  noticeText: { fontSize: 12, color: '#92400E', textAlign: 'center', lineHeight: 20 },
  code: { fontWeight: '700', color: '#7C2D12' },
});
