import { useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppHeader } from '@/components/shared/AppHeader';
import { useBottomNavInset } from '@/lib/bottomNav';
import { ShieldCheck, Phone, AlertTriangle, FileText, Mail, ChevronLeft, LockKeyhole, Eye, UserRoundCheck, LifeBuoy, Siren, CheckCircle2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const GREEN = '#087F5B';

export default function SafetyCenterScreen() {
  const bottomNavInset = useBottomNavInset();
  const [expanded, setExpanded] = useState<number | null>(0);

  const open = async (url: string) => {
    try { await Linking.openURL(url); }
    catch { Alert.alert('تعذّر الفتح', 'لم نتمكن من فتح هذا الخيار على جهازك.'); }
  };

  const items = [
    { icon: <Eye size={19} color="#0F766E" />, title: 'تحكّم بخصوصيتك', desc: 'راجع من يمكنه التواصل معك وما يظهر في ملفك الشخصي.', action: 'إعدادات الخصوصية', onPress: () => router.push({ pathname: '/profile', params: { tab: 'settings' } }) },
    { icon: <UserRoundCheck size={19} color="#2563EB" />, title: 'تعزيز موثوقية حسابك', desc: 'أكمل بيانات ملفك واطلب توثيق حسابك عند الحاجة.', action: 'نوع الحساب والتوثيق', onPress: () => router.push({ pathname: '/profile', params: { tab: 'profile', section: 'identity' } }) },
    { icon: <LifeBuoy size={19} color="#7C3AED" />, title: 'تحتاج إلى مساعدة؟', desc: 'افتح تذكرة خاصة وتابع الردود من فريق حيّنا.', action: 'مركز الدعم', onPress: () => router.push('/support') },
  ];

  return (
    <View style={styles.screen}>
      <AppHeader variant="sub" title="مركز الأمان والثقة" subtitle="مساحة آمنة لمجتمع حيّنا" fallbackRoute="/more" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: bottomNavInset + 28 }]}>
        <LinearGradient colors={['#063B31', '#087F5B', '#0D9488']} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}><ShieldCheck size={27} color="#D1FAE5" /></View>
            <View style={styles.livePill}><CheckCircle2 size={12} color="#BBF7D0" /><Text style={styles.livePillText}>السلامة أولويتنا</Text></View>
          </View>
          <Text style={styles.heroTitle}>مجتمع أكثر أمانًا، يبدأ منك</Text>
          <Text style={styles.heroDesc}>أبلغ عن السلوك المقلق، احمِ معلوماتك الشخصية، وتواصل مع فريق الدعم عند الحاجة.</Text>
          <Pressable onPress={() => router.push('/report')} style={styles.heroButton}>
            <AlertTriangle size={17} color="#064E3B" />
            <Text style={styles.heroButtonText}>إرسال بلاغ جديد</Text>
            <ChevronLeft size={16} color="#064E3B" />
          </Pressable>
        </LinearGradient>

        <View style={styles.quickGrid}>
          <Pressable style={styles.quickCard} onPress={() => router.push('/report')}>
            <View style={[styles.quickIcon,{backgroundColor:'#FEF2F2'}]}><AlertTriangle size={21} color="#DC2626" /></View>
            <Text style={styles.quickTitle}>الإبلاغ عن إساءة</Text>
            <Text style={styles.quickDesc}>محتوى أو حساب أو سلوك</Text>
          </Pressable>
          <Pressable style={styles.quickCard} onPress={() => router.push('/support')}>
            <View style={[styles.quickIcon,{backgroundColor:'#EFF6FF'}]}><FileText size={21} color="#2563EB" /></View>
            <Text style={styles.quickTitle}>متابعة البلاغات</Text>
            <Text style={styles.quickDesc}>تواصل مع فريق الدعم</Text>
          </Pressable>
        </View>

        <SectionHeading title="أدوات الأمان" subtitle="إعدادات وخيارات تساعدك على البقاء مطمئنًا" />
        {items.map((item, index) => (
          <Pressable key={item.title} onPress={() => setExpanded(expanded === index ? null : index)} style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>{item.icon}</View>
              <View style={styles.infoCopy}>
                <Text style={styles.infoTitle}>{item.title}</Text>
                <Text style={styles.infoDesc}>{item.desc}</Text>
              </View>
              <ChevronLeft size={17} color="#94A3B8" />
            </View>
            {expanded === index && <Pressable onPress={item.onPress} style={styles.inlineAction}><Text style={styles.inlineActionText}>{item.action}</Text><ChevronLeft size={14} color={GREEN}/></Pressable>}
          </Pressable>
        ))}

        <View style={styles.emergencyCard}>
          <View style={styles.emergencyHeading}>
            <View style={styles.emergencyIcon}><Siren size={21} color="#B91C1C" /></View>
            <View style={{flex:1,gap:3}}>
              <Text style={styles.emergencyTitle}>حالة طارئة؟</Text>
              <Text style={styles.emergencyDesc}>إذا كان هناك خطر فوري على الحياة أو السلامة، تواصل مع خدمات الطوارئ الرسمية في منطقتك.</Text>
            </View>
          </View>
          <Pressable onPress={() => open('tel:911')} style={styles.emergencyButton}><Phone size={16} color="#fff"/><Text style={styles.emergencyButtonText}>الاتصال بالطوارئ · 911</Text></Pressable>
          <Text style={styles.disclaimer}>لا تستخدم البلاغ داخل التطبيق بدلًا من الاتصال بالطوارئ عند وجود خطر فوري. قد يختلف رقم الطوارئ حسب المنطقة والخدمة.</Text>
        </View>

        <Pressable onPress={() => open('https://appksatest.vercel.app/privacy')} style={styles.policyRow}>
          <View style={styles.policyIcon}><LockKeyhole size={18} color="#475569"/></View>
          <View style={{flex:1,gap:3}}><Text style={styles.policyTitle}>سياسة الخصوصية وشروط الاستخدام</Text><Text style={styles.policyDesc}>اعرف كيف نساعد في حماية بياناتك وحقوقك.</Text></View>
          <ChevronLeft size={17} color="#94A3B8"/>
        </Pressable>
        <Pressable onPress={() => open('mailto:support@hayna.app?subject=الأمان%20والثقة%20-%20حيّنا')} style={styles.contactRow}>
          <Mail size={17} color={GREEN}/><Text style={styles.contactText}>التواصل مع فريق الثقة والأمان</Text><ChevronLeft size={15} color={GREEN}/>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function SectionHeading({title,subtitle}:{title:string;subtitle:string}) {
  return <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.sectionSubtitle}>{subtitle}</Text></View>;
}

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:'#F4F7FB'},
  content:{padding:16,gap:13},
  hero:{borderRadius:26,padding:19,gap:12,overflow:'hidden'},
  heroTop:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between'},
  heroIcon:{width:52,height:52,borderRadius:17,backgroundColor:'rgba(255,255,255,0.12)',borderWidth:1,borderColor:'rgba(255,255,255,0.18)',alignItems:'center',justifyContent:'center'},
  livePill:{flexDirection:'row-reverse',alignItems:'center',gap:5,paddingHorizontal:10,paddingVertical:6,borderRadius:99,backgroundColor:'rgba(255,255,255,0.12)'},
  livePillText:{fontSize:10,fontWeight:'900',color:'#D1FAE5'},
  heroTitle:{fontSize:23,fontWeight:'900',color:'#fff',textAlign:'right',lineHeight:31},
  heroDesc:{fontSize:12.5,lineHeight:21,color:'#D1FAE5',textAlign:'right'},
  heroButton:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:'#D1FAE5',borderRadius:14,paddingVertical:12,marginTop:3},
  heroButtonText:{fontSize:13,fontWeight:'900',color:'#064E3B'},
  quickGrid:{flexDirection:'row',gap:10},
  quickCard:{flex:1,backgroundColor:'#fff',borderRadius:18,borderWidth:1,borderColor:'#E2E8F0',padding:13,gap:6},
  quickIcon:{width:42,height:42,borderRadius:14,alignItems:'center',justifyContent:'center'},
  quickTitle:{fontSize:12.5,fontWeight:'900',color:'#0F172A',textAlign:'right'},
  quickDesc:{fontSize:10.5,color:'#64748B',textAlign:'right',lineHeight:16},
  sectionHeading:{gap:3,marginTop:4},
  sectionTitle:{fontSize:16,fontWeight:'900',color:'#0F172A',textAlign:'right'},
  sectionSubtitle:{fontSize:11.5,color:'#64748B',textAlign:'right',lineHeight:17},
  infoCard:{backgroundColor:'#fff',borderWidth:1,borderColor:'#E2E8F0',borderRadius:17,padding:13,gap:10},
  infoRow:{flexDirection:'row-reverse',alignItems:'center',gap:10},
  infoIcon:{width:40,height:40,borderRadius:13,backgroundColor:'#F8FAFC',alignItems:'center',justifyContent:'center'},
  infoCopy:{flex:1,gap:4},
  infoTitle:{fontSize:13,fontWeight:'900',color:'#0F172A',textAlign:'right'},
  infoDesc:{fontSize:11,color:'#64748B',lineHeight:17,textAlign:'right'},
  inlineAction:{alignSelf:'flex-start',flexDirection:'row-reverse',alignItems:'center',gap:6,paddingVertical:7,paddingHorizontal:10,backgroundColor:'#ECFDF5',borderRadius:10},
  inlineActionText:{fontSize:11,fontWeight:'900',color:GREEN},
  emergencyCard:{backgroundColor:'#FFF7F7',borderColor:'#FECACA',borderWidth:1,borderRadius:20,padding:15,gap:11},
  emergencyHeading:{flexDirection:'row-reverse',alignItems:'flex-start',gap:10},
  emergencyIcon:{width:42,height:42,borderRadius:14,backgroundColor:'#FEE2E2',alignItems:'center',justifyContent:'center'},
  emergencyTitle:{fontSize:14,fontWeight:'900',color:'#991B1B',textAlign:'right'},
  emergencyDesc:{fontSize:11.5,color:'#7F1D1D',textAlign:'right',lineHeight:18},
  emergencyButton:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:'#B91C1C',paddingVertical:12,borderRadius:13},
  emergencyButtonText:{color:'#fff',fontWeight:'900',fontSize:12.5},
  disclaimer:{fontSize:10,color:'#991B1B',lineHeight:16,textAlign:'right'},
  policyRow:{flexDirection:'row-reverse',alignItems:'center',gap:10,backgroundColor:'#fff',borderWidth:1,borderColor:'#E2E8F0',borderRadius:16,padding:13},
  policyIcon:{width:40,height:40,borderRadius:13,backgroundColor:'#F1F5F9',alignItems:'center',justifyContent:'center'},
  policyTitle:{fontSize:12,fontWeight:'900',color:'#0F172A',textAlign:'right'},
  policyDesc:{fontSize:10.5,color:'#64748B',textAlign:'right'},
  contactRow:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'center',gap:8,paddingVertical:12},
  contactText:{fontSize:11.5,fontWeight:'800',color:GREEN},
});
