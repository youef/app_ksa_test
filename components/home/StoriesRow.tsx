import { OasisPressable as Pressable } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { memo, useMemo } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ShieldCheck, ChevronLeft, UserRound } from 'lucide-react-native';
import { styles } from './homeStyles';
import type { Profile, Story } from '@/lib/homeUtils';
import { useTheme } from '@/context/ThemeContext';

type Props = {
  profile: Profile | null;
  stories: Story[];
  selectedDistrict: string;
};

const MAX_VISIBLE = 4;

/* -------------------------------------------------------------------------- */
/*                              Pure Helpers                                  */
/* -------------------------------------------------------------------------- */

// تحقق آمن من لون hex
const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const safeBgColor = (value: string | null | undefined): string =>
  typeof value === 'string' && HEX_COLOR.test(value)
    ? value
    : OASIS.colors.primary;

// ألوان الحلقة حسب نوع الحساب — pure function خارج المكوّن
function getRingColors(p: Profile | null | undefined): [string, string, string] {
  const type = String(p?.account_type || 'standard').toLowerCase();

  if (type === 'business' || type === 'merchant' || type === 'commercial') {
    return ['#D97706', OASIS.colors.warning, '#FDE68A'];
  }
  if (type === 'freelance' || type === 'professional') {
    return ['#7C3AED', '#A78BFA', '#DDD6FE'];
  }
  if (type === 'organization' || type === 'government') {
    return ['#1D4ED8', '#60A5FA', '#BFDBFE'];
  }
  if (p?.role === 'admin') {
    return [OASIS.colors.deep, OASIS.colors.primary, '#34D399'];
  }
  return [OASIS.colors.primary, OASIS.colors.primary, '#6EE7B7'];
}

// استخرج النص الأول من محتوى آمن
function firstChar(value: unknown, fallback = 'ق'): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed[0] : fallback;
}

/* -------------------------------------------------------------------------- */
/*                                Component                                   */
/* -------------------------------------------------------------------------- */

function StoriesRowBase({ stories, selectedDistrict }: Props) {
  const { colors, isDark } = useTheme();

  // 4 قصص كحد أقصى — محسوبة مرة واحدة
  const visibleStories = useMemo(
    () => stories.slice(0, MAX_VISIBLE),
    [stories],
  );

  return (
    <View style={styles.storiesContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.storiesScrollContent}
      >
        {visibleStories.map((story) => {
          const isAnonymous = story.profiles?.hide_name === true;
          const authorName = isAnonymous
            ? 'مجهول'
            : story.profiles?.display_name ||
              story.profiles?.username ||
              'جار';
          const username = story.profiles?.username
            ? `@${String(story.profiles.username).replace(/^@/, '')}`
            : '';
          const avatarUrl = story.profiles?.avatar_url;
          const verified =
            story.profiles?.is_verified || story.profiles?.is_geoverified;
          const bg = safeBgColor(story.bg_color);

          // ماذا نعرض داخل الحلقة؟
          let preview: React.ReactNode;
          if (isAnonymous) {
            preview = (
              <View
                style={[
                  styles.storyTextPreview,
                  {
                    backgroundColor: isDark ? colors.soft : OASIS.colors.soft,
                  },
                ]}
              >
                <UserRound size={25} color={colors.primary} />
              </View>
            );
          } else if (story.type === 'text') {
            preview = (
              <View style={[styles.storyTextPreview, { backgroundColor: bg }]}>
                <Text style={styles.storyTextPreviewLetter} numberOfLines={1}>
                  {firstChar(story.content)}
                </Text>
              </View>
            );
          } else if (avatarUrl) {
            preview = (
              <Image
                source={{ uri: avatarUrl }}
                style={styles.storyImg}
                accessibilityIgnoresInvertColors
              />
            );
          } else {
            preview = (
              <View style={[styles.storyTextPreview, { backgroundColor: bg }]}>
                <Text style={styles.storyTextPreviewLetter}>
                  {firstChar(authorName, 'ج')}
                </Text>
              </View>
            );
          }

          return (
            <Pressable
              key={story.id}
              style={styles.storyBox}
              onPress={() =>
                router.push({ pathname: '/story', params: { id: story.id } })
              }
              accessibilityRole="button"
              accessibilityLabel={`يوميات ${authorName}`}
              accessibilityHint="يفتح القصة"
            >
              <LinearGradient
                colors={getRingColors(story.profiles)}
                style={styles.storyGradientRing}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View
                  style={[
                    styles.storyInnerBorder,
                    isDark && styles.storyInnerBorderDark,
                  ]}
                >
                  {preview}
                </View>
                {verified && (
                  <View style={styles.storyVerifiedTag}>
                    <ShieldCheck size={10} color={OASIS.colors.surface} />
                  </View>
                )}
              </LinearGradient>

              <Text
                style={[styles.storyName, isDark && styles.storyNameDark]}
                numberOfLines={1}
              >
                {authorName}
              </Text>

              {!isAnonymous && username ? (
                <Text
                  style={[styles.storyDistrictSub, styles.storyUsername]}
                  numberOfLines={1}
                >
                  {username}
                </Text>
              ) : null}
            </Pressable>
          );
        })}

        {/* شريحة "المزيد" الدائمة */}
        <Pressable
          style={styles.storyBox}
          onPress={() => router.push('/stories')}
          accessibilityRole="button"
          accessibilityLabel="عرض المزيد من اليوميات"
          accessibilityHint="يفتح كل اليوميات"
        >
          <View style={styles.storyMoreCircle}>
            <ChevronLeft size={22} color={OASIS.colors.primary} />
          </View>
          <Text style={styles.storyName}>المزيد</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

export default memo(StoriesRowBase);