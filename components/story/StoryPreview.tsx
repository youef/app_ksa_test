import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera, Check, Layers, UploadCloud, X } from 'lucide-react-native';
import { SC } from './theme';

interface Props {
  slideType: 'image' | 'text';
  content: string;
  imageUri: string | null;
  autoFocus: boolean;
  activeIdx: number;
  slideCount: number;
  gradientColors: [string, string];
  isReady: boolean;
  publishing: boolean;
  status: string;
  onChangeContent: (text: string) => void;
  onClose: () => void;
  onPublish: () => void;
  onPickImages: () => void;
  onTakePhoto: () => void;
}

export function StoryPreview(props: Props) {
  const hasImage = props.slideType === 'image' && !!props.imageUri;
  const disabled = !props.isReady || props.publishing;

  return (
    <LinearGradient
      colors={hasImage ? SC.imageScrim : props.gradientColors}
      style={styles.preview}
    >
      {hasImage ? <Image source={{ uri: props.imageUri! }} style={styles.image} resizeMode="cover" /> : null}

      <View style={styles.toolbar}>
        <Pressable onPress={props.onClose} style={styles.toolBtn} hitSlop={8}>
          <X size={22} color={SC.white} />
        </Pressable>

        <View style={styles.counterBadge}>
          <Layers size={14} color={SC.mint} />
          <Text style={styles.counterText}>
            شريحة {props.activeIdx + 1} من {props.slideCount}
          </Text>
        </View>

        <Pressable
          style={[styles.publishBtn, disabled && styles.disabled]}
          onPress={props.onPublish}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="نشر القصة"
        >
          {props.publishing ? (
            <ActivityIndicator size="small" color={SC.white} />
          ) : (
            <View style={styles.publishInner}>
              <Check size={18} color={SC.white} />
              <Text style={styles.publishLabel}>نشر</Text>
            </View>
          )}
        </Pressable>
      </View>

      <View style={styles.canvas}>
        {props.slideType === 'text' ? (
          <TextInput
            style={styles.textInput}
            value={props.content}
            onChangeText={props.onChangeContent}
            placeholder="اكتب حالتك أو فكرتك هنا..."
            placeholderTextColor="rgba(255,255,255,0.65)"
            multiline
            textAlign="center"
            maxLength={300}
            autoFocus={props.autoFocus}
          />
        ) : hasImage ? (
          <View style={styles.captionWrap}>
            {props.content ? (
              <View style={styles.captionBubble}>
                <Text style={styles.caption}>{props.content}</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.pickCard}>
            <View style={styles.pickIcon}>
              <UploadCloud size={32} color={SC.primary} />
            </View>
            <Text style={styles.pickTitle}>اختر صورة لهذه الشريحة</Text>
            <Text style={styles.pickSub}>يمكنك رفع صور متعددة دفعة واحدة من جهازك</Text>

            <Pressable style={styles.pickBtn} onPress={props.onPickImages}>
              <UploadCloud size={18} color={SC.white} />
              <Text style={styles.pickBtnText}>معرض الصور / ملفات الجهاز</Text>
            </Pressable>

            <Pressable style={styles.cameraBtn} onPress={props.onTakePhoto}>
              <Camera size={18} color={SC.primary} />
              <Text style={styles.cameraBtnText}>التقاط بالكاميرا</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.progressRow}>
        {Array.from({ length: props.slideCount }).map((_, i) => (
          <View
            key={i}
            style={[styles.progressSegment, i === props.activeIdx && styles.progressSegmentActive]}
          />
        ))}
      </View>

      {props.publishing && props.status ? (
        <View style={styles.statusOverlay} pointerEvents="none">
          <Text style={styles.statusText}>{props.status}</Text>
        </View>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  preview: {
    flex: 1,
    minHeight: 320,
    position: 'relative',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  image: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  toolbar: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  toolBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SC.scrim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: SC.scrim,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  counterText: { color: SC.white, fontSize: 12, fontWeight: '800' },
  publishBtn: {
    backgroundColor: SC.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  publishInner: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5 },
  publishLabel: { color: SC.white, fontWeight: '800', fontSize: 13 },
  disabled: { opacity: 0.5 },
  canvas: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  textInput: {
    color: SC.white,
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    width: '100%',
    lineHeight: 38,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  captionWrap: { flex: 1, justifyContent: 'flex-end', width: '100%', paddingBottom: 16 },
  captionBubble: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: 'center',
    maxWidth: '90%',
  },
  caption: { color: SC.white, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  pickCard: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    width: '88%',
  },
  pickIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: SC.mintSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  pickTitle: { fontSize: 16, fontWeight: '900', color: SC.panelDeep, marginBottom: 4 },
  pickSub: { fontSize: 12, color: SC.mutedSoft, textAlign: 'center', marginBottom: 16 },
  pickBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: SC.primary,
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  pickBtnText: { color: SC.white, fontSize: 13, fontWeight: '800' },
  cameraBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: SC.mintSoft,
    borderWidth: 1.5,
    borderColor: '#a7f3d0',
    width: '100%',
    paddingVertical: 11,
    borderRadius: 12,
  },
  cameraBtnText: { color: SC.primary, fontSize: 13, fontWeight: '800' },
  progressRow: { flexDirection: 'row', gap: 4, paddingHorizontal: 16, marginBottom: 10, zIndex: 10 },
  progressSegment: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2 },
  progressSegmentActive: { backgroundColor: SC.white },
  statusOverlay: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusText: { color: SC.white, fontSize: 12, fontWeight: '800' },
});
