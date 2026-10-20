import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera, Plus, ShieldCheck, ChevronLeft } from 'lucide-react-native';
import { styles } from './homeStyles';
import type { Profile, Story } from '@/lib/homeUtils';

type Props = {
  profile: Profile | null;
  stories: Story[];
  selectedDistrict: string;
};

export default function StoriesRow({ profile, stories, selectedDistrict }: Props) {
  const visibleStories = stories.slice(0, 12);

  const handleAddStory = () => {
    if (!profile) {
      router.push('/auth');
      return;
    }
    router.push('/create-story');
  };

  return (
    <View style={styles.storiesContainer}>
      <View style={[styles.storiesHeaderRow, { justifyContent: 'space-between' }]}>
        <View style={styles.storiesTitleRow}>
          <Text style={styles.storiesSectionTitle}>يوميات الحي</Text>
        </View>
        {visibleStories.length > 0 && <Pressable onPress={() => router.push('/stories')} accessibilityRole="button" accessibilityLabel="عرض كل يوميات الحي" style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }}><ChevronLeft size={18} color="#73857b" /></Pressable>}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.storiesScroll, { flexDirection: 'row-reverse', flexGrow: 1 }]}>
        {/* User's Add Story Bubble */}
        <Pressable
          style={styles.storyBox}
          onPress={handleAddStory}
          accessibilityRole="button"
          accessibilityLabel="أضف يومياتك"
        >
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
          <Text style={styles.storyName} numberOfLines={1}>أضف يومياتك</Text>

        </Pressable>

        {/* Active Neighbors Stories */}
        {visibleStories.map((story) => {
          const authorName = story.profiles?.display_name || story.profiles?.username || 'جار';
          const avatarUrl = story.profiles?.avatar_url;
          const verified = story.profiles?.is_verified || story.profiles?.is_geoverified;
          const bg = story.bg_color || '#059669';
          const storyDistrict = story.profiles?.district || (selectedDistrict !== 'كل الأحياء' ? selectedDistrict : 'جار الحي');
          const isImage = story.type === 'image' && Boolean(story.image_url);

          return (
            <Pressable
              key={story.id}
              style={styles.storyBox}
              onPress={() => router.push({ pathname: '/story', params: { id: story.id } })}
              accessibilityRole="button"
              accessibilityLabel={`يوميات ${authorName}`}
            >
              <LinearGradient
                colors={['#059669', '#10b981', '#06b6d4']}
                style={styles.storyGradientRing}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.storyInnerBorder}>
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.storyImg} />
                  ) : isImage ? (
                    <Image source={{ uri: story.image_url! }} style={styles.storyImg} />
                  ) : (
                    <View style={[styles.storyTextPreview, { backgroundColor: bg }]}>
                      <Text style={styles.storyTextPreviewLetter} numberOfLines={1}>
                        {story.content?.[0] || authorName[0] || 'ح'}
                      </Text>
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
                {storyDistrict}
              </Text>
            </Pressable>
          );
        })}

        {/* View All Stories Button */}
        {visibleStories.length > 0 && (
          <Pressable
            style={styles.storyBox}
            onPress={() => router.push('/stories')}
            accessibilityRole="button"
            accessibilityLabel="عرض المزيد من اليوميات"
          >
            <View style={{
              width: 62,
              height: 62,
              borderRadius: 31,
              backgroundColor: '#ecfdf5',
              borderWidth: 2,
              borderColor: '#a7f3d0',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 5,
            }}>
              <ChevronLeft size={22} color="#059669" />
            </View>
            <Text style={styles.storyName}>المزيد</Text>
            <Text style={styles.storyDistrictSub}>كل اليوميات</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}
