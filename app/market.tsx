import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, Pressable, RefreshControl, TextInput } from 'react-native';
import { supabase } from '@/lib/supabase';
import GlassHeader from '@/components/GlassHeader';
import BottomNav from '@/components/BottomNav';
import { ShoppingBag, MapPin, ShieldCheck, Plus, Search, Sparkles, SlidersHorizontal, Clock3, ChevronLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import {
  getActiveLocation,
  subscribeLocation,
  isExactDistrictMatching,
  isAllKingdom,
} from '@/lib/locationSync';

export default function Market() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('الكل');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLoc, setActiveLoc] = useState({
    region: 'كل المملكة',
    city: 'كل المدن',
    district: 'كل الأحياء',
  });
  const scrollY = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    getActiveLocation().then(setActiveLoc);
    const unsub = subscribeLocation(setActiveLoc);
    return unsub;
  }, []);

  useEffect(() => { loadMarketItems(); }, []);

  const loadMarketItems = async () => {
    setRefreshing(true);
    const { data } = await supabase
      .from('services')
      .select(`
        *,
        profiles:provider_id(display_name, avatar_url, is_verified, district)
      `)
      .order('created_at', { ascending: false });
    
    setItems(data || []);
    setRefreshing(false);
  };

  const availableCategories = ['الكل', ...Array.from(new Set(items.map((item) => item.category).filter(Boolean)))];
  const displayedItems = items.filter((item) => {
    const locItem = {
      city: item.city || item.profiles?.city || null,
      district: item.district || item.profiles?.district || null,
    };
    const matchesLocation = isExactDistrictMatching(locItem, activeLoc.city, activeLoc.district);
    const matchesCategory = activeCategory === 'الكل' || item.category === activeCategory;
    const query = searchQuery.trim().toLocaleLowerCase('ar');
    const matchesSearch = !query || [item.name, item.description, item.category, item.profiles?.display_name, item.district]
      .some((value) => String(value || '').toLocaleLowerCase('ar').includes(query));
    return matchesLocation && matchesCategory && matchesSearch;
  });

  const renderItem = ({ item }: { item: any }) => (
    <Pressable
      style={styles.card}
      onPress={() => router.push({ pathname: '/service', params: { id: item.id } })}
    >
      <View style={styles.cardImagePlaceholder}>
        <View style={styles.cardArt}><Sparkles size={26} color="#059669" /><Text style={styles.cardArtLabel}>{item.category || 'خدمة محلية'}</Text></View>
        {item.available_now && <View style={styles.availableBadge}><View style={styles.availableDot} /><Text style={styles.availableText}>متاح الآن</Text></View>}
      </View>
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.itemTitle}>{item.name}</Text>
          <View style={styles.priceTag}>
          <Text style={styles.priceText}>{item.price_from != null ? `${item.price_from} ر.س` : 'حسب الاتفاق'}</Text>
          </View>
        </View>
        <Text style={styles.itemDesc} numberOfLines={2}>{item.description}</Text>
        
        <View style={styles.providerInfo}>
          {item.profiles?.avatar_url ? (
            <Image source={{ uri: item.profiles.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarLetter}>{item.profiles?.display_name?.[0] || 'ح'}</Text>
            </View>
          )}
          <View style={styles.providerMeta}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
              <Text style={styles.providerName}>{item.profiles?.display_name || 'بائع غير معروف'}</Text>
              {item.profiles?.is_verified && <ShieldCheck size={14} color="#10b981" style={{ marginRight: 4 }} />}
            </View>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginTop: 3 }}>
              <MapPin size={12} color="#94a3b8" />
              <Text style={styles.districtText}>{item.city || item.profiles?.city || 'داخل الحي'}{(item.district || item.profiles?.district) ? ` · حي ${item.district || item.profiles?.district}` : ''}</Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <GlassHeader 
        title="سوق الحي المصغر" 
        rightComponent={
          <Pressable onPress={() => router.push('/new-service')} style={styles.addButton}>
            <Plus size={20} color="#fff" />
          </Pressable>
        }
      />
      
      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadMarketItems} tintColor="#059669" />}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTop}><View style={styles.heroIcon}><ShoppingBag size={24} color="#d1fae5" /></View><Text style={styles.heroEyebrow}>سوق الجيران</Text></View>
          <Text style={styles.heroTitle}>كل ما تحتاجه،{`\n`}من أهل حيك</Text>
          <Text style={styles.heroSubtitle}>اكتشف خدمات ومنتجات محلية وادعم أصحاب المشاريع القريبة.</Text>
          <View style={styles.heroStats}><View><Text style={styles.statValue}>{displayedItems.length}</Text><Text style={styles.statLabel}>عرض متاح</Text></View><View style={styles.statDivider} /><View><Text style={styles.statValue}>{activeLoc.city}</Text><Text style={styles.statLabel}>نطاق التصفح</Text></View></View>
          <View style={styles.heroDecor}><Sparkles size={76} color="rgba(255,255,255,0.10)" /></View>
        </View>
        
        {/* Active location tag */}
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
          <View style={{
            flexDirection: 'row-reverse',
            alignItems: 'center',
            gap: 4,
            backgroundColor: '#ecfdf5',
            paddingHorizontal: 12,
            paddingVertical: 5,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: '#a7f3d0',
          }}>
            <MapPin size={13} color="#059669" />
            <Text style={{ color: '#059669', fontSize: 12, fontWeight: '800' }}>
              {isAllKingdom(activeLoc.city)
                ? 'كل مناطق المملكة 🇸🇦'
                : `${activeLoc.city}${activeLoc.district && activeLoc.district !== 'كل الأحياء' ? ` · حي ${activeLoc.district}` : ''}`}
            </Text>
          </View>
        </View>

        <View style={styles.searchBox}><Search size={19} color="#94a3b8" /><TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="ابحث عن خدمة أو منتج..." placeholderTextColor="#94a3b8" style={styles.searchInput} textAlign="right" /></View>
        <View style={styles.sectionHeading}><View><Text style={styles.sectionTitle}>تصفّح السوق</Text><Text style={styles.sectionHint}>اختر القسم المناسب لك</Text></View><SlidersHorizontal size={18} color="#64748b" /></View>
        <View style={styles.categoriesRow}>
          {availableCategories.map((category) => (
            <Pressable 
              key={category} 
              style={[styles.categoryPill, activeCategory === category && styles.categoryPillActive]}
              onPress={() => setActiveCategory(category)}
            >
              <Text style={[styles.categoryText, activeCategory === category && { color: '#fff' }]}>{category}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.listContainer}>
          <View style={styles.resultsHeader}><Text style={styles.resultCount}>{displayedItems.length} نتيجة</Text><View style={styles.latestLabel}><Clock3 size={13} color="#64748b" /><Text style={styles.latestText}>الأحدث</Text></View></View>
          {displayedItems.length > 0 ? (
            displayedItems.map(item => (
              <React.Fragment key={item.id}>
                {renderItem({ item })}
              </React.Fragment>
            ))
          ) : (
            <View style={styles.emptyState}>
              <ShoppingBag size={48} color="#cbd5e1" />
              <Text style={styles.emptyText}>
                {!isAllKingdom(activeLoc.city)
                  ? `لا توجد خدمات متاحة حالياً في ${activeLoc.city}${activeLoc.district !== 'كل الأحياء' ? ` (حي ${activeLoc.district})` : ''}`
                  : 'لا توجد عروض في هذا القسم حالياً'}
              </Text>
            </View>
          )}
        </View>
      </Animated.ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNavWrapper}>
        <BottomNav />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 100, // accommodate GlassHeader
    paddingHorizontal: 16,
    paddingBottom: 110,
  },
  bottomNavWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  addButton: {
    backgroundColor: '#059669',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageSubtitle: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'right',
    marginBottom: 20,
    fontWeight: '500',
  },
  categoriesRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  categoryPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  listContainer: {
    gap: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 3,
  },
  cardImagePlaceholder: {
    height: 140,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  itemTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    flex: 1,
    textAlign: 'right',
  },
  priceTag: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 10,
  },
  priceText: {
    color: '#10b981',
    fontWeight: '700',
    fontSize: 13,
  },
  itemDesc: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'right',
    lineHeight: 20,
    marginBottom: 16,
  },
  providerInfo: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginLeft: 10,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  avatarLetter: {
    fontSize: 16,
    fontWeight: '800',
    color: '#64748b',
  },
  providerMeta: {
    flex: 1,
    alignItems: 'flex-start',
  },
  providerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  districtText: {
    fontSize: 12,
    color: '#94a3b8',
    marginRight: 4,
  },
  ratingText: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '600',
    marginRight: 6,
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 15,
    color: '#94a3b8',
    fontWeight: '500',
  }
});
