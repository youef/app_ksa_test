import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Check, ChevronDown, MapPin, Pencil, Plus, Search, Trash2, X } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { buildSaudiLocations, CustomLocation, LocationOverride, Region } from '@/lib/saudiLocations';

type Level = 'region' | 'city' | 'district';
type Option = { id: string; name: string; detail?: string };

export default function AdminLocationManager({ profileId, notify, audit }: { profileId?: string; notify: (message: string) => void; audit: (action: string, name: string, id?: string) => Promise<void> }) {
  const [customLocations, setCustomLocations] = useState<CustomLocation[]>([]);
  const [overrides, setOverrides] = useState<LocationOverride[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState('');
  const [selectedCityId, setSelectedCityId] = useState('');
  const [level, setLevel] = useState<Level>('region');
  const [name, setName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string; path: string[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [visibleCount, setVisibleCount] = useState(100);

  const locations = useMemo(() => buildSaudiLocations(customLocations, overrides), [customLocations, overrides]);
  const selectedRegion = locations.find(region => region.id === selectedRegionId) || null;
  const selectedCity = selectedRegion?.cities.find(city => city.id === selectedCityId) || null;

  const reload = async () => {
    const [customResult, overrideResult] = await Promise.all([
      supabase.from('saudi_custom_locations').select('id,region_name,city_name,district_name,latitude,longitude').order('created_at', { ascending: false }),
      supabase.from('saudi_location_overrides').select('source_id,new_name,is_deleted'),
    ]);
    if (customResult.error || overrideResult.error) { notify('تعذر تحميل دليل المواقع'); setLoading(false); return; }
    setCustomLocations((customResult.data || []) as CustomLocation[]);
    setOverrides((overrideResult.data || []) as LocationOverride[]);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);
  useEffect(() => { setVisibleCount(100); }, [selectedRegionId, selectedCityId]);

  const saveNew = async () => {
    const value = name.trim();
    if (!value || (level !== 'region' && !selectedRegion) || (level === 'district' && !selectedCity)) {
      notify('اختر المنطقة والمدينة من القوائم وأدخل الاسم'); return;
    }
    const lat = latitude.trim() ? Number(latitude) : null;
    const lng = longitude.trim() ? Number(longitude) : null;
    if ((lat === null) !== (lng === null) || (lat !== null && (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 16 || lat > 32.5 || lng! < 34.5 || lng! > 56))) {
      notify('أدخل إحداثيات سعودية صحيحة أو اترك الخانتين فارغتين'); return;
    }
    setSaving(true);
    const { error } = await supabase.from('saudi_custom_locations').insert({
      region_name: level === 'region' ? value : selectedRegion!.name,
      city_name: level === 'city' ? value : level === 'district' ? selectedCity!.name : null,
      district_name: level === 'district' ? value : null,
      latitude: lat, longitude: lng, created_by: profileId,
    });
    setSaving(false);
    if (error) { notify(error.code === '23505' ? 'الموقع موجود مسبقاً' : 'تعذرت إضافة الموقع'); return; }
    setName(''); setLatitude(''); setLongitude('');
    notify('تمت إضافة الموقع'); await reload(); await audit('إضافة موقع جغرافي', value);
  };

  const saveEdit = async () => {
    if (!editing || !name.trim()) return;
    const value = name.trim();
    setSaving(true);
    const customId = editing.id.match(/^custom-(?:region|city|district)-(.+)$/)?.[1];
    let error: any = null;
    if (customId) {
      const item = customLocations.find(location => location.id === customId);
      if (!item) error = new Error('الموقع غير موجود');
      else if (!item.city_name) {
        const result = await supabase.from('saudi_custom_locations').update({ region_name: value }).eq('region_name', item.region_name);
        error = result.error;
      } else if (!item.district_name) {
        const result = await supabase.from('saudi_custom_locations').update({ city_name: value }).eq('region_name', item.region_name).eq('city_name', item.city_name);
        error = result.error;
      } else {
        const result = await supabase.from('saudi_custom_locations').update({ district_name: value }).eq('id', customId);
        error = result.error;
      }
    } else {
      let moveError: any = null;
      if (editing.path.length === 1) {
        const moved = await supabase.from('saudi_custom_locations').update({ region_name: value }).eq('region_name', editing.path[0]);
        moveError = moved.error;
      } else if (editing.path.length === 2) {
        const moved = await supabase.from('saudi_custom_locations').update({ city_name: value }).eq('region_name', editing.path[0]).eq('city_name', editing.path[1]);
        moveError = moved.error;
      } else {
        const moved = await supabase.from('saudi_custom_locations').update({ district_name: value }).eq('region_name', editing.path[0]).eq('city_name', editing.path[1]).eq('district_name', editing.path[2]);
        moveError = moved.error;
      }
      if (moveError) { setSaving(false); notify('تعذر تحديث المواقع الفرعية المرتبطة'); return; }
      const result = await supabase.from('saudi_location_overrides').upsert({ source_id: `location:${editing.id}`, new_name: value, is_deleted: false, updated_by: profileId, updated_at: new Date().toISOString() });
      error = result.error;
    }
    setSaving(false);
    if (error) { notify('تعذر تعديل الموقع، تحقق من عدم تكرار الاسم'); return; }
    setEditing(null); setName(''); notify('تم تعديل الموقع'); await reload(); await audit('تعديل موقع جغرافي', value, editing.id);
  };

  const remove = (item: { id: string; name: string; level: Level }) => {
    const proceed = async () => {
      const customId = item.id.match(/^custom-(?:region|city|district)-(.+)$/)?.[1];
      let error: any = null;
      if (customId) {
        const custom = customLocations.find(location => location.id === customId);
        if (!custom) error = new Error('الموقع غير موجود');
        else if (item.level === 'region') {
          const result = await supabase.from('saudi_custom_locations').delete().eq('region_name', custom.region_name);
          error = result.error;
        } else if (item.level === 'city') {
          const result = await supabase.from('saudi_custom_locations').delete().eq('region_name', custom.region_name).eq('city_name', custom.city_name);
          error = result.error;
        } else {
          const result = await supabase.from('saudi_custom_locations').delete().eq('id', customId);
          error = result.error;
        }
      } else {
        if (item.level === 'region') {
          const removedChildren = await supabase.from('saudi_custom_locations').delete().eq('region_name', item.name);
          if (removedChildren.error) { notify('تعذر حذف المواقع اليدوية تحت المنطقة'); return; }
        } else if (item.level === 'city') {
          const parentRegion = selectedRegion?.name;
          if (parentRegion) {
            const removedChildren = await supabase.from('saudi_custom_locations').delete().eq('region_name', parentRegion).eq('city_name', item.name);
            if (removedChildren.error) { notify('تعذر حذف الأحياء اليدوية تحت المدينة'); return; }
          }
        } else {
          const parentRegion = selectedRegion?.name;
          const parentCity = selectedCity?.name;
          if (parentRegion && parentCity) {
            const removed = await supabase.from('saudi_custom_locations').delete().eq('region_name', parentRegion).eq('city_name', parentCity).eq('district_name', item.name.replace(/^حي\s+/u, ''));
            if (removed.error) { notify('تعذر حذف الحي اليدوي المرتبط'); return; }
          }
        }
        const result = await supabase.from('saudi_location_overrides').upsert({ source_id: `location:${item.id}`, new_name: null, is_deleted: true, updated_by: profileId, updated_at: new Date().toISOString() });
        error = result.error;
      }
      if (error) { notify('تعذر حذف الموقع'); return; }
      if (item.id === selectedRegionId) { setSelectedRegionId(''); setSelectedCityId(''); }
      if (item.id === selectedCityId) setSelectedCityId('');
      notify('تم حذف الموقع'); await reload(); await audit('حذف موقع جغرافي', item.name, item.id);
    };
    const message = `سيتم حذف ${item.name}. إذا كان الموقع منطقة أو مدينة فسيحذف ما أضيف يدوياً تحتها أيضاً.`;
    if (Platform.OS === 'web' && typeof window !== 'undefined') { if (window.confirm(message)) proceed(); }
    else Alert.alert('حذف الموقع', message, [{ text: 'إلغاء', style: 'cancel' }, { text: 'حذف', style: 'destructive', onPress: proceed }]);
  };

  let rows: Array<{ id: string; name: string; level: Level; path: string[] }>;
  let totalRows: number;
  if (selectedCity && selectedRegion) {
    totalRows = selectedCity.districts.length;
    rows = selectedCity.districts.slice(0, visibleCount).map(district => ({ id: district.id, name: district.name, level: 'district', path: [selectedRegion.name, selectedCity.name, district.name] }));
  } else if (selectedRegion) {
    totalRows = selectedRegion.cities.length;
    rows = selectedRegion.cities.slice(0, visibleCount).map(city => ({ id: city.id, name: city.name, level: 'city', path: [selectedRegion.name, city.name] }));
  } else {
    totalRows = locations.length;
    rows = locations.slice(0, visibleCount).map(region => ({ id: region.id, name: region.name, level: 'region', path: [region.name] }));
  }

  return <View style={styles.container}>
    <Text style={styles.title}>دليل المناطق والمدن والأحياء</Text>
    <Text style={styles.description}>اختر منطقة ثم مدينة لاستعراض كل المواقع. التغييرات تحفظ على الدليل للمستخدمين.</Text>
    <Picker label="المنطقة" value={selectedRegion?.name || ''} placeholder="اختر المنطقة" options={locations.map(region => ({ id: region.id, name: region.name, detail: `${region.cities.length.toLocaleString('ar-SA')} مدينة` }))} onSelect={id => { setSelectedRegionId(id); setSelectedCityId(''); }} />
    {selectedRegion && <Picker label="المدينة" value={selectedCity?.name || ''} placeholder="اختر المدينة لعرض أحيائها" options={selectedRegion.cities.map(city => ({ id: city.id, name: city.name, detail: `${city.districts.length.toLocaleString('ar-SA')} حي` }))} onSelect={setSelectedCityId} />}
    <View style={styles.row}>
      <Action label="إضافة منطقة" active={level === 'region'} onPress={() => { setLevel('region'); setEditing(null); setName(''); }} />
      {selectedRegion && <Action label="إضافة مدينة" active={level === 'city'} onPress={() => { setLevel('city'); setEditing(null); setName(''); }} />}
      {selectedCity && <Action label="إضافة حي" active={level === 'district'} onPress={() => { setLevel('district'); setEditing(null); setName(''); }} />}
    </View>
    <View style={styles.editor}>
      <Text style={styles.subtitle}>{editing ? `تعديل: ${editing.path.join(' · ')}` : `إضافة ${level === 'region' ? 'منطقة' : level === 'city' ? `مدينة ضمن ${selectedRegion?.name || ''}` : `حي ضمن ${selectedCity?.name || ''}`}`}</Text>
      <TextInput style={styles.input} placeholder={editing ? 'الاسم الجديد' : level === 'region' ? 'اسم المنطقة الجديدة' : level === 'city' ? 'اسم المدينة أو المحافظة' : 'اسم الحي'} value={name} onChangeText={setName} />
      {!editing && <View style={styles.row}><TextInput style={[styles.input, styles.coordinate]} placeholder="خط العرض (اختياري)" value={latitude} onChangeText={setLatitude} keyboardType="decimal-pad" /><TextInput style={[styles.input, styles.coordinate]} placeholder="خط الطول (اختياري)" value={longitude} onChangeText={setLongitude} keyboardType="decimal-pad" /></View>}
      <View style={styles.row}>
        <Pressable style={[styles.saveButton, saving && styles.disabled]} onPress={editing ? saveEdit : saveNew} disabled={saving}><Check size={16} color="#fff" /><Text style={styles.saveText}>{saving ? 'جارٍ الحفظ…' : editing ? 'حفظ التعديل' : 'إضافة'}</Text></Pressable>
        {editing && <Pressable style={[styles.saveButton, styles.cancel]} onPress={() => { setEditing(null); setName(''); }}><X size={16} color="#fff" /><Text style={styles.saveText}>إلغاء</Text></Pressable>}
      </View>
    </View>
    <Text style={styles.subtitle}>{selectedCity ? `الأحياء (${totalRows.toLocaleString('ar-SA')})` : selectedRegion ? `مدن ومحافظات المنطقة (${totalRows.toLocaleString('ar-SA')})` : `مناطق المملكة (${totalRows})`}</Text>
    {loading ? <Text style={styles.muted}>جارٍ تحميل الدليل…</Text> : <ScrollView style={styles.rows} nestedScrollEnabled>
      {rows.map(item => <View key={`${item.level}:${item.id}`} style={styles.item}>
        <MapPin size={17} color="#059669" />
        <Pressable style={styles.itemText} onPress={() => { if (item.level === 'region') { setSelectedRegionId(item.id); setSelectedCityId(''); } else if (item.level === 'city') setSelectedCityId(item.id); }}><Text style={styles.itemName}>{item.name}</Text><Text style={styles.itemPath}>{item.path.join(' · ')}</Text></Pressable>
        <Pressable accessibilityLabel={`تعديل ${item.name}`} style={styles.iconButton} onPress={() => { setEditing(item); setName(item.name); }}><Pencil size={16} color="#0369A1" /></Pressable>
        <Pressable accessibilityLabel={`حذف ${item.name}`} style={styles.iconButton} onPress={() => remove(item)}><Trash2 size={16} color="#DC2626" /></Pressable>
      </View>)}
      {totalRows > visibleCount && <Pressable style={styles.more} onPress={() => setVisibleCount(count => count + 100)}><Text style={styles.moreText}>عرض ١٠٠ موقع إضافي ({(totalRows - visibleCount).toLocaleString('ar-SA')} متبقٍ)</Text></Pressable>}
    </ScrollView>}
    {selectedCity && <Pressable style={styles.back} onPress={() => setSelectedCityId('')}><Text style={styles.backText}>العودة إلى قائمة المدن</Text></Pressable>}
  </View>;
}

function Action({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.action, active && styles.actionActive]}><Plus size={14} color={active ? '#fff' : '#475569'} /><Text style={[styles.actionText, active && styles.actionTextActive]}>{label}</Text></Pressable>;
}

function Picker({ label, value, placeholder, options, onSelect }: { label: string; value: string; placeholder: string; options: Option[]; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(100);
  const results = options.filter(option => `${option.name} ${option.detail || ''}`.toLocaleLowerCase('ar').includes(search.trim().toLocaleLowerCase('ar')));
  useEffect(() => { setLimit(100); }, [search, options.length]);
  return <View style={styles.pickerWrap}>
    <Text style={styles.label}>{label}</Text>
    <Pressable style={styles.picker} onPress={() => setOpen(true)}><Text style={[styles.pickerValue, !value && styles.placeholder]}>{value || placeholder}</Text><ChevronDown size={17} color="#64748B" /></Pressable>
    <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={styles.backdrop}><View style={styles.modal}>
        <View style={styles.modalHeader}><Text style={styles.modalTitle}>اختر {label}</Text><Pressable onPress={() => setOpen(false)}><X size={22} color="#64748B" /></Pressable></View>
        <View style={styles.search}><Search size={17} color="#64748B" /><TextInput value={search} onChangeText={setSearch} placeholder={`ابحث عن ${label}`} style={styles.searchInput} /></View>
        <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 450 }}>
          {results.slice(0, limit).map(option => <Pressable key={option.id} style={styles.option} onPress={() => { onSelect(option.id); setSearch(''); setOpen(false); }}><View style={styles.optionText}><Text style={styles.itemName}>{option.name}</Text>{!!option.detail && <Text style={styles.itemPath}>{option.detail}</Text>}</View>{value === option.name && <Check size={17} color="#059669" />}</Pressable>)}
          {!results.length && <Text style={styles.muted}>لا توجد نتائج</Text>}
          {results.length > limit && <Pressable style={styles.more} onPress={() => setLimit(count => count + 100)}><Text style={styles.moreText}>عرض المزيد من النتائج</Text></Pressable>}
        </ScrollView>
      </View></View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff', borderRadius: 18, padding: 16, margin: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  title: { color: '#0F172A', fontSize: 18, fontWeight: '900', textAlign: 'right' },
  description: { color: '#64748B', fontSize: 12, lineHeight: 19, textAlign: 'right', marginTop: 5, marginBottom: 12 },
  pickerWrap: { marginBottom: 10 }, label: { textAlign: 'right', fontSize: 12, fontWeight: '800', color: '#64748B', marginBottom: 4 },
  picker: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12 },
  pickerValue: { flex: 1, textAlign: 'right', fontWeight: '800', color: '#0F172A' }, placeholder: { color: '#94A3B8' },
  row: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 7, alignItems: 'center' },
  action: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#F1F5F9' }, actionActive: { backgroundColor: '#059669' },
  actionText: { color: '#475569', fontSize: 11, fontWeight: '800' }, actionTextActive: { color: '#fff' },
  editor: { backgroundColor: '#F0FDFA', borderWidth: 1, borderColor: '#99F6E4', borderRadius: 15, padding: 12, marginVertical: 10 },
  subtitle: { textAlign: 'right', color: '#334155', fontSize: 13, fontWeight: '900', marginVertical: 8 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 11, padding: 10, textAlign: 'right', color: '#0F172A', marginBottom: 7, flex: 1 }, coordinate: { minWidth: '40%' },
  saveButton: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, flex: 1, backgroundColor: '#0F172A', borderRadius: 11, padding: 10 }, cancel: { backgroundColor: '#64748B' }, disabled: { opacity: 0.6 }, saveText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  rows: { maxHeight: 470, marginTop: 4 }, item: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  itemText: { flex: 1, alignItems: 'flex-end' }, itemName: { color: '#0F172A', fontWeight: '800', textAlign: 'right' }, itemPath: { color: '#64748B', fontSize: 10, textAlign: 'right', marginTop: 2 },
  iconButton: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }, more: { backgroundColor: '#ECFDF5', borderRadius: 11, padding: 11, marginVertical: 8 }, moreText: { color: '#047857', fontWeight: '900', textAlign: 'center' },
  back: { marginTop: 8, padding: 8, alignSelf: 'flex-end' }, backText: { color: '#059669', fontWeight: '800', textAlign: 'right' }, muted: { textAlign: 'center', color: '#64748B', padding: 12 },
  backdrop: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(15,23,42,.55)' }, modal: { backgroundColor: '#fff', borderRadius: 20, padding: 15, maxHeight: '85%' }, modalHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }, modalTitle: { fontSize: 17, fontWeight: '900', color: '#0F172A' },
  search: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 11, paddingHorizontal: 10, marginBottom: 7, minHeight: 42 }, searchInput: { flex: 1, textAlign: 'right', color: '#0F172A' }, option: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingVertical: 10 }, optionText: { flex: 1, alignItems: 'flex-end' },
});
