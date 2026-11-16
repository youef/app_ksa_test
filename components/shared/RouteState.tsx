import { router } from 'expo-router';
import { FileQuestion, RefreshCw, WifiOff } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OasisPressable as Pressable } from '@/components/oasis/OasisPrimitives';
import { useTheme } from '@/context/ThemeContext';

type Props = { kind: 'offline'; onRetry: () => void; checking: boolean } | { kind: 'missing' };

export default function RouteState(props: Props) {
  const { colors } = useTheme();
  const offline = props.kind === 'offline';
  const Icon = offline ? WifiOff : FileQuestion;
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <View style={[styles.icon, { backgroundColor: colors.soft }]}>
          <Icon size={29} color={colors.primary} />
        </View>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.ink }]}>
          {offline ? 'لا يوجد اتصال بالإنترنت' : 'الصفحة غير موجودة'}
        </Text>
        <Text accessibilityLiveRegion="polite" style={[styles.body, { color: colors.muted }]}>
          {offline ? 'تحقّق من اتصالك بالشبكة، ثم حاول مرة أخرى.' : 'قد يكون الرابط غير صحيح أو نُقلت الصفحة.'}
        </Text>
        {props.kind === 'offline' ? (
          <Pressable oasisKind="action" oasisVariant="primary" onPress={props.onRetry} disabled={props.checking} style={styles.action}>
            <RefreshCw size={16} />
            <Text style={styles.label}>{props.checking ? 'جارٍ التحقق…' : 'إعادة المحاولة'}</Text>
          </Pressable>
        ) : (
          <View style={styles.actions}>
            <Pressable oasisKind="action" oasisVariant="primary" onPress={() => router.replace('/home')} style={styles.action}>
              <Text style={styles.label}>الرئيسية</Text>
            </Pressable>
            {router.canGoBack() && (
              <Pressable oasisKind="action" oasisVariant="secondary" onPress={() => router.back()} style={styles.action}>
                <Text style={styles.label}>رجوع</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  card: { width: '100%', maxWidth: 420, padding: 24, alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 24 },
  icon: { width: 62, height: 62, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  body: { fontSize: 14, lineHeight: 23, textAlign: 'center' },
  actions: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  action: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7 },
  label: { fontSize: 14, fontWeight: '700' },
});
