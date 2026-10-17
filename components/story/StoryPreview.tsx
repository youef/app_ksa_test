import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Camera,
  Check,
  Layers,
  Minus,
  Plus,
  RotateCcw,
  RotateCw,
  Send,
  UploadCloud,
  X,
} from 'lucide-react-native';
import { SC } from './theme';

type Audience = 'everyone' | 'friends' | 'custom';
type InteractiveType = 'none' | 'poll' | 'question';

export interface StoryPublishOptions {
  audience: Audience;
  customAudience: string;
  interactiveType: InteractiveType;
  pollQuestion: string;
  pollOptions: [string, string];
  questionPrompt: string;
  textColor: string;
  fontSize: number;
  fontFamily: string;
  rotation: number;
  offsetX: number;
  offsetY: number;
  /** Compressed local image URI, when an onCompressImage callback is supplied. */
  imageUri: string | null;
}

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
  /** Upload progress from 0 to 1 or 0 to 100. */
  uploadProgress?: number;
  onChangeContent: (text: string) => void;
  onClose: () => void;
  onPublish: () => void | Promise<void>;
  /** Optional advanced publish handler. Use this to persist audience, poll, and text styling. */
  onPublishWithOptions?: (options: StoryPublishOptions) => void | Promise<void>;
  /** Optional real image compressor, e.g. using expo-image-manipulator. */
  onCompressImage?: (uri: string) => Promise<string>;
  /** Optional picker for a custom audience/list. */
  onSelectCustomAudience?: () => void;
  onPickImages: () => void;
  onTakePhoto: () => void;
}

const TEXT_COLORS = [
  '#FFFFFF', '#111827', '#F87171', '#FBBF24',
  '#34D399', '#60A5FA', '#C084FC', '#FB7185',
];

