import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera, ChevronLeft, ChevronRight, Image as ImageIcon, Sparkles, Type, UploadCloud } from 'lucide-react-native';
import { BG_GRADIENTS } from '@/lib/storyGradients';
import { STORY_LIMITS, type StorySlide, type StorySlideType } from '@/lib/storyTypes';
import { SC } from './theme';

interface Props {
  slide: StorySlide;
  activeIdx: number;
  slideCount: number;
  validCount: number;
  publishing: boolean;
  status: string;
  onChangeContent: (text: string) => void;
  onChangeType: (type: StorySlideType) => void;
  onChangeGradient: (id: number) => void;
  onPickImages: () => void;
  onTakePhoto: () => void;
  onStep: (delta: number) => void;
  onPublish: () => void;
}

export function StoryControls(props: Props) {
  const { slide } = props;
  const disabled = props.validCount === 0 || props.publishing;

  return (
    <ScrollView style={styles.controls} showsVerticalScrollIndicator={false}>
      <View style={styles.modeRow}>
        <Text style={styles.sectionHeader}>نوع الشريحة الحالية:</Text>
        <View style={styles.modeGroup}>
          <ModeToggle
            active={slide.type === 'text'}
            label="حالة نصية"
            icon={<Type size={15} color={slide.type === 'text' ? SC.primary : SC.muted} />}
            onPress={() => props.onChangeType('text')}
          />
          <ModeToggle
            active={slide.type === 'image'}
            label="صورة"
            icon={<ImageIcon size={15} color={slide.type === 'image' ? SC.primary : SC.muted} />}
            onPress={() => props.onChangeType('image')}
          />
        </View>
      </View>

      {slide.type === 'image' ? (
        <View style={styles.optionBox}>
          {slide.imageUri ? (
            <>
              <View style={styles.captionWrap}>
                <TextInput
                  style={styles.caption}
                  value={slide.content}
                  onChangeText={props.onChangeContent}
                  placeholder="أضف تعليقاً على هذه الصورة (اختياري)..."
                  placeholderTextColor={SC.muted}
                  maxLength={STORY_LIMITS.captionMaxLength}
                />
              </View>

              <View style={styles.actionsRow}>
                <ActionPill
                  icon={<UploadCloud size={15} color={SC.mint} />}
                  label="تغيير / إضافة صور"
                  onPress={props.onPickImages}
                />
                <ActionPill
                  icon={<Camera size={15} color={SC.mint} />}
                  label="التقاط بالكاميرا"
                  onPress={props.onTakePhoto}
                />
              </View>
            </>
          ) : null}
        </View>
      ) : (
        <View style={styles.optionBox}>
          <Text style={styles.bgLabel}>لون خلفية الحالة النصية:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.gradsScroll}
          >
            {BG_GRADIENTS.map((g) => (
              <Pressable
                key={g.id}
                onPress={() => props.onChangeGradient(g.id)}
                style={styles.gradOption}
                accessibilityRole="button"
                accessibilityState={{ selected: slide.bgGradId === g.id }}
                accessibilityLabel={g.name}
              >
                <GradientSwatch colors={g.colors} selected={slide.bgGradId === g.id} />
                <Text style={styles.gradName}>{g.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {props.slideCount > 1 ? (
        <View style={styles.navRow}>
          <Pressable
            style={[styles.navBtn, props.activeIdx === 0 && styles.navBtnDisabled]}
            onPress={() => props.onStep(-1)}
            disabled={props.activeIdx === 0}
            accessibilityRole="button"
            accessibilityLabel="الشريحة السابقة"
          >
            <ChevronRight size={20} color={props.activeIdx === 0 ? SC.border : SC.white} />
            <Text style={[styles.navText, props.activeIdx === 0 && styles.navTextDisabled]}>
              السابقة
            </Text>
          </Pressable>

          <Text style={styles.navCounter}>
            {props.activeIdx + 1} / {props.slideCount}
          </Text>

          <Pressable
            style={[
              styles.navBtn,
              props.activeIdx === props.slideCount - 1 && styles.navBtnDisabled,
            ]}
            onPress={() => props.onStep(1)}
            disabled={props.activeIdx === props.slideCount - 1}
            accessibilityRole="button"
            accessibilityLabel="الشريحة التالية"
          >
            <Text
              style={[
                styles.navText,
                props.activeIdx === props.slideCount - 1 && styles.navTextDisabled,
              ]}
            >
              التالية
            </Text>
            <ChevronLeft
              size={20}
              color={props.activeIdx === props.slideCount - 1 ? SC.border : SC.white}
            />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.infoBanner}>
        <Sparkles size={16} color={SC.primary} />
        <Text style={styles.infoText}>
          يمكنك نشر عدة صور وحالات نصية معاً في يوميات الحي لتظهر لأهل حيك لمدة 24 ساعة.
        </Text>
      </View>

      <Pressable
        style={[styles.publishFull, disabled && styles.publishFullDisabled]}
        onPress={props.onPublish}
        disabled={disabled}
        accessibilityRole="button"
      >
        {props.publishing ? (
          <View style={styles.uploading}>
            <ActivityIndicator size="small" color={SC.white} />
            <Text style={styles.uploadingText}>{props.status || 'جاري النشر...'}</Text>
          </View>
        ) : (
          <Text style={styles.publishFullText}>
            نشر {props.validCount > 1 ? `${props.validCount} شرائح` : 'القصة'} الآن ✨
          </Text>
        )}
      </Pressable>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function GradientSwatch({
  colors,
  selected,
}: {
  colors: [string, string];
  selected: boolean;
}) {
  return (
    <LinearGradient
      colors={colors}
      style={[styles.gradPreview, selected && styles.gradPreviewSelected]}
    />
  );
}

function ModeToggle({
  active,
  label,
  icon,
  onPress,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.modeItem, active && styles.modeItemActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      {icon}
      <Text style={[styles.modeText, active && styles.modeTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ActionPill({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.actionPill} onPress={onPress} accessibilityRole="button">
      {icon}
      <Text style={styles.actionPillText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  controls: { flex: 1, backgroundColor: SC.bg, padding: 16 },
  modeRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionHeader: { color: SC.muted, fontSize: 13, fontWeight: '800', textAlign: 'right' },
  modeGroup: {
    flexDirection: 'row-reverse',
    backgroundColor: SC.panel,
    borderRadius: 12,
    padding: 3,
    gap: 4,
  },
  modeItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9,
  },
  modeItemActive: { backgroundColor: SC.panelDeep },
  modeText: { color: SC.muted, fontSize: 12, fontWeight: '700' },
  modeTextActive: { color: SC.primary, fontWeight: '800' },
  optionBox: { marginBottom: 14 },
  captionWrap: {
    backgroundColor: SC.panel,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: SC.border,
  },
  caption: { color: SC.white, height: 44, fontSize: 13, textAlign: 'right' },
  actionsRow: { flexDirection: 'row-reverse', gap: 8 },
  actionPill: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: SC.panel,
    borderWidth: 1,
    borderColor: SC.border,
    borderRadius: 10,
    paddingVertical: 9,
  },
  actionPillText: { color: SC.mint, fontSize: 12, fontWeight: '700' },
  bgLabel: { color: SC.muted, fontSize: 12, fontWeight: '700', textAlign: 'right', marginBottom: 8 },
  gradsScroll: { flexDirection: 'row-reverse', gap: 10, paddingBottom: 4 },
  gradOption: { alignItems: 'center' },
  gradPreview: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2.5,
    borderColor: 'transparent',
  },
  gradPreviewSelected: { borderColor: SC.white, transform: [{ scale: 1.1 }] },
  gradName: { color: SC.mutedSoft, fontSize: 10, marginTop: 4, fontWeight: '700' },
  navRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: SC.panel,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  navBtn: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8 },
  navBtnDisabled: { opacity: 0.4 },
  navText: { color: SC.white, fontSize: 12, fontWeight: '800' },
  navTextDisabled: { color: SC.border },
  navCounter: { color: SC.mint, fontSize: 13, fontWeight: '900' },
  infoBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(5,150,105,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(5,150,105,0.3)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  infoText: { flex: 1, color: SC.mintSoft, fontSize: 12, fontWeight: '600', textAlign: 'right', lineHeight: 18 },
  publishFull: {
    backgroundColor: SC.primary,
    borderRadius: 30,
    paddingVertical: 15,
    alignItems: 'center',
  },
  publishFullDisabled: { backgroundColor: SC.border },
  publishFullText: { color: SC.white, fontSize: 15, fontWeight: '900' },
  uploading: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  uploadingText: { color: SC.white, fontSize: 14, fontWeight: '800' },
});
