import { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Text, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/ui';
import { ChevronRight, MapPin, Navigation, Radio, Flame, Wrench, AlertTriangle, Sparkles, MessageCircle } from 'lucide-react-native';
import { SAUDI_REGIONS, isInsideSaudiArabia, Region } from '@/lib/saudiLocations';
import L from 'leaflet';

// Strictly Saudi Arabia boundaries
const SAUDI_SOUTH_WEST: [number, number] = [16.0, 34.0];
const SAUDI_NORTH_EAST: [number, number] = [32.5, 56.0];
const RIYADH_CENTER: [number, number] = [24.7136, 46.6753];

type PinCategory = 'all' | 'question' | 'service' | 'road' | 'event' | 'emergency';

interface RadarItem {
  id: string;
  type: PinCategory;
  title: string;
  desc: string;
  city: string;
  district: string;
  lat: number;
  lng: number;
  color: string;
  emoji: string;
  typeLabel: string;
}

function createPinIcon(color: string, emoji: string) {
  return L.divIcon({
    className: 'neighborhood-radar-pin',
    html: `
      <div style="
        background: ${color};
        width: 34px;
        height: 34px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2.5px solid #fff;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        font-size: 15px;
        transform: translate(-50%, -50%);
        transition: transform 0.2s ease;
      ">
        ${emoji}
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
}

export default function WebMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState<string>('all');
  const [selectedPinCategory, setSelectedPinCategory] = useState<PinCategory>('all');
  const [allRadarItems, setAllRadarItems] = useState<RadarItem[]>([]);

  useEffect(() => {
    // Inject Leaflet CSS dynamically
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    if (!mapRef.current) return;

    // Initialize Leaflet map restricted strictly to Saudi Arabia
    if (!mapInstance.current) {
      const map = L.map(mapRef.current, {
        maxBounds: [SAUDI_SOUTH_WEST, SAUDI_NORTH_EAST],
        maxBoundsViscosity: 1.0,
        minZoom: 5,
        maxZoom: 18,
      }).setView(RIYADH_CENTER, 6);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      mapInstance.current = map;
    }

    // Load places and community radar pins strictly inside KSA
    (async () => {
      const { data: businesses } = await supabase
        .from('businesses')
        .select('id,name,description,city,district,latitude,longitude')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .limit(100);

      const items: RadarItem[] = [];

      (businesses ?? []).forEach((b: any) => {
        const lat = Number(b.latitude);
        const lng = Number(b.longitude);
        if (!isNaN(lat) && !isNaN(lng) && isInsideSaudiArabia(lat, lng)) {
          items.push({
            id: `biz-${b.id}`,
            type: 'service',
            title: b.name,
            desc: b.description || 'خدمة ومحل معتمد بالحي',
            city: b.city || 'الرياض',
            district: b.district || 'الحي',
            lat,
            lng,
            color: '#16a34a',
            emoji: '🟢',
            typeLabel: 'عرض خدمة / محل',
          });
        }
      });

      // Add high-impact neighborhood radar items around major Saudi hubs
      const sampleCommunityPins: RadarItem[] = [
        // Riyadh - Al-Yasmin
        {
          id: 'q-yasmin-1',
          type: 'question',
          title: 'استفسار: أفضل دكتور أطفال قريب في الحي؟',
          desc: 'نبحث عن عيادة أطفال موثوقة تستقبل الحالات المسائية.',
          city: 'الرياض',
          district: 'الياسمين',
          lat: 24.8192,
          lng: 46.6433,
          color: '#3b82f6',
          emoji: '🔵',
          typeLabel: 'سؤال استفساري نشط',
        },
        {
          id: 'tool-yasmin-2',
          type: 'service',
          title: 'إعارة دريل تخريم خرسانة وسلّم 4 متر مجاناً',
          desc: 'متوفر للإعارة لجيران الحي، يسعدني تواصلكم.',
          city: 'الرياض',
          district: 'الياسمين',
          lat: 24.8250,
          lng: 46.6480,
          color: '#16a34a',
          emoji: '🟢',
          typeLabel: 'إعارة أدوات من جار',
        },
        {
          id: 'road-yasmin-3',
          type: 'road',
          title: 'تنبيه: أعمال حفريات وصيانة عند تقاطع أنس بن مالك',
          desc: 'يرجى توخي الحذر وسلوك المسار الأيمن تفادياً للازدحام.',
          city: 'الرياض',
          district: 'الياسمين',
          lat: 24.8140,
          lng: 46.6380,
          color: '#eab308',
          emoji: '🟡',
          typeLabel: 'تنبيه طريق وصيانة',
        },
        {
          id: 'event-yasmin-4',
          type: 'event',
          title: 'تجمع مشي رياضي في ممشى حديقة الياسمين',
          desc: 'اليوم بعد صلاة العصر، مبادرة صحية لجيران الحي.',
          city: 'الرياض',
          district: 'الياسمين',
          lat: 24.8210,
          lng: 46.6510,
          color: '#a855f7',
          emoji: '🟣',
          typeLabel: 'فعالية وممشى الحي',
        },
        {
          id: 'sos-yasmin-5',
          type: 'emergency',
          title: '🚨 طارئ: قطة شيرازية بيضاء مفقودة قرب مسجد الحي',
          desc: 'تحمل طوقاً أزرق، يرجى التواصل فوراً لمن يشاهدها.',
          city: 'الرياض',
          district: 'الياسمين',
          lat: 24.8175,
          lng: 46.6420,
          color: '#ef4444',
          emoji: '🔴',
          typeLabel: 'تنبيه طارئ وعاجل',
        },

        // Jeddah - Al-Rawdah
        {
          id: 'q-jed-1',
          type: 'question',
          title: 'استفسار: تجاربكم مع فنيي تكييف بالروضة؟',
          desc: 'أحتاج فني لصيانة مكيفات اسبليت بسعر مناسب.',
          city: 'جدة',
          district: 'الروضة',
          lat: 21.5642,
          lng: 39.1583,
          color: '#3b82f6',
          emoji: '🔵',
          typeLabel: 'سؤال استفساري نشط',
        },
        {
          id: 'event-jed-2',
          type: 'event',
          title: 'بازار الأسر المنتجة ومهرجان الحي بجدة',
          desc: 'جلسات عائلية وعروض متنوعة نهاية الأسبوع.',
          city: 'جدة',
          district: 'الروضة',
          lat: 21.5700,
          lng: 39.1620,
          color: '#a855f7',
          emoji: '🟣',
          typeLabel: 'فعالية وتجمع مجتمعي',
        },

        // Dammam - Al-Faisaliyah
        {
          id: 'sos-dmm-1',
          type: 'emergency',
          title: '🚨 تنبيه: انكسار ماسورة مياه رئيسية بالشارع التجاري',
          desc: 'تم إبلاغ طوارئ المياه وجاري المتابعة.',
          city: 'الدمام',
          district: 'الفيصلية',
          lat: 26.4180,
          lng: 50.0715,
          color: '#ef4444',
          emoji: '🔴',
          typeLabel: 'تنبيه طارئ وعاجل',
        },
      ];

      setAllRadarItems([...items, ...sampleCommunityPins]);
    })();

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // Update markers when category or items change
  useEffect(() => {
    if (!mapInstance.current) return;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const filtered = allRadarItems.filter(item => {
      if (selectedPinCategory === 'all') return true;
      return item.type === selectedPinCategory;
    });

    filtered.forEach(item => {
      const icon = createPinIcon(item.color, item.emoji);
      const marker = L.marker([item.lat, item.lng], { icon }).addTo(mapInstance.current!);

      marker.bindPopup(`
        <div style="text-align: right; font-family: inherit; padding: 6px; min-width: 180px;">
          <div style="display: inline-block; background: ${item.color}20; color: ${item.color}; font-weight: 800; font-size: 11px; padding: 2px 8px; border-radius: 8px; margin-bottom: 6px;">
            ${item.typeLabel}
          </div>
          <strong style="font-size: 15px; color: #0f172a; display: block; margin-bottom: 4px; line-height: 1.3;">${item.title}</strong>
          <div style="color: #0891b2; font-size: 12px; font-weight: 700;">🇸🇦 ${item.city} · حي ${item.district}</div>
          <div style="margin-top: 6px; font-size: 12px; color: #475467; line-height: 1.4;">${item.desc}</div>
        </div>
      `);

      markersRef.current.push(marker);
    });
  }, [allRadarItems, selectedPinCategory]);

  function handleSelectRegion(regionId: string, lat?: number, lng?: number) {
    setSelectedRegionId(regionId);
    if (!mapInstance.current) return;

    if (regionId === 'all') {
      mapInstance.current.flyTo(RIYADH_CENTER, 6, { duration: 1.2 });
    } else if (lat && lng) {
      mapInstance.current.flyTo([lat, lng], 11, { duration: 1.2 });
    }
  }

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <ChevronRight size={26} color={C.ink} />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.title}>رادار دبابيس الحي الحية 🇸🇦</Text>
          <Text style={styles.subtitle}>
            خريطة مجتمعية تفاعلية مصنفة بالألوان لأحياء المملكة
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Pin Type Category Legend Bar */}
      <View style={styles.categoryBarWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
          <Pressable
            style={[styles.catChip, selectedPinCategory === 'all' && styles.catChipActive]}
            onPress={() => setSelectedPinCategory('all')}
          >
            <Text style={[styles.catChipText, selectedPinCategory === 'all' && styles.catChipTextActive]}>
              الكل ({allRadarItems.length})
            </Text>
          </Pressable>

          <Pressable
            style={[styles.catChip, selectedPinCategory === 'question' && styles.catChipActiveBlue]}
            onPress={() => setSelectedPinCategory('question')}
          >
            <Text style={[styles.catChipText, selectedPinCategory === 'question' && styles.catChipTextActive]}>
              🔵 أسئلة استفسارية
            </Text>
          </Pressable>

          <Pressable
            style={[styles.catChip, selectedPinCategory === 'service' && styles.catChipActiveGreen]}
            onPress={() => setSelectedPinCategory('service')}
          >
            <Text style={[styles.catChipText, selectedPinCategory === 'service' && styles.catChipTextActive]}>
              🟢 إعارة وخدمات
            </Text>
          </Pressable>

          <Pressable
            style={[styles.catChip, selectedPinCategory === 'road' && styles.catChipActiveYellow]}
            onPress={() => setSelectedPinCategory('road')}
          >
            <Text style={[styles.catChipText, selectedPinCategory === 'road' && styles.catChipTextActive]}>
              🟡 تنبيهات طريق
            </Text>
          </Pressable>

          <Pressable
            style={[styles.catChip, selectedPinCategory === 'event' && styles.catChipActivePurple]}
            onPress={() => setSelectedPinCategory('event')}
          >
            <Text style={[styles.catChipText, selectedPinCategory === 'event' && styles.catChipTextActive]}>
              🟣 فعاليات وممشى
            </Text>
          </Pressable>

          <Pressable
            style={[styles.catChip, selectedPinCategory === 'emergency' && styles.catChipActiveRed]}
            onPress={() => setSelectedPinCategory('emergency')}
          >
            <Text style={[styles.catChipText, selectedPinCategory === 'emergency' && styles.catChipTextActive]}>
              🔴 تنبيهات طارئة 🚨
            </Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* Horizontal Region Quick Selector */}
      <View style={styles.regionFilterWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.regionScroll}
        >
          <Pressable
            style={[styles.regionChip, selectedRegionId === 'all' && styles.regionChipActive]}
            onPress={() => handleSelectRegion('all')}
          >
            <Text
              style={[
                styles.regionChipText,
                selectedRegionId === 'all' && styles.regionChipTextActive,
              ]}
            >
              🇸🇦 كل مناطق المملكة
            </Text>
          </Pressable>

          {SAUDI_REGIONS.map((reg: Region) => {
            const isActive = selectedRegionId === reg.id;
            return (
              <Pressable
                key={reg.id}
                style={[styles.regionChip, isActive && styles.regionChipActive]}
                onPress={() => handleSelectRegion(reg.id, reg.lat, reg.lng)}
              >
                <MapPin size={13} color={isActive ? '#fff' : '#0891b2'} style={{ marginLeft: 3 }} />
                <Text style={[styles.regionChipText, isActive && styles.regionChipTextActive]}>
                  {reg.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Map Area */}
      <View style={styles.mapContainer}>
        {/* @ts-ignore */}
        <div ref={mapRef} style={{ width: '100%', height: '100%', zIndex: 0 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  iconBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
    color: C.ink,
  },
  subtitle: {
    fontSize: 11,
    color: '#0891b2',
    fontWeight: '700',
    marginTop: 2,
  },
  categoryBarWrap: {
    backgroundColor: '#f8fafc',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  categoryScroll: {
    flexDirection: 'row-reverse',
    paddingHorizontal: 14,
    gap: 6,
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  catChipActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  catChipActiveBlue: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  catChipActiveGreen: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  catChipActiveYellow: {
    backgroundColor: '#ca8a04',
    borderColor: '#ca8a04',
  },
  catChipActivePurple: {
    backgroundColor: '#9333ea',
    borderColor: '#9333ea',
  },
  catChipActiveRed: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  catChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  catChipTextActive: {
    color: '#fff',
  },
  regionFilterWrap: {
    backgroundColor: '#fff',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  regionScroll: {
    flexDirection: 'row-reverse',
    paddingHorizontal: 14,
    gap: 8,
  },
  regionChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#ecfeff',
    borderWidth: 1,
    borderColor: '#a5f3fc',
  },
  regionChipActive: {
    backgroundColor: '#0891b2',
    borderColor: '#0891b2',
  },
  regionChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0891b2',
  },
  regionChipTextActive: {
    color: '#fff',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
});
