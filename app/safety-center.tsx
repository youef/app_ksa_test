import { OasisPressable as Pressable, OasisSurface } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { useState } from 'react';
import { Alert, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
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
            <View style={styles.heroIcon}><ShieldCheck size={27} color={OASIS.colors.soft} /></View>
            <View style={styles.livePill}><CheckCircle2 size={12} color="#BBF7D0" /><Text style={styles.livePillText}>السلامة أولويتنا</Text></View>
          </View>
          <Text style={styles.heroTitle}>مجتمع أكثر أمانًا، يبدأ منك</Text>
          <Text style={styles.heroDesc}>أبلغ عن السلوك المقلق، احمِ معلوماتك الشخصية، وتواصل مع فريق الدعم عند الحاجة.</Text>
          <Pressable oasisKind="action" onPress={() => router.push('/report')} style={styles.heroButton}>
            <AlertTriangle size={17} color={OASIS.colors.deep} />
            <Text style={styles.heroButtonText}>إرسال بلاغ جديد</Text>
            <ChevronLeft size={16} color={OASIS.colors.deep} />
          </Pressable>
        </LinearGradient>

        <View style={styles.quickGrid}>
          <Pressable oasisKind="card" style={styles.quickCard} onPress={() => router.push('/report')}>
            <View style={[styles.quickIcon,{backgroundColor:OASIS.colors.dangerSoft}]}><AlertTriangle size={21} color={OASIS.colors.danger} /></View>
            <Text style={styles.quickTitle}>الإبلاغ عن إساءة</Text>
            <Text style={styles.quickDesc}>محتوى أو حساب أو سلوك</Text>
          </Pressable>
          <Pressable oasisKind="card" style={styles.quickCard} onPress={() => router.push('/support')}>
            <View style={[styles.quickIcon,{backgroundColor:OASIS.colors.infoSoft}]}><FileText size={21} color="#2563EB" /></View>
            <Text style={styles.quickTitle}>متابعة البلاغات</Text>
            <Text style={styles.quickDesc}>تواصل مع فريق الدعم</Text>
          </Pressable>
        </View>

        <SectionHeading title="أدوات الأمان" subtitle="إعدادات وخيارات تساعدك على البقاء مطمئنًا" />
        {items.map((item, index) => (
          <Pressable oasisKind="card" key={item.title} onPress={() => setExpanded(expanded === index ? null : index)} style={styles.infoCard}>
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

        <OasisSurface oasisSurface="card" style={styles.emergencyCard}>
          <View style={styles.emergencyHeading}>
            <View style={styles.emergencyIcon}><Siren size={21} color={OASIS.colors.danger} /></View>
            <View style={{flex:1,gap:3}}>
              <Text style={styles.emergencyTitle}>حالة طارئة؟</Text>
              <Text style={styles.emergencyDesc}>إذا كان هناك خطر فوري على الحياة أو السلامة، تواصل مع خدمات الطوارئ الرسمية في منطقتك.</Text>
            </View>
          </View>
          <Pressable oasisKind="action" onPress={() => open('tel:911')} style={styles.emergencyButton}><Phone size={16} color={OASIS.colors.surface}/><Text style={styles.emergencyButtonText}>الاتصال بالطوارئ · 911</Text></Pressable>
          <Text style={styles.disclaimer}>لا تستخدم البلاغ داخل التطبيق بدلًا من الاتصال بالطوارئ عند وجود خطر فوري. قد يختلف رقم الطوارئ حسب المنطقة والخدمة.</Text>
        </OasisSurface>

        <Pressable onPress={() => open('https://appksatest.vercel.app/privacy')} style={styles.policyRow}>
          <View style={styles.policyIcon}><LockKeyhole size={18} color={OASIS.colors.muted}/></View>
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
  content:{padding:14,gap:13},
  hero:{borderRadius:14,padding:19,gap:12,overflow:'hidden'},
  heroTop:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between'},
  heroIcon:{width:52,height:52,borderRadius:17,backgroundColor:'rgba(255,255,255,0.12)',borderWidth:1,borderColor:'rgba(255,255,255,0.18)',alignItems:'center',justifyContent:'center'},
  livePill:{flexDirection:'row-reverse',alignItems:'center',gap:5,paddingHorizontal:10,paddingVertical:6,borderRadius:99,backgroundColor:'rgba(255,255,255,0.12)'},
  livePillText:{fontSize:11,fontWeight:'700',color:OASIS.colors.soft},
  heroTitle:{fontSize:20,fontWeight:'700',color:OASIS.colors.surface,textAlign:'right',lineHeight:27},
  heroDesc:{fontSize:12.5,lineHeight:21,color:OASIS.colors.soft,textAlign:'right'},
  heroButton:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:OASIS.colors.soft,borderRadius:14,paddingVertical:12,marginTop:3},
  heroButtonText:{fontSize:13,fontWeight:'700',color:OASIS.colors.deep},
  quickGrid:{flexDirection:'row',gap:10},
  quickCard:{flex:1,backgroundColor:OASIS.colors.surface,borderRadius:14,borderWidth:1,borderColor:OASIS.colors.line,padding:13,gap:6},
  quickIcon:{width:42,height:42,borderRadius:14,alignItems:'center',justifyContent:'center'},
  quickTitle:{fontSize:12.5,fontWeight:'700',color:OASIS.colors.ink,textAlign:'right'},
  quickDesc:{fontSize:11,color:OASIS.colors.muted,textAlign:'right',lineHeight:17},
  sectionHeading:{gap:3,marginTop:4},
  sectionTitle:{fontSize:16,fontWeight:'700',color:OASIS.colors.ink,textAlign:'right'},
  sectionSubtitle:{fontSize:11.5,color:OASIS.colors.muted,textAlign:'right',lineHeight:17},
  infoCard:{backgroundColor:OASIS.colors.surface,borderWidth:1,borderColor:OASIS.colors.line,borderRadius:17,padding:13,gap:10},
  infoRow:{flexDirection:'row-reverse',alignItems:'center',gap:10},
  infoIcon:{width:40,height:40,borderRadius:13,backgroundColor:OASIS.colors.background,alignItems:'center',justifyContent:'center'},
  infoCopy:{flex:1,gap:4},
  infoTitle:{fontSize:13,fontWeight:'700',color:OASIS.colors.ink,textAlign:'right'},
  infoDesc:{fontSize:11,color:OASIS.colors.muted,lineHeight:17,textAlign:'right'},
  inlineAction:{alignSelf:'flex-start',flexDirection:'row-reverse',alignItems:'center',gap:6,paddingVertical:7,paddingHorizontal:10,backgroundColor:OASIS.colors.soft,borderRadius:10},
  inlineActionText:{fontSize:11,fontWeight:'700',color:GREEN},
  emergencyCard:{backgroundColor:'#FFF7F7',borderColor:'#FECACA',borderWidth:1,borderRadius:14,padding:15,gap:11},
  emergencyHeading:{flexDirection:'row-reverse',alignItems:'flex-start',gap:10},
  emergencyIcon:{width:42,height:42,borderRadius:14,backgroundColor:'#FEE2E2',alignItems:'center',justifyContent:'center'},
  emergencyTitle:{fontSize:14,fontWeight:'700',color:'#991B1B',textAlign:'right'},
  emergencyDesc:{fontSize:11.5,color:'#7F1D1D',textAlign:'right',lineHeight:18},
  emergencyButton:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:OASIS.colors.danger,paddingVertical:12,borderRadius:13},
  emergencyButtonText:{color:OASIS.colors.surface,fontWeight:'700',fontSize:12.5},
  disclaimer:{fontSize:11,color:'#991B1B',lineHeight:18,textAlign:'right'},
  policyRow:{flexDirection:'row-reverse',alignItems:'center',gap:10,backgroundColor:OASIS.colors.surface,borderWidth:1,borderColor:OASIS.colors.line,borderRadius:16,padding:13},
  policyIcon:{width:40,height:40,borderRadius:13,backgroundColor:'#F1F5F9',alignItems:'center',justifyContent:'center'},
  policyTitle:{fontSize:12,fontWeight:'700',color:OASIS.colors.ink,textAlign:'right'},
  policyDesc:{fontSize:11,color:OASIS.colors.muted,textAlign:'right'},
  contactRow:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'center',gap:8,paddingVertical:12},
  contactText:{fontSize:11.5,fontWeight:'600',color:GREEN},
});
