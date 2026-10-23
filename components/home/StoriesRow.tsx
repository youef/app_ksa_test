import { Image, ImageBackground, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ShieldCheck, ChevronLeft } from 'lucide-react-native';
import { styles } from './homeStyles';
import type { Profile, Story } from '@/lib/homeUtils';

type Props = {
  profile: Profile | null;
  stories: Story[];
  selectedDistrict: string;
};

export default function StoriesRow({ profile, stories, selectedDistrict }: Props) {
  const visibleStories = stories.slice(0, 4);

  return (
    <View style={[styles.storiesContainer, { position: 'relative', overflow: 'hidden', backgroundColor: 'transparent', borderBottomWidth: 0, justifyContent: 'center' }]}>
      <ImageBackground
        source={{ uri: Platform.OS === 'web' ? '/welcome/hayna-stories-background.png' : 'https://appksatest.vercel.app/welcome/hayna-stories-background.png' }}
        resizeMode="stretch"
        pointerEvents="none"
        style={StyleSheet.absoluteFillObject}
        imageStyle={{ opacity: 1 }}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.storiesScroll, { flexGrow: 1, justifyContent: 'center', alignItems: 'center' }]}>
        {visibleStories.map(story => {
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

        {/* Permanent fifth slot: More */}
        <Pressable
          style={styles.storyBox}
          onPress={() => router.push('/stories')}
          accessibilityRole="button"
          accessibilityLabel="عرض المزيد من اليوميات"
        >
          <View style={{
            width: 58,
            height: 58,
            borderRadius: 29,
            backgroundColor: '#ecfdf5',
            borderWidth: 2,
            borderColor: '#a7f3d0',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <ChevronLeft size={22} color="#059669" />
          </View>
          <Text style={styles.storyName}>المزيد</Text>

        </Pressable>
      </ScrollView>
    </View>
  );
}
