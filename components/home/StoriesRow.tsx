import { oasisAssets } from '@/components/oasis/assets';
import { OasisPressable as Pressable } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { Image, ImageBackground, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
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

export default function StoriesRow({ profile, stories, selectedDistrict }: Props) {
  const { colors, isDark } = useTheme();
  const visibleStories = stories.slice(0, 4);
  const ringColors = (p: Profile | null | undefined): [string, string, string] => {
    const type = String(p?.account_type || 'standard').toLowerCase();
    if (type === 'business' || type === 'merchant' || type === 'commercial') return ['#D97706', OASIS.colors.warning, '#FDE68A'];
    if (type === 'freelance' || type === 'professional') return ['#7C3AED', '#A78BFA', '#DDD6FE'];
    if (type === 'organization' || type === 'government') return ['#1D4ED8', '#60A5FA', '#BFDBFE'];
    if (p?.role === 'admin') return [OASIS.colors.deep, OASIS.colors.primary, '#34D399'];
    return [OASIS.colors.primary, OASIS.colors.primary, '#6EE7B7'];
  };

  return (
    <View style={[styles.storiesContainer, { position: 'relative', overflow: 'hidden', backgroundColor: 'transparent', borderBottomWidth: 0, justifyContent: 'center' }]}>

      <ScrollView horizontal  showsHorizontalScrollIndicator={false} style={{ direction: 'rtl' }} contentContainerStyle={[styles.storiesScroll, { direction: 'ltr', flexGrow: 1, justifyContent: 'flex-start', alignItems: 'center', flexDirection: 'row-reverse' }]}>
        {visibleStories.map(story => {
          const isAnonymous = story.profiles?.hide_name === true;
          const authorName = isAnonymous ? 'مجهول' : (story.profiles?.display_name || story.profiles?.username || 'جار');
          const username = story.profiles?.username ? `@${String(story.profiles.username).replace(/^@/, '')}` : '';
          const avatarUrl = story.profiles?.avatar_url;
          const verified = story.profiles?.is_verified || story.profiles?.is_geoverified;
          const bg = story.bg_color || OASIS.colors.primary;

          return (
            <Pressable
              key={story.id}
              style={styles.storyBox}
              onPress={() => router.push({ pathname: '/story', params: { id: story.id } })}
              accessibilityRole="button"
              accessibilityLabel={`يوميات ${authorName}`}
            >
              <LinearGradient
                colors={ringColors(story.profiles)}
                style={styles.storyGradientRing}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={[styles.storyInnerBorder, isDark && { borderColor: colors.surface, backgroundColor: colors.background }]}>
                  {isAnonymous ? (
                    <View style={[styles.storyTextPreview, { backgroundColor: isDark ? colors.soft : OASIS.colors.soft }]}><UserRound size={25} color={colors.primary} /></View>
                  ) : story.type === 'text' ? (
                    <View style={[styles.storyTextPreview, { backgroundColor: bg }]}>
                      <Text style={styles.storyTextPreviewLetter} numberOfLines={1}>{story.content?.[0] || 'ق'}</Text>
                    </View>
                  ) : avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.storyImg} />
                  ) : (
                    <View style={[styles.storyTextPreview, { backgroundColor: bg }]}>
                      <Text style={styles.storyTextPreviewLetter}>{authorName[0]}</Text>
                    </View>
                  )}
                </View>
                {verified && (
                  <View style={styles.storyVerifiedTag}>
                    <ShieldCheck size={9} color={OASIS.colors.surface} />
                  </View>
                )}
              </LinearGradient>
              <Text style={[styles.storyName, isDark && { color: colors.ink }]} numberOfLines={1}>{authorName}</Text>
              {isAnonymous && Boolean(username) && <Text style={[styles.storyDistrictSub, { textAlign: 'center' }]} numberOfLines={1}>{username}</Text>}
            </Pressable>
          );
        })}

        {/* Permanent fifth slot: More */}
        <Pressable
          style={styles.storyBox}
          onPress={() => router.push('/stories')}
          accessibilityRole="button"
          accessibilityLabel="عرض المزيد من اليوميات"
        >
          <View style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            backgroundColor: OASIS.colors.soft,
            borderWidth: 2,
            borderColor: '#a7f3d0',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <ChevronLeft size={22} color={OASIS.colors.primary} />
          </View>
          <Text style={styles.storyName}>المزيد</Text>

        </Pressable>
      </ScrollView>
    </View>
  );
}
