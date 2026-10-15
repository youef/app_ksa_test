import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { AppHeader } from '@/components/shared/AppHeader';
import { useBottomNavInset } from '@/lib/bottomNav';
import { supabase } from '@/lib/supabase';
import { BadgeCheck, BriefcaseBusiness, Check, ChevronLeft, CircleHelp, FileCheck2, ShieldCheck, Store, UserRound, Wrench, Clock3, XCircle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

type AccountKind = 'standard' | 'merchant' | 'freelance' | 'provider';
type VerificationRequest = { id: string; status: string | null; subject: string | null; verification_type: string | null; note: string | null; created_at: string; reviewed_at: string | null };
const TYPES: { key: AccountKind; label: string; short: string; description: string; icon: any; tint: string; iconColor: string; requirements: string }[] = [
  { key: 'standard', label: 'مستخدم عادي', short: 'مجتمع الحي', description: 'للتواصل مع الجيران، حفظ العناصر، والمشاركة في مجتمعك.', icon: UserRound, tint: '#F1F5F9', iconColor: '#475569', requirements: 'لا يتطلب مستندات إضافية.' },
  { key: 'merchant', label: 'تاجر أو منشأة', short: 'نشاط تجاري', description: 'لعرض المنتجات أو المتجر وبناء حضور موثوق داخل الحي.', icon: Store, tint: '#ECFDF5', iconColor: '#047857', requirements: 'أضف اسم النشاط ورابط مستند أو شهادة عند توفرها.' },
  { key: 'freelance', label: 'عمل حر', short: 'مستقل موثوق', description: 'لأصحاب المهن والأعمال الحرة الراغبين في عرض خبراتهم.', icon: BriefcaseBusiness, tint: '#EFF6FF', iconColor: '#2563EB', requirements: 'أضف تخصصك ورابط وثيقة العمل الحر إن وجدت.' },
  { key: 'provider', label: 'مقدم خدمة', short: 'خدمات الحي', description: 'لتقديم الخدمات المهنية والمساعدة لسكان منطقتك.', icon: Wrench, tint: '#F5F3FF', iconColor: '#7C3AED', requirements: 'اكتب الخدمة التي تقدمها وأرفق ما يدعم الطلب إن توفر.' },
];

function requestLabel(status?: string | null) {
  const s = (status || 'pending').toLowerCase();
  if (['approved', 'accepted', 'verified', 'completed'].includes(s)) return { label: 'تمت الموافقة', color: '#047857', bg: '#D1FAE5', icon: Check };
  if (['rejected', 'declined', 'denied'].includes(s)) return { label: 'يحتاج إلى تعديل', color: '#B91C1C', bg: '#FEE2E2', icon: XCircle };
  if (['reviewing', 'in_review', 'under_review', 'processing'].includes(s)) return { label: 'قيد المراجعة', color: '#1D4ED8', bg: '#DBEAFE', icon: Clock3 };
  return { label: 'بانتظار المراجعة', color: '#92400E', bg: '#FEF3C7', icon: Clock3 };
}

export default function AccountTypeScreen() {
  const bottomNavInset = useBottomNavInset();
  const [type, setType] = useState<AccountKind>('standard');
  const [currentType, setCurrentType] = useState<AccountKind>('standard');
  const [trade, setTrade] = useState('');
  const [certUrl, setCertUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth.user) { router.replace('/auth'); return; }
      setUserId(auth.user.id);
      const [profileRes, requestRes] = await Promise.all([
        supabase.from('profiles').select('account_type,freelance_trade').eq('id', auth.user.id).maybeSingle(),
        supabase.from('verification_requests').select('id,status,subject,verification_type,note,created_at,reviewed_at').eq('user_id', auth.user.id).order('created_at', { ascending: false }).limit(10),
      ]);
      if (profileRes.error) throw profileRes.error;
      if (requestRes.error) throw requestRes.error;
      const savedType = (profileRes.data?.account_type || 'standard') as AccountKind;
      setCurrentType(savedType);
      setType(savedType);
      setTrade(profileRes.data?.freelance_trade || '');
      setRequests((requestRes.data || []) as VerificationRequest[]);
    } catch (e) {
      Alert.alert('تعذّر تحميل بيانات الحساب', e instanceof Error ? e.message : 'حاول مرة أخرى.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    if (!userId) { router.replace('/auth'); return; }
    if (type !== 'standard' && trade.trim().length < 2) {
      Alert.alert('أكمل بيانات النشاط', 'اكتب اسم النشاط أو تخصصك حتى يتمكن فريق المراجعة من فهم طلبك.');
      return;
    }
    setSaving(true);
    try {
      if (type === 'standard') {
        const { error } = await supabase.from('profiles').update({ account_type: 'standard', freelance_trade: null }).eq('id', userId);
        if (error) throw error;
        setCurrentType('standard');
        setType('standard');
        Alert.alert('تم تحديث الحساب', 'تم اختيار نوع الحساب العادي.');
        await load();
        return;
      }
      const latestPending = requests.find((r) => {
        const s = (r.status || 'pending').toLowerCase();
        return !['approved','accepted','verified','completed','rejected','declined','denied'].includes(s);
      });
      if (latestPending && (latestPending.subject === type || latestPending.verification_type === type || latestPending.note === trade.trim())) {
        Alert.alert('لديك طلب قائم', 'يوجد طلب توثيق سابق قيد المراجعة. يمكنك متابعة حالته أدناه بدلًا من إرسال طلب مكرر.');
        return;
      }
      const { error } = await supabase.from('verification_requests').insert({
        user_id: userId,
        verification_type: type === 'freelance' ? 'freelance' : 'business',
        note: trade.trim(),
        subject: type,
        attachment_url: certUrl.trim() || null,
      });
      if (error) throw error;
      Alert.alert('تم إرسال طلب التوثيق', 'سيبقى نوع حسابك الحالي كما هو حتى يراجع الفريق الطلب ويعتمده.');
      setCertUrl('');
      await load();
    } catch (e) {
      Alert.alert('تعذّر حفظ الطلب', e instanceof Error ? e.message : 'تحقق من البيانات وحاول مرة أخرى.');
    } finally { setSaving(false); }
  };

  const selected = TYPES.find((t) => t.key === type) || TYPES[0];

  return (
    <View style={styles.screen}>
      <AppHeader variant="sub" title="نوع الحساب والتوثيق" subtitle="اختر الصفة المناسبة لنشاطك" fallbackRoute="/more" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: bottomNavInset + 30 }]}>
        <LinearGradient colors={['#0B2E28','#087F5B','#0F9F78']} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.hero}>
          <View style={styles.heroTop}><View style={styles.heroIcon}><ShieldCheck size={26} color="#D1FAE5"/></View><View style={styles.verifiedPill}><BadgeCheck size={13} color="#A7F3D0"/><Text style={styles.verifiedPillText}>توثيق بمراجعة بشرية</Text></View></View>
          <Text style={styles.heroTitle}>عرّف المجتمع بنشاطك</Text>
          <Text style={styles.heroDesc}>اختر نوع الحساب الذي يناسبك. طلب التوثيق لا يعني اعتماد الحساب مباشرة؛ تتم مراجعة الطلب أولًا حفاظًا على ثقة المجتمع.</Text>
          <View style={styles.heroSteps}><Step n="١" label="اختر النوع"/><View style={styles.stepLine}/><Step n="٢" label="أكمل البيانات"/><View style={styles.stepLine}/><Step n="٣" label="انتظر المراجعة"/></View>
        </LinearGradient>

        {loading ? <View style={styles.loading}><ActivityIndicator size="large" color="#087F5B"/><Text style={styles.loadingText}>جارٍ تحميل بيانات حسابك...</Text></View> : <>
          <View style={styles.currentCard}>
            <View style={styles.currentIcon}><BadgeCheck size={20} color="#047857"/></View>
            <View style={{flex:1,gap:3}}><Text style={styles.currentLabel}>نوع حسابك الحالي</Text><Text style={styles.currentValue}>{TYPES.find((t)=>t.key===currentType)?.label || 'مستخدم عادي'}</Text></View>
            <View style={styles.currentPill}><Check size={12} color="#047857"/><Text style={styles.currentPillText}>نشط</Text></View>
          </View>

          <View style={styles.sectionHead}><Text style={styles.sectionTitle}>اختر نوع الحساب</Text><Text style={styles.sectionSub}>يمكنك تغيير اختيارك قبل الإرسال.</Text></View>
          <View style={styles.typesWrap}>
            {TYPES.map((item) => {
              const Icon = item.icon;
              const active = type === item.key;
              return <Pressable key={item.key} onPress={() => setType(item.key)} style={[styles.typeCard, active && styles.typeCardActive]}>
                <View style={styles.typeTop}><View style={[styles.typeIcon,{backgroundColor:item.tint}]}><Icon size={22} color={item.iconColor}/></View>{active ? <View style={styles.selectedBadge}><Check size={13} color="#fff"/></View> : <View style={styles.unselectedCircle}/>}</View>
                <Text style={styles.typeLabel}>{item.label}</Text><Text style={styles.typeShort}>{item.short}</Text><Text style={styles.typeDesc}>{item.description}</Text>
                {active && <View style={styles.typeSelectedLine}><Check size={13} color="#047857"/><Text style={styles.typeSelectedText}>تم اختيار هذا النوع</Text></View>}
              </Pressable>;
            })}
          </View>

          {type !== 'standard' && <View style={styles.formCard}>
            <View style={styles.formHeading}><View style={styles.formIcon}><FileCheck2 size={19} color="#047857"/></View><View style={{flex:1,gap:3}}><Text style={styles.formTitle}>بيانات طلب التوثيق</Text><Text style={styles.formSub}>كلما كانت البيانات أوضح، سهلت مراجعة الطلب.</Text></View></View>
            <Text style={styles.fieldLabel}>{type === 'merchant' ? 'اسم المتجر أو النشاط التجاري' : type === 'freelance' ? 'المهنة أو تخصص العمل الحر' : 'الخدمة التي تقدمها'}</Text>
            <TextInput value={trade} onChangeText={setTrade} maxLength={120} placeholder={type === 'merchant' ? 'مثال: متجر أدوات منزلية' : type === 'freelance' ? 'مثال: تصميم جرافيك' : 'مثال: صيانة أجهزة منزلية'} placeholderTextColor="#94A3B8" style={styles.input} textAlign="right"/>
            <Text style={styles.fieldLabel}>رابط الوثيقة أو الشهادة (اختياري)</Text>
            <TextInput value={certUrl} onChangeText={setCertUrl} maxLength={500} autoCapitalize="none" keyboardType="url" placeholder="https://..." placeholderTextColor="#94A3B8" style={styles.input} textAlign="right"/>
            <View style={styles.requirements}><CircleHelp size={16} color="#64748B"/><Text style={styles.requirementsText}>{selected.requirements}</Text></View>
            <View style={styles.reviewNote}><ShieldCheck size={17} color="#047857"/><Text style={styles.reviewNoteText}>لن يتغير نوع حسابك الحالي حتى تتم الموافقة على طلب التوثيق.</Text></View>
          </View>}

          <Pressable disabled={saving} onPress={() => void submit()} style={[styles.submitButton, saving && {opacity:0.65}]}>
            {saving ? <ActivityIndicator color="#fff"/> : <><Text style={styles.submitText}>{type === 'standard' ? 'حفظ نوع الحساب' : 'إرسال طلب التوثيق'}</Text><ChevronLeft size={17} color="#fff"/></>}
          </Pressable>

          <View style={styles.sectionHead}><Text style={styles.sectionTitle}>طلبات التوثيق السابقة</Text><Text style={styles.sectionSub}>تابع حالة طلباتك من هنا.</Text></View>
          {requests.length ? requests.map((request) => {
            const status = requestLabel(request.status);
            const StatusIcon = status.icon;
            return <View key={request.id} style={styles.requestCard}>
              <View style={[styles.requestStatus,{backgroundColor:status.bg}]}><StatusIcon size={13} color={status.color}/><Text style={[styles.requestStatusText,{color:status.color}]}>{status.label}</Text></View>
              <View style={{flex:1,gap:4}}><Text style={styles.requestTitle}>{TYPES.find((t)=>t.key===request.subject)?.label || request.subject || 'طلب توثيق'}</Text><Text style={styles.requestDate}>{new Date(request.created_at).toLocaleDateString('ar-SA',{year:'numeric',month:'short',day:'numeric'})}</Text>{request.note ? <Text numberOfLines={2} style={styles.requestNote}>{request.note}</Text> : null}</View>
            </View>;
          }) : <View style={styles.emptyRequests}><FileCheck2 size={21} color="#94A3B8"/><Text style={styles.emptyTitle}>لا توجد طلبات سابقة</Text><Text style={styles.emptyDesc}>ستظهر طلباتك هنا بعد إرسالها.</Text></View>}
        </>}
      </ScrollView>
    </View>
  );
}

