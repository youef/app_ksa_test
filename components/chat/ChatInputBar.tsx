import { memo, useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import {
  OasisSurface,
  OasisPressable as Pressable,
  OasisTextInput as TextInput,
} from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { Plus, X, Paperclip, MapPin, Coffee, Smile, Send, Timer } from 'lucide-react-native';
import { chatStyles as styles } from './chatStyles';

/* -------------------------------------------------------------------------- */
/*                                Constants                                   */
/* -------------------------------------------------------------------------- */

const QUICK_PROMPTS = [
  '👋 السلام عليكم',
  '🤝 أقدر أساعدك',
  '📍 شارك موقعك',
  '👍 تم، أبشر',
  '☕ حيّاك الله يا جارنا',
] as const;

const EMOJI_LIST = [
  '😀', '😂', '😍', '🥰', '😘', '😎', '🤍', '❤️', '💚', '👏', '🙌', '🙏',
  '🔥', '✨', '🎉', '👍', '💯', '🌹', '☕', '🍕', '🏠', '🌙', '☀️', '🤣',
  '🥹', '🤝', '💪', '🎁', '⭐',
] as const;

const MAX_LENGTH = 1000;

/* -------------------------------------------------------------------------- */
/*                                  Types                                     */
/* -------------------------------------------------------------------------- */

export interface ChatInputBarProps {
  body: string;
  onBodyChange: (text: string) => void;
  sending: boolean;
  uploadingMedia: boolean;
  sharingLocation: boolean;
  stickersOpen: boolean;
  onToggleStickers: () => void;
  onCloseStickers: () => void;
  anyBlock: boolean;
  blockedByMe: boolean;
  onUnblock: () => void;
  onSend: () => void;
  onPickImages: () => void;
  onShareLocation: () => void;
  onOpenAppreciation: () => void;
  bottomSafe: number;
  temporarySeconds: number;
  onTemporarySecondsChange: (seconds: number) => void;
}

/* -------------------------------------------------------------------------- */
/*                                Component                                   */
/* -------------------------------------------------------------------------- */

function ChatInputBarBase({
  body,
  onBodyChange,
  sending,
  uploadingMedia,
  sharingLocation,
  stickersOpen,
  onToggleStickers,
  onCloseStickers,
  anyBlock,
  blockedByMe,
  onUnblock,
  onSend,
  onPickImages,
  onShareLocation,
  onOpenAppreciation,
  bottomSafe,
  temporarySeconds,
  onTemporarySecondsChange,
}: ChatInputBarProps) {
  const [toolsOpen, setToolsOpen] = useState(false);
  const [timerOpen, setTimerOpen] = useState(false);
  const [confirmedDuration, setConfirmedDuration] = useState<number | null>(null);
  const durationLabel = temporarySeconds === 10 ? '10 ثوانٍ' : temporarySeconds === 60 ? 'دقيقة' : temporarySeconds === 3600 ? 'ساعة' : temporarySeconds === 86400 ? '24 ساعة' : 'عادية';

  const hasBody = body.trim().length > 0;
  const canSend = hasBody && !sending && !uploadingMedia && !sharingLocation && (temporarySeconds === 0 || confirmedDuration === temporarySeconds);

  const handleToggleTools = useCallback(() => {
    setToolsOpen((v) => !v);
    if (!toolsOpen && stickersOpen) onCloseStickers();
  }, [toolsOpen, stickersOpen, onCloseStickers]);

  const handleToggleStickers = useCallback(() => {
    onToggleStickers();
    if (!stickersOpen && toolsOpen) setToolsOpen(false);
  }, [onToggleStickers, stickersOpen, toolsOpen]);

  const handleSend = useCallback(() => {
    if (!canSend) return;
    onSend();
    setConfirmedDuration(null);
    setToolsOpen(false);
    onCloseStickers();
  }, [canSend, onSend, onCloseStickers]);

  /* ------------------------------ Blocked ------------------------------ */
  if (anyBlock) {
    return (
      <View
        style={[
          styles.blockedInputArea,
          { paddingBottom: bottomSafe + 8 },
        ]}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        <Text style={styles.blockedInputText} numberOfLines={3}>
          {blockedByMe
            ? 'لا يمكنك الإرسال لأنك حظرت هذا المستخدم'
            : 'هذا المستخدم حظرك، الإرسال متوقف'}
        </Text>
        {blockedByMe && (
          <Pressable
            oasisKind="action"
            style={styles.unblockActionBtn}
            onPress={onUnblock}
            accessibilityRole="button"
            accessibilityLabel="إلغاء الحظر للمراسلة"
            accessibilityHint="يعيد تفعيل المحادثة"
          >
            <Text style={styles.unblockActionBtnText}>إلغاء الحظر للمراسلة</Text>
          </Pressable>
        )}
      </View>
    );
  }

  /* -------------------------------- Render ------------------------------ */
  return (
    <View
      style={[
        styles.composerWrap,
        { paddingBottom: Math.max(bottomSafe, 8) },
      ]}
    >
      {timerOpen && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 10, gap: 8 }}>
          <Text style={{ color: OASIS.colors.ink, textAlign: 'right', fontWeight: '700' }}>مدة ظهور الرسالة المؤقتة</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row-reverse', gap: 8, alignItems: 'center' }}>
            {([{ seconds: 0, label: 'عادية' }, { seconds: 10, label: '10 ثوانٍ' }, { seconds: 60, label: 'دقيقة' }, { seconds: 3600, label: 'ساعة' }, { seconds: 86400, label: '24 ساعة' }] as const).map(option => (
              <Pressable key={option.seconds} oasisKind="chip" onPress={() => { onTemporarySecondsChange(option.seconds); setConfirmedDuration(null); setTimerOpen(false); }} accessibilityRole="button" accessibilityState={{ selected: temporarySeconds === option.seconds }} style={{ minHeight: 44, justifyContent: 'center', borderRadius: 20, paddingHorizontal: 14, borderWidth: 1, borderColor: temporarySeconds === option.seconds ? OASIS.colors.primary : OASIS.colors.line, backgroundColor: temporarySeconds === option.seconds ? OASIS.colors.soft : OASIS.colors.surface }}>
                <Text style={{ color: OASIS.colors.ink, fontWeight: temporarySeconds === option.seconds ? '700' : '500' }}>{option.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={{ color: OASIS.colors.muted, fontSize: 11, textAlign: 'right' }}>تختفي من واجهة المحادثة بعد انتهاء الوقت. لا يضمن هذا حذفها من الخادم أو الإشعارات.</Text>
        </View>
      )}
      {temporarySeconds > 0 && (
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8, gap: 8 }}>
          <Text style={{ color: OASIS.colors.ink, textAlign: 'right', flex: 1 }}>⏱️ رسالة مؤقتة: {durationLabel}</Text>
          <Pressable oasisKind="chip" accessibilityRole="button" accessibilityLabel={confirmedDuration === temporarySeconds ? 'المدة مؤكدة' : `تأكيد مدة ${durationLabel}`} onPress={() => setConfirmedDuration(temporarySeconds)} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 18, backgroundColor: confirmedDuration === temporarySeconds ? OASIS.colors.soft : OASIS.colors.primary }}>
            <Text style={{ fontWeight: '700', color: confirmedDuration === temporarySeconds ? OASIS.colors.primary : OASIS.colors.surface }}>{confirmedDuration === temporarySeconds ? '✓ تم التأكيد' : 'تأكيد المدة'}</Text>
          </Pressable>
        </View>
      )}
      {toolsOpen && (
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickPromptsRow}
            keyboardShouldPersistTaps="handled"
          >
            <Pressable
              oasisKind="chip"
              style={[styles.quickPromptPill, styles.quickPromptPillCoffee]}
              onPress={onOpenAppreciation}
              accessibilityRole="button"
              accessibilityLabel="إهداء قهوة وشكر"
            >
              <Text style={styles.quickPromptTextCoffee}>
                ☕ إهداء قهوة وشكر (+10)
              </Text>
            </Pressable>

            {QUICK_PROMPTS.map((prompt) => (
              <Pressable
                oasisKind="chip"
                key={prompt}
                style={styles.quickPromptPill}
                onPress={() =>
                  onBodyChange(body ? `${body} ${prompt}` : prompt)
                }
                accessibilityRole="button"
                accessibilityLabel={prompt}
              >
                <Text style={styles.quickPromptText}>{prompt}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View
            style={{
              flexDirection: 'row-reverse',
              gap: 8,
              paddingHorizontal: 12,
              paddingBottom: 8,
            }}
          >
            <Pressable
              oasisKind="plain"
              onPress={onPickImages}
              accessibilityRole="button"
              accessibilityLabel="إرفاق صورة"
              style={styles.attachmentBtn}
            >
              <Paperclip size={18} color={OASIS.colors.primary} />
              <Text style={styles.attachmentLabel}>صورة</Text>
            </Pressable>

            <Pressable
              oasisKind="plain"
              onPress={onShareLocation}
              disabled={sharingLocation}
              accessibilityRole="button"
              accessibilityLabel="مشاركة موقعي"
              accessibilityState={{ disabled: sharingLocation, busy: sharingLocation }}
              style={styles.attachmentBtn}
            >
              {sharingLocation ? (
                <ActivityIndicator size="small" color={OASIS.colors.primary} />
              ) : (
                <MapPin size={18} color={OASIS.colors.primary} />
              )}
              <Text style={styles.attachmentLabel}>موقع</Text>
            </Pressable>

            <Pressable
              oasisKind="plain"
              onPress={onOpenAppreciation}
              accessibilityRole="button"
              accessibilityLabel="إهداء قهوة وشكر"
              style={styles.attachmentBtn}
            >
              <Coffee size={18} color={OASIS.colors.warning} />
              <Text style={styles.attachmentLabel}>شكر</Text>
            </Pressable>
          </View>
        </View>
      )}

      {stickersOpen && (
        <View style={styles.stickerPanel}>
          <Text style={styles.stickerTitle}>ملصقات وإيموجي الجيران</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stickerRow}
            keyboardShouldPersistTaps="handled"
          >
            {EMOJI_LIST.map((emoji) => (
              <Pressable
                key={emoji}
                style={styles.stickerItem}
                onPress={() => {
                  onBodyChange(body + emoji);
                  onCloseStickers();
                }}
                accessibilityRole="button"
                accessibilityLabel={`إيموجي ${emoji}`}
              >
                <Text style={styles.stickerEmoji}>{emoji}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.inputArea}>
        <Pressable oasisKind="icon" onPress={() => { setTimerOpen(v => !v); setToolsOpen(false); onCloseStickers(); }} accessibilityRole="button" accessibilityLabel={temporarySeconds ? `مؤقت الرسائل مفعل: ${temporarySeconds} ثانية` : 'تفعيل مؤقت الرسالة'} accessibilityState={{ expanded: timerOpen }} style={[styles.attachCircleBtn, temporarySeconds > 0 && { borderColor: OASIS.colors.primary, backgroundColor: OASIS.colors.soft }]}>
          <Timer size={20} color={OASIS.colors.primary} />
        </Pressable>
        <Pressable
          oasisKind="icon"
          oasisVariant="ghost"
          style={styles.attachCircleBtn}
          onPress={handleToggleTools}
          accessibilityRole="button"
          accessibilityHint="صور، موقع، وبطاقات شكر"
          accessibilityLabel={
            toolsOpen ? 'إغلاق أدوات المحادثة' : 'فتح أدوات المحادثة'
          }
          accessibilityState={{ expanded: toolsOpen }}
        >
          {toolsOpen ? (
            <X size={21} color={OASIS.colors.primary} />
          ) : (
            <Plus size={23} color={OASIS.colors.primary} />
          )}
        </Pressable>

        <OasisSurface oasisSurface="field" style={styles.inputCapsule}>
          <TextInput
            style={styles.textInput}
            value={body}
            onChangeText={onBodyChange}
            placeholder="رسالة إلى جارك..."
            placeholderTextColor={OASIS.colors.muted}
            multiline
            maxLength={MAX_LENGTH}
            accessibilityLabel="حقل كتابة الرسالة"
          />
          <Pressable
            oasisKind="icon"
            style={styles.emojiInsideBtn}
            onPress={handleToggleStickers}
            accessibilityRole="button"
            accessibilityLabel="إيموجي وملصقات"
            accessibilityState={{ expanded: stickersOpen }}
          >
            <Smile
              size={19}
              color={stickersOpen ? OASIS.colors.primary : OASIS.colors.muted}
            />
          </Pressable>
        </OasisSurface>

        <Pressable
          oasisVariant="primary"
          oasisKind="icon"
          style={({ pressed }) => [
            styles.sendButton,
            !canSend && styles.sendButtonDisabled,
            pressed && { transform: [{ scale: 0.94 }] },
          ]}
          onPress={handleSend}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel={sending ? "جارٍ إرسال الرسالة" : "إرسال الرسالة"}
          accessibilityState={{ disabled: !canSend, busy: sending || uploadingMedia }}
        >
          {uploadingMedia || sending ? (
            <ActivityIndicator size="small" color={OASIS.colors.surface} />
          ) : (
            <Send size={18} color={OASIS.colors.surface} style={{ marginLeft: 2 }} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

export const ChatInputBar = memo(ChatInputBarBase);
export default ChatInputBar;