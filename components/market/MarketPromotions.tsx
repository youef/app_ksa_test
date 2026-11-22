import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Megaphone, ChevronLeft, RefreshCw } from 'lucide-react-native';
import { OasisPressable as Pressable } from '@/components/oasis/OasisPrimitives';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';

type Promotion = {
  id: string;
  title: string;
  description: string;
  service_id: string | null;
  owner_id: string;
  ends_at: string;
};

const REFRESH_INTERVAL_MS = 60_000;

export function MarketPromotions({ city, district }: { city: string; district: string }) {
  const { colors: c } = useTheme();
  const [rows, setRows] = useState<Promotion[]>([]);
  const [failed, setFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const requestSequence = useRef(0);
  const retryingRef = useRef(false);

  const load = useCallback(async (manual = false) => {
    if (retryingRef.current) return;
    if (manual) {
      retryingRef.current = true;
      setRetrying(true);
    }

    const ticket = ++requestSequence.current;
    try {
      const response = await supabase.rpc('hayna_marketplace_promotions', {
        p_city: city,
        p_district: district && !/^كل|^جميع/.test(district) ? district : null,
      });
      if (ticket !== requestSequence.current) return;
      if (response.error) {
        setFailed(true);
        return;
      }
      setRows(response.data || []);
      setFailed(false);
    } catch {
      if (ticket === requestSequence.current) setFailed(true);
    } finally {
      if (manual && ticket === requestSequence.current) {
        retryingRef.current = false;
        setRetrying(false);
      }
    }
  }, [city, district]);

  useEffect(() => {
    requestSequence.current++;
    retryingRef.current = false;
    setRetrying(false);
    setRows([]);
    setFailed(false);
    if (!city || /^كل|^جميع/.test(city)) return;

    void load();
    const timer = setInterval(() => void load(), REFRESH_INTERVAL_MS);
    return () => {
      requestSequence.current++;
      clearInterval(timer);
    };
  }, [city, district, load]);

  const visible = rows.filter(row => Date.parse(row.ends_at) > Date.now());
  if (!visible.length && !failed) return null;

  return (
    <View style={{ gap: 10, marginBottom: 16 }}>
      {failed ? (
        <View style={{ padding: 12, borderRadius: 16, borderWidth: 1, borderColor: c.line, backgroundColor: c.dangerSoft, gap: 10 }}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 8 }}>
            <Megaphone size={16} color={c.danger} />
            <Text accessibilityRole="alert" style={{ flex: 1, textAlign: 'right', fontSize: 12, lineHeight: 20, fontWeight: '600', color: c.danger }}>
              {visible.length ? 'تعذر تحديث العروض المميزة. نعرض العروض السابقة.' : 'تعذر تحميل العروض المميزة. يمكنك المحاولة مرة أخرى.'}
            </Text>
          </View>
          <Pressable
            oasisKind="plain"
            accessibilityRole="button"
            accessibilityLabel="إعادة تحميل العروض المميزة"
            accessibilityState={{ disabled: retrying, busy: retrying }}
            disabled={retrying}
            onPress={() => void load(true)}
            style={{ minHeight: 44, alignSelf: 'flex-end', paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, flexDirection: 'row-reverse', gap: 7, alignItems: 'center', justifyContent: 'center' }}
          >
            {retrying ? <ActivityIndicator size="small" color={c.primary} /> : <RefreshCw size={15} color={c.primary} />}
            <Text style={{ color: c.primary, fontSize: 12, fontWeight: '700' }}>{retrying ? 'جاري إعادة المحاولة…' : 'إعادة المحاولة'}</Text>
          </Pressable>
        </View>
      ) : null}
      {visible.map(row => (
        <View key={row.id} style={{ padding: 15, borderRadius: 18, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, gap: 9 }}>
          <View style={{ flexDirection: 'row-reverse', gap: 6, alignItems: 'center' }}>
            <Megaphone size={14} color={c.primary} />
            <Text style={{ color: c.primary, fontSize: 10, fontWeight: '600' }}>إعلان ممول · {city}</Text>
          </View>
          <Text style={{ textAlign: 'right', fontSize: 15, fontWeight: '700', color: c.ink }}>{row.title}</Text>
          {row.description ? <Text style={{ textAlign: 'right', fontSize: 12, lineHeight: 23, color: c.muted }}>{row.description}</Text> : null}
          <Pressable oasisKind="plain" accessibilityRole="button" accessibilityLabel={row.service_id ? 'تفاصيل الخدمة المعلن عنها' : 'التواصل مع المعلن'} onPress={() => router.push({ pathname: row.service_id ? '/service' : '/user', params: { id: row.service_id || row.owner_id } })} style={{ minHeight: 44, alignSelf: 'flex-end', paddingHorizontal: 12, borderRadius: 22, backgroundColor: c.soft, flexDirection: 'row-reverse', gap: 6, alignItems: 'center' }}>
            <Text style={{ color: c.primary, fontSize: 12, fontWeight: '600' }}>{row.service_id ? 'تفاصيل الخدمة' : 'التواصل مع المعلن'}</Text>
            <ChevronLeft size={15} color={c.primary} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}
