import { Pressable, Text, View } from 'react-native';
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
          Icon: User, color: '#059669',
          title: searching ? 'لا توجد منشورات تطابق البحث' : 'لا توجد منشورات بعد',
          sub: searching ? searchSub : 'استفساراتك وطلباتك ستظهر هنا عند نشرها في الحي.',
          cta: searching ? null : { label: 'انشر أول استفسار لك', bg: '#059669' },
        };
      case 'emergency':
        return {
          Icon: ShieldCheck, color: '#16a34a',
          title: searching ? 'لا توجد نتائج طوارئ مطابقة' : 'الحمد لله، لا توجد طوارئ',
          sub: searching ? searchSub : 'الحي آمن ومستقر بفضل الله.',
          cta: null,
        };
      case 'tools':
        return {
          Icon: Wrench, color: '#16a34a',
          title: searching ? 'لا توجد عروض إعارة مطابقة' : 'لا توجد عروض إعارة حالياً',
          sub: searching ? searchSub : 'هل لديك سلم أو دريل أو أدوات ترغب بإعارتها لجيرانك؟',
          cta: searching ? null : { label: 'اعرض أداة للإعارة المجانية', bg: '#16a34a' },
        };
      case 'questions':
        return {
          Icon: MessageCircle, color: '#059669',
          title: searching ? 'لا توجد استفسارات مطابقة' : 'لا توجد استفسارات حالياً',
          sub: searching ? searchSub : 'اطرح سؤالك الأول لأهل الحي وتلقَّ ردوداً وتوصيات مجرّبة.',
          cta: searching ? null : { label: 'اطرح سؤالك الآن', bg: '#059669' },
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
          Icon: Sparkles, color: '#059669',
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
          cta: searching || !hasExactLocation ? null : { label: 'اسأل أهل حيك الآن', bg: '#059669' },
        };
    }
  })();

  const { Icon } = cfg;
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconBg}>
        <Icon size={36} color={cfg.color} />
      </View>
      <Text style={styles.emptyTitle}>{cfg.title}</Text>
      <Text style={styles.emptySub}>{cfg.sub}</Text>
      {cfg.cta && (
        <Pressable
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
