import { ScrollView, View, Text, Pressable, StyleSheet, Linking } from 'react-native';
import { router } from 'expo-router';
import { AppHeader } from '@/components/shared/AppHeader';
import { useBottomNavInset } from '@/lib/bottomNav';
import { ShieldCheck, Phone, AlertTriangle, FileText, Mail } from 'lucide-react-native';

export default function SafetyCenterScreen() {
  const bottomNavInset = useBottomNavInset();
  return (
    <View style={styles.screen}>
      <AppHeader variant="sub" title="مركز الأمان والثقة" subtitle="حيّنا ترعى خصوصية أهالي الحي" fallbackRoute="/more" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomNavInset + 24 }]}>
        <View style={styles.card}>
          <ShieldCheck size={26} color="#059669" />
          <Text style={styles.title}>مركز الأمان</Text>
        </View>
        <Section icon={<AlertTriangle size={18} color="#dc2626" />} title="الإبلاغ الفوري عن إساءة" desc="">
          <Pressable style={styles.btn} onPress={() => router.push('/contact-us')}>
            <Text style={styles.btnText}>التبليغ / فتح طلب دعم</Text>
          </Pressable>
        </Section>
        <Section icon={<FileText size={18} color="#0284c7" />} title="الخصوصية والشروط" desc="">
          <Pressable style={styles.btn} onPress={() => Linking.openURL('https://appksatest.vercel.app/privacy').catch(() => {})}>
            <Text style={styles.btnText}>فتح سياسة الخصوصية</Text>
          </Pressable>
        </Section>
        <Section icon={<Phone size={18} color="#16a34a" />} title="حالات الطوارئ" desc="">
          <Pressable style={[styles.btn, { backgroundColor: '#dc2626' }]} onPress={() => Linking.openURL('tel:911').catch(() => {})}>
            <Text style={styles.btnText}>الاتصال 911</Text>
          </Pressable>
        </Section>
        <View style={styles.card}>
          <Mail size={22} color="#059669" />
          <Text style={styles.title}>اتصل بنا</Text>
          <Pressable style={styles.btn} onPress={() => router.push('/contact-us')}>
            <Text style={styles.btnText}>فتح نموذج الاتصال</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function Section({ icon, title, desc, children }: any) {
  return (
    <View style={styles.card}>
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
        {icon}
        <Text style={styles.title}>{title}</Text>
      </View>
      {desc ? <Text style={styles.desc}>{desc}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, gap: 14 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 18, padding: 16, gap: 8 },
  title: { fontSize: 14.5, fontWeight: '900', color: '#0f172a', textAlign: 'right' },
  desc: { fontSize: 12.5, color: '#475569', textAlign: 'right', lineHeight: 19 },
  btn: { marginTop: 4, backgroundColor: '#059669', borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '900', fontSize: 13 },
});
