import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { ShieldCheck, UserMinus, X } from 'lucide-react-native';
import type { LiveModerationSettings, LiveModerator } from '@/hooks/useLiveModeration';

type Props = {
  visible: boolean;
  onClose: () => void;
  settings: LiveModerationSettings;
  moderators: LiveModerator[];
  loading: boolean;
  error: string;
  onRefresh: () => Promise<void>;
  onSaveSettings: (settings: LiveModerationSettings) => Promise<void>;
  onManageModerator: (username: string, action: 'add' | 'remove', permissions?: {
    can_hide_comments: boolean; can_timeout_users: boolean; can_manage_filters: boolean;
  }) => Promise<void>;
};
const slowModes = [0, 3, 5, 10, 15, 30, 60];

export default function LiveModerationPanel(props: Props) {
  const { visible, onClose, settings, moderators, loading, error, onRefresh, onSaveSettings, onManageModerator } = props;
  const [draft, setDraft] = useState(settings);
  const [termsText, setTermsText] = useState(settings.blocked_terms.join(', '));
  const [username, setUsername] = useState('');
  const [canHide, setCanHide] = useState(true);
  const [canTimeout, setCanTimeout] = useState(false);
  const [canFilters, setCanFilters] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(settings);
    setTermsText(settings.blocked_terms.join(', '));
  }, [settings]);

  async function save() {
    setSaving(true);
    try {
      const blocked_terms = [...new Set(termsText.split(/[،,\n]/).map((term) => term.trim()).filter(Boolean))].slice(0, 100);
      const next = { ...draft, blocked_terms };
      await onSaveSettings(next);
      Alert.alert('تم الحفظ', 'طُبّقت إعدادات الإشراف على التعليقات الجديدة.');
    } catch (cause) {
      Alert.alert('تعذر الحفظ', cause instanceof Error ? cause.message : 'حاول مرة أخرى.');
    } finally { setSaving(false); }
  }

  async function addModerator() {
    const value = username.trim().replace(/^@/, '');
    if (!value) return;
    try {
      await onManageModerator(value, 'add', { can_hide_comments: canHide, can_timeout_users: canTimeout, can_manage_filters: canFilters });
      setUsername('');
      Alert.alert('تم تحديث المشرفين', `تم حفظ صلاحيات @${value}.`);
    } catch (cause) {
      Alert.alert('تعذر تعيين المشرف', cause instanceof Error ? cause.message : 'تحقق من اسم المستخدم.');
    }
  }

  function removeModerator(moderator: LiveModerator) {
    Alert.alert('إزالة المشرف؟', `سيُلغى إشراف @${moderator.username} عن هذا البث.`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'إزالة', style: 'destructive', onPress: () => {
        void onManageModerator(moderator.username, 'remove').catch((cause) => Alert.alert('تعذر إزالة المشرف', cause instanceof Error ? cause.message : 'حاول مرة أخرى.'));
      } },
    ]);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.header}>
            <View style={styles.titleWrap}><ShieldCheck color="#6ee7b7" size={21} /><Text style={styles.title}>إشراف التعليقات</Text></View>
            <Pressable onPress={onClose} style={styles.close}><X color="#fff" size={19} /></Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            {loading && <ActivityIndicator color="#34d399" />}
            {!!error && <Text style={styles.error}>{error}</Text>}
            <Text style={styles.sectionTitle}>المشرفون والصلاحيات</Text>
            <Text style={styles.hint}>أدخل اسم المستخدم دون الحاجة إلى معرفة المعرّف الداخلي.</Text>
            <TextInput value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="@username" placeholderTextColor="#94a3b8" style={styles.input} />
            <View style={styles.permissionRow}><Text style={styles.label}>إخفاء التعليقات</Text><Switch value={canHide} onValueChange={setCanHide} /></View>
            <View style={styles.permissionRow}><Text style={styles.label}>حظر مؤقت للمستخدمين</Text><Switch value={canTimeout} onValueChange={setCanTimeout} /></View>
            <View style={styles.permissionRow}><Text style={styles.label}>إدارة الفلاتر والإبطاء</Text><Switch value={canFilters} onValueChange={setCanFilters} /></View>
            <Pressable onPress={() => void addModerator()} disabled={!username.trim() || (!canHide && !canTimeout && !canFilters)} style={[styles.primaryButton, (!username.trim() || (!canHide && !canTimeout && !canFilters)) && styles.disabled]}>
              <Text style={styles.primaryText}>تعيين / تحديث المشرف</Text>
            </Pressable>
            {moderators.map((moderator) => (
              <View key={moderator.user_id} style={styles.moderatorRow}>
                <View style={styles.moderatorInfo}>
                  <Text style={styles.label}>{moderator.display_name || moderator.username}</Text>
                  <Text style={styles.hint}>@{moderator.username} · {[
                    moderator.can_hide_comments && 'إخفاء',
                    moderator.can_timeout_users && 'حظر مؤقت',
                    moderator.can_manage_filters && 'فلاتر',
                  ].filter(Boolean).join('، ')}</Text>
                </View>
                <Pressable onPress={() => removeModerator(moderator)} style={styles.removeButton}><UserMinus color="#fecaca" size={17} /></Pressable>
              </View>
            ))}
            {!moderators.length && <Text style={styles.hint}>لم يُعيّن مشرفون لهذا البث.</Text>}

            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>حماية التعليقات</Text>
            <Text style={styles.label}>وضع الإبطاء</Text>
            <Text style={styles.hint}>الحد الأدنى بين تعليقات الشخص الواحد.</Text>
            <View style={styles.chips}>
              {slowModes.map((seconds) => <Pressable key={seconds} onPress={() => setDraft((current) => ({ ...current, slow_mode_seconds: seconds }))} style={[styles.chip, draft.slow_mode_seconds === seconds && styles.chipActive]}><Text style={[styles.chipText, draft.slow_mode_seconds === seconds && styles.chipTextActive]}>{seconds === 0 ? 'إيقاف' : `${seconds}ث`}</Text></Pressable>)}
            </View>
            <View style={styles.permissionRow}><View style={styles.settingCopy}><Text style={styles.label}>حظر الروابط</Text><Text style={styles.hint}>يُرفض التعليق الذي يحتوي على روابط شائعة.</Text></View><Switch value={draft.block_links} onValueChange={(value) => setDraft((current) => ({ ...current, block_links: value }))} /></View>
            <Text style={styles.label}>الكلمات أو العبارات المحظورة</Text>
            <TextInput value={termsText} onChangeText={setTermsText} multiline placeholder="افصل بين الكلمات بفاصلة" placeholderTextColor="#94a3b8" style={[styles.input, styles.termsInput]} />
            <View style={styles.permissionRow}><View style={styles.settingCopy}><Text style={styles.label}>التقييد التلقائي عند الضغط</Text><Text style={styles.hint}>يزيد الإبطاء تلقائيًا عند ارتفاع التعليقات أو عدد المشاهدين.</Text></View><Switch value={draft.adaptive_enabled} onValueChange={(value) => setDraft((current) => ({ ...current, adaptive_enabled: value }))} /></View>
            <Pressable onPress={() => void save()} disabled={saving} style={[styles.primaryButton, saving && styles.disabled]}>
              {saving ? <ActivityIndicator color="#052e24" /> : <Text style={styles.primaryText}>حفظ إعدادات الإشراف</Text>}
            </Pressable>
            <Pressable onPress={() => void onRefresh()} style={styles.refreshButton}><Text style={styles.refreshText}>تحديث قائمة المشرفين</Text></Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(2,6,23,0.75)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '88%', backgroundColor: '#0f172a', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', paddingBottom: 22 },
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  titleWrap: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9 },
  title: { color: '#fff', fontSize: 17, fontWeight: '900' },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center' },
  content: { padding: 18, gap: 10 },
  sectionTitle: { color: '#a7f3d0', fontSize: 14, fontWeight: '900', textAlign: 'right', marginTop: 6 },
  label: { color: '#f8fafc', fontSize: 13, fontWeight: '800', textAlign: 'right' },
  hint: { color: '#94a3b8', fontSize: 11, textAlign: 'right', lineHeight: 17 },
  input: { color: '#fff', backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, textAlign: 'right' },
  termsInput: { minHeight: 76, textAlignVertical: 'top' },
  permissionRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 7 },
  settingCopy: { flex: 1, gap: 3 },
  primaryButton: { backgroundColor: '#6ee7b7', borderRadius: 12, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryText: { color: '#052e24', fontWeight: '900', fontSize: 13 },
  disabled: { opacity: 0.45 },
  moderatorRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  moderatorInfo: { flex: 1, gap: 4 },
  removeButton: { padding: 10, borderRadius: 10, backgroundColor: 'rgba(190,18,60,0.2)' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginVertical: 12 },
  chips: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 7, marginVertical: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#475569', backgroundColor: '#1e293b' },
  chipActive: { backgroundColor: '#6ee7b7', borderColor: '#6ee7b7' },
  chipText: { color: '#cbd5e1', fontSize: 12, fontWeight: '800' },
  chipTextActive: { color: '#052e24' },
  error: { color: '#fda4af', textAlign: 'right' },
  refreshButton: { padding: 10, alignItems: 'center' },
  refreshText: { color: '#a7f3d0', fontWeight: '800' },
});
