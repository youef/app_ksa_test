import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { BellRing, ChevronLeft, X } from 'lucide-react-native';
import { OasisPressable as Pressable } from '@/components/oasis/OasisPrimitives';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';

/* -------------------------------------------------------------------------- */
/*                                  Types                                     */
/* -------------------------------------------------------------------------- */

type Severity = 'urgent' | 'important' | 'notice';

type LocalAlert = {
  id: string;
  title: string;
  severity: string;
  expires_at: string;
};

type Props = {
  city?: string;
  district?: string;
};

/* -------------------------------------------------------------------------- */
/*                                Constants                                   */
/* -------------------------------------------------------------------------- */

const SEVERITY_LABELS: Record<Severity, string> = {
  urgent: 'عاجل',
  important: 'مهم',
  notice: 'تنويه',
};

// حد أقصى لمؤقّت الانتهاء — 1 ساعة (RN قد يُقتل التطبيق وإلا)
const MAX_EXPIRE_TIMEOUT_MS = 60 * 60 * 1000;

// حد أقصى لطول حقل المدينة/الحي في الفلتر
const SAFE_FIELD_MAX = 80;

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

function isAllValue(v?: string | null): boolean {
  return !v || v.startsWith('كل ');
}

function sanitizeFilterValue(v?: string | null): string {
  // منع حقن PostgREST: إزالة الفواصل والأقواس والرموز الخاصة
  return (v || '').replace(/[,()=*&%_]/g, '').replace(/\s+/g, ' ').trim().slice(0, SAFE_FIELD_MAX);
}

function resolveSeverity(raw: string): Severity {
  return raw === 'urgent' || raw === 'important' || raw === 'notice'
    ? raw
    : 'important';
}

/* -------------------------------------------------------------------------- */
/*                                Component                                   */
/* -------------------------------------------------------------------------- */

function LocalUrgentBannerBase({ city, district }: Props) {
  const { colors: c } = useTheme();
  const [alert, setAlert] = useState<LocalAlert | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);

  // timers refs — يتجنب stale closure
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expireRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // إعادة تعيين عند تغيير المدينة/الحي
    setAlert(null);
    setDismissed(null);

    if (isAllValue(city)) return;

    let active = true;
    let request: AbortController | null = null;

    const clearTimers = () => {
      if (delayRef.current) {
        clearTimeout(delayRef.current);
        delayRef.current = null;
      }
      if (expireRef.current) {
        clearTimeout(expireRef.current);
        expireRef.current = null;
      }
    };

    const scheduleExpiry = (row: LocalAlert) => {
      if (expireRef.current) clearTimeout(expireRef.current);

      const remaining = new Date(row.expires_at).getTime() - Date.now();
      if (remaining <= 0) {
        setAlert((cur) => (cur?.id === row.id ? null : cur));
        return;
      }

      const wait = Math.min(remaining, MAX_EXPIRE_TIMEOUT_MS);
      expireRef.current = setTimeout(() => {
        if (!active) return;
        // إذا بقي وقت، أعد الجدولة (بدل انتظار طويل جداً)
        if (remaining > MAX_EXPIRE_TIMEOUT_MS) {
          scheduleExpiry(row);
        } else {
          setAlert((cur) => (cur?.id === row.id ? null : cur));
        }
      }, wait);
    };

    const load = async () => {
      request?.abort();
      request = new AbortController();
      const controller = request;

      try {
        const safeCity = sanitizeFilterValue(city);
        if (!safeCity) {
          if (active) setAlert(null);
          return;
        }

        let query = supabase
          .from('urgent_alerts')
          .select('id,title,severity,expires_at')
          .eq('city', safeCity)
          .eq('status', 'active')
          .gt('expires_at', new Date().toISOString());

        // بدل .or() مع حقن — استخدم .in() بقيم نظيفة
        if (!isAllValue(district)) {
          const safeDistrict = sanitizeFilterValue(district!);
          if (safeDistrict) {
            query = query.in('district', [
              safeDistrict,
              'كل الأحياء',
              '',
            ]);
          }
        }

        // abortSignal قد لا يكون مدعوماً في كل الإصدارات
        const finalQuery =
          typeof (query as unknown as { abortSignal?: unknown })
            .abortSignal === 'function'
            ? query.abortSignal(controller.signal)
            : query;

        const { data, error } = await finalQuery
          .order('created_at', { ascending: false })
          .limit(1);

        if (!active || controller.signal.aborted) return;

        const row: LocalAlert | null =
          !error && data?.[0] ? (data[0] as LocalAlert) : null;

        setAlert(row);
        if (row) scheduleExpiry(row);
      } catch {
        if (active && !controller.signal.aborted) setAlert(null);
      }
    };

    void load();

    const channel = supabase
      .channel(`local-alert-banner:${city}:${district || 'city'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'urgent_alerts',
          filter: `city=eq.${sanitizeFilterValue(city!)}`,
        },
        () => {
          if (delayRef.current) clearTimeout(delayRef.current);
          delayRef.current = setTimeout(() => void load(), 250);
        },
      )
      .subscribe();

    return () => {
      active = false;
      request?.abort();
      clearTimers();
      void supabase.removeChannel(channel);
    };
  }, [city, district]);

  // انتهاء الصلاحية محلياً (حماية بصرية أثناء التمرير)
  const isExpired = useMemo(
    () => !!alert && new Date(alert.expires_at).getTime() <= Date.now(),
    [alert],
  );

  if (!alert || alert.id === dismissed || isExpired) return null;

  const severity = resolveSeverity(alert.severity);
  const color = severity === 'urgent' ? c.danger : c.primary;
  const level = SEVERITY_LABELS[severity];

  return (
    <View
      style={[
        styles.banner,
        { borderColor: c.line, backgroundColor: c.surface },
      ]}
    >
      <Pressable
        oasisKind="plain"
        accessibilityRole="button"
        accessibilityLabel={`${level} — ${alert.title}`}
        accessibilityHint="يفتح تفاصيل التنبيه المجتمعي"
        onPress={() => router.push('/emergency-alert')}
        style={styles.main}
      >
        <View style={[styles.iconWrap, { backgroundColor: c.soft }]}>
          <BellRing size={16} color={color} />
        </View>

        <View style={styles.copy}>
          <Text style={[styles.level, { color }]} numberOfLines={1}>
            {level} · تنبيه مجتمعي غير حكومي
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.title, { color: c.ink }]}
          >
            {alert.title}
          </Text>
        </View>

        <ChevronLeft size={15} color={c.muted} />
      </Pressable>

      <Pressable
        oasisKind="plain"
        accessibilityRole="button"
        accessibilityLabel="إخفاء هذا التنبيه"
        accessibilityHint="يخفي البانر حتى إعادة تحميل الصفحة"
        onPress={() => setDismissed(alert.id)}
        hitSlop={8}
        style={styles.dismissBtn}
      >
        <X size={15} color={c.muted} />
      </Pressable>
    </View>
  );
}

export default memo(LocalUrgentBannerBase);

/* -------------------------------------------------------------------------- */
/*                                  Styles                                    */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderRadius: 17,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  main: {
    flex: 1,
    minWidth: 0, // ضروري لعمل numberOfLines داخل row
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 9,
    minHeight: 46,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  level: {
    textAlign: 'right',
    fontSize: 10,
    fontWeight: '700',
  },
  title: {
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '600',
  },
  dismissBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
