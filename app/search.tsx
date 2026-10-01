import { useState, useCallback, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Pressable, ActivityIndicator, Image, Platform } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/ui';
import { Search as SearchIcon, ArrowRight, User, MessageCircle, Truck, Plus } from 'lucide-react-native';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'users' | 'questions' | 'requests'>('all');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    users: any[];
    questions: any[];
    requests: any[];
  }>({ users: [], questions: [], requests: [] });

  // Debounce search
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (query.trim().length > 0) {
        performSearch();
      } else {
        setResults({ users: [], questions: [], requests: [] });
      }
    }, 400);
    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const performSearch = async () => {
    setLoading(true);
    const searchTerm = `%${query.trim()}%`;

    try {
      const [{ data: auth }, u, q, r] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('profiles').select('*').or(`display_name.ilike.${searchTerm},username.ilike.${searchTerm},city.ilike.${searchTerm}`).limit(15),
        supabase.from('questions').select('*, profiles(*)').or(`title.ilike.${searchTerm},body.ilike.${searchTerm}`).limit(10),
        supabase.from('request_directory').select('*, profiles(*)').or(`title.ilike.${searchTerm},description.ilike.${searchTerm}`).limit(10)
      ]);

      // Hide users I blocked (or who blocked me) from search results.
      let visibleUsers = u.data || [];
      const myId = auth?.user?.id;
      if (myId) {
        const { data: blocks } = await supabase
          .from('blocks')
          .select('blocker_id, blocked_id')
          .or(`blocker_id.eq.${myId},blocked_id.eq.${myId}`);

        const blocked = new Set<string>();
        (blocks || []).forEach((b: any) => {
          if (b.blocker_id === myId || b.blocked_id === myId) {
            blocked.add(b.blocker_id === myId ? b.blocked_id : b.blocker_id);
          }
        });
        visibleUsers = visibleUsers.filter((p: any) => !blocked.has(p.id));
      }

      setResults({
        users: visibleUsers,
        questions: q.data || [],
        requests: r.data || []
      });
    } catch (e) {
      console.log('Search error:', e);
    } finally {
      setLoading(false);
    }
  };

  const renderUser = (u: any) => (
    <Pressable key={`u-${u.id}`} style={styles.userCard} onPress={() => router.push({ pathname: '/user', params: { id: u.id } })}>
      <View style={styles.userInfoLeft}>
        {u.avatar_url ? (
          <Image source={{uri: u.avatar_url}} style={styles.userAvatar} />
        ) : (
          <View style={styles.userAvatarFallback}>
            <Text style={styles.userAvatarLetter}>{u.display_name?.[0] || u.username?.[0] || 'ج'}</Text>
          </View>
        )}
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{u.display_name || u.username}</Text>
        <Text style={styles.userHandle}>@{u.username} {u.city ? `· ${u.city}` : ''}</Text>
      </View>
      <View style={styles.visitProfileBtn}>
        <Text style={styles.visitProfileText}>زيارة</Text>
      </View>
    </Pressable>
  );

  const renderQuestion = (q: any) => (
    <Pressable key={`q-${q.id}`} style={styles.postCard} onPress={() => router.push({ pathname: '/question', params: { id: q.id } })}>
      <View style={styles.cardHeader}>
        <View style={styles.iconBoxBlue}>
          <MessageCircle size={18} color="#059669" />
        </View>
        <View style={styles.cardHeaderText}>
          <Text style={styles.cardTitle} numberOfLines={1}>{q.title}</Text>
          <Text style={styles.cardAuthor}>الكاتب: {q.profiles?.display_name || 'مستخدم'}</Text>
        </View>
      </View>
    </Pressable>
  );

  const renderRequest = (r: any) => (
    <Pressable key={`r-${r.id}`} style={styles.postCard} onPress={() => router.push({ pathname: '/request', params: { id: r.id } })}>
      <View style={styles.cardHeader}>
        <View style={styles.iconBoxOrange}>
          <Truck size={18} color="#ea580c" />
        </View>
        <View style={styles.cardHeaderText}>
          <Text style={styles.cardTitle} numberOfLines={1}>{r.title}</Text>
          <Text style={styles.cardAuthor}>بواسطة: {r.profiles?.display_name || 'مستخدم'}</Text>
        </View>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      {/* Modern Search Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ArrowRight size={24} color="#059669" />
        </Pressable>
        <View style={styles.searchBox}>
          <SearchIcon size={20} color="#059669" />
          <TextInput
            style={styles.searchInput}
            placeholder="ابحث عن جيران، أسئلة، خدمات..."
            placeholderTextColor="#9ca3af"
            value={query}
            onChangeText={setQuery}
            autoFocus
            selectionColor="#059669"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} style={styles.clearBtn}>
              <Plus size={20} color="#9ca3af" style={{ transform: [{rotate: '45deg'}] }} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Modern Floating Tabs */}
      <View style={styles.tabsWrapper}>
        <View style={styles.tabsContainer}>
          <Pressable style={[styles.tab, activeTab === 'all' && styles.tabActive]} onPress={() => setActiveTab('all')}>
            <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>الكل</Text>
          </Pressable>
          <Pressable style={[styles.tab, activeTab === 'users' && styles.tabActive]} onPress={() => setActiveTab('users')}>
            <Text style={[styles.tabText, activeTab === 'users' && styles.tabTextActive]}>المستخدمين</Text>
          </Pressable>
          <Pressable style={[styles.tab, activeTab === 'questions' && styles.tabActive]} onPress={() => setActiveTab('questions')}>
            <Text style={[styles.tabText, activeTab === 'questions' && styles.tabTextActive]}>أسئلة</Text>
          </Pressable>
          <Pressable style={[styles.tab, activeTab === 'requests' && styles.tabActive]} onPress={() => setActiveTab('requests')}>
            <Text style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>طلبات</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {loading && <ActivityIndicator size="large" color="#059669" style={{ marginTop: 40 }} />}
        
        {!loading && query.length > 0 && (
          <View style={styles.resultsContainer}>
            
            {/* Users Section (Prioritized) */}
            {(activeTab === 'all' || activeTab === 'users') && results.users.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>المستخدمين (الجيران)</Text>
                  <View style={styles.badgeCount}><Text style={styles.badgeText}>{results.users.length}</Text></View>
                </View>
                {results.users.map(renderUser)}
              </View>
            )}

            {/* Questions Section */}
            {(activeTab === 'all' || activeTab === 'questions') && results.questions.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>الأسئلة والنقاشات</Text>
                  <View style={styles.badgeCount}><Text style={styles.badgeText}>{results.questions.length}</Text></View>
                </View>
                {results.questions.map(renderQuestion)}
              </View>
            )}

            {/* Requests Section */}
            {(activeTab === 'all' || activeTab === 'requests') && results.requests.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>طلبات الفزعة</Text>
                  <View style={styles.badgeCount}><Text style={styles.badgeText}>{results.requests.length}</Text></View>
                </View>
                {results.requests.map(renderRequest)}
              </View>
            )}

            {results.users.length === 0 && results.questions.length === 0 && results.requests.length === 0 && (
              <View style={styles.empty}>
                <View style={styles.emptyIconBg}>
                  <SearchIcon size={40} color="#cbd5e1" />
                </View>
                <Text style={styles.emptyText}>لم نجد أي نتائج تطابق "{query}"</Text>
                <Text style={styles.emptySub}>جرب البحث بكلمات مختلفة أو أسماء أخرى</Text>
              </View>
            )}
          </View>
        )}

        {!loading && query.length === 0 && (
          <View style={styles.empty}>
            <View style={styles.emptyIconBg}>
              <SearchIcon size={40} color="#a7f3d0" />
            </View>
            <Text style={styles.emptyText}>ابدأ البحث الآن</Text>
            <Text style={styles.emptySub}>ابحث عن جيرانك، الخدمات، أو أحدث الطلبات في حيك</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    backgroundColor: '#f9fafb',
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 52,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    textAlign: 'right',
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  clearBtn: {
    padding: 4,
  },
  tabsWrapper: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  tabsContainer: {
    flexDirection: 'row-reverse',
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
  },
  tabActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
  },
  tabTextActive: {
    color: '#059669',
    fontWeight: '900',
  },
  content: {
    flex: 1,
  },
  resultsContainer: {
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
    marginLeft: 8,
  },
  badgeCount: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '900',
  },
  userCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f9fafb',
  },
  userInfoLeft: {
    marginLeft: 16,
  },
  userAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  userAvatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  userAvatarLetter: {
    fontSize: 24,
    fontWeight: '900',
    color: '#059669',
  },
  userInfo: {
    flex: 1,
    alignItems: 'flex-end',
    marginRight: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 2,
  },
  userHandle: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '600',
  },
  visitProfileBtn: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  visitProfileText: {
    color: '#059669',
    fontSize: 13,
    fontWeight: '800',
  },
  postCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f9fafb',
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  iconBoxBlue: {
    backgroundColor: '#ecfdf5',
    padding: 12,
    borderRadius: 16,
    marginLeft: 16,
  },
  iconBoxOrange: {
    backgroundColor: '#fff7ed',
    padding: 12,
    borderRadius: 16,
    marginLeft: 16,
  },
  cardHeaderText: {
    flex: 1,
    alignItems: 'flex-end',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'right',
    marginBottom: 4,
  },
  cardAuthor: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9ca3af',
    textAlign: 'right',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 18,
    color: '#111827',
    fontWeight: '900',
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
  }
});
