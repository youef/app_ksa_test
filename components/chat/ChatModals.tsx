import { memo, useCallback } from 'react';
import { ActivityIndicator, Image, Modal, Platform, Text, View } from 'react-native';
import {
  OasisPressable as Pressable,
  OasisTextInput as TextInput,
} from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import {
  X,
  Bell,
  BellOff,
  Moon,
  User,
  Coffee,
  UserCheck,
  UserX,
  Eraser,
  Trash2,
} from 'lucide-react-native';
import { chatStyles as styles } from './chatStyles';
import type { ChatUser } from './ChatHeader';

/* -------------------------------------------------------------------------- */
/*                              Constants                                     */
/* -------------------------------------------------------------------------- */

export const APPRECIATION_TEMPLATES = [
  'كفو يا جارنا، بيض الله وجهك 🤍',
  'تسلم وما قصرت على فزعتك الكريمة 🤝',
  'شكراً على حسن تعاملك وأمانتك ⭐',
  'وصل الغرض بالسلامة، جزاك الله خيراً 📦',
  'حيّاك الله يا جار الهنا، تسلم الأيادي ☕',
] as const;

/* -------------------------------------------------------------------------- */
/*                                  Types                                     */
/* -------------------------------------------------------------------------- */

export interface ChatModalsProps {
  optionsOpen: boolean;
  onCloseOptions: () => void;
  otherName: string;
  otherUser: ChatUser | null | undefined;
  isMuted: boolean;
  onToggleMute: () => void;
  dndActive: boolean;
  onToggleMyDnd: () => void;
  onViewProfile: () => void;
  blockedByMe: boolean;
  onToggleBlock: () => void;
  onOpenClear: () => void;

  confirmClear: boolean;
  onCloseConfirmClear: () => void;
  onClearMine: () => void;
  onDeleteForEveryone: () => void;

  previewImageUrl: string | null;
  onClosePreviewImage: () => void;

  appreciationModalOpen: boolean;
  onCloseAppreciation: () => void;
  appreciationNote: string;
  onChangeAppreciationNote: (val: string) => void;
  onSendAppreciation: () => void;
  sendingAppreciation: boolean;
}

/* -------------------------------------------------------------------------- */
/*                                Component                                   */
/* -------------------------------------------------------------------------- */

function ChatModalsBase(props: ChatModalsProps) {
  const {
    optionsOpen,
    onCloseOptions,
    otherName,
    otherUser,
    isMuted,
    onToggleMute,
    dndActive,
    onToggleMyDnd,
    onViewProfile,
    blockedByMe,
    onToggleBlock,
    onOpenClear,
    confirmClear,
    onCloseConfirmClear,
    onClearMine,
    onDeleteForEveryone,
    previewImageUrl,
    onClosePreviewImage,
    appreciationModalOpen,
    onCloseAppreciation,
    appreciationNote,
    onChangeAppreciationNote,
    onSendAppreciation,
    sendingAppreciation,
  } = props;

  // يمنع إغلاق الـ Modal عند النقر داخل البطاقة
  const stopPropagation = useCallback((e: any) => {
    e?.stopPropagation?.();
  }, []);

  return (
    <>
      {/* 1. Options menu modal */}
      <Modal
        visible={optionsOpen}
        transparent
        animationType="fade"
        onRequestClose={onCloseOptions}
      >
        <Pressable style={styles.optionsOverlay} onPress={onCloseOptions}>
          <Pressable
            style={styles.optionsSheet}
            onPress={stopPropagation}
            accessibilityViewIsModal
          >
            <View style={styles.optionsHeader}>
              <Pressable
                onPress={onCloseOptions}
                style={styles.optionsClose}
                accessibilityRole="button"
                accessibilityLabel="إغلاق"
              >
                <X size={18} color={OASIS.colors.muted} />
              </Pressable>
              <Text style={styles.optionsTitle} numberOfLines={1}>
                {otherName}
              </Text>
            </View>

            <Pressable
              style={styles.optionRow}
              onPress={onToggleMute}
              accessibilityRole="button"
              accessibilityState={{ selected: isMuted }}
            >
              {isMuted ? (
                <Bell size={18} color={OASIS.colors.primary} />
              ) : (
                <BellOff size={18} color="#d97706" />
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.optionRowText}>
                  {isMuted ? 'إلغاء كتم إشعارات المحادثة 🔔' : 'كتم المحادثة 🔕'}
                </Text>
                <Text style={styles.optionRowSub}>
                  يوقف التنبيهات لهذه المحادثة فقط
                </Text>
              </View>
            </Pressable>

            <Pressable
              style={styles.optionRow}
              onPress={onToggleMyDnd}
              accessibilityRole="button"
              accessibilityState={{ selected: dndActive }}
            >
              <Moon size={18} color="#d97706" />
              <View style={{ flex: 1 }}>
                <Text style={styles.optionRowText}>
                  {dndActive
                    ? 'إلغاء عدم الإزعاج العام'
                    : 'تفعيل عدم الإزعاج العام 🌙'}
                </Text>
                <Text style={styles.optionRowSub}>
                  يصمت كل الإشعارات الواردة من كل المحادثات
                </Text>
              </View>
            </Pressable>

            {otherUser && (
              <Pressable
                style={styles.optionRow}
                onPress={onViewProfile}
                accessibilityRole="button"
              >
                <User size={18} color={OASIS.colors.primary} />
                <Text style={styles.optionRowText}>عرض الملف الشخصي 👤</Text>
              </Pressable>
            )}

            <Pressable
              style={styles.optionRow}
              onPress={onToggleBlock}
              accessibilityRole="button"
              accessibilityState={{ selected: blockedByMe }}
            >
              {blockedByMe ? (
                <UserCheck size={18} color={OASIS.colors.primary} />
              ) : (
                <UserX size={18} color={OASIS.colors.danger} />
              )}
              <Text
                style={[
                  styles.optionRowText,
                  !blockedByMe && { color: OASIS.colors.danger },
                ]}
              >
                {blockedByMe ? 'إلغاء حظر هذا المستخدم' : 'حظر هذا المستخدم 🚫'}
              </Text>
            </Pressable>

            <Pressable
              style={styles.optionRow}
              onPress={onOpenClear}
              accessibilityRole="button"
            >
              <Eraser size={18} color={OASIS.colors.muted} />
              <View style={{ flex: 1 }}>
                <Text style={styles.optionRowText}>مسح المحادثة 🧹</Text>
                <Text style={styles.optionRowSub}>
                  اختر: من عندك فقط أو حذف للجميع
                </Text>
              </View>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 2. Clear / delete chooser modal */}
      <Modal
        visible={confirmClear}
        transparent
        animationType="fade"
        onRequestClose={onCloseConfirmClear}
      >
        <Pressable style={styles.optionsOverlay} onPress={onCloseConfirmClear}>
          <Pressable
            style={styles.optionsSheet}
            onPress={stopPropagation}
            accessibilityViewIsModal
          >
            <View style={styles.optionsHeader}>
              <Pressable
                onPress={onCloseConfirmClear}
                style={styles.optionsClose}
                accessibilityRole="button"
                accessibilityLabel="إغلاق"
              >
                <X size={18} color={OASIS.colors.muted} />
              </Pressable>
              <Text style={styles.optionsTitle}>مسح المحادثة</Text>
            </View>

            <Pressable
              oasisKind="card"
              style={styles.choiceCard}
              onPress={onClearMine}
              accessibilityRole="button"
            >
              <Eraser size={20} color="#0369a1" />
              <View style={{ flex: 1 }}>
                <Text style={styles.choiceTitle}>مسح المحادثة عندي 🧹</Text>
                <Text style={styles.choiceSub}>
                  تختفي كل الرسائل من شاشتك فقط. يحتفظ {otherName} بنسخته كاملة.
                </Text>
              </View>
            </Pressable>

            <Pressable
              oasisKind="card"
              style={[
                styles.choiceCard,
                styles.choiceCardDanger,
                { borderBottomWidth: 0 },
              ]}
              onPress={onDeleteForEveryone}
              accessibilityRole="button"
            >
              <Trash2 size={20} color={OASIS.colors.danger} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.choiceTitle, { color: OASIS.colors.danger }]}>
                  حذف المحادثة للجميع ⚠️
                </Text>
                <Text style={styles.choiceSub}>
                  حذف نهائي للمحادثة وكل رسائلها، وتختفي أيضاً من عند {otherName}.
                </Text>
              </View>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 3. Fullscreen Image Preview Lightbox */}
      <Modal
        visible={Boolean(previewImageUrl)}
        transparent
        animationType="fade"
        onRequestClose={onClosePreviewImage}
      >
        <View style={styles.lightboxBackdrop}>
          <Pressable
            oasisKind="icon"
            style={styles.lightboxCloseBtn}
            onPress={onClosePreviewImage}
            accessibilityRole="button"
            accessibilityLabel="إغلاق الصورة"
          >
            <X size={24} color={OASIS.colors.surface} />
          </Pressable>
          {previewImageUrl && (
            <Image
              source={{ uri: previewImageUrl }}
              style={styles.lightboxImage}
              resizeMode="contain"
              accessibilityLabel="صورة الرسالة بالحجم الكامل"
            />
          )}
        </View>
      </Modal>

      {/* 4. Appreciation & Coffee Modal */}
      <Modal
        visible={appreciationModalOpen}
        transparent
        animationType="fade"
        onRequestClose={onCloseAppreciation}
      >
        <Pressable style={styles.optionsOverlay} onPress={onCloseAppreciation}>
          <Pressable
            oasisKind="card"
            style={styles.appreciationModalCard}
            onPress={stopPropagation}
            accessibilityViewIsModal
          >
            <View style={styles.appreciationModalHeader}>
              <Pressable
                onPress={onCloseAppreciation}
                style={styles.optionsClose}
                accessibilityRole="button"
                accessibilityLabel="إغلاق"
              >
                <X size={18} color={OASIS.colors.muted} />
              </Pressable>
              <View style={styles.appreciationModalTitleCol}>
                <View style={styles.appreciationModalIconCircle}>
                  <Coffee size={24} color="#78350f" />
                </View>
                <Text style={styles.appreciationModalTitle}>
                  إهداء بطاقة شكر وقهوة ☕
                </Text>
                <Text style={styles.appreciationModalSub}>
                  أظهر تقديرك لـ {otherName} على فزعته وحسن تعامله، وسيتم إضافة
                  +10 نقاط سمعة إيجابية لحسابه في الحي ⭐
                </Text>
              </View>
            </View>

            <Text style={styles.appreciationSectionLabel}>
              اختر عبارة جاهزة أو اكتب عبارتك:
            </Text>
            <View style={styles.appreciationChipsWrap}>
              {APPRECIATION_TEMPLATES.map((tmpl) => {
                const isSelected = appreciationNote === tmpl;
                return (
                  <Pressable
                    oasisKind="chip"
                    key={tmpl}
                    style={[
                      styles.appreciationChip,
                      isSelected && styles.appreciationChipSelected,
                    ]}
                    onPress={() => onChangeAppreciationNote(tmpl)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text
                      style={[
                        styles.appreciationChipText,
                        isSelected && styles.appreciationChipTextSelected,
                      ]}
                    >
                      {tmpl}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              style={styles.appreciationInput}
              value={appreciationNote}
              onChangeText={onChangeAppreciationNote}
              placeholder="اكتب رسالة شكر خاصة لجارك..."
              placeholderTextColor={OASIS.colors.muted}
              multiline
              maxLength={200}
              accessibilityLabel="نص رسالة الشكر"
            />

            <View style={styles.appreciationActionRow}>
              <Pressable
                oasisKind="action"
                style={[
                  styles.appreciationSendBtn,
                  sendingAppreciation && { opacity: 0.7 },
                ]}
                onPress={onSendAppreciation}
                disabled={sendingAppreciation}
                accessibilityRole="button"
                accessibilityLabel="إرسال بطاقة الشكر والقهوة"
                accessibilityState={{
                  disabled: sendingAppreciation,
                  busy: sendingAppreciation,
                }}
              >
                {sendingAppreciation ? (
                  <ActivityIndicator
                    size="small"
                    color={OASIS.colors.surface}
                  />
                ) : (
                  <>
                    <Coffee size={18} color={OASIS.colors.surface} />
                    <Text style={styles.appreciationSendBtnText}>
                      إرسال القهوة والتقدير (+10 نقاط) ☕
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export const ChatModals = memo(ChatModalsBase);
export default ChatModals;