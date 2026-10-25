import { OasisPressable as Pressable, OasisSurface } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { ArrowUpRight, Radar, ShieldCheck, Zap } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { AdminReport, AdminStats, AdminVerificationRequest } from './adminTypes';
import type { TrendPoint } from './AdminInsights';

const number = (value: number) => value.toLocaleString('ar-SA');

export function MiniTrend({ points, color }: { points: TrendPoint[]; color: string }) {
  if (!points.length) return null;
  const values = points.slice(-14).map(point => point.value);
  const max = Math.max(1, ...values);
  const path = values.map((value, i) => `${i ? 'L' : 'M'} ${values.length > 1 ? i * 140 / (values.length - 1) : 70} ${34 - value / max * 28}`).join(' ');
  return <Svg width={140} height={40} viewBox="0 0 140 40" accessibilityLabel="اتجاه آخر أربعة عشر يومًا"><Path d={`${path} L 140 40 L 0 40 Z`} fill={color} opacity={0.08} /><Path d={path} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}

export function AdminPulse({ stats, reports, verifications, pending, overdue, onTasks, onBroadcast }: {
  stats: AdminStats; reports: AdminReport[]; verifications: AdminVerificationRequest[];
  pending: number; overdue: number; onTasks: () => void; onBroadcast: () => void;
}) {
  const wide = useWindowDimensions().width >= 900;
  const reviewed = reports.filter(r => r.status !== 'pending').length + verifications.filter(v => v.status !== 'pending').length;
  const total = reports.length + verifications.length;
  const progress = total ? Math.round(reviewed / total * 100) : null;
  const circumference = 2 * Math.PI * 54;
  return <LinearGradient colors={['#102E2B', '#17463B', '#205944']} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={s.hero}>
    
    <View style={[s.heroLayout, !wide && s.stacked]}>
      <View style={s.copy}>
        <View style={s.kicker}><Radar size={14} color="#ACF1CF" /><Text style={s.kickerText}>مركز قيادة المجتمع</Text><View style={s.kickerDot} /><Text style={s.kickerSecondary}>حيّنا</Text></View>
        <Text accessibilityRole="header" style={[s.title, !wide && { fontSize: 18, lineHeight: 26 }]}>{wide ? 'رؤية أشمل. قرارات تصنع الفرق.' : 'متابعة المجتمع'}</Text>
        <Text style={s.description}>{pending ? `${number(pending)} عنصرًا بانتظار متابعتك. راجع الأولويات وامنح مجتمعك تجربة أفضل.` : 'ابدأ من الصورة الكبيرة، وتابع تفاصيل مجتمعك بخطوات واضحة.'}</Text>
        <View style={s.actions}><Pressable accessibilityRole="button" onPress={onTasks} style={({ pressed }) => [s.primary, pressed && s.pressed]}><Zap size={16} color="#173B2E" /><Text style={s.primaryText}>ابدأ المتابعة</Text><ArrowUpRight size={16} color="#173B2E" /></Pressable><Pressable accessibilityRole="button" onPress={onBroadcast} style={s.secondary}><Text style={s.secondaryText}>إنشاء تعميم</Text><ArrowUpRight size={15} color="#D7EBDD" /></Pressable></View>
        <View style={s.heroFacts}><View style={{ flex: 1 }}><Text style={s.factValue}>{number(stats.questions + stats.requests)}</Text><Text style={s.factLabel}>مشاركة وطلب مساعدة</Text></View><View style={s.factDivider} /><View style={{ flex: 1 }}><Text style={s.factValue}>{number(stats.services)}</Text><Text style={s.factLabel}>خدمة في المجتمع</Text></View><View style={s.factDivider} /><View style={{ flex: 1 }}><Text style={s.factValue}>{number(stats.verifiedUsers)}</Text><Text style={s.factLabel}>حساب موثّق محمّل</Text></View></View>
      </View>
      {wide ? <OasisSurface oasisSurface="card" style={s.reviewCard}>
        <View style={s.reviewHeading}><ShieldCheck size={16} color="#BFE7CF" /><Text style={s.reviewTitle}>إنجاز المراجعات</Text><Text style={s.reviewTag}>البيانات المحمّلة</Text></View>
        <View style={s.ringRow}>
          <View style={s.ring}>
            <Svg width={104} height={104} viewBox="0 0 132 132"><Circle cx={66} cy={66} r={54} stroke={OASIS.colors.surface} strokeOpacity={0.09} strokeWidth={9} fill="none" /><Circle cx={66} cy={66} r={54} stroke="#BDEB97" strokeWidth={9} fill="none" strokeDasharray={`${circumference * (progress || 0) / 100} ${circumference}`} strokeLinecap="round" rotation={-90} origin="66,66" /></Svg>
            <View style={s.ringLabel}><Text style={s.ringNumber}>{progress === null ? '—' : `${number(progress)}٪`}</Text><Text style={s.ringCaption}>تمت مراجعتها</Text></View>
          </View>
          <View style={s.reviewNumbers}><Text style={s.reviewCount}>{number(reviewed)} <Text style={s.reviewOf}>/ {number(total)}</Text></Text><Text style={s.reviewSub}>بلاغ وطلب توثيق</Text><View style={s.reviewBadge}><View style={s.smallDot} /><Text style={s.reviewBadgeText}>{number(overdue)} تجاوزت ٤٨ ساعة</Text></View></View>
        </View>
        <View style={s.reviewBottom}><Text style={s.reviewFoot}>مراجعات محسومة من السجلات المحمّلة</Text><Pressable accessibilityRole="button" accessibilityLabel="فتح تفاصيل المراجعات في مركز المهام" onPress={onTasks} hitSlop={10}><ArrowUpRight size={18} color="#C0DBBC" /></Pressable></View>
      </OasisSurface> : <View style={{ borderTopWidth: 1, borderTopColor: '#41644F', paddingTop: 8, flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}><ShieldCheck size={18} color="#BFE7CF" /><View style={{ flex: 1 }}><Text style={{ color: '#EDF9DC', fontSize: 13 }}>تمت مراجعة {number(reviewed)} من {number(total)}</Text><Text style={{ color: '#A7C7B6', fontSize: 11, marginTop: 3 }}>{number(overdue)} تجاوزت ٤٨ ساعة</Text></View><Pressable oasisKind="plain" accessibilityLabel="فتح تفاصيل المراجعات في مركز المهام" onPress={onTasks} style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}><ArrowUpRight size={20} color="#C0DBBC" /></Pressable></View>}

    </View>
  </LinearGradient>;
}

export function CommunityMix({ stats }: { stats: AdminStats }) {
  const data = [{ label: 'الأسئلة', value: stats.questions, color: '#3A8A72' }, { label: 'طلبات المساعدة', value: stats.requests, color: '#90B9D6' }, { label: 'الخدمات', value: stats.services, color: '#C7AC68' }, { label: 'أدوات الإعارة', value: stats.borrowItems, color: '#A898CC' }];
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return <View style={s.mix}><View style={s.mixHeader}><View><Text accessibilityRole="header" style={s.mixTitle}>ماذا يحدث في المجتمع؟</Text><Text style={s.mixSubtitle}>توزيع المحتوى والموارد حسب النوع</Text></View><Text style={s.mixTotal}>{number(total)} <Text style={s.mixUnit}>عنصر</Text></Text></View>
    <View style={s.mixBar}>{total ? data.filter(item => item.value > 0).map(item => <View key={item.label} style={{ flex: item.value, backgroundColor: item.color }} />) : <View style={{ flex: 1, backgroundColor: '#E4EAE5' }} />}</View>
    <View style={s.mixLegend}>{data.map(item => <View key={item.label} style={s.mixItem}><View style={[s.legendDot, { backgroundColor: item.color }]} /><Text style={s.mixLabel}>{item.label}</Text><Text style={s.mixPercent}>{total ? number(Math.round(item.value / total * 100)) : '٠'}٪</Text></View>)}</View>
  </View>;
}

const s = StyleSheet.create({
  hero: { borderRadius: 14, overflow: 'hidden', padding: 16, borderWidth: 1, borderColor: '#305E4C' },
  orbitOne: { position: 'absolute', width: 480, height: 480, borderRadius: 240, borderWidth: 1, borderColor: 'rgba(207,238,204,0.08)', left: -130, top: -260 }, orbitTwo: { position: 'absolute', width: 600, height: 600, borderRadius: 300, borderWidth: 1, borderColor: 'rgba(207,238,204,0.06)', left: -190, top: -320 },
  heroLayout: { flexDirection: 'row-reverse', alignItems: 'center', gap: 16 }, stacked: { flexDirection: 'column', alignItems: 'stretch' }, copy: { flex: 1, minWidth: 0 }, kicker: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 8 }, kickerText: { color: '#BDEBCE', fontSize: 11, fontWeight: '700' }, kickerDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#6B9B7F' }, kickerSecondary: { color: '#8DB39D', fontSize: 11 },
  title: { fontSize: 22, lineHeight: 31, fontWeight: '700', color: '#F2F8EA', textAlign: 'right', letterSpacing: -1 }, description: { color: '#A7C7B6', fontSize: 12, lineHeight: 23, textAlign: 'right', maxWidth: 430, alignSelf: 'flex-end', marginTop: 12 }, actions: { flexDirection: 'row-reverse', gap: 10, flexWrap: 'wrap', marginTop: 14 }, primary: { minHeight: 44, borderRadius: 11, backgroundColor: '#D1EEA5', flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 15, gap: 8 }, primaryText: { color: '#173B2E', fontSize: 12, fontWeight: '600' }, secondary: { minHeight: 44, borderRadius: 11, borderWidth: 1, borderColor: '#4D7460', flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 15, gap: 8 }, secondaryText: { color: '#D7EBDD', fontSize: 12, fontWeight: '600' },
  heroFacts: { flexDirection: 'row-reverse', gap: 8, marginTop: 12, alignItems: 'center' }, factValue: { color: '#F2F8EA', fontSize: 20, fontWeight: '600', textAlign: 'right' }, factLabel: { color: '#95B9A4', fontSize: 11, marginTop: 5, textAlign: 'right' }, factDivider: { width: 1, height: 30, backgroundColor: '#41644F' },
  reviewCard: { width: 310, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.055)', borderWidth: 1, borderColor: 'rgba(222,240,210,0.15)', padding: 17 }, reviewHeading: { flexDirection: 'row-reverse', gap: 7, alignItems: 'center' }, reviewTitle: { color: '#DBEFDC', fontSize: 12, fontWeight: '700' }, reviewTag: { color: '#ACCEB5', fontSize: 11, marginLeft: 'auto', backgroundColor: 'rgba(255,255,255,0.06)', padding: 5, borderRadius: 5 }, ringRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginVertical: 15 }, ring: { width: 104, height: 104 }, ringLabel: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' }, ringNumber: { color: '#EDF9DC', fontSize: 29, fontWeight: '600' }, ringCaption: { color: '#9DBDA9', fontSize: 11, marginTop: 4 }, reviewNumbers: { flex: 1, gap: 7 }, reviewCount: { color: '#EEF8E6', fontSize: 24, fontWeight: '700', textAlign: 'right' }, reviewOf: { color: '#93B89E', fontSize: 14 }, reviewSub: { color: '#A6C5B1', fontSize: 11, textAlign: 'right' }, reviewBadge: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, marginTop: 5 }, smallDot: { backgroundColor: '#DFC082', width: 5, height: 5, borderRadius: 3 }, reviewBadgeText: { color: '#DFCDA1', fontSize: 11 }, reviewBottom: { borderTopWidth: 1, borderColor: 'rgba(222,240,210,0.1)', paddingTop: 12, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }, reviewFoot: { color: '#97B59D', fontSize: 11 },
  mix: { padding: 14, backgroundColor: OASIS.colors.surface, borderRadius: 14, borderWidth: 1, borderColor: '#DFE7E1' }, mixHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 10, alignItems: 'center' }, mixTitle: { fontSize: 15, color: '#244438', textAlign: 'right', fontWeight: '600' }, mixSubtitle: { color: '#82948A', fontSize: 11, marginTop: 6, textAlign: 'right' }, mixTotal: { color: '#315C47', fontSize: 20, fontWeight: '600' }, mixUnit: { color: '#82948A', fontSize: 11, fontWeight: '400' }, mixBar: { height: 15, borderRadius: 6, overflow: 'hidden', flexDirection: 'row-reverse', gap: 4, marginVertical: 14 }, mixLegend: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 18 }, mixItem: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, flexGrow: 1 }, legendDot: { width: 7, height: 7, borderRadius: 3 }, mixLabel: { color: '#71857A', fontSize: 11 }, mixPercent: { color: '#315C47', fontSize: 11, fontWeight: '600', marginRight: 3 }, pressed: { opacity: 0.8 },
});
