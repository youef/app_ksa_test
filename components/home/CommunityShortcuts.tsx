import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import { Image, Linking, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowUpLeft, Megaphone } from 'lucide-react-native';
import { OasisPressable as Pressable } from '@/components/oasis/OasisPrimitives';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/context/ThemeContext';

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

type ActionType = 'none' | 'internal' | 'external';

type Announcement = {
  id: string;
  title: string | null;
  message: string | null;
  image_url: string | null;
  expires_at: string;
  action_type: ActionType;
  action_target: string | null;
};

type Props = {
  signedIn: boolean;
};

/* -------------------------------------------------------------------------- */
/*                                Constants                                   */
/* -------------------------------------------------------------------------- */

const ROTATE_INTERVAL_MS = 30_000;
const MAX_DOTS = 8;
const DEFAULT_ASPECT_RATIO = 2.8;

// مسارات داخلية آمنة
const INTERNAL_PATH = /^\/[a-zA-Z0-9/_\-?=&]+$/;
const EXTERNAL_URL = /^https:\/\/[^\s]+$/i;

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

function isAlive(ad: Announcement | null): ad is Announcement {
  return !!ad && Date.parse(ad.expires_at) > Date.now();
}

function hasAction(ad: Announcement | null): ad is Announcement & {
  action_type: Exclude<ActionType, 'none'>;
  action_target: string;
} {
  return !!ad && ad.action_type !== 'none' && !!ad.action_target;
}

function isFullImage(ad: Announcement): boolean {
  return !!ad.image_url && !ad.title && !ad.message;
}

/* -------------------------------------------------------------------------- */
/*                               Component                                    */
/* -------------------------------------------------------------------------- */

