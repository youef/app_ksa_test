import { OasisPressable as Pressable } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check, SlidersHorizontal, X } from 'lucide-react-native';
import { type QuestionFilters } from '@/lib/questionFilters';
type Props = { visible: boolean; value: QuestionFilters; isMember: boolean; onChange: (value: QuestionFilters) => void; onClose: () => void; onApply: () => void; onReset: () => void };
export default function QuestionFilterSheet({ visible, value, isMember, onChange, onClose, onApply, onReset }: Props) {
  const sections: { key: keyof QuestionFilters; title: string; options: string[] }[] = [
    { key: 'kind', title: 'نوع المنشور', options: ['الكل','استفسارات','إعارة أدوات','تبرعات','خدمات الحي','الطوارئ'] },
    { key: 'status', title: 'حالة المنشور', options: ['الكل','بانتظار المساعدة','تم الرد','مكتمل'] },
    { key: 'period', title: 'تاريخ النشر', options: ['كل الأوقات','اليوم','هذا الأسبوع','هذا الشهر'] },
    ...(isMember ? [{ key: 'author' as const, title: 'الناشر', options: ['الجميع','منشوراتي'] }] : []),
  ];
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={s.backdrop}>
      <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityRole="button" accessibilityLabel="إغلاق التصفية" />
      <View style={s.panel}>
        <View style={s.heading}><SlidersHorizontal size={20} color={OASIS.colors.primary} /><Text style={s.title}>تصفية المنشورات</Text><Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="إغلاق" style={s.close}><X size={20} color={OASIS.colors.muted} /></Pressable></View>
        <ScrollView showsVerticalScrollIndicator={false}>
          {sections.map(section => <View key={section.key} style={{ marginBottom: 14 }}><Text style={s.label}>{section.title}</Text><View style={s.options}>{section.options.map(option => {
            const selected = value[section.key] === option;
            return <Pressable key={option} onPress={() => onChange({ ...value, [section.key]: option })} accessibilityRole="button" accessibilityState={{ selected }} style={[s.option, selected && s.selected]}>{selected && <Check size={14} color={OASIS.colors.surface} />}<Text style={[s.optionText, selected && { color: OASIS.colors.surface }]}>{option}</Text></Pressable>;
          })}</View></View>)}
        </ScrollView>
        <View style={s.options}><Pressable onPress={onReset} accessibilityRole="button" style={[s.action, { backgroundColor: '#F1F5F3' }]}><Text style={s.optionText}>مسح الكل</Text></Pressable><Pressable onPress={onApply} accessibilityRole="button" style={[s.action, s.selected]}><Text style={[s.optionText, { color: OASIS.colors.surface }]}>عرض النتائج</Text></Pressable></View>
      </View>
    </View>
  </Modal>;
}
const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.38)', justifyContent: 'flex-end' },
  panel: { maxHeight: '85%', width: '100%', maxWidth: 760, alignSelf: 'center', padding: 14, paddingBottom: 16, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: OASIS.colors.surface },
  heading: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: 14 },
  title: { flex: 1, textAlign: 'right', color: '#173c2c', fontSize: 18, fontWeight: '600' },
  close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  label: { textAlign: 'right', color: OASIS.colors.ink, fontSize: 13, fontWeight: '600', marginBottom: 10 },
  options: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  option: { minHeight: 44, paddingHorizontal: 12, borderRadius: 14, flexDirection: 'row-reverse', alignItems: 'center', gap: 6, backgroundColor: OASIS.colors.surface, borderWidth: 1, borderColor: OASIS.colors.line },
  selected: { backgroundColor: OASIS.colors.primary, borderColor: OASIS.colors.primary },
  optionText: { color: OASIS.colors.muted, fontSize: 12, fontWeight: '700' },
  action: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 15 },
});
