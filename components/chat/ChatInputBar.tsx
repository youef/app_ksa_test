import { memo, useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import {
  OasisSurface,
  OasisPressable as Pressable,
  OasisTextInput as TextInput,
} from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { Plus, X, Paperclip, MapPin, Coffee, Smile, Send } from 'lucide-react-native';
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
}: ChatInputBarProps) {
  const [toolsOpen, setToolsOpen] = useState(false);

  const hasBody = body.trim().length > 0;
  const canSend = (hasBody || uploadingMedia) && !sending;

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
        <Pressable
          oasisKind="icon"
          oasisVariant="ghost"
          style={styles.attachCircleBtn}
          onPress={handleToggleTools}
          accessibilityRole="button"
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
            placeholder="اكتب رسالة لجيرانك..."
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
          accessibilityLabel="إرسال الرسالة"
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