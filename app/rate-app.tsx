import { OasisPressable as Pressable, OasisTextInput as TextInput, OasisSurface } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppHeader } from '@/components/shared/AppHeader';
import { useBottomNavInset } from '@/lib/bottomNav';
import { supabase } from '@/lib/supabase';
import { Star, HeartHandshake, Lightbulb, ShieldCheck, Send, CheckCircle2, MessageSquareText, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const REASONS = ['سهولة الاستخدام','الخدمات المحلية','مجتمع الحي','الأداء والسرعة','أحتاج تحسينات'];

const ratingMeta = (rating: number) => {
  if (rating === 5) return { title: 'تجربة ممتازة!', subtitle: 'يسعدنا أن حيّنا نال إعجابك.', color: OASIS.colors.primary };
  if (rating === 4) return { title: 'تجربة جميلة', subtitle: 'اقتربنا من توقعاتك، أخبرنا كيف نتحسن.', color: '#0F766E' };
  if (rating === 3) return { title: 'تجربة مقبولة', subtitle: 'ملاحظاتك تساعدنا على التطوير.', color: '#B45309' };
  if (rating === 2) return { title: 'هناك ما يحتاج للتحسين', subtitle: 'شاركنا ما واجهته حتى نصلحه.', color: '#C2410C' };
  return { title: 'نريد أن نسمعك', subtitle: 'أخبرنا بما لم يعمل كما توقعت.', color: OASIS.colors.danger };
};

export default function RateAppScreen() {
  const bottomNavInset = useBottomNavInset();
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [reasons, setReasons] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [hasReview, setHasReview] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth.user) { setUserId(null); return; }
      setUserId(auth.user.id);
      const { data, error } = await supabase.from('app_reviews').select('rating,body').eq('user_id', auth.user.id).maybeSingle();
      if (error) throw error;
      if (data) {
        setHasReview(true);
        setRating(Math.max(1,Math.min(5,Number(data.rating)||5)));
        setBody(data.body || '');
      }
    } catch (e) {
      Alert.alert('تنبيه', e instanceof Error ? e.message : 'تعذر تحميل تقييمك السابق.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    if (!userId) { router.push('/auth'); return; }
    setSaving(true);
    try {
      const cleanBody = body.trim();
      const fullBody = [reasons.length ? 'محاور التقييم: ' + reasons.join('، ') : '', cleanBody].filter(Boolean).join('\n\n');
      const { error } = await supabase.from('app_reviews').upsert({ user_id: userId, rating, body: fullBody || null, published: true }, { onConflict: 'user_id' });
      if (error) throw error;
      setHasReview(true);
      Alert.alert('شكرًا لمشاركتك', 'تم حفظ تقييمك وملاحظاتك. نستخدمها لتحسين تجربة حيّنا.');
    } catch (e) { Alert.alert('تعذر حفظ التقييم', e instanceof Error ? e.message : 'حاول مرة أخرى.'); }
    finally { setSaving(false); }
  };

  const meta = ratingMeta(rating);

  return (
    <View style={[styles.screen, { backgroundColor: 'transparent' }]}>
      <AppHeader variant="sub" title="قيّم تجربتك" subtitle="صوتك يساعدنا على التطوير" fallbackRoute="/more" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content,{paddingBottom:bottomNavInset+30}]}>
        <LinearGradient colors={['#78350F','#B45309','#D97706']} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.hero}>
          <View style={styles.heroTop}><View style={styles.heroIcon}><HeartHandshake size={26} color="#FEF3C7"/></View><View style={styles.heroPill}><Sparkles size={12} color="#FEF3C7"/><Text style={styles.heroPillText}>صوتك يصنع الفرق</Text></View></View>
          <Text style={styles.heroTitle}>كيف كانت تجربتك مع حيّنا؟</Text>
          <Text style={styles.heroDesc}>كل تقييم يساعدنا على تحسين الخدمات وتجربة الجيران في مجتمعهم المحلي.</Text>
          <View style={styles.heroFoot}><ShieldCheck size={14} color="#FDE68A"/><Text style={styles.heroFootText}>نستخدم ملاحظاتك لتطوير المنصة باستمرار.</Text></View>
        </LinearGradient>

        {loading ? <View style={styles.loading}><ActivityIndicator size="large" color="#B45309"/><Text style={styles.loadingText}>جارٍ تحميل تقييمك...</Text></View> : !userId ? <OasisSurface oasisSurface="card" style={styles.loginCard}><View style={styles.loginIcon}><MessageSquareText size={24} color="#B45309"/></View><Text style={styles.cardTitle}>سجّل الدخول لتقييم تجربتك</Text><Text style={styles.cardSub}>يمكنك حفظ تقييمك ومتابعة تحديثه من حسابك.</Text><Pressable oasisVariant="primary" oasisKind="action" onPress={() => router.push('/auth')} style={styles.submitButton}><Text style={styles.submitText}>تسجيل الدخول</Text><Send size={15} color={OASIS.colors.surface}/></Pressable></OasisSurface> : <>
          {hasReview && <View style={styles.savedBanner}><CheckCircle2 size={17} color={OASIS.colors.primary}/><Text style={styles.savedText}>لديك تقييم سابق — يمكنك تحديثه وإرسال ملاحظات جديدة.</Text></View>}
          <OasisSurface oasisSurface="card" style={styles.ratingCard}>
            <View style={styles.cardEyebrow}><Star size={15} color="#B45309"/><Text style={styles.eyebrowText}>تقييمك العام</Text></View>
            <Text style={styles.cardTitle}>اختر عدد النجوم</Text>
            <View style={styles.starsRow}>{[1,2,3,4,5].map((n) => <Pressable oasisKind="icon" key={n} onPress={() => setRating(n)} accessibilityRole="button" accessibilityLabel={`تقييم ${n} من 5`} style={styles.starButton}><Star size={34} color={n<=rating?OASIS.colors.warning:'#CBD5E1'} fill={n<=rating?OASIS.colors.warning:'transparent'}/></Pressable>)}</View>
            <Text style={[styles.ratingTitle,{color:meta.color}]}>{meta.title}</Text><Text style={styles.ratingSub}>{meta.subtitle}</Text>
            <View style={styles.score}><Text style={styles.scoreValue}>{rating}</Text><Text style={styles.scoreOutOf}>/ 5</Text><View style={styles.scoreStars}>{[1,2,3,4,5].map((n)=><View key={n} style={[styles.scoreDot,n<=rating&&{backgroundColor:OASIS.colors.warning}]}/>)}</View></View>
          </OasisSurface>

          <OasisSurface oasisSurface="card" style={styles.feedbackCard}>
            <View style={styles.sectionHeader}><View style={styles.sectionIcon}><Lightbulb size={18} color="#B45309"/></View><View style={{flex:1,gap:3}}><Text style={styles.cardTitle}>ما الذي نركز عليه؟</Text><Text style={styles.cardSub}>اختر كل ما ينطبق (اختياري).</Text></View></View>
            <View style={styles.reasonGrid}>{REASONS.map((reason) => { const active=reasons.includes(reason); return <Pressable oasisKind="chip" key={reason} onPress={() => setReasons((prev)=>active?prev.filter((r)=>r!==reason):[...prev,reason])} style={[styles.reasonChip,active&&styles.reasonChipActive]}><Text style={[styles.reasonText,active&&styles.reasonTextActive]}>{reason}</Text>{active?<CheckCircle2 size={13} color={OASIS.colors.primary}/>:null}</Pressable>; })}</View>
            <Text style={styles.fieldLabel}>ملاحظاتك واقتراحاتك</Text>
            <TextInput value={body} onChangeText={setBody} maxLength={1500} placeholder="ما الذي أعجبك؟ وما الذي تتمنى تحسينه؟" placeholderTextColor="#94A3B8" multiline style={styles.textArea} textAlign="right" textAlignVertical="top"/>
            <Text style={styles.charCount}>{body.length}/1500 حرف</Text>
          </OasisSurface>

          <Pressable oasisVariant="primary" oasisKind="action" disabled={saving} onPress={() => void submit()} style={[styles.submitButton,saving&&{opacity:0.65}]}>
            {saving ? <ActivityIndicator color={OASIS.colors.surface}/> : <><Text style={styles.submitText}>{hasReview?'تحديث التقييم':'إرسال التقييم'}</Text><Send size={15} color={OASIS.colors.surface}/></>}
          </Pressable>
          <Text style={styles.footnote}>يُحفظ تقييم واحد لكل حساب، ويمكنك تعديله لاحقًا.</Text>
        </>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:'#F4F7FB'},content:{padding:14,gap:13},
  hero:{borderRadius:14,padding:18,gap:12},heroTop:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between'},heroIcon:{width:50,height:50,borderRadius:16,backgroundColor:'rgba(255,255,255,0.14)',alignItems:'center',justifyContent:'center'},heroPill:{flexDirection:'row-reverse',alignItems:'center',gap:5,backgroundColor:'rgba(255,255,255,0.12)',paddingHorizontal:9,paddingVertical:6,borderRadius:14},heroPillText:{fontSize:11,fontWeight:'700',color:'#FEF3C7'},heroTitle:{fontSize:22,fontWeight:'700',color:OASIS.colors.surface,textAlign:'right'},heroDesc:{fontSize:12,color:'#FEF3C7',lineHeight:20,textAlign:'right'},heroFoot:{flexDirection:'row-reverse',alignItems:'center',gap:6,marginTop:3},heroFootText:{fontSize:11,color:'#FDE68A',fontWeight:'700'},
  loading:{paddingVertical:24,alignItems:'center',gap:10},loadingText:{fontSize:12,color:OASIS.colors.muted},
  savedBanner:{flexDirection:'row-reverse',alignItems:'center',gap:8,padding:12,borderRadius:13,backgroundColor:OASIS.colors.soft,borderWidth:1,borderColor:'#A7F3D0'},savedText:{flex:1,fontSize:11,color:OASIS.colors.deep,fontWeight:'600',textAlign:'right'},
  ratingCard:{backgroundColor:OASIS.colors.surface,borderWidth:1,borderColor:'#FDE68A',borderRadius:14,padding:17,alignItems:'center',gap:8},cardEyebrow:{flexDirection:'row-reverse',alignItems:'center',gap:6,alignSelf:'flex-end'},eyebrowText:{fontSize:11,fontWeight:'700',color:'#B45309'},cardTitle:{fontSize:15,fontWeight:'700',color:OASIS.colors.ink,textAlign:'right'},starsRow:{flexDirection:'row',justifyContent:'center',gap:9,marginTop:5,marginBottom:2},starButton:{padding:2},ratingTitle:{fontSize:16,fontWeight:'700'},ratingSub:{fontSize:11,color:OASIS.colors.muted,textAlign:'center',lineHeight:17},score:{flexDirection:'row-reverse',alignItems:'center',gap:5,backgroundColor:OASIS.colors.warningSoft,paddingHorizontal:11,paddingVertical:6,borderRadius:12,marginTop:3},scoreValue:{fontSize:17,fontWeight:'700',color:'#92400E'},scoreOutOf:{fontSize:11,color:'#B45309',fontWeight:'600'},scoreStars:{flexDirection:'row',gap:3,marginRight:5},scoreDot:{width:6,height:6,borderRadius:3,backgroundColor:'#FDE68A'},
  feedbackCard:{backgroundColor:OASIS.colors.surface,borderWidth:1,borderColor:OASIS.colors.line,borderRadius:14,padding:15,gap:12},sectionHeader:{flexDirection:'row-reverse',alignItems:'center',gap:9},sectionIcon:{width:40,height:40,borderRadius:13,backgroundColor:'#FEF3C7',alignItems:'center',justifyContent:'center'},cardSub:{fontSize:11,color:OASIS.colors.muted,textAlign:'right',lineHeight:17},reasonGrid:{flexDirection:'row-reverse',flexWrap:'wrap',gap:7},reasonChip:{flexDirection:'row-reverse',alignItems:'center',gap:5,borderWidth:1,borderColor:OASIS.colors.line,backgroundColor:OASIS.colors.background,paddingHorizontal:10,paddingVertical:8,borderRadius:11},reasonChipActive:{backgroundColor:OASIS.colors.soft,borderColor:'#6EE7B7'},reasonText:{fontSize:11,fontWeight:'600',color:OASIS.colors.muted},reasonTextActive:{color:OASIS.colors.primary},fieldLabel:{fontSize:11.5,fontWeight:'700',color:OASIS.colors.ink,textAlign:'right'},textArea:{minHeight:120,borderWidth:1,borderColor:'#CBD5E1',backgroundColor:OASIS.colors.background,borderRadius:13,paddingHorizontal:12,paddingVertical:11,fontSize:12.5,color:OASIS.colors.ink},charCount:{fontSize:11,color:'#94A3B8',textAlign:'left'},
  submitButton:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:'#B45309',borderRadius:15,paddingVertical:14},submitText:{fontSize:13,fontWeight:'700',color:OASIS.colors.surface},footnote:{fontSize:11,color:'#94A3B8',textAlign:'center'},loginCard:{backgroundColor:OASIS.colors.surface,borderRadius:14,padding:14,alignItems:'center',gap:10,borderWidth:1,borderColor:OASIS.colors.line},loginIcon:{width:52,height:52,borderRadius:17,backgroundColor:'#FEF3C7',alignItems:'center',justifyContent:'center'},
});
