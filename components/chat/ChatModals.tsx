import React from 'react';
import { View, Text, Pressable, Modal, Image, TextInput, ActivityIndicator, Platform } from 'react-native';
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

export const APPRECIATION_TEMPLATES = [
  'كفو يا جارنا، بيض الله وجهك 🤍',
  'تسلم وما قصرت على فزعتك الكريمة 🤝',
  'شكراً على حسن تعاملك وأمانتك ⭐',
  'وصل الغرض بالسلامة، جزاك الله خيراً 📦',
  'حيّاك الله يا جار الهنا، تسلم الأيادي ☕',
];

export interface ChatModalsProps {
  optionsOpen: boolean;
  onCloseOptions: () => void;
  otherName: string;
  otherUser: any;
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

export const ChatModals: React.FC<ChatModalsProps> = ({
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
}) => {
  return (
    <>
      {/* 1. Options menu modal */}
      <Modal visible={optionsOpen} transparent animationType="fade" onRequestClose={onCloseOptions}>
        <Pressable style={styles.optionsOverlay} onPress={onCloseOptions}>
          <View style={styles.optionsSheet}>
            <View style={styles.optionsHeader}>
              <Pressable onPress={onCloseOptions} style={styles.optionsClose}>
                <X size={18} color="#64748b" />
              </Pressable>
              <Text style={styles.optionsTitle} numberOfLines={1}>
                {otherName}
              </Text>
            </View>

            <Pressable style={styles.optionRow} onPress={onToggleMute}>
              {isMuted ? <Bell size={18} color="#059669" /> : <BellOff size={18} color="#d97706" />}
              <View style={{ flex: 1 }}>
                <Text style={styles.optionRowText}>
                  {isMuted ? 'إلغاء كتم إشعارات المحادثة 🔔' : 'كتم المحادثة 🔕'}
                </Text>
                <Text style={styles.optionRowSub}>يوقف التنبيهات لهذه المحادثة فقط</Text>
              </View>
            </Pressable>

            <Pressable style={styles.optionRow} onPress={onToggleMyDnd}>
              <Moon size={18} color="#d97706" />
              <View style={{ flex: 1 }}>
                <Text style={styles.optionRowText}>
                  {dndActive ? 'إلغاء عدم الإزعاج العام' : 'تفعيل عدم الإزعاج العام 🌙'}
                </Text>
                <Text style={styles.optionRowSub}>يصمت كل الإشعارات الواردة من كل المحادثات</Text>
              </View>
            </Pressable>

            {otherUser && (
              <Pressable style={styles.optionRow} onPress={onViewProfile}>
                <User size={18} color="#059669" />
                <Text style={styles.optionRowText}>عرض الملف الشخصي 👤</Text>
              </Pressable>
            )}

            <Pressable style={styles.optionRow} onPress={onToggleBlock}>
              {blockedByMe ? <UserCheck size={18} color="#059669" /> : <UserX size={18} color="#dc2626" />}
              <Text style={[styles.optionRowText, !blockedByMe && { color: '#dc2626' }]}>
                {blockedByMe ? 'إلغاء حظر هذا المستخدم' : 'حظر هذا المستخدم 🚫'}
              </Text>
            </Pressable>

            <Pressable style={styles.optionRow} onPress={onOpenClear}>
              <Eraser size={18} color="#64748b" />
              <View style={{ flex: 1 }}>
                <Text style={styles.optionRowText}>مسح المحادثة 🧹</Text>
                <Text style={styles.optionRowSub}>اختر: من عندك فقط أو حذف للجميع</Text>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* 2. Clear / delete chooser modal */}
      <Modal visible={confirmClear} transparent animationType="fade" onRequestClose={onCloseConfirmClear}>
        <Pressable style={styles.optionsOverlay} onPress={onCloseConfirmClear}>
          <View style={styles.optionsSheet}>
            <View style={styles.optionsHeader}>
              <Pressable onPress={onCloseConfirmClear} style={styles.optionsClose}>
                <X size={18} color="#64748b" />
              </Pressable>
              <Text style={styles.optionsTitle}>مسح المحادثة</Text>
            </View>

            <Pressable style={styles.choiceCard} onPress={onClearMine}>
              <Eraser size={20} color="#0369a1" />
              <View style={{ flex: 1 }}>
                <Text style={styles.choiceTitle}>مسح المحادثة عندي 🧹</Text>
                <Text style={styles.choiceSub}>
                  تختفي كل الرسائل من شاشتك فقط. يحتفظ {otherName} بنسخته كاملة.
                </Text>
              </View>
            </Pressable>

            <Pressable
              style={[styles.choiceCard, styles.choiceCardDanger, { borderBottomWidth: 0 }]}
              onPress={onDeleteForEveryone}
            >
              <Trash2 size={20} color="#dc2626" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.choiceTitle, { color: '#dc2626' }]}>حذف المحادثة للجميع ⚠️</Text>
                <Text style={styles.choiceSub}>
                  حذف نهائي للمحادثة وكل رسائلها، وتختفي أيضاً من عند {otherName}.
                </Text>
              </View>
            </Pressable>
          </View>
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
            style={styles.lightboxCloseBtn}
            onPress={onClosePreviewImage}
            accessibilityRole="button"
            accessibilityLabel="إغلاق الصورة"
          >
            <X size={24} color="#ffffff" />
          </Pressable>
          {previewImageUrl && (
            <Image
              source={{ uri: previewImageUrl }}
              style={styles.lightboxImage}
              resizeMode="contain"
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
          <Pressable style={styles.appreciationModalCard} onPress={e => e.stopPropagation?.()}>
            <View style={styles.appreciationModalHeader}>
              <Pressable
                onPress={onCloseAppreciation}
                style={styles.optionsClose}
                accessibilityRole="button"
                accessibilityLabel="إغلاق"
              >
                <X size={18} color="#64748b" />
              </Pressable>
              <View style={styles.appreciationModalTitleCol}>
                <View style={styles.appreciationModalIconCircle}>
                  <Coffee size={24} color="#78350f" />
                </View>
                <Text style={styles.appreciationModalTitle}>إهداء بطاقة شكر وقهوة ☕</Text>
                <Text style={styles.appreciationModalSub}>
                  أظهر تقديرك لـ {otherName} على فزعته وحسن تعامله، وسيتم إضافة +10 نقاط سمعة إيجابية لحسابه في الحي ⭐
                </Text>
              </View>
            </View>

            <Text style={styles.appreciationSectionLabel}>اختر عبارة جاهزة أو اكتب عبارتك:</Text>
            <View style={styles.appreciationChipsWrap}>
              {APPRECIATION_TEMPLATES.map((tmpl, idx) => {
                const isSelected = appreciationNote === tmpl;
                return (
                  <Pressable
                    key={idx}
                    style={[styles.appreciationChip, isSelected && styles.appreciationChipSelected]}
                    onPress={() => onChangeAppreciationNote(tmpl)}
                    accessibilityRole="button"
                  >
                    <Text
                      style={[styles.appreciationChipText, isSelected && styles.appreciationChipTextSelected]}
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
              placeholderTextColor="#94a3b8"
              multiline
              maxLength={200}
            />

            <View style={styles.appreciationActionRow}>
              <Pressable
                style={[styles.appreciationSendBtn, sendingAppreciation && { opacity: 0.7 }]}
                onPress={onSendAppreciation}
                disabled={sendingAppreciation}
                accessibilityRole="button"
                accessibilityLabel="إرسال بطاقة الشكر والقهوة"
              >
                {sendingAppreciation ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Coffee size={18} color="#ffffff" />
                    <Text style={styles.appreciationSendBtnText}>إرسال القهوة والتقدير (+10 نقاط) ☕</Text>
                  </>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};