function Step({n,label}:{n:string;label:string}) { return <View style={styles.step}><View style={styles.stepDot}><Text style={styles.stepN}>{n}</Text></View><Text style={styles.stepLabel}>{label}</Text></View>; }

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:'#F4F7FB'},content:{padding:16,gap:14},
  hero:{borderRadius:25,padding:18,gap:12},heroTop:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between'},
  heroIcon:{width:50,height:50,borderRadius:16,backgroundColor:'rgba(255,255,255,0.12)',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'rgba(255,255,255,0.16)'},
  verifiedPill:{flexDirection:'row-reverse',alignItems:'center',gap:5,backgroundColor:'rgba(255,255,255,0.12)',paddingHorizontal:9,paddingVertical:6,borderRadius:30},
  verifiedPillText:{fontSize:10,fontWeight:'900',color:'#D1FAE5'},heroTitle:{fontSize:23,fontWeight:'900',color:'#fff',textAlign:'right'},heroDesc:{fontSize:12,lineHeight:20,color:'#D1FAE5',textAlign:'right'},
  heroSteps:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between',marginTop:4},step:{alignItems:'center',gap:5},stepDot:{width:27,height:27,borderRadius:14,backgroundColor:'rgba(255,255,255,0.17)',alignItems:'center',justifyContent:'center'},stepN:{fontSize:11,fontWeight:'900',color:'#fff'},stepLabel:{fontSize:9.5,fontWeight:'800',color:'#D1FAE5'},stepLine:{height:1,flex:1,backgroundColor:'rgba(255,255,255,0.25)',marginHorizontal:7,marginBottom:15},
  loading:{alignItems:'center',paddingVertical:35,gap:10},loadingText:{fontSize:12,color:'#64748B'},
  currentCard:{flexDirection:'row-reverse',alignItems:'center',gap:10,backgroundColor:'#ECFDF5',borderColor:'#A7F3D0',borderWidth:1,borderRadius:17,padding:13},currentIcon:{width:42,height:42,borderRadius:14,backgroundColor:'#D1FAE5',alignItems:'center',justifyContent:'center'},currentLabel:{fontSize:10.5,color:'#047857',fontWeight:'800',textAlign:'right'},currentValue:{fontSize:14,fontWeight:'900',color:'#064E3B',textAlign:'right'},currentPill:{flexDirection:'row-reverse',alignItems:'center',gap:4,backgroundColor:'#D1FAE5',paddingHorizontal:8,paddingVertical:5,borderRadius:20},currentPillText:{fontSize:10,fontWeight:'900',color:'#047857'},
  sectionHead:{gap:3,marginTop:3},sectionTitle:{fontSize:16,fontWeight:'900',color:'#0F172A',textAlign:'right'},sectionSub:{fontSize:11,color:'#64748B',textAlign:'right'},
  typesWrap:{gap:10},typeCard:{backgroundColor:'#fff',borderWidth:1,borderColor:'#E2E8F0',borderRadius:18,padding:14,gap:7},typeCardActive:{borderColor:'#10B981',backgroundColor:'#F0FDF4',shadowColor:'#047857',shadowOpacity:0.08,shadowRadius:8,elevation:2},
  typeTop:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between'},typeIcon:{width:44,height:44,borderRadius:14,alignItems:'center',justifyContent:'center'},selectedBadge:{width:23,height:23,borderRadius:12,backgroundColor:'#059669',alignItems:'center',justifyContent:'center'},unselectedCircle:{width:22,height:22,borderRadius:11,borderWidth:1.5,borderColor:'#CBD5E1'},
  typeLabel:{fontSize:14,fontWeight:'900',color:'#0F172A',textAlign:'right'},typeShort:{fontSize:10,fontWeight:'900',color:'#047857',textAlign:'right'},typeDesc:{fontSize:11.5,color:'#64748B',lineHeight:18,textAlign:'right'},typeSelectedLine:{flexDirection:'row-reverse',alignItems:'center',gap:5,alignSelf:'flex-start',paddingVertical:5,paddingHorizontal:8,backgroundColor:'#D1FAE5',borderRadius:8},typeSelectedText:{fontSize:10,fontWeight:'900',color:'#047857'},
  formCard:{backgroundColor:'#fff',borderWidth:1,borderColor:'#D1FAE5',borderRadius:20,padding:15,gap:11},formHeading:{flexDirection:'row-reverse',alignItems:'center',gap:9},formIcon:{width:39,height:39,borderRadius:13,backgroundColor:'#ECFDF5',alignItems:'center',justifyContent:'center'},formTitle:{fontSize:14,fontWeight:'900',color:'#0F172A',textAlign:'right'},formSub:{fontSize:10.5,color:'#64748B',textAlign:'right'},fieldLabel:{fontSize:11.5,fontWeight:'900',color:'#334155',textAlign:'right'},input:{borderWidth:1,borderColor:'#CBD5E1',borderRadius:13,backgroundColor:'#F8FAFC',paddingHorizontal:12,paddingVertical:12,color:'#0F172A',fontSize:12.5},requirements:{flexDirection:'row-reverse',alignItems:'flex-start',gap:7,backgroundColor:'#F8FAFC',padding:10,borderRadius:12},requirementsText:{flex:1,fontSize:10.5,lineHeight:17,color:'#475569',textAlign:'right'},reviewNote:{flexDirection:'row-reverse',alignItems:'flex-start',gap:7,backgroundColor:'#ECFDF5',padding:10,borderRadius:12},reviewNoteText:{flex:1,fontSize:10.5,lineHeight:17,color:'#065F46',textAlign:'right'},
  submitButton:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:'#087F5B',borderRadius:15,paddingVertical:14},submitText:{fontSize:13,fontWeight:'900',color:'#fff'},
  requestCard:{flexDirection:'row-reverse',alignItems:'flex-start',gap:10,backgroundColor:'#fff',borderWidth:1,borderColor:'#E2E8F0',borderRadius:16,padding:13},requestStatus:{flexDirection:'row-reverse',alignItems:'center',gap:5,paddingHorizontal:8,paddingVertical:6,borderRadius:10},requestStatusText:{fontSize:10,fontWeight:'900'},requestTitle:{fontSize:12,fontWeight:'900',color:'#0F172A',textAlign:'right'},requestDate:{fontSize:10,color:'#94A3B8',textAlign:'right'},requestNote:{fontSize:11,color:'#64748B',textAlign:'right',lineHeight:17},
  emptyRequests:{alignItems:'center',gap:6,padding:20,backgroundColor:'#fff',borderWidth:1,borderColor:'#E2E8F0',borderRadius:16},emptyTitle:{fontSize:12,fontWeight:'900',color:'#334155'},emptyDesc:{fontSize:10.5,color:'#64748B'},
});