function CommunityShortcutsBase({ signedIn }: Props) {
  const { colors: c, isDark } = useTheme();

  const [items, setItems] = useState<Announcement[]>([]);
  const [active, setActive] = useState(0);
  // key: url → { ratio?: number; failed?: boolean }
  const [imageMeta, setImageMeta] = useState<
    Record<string, { ratio?: number; failed?: boolean }>
  >({});

  // ref لتفادي stale closure في setInterval
  const visibleLenRef = useRef(0);

  /* -------------------------------- Fetch -------------------------------- */

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from('home_announcements')
      .select(
        'id,title,message,image_url,expires_at,action_type,action_target',
      )
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      // صامت، لكن مفيد للتشخيص
      if (__DEV__) console.warn('[CommunityShortcuts] refresh failed:', error.message);
      return;
    }
    setItems((data || []) as Announcement[]);
  }, []);

  /* ------------------------------- Rotation ------------------------------ */

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      void refresh();
      // استخدم ref لقراءة الطول الحالي بدون stale closure
      const len = visibleLenRef.current;
      if (len > 1) setActive((n) => (n + 1) % len);
    }, ROTATE_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [refresh]);

  /* ------------------------------- Derived ------------------------------- */

  const visible = useMemo(
    () => items.filter((item) => Date.parse(item.expires_at) > Date.now()),
    [items],
  );

  useEffect(() => {
    visibleLenRef.current = visible.length;
    // إذا تقلّصت القائمة، أعد المؤشر إلى النطاق الآمن
    if (visible.length > 0 && active >= visible.length) {
      setActive(0);
    }
  }, [visible.length, active]);

  const safeIndex = visible.length ? active % visible.length : 0;
  const ad = visible.length ? visible[safeIndex] : null;
  const fullImageUrl = ad && isFullImage(ad) ? ad.image_url : null;

  /* ---------------------------- Image Size Probe ------------------------- */

  useEffect(() => {
    if (!fullImageUrl) return;
    const cached = imageMeta[fullImageUrl];
    if (cached?.ratio || cached?.failed) return;

    let cancelled = false;

    Image.getSize(
      fullImageUrl,
      (w, h) => {
        if (cancelled) return;
        if (w > 0 && h > 0) {
          setImageMeta((prev) => ({
            ...prev,
            [fullImageUrl]: { ratio: w / h },
          }));
        } else {
          setImageMeta((prev) => ({
            ...prev,
            [fullImageUrl]: { failed: true },
          }));
        }
      },
      () => {
        if (cancelled) return;
        // علّم كفشل حتى لا نعيد المحاولة لا نهائياً
        setImageMeta((prev) => ({
          ...prev,
          [fullImageUrl]: { failed: true },
        }));
      },
    );

    return () => {
      cancelled = true;
    };
  }, [fullImageUrl, imageMeta]);

  /* ------------------------------- Actions ------------------------------- */

  const openDestination = useCallback((a: Announcement) => {
    if (!hasAction(a)) return;

    const target = a.action_target;

    if (a.action_type === 'internal' && INTERNAL_PATH.test(target)) {
      router.push(target as never);
      return;
    }

    if (a.action_type === 'external' && EXTERNAL_URL.test(target)) {
      Linking.openURL(target).catch(() => {
        if (__DEV__) console.warn('[CommunityShortcuts] cannot open URL');
      });
    }
  }, []);

  /* ------------------------------ Render gate ---------------------------- */

  // لا تعرض شيئاً للزوار
  if (!signedIn) return null;
  if (!ad) return null;

  /* -------------------------------- Render ------------------------------- */

  const ratio = fullImageUrl
    ? imageMeta[fullImageUrl]?.ratio ?? DEFAULT_ASPECT_RATIO
    : null;

  const bannerStyle = [
    s.banner,
    {
      backgroundColor: isDark ? c.soft : c.surface,
      borderColor: c.line,
    },
    ratio !== null ? { aspectRatio: ratio, minHeight: undefined, maxHeight: undefined } : undefined,
  ];

  const canAct = hasAction(ad);
  const counter = visible.length > 1
    ? `${safeIndex + 1} / ${visible.length}`
    : 'إعلان رسمي';

  return (
    <View style={s.outer}>
      <View style={s.header}>
        <View style={s.headerTitle}>
          <Megaphone size={14} color={c.primary} />
          <Text style={[s.label, { color: c.primary }]}>إعلانات حيّنا</Text>
        </View>
        <Text style={[s.counter, { color: c.muted }]}>{counter}</Text>
      </View>

      <Pressable
        oasisKind="plain"
        disabled={!canAct}
        onPress={() => openDestination(ad)}
        accessibilityRole={canAct ? 'link' : 'summary'}
        accessibilityLabel={
          canAct
            ? `فتح الإعلان: ${ad.title ?? ad.message ?? 'إعلان'}`
            : ad.title ?? ad.message ?? 'إعلان حيّنا'
        }
        style={bannerStyle}
      >
        {isFullImage(ad) ? (
          <Image
            source={{ uri: ad.image_url! }}
            resizeMode="contain"
            style={s.fullImage}
            accessibilityLabel="صورة الإعلان"
          />
        ) : ad.image_url ? (
          <View style={s.mixed}>
            <View style={s.copy}>
              {ad.title ? (
                <Text numberOfLines={2} style={[s.title, { color: c.ink }]}>
                  {ad.title}
                </Text>
              ) : null}
              {ad.message ? (
                <Text numberOfLines={3} style={[s.message, { color: c.muted }]}>
                  {ad.message}
                </Text>
              ) : null}
              {canAct ? (
                <View style={s.cta}>
                  <Text style={s.ctaText}>اكتشف المزيد</Text>
                  <ArrowUpLeft size={13} color={c.surface} />
                </View>
              ) : null}
            </View>
            <Image
              source={{ uri: ad.image_url }}
              resizeMode="cover"
              style={s.sideImage}
              accessibilityIgnoresInvertColors
            />
          </View>
        ) : (
          <View style={s.textOnly}>
            <View style={s.copy}>
              {ad.title ? (
                <Text numberOfLines={2} style={[s.title, { color: c.ink }]}>
                  {ad.title}
                </Text>
              ) : null}
              {ad.message ? (
                <Text numberOfLines={3} style={[s.message, { color: c.muted }]}>
                  {ad.message}
                </Text>
              ) : null}
            </View>
            {canAct ? (
              <View style={s.cta}>
                <Text style={s.ctaText}>عرض التفاصيل</Text>
                <ArrowUpLeft size={13} color={c.surface} />
              </View>
            ) : null}
          </View>
        )}

        {canAct && isFullImage(ad) ? (
          <View style={s.imageAction}>
            <ArrowUpLeft size={17} color={c.surface} />
          </View>
        ) : null}
      </Pressable>

      {visible.length > 1 ? (
        <View style={s.dots}>
          {visible.slice(0, MAX_DOTS).map((item, i) => {
            const isActive = i === safeIndex;
            return (
              <View
                key={item.id}
                style={[
                  s.dot,
                  isActive && s.dotActive,
                  { backgroundColor: isActive ? c.primary : c.line },
                ]}
              />
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

export default memo(CommunityShortcutsBase);

/* -------------------------------------------------------------------------- */
/*                                  Styles                                    */
/* -------------------------------------------------------------------------- */

const s = StyleSheet.create({
  outer: {
    gap: 8,
    maxWidth: 820,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  headerTitle: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  label: { fontSize: 11, fontWeight: '800' },
  counter: { fontSize: 10 },
  banner: {
    width: '100%',
    aspectRatio: DEFAULT_ASPECT_RATIO,
    minHeight: 112,
    maxHeight: 200,
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 0,
    position: 'relative',
  },
  fullImage: { width: '100%', height: '100%' },
  mixed: { flex: 1, flexDirection: 'row-reverse' },
  sideImage: { width: '43%', height: '100%' },
  copy: {
    flex: 1,
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  textOnly: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  title: { fontSize: 13, fontWeight: '700', textAlign: 'right' },
  message: { fontSize: 11, lineHeight: 17, textAlign: 'right' },
  cta: {
    backgroundColor: '#047857', // ← إن أردت، استبدلها بـ c.primary عبر نمط ديناميكي
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 4,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
  },
  ctaText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  imageAction: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(4,78,59,0.88)',
    borderRadius: 12,
    padding: 8,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot: { height: 5, borderRadius: 5, width: 5 },
  dotActive: { width: 15 },
});