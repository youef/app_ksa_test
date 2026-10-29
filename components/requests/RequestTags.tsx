import { useState } from 'react';
import { Text, View } from 'react-native';
import { Plus, X } from 'lucide-react-native';
import { OasisPressable as Pressable, OasisTextInput as TextInput } from '@/components/oasis/OasisPrimitives';
import { useTheme } from '@/context/ThemeContext';
import { MAX_REQUEST_TAGS, normalizeRequestTag, normalizeRequestTags, suggestRequestTags } from '@/lib/requestTags';

export function RequestTags({ tags, onPress }: { tags: string[]; onPress?: (tag: string) => void }) {
  const { colors: c } = useTheme();
  return <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 }}>{normalizeRequestTags(tags).map(tag => <Pressable oasisKind="plain" key={tag} onPress={onPress ? () => onPress(tag) : undefined} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={`وسم ${tag}`} style={{ paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12, backgroundColor: c.soft }}><Text style={{ color: c.primary, fontSize: 11, fontWeight: '600' }}>#{tag.replace(/ /g, '_')}</Text></Pressable>)}</View>;
}

export function RequestTagEditor({ value, onChange, text = '', disabled = false }: { value: string[]; onChange: (tags: string[]) => void; text?: string; disabled?: boolean }) {
  const { colors: c } = useTheme();
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const add = (tag: string) => {
    const normalized = normalizeRequestTag(tag);
    if (!normalizeRequestTags([normalized]).length) { setError('اكتب وسمًا من حرفين إلى ٣٠ حرفًا بدون روابط أو رموز.'); return; }
    if (value.length >= MAX_REQUEST_TAGS) { setError('الحد الأقصى خمسة وسوم.'); return; }
    onChange(normalizeRequestTags([...value, normalized])); setInput(''); setError('');
  };
  return <View style={{ gap: 9 }}>
    <Text style={{ color: c.ink, textAlign: 'right', fontWeight: '700', fontSize: 13 }}>وسوم الفزعة <Text style={{ color: c.muted, fontWeight: '400' }}>اختياري · {value.length}/٥</Text></Text>
    <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 }}>{value.map(tag => <Pressable oasisKind="plain" key={tag} accessibilityRole="button" accessibilityLabel={`إزالة الوسم ${tag}`} disabled={disabled} onPress={() => onChange(value.filter(item => item !== tag))} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, backgroundColor: c.soft, borderRadius: 14, padding: 8 }}><Text style={{ color: c.primary, fontSize: 12 }}>#{tag}</Text><X size={13} color={c.primary} /></Pressable>)}</View>
    {value.length < MAX_REQUEST_TAGS ? <><View style={{ flexDirection: 'row-reverse', gap: 7 }}><TextInput accessibilityLabel="وسم جديد للفزعة" value={input} onChangeText={setInput} onSubmitEditing={() => add(input)} editable={!disabled} maxLength={30} placeholder="مثل: نقل أغراض" style={{ flex: 1, textAlign: 'right', color: c.ink, minHeight: 42, borderWidth: 1, borderColor: c.line, borderRadius: 12, paddingHorizontal: 12, backgroundColor: c.background }} /><Pressable oasisKind="plain" accessibilityRole="button" accessibilityLabel="إضافة الوسم" disabled={disabled || !input.trim()} onPress={() => add(input)} style={{ width: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: c.soft, borderRadius: 12 }}><Plus size={18} color={c.primary} /></Pressable></View><View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 }}>{suggestRequestTags(text).filter(tag => !value.includes(tag)).slice(0, 4).map(tag => <Pressable oasisKind="plain" accessibilityRole="button" accessibilityLabel={`اقتراح الوسم ${tag}`} disabled={disabled} key={tag} onPress={() => add(tag)} style={{ padding: 7, borderColor: c.line, borderWidth: 1, borderRadius: 12 }}><Text style={{ fontSize: 11, color: c.muted }}>+ {tag}</Text></Pressable>)}</View></> : null}
    {error ? <Text accessibilityRole="alert" style={{ color: c.danger, textAlign: 'right', fontSize: 12 }}>{error}</Text> : null}
  </View>;
}
