import { OasisPressable as Pressable, OasisTextInput as TextInput, OasisSurface } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { BadgeCheck, Briefcase, CreditCard, Crown, Megaphone, RefreshCw, ShieldCheck, ShoppingBag, Star } from 'lucide-react-native';
import { AppHeader } from '@/components/shared/AppHeader';
import { useBottomNavInset } from '@/lib/bottomNav';
import { supabase } from '@/lib/supabase';

type Plan = { id: string; slug: string; name: string; description: string; price_halalas: number; period_days: number; features: string[] };
type AdPackage = { id: string; slug: string; name: string; description: string; price_halalas: number; duration_days: number };
type Service = { id: string; name: string; description?: string; price_from: number | null; price_type?: string; provider_id: string; city?: string; district?: string };
type Order = { id: string; order_type: string; status: string; amount_halalas: number; created_at: string; checkout_url?: string | null };

const money = (halalas: number) => new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 2 }).format(halalas / 100);
const statusLabel: Record<string, string> = {
  pending: 'بانتظار الدفع', paid: 'مدفوع', failed: 'فشل الدفع', cancelled: 'ملغي', refunded: 'مسترد', expired: 'منتهي',
  pending_payment: 'بانتظار الدفع', active: 'نشط', past_due: 'متأخر', expired_subscription: 'منتهي',
  pending_review: 'بانتظار مراجعة الإعلان', accepted: 'مقبول', in_progress: 'قيد التنفيذ', completed: 'مكتمل',
};

export default function MarketplaceDashboard() {
  const bottomInset = useBottomNavInset();
  const params = useLocalSearchParams<{ service_id?: string; payment?: string }>();
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState<'plans' | 'ads' | 'orders'>('plans');
  const [myServices, setMyServices] = useState<Service[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [packages, setPackages] = useState<AdPackage[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [subscription, setSubscription] = useState<any>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string>(params.service_id || '');
  const [adTitle, setAdTitle] = useState('');
  const [adDescription, setAdDescription] = useState('');
  const [busyId, setBusyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setUserId(null);
      router.replace('/auth');
      setLoading(false);
      return;
    }
    setUserId(auth.user.id);
    const { data: ownProfile } = await supabase.from('profiles').select('role').eq('id', auth.user.id).maybeSingle();
    setIsAdmin(ownProfile?.role === 'admin');
    const [myServicesRes, plansRes, packagesRes, ordersRes, subscriptionRes] = await Promise.all([
      supabase.from('services').select('id,name,description,price_from,price_type,provider_id,city,district')
        .eq('provider_id', auth.user.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('marketplace_plans').select('id,slug,name,description,price_halalas,period_days,features')
        .eq('active', true).order('sort_order'),
      supabase.from('marketplace_ad_packages').select('id,slug,name,description,price_halalas,duration_days')
        .eq('active', true).order('sort_order'),
      supabase.from('marketplace_orders').select('id,order_type,status,amount_halalas,created_at,checkout_url')
        .eq('user_id', auth.user.id).order('created_at', { ascending: false }).limit(30),
      supabase.from('marketplace_subscriptions').select('id,status,current_period_end,plan:marketplace_plans(name,slug)')
        .eq('user_id', auth.user.id).eq('status', 'active').order('current_period_end', { ascending: false }).limit(1).maybeSingle(),
    ]);
    setMyServices(myServicesRes.data || []);
    setPlans(plansRes.data || []);
    setPackages(packagesRes.data || []);
    setOrders(ordersRes.data || []);
    setSubscription(subscriptionRes.data || null);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (params.payment === 'success') Alert.alert('تمت العودة من الدفع', 'سيظهر الطلب مدفوعًا بعد تأكيد بوابة الدفع. اسحب للتحديث إذا لزم الأمر.');
  }, [params.payment]);


  async function checkout(body: Record<string, unknown>, key: string) {
    if (!userId || busyId) return;
    setBusyId(key);
    try {
      const { data, error } = await supabase.functions.invoke('create-marketplace-checkout', {
        body: { ...body, request_id: `${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` },
      });
      if (error) throw new Error(data?.error || error.message || 'تعذر الاتصال بخدمة الدفع.');
      if (data?.error) throw new Error(data.error);
      if (data?.checkout_url) {
        await Linking.openURL(data.checkout_url);
        Alert.alert('تم تجهيز الدفع', 'أكمل الدفع في صفحة بوابة الدفع. سيُحدّث النظام الحالة بعد تأكيدها من الخادم.');
      } else if (data?.status === 'paid') {
        Alert.alert('تم الدفع مسبقًا', 'هذه العملية مسجلة كمدفوعة.');
      } else {
        throw new Error('لم تُرجع بوابة الدفع رابط إكمال العملية.');
      }
      await load();
    } catch (error: any) {
      Alert.alert('تعذر إكمال العملية', error?.message || 'تحقق من اتصالك وإعدادات الدفع.');
    } finally {
      setBusyId('');
    }
  }

  async function createAd(pkg: AdPackage) {
    const selected = myServices.find(s => s.id === selectedServiceId);
    const title = adTitle.trim() || selected?.name || '';
    if (!title) return Alert.alert('عنوان الإعلان مطلوب', 'اكتب عنوان الإعلان أو اختر أحد عروضك.');
    await checkout({
      kind: 'ad_campaign', package_slug: pkg.slug, service_id: selectedServiceId || undefined,
      title, description: adDescription.trim(),
    }, `ad-${pkg.slug}`);
  }

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator size="large" color={OASIS.colors.primary} /><Text style={styles.muted}>نجهز المزايا التجارية والمدفوعات…</Text></View>;

  return (
    <View style={styles.root}>
      <AppHeader variant="sub" title="المزايا التجارية" subtitle="الاشتراكات · الترويج · المدفوعات" fallbackRoute="/profile?tab=content" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset + 28 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={OASIS.colors.primary} />}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}><ShoppingBag size={26} color={OASIS.colors.surface} /></View>
          <Text style={styles.heroTitle}>مزايا الحساب المهني</Text>
          <Text style={styles.heroText}>الاشتراكات والترويج وسجل المدفوعات في مكان واحد. استكشاف المنتجات والخدمات يبقى في سوق حيّنا.</Text>
          <View style={styles.secureLine}><ShieldCheck size={15} color="#a7f3d0" /><Text style={styles.secureText}>دفع مستضاف وآمن · لا نخزن بيانات البطاقات</Text></View>
        </View>

        {isAdmin && (
          <Pressable oasisKind="action" onPress={() => router.push('/admin-marketplace')} style={styles.adminButton}>
            <ShieldCheck size={17} color={OASIS.colors.surface} />
            <Text style={styles.primaryButtonText}>مراجعة الإعلانات المدفوعة (الإدارة)</Text>
          </Pressable>
        )}

        {subscription && (
          <View style={styles.activePlan}>
            <View style={styles.planIcon}><Crown size={20} color={OASIS.colors.primary} /></View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={styles.activePlanTitle}>اشتراكك الحالي: {subscription.plan?.name || 'احترافي'}</Text>
              <Text style={styles.muted}>ينتهي في {subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString('ar-SA') : '—'}</Text>
            </View>
            <BadgeCheck size={22} color={OASIS.colors.primary} />
          </View>
        )}

        <View style={styles.tabs}>
          {([
            ['plans', 'الاشتراكات', Crown],
            ['ads', 'الترويج', Megaphone],
            ['orders', 'طلباتي', CreditCard],
          ] as const).map(([id, label, Icon]) => (
            <Pressable oasisVariant={tab === id ? 'primary' : 'secondary'} oasisKind="chip" key={id} onPress={() => setTab(id)} style={[styles.tab, tab === id && styles.tabActive]}>
              <Icon size={16} color={tab === id ? OASIS.colors.surface : OASIS.colors.muted} />
              <Text style={[styles.tabText, tab === id && styles.tabTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {tab === 'plans' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>باقات مقدمي الخدمات</Text>
            <Text style={styles.muted}>تفعيل المزايا يتم بعد تأكيد الدفع من الخادم. التجديد التلقائي غير مفعل حتى يتم ربط منتج recurring لدى مزود الدفع.</Text>
            {plans.map(plan => (
              <OasisSurface oasisSurface="card" key={plan.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.pricePill}><Text style={styles.priceText}>{plan.price_halalas === 0 ? 'مجانية' : money(plan.price_halalas)}</Text></View>
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={styles.cardTitle}>{plan.name}</Text>
                    <Text style={styles.muted}>{plan.period_days} يومًا</Text>
                  </View>
                  <View style={styles.smallIcon}><Crown size={19} color={OASIS.colors.primary} /></View>
                </View>
                <Text style={styles.description}>{plan.description}</Text>
                {(plan.features || []).map((feature, i) => <Text key={i} style={styles.feature}>✓  {feature}</Text>)}
                {plan.price_halalas > 0 && <Pressable oasisVariant="primary" oasisKind="action" disabled={!!busyId} style={[styles.primaryButton, !!busyId && styles.disabled]} onPress={() => void checkout({ kind: 'subscription', plan_slug: plan.slug }, `plan-${plan.slug}`)}>
                  {busyId === `plan-${plan.slug}` ? <ActivityIndicator color={OASIS.colors.surface} /> : <Crown size={17} color={OASIS.colors.surface} />}
                  <Text style={styles.primaryButtonText}>اشترك الآن</Text>
                </Pressable>}
              </OasisSurface>
            ))}
          </View>
        )}

        {tab === 'ads' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>الإعلانات والترويج المدفوع</Text>
            <Text style={styles.muted}>تُراجع الإعلانات بعد الدفع ولا تظهر تلقائيًا قبل الموافقة.</Text>
            <OasisSurface oasisSurface="card" style={styles.card}>
              <Text style={styles.fieldLabel}>اختر عرضًا تملكه (اختياري)</Text>
              <View style={styles.choiceWrap}>
                <Pressable onPress={() => setSelectedServiceId('')} style={[styles.choice, !selectedServiceId && styles.choiceActive]}><Text style={[styles.choiceText, !selectedServiceId && styles.choiceTextActive]}>إعلان عام</Text></Pressable>
                {myServices.map(s => <Pressable key={s.id} onPress={() => { setSelectedServiceId(s.id); if (!adTitle.trim()) setAdTitle(s.name); }} style={[styles.choice, selectedServiceId === s.id && styles.choiceActive]}><Text style={[styles.choiceText, selectedServiceId === s.id && styles.choiceTextActive]}>{s.name}</Text></Pressable>)}
              </View>
              <Text style={styles.fieldLabel}>عنوان الإعلان</Text>
              <TextInput value={adTitle} onChangeText={setAdTitle} placeholder="مثال: خصم خاص لسكان الحي" placeholderTextColor="#94a3b8" style={styles.input} textAlign="right" maxLength={100} />
              <Text style={styles.fieldLabel}>وصف الإعلان (اختياري)</Text>
              <TextInput value={adDescription} onChangeText={setAdDescription} placeholder="اكتب تفاصيل العرض" placeholderTextColor="#94a3b8" style={[styles.input, styles.multiline]} textAlign="right" multiline maxLength={1000} />
            </OasisSurface>
            {packages.map(pkg => (
              <OasisSurface oasisSurface="card" key={pkg.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.pricePill}><Text style={styles.priceText}>{money(pkg.price_halalas)}</Text></View>
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={styles.cardTitle}>{pkg.name}</Text>
                    <Text style={styles.muted}>{pkg.duration_days} يومًا</Text>
                  </View>
                  <View style={styles.smallIcon}><Megaphone size={19} color={OASIS.colors.primary} /></View>
                </View>
                <Text style={styles.description}>{pkg.description}</Text>
                <Pressable oasisVariant="primary" oasisKind="action" disabled={!!busyId} style={[styles.primaryButton, !!busyId && styles.disabled]} onPress={() => void createAd(pkg)}>
                  {busyId === `ad-${pkg.slug}` ? <ActivityIndicator color={OASIS.colors.surface} /> : <Star size={17} color={OASIS.colors.surface} />}
                  <Text style={styles.primaryButtonText}>روّج بهذا العرض</Text>
                </Pressable>
              </OasisSurface>
            ))}
          </View>
        )}

        {tab === 'orders' && (
          <View style={styles.section}>
            <View style={styles.rowTitle}>
              <Text style={styles.sectionTitle}>سجل الطلبات والمدفوعات</Text>
              <Pressable onPress={() => void refresh()}><RefreshCw size={18} color={OASIS.colors.primary} /></Pressable>
            </View>
            {orders.length === 0 ? <Empty text="لا توجد عمليات بعد. ستظهر هنا الاشتراكات وطلبات الخدمات وحملات الترويج." /> : orders.map(order => (
              <View key={order.id} style={styles.orderRow}>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={styles.cardTitle}>{order.order_type === 'subscription' ? 'اشتراك' : order.order_type === 'ad_campaign' ? 'ترويج إعلان' : 'طلب خدمة'}</Text>
                  <Text style={styles.muted}>{new Date(order.created_at).toLocaleString('ar-SA')}</Text>
                  <Text style={styles.status}>{statusLabel[order.status] || order.status}</Text>
                </View>
                <Text style={styles.priceText}>{money(order.amount_halalas)}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.notice}>
          <ShieldCheck size={19} color={OASIS.colors.primary} />
          <Text style={styles.noticeText}>لا تُفعّل الاشتراكات ولا تُعتمد الطلبات من رابط الرجوع فقط؛ يعتمد النظام على إشعار موثّق من بوابة الدفع والتحقق من الفاتورة على الخادم.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return <View style={styles.empty}><ShoppingBag size={26} color="#94a3b8" /><Text style={styles.muted}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: OASIS.colors.background },
  content: { padding: 14, gap: 14, maxWidth: 920, width: '100%', alignSelf: 'center' },
  hero: { backgroundColor: OASIS.colors.deep, borderRadius: 14, padding: 14, alignItems: 'flex-end', gap: 8 },
  heroIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: OASIS.colors.primary, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end' },
  heroTitle: { color: OASIS.colors.surface, fontSize: 22, fontWeight: '700', textAlign: 'right' },
  heroText: { color: OASIS.colors.soft, fontSize: 13, lineHeight: 21, textAlign: 'right' },
  secureLine: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginTop: 4 },
  secureText: { color: '#a7f3d0', fontSize: 11, fontWeight: '700' },
  adminButton: { backgroundColor: '#7c3aed', borderRadius: 13, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8 },
  activePlan: { backgroundColor: OASIS.colors.soft, borderColor: '#a7f3d0', borderWidth: 1, borderRadius: 17, padding: 14, flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  planIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: OASIS.colors.soft, alignItems: 'center', justifyContent: 'center' },
  activePlanTitle: { color: OASIS.colors.deep, fontWeight: '700', fontSize: 14, textAlign: 'right' },
  tabs: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 7, backgroundColor: OASIS.colors.line, padding: 5, borderRadius: 16 },
  tab: { flexGrow: 1, minWidth: '22%', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', gap: 5, flexDirection: 'row-reverse' },
  tabActive: { backgroundColor: OASIS.colors.primary },
  tabText: { color: OASIS.colors.muted, fontSize: 11.5, fontWeight: '600' },
  tabTextActive: { color: OASIS.colors.surface },
  section: { gap: 12 },
  sectionTitle: { color: OASIS.colors.ink, fontSize: 17, fontWeight: '700', textAlign: 'right' },
  card: { backgroundColor: OASIS.colors.surface, borderRadius: 14, padding: 15, borderWidth: 1, borderColor: OASIS.colors.line, gap: 10 },
  cardTop: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  smallIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: OASIS.colors.soft, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: OASIS.colors.ink, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  muted: { color: OASIS.colors.muted, fontSize: 11.5, lineHeight: 18, textAlign: 'right' },
  pricePill: { backgroundColor: OASIS.colors.soft, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  priceText: { color: OASIS.colors.primary, fontSize: 13, fontWeight: '700' },
  description: { color: OASIS.colors.muted, fontSize: 12, lineHeight: 19, textAlign: 'right' },
  feature: { color: OASIS.colors.ink, fontSize: 12, textAlign: 'right' },
  primaryButton: { backgroundColor: OASIS.colors.primary, borderRadius: 13, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryButtonText: { color: OASIS.colors.surface, fontSize: 13, fontWeight: '700' },
  disabled: { opacity: 0.55 },
  fieldLabel: { color: OASIS.colors.ink, fontSize: 12, fontWeight: '600', textAlign: 'right' },
  input: { borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: OASIS.colors.background, borderRadius: 12, padding: 12, color: OASIS.colors.ink, fontSize: 13, minHeight: 44 },
  multiline: { minHeight: 82, textAlignVertical: 'top' },
  choiceWrap: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 7 },
  choice: { borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: OASIS.colors.background, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 11 },
  choiceActive: { backgroundColor: OASIS.colors.soft, borderColor: OASIS.colors.primary },
  choiceText: { color: OASIS.colors.muted, fontSize: 11.5, fontWeight: '700' },
  choiceTextActive: { color: OASIS.colors.deep },
  orderRow: { backgroundColor: OASIS.colors.surface, borderWidth: 1, borderColor: OASIS.colors.line, borderRadius: 15, padding: 13, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  status: { color: OASIS.colors.primary, fontSize: 11, fontWeight: '600', textAlign: 'right', marginTop: 3 },
  rowTitle: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  empty: { backgroundColor: OASIS.colors.surface, borderWidth: 1, borderColor: OASIS.colors.line, borderRadius: 16, padding: 16, alignItems: 'center', gap: 12 },
  notice: { backgroundColor: OASIS.colors.soft, borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 15, padding: 13, flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 9 },
  noticeText: { flex: 1, color: '#166534', fontSize: 11.5, lineHeight: 18, textAlign: 'right' },
});
