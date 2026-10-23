import { storyDiscoveryMembership } from '@/lib/storyActivity';
import { useCallback, useEffect, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import {
  getActiveLocation,
  setActiveLocation,
  isAllKingdom,
  isLocationMatching,
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
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

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
            '*, profiles:author_id(id, display_name, username, avatar_url, is_verified, is_geoverified, city, district, account_type, role)',
          )
          .or(`expires_at.gt.${new Date().toISOString()},and(expires_at.is.null,created_at.gte.${new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()})`)
          .order('created_at', { ascending: false })
          .limit(40) : Promise.resolve({ data: [], error: null }),
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

      // Count unread conversations using the same last-message rule as /messages.
      // Errors in chat must never break the neighborhood feed.
      if (user) {
        try {
          const { data: memberships, error: membershipError } = await supabase
            .from('conversation_members').select('conversation_id').eq('user_id', user.id);
          if (membershipError) throw membershipError;
          const ids = (memberships ?? []).map(row => row.conversation_id);
          if (ids.length) {
            const { data: chatMessages, error: chatError } = await supabase
              .from('messages').select('conversation_id,sender_id,read_by,created_at')
              .in('conversation_id', ids).order('created_at', { ascending: false });
            if (chatError) throw chatError;
            const latest = new Map<string, { sender_id: string; read_by: string[] | null }>();
            for (const message of chatMessages ?? []) {
              if (!latest.has(message.conversation_id)) latest.set(message.conversation_id, message);
            }
            setUnreadMessagesCount([...latest.values()].filter(message =>
              message.sender_id !== user.id && !(message.read_by ?? []).includes(user.id)
            ).length);
          } else setUnreadMessagesCount(0);
        } catch (chatError) {
          console.warn('Could not refresh unread chat badge:', chatError);
          setUnreadMessagesCount(0);
        }
      } else setUnreadMessagesCount(0);

      if (questionsRes.error) throw questionsRes.error;
      if (requestsRes.error) throw requestsRes.error;

      // Story rings include the owner, followed authors and exact neighborhood matches.
      const rawStories = ((storiesRes.data ?? []) as Story[]);
      const mutedAuthors = new Set<string>();
      if (user) {
        const preferences = await supabase.from('story_author_preferences').select('author_id').eq('user_id', user.id).eq('muted', true);
        if (preferences.error) { setStories([]); } else (preferences.data || []).forEach(row => mutedAuthors.add(row.author_id));
        if (preferences.error) rawStories.length = 0;
      }
      const follows = user ? await supabase.from('follows').select('following_id').eq('follower_id', user.id) : { data: [], error: null };
      if (storiesRes.error) throw storiesRes.error;
      if (follows.error) throw follows.error;
      const following = (follows.data || []).map(row => String(row.following_id));
      const seen = new Set<string>();
      const localStories: Story[] = [];
      for (const story of rawStories) {
        if (!story.author_id || seen.has(story.author_id) || mutedAuthors.has(story.author_id)) continue;
        if (!storyDiscoveryMembership(story.profiles, story.author_id, user?.id || '', following, loc.city, loc.district).ring) continue;
        localStories.push(story);
        seen.add(story.author_id);
      }
      setStories(localStories.slice(0, 10));

      const qRows = dedupe((questionsRes.data ?? []) as Question[], 'author_id');
      const rRows = dedupe((requestsRes.data ?? []) as HelpRequest[], 'requester_id');
      setHasMore((questionsRes.data?.length ?? 0) >= limit || (requestsRes.data?.length ?? 0) >= limit);

      // Stage 2: answers for questions + help_matches for requests + ONE profiles query for every author involved.
      const qIds = qRows.map(q => q.id);
      const rIds = rRows.map(r => r.id);

      const [answersRes, matchesRes] = await Promise.all([
        qIds.length
          ? supabase.from('answers').select('*').in('question_id', qIds).order('created_at', { ascending: true })
          : Promise.resolve({ data: [] as any[], error: null }),
        rIds.length
          ? supabase.from('help_matches').select('*').in('request_id', rIds).order('created_at', { ascending: true })
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);

      const answers = (answersRes.data ?? []) as any[];
      const matches = (matchesRes.data ?? []) as any[];

      const profileIds = [
        ...new Set([
          ...qRows.map(q => q.author_id),
          ...rRows.map(r => r.requester_id),
          ...answers.map(a => a.author_id),
          ...matches.map(m => m.helper_id),
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

      const matchesByR: Record<string, any[]> = {};
      matches.forEach(m => {
        (matchesByR[m.request_id] ||= []).push({
          id: m.id,
          request_id: m.request_id,
          author_id: m.helper_id,
          body: m.message || 'أبشر بالفزعة يا جارنا 🤝',
          created_at: m.created_at,
          status: m.status,
          profiles: profileMap[m.helper_id] || null,
        });
      });

      setQuestions(
        qRows.map(q => ({
          ...q,
          profiles: profileMap[q.author_id] || null,
          answers: answersByQ[q.id] || [],
          answers_count: (answersByQ[q.id] || []).length,
        })),
      );
      setRequests(
        rRows.map(r => ({
          ...r,
          profiles: profileMap[r.requester_id] || null,
          answers: matchesByR[r.id] || [],
          answers_count: (matchesByR[r.id] || []).length,
        })),
      );
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
    // Public feed updates are subscribed for guests too; notifications remain account-only.
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
      let channel = supabase
        .channel(`home-live-${currentUserId || 'guest'}-${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'questions' }, refresh)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'requests' }, refresh);

      if (currentUserId) {
        channel = channel.on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUserId}` },
          () => setUnreadNotifCount(c => c + 1),
        );
      }

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
    unreadMessagesCount,
    loading,
    loadingMore,
    error,
    hasMore,
    locationIncomplete,
    reload,
    loadMore,
  };
}
