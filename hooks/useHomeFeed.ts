import { useCallback, useEffect, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import {
  getActiveLocation,
  setActiveLocation,
  isAllKingdom,
  type HaynaLocation,
} from '@/lib/locationSync';
import {
  dedupe,
  type HelpRequest,
  type Profile,
  type Question,
  type Story,
} from '@/lib/homeUtils';

const PAGE_SIZE = 30;

type Options = {
  /** Called whenever the effective location was resolved from profile / storage. */
  onLocation: (loc: HaynaLocation) => void;
};

export function useHomeFeed({ onLocation }: Options) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [requests, setRequests] = useState<HelpRequest[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  const [loading, setLoading] = useState(true); // first load only
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [locationIncomplete, setLocationIncomplete] = useState(false);

  const busyRef = useRef(false);
  const limitRef = useRef(PAGE_SIZE);
  const locRef = useRef<HaynaLocation | null>(null);
  const onLocationRef = useRef(onLocation);
  onLocationRef.current = onLocation;

  const load = useCallback(async (opts?: { more?: boolean }) => {
    if (busyRef.current) return;
    busyRef.current = true;
    if (opts?.more) {
      limitRef.current += PAGE_SIZE;
      setLoadingMore(true);
    }

    try {
      const { data: auth } = await supabase.auth.getSession();
      const user = auth.session?.user ?? null;
      setCurrentUserId(user?.id ?? null);

      const [profileRes, savedLoc] = await Promise.all([
        user ? supabase.from('profiles').select('*').eq('id', user.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
        getActiveLocation(),
      ]);
      if (profileRes.error) throw profileRes.error;

      const profileData = profileRes.data as Profile | null;
      const loc: HaynaLocation =
        user && profileData?.city && isAllKingdom(savedLoc.city)
          ? {
              region: profileData.region || 'المملكة',
              city: profileData.city,
              district: profileData.district || 'كل الأحياء',
            }
          : savedLoc;

      locRef.current = loc;
      setProfile(profileData);
      onLocationRef.current(loc);
      setLocationIncomplete(Boolean(user && !(profileData?.region && profileData?.city && profileData?.district)));

      if (profileData?.city && isAllKingdom(savedLoc.city)) {
        void setActiveLocation(loc.region, loc.city, loc.district, false);
      }

      const limit = limitRef.current;

      // Stage 1: every independent query in parallel.
      const [notifRes, storiesRes, questionsRes, requestsRes] = await Promise.all([
        user ? supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .is('read_at', null) : Promise.resolve({ count: 0, error: null }),
        user ? supabase
          .from('stories')
          .select(
            '*, profiles:author_id(id, display_name, username, avatar_url, is_verified, is_geoverified, city, district)',
          )
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(30) : Promise.resolve({ data: [], error: null }),
        user
          ? supabase.from('questions').select('*').order('created_at', { ascending: false }).limit(limit)
          : supabase.rpc('hayna_guest_questions', { p_city: loc.city, p_district: loc.district, p_limit: limit }),
        user ? supabase
          .from('requests')
          .select('*')
          .eq('status', 'open')
          .order('created_at', { ascending: false })
          .limit(limit) : supabase.rpc('hayna_guest_requests', { p_city: loc.city, p_district: loc.district, p_limit: limit }),
      ]);

      setUnreadNotifCount(notifRes.count ?? 0);

      if (questionsRes.error) throw questionsRes.error;
      if (requestsRes.error) throw requestsRes.error;

      // Stories: one per author, limited to the user's area.
      const seen = new Set<string>();
      setStories(
        ((storiesRes.data ?? []) as Story[]).filter(s => {
          if (!s.author_id || seen.has(s.author_id)) return false;
          const c = s.profiles?.city || '';
          const d = s.profiles?.district || '';
          if (!isAllKingdom(loc.city)) {
            if (loc.city && c && c !== loc.city) return false;
            if (loc.district && loc.district !== 'كل الأحياء' && d && d !== loc.district) return false;
          }
          seen.add(s.author_id);
          return true;
        }),
      );

      const qRows = dedupe((questionsRes.data ?? []) as Question[], 'author_id');
      const rRows = dedupe((requestsRes.data ?? []) as HelpRequest[], 'requester_id');
      setHasMore((questionsRes.data?.length ?? 0) >= limit || (requestsRes.data?.length ?? 0) >= limit);

      // Stage 2: answers + ONE profiles query for every author involved.
      const qIds = qRows.map(q => q.id);
      const answersRes = qIds.length
        ? await supabase.from('answers').select('*').in('question_id', qIds).order('created_at', { ascending: true })
        : { data: [] as any[], error: null };
      const answers = (answersRes.data ?? []) as any[];

      const profileIds = [
        ...new Set([
          ...qRows.map(q => q.author_id),
          ...rRows.map(r => r.requester_id),
          ...answers.map(a => a.author_id),
        ].filter(Boolean)),
      ] as string[];

      const profilesRes = profileIds.length
        ? await supabase.from('profiles').select('*').in('id', profileIds)
        : { data: [] as any[] };
      const profileMap: Record<string, Profile> = {};
      (profilesRes.data ?? []).forEach((p: any) => { profileMap[p.id] = p; });

      const answersByQ: Record<string, any[]> = {};
      answers.forEach(a => {
        (answersByQ[a.question_id] ||= []).push({ ...a, profiles: profileMap[a.author_id] || null });
      });

      setQuestions(
        qRows.map(q => ({
          ...q,
          profiles: profileMap[q.author_id] || null,
          answers: answersByQ[q.id] || [],
          answers_count: (answersByQ[q.id] || []).length,
        })),
      );
      setRequests(rRows.map(r => ({ ...r, profiles: profileMap[r.requester_id] || null })));
      setError(null);
    } catch (e: any) {
      console.warn('home load failed:', e);
      setError(e?.code === 'PGRST202'
        ? 'يلزم تحديث قاعدة البيانات لتصفح محتوى الحي كزائر.'
        : e?.message ? 'تعذر تحميل الصفحة، تحقق من الاتصال وحاول مرة أخرى.' : 'حدث خطأ غير متوقع.');
    } finally {
      busyRef.current = false;
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Realtime: new posts refresh the feed (debounced), new notifications bump the badge.
  const channelRef = useRef<any>(null);
  useEffect(() => {
    if (!currentUserId) return;

    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void load(), 1500);
    };

    const setup = async () => {
      const previous = channelRef.current;
      channelRef.current = null;
      if (previous) await supabase.removeChannel(previous);
      if (disposed) return;

      // Unique topic per subscription: the realtime client reuses a still-registered
      // channel with the same topic, and adding bindings to a joined channel throws.
      const channel = supabase
        .channel(`home-live-${currentUserId}-${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'questions' }, refresh)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'requests' }, refresh)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUserId}` },
          () => setUnreadNotifCount(c => c + 1),
        );

      channel.subscribe();
      if (disposed) {
        void supabase.removeChannel(channel);
        return;
      }
      channelRef.current = channel;
    };

    void setup();

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      const channel = channelRef.current;
      channelRef.current = null;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [currentUserId, load]);

  const loadMore = useCallback(() => load({ more: true }), [load]);
  const reload = useCallback(() => load(), [load]);

  return {
    profile,
    setProfile,
    currentUserId,
    questions,
    setQuestions,
    requests,
    stories,
    unreadNotifCount,
    loading,
    loadingMore,
    error,
    hasMore,
    locationIncomplete,
    reload,
    loadMore,
  };
}
