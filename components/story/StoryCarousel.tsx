import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ImageIcon, Type, Trash2 } from 'lucide-react-native';
import { getGradient } from '@/lib/storyGradients';
import type { StorySlide } from '@/lib/storyTypes';
import { SC } from './theme';

interface Props {
  slides: StorySlide[];
  activeIdx: number;
  atCapacity: boolean;
  onSelect: (index: number) => void;
  onRemove: (index: number) => void;
  onAddImages: () => void;
  onAddText: () => void;
}

export function StoryCarousel({
  slides,
  activeIdx,
  atCapacity,
  onSelect,
  onRemove,
  onAddImages,
  onAddText,
}: Props) {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <Pressable
          style={[styles.addBtn, atCapacity && styles.addBtnDisabled]}
          onPress={onAddImages}
          disabled={atCapacity}
          accessibilityRole="button"
          accessibilityLabel="إضافة صور"
        >
          <ImageIcon size={18} color={SC.mint} />
          <Text style={styles.addText}>+ صور</Text>
        </Pressable>

        <Pressable
          style={[styles.addBtn, atCapacity && styles.addBtnDisabled]}
          onPress={onAddText}
          disabled={atCapacity}
          accessibilityRole="button"
          accessibilityLabel="إضافة شريحة نصية"
        >
          <Type size={18} color={SC.mint} />
          <Text style={styles.addText}>+ نص</Text>
        </Pressable>

        {slides.map((slide, idx) => {
          const isActive = idx === activeIdx;
          const gradient = getGradient(slide.bgGradId);

          return (
            <Pressable
              key={slide.id}
              style={[styles.thumb, isActive && styles.thumbActive]}
              onPress={() => onSelect(idx)}
              accessibilityRole="button"
              accessibilityLabel={`الشريحة ${idx + 1}`}
              accessibilityState={{ selected: isActive }}
            >
              {slide.type === 'image' && slide.imageUri ? (
                <Image source={{ uri: slide.imageUri }} style={styles.thumbImage} />
              ) : (
                <LinearGradient colors={gradient.colors} style={styles.thumbGradient}>
                  <Text style={styles.thumbText} numberOfLines={2}>
                    {slide.content || '✍️ نص'}
                  </Text>
                </LinearGradient>
              )}

              <View style={styles.indexBadge}>
                <Text style={styles.indexText}>{idx + 1}</Text>
              </View>

              <Pressable
                style={styles.deleteBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  onRemove(idx);
                }}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`حذف الشريحة ${idx + 1}`}
              >
                <Trash2 size={11} color={SC.white} />
              </Pressable>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: SC.panelAlt,
    borderBottomWidth: 1,
    borderColor: SC.borderSoft,
    paddingVertical: 12,
  },
  scroll: {
    paddingHorizontal: 16,
    flexDirection: 'row-reverse',
    gap: 10,
    alignItems: 'center',
  },
  addBtn: {
    width: 68,
    height: 84,
    borderRadius: 14,
    backgroundColor: SC.panel,
    borderWidth: 1.5,
    borderColor: SC.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  addBtnDisabled: { opacity: 0.4 },
  addText: { color: SC.mint, fontSize: 11, fontWeight: '800' },
  thumb: {
    width: 64,
    height: 84,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: SC.borderSoft,
  },
  thumbActive: { borderColor: SC.primary, transform: [{ scale: 1.05 }] },
  thumbImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  thumbGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  thumbText: { color: SC.white, fontSize: 9, fontWeight: '800', textAlign: 'center' },
  indexBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  indexText: { color: SC.white, fontSize: 10, fontWeight: '900' },
  deleteBtn: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(239,68,68,0.85)',
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
