import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Image, Pressable, RefreshControl, Dimensions, Animated } from 'react-native';
import { supabase } from '@/lib/supabase';
import GlassHeader from '@/components/GlassHeader';
import { ShoppingBag, Star, MapPin, Tag, Utensils, Scissors, Wrench, ShieldCheck, Plus } from 'lucide-react-native';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

const CATEGORIES = [
  { id: 'food', label: 'طبخ منزلي', icon: Utensils, color: '#f97316' },
  { id: 'handmade', label: 'إنتاج أسري', icon: ShoppingBag, color: '#ec4899' },
  { id: 'services', label: 'خدمات وصيانة', icon: Wrench, color: '#0ea5e9' },
  { id: 'beauty', label: 'عناية وتجميل', icon: Scissors, color: '#8b5cf6' },
];

export default function Market() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('food');
  const scrollY = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadMarketItems();
  }, [activeCategory]);

  const loadMarketItems = async () => {
    setRefreshing(true);
    const { data } = await supabase
      .from('services')
      .select(`
        *,
        profiles:provider_id(display_name, avatar_url, is_verified, district)
      `)
      .eq('category', activeCategory)
      .order('created_at', { ascending: false });
    
    setItems(data || []);
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: any }) => (
    <Pressable style={styles.card} onPress={() => {}}>
      <View style={styles.cardImagePlaceholder}>
        <ShoppingBag size={40} color="#cbd5e1" />
      </View>
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.itemTitle}>{item.name}</Text>
          <View style={styles.priceTag}>
            <Text style={styles.priceText}>{item.price_from} ر.س</Text>
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
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginTop: 2 }}>
              <MapPin size={12} color="#94a3b8" />
              <Text style={styles.districtText}>حي {item.profiles?.district || 'غير محدد'}</Text>
              <Text style={styles.ratingText}>• ⭐ 4.9</Text>
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
          <Pressable onPress={() => {}} style={styles.addButton}>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadMarketItems} tintColor="#0891b2" />}
      >
        <Text style={styles.pageSubtitle}>ادعم الأسر المنتجة والمتاجر القريبة في حيك 🏘️</Text>
        
        <View style={styles.categoriesRow}>
          {CATEGORIES.map(cat => (
            <Pressable 
              key={cat.id} 
              style={[styles.categoryPill, activeCategory === cat.id && { backgroundColor: cat.color, borderColor: cat.color }]}
              onPress={() => setActiveCategory(cat.id)}
            >
              <cat.icon size={16} color={activeCategory === cat.id ? '#fff' : cat.color} />
              <Text style={[styles.categoryText, activeCategory === cat.id && { color: '#fff' }]}>{cat.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.listContainer}>
          {items.length > 0 ? (
            items.map(item => (
              <React.Fragment key={item.id}>
                {renderItem({ item })}
              </React.Fragment>
            ))
          ) : (
            <View style={styles.emptyState}>
              <ShoppingBag size={48} color="#cbd5e1" />
              <Text style={styles.emptyText}>لا توجد عروض في هذا القسم حالياً</Text>
            </View>
          )}
        </View>
      </Animated.ScrollView>
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
    paddingBottom: 40,
  },
  addButton: {
    backgroundColor: '#0891b2',
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
