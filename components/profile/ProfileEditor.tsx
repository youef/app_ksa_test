import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Camera, Check, Save, X } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { type ProfileDraft, validateProfileDraft } from '@/lib/profileEditor';

type Props = {
  draft: ProfileDraft;
  onChange: (patch: Partial<ProfileDraft>) => void;
  saving: boolean;
  dirty: boolean;
  avatarBusy: boolean;
  coverBusy: boolean;
  onSave: () => void;
  onCancel: () => void;
  onAvatar: () => void;
  onCover: () => void;
};

export function ProfileEditor(props: Props) {
  const { colors } = useTheme();
  const errors = validateProfileDraft(props.draft);
  const valid = !Object.keys(errors).length;
  const fields: { key: keyof ProfileDraft; label: string; max: number; hint: string }[] = [
    { key: 'displayName', label: 'الاسم الظاهر', max: 50, hint: 'الاسم الذي يظهر للجيران في ملفك ومشاركاتك.' },
    { key: 'username', label: 'اسم المستخدم', max: 30, hint: 'يبدأ رابط ملفك بهذا الاسم. يخضع تغييره للمدة المسموحة للحساب.' },
    { key: 'bio', label: 'النبذة', max: 160, hint: 'اهتماماتك، خبراتك، أو كلمة تحب أن يعرفها أهل الحي عنك.' },
  ];
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
    <View style={styles.header}><View style={{ flex: 1, alignItems: 'flex-end', gap: 5 }}><Text style={[styles.title, { color: colors.ink }]}>تعديل الملف الشخصي</Text><Text style={{ color: colors.muted, fontSize: 12 }}>تظهر معاينة بياناتك في أعلى الصفحة أثناء الكتابة</Text></View><Pressable accessibilityRole="button" accessibilityLabel="إلغاء تعديل الملف" onPress={props.onCancel} disabled={props.saving} style={styles.icon}><X size={22} color={colors.ink} /></Pressable></View>
    <View style={styles.mediaActions}>{[{ label: 'الصورة الشخصية', action: props.onAvatar, busy: props.avatarBusy }, { label: 'صورة الغلاف', action: props.onCover, busy: props.coverBusy }].map(item => <Pressable key={item.label} accessibilityRole="button" onPress={item.action} disabled={item.busy || props.saving} style={[styles.mediaButton, { backgroundColor: colors.soft, borderColor: colors.line }]}>{item.busy ? <ActivityIndicator color={colors.primary} /> : <Camera size={18} color={colors.primary} />}<Text style={{ color: colors.primary, fontWeight: '700' }}>{item.label}</Text></Pressable>)}</View>
    <Text style={{ color: colors.muted, fontSize: 11, textAlign: 'right' }}>تُحفظ تغييرات الصور مباشرة. بيانات الملف تُحفظ عند الضغط على «حفظ التغييرات».</Text>
    {fields.map(field => <View key={field.key} style={{ gap: 7 }}>
      <View style={styles.header}><Text style={{ color: colors.ink, fontWeight: '700' }}>{field.label}</Text><Text style={{ color: colors.muted, fontSize: 11 }}>{[...props.draft[field.key]].length}/{field.max}</Text></View>
      <TextInput accessibilityLabel={field.label} editable={!props.saving} value={props.draft[field.key]} onChangeText={value => props.onChange({ [field.key]: value })} maxLength={field.max} multiline={field.key === 'bio'} autoCapitalize={field.key === 'username' ? 'none' : 'sentences'} autoCorrect={field.key !== 'username'} placeholderTextColor={colors.muted} placeholder={field.key === 'username' ? 'username' : field.label} style={[styles.input, { color: colors.ink, backgroundColor: colors.background, borderColor: errors[field.key] ? colors.danger : colors.line, textAlign: field.key === 'username' ? 'left' : 'right' }, field.key === 'bio' && { minHeight: 110, textAlignVertical: 'top' }]} />
      <Text accessibilityRole={errors[field.key] ? 'alert' : undefined} style={{ color: errors[field.key] ? colors.danger : colors.muted, fontSize: 11, lineHeight: 18, textAlign: 'right' }}>{errors[field.key] || field.hint}</Text>
    </View>)}
    <View style={[styles.footer, { borderColor: colors.line }]}><View style={styles.header}><Check size={15} color={props.dirty ? colors.warning : colors.primary} /><Text style={{ color: props.dirty ? colors.warning : colors.muted, fontSize: 12 }}>{props.dirty ? 'لديك تغييرات غير محفوظة' : 'البيانات مطابقة لملفك المحفوظ'}</Text></View><View style={styles.mediaActions}><Pressable accessibilityRole="button" onPress={props.onSave} disabled={!valid || !props.dirty || props.saving} style={[styles.save, { backgroundColor: !valid || !props.dirty || props.saving ? colors.line : colors.primary }]}>{props.saving ? <ActivityIndicator color={colors.surface} /> : <Save size={17} color={colors.surface} />}<Text style={{ color: colors.surface, fontWeight: '700' }}>{props.saving ? 'جارٍ الحفظ…' : 'حفظ التغييرات'}</Text></Pressable><Pressable accessibilityRole="button" onPress={props.onCancel} disabled={props.saving} style={styles.cancel}><Text style={{ color: colors.muted, fontWeight: '700' }}>إلغاء</Text></Pressable></View></View>
  </View>;
}
const styles = StyleSheet.create({ card: { borderWidth: 1, borderRadius: 20, padding: 22, gap: 20 }, header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, title: { fontSize: 21, fontWeight: '800' }, icon: { padding: 8 }, input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15, minHeight: 50 }, mediaActions: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 }, mediaButton: { flex: 1, minWidth: 120, padding: 14, borderWidth: 1, borderRadius: 14, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8 }, footer: { borderTopWidth: 1, paddingTop: 18, gap: 14 }, save: { minHeight: 44, borderRadius: 999, paddingHorizontal: 20, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8 }, cancel: { minHeight: 44, paddingHorizontal: 18, justifyContent: 'center' } });