const FONT_OPTIONS = [
  { label: 'عادي', value: 'System' },
  { label: 'كلاسيكي', value: 'serif' },
  { label: 'أحادي', value: 'monospace' },
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function StoryPreview(props: Props) {
  const hasImage = props.slideType === 'image' && !!props.imageUri;
  const [interactiveType, setInteractiveType] = useState<InteractiveType>('none');
  const [audience, setAudience] = useState<Audience>('everyone');
  const [customAudience, setCustomAudience] = useState('');
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [fontSize, setFontSize] = useState(24);
  const [fontFamily, setFontFamily] = useState('System');
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptionA, setPollOptionA] = useState('نعم');
  const [pollOptionB, setPollOptionB] = useState('لا');
  const [questionPrompt, setQuestionPrompt] = useState('');
  const [publishError, setPublishError] = useState('');
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const dragOrigin = useRef({ x: 0, y: 0 });

  const disabled = !props.isReady || props.publishing || retrying;
  const progress = props.uploadProgress == null
    ? null
    : clamp(props.uploadProgress > 1 ? props.uploadProgress / 100 : props.uploadProgress, 0, 1);

  const textPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3,
        onPanResponderGrant: () => {
          dragOrigin.current = { ...offset };
        },
        onPanResponderMove: (_, gesture) => {
          setOffset({
            x: clamp(dragOrigin.current.x + gesture.dx, -140, 140),
            y: clamp(dragOrigin.current.y + gesture.dy, -260, 260),
          });
        },
      }),
    [offset],
  );

  const publish = async () => {
    if (disabled) return;
    setPublishError('');
    setPublishSuccess(false);
    setRetrying(true);

    try {
      let finalImageUri = props.imageUri;
      if (finalImageUri && props.onCompressImage) {
        finalImageUri = await props.onCompressImage(finalImageUri);
      }

      const publishResult = props.onPublishWithOptions
        ? props.onPublishWithOptions({
            audience,
            customAudience,
            interactiveType,
            pollQuestion: pollQuestion.trim(),
            pollOptions: [pollOptionA.trim(), pollOptionB.trim()],
            questionPrompt: questionPrompt.trim(),
            textColor,
            fontSize,
            fontFamily,
            rotation,
            offsetX: offset.x,
            offsetY: offset.y,
            imageUri: finalImageUri,
          })
        : props.onPublish();

      // A Promise lets this component know when the publish operation has finished.
      // A legacy synchronous callback may only start an external upload, so don't
      // display a success message prematurely in that case.
      if (publishResult && typeof (publishResult as Promise<void>).then === 'function') {
        await publishResult;
        setPublishSuccess(true);
      }
    } catch (error) {
      setPublishError(
        error instanceof Error && error.message
          ? error.message
          : 'تعذّر نشر القصة. تحقق من الاتصال ثم حاول مجددًا.',
      );
    } finally {
      setRetrying(false);
    }
  };

  const renderText = (editable: boolean) => {
    const textStyle = [
      styles.storyText,
      {
        color: textColor,
        fontSize,
        fontFamily,
        transform: [
          { translateX: offset.x },
          { translateY: offset.y },
          { rotate: `${rotation}deg` },
        ],
      },
    ];

    if (editable) {
      return (
        <View
          {...textPanResponder.panHandlers}
          style={styles.draggableText}
          accessibilityHint="اسحب النص لتغيير موضعه"
        >
          <TextInput
            style={textStyle}
            value={props.content}
            onChangeText={props.onChangeContent}
            placeholder="اكتب حالتك أو فكرتك هنا..."
            placeholderTextColor="rgba(255,255,255,0.65)"
            multiline
            textAlign="center"
            maxLength={300}
            autoFocus={props.autoFocus}
            accessibilityLabel="نص القصة"
          />
        </View>
      );
    }

    return props.content ? (
      <View style={styles.captionWrap}>
        <View style={[styles.captionBubble, {
          transform: [
            { translateX: offset.x },
            { translateY: offset.y },
            { rotate: `${rotation}deg` },
          ],
        }]}>
          <Text style={[styles.caption, { color: textColor, fontSize, fontFamily }]}>
            {props.content}
          </Text>
        </View>
      </View>
    ) : null;
  };

  return (
    <LinearGradient
      colors={hasImage ? SC.imageScrim : props.gradientColors}
      style={styles.preview}
    >
      {hasImage ? (
        <Image
          source={{ uri: props.imageUri! }}
          style={styles.image}
          resizeMode="cover"
          accessibilityLabel="صورة القصة"
        />
      ) : null}

      <View style={styles.toolbar}>
        <Pressable
          onPress={props.onClose}
          style={styles.toolBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="إغلاق محرر القصة"
          disabled={props.publishing || retrying}
        >
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
          onPress={publish}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="نشر القصة"
        >
          {props.publishing || retrying ? (
            <ActivityIndicator size="small" color={SC.white} />
          ) : (
            <View style={styles.publishInner}>
              <Send size={16} color={SC.white} />
              <Text style={styles.publishLabel}>نشر</Text>
            </View>
          )}
        </Pressable>
      </View>

      <View style={styles.canvas}>
        {props.slideType === 'text' ? (
          renderText(true)
        ) : hasImage ? (
          <View style={styles.imageCanvas}>
            {renderText(false)}
          </View>
        ) : (
          <View style={styles.pickCard}>
            <View style={styles.pickIcon}>
              <UploadCloud size={32} color={SC.primary} />
            </View>
            <Text style={styles.pickTitle}>اختر صورة لهذه الشريحة</Text>
            <Text style={styles.pickSub}>
              اختر صورة من جهازك أو التقط صورة بالكاميرا
            </Text>
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

      {interactiveType === 'poll' ? (
        <View style={styles.interactivePreview}>
          <Text style={styles.interactiveTitle}>
            {pollQuestion || 'سؤال الاستطلاع'}
          </Text>
          <View style={styles.pollOption}>
            <Text style={styles.pollOptionText}>{pollOptionA || 'الخيار الأول'}</Text>
          </View>
          <View style={styles.pollOption}>
            <Text style={styles.pollOptionText}>{pollOptionB || 'الخيار الثاني'}</Text>
          </View>
        </View>
      ) : null}

      {interactiveType === 'question' ? (
        <View style={styles.interactivePreview}>
          <Text style={styles.interactiveTitle}>
            {questionPrompt || 'اسأل متابعيك سؤالًا'}
          </Text>
          <View style={styles.questionPlaceholder}>
            <Text style={styles.questionPlaceholderText}>اكتب إجابتك...</Text>
          </View>
        </View>
      ) : null}

      <ScrollView
        style={styles.editorPanel}
        contentContainerStyle={styles.editorContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>تنسيق النص</Text>
        <View style={styles.controlRow}>
          <Pressable
            style={styles.smallControl}
            onPress={() => setFontSize((size) => clamp(size - 2, 14, 48))}
            accessibilityLabel="تصغير النص"
          >
            <Minus size={17} color={SC.white} />
          </Pressable>
          <Text style={styles.controlValue}>{fontSize}</Text>
          <Pressable
            style={styles.smallControl}
            onPress={() => setFontSize((size) => clamp(size + 2, 14, 48))}
            accessibilityLabel="تكبير النص"
          >
            <Plus size={17} color={SC.white} />
          </Pressable>
          <Pressable
            style={styles.smallControl}
            onPress={() => setRotation((value) => (value + 5) % 360)}
            accessibilityLabel="تدوير النص"
          >
            <RotateCw size={17} color={SC.white} />
          </Pressable>
          <Pressable
            style={styles.smallControl}
            onPress={() => setRotation((value) => (value - 5 + 360) % 360)}
            accessibilityLabel="تدوير النص عكس الاتجاه"
          >
            <RotateCcw size={17} color={SC.white} />
          </Pressable>
          <Pressable
            style={styles.smallControl}
            onPress={() => {
              setRotation(0);
              setOffset({ x: 0, y: 0 });
            }}
            accessibilityLabel="إعادة ضبط موضع النص"
          >
            <Text style={styles.resetText}>إعادة</Text>
          </Pressable>
        </View>

        <View style={styles.controlRow}>
          {TEXT_COLORS.map((color) => (
            <Pressable
              key={color}
              onPress={() => setTextColor(color)}
              style={[
                styles.colorSwatch,
                { backgroundColor: color },
                textColor === color && styles.colorSwatchSelected,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`لون النص ${color}`}
            />
          ))}
        </View>

        <View style={styles.controlRow}>
          {FONT_OPTIONS.map((font) => (
            <Pressable
              key={font.value}
              onPress={() => setFontFamily(font.value)}
              style={[
                styles.choiceChip,
                fontFamily === font.value && styles.choiceChipActive,
              ]}
            >
              <Text style={styles.choiceText}>{font.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>التفاعل</Text>
        <View style={styles.controlRow}>
          <Pressable
            onPress={() => setInteractiveType('none')}
            style={[styles.choiceChip, interactiveType === 'none' && styles.choiceChipActive]}
          >
            <Text style={styles.choiceText}>بدون</Text>
          </Pressable>
          <Pressable
            onPress={() => setInteractiveType('poll')}
            style={[styles.choiceChip, interactiveType === 'poll' && styles.choiceChipActive]}
          >
            <Text style={styles.choiceText}>استطلاع رأي</Text>
          </Pressable>
          <Pressable
            onPress={() => setInteractiveType('question')}
            style={[styles.choiceChip, interactiveType === 'question' && styles.choiceChipActive]}
          >
            <Text style={styles.choiceText}>سؤال</Text>
          </Pressable>
        </View>

        {interactiveType === 'poll' ? (
          <View style={styles.formGroup}>
            <TextInput
              style={styles.field}
              value={pollQuestion}
              onChangeText={setPollQuestion}
              placeholder="اكتب سؤال الاستطلاع"
              placeholderTextColor={SC.muted}
              maxLength={120}
              textAlign="right"
            />
            <TextInput
              style={styles.field}
              value={pollOptionA}
              onChangeText={setPollOptionA}
              placeholder="الخيار الأول"
              placeholderTextColor={SC.muted}
              maxLength={50}
              textAlign="right"
            />
            <TextInput
              style={styles.field}
              value={pollOptionB}
              onChangeText={setPollOptionB}
              placeholder="الخيار الثاني"
              placeholderTextColor={SC.muted}
              maxLength={50}
              textAlign="right"
            />
          </View>
        ) : null}

        {interactiveType === 'question' ? (
          <TextInput
            style={styles.field}
            value={questionPrompt}
            onChangeText={setQuestionPrompt}
            placeholder="اكتب السؤال الذي سيظهر للمتابعين"
            placeholderTextColor={SC.muted}
            maxLength={180}
            textAlign="right"
          />
        ) : null}

        <Text style={styles.sectionTitle}>من يستطيع مشاهدة القصة؟</Text>
        <View style={styles.controlRow}>
          {([
            ['everyone', 'الجميع'],
            ['friends', 'الأصدقاء'],
            ['custom', 'قائمة مخصصة'],
          ] as const).map(([value, label]) => (
            <Pressable
              key={value}
              onPress={() => {
                setAudience(value);
                if (value === 'custom') props.onSelectCustomAudience?.();
              }}
              style={[styles.choiceChip, audience === value && styles.choiceChipActive]}
            >
              <Text style={styles.choiceText}>{label}</Text>
            </Pressable>
          ))}
        </View>
        {audience === 'custom' ? (
          <TextInput
            style={styles.field}
            value={customAudience}
            onChangeText={setCustomAudience}
            placeholder="معرّف القائمة المخصصة أو اسمها"
            placeholderTextColor={SC.muted}
            textAlign="right"
          />
        ) : null}
      </ScrollView>

      {props.publishing || retrying ? (
        <View style={styles.statusOverlay} pointerEvents="none">
          <Text style={styles.statusText}>
            {props.status || 'جارٍ تجهيز القصة ونشرها...'}
          </Text>
          {progress !== null ? (
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
          ) : null}
          {progress !== null ? (
            <Text style={styles.progressLabel}>{Math.round(progress * 100)}%</Text>
          ) : null}
        </View>
      ) : null}

      {!props.publishing && !retrying && publishError ? (
        <View style={[styles.feedback, styles.errorFeedback]}>
          <Text style={styles.feedbackText}>{publishError}</Text>
          <Pressable onPress={publish} style={styles.retryButton}>
            <RotateCw size={15} color={SC.white} />
            <Text style={styles.retryText}>إعادة المحاولة</Text>
          </Pressable>
        </View>
      ) : null}

      {!props.publishing && !retrying && publishSuccess ? (
        <View style={[styles.feedback, styles.successFeedback]}>
          <Check size={17} color={SC.white} />
          <Text style={styles.feedbackText}>تم إرسال طلب النشر بنجاح</Text>
        </View>
      ) : null}

      <View style={styles.progressRow}>
        {Array.from({ length: Math.max(0, props.slideCount) }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.progressSegment,
              i === props.activeIdx && styles.progressSegmentActive,
            ]}
          />
        ))}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  preview: {
    flex: 1,
    minHeight: 520,
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
    paddingTop: 8,
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
    minWidth: 74,
  },
  publishInner: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5 },
  publishLabel: { color: SC.white, fontWeight: '800', fontSize: 13 },
  disabled: { opacity: 0.5 },
  canvas: {
    flex: 1,
    minHeight: 180,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  draggableText: {
    width: '100%',
    minHeight: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyText: {
    fontWeight: '900',
    textAlign: 'center',
    width: '100%',
    lineHeight: 38,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
    padding: 8,
  },
  imageCanvas: { flex: 1, width: '100%', justifyContent: 'center' },
  captionWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  captionBubble: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: 'center',
    maxWidth: '95%',
  },
  caption: { fontWeight: '800', textAlign: 'center' },
  pickCard: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
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
  editorPanel: {
    maxHeight: 220,
    flexGrow: 0,
    backgroundColor: 'rgba(15,23,42,0.94)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  editorContent: { paddingHorizontal: 14, paddingVertical: 10, gap: 9 },
  sectionTitle: {
    color: SC.white,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
    marginTop: 3,
  },
  controlRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  smallControl: {
    minWidth: 36,
    height: 34,
    paddingHorizontal: 9,
    borderRadius: 10,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlValue: {
    color: SC.white,
    fontSize: 13,
    fontWeight: '800',
    minWidth: 24,
    textAlign: 'center',
  },
  resetText: { color: SC.white, fontSize: 11, fontWeight: '800' },
  colorSwatch: {
    width: 25,
    height: 25,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  colorSwatchSelected: { borderColor: SC.mint, borderWidth: 3 },
  choiceChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#334155',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  choiceChipActive: {
    backgroundColor: 'rgba(5,150,105,0.35)',
    borderColor: SC.mint,
  },
  choiceText: { color: SC.white, fontSize: 12, fontWeight: '800' },
  formGroup: { gap: 7 },
  field: {
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#475569',
    backgroundColor: 'rgba(15,23,42,0.9)',
    color: SC.white,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    marginTop: 4,
  },
  interactivePreview: {
    marginHorizontal: 24,
    marginBottom: 8,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.96)',
    gap: 7,
  },
  interactiveTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  pollOption: {
    padding: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    backgroundColor: '#ecfdf5',
  },
  pollOptionText: { color: '#065f46', textAlign: 'center', fontWeight: '800' },
  questionPlaceholder: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  questionPlaceholderText: { color: '#64748b', textAlign: 'center' },
  statusOverlay: {
    position: 'absolute',
    bottom: 44,
    left: 24,
    right: 24,
    zIndex: 20,
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    gap: 7,
  },
  statusText: { color: SC.white, fontSize: 12, fontWeight: '800', textAlign: 'center' },
  progressTrack: {
    height: 5,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: SC.mint },
  progressLabel: { color: SC.white, fontSize: 11, textAlign: 'center' },
  feedback: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 14,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  errorFeedback: { backgroundColor: '#991b1b' },
  successFeedback: { backgroundColor: '#047857' },
  feedbackText: { flex: 1, color: SC.white, fontSize: 12, fontWeight: '800', textAlign: 'right' },
  retryButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  retryText: { color: SC.white, fontSize: 11, fontWeight: '900' },
  progressRow: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    zIndex: 10,
  },
  progressSegment: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
  },
  progressSegmentActive: { backgroundColor: SC.white },
});
