import React from 'react';
import { View, Text, Pressable, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { Paperclip, MapPin, Coffee, Smile, Send } from 'lucide-react-native';
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
  if (anyBlock) {
    return (
      <View style={[styles.blockedInputArea, { paddingBottom: bottomSafe + 8 }]}>
        <Text style={styles.blockedInputText}>
          {blockedByMe
            ? 'لا يمكنك الإرسال لأنك حظرت هذا المستخدم'
            : 'هذا المستخدم حظرك، الإرسال متوقف'}
        </Text>
        {blockedByMe && (
          <Pressable style={styles.unblockActionBtn} onPress={onUnblock}>
            <Text style={styles.unblockActionBtnText}>إلغاء الحظر للمراسلة</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.composerWrap, { paddingBottom: Math.max(bottomSafe, 8) }]}>
      {/* Quick Prompts Row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.quickPromptsRow}
      >
        <Pressable
          style={[styles.quickPromptPill, styles.quickPromptPillCoffee]}
          onPress={onOpenAppreciation}
          accessibilityRole="button"
          accessibilityLabel="إهداء قهوة وشكر"
        >
          <Text style={styles.quickPromptTextCoffee}>☕ إهداء قهوة وشكر (+10)</Text>
        </Pressable>

        {QUICK_PROMPTS.map((prompt, idx) => (
          <Pressable
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
        <Pressable
          style={styles.attachCircleBtn}
          onPress={onPickImages}
          accessibilityRole="button"
          accessibilityLabel="إرفاق صورة"
        >
          <Paperclip size={18} color="#64748b" />
        </Pressable>

        <Pressable
          style={[styles.attachCircleBtn, sharingLocation && styles.attachCircleBtnBusy]}
          onPress={onShareLocation}
          disabled={sharingLocation}
          accessibilityRole="button"
          accessibilityLabel="مشاركة موقعي"
        >
          {sharingLocation ? (
            <ActivityIndicator size="small" color="#059669" />
          ) : (
            <MapPin size={18} color="#059669" />
          )}
        </Pressable>

        <Pressable
          style={[styles.attachCircleBtn, styles.coffeeCircleBtn]}
          onPress={onOpenAppreciation}
          accessibilityRole="button"
          accessibilityLabel="إهداء قهوة وشكر"
        >
          <Coffee size={18} color="#b45309" />
        </Pressable>

        <View style={styles.inputCapsule}>
          <TextInput
            style={styles.textInput}
            value={body}
            onChangeText={onBodyChange}
            placeholder="اكتب رسالة لجيرانك..."
            placeholderTextColor="#9ca3af"
            multiline
            maxLength={1000}
          />
          <Pressable
            style={styles.emojiInsideBtn}
            onPress={onToggleStickers}
            accessibilityRole="button"
            accessibilityLabel="إيموجي وملصقات"
          >
            <Smile size={19} color={stickersOpen ? '#059669' : '#94a3b8'} />
          </Pressable>
        </View>

        <Pressable
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
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Send size={18} color="#ffffff" style={{ marginLeft: 2 }} />
          )}
        </Pressable>
      </View>
    </View>
  );
};
