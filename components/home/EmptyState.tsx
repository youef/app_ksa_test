import { OasisEmptyIllustration } from '@/components/oasis/OasisEmptyIllustration';
import { OasisPressable as Pressable } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { memo, useMemo } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { styles } from './homeStyles';
import type { HomeTab } from '@/lib/homeUtils';

/* -------------------------------------------------------------------------- */
/*                                 Types                                      */
/* -------------------------------------------------------------------------- */

type Props = {
  tab: HomeTab;
  searching: boolean;
  city: string;
  hasExactLocation: boolean;
};

type Cta = {
  label: string;
  /** المسار الفعلي — لم يعد ثابتاً على /ask */
  route: string;
};

type Config = {
  title: string;
  sub: string;
  cta: Cta | null;
  /** نوع الرسم التوضيحي — يسمح بتخصيصه لكل تبويب */
  illustrationKind?: string;
};

/* -------------------------------------------------------------------------- */
/*                               Constants                                    */
/* -------------------------------------------------------------------------- */

const SEARCH_SUB = 'جرّب كلمات أخرى أو امسح البحث.';

/** مسارات CTA لكل تبويب — مصدر واحد للحقيقة */
const CTA_ROUTES: Record<HomeTab, string> = {
  mine: '/ask',
  emergency: '/ask', // لن يُستخدم عادةً (لا CTA)
  tools: '/tools/new', // ← عدّل حسب مسارك الفعلي
  questions: '/ask',
  requests: '/ask', // لن يُستخدم عادةً (لا CTA)
  all: '/ask',
} as Record<HomeTab, string>;

/* -------------------------------------------------------------------------- */
/*                              Config Builder                                */
/* -------------------------------------------------------------------------- */

function buildConfig(
  tab: HomeTab,
  searching: boolean,
  city: string,
  hasExactLocation: boolean,
): Config {
  // city آمنة للعرض
  const safeCity = city?.trim() || 'حيّك';

  switch (tab) {
    case 'mine':
      return searching
        ? {
            title: 'لا توجد منشورات تطابق البحث',
            sub: SEARCH_SUB,
            cta: null,
            illustrationKind: 'empty-feed',
          }
        : {
            title: 'لا توجد منشورات بعد',
            sub: 'استفساراتك وطلباتك ستظهر هنا عند نشرها في الحي.',
            cta: { label: 'انشر أول استفسار لك', route: CTA_ROUTES.mine },
            illustrationKind: 'empty-feed',
          };

    case 'emergency':
      return searching
        ? {
            title: 'لا توجد نتائج طوارئ مطابقة',
            sub: SEARCH_SUB,
            cta: null,
            illustrationKind: 'empty-emergency',
          }
        : {
            title: 'الحمد لله، لا توجد طوارئ',
            sub: 'الحي آمن ومستقر بفضل الله.',
            cta: null,
            illustrationKind: 'empty-emergency',
          };

    case 'tools':
      return searching
        ? {
            title: 'لا توجد عروض إعارة مطابقة',
            sub: SEARCH_SUB,
            cta: null,
            illustrationKind: 'empty-tools',
          }
        : {
            title: 'لا توجد عروض إعارة حالياً',
            sub: 'هل لديك سلم أو دريل أو أدوات ترغب بإعارتها لجيرانك؟',
            cta: {
              label: 'اعرض أداة للإعارة المجانية',
              route: CTA_ROUTES.tools,
            },
            illustrationKind: 'empty-tools',
          };

    case 'questions':
      return searching
        ? {
            title: 'لا توجد استفسارات مطابقة',
            sub: SEARCH_SUB,
            cta: null,
            illustrationKind: 'empty-feed',
          }
        : {
            title: 'لا توجد استفسارات حالياً',
            sub: 'اطرح سؤالك الأول لأهل الحي وتلقَّ ردوداً وتوصيات مجرّبة.',
            cta: { label: 'اطرح سؤالك الآن', route: CTA_ROUTES.questions },
            illustrationKind: 'empty-feed',
          };

    case 'requests':
      return searching
        ? {
            title: 'لا توجد طلبات مطابقة',
            sub: SEARCH_SUB,
            cta: null,
            illustrationKind: 'empty-feed',
          }
        : {
            title: 'لا توجد طلبات فزعة حالياً',
            sub: 'شارك جيرانك أي مساعدة تحتاجها وسيقف أهل حيك بجانبك.',
            // يمكن إضافة CTA لاحقاً بـ CTA_ROUTES.requests
            cta: null,
            illustrationKind: 'empty-feed',
          };

    default:
      return searching
        ? {
            title: 'لا توجد نتائج مطابقة للبحث',
            sub: 'جرّب كلمات أخرى أو امسح البحث لعرض جميع المنشورات.',
            cta: null,
            illustrationKind: 'empty-feed',
          }
        : !hasExactLocation
          ? {
              title: 'حدّد حيّك لعرض منشورات جيرانك',
              sub: 'تُعرض المنشورات حسب الحي فقط لحماية خصوصية الجميع. اختر منطقتك ومدينتك وحيّك من الأعلى.',
              cta: null,
              illustrationKind: 'empty-feed',
            }
          : {
              title: `لا توجد استفسارات في ${safeCity} حالياً`,
              sub: 'كن المبادر الأول في حيك واطرح سؤالاً أو اعرض مساعدة لجيرانك.',
              cta: { label: 'اسأل أهل حيك الآن', route: CTA_ROUTES.all },
              illustrationKind: 'empty-feed',
            };
  }
}

/* -------------------------------------------------------------------------- */
/*                               Component                                    */
/* -------------------------------------------------------------------------- */

function EmptyStateBase({ tab, searching, city, hasExactLocation }: Props) {
  const cfg = useMemo(
    () => buildConfig(tab, searching, city, hasExactLocation),
    [tab, searching, city, hasExactLocation],
  );

  const handleCtaPress = () => {
    if (cfg.cta) router.push(cfg.cta.route as never);
  };

  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIllustrationWrap}>
        <OasisEmptyIllustration
          kind={(cfg.illustrationKind ?? 'empty-feed') as never}
        />
      </View>

      <Text style={styles.emptyTitle}>{cfg.title}</Text>
      <Text style={styles.emptySub}>{cfg.sub}</Text>

      {cfg.cta && (
        <Pressable
          oasisKind="action"
          style={styles.emptyAskBtn}
          onPress={handleCtaPress}
          accessibilityRole="button"
          accessibilityLabel={cfg.cta.label}
          accessibilityHint={cfg.sub}
        >
          <Text style={styles.emptyAskBtnText}>{cfg.cta.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

export default memo(EmptyStateBase);