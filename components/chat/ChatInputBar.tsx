import { OasisSurface, OasisPressable as Pressable, OasisTextInput as TextInput } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import React, { useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { Plus, X, Paperclip, MapPin, Coffee, Smile, Send } from 'lucide-react-native';
import { chatStyles as styles } from './chatStyles';

const QUICK_PROMPTS = [
  '👋 السلام عليكم',
  '🤝 أقدر أساعدك',
  '📍 شارك موقعك',
  '👍 تم، أبشر',
  '☕ حيّاك الله يا جارنا',
];

const EMOJI_LIST = [
  '😀','😂','😍','🥰','😘','😎','🤍','❤️','💚','👏','🙌','🙏',
  '🔥','✨','🎉','👍','💯','🌹','☕','🍕','🏠','🌙','☀️','🤣',
  '🥹','🤝','💪','🎁','⭐'
];

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

export const ChatInputBar: React.FC<ChatInputBarProps> = ({
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
}) => {
  const [toolsOpen, setToolsOpen] = useState(false);
  if (anyBlock) {
    return (
      <View style={[styles.blockedInputArea, { paddingBottom: bottomSafe + 8 }]}>
        <Text style={styles.blockedInputText}>
          {blockedByMe
            ? 'لا يمكنك الإرسال لأنك حظرت هذا المستخدم'
            : 'هذا المستخدم حظرك، الإرسال متوقف'}
        </Text>
        {blockedByMe && (
          <Pressable oasisKind="action" style={styles.unblockActionBtn} onPress={onUnblock}>
            <Text style={styles.unblockActionBtnText}>إلغاء الحظر للمراسلة</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.composerWrap, { paddingBottom: Math.max(bottomSafe, 8) }]}>
      {toolsOpen && <View>
      {/* Quick Prompts Row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.quickPromptsRow}
      >
        <Pressable oasisKind="chip"
          style={[styles.quickPromptPill, styles.quickPromptPillCoffee]}
          onPress={onOpenAppreciation}
          accessibilityRole="button"
          accessibilityLabel="إهداء قهوة وشكر"
        >
          <Text style={styles.quickPromptTextCoffee}>☕ إهداء قهوة وشكر (+10)</Text>
        </Pressable>

        {QUICK_PROMPTS.map((prompt, idx) => (
          <Pressable oasisKind="chip"
            key={idx}
            style={styles.quickPromptPill}
            onPress={() => onBodyChange(body ? `${body} ${prompt}` : prompt)}
            accessibilityRole="button"
            accessibilityLabel={prompt}
          >
            <Text style={styles.quickPromptText}>{prompt}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={{ flexDirection: 'row-reverse', gap: 8, paddingHorizontal: 12, paddingBottom: 8 }}>
        <Pressable oasisKind="plain" onPress={onPickImages} accessibilityLabel="إرفاق صورة" style={{ flex: 1, minHeight: 44, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Paperclip size={18} color={OASIS.colors.primary} /><Text style={{ fontSize: 12, color: OASIS.colors.ink }}>صورة</Text></Pressable>
        <Pressable oasisKind="plain" onPress={onShareLocation} disabled={sharingLocation} accessibilityLabel="مشاركة موقعي" style={{ flex: 1, minHeight: 44, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6 }}>{sharingLocation ? <ActivityIndicator size="small" color={OASIS.colors.primary} /> : <MapPin size={18} color={OASIS.colors.primary} />}<Text style={{ fontSize: 12, color: OASIS.colors.ink }}>موقع</Text></Pressable>
        <Pressable oasisKind="plain" onPress={onOpenAppreciation} accessibilityLabel="إهداء قهوة وشكر" style={{ flex: 1, minHeight: 44, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Coffee size={18} color={OASIS.colors.warning} /><Text style={{ fontSize: 12, color: OASIS.colors.ink }}>شكر</Text></Pressable>
      </View></View>}
      {/* Neighbor Emoji / Sticker Panel */}
      {stickersOpen && (
        <View style={styles.stickerPanel}>
          <Text style={styles.stickerTitle}>ملصقات وإيموجي الجيران</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stickerRow}
          >
            {EMOJI_LIST.map((emoji, i) => (
              <Pressable
                key={i}
                style={styles.stickerItem}
                onPress={() => {
                  onBodyChange(body + emoji);
                  onCloseStickers();
                }}
              >
                <Text style={styles.stickerEmoji}>{emoji}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Main Input Controls */}
      <View style={styles.inputArea}>
        <Pressable oasisKind="icon" oasisVariant="ghost" style={styles.attachCircleBtn} onPress={() => setToolsOpen(value => !value)} accessibilityLabel={toolsOpen ? 'إغلاق أدوات المحادثة' : 'فتح أدوات المحادثة'} accessibilityState={{ expanded: toolsOpen }}>{toolsOpen ? <X size={21} color={OASIS.colors.primary} /> : <Plus size={23} color={OASIS.colors.primary} />}</Pressable>

        <OasisSurface oasisSurface="field" style={styles.inputCapsule}>
          <TextInput
            style={styles.textInput}
            value={body}
            onChangeText={onBodyChange}
            placeholder="اكتب رسالة لجيرانك..."
            placeholderTextColor="#9ca3af"
            multiline
            maxLength={1000}
          />
          <Pressable oasisKind="icon"
            style={styles.emojiInsideBtn}
            onPress={onToggleStickers}
            accessibilityRole="button"
            accessibilityLabel="إيموجي وملصقات"
          >
            <Smile size={19} color={stickersOpen ? OASIS.colors.primary : '#94a3b8'} />
          </Pressable>
        </OasisSurface>

        <Pressable oasisVariant="primary" oasisKind="icon"
          style={({ pressed }) => [
            styles.sendButton,
            !body.trim() && !uploadingMedia && styles.sendButtonDisabled,
            pressed && { transform: [{ scale: 0.94 }] },
          ]}
          onPress={onSend}
          disabled={(!body.trim() && !uploadingMedia) || sending}
          accessibilityRole="button"
          accessibilityLabel="إرسال الرسالة"
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
};
