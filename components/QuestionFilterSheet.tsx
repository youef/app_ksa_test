import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
        <View style={s.heading}><SlidersHorizontal size={20} color="#176b52" /><Text style={s.title}>تصفية المنشورات</Text><Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="إغلاق" style={s.close}><X size={20} color="#64748b" /></Pressable></View>
        <ScrollView showsVerticalScrollIndicator={false}>
          {sections.map(section => <View key={section.key} style={{ marginBottom: 20 }}><Text style={s.label}>{section.title}</Text><View style={s.options}>{section.options.map(option => {
            const selected = value[section.key] === option;
            return <Pressable key={option} onPress={() => onChange({ ...value, [section.key]: option })} accessibilityRole="button" accessibilityState={{ selected }} style={[s.option, selected && s.selected]}>{selected && <Check size={14} color="#fff" />}<Text style={[s.optionText, selected && { color: '#fff' }]}>{option}</Text></Pressable>;
          })}</View></View>)}
        </ScrollView>
        <View style={s.options}><Pressable onPress={onReset} accessibilityRole="button" style={[s.action, { backgroundColor: '#edf1ee' }]}><Text style={s.optionText}>مسح الكل</Text></Pressable><Pressable onPress={onApply} accessibilityRole="button" style={[s.action, s.selected]}><Text style={[s.optionText, { color: '#fff' }]}>عرض النتائج</Text></Pressable></View>
      </View>
    </View>
  </Modal>;
}
const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.38)', justifyContent: 'flex-end' },
  panel: { maxHeight: '85%', width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, paddingBottom: 28, borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: '#f8fbf9' },
  heading: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: 20 },
  title: { flex: 1, textAlign: 'right', color: '#173c2c', fontSize: 18, fontWeight: '800' },
  close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  label: { textAlign: 'right', color: '#334155', fontSize: 13, fontWeight: '800', marginBottom: 10 },
  options: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  option: { minHeight: 44, paddingHorizontal: 12, borderRadius: 14, flexDirection: 'row-reverse', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dbe5df' },
  selected: { backgroundColor: '#176b52', borderColor: '#176b52' },
  optionText: { color: '#475569', fontSize: 12, fontWeight: '700' },
  action: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 15 },
});
