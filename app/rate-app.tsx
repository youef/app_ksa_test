import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { AppHeader } from '@/components/shared/AppHeader';
import { useBottomNavInset } from '@/lib/bottomNav';
import { supabase } from '@/lib/supabase';
import { Star, HeartHandshake, Lightbulb, ShieldCheck, Send, CheckCircle2, MessageSquareText, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const REASONS = ['سهولة الاستخدام','الخدمات المحلية','مجتمع الحي','الأداء والسرعة','أحتاج تحسينات'];

const ratingMeta = (rating: number) => {
  if (rating === 5) return { title: 'تجربة ممتازة!', subtitle: 'يسعدنا أن حيّنا نال إعجابك.', color: '#047857' };
  if (rating === 4) return { title: 'تجربة جميلة', subtitle: 'اقتربنا من توقعاتك، أخبرنا كيف نتحسن.', color: '#0F766E' };
  if (rating === 3) return { title: 'تجربة مقبولة', subtitle: 'ملاحظاتك تساعدنا على التطوير.', color: '#B45309' };
  if (rating === 2) return { title: 'هناك ما يحتاج للتحسين', subtitle: 'شاركنا ما واجهته حتى نصلحه.', color: '#C2410C' };
  return { title: 'نريد أن نسمعك', subtitle: 'أخبرنا بما لم يعمل كما توقعت.', color: '#B91C1C' };
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
    <View style={styles.screen}>
      <AppHeader variant="sub" title="قيّم تجربتك" subtitle="صوتك يساعدنا على التطوير" fallbackRoute="/more" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content,{paddingBottom:bottomNavInset+30}]}>
        <LinearGradient colors={['#78350F','#B45309','#D97706']} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.hero}>
          <View style={styles.heroTop}><View style={styles.heroIcon}><HeartHandshake size={26} color="#FEF3C7"/></View><View style={styles.heroPill}><Sparkles size={12} color="#FEF3C7"/><Text style={styles.heroPillText}>صوتك يصنع الفرق</Text></View></View>
          <Text style={styles.heroTitle}>كيف كانت تجربتك مع حيّنا؟</Text>
          <Text style={styles.heroDesc}>كل تقييم يساعدنا على تحسين الخدمات وتجربة الجيران في مجتمعهم المحلي.</Text>
          <View style={styles.heroFoot}><ShieldCheck size={14} color="#FDE68A"/><Text style={styles.heroFootText}>نستخدم ملاحظاتك لتطوير المنصة باستمرار.</Text></View>
        </LinearGradient>

        {loading ? <View style={styles.loading}><ActivityIndicator size="large" color="#B45309"/><Text style={styles.loadingText}>جارٍ تحميل تقييمك...</Text></View> : !userId ? <View style={styles.loginCard}><View style={styles.loginIcon}><MessageSquareText size={24} color="#B45309"/></View><Text style={styles.cardTitle}>سجّل الدخول لتقييم تجربتك</Text><Text style={styles.cardSub}>يمكنك حفظ تقييمك ومتابعة تحديثه من حسابك.</Text><Pressable onPress={() => router.push('/auth')} style={styles.submitButton}><Text style={styles.submitText}>تسجيل الدخول</Text><Send size={15} color="#fff"/></Pressable></View> : <>
          {hasReview && <View style={styles.savedBanner}><CheckCircle2 size={17} color="#047857"/><Text style={styles.savedText}>لديك تقييم سابق — يمكنك تحديثه وإرسال ملاحظات جديدة.</Text></View>}
          <View style={styles.ratingCard}>
            <View style={styles.cardEyebrow}><Star size={15} color="#B45309"/><Text style={styles.eyebrowText}>تقييمك العام</Text></View>
            <Text style={styles.cardTitle}>اختر عدد النجوم</Text>
            <View style={styles.starsRow}>{[1,2,3,4,5].map((n) => <Pressable key={n} onPress={() => setRating(n)} accessibilityRole="button" accessibilityLabel={`تقييم ${n} من 5`} style={styles.starButton}><Star size={34} color={n<=rating?'#F59E0B':'#CBD5E1'} fill={n<=rating?'#F59E0B':'transparent'}/></Pressable>)}</View>
            <Text style={[styles.ratingTitle,{color:meta.color}]}>{meta.title}</Text><Text style={styles.ratingSub}>{meta.subtitle}</Text>
            <View style={styles.score}><Text style={styles.scoreValue}>{rating}</Text><Text style={styles.scoreOutOf}>/ 5</Text><View style={styles.scoreStars}>{[1,2,3,4,5].map((n)=><View key={n} style={[styles.scoreDot,n<=rating&&{backgroundColor:'#F59E0B'}]}/>)}</View></View>
          </View>

          <View style={styles.feedbackCard}>
            <View style={styles.sectionHeader}><View style={styles.sectionIcon}><Lightbulb size={18} color="#B45309"/></View><View style={{flex:1,gap:3}}><Text style={styles.cardTitle}>ما الذي نركز عليه؟</Text><Text style={styles.cardSub}>اختر كل ما ينطبق (اختياري).</Text></View></View>
            <View style={styles.reasonGrid}>{REASONS.map((reason) => { const active=reasons.includes(reason); return <Pressable key={reason} onPress={() => setReasons((prev)=>active?prev.filter((r)=>r!==reason):[...prev,reason])} style={[styles.reasonChip,active&&styles.reasonChipActive]}><Text style={[styles.reasonText,active&&styles.reasonTextActive]}>{reason}</Text>{active?<CheckCircle2 size={13} color="#047857"/>:null}</Pressable>; })}</View>
            <Text style={styles.fieldLabel}>ملاحظاتك واقتراحاتك</Text>
            <TextInput value={body} onChangeText={setBody} maxLength={1500} placeholder="ما الذي أعجبك؟ وما الذي تتمنى تحسينه؟" placeholderTextColor="#94A3B8" multiline style={styles.textArea} textAlign="right" textAlignVertical="top"/>
            <Text style={styles.charCount}>{body.length}/1500 حرف</Text>
          </View>

          <Pressable disabled={saving} onPress={() => void submit()} style={[styles.submitButton,saving&&{opacity:0.65}]}>
            {saving ? <ActivityIndicator color="#fff"/> : <><Text style={styles.submitText}>{hasReview?'تحديث التقييم':'إرسال التقييم'}</Text><Send size={15} color="#fff"/></>}
          </Pressable>
          <Text style={styles.footnote}>يُحفظ تقييم واحد لكل حساب، ويمكنك تعديله لاحقًا.</Text>
        </>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:'#F4F7FB'},content:{padding:16,gap:13},
  hero:{borderRadius:25,padding:18,gap:12},heroTop:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between'},heroIcon:{width:50,height:50,borderRadius:16,backgroundColor:'rgba(255,255,255,0.14)',alignItems:'center',justifyContent:'center'},heroPill:{flexDirection:'row-reverse',alignItems:'center',gap:5,backgroundColor:'rgba(255,255,255,0.12)',paddingHorizontal:9,paddingVertical:6,borderRadius:30},heroPillText:{fontSize:10,fontWeight:'900',color:'#FEF3C7'},heroTitle:{fontSize:22,fontWeight:'900',color:'#fff',textAlign:'right'},heroDesc:{fontSize:12,color:'#FEF3C7',lineHeight:20,textAlign:'right'},heroFoot:{flexDirection:'row-reverse',alignItems:'center',gap:6,marginTop:3},heroFootText:{fontSize:10,color:'#FDE68A',fontWeight:'700'},
  loading:{paddingVertical:35,alignItems:'center',gap:10},loadingText:{fontSize:12,color:'#64748B'},
  savedBanner:{flexDirection:'row-reverse',alignItems:'center',gap:8,padding:12,borderRadius:13,backgroundColor:'#ECFDF5',borderWidth:1,borderColor:'#A7F3D0'},savedText:{flex:1,fontSize:11,color:'#065F46',fontWeight:'800',textAlign:'right'},
  ratingCard:{backgroundColor:'#fff',borderWidth:1,borderColor:'#FDE68A',borderRadius:20,padding:17,alignItems:'center',gap:8},cardEyebrow:{flexDirection:'row-reverse',alignItems:'center',gap:6,alignSelf:'flex-end'},eyebrowText:{fontSize:10,fontWeight:'900',color:'#B45309'},cardTitle:{fontSize:15,fontWeight:'900',color:'#0F172A',textAlign:'right'},starsRow:{flexDirection:'row',justifyContent:'center',gap:9,marginTop:5,marginBottom:2},starButton:{padding:2},ratingTitle:{fontSize:16,fontWeight:'900'},ratingSub:{fontSize:11,color:'#64748B',textAlign:'center',lineHeight:17},score:{flexDirection:'row-reverse',alignItems:'center',gap:5,backgroundColor:'#FFFBEB',paddingHorizontal:11,paddingVertical:6,borderRadius:12,marginTop:3},scoreValue:{fontSize:17,fontWeight:'900',color:'#92400E'},scoreOutOf:{fontSize:10,color:'#B45309',fontWeight:'800'},scoreStars:{flexDirection:'row',gap:3,marginRight:5},scoreDot:{width:6,height:6,borderRadius:3,backgroundColor:'#FDE68A'},
  feedbackCard:{backgroundColor:'#fff',borderWidth:1,borderColor:'#E2E8F0',borderRadius:20,padding:15,gap:12},sectionHeader:{flexDirection:'row-reverse',alignItems:'center',gap:9},sectionIcon:{width:40,height:40,borderRadius:13,backgroundColor:'#FEF3C7',alignItems:'center',justifyContent:'center'},cardSub:{fontSize:10.5,color:'#64748B',textAlign:'right',lineHeight:16},reasonGrid:{flexDirection:'row-reverse',flexWrap:'wrap',gap:7},reasonChip:{flexDirection:'row-reverse',alignItems:'center',gap:5,borderWidth:1,borderColor:'#E2E8F0',backgroundColor:'#F8FAFC',paddingHorizontal:10,paddingVertical:8,borderRadius:11},reasonChipActive:{backgroundColor:'#ECFDF5',borderColor:'#6EE7B7'},reasonText:{fontSize:10.5,fontWeight:'800',color:'#64748B'},reasonTextActive:{color:'#047857'},fieldLabel:{fontSize:11.5,fontWeight:'900',color:'#334155',textAlign:'right'},textArea:{minHeight:120,borderWidth:1,borderColor:'#CBD5E1',backgroundColor:'#F8FAFC',borderRadius:13,paddingHorizontal:12,paddingVertical:11,fontSize:12.5,color:'#0F172A'},charCount:{fontSize:10,color:'#94A3B8',textAlign:'left'},
  submitButton:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:'#B45309',borderRadius:15,paddingVertical:14},submitText:{fontSize:13,fontWeight:'900',color:'#fff'},footnote:{fontSize:10,color:'#94A3B8',textAlign:'center'},loginCard:{backgroundColor:'#fff',borderRadius:20,padding:22,alignItems:'center',gap:10,borderWidth:1,borderColor:'#E2E8F0'},loginIcon:{width:52,height:52,borderRadius:17,backgroundColor:'#FEF3C7',alignItems:'center',justifyContent:'center'},
});
