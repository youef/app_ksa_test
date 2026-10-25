import { OasisEmptyIllustration } from '@/components/oasis/OasisEmptyIllustration';
import { OasisPressable as Pressable } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { MessageCircle, ShieldCheck, Sparkles, Truck, User, Wrench } from 'lucide-react-native';
import { styles } from './homeStyles';
import type { HomeTab } from '@/lib/homeUtils';

type Props = {
  tab: HomeTab;
  searching: boolean;
  city: string;
  hasExactLocation: boolean;
};

export default function EmptyState({ tab, searching, city, hasExactLocation }: Props) {
  const cfg = (() => {
    const searchSub = 'جرّب كلمات أخرى أو امسح البحث.';
    switch (tab) {
      case 'mine':
        return {
          Icon: User, color: OASIS.colors.primary,
          title: searching ? 'لا توجد منشورات تطابق البحث' : 'لا توجد منشورات بعد',
          sub: searching ? searchSub : 'استفساراتك وطلباتك ستظهر هنا عند نشرها في الحي.',
          cta: searching ? null : { label: 'انشر أول استفسار لك', bg: OASIS.colors.primary },
        };
      case 'emergency':
        return {
          Icon: ShieldCheck, color: OASIS.colors.primary,
          title: searching ? 'لا توجد نتائج طوارئ مطابقة' : 'الحمد لله، لا توجد طوارئ',
          sub: searching ? searchSub : 'الحي آمن ومستقر بفضل الله.',
          cta: null,
        };
      case 'tools':
        return {
          Icon: Wrench, color: OASIS.colors.primary,
          title: searching ? 'لا توجد عروض إعارة مطابقة' : 'لا توجد عروض إعارة حالياً',
          sub: searching ? searchSub : 'هل لديك سلم أو دريل أو أدوات ترغب بإعارتها لجيرانك؟',
          cta: searching ? null : { label: 'اعرض أداة للإعارة المجانية', bg: OASIS.colors.primary },
        };
      case 'questions':
        return {
          Icon: MessageCircle, color: OASIS.colors.primary,
          title: searching ? 'لا توجد استفسارات مطابقة' : 'لا توجد استفسارات حالياً',
          sub: searching ? searchSub : 'اطرح سؤالك الأول لأهل الحي وتلقَّ ردوداً وتوصيات مجرّبة.',
          cta: searching ? null : { label: 'اطرح سؤالك الآن', bg: OASIS.colors.primary },
        };
      case 'requests':
        return {
          Icon: Truck, color: '#d97706',
          title: searching ? 'لا توجد طلبات مطابقة' : 'لا توجد طلبات فزعة حالياً',
          sub: searching ? searchSub : 'شارك جيرانك أي مساعدة تحتاجها وسيقف أهل حيك بجانبك.',
          cta: null,
        };
      default:
        return {
          Icon: Sparkles, color: OASIS.colors.primary,
          title: searching
            ? 'لا توجد نتائج مطابقة للبحث'
            : !hasExactLocation
              ? 'حدّد حيّك لعرض منشورات جيرانك'
              : `لا توجد استفسارات في ${city} حالياً`,
          sub: searching
            ? 'جرّب كلمات أخرى أو امسح البحث لعرض جميع المنشورات.'
            : !hasExactLocation
              ? 'تُعرض المنشورات حسب الحي فقط لحماية خصوصية الجميع. اختر منطقتك ومدينتك وحيّك من الأعلى.'
              : 'كن المبادر الأول في حيك واطرح سؤالاً أو اعرض مساعدة لجيرانك.',
          cta: searching || !hasExactLocation ? null : { label: 'اسأل أهل حيك الآن', bg: OASIS.colors.primary },
        };
    }
  })();

  const { Icon } = cfg;
  return (
    <View style={styles.emptyContainer}>
      <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}><OasisEmptyIllustration kind="empty-feed" /></View>
      <Text style={styles.emptyTitle}>{cfg.title}</Text>
      <Text style={styles.emptySub}>{cfg.sub}</Text>
      {cfg.cta && (
        <Pressable oasisKind="action"
          style={[styles.emptyAskBtn, { backgroundColor: cfg.cta.bg }]}
          onPress={() => router.push('/ask')}
          accessibilityRole="button"
        >
          <Text style={styles.emptyAskBtnText}>{cfg.cta.label}</Text>
        </Pressable>
      )}
    </View>
  );
}
