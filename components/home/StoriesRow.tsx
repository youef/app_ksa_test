import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera, Plus, ShieldCheck } from 'lucide-react-native';
import { styles } from './homeStyles';
import type { Profile, Story } from '@/lib/homeUtils';

type Props = {
  profile: Profile | null;
  stories: Story[];
  selectedDistrict: string;
};

export default function StoriesRow({ profile, stories, selectedDistrict }: Props) {
  return (
    <View style={styles.storiesContainer}>
      <View style={styles.storiesHeaderRow}>
        <Pressable
          style={styles.publishStoryHeaderBtn}
          onPress={() => router.push('/create-story')}
          accessibilityRole="button"
          accessibilityLabel="نشر يوميات"
        >
          <Plus size={14} color="#059669" />
          <Text style={styles.publishStoryHeaderText}>نشر يوميات</Text>
        </Pressable>
        <View style={styles.storiesTitleRow}>
          <View style={styles.storiesLiveBadge}>
            <View style={styles.storiesLivePulseDot} />
            <Text style={styles.storiesLiveText}>مباشر 24س</Text>
          </View>
          <Text style={styles.storiesSectionTitle}>يوميات الحي</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesScroll}>
        <Pressable style={styles.storyBox} onPress={() => router.push('/create-story')}>
          <LinearGradient
            colors={['#059669', '#10b981', '#34d399']}
            style={styles.storyAddRing}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.storyInnerBorder}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.storyImg} />
              ) : (
                <View style={styles.storySelfPlaceholder}>
                  <Camera size={20} color="#059669" />
                </View>
              )}
              <View style={styles.storySelfPlusBadge}>
                <Plus size={11} color="#fff" strokeWidth={3} />
              </View>
            </View>
          </LinearGradient>
          <Text style={styles.storyName}>أضف يومياتك</Text>
          <Text style={styles.storyDistrictSub}>قصتك أنت</Text>
        </Pressable>

        {stories.map(story => {
          const authorName = story.profiles?.display_name || story.profiles?.username || 'جار';
          const avatarUrl = story.profiles?.avatar_url;
          const verified = story.profiles?.is_verified || story.profiles?.is_geoverified;
          const bg = story.bg_color || '#059669';

          return (
            <Pressable
              key={story.id}
              style={styles.storyBox}
              onPress={() => router.push({ pathname: '/story', params: { id: story.id } })}
              accessibilityRole="button"
              accessibilityLabel={`يوميات ${authorName}`}
            >
              <LinearGradient
                colors={['#059669', '#10b981', '#3b82f6']}
                style={styles.storyGradientRing}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.storyInnerBorder}>
                  {story.type === 'text' ? (
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
                    <ShieldCheck size={9} color="#fff" />
                  </View>
                )}
              </LinearGradient>
              <Text style={styles.storyName} numberOfLines={1}>{authorName}</Text>
              <Text style={styles.storyDistrictSub} numberOfLines={1}>
                {selectedDistrict !== 'كل الأحياء' ? selectedDistrict : 'جار الحي'}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
