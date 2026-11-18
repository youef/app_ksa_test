import { OasisPressable as Pressable } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { useState, type ReactNode } from 'react';
import { BlurView } from 'expo-blur';
import { Platform, Text, View } from 'react-native';
import { Camera, CameraOff, ChevronDown, ChevronUp, MessageCircle, Mic, MicOff, Share2, ShieldAlert, Users } from 'lucide-react-native';
import { styles } from '@/components/lives/liveRoomStyles';

type Role = 'host' | 'viewer' | 'guest';
type Props = {
  role: Role;
  open: boolean;
  onToggleOpen: () => void;
  cameraOn: boolean;
  micOn: boolean;
  micLocked: boolean;
  onToggleCamera: () => void;
  onToggleMic: () => void;
  onGuests: () => void;
  onComments: () => void;
  onModeration: () => void;
  onShare: () => void;
};

export default function LiveHostControlBar({
  role, open, onToggleOpen, cameraOn, micOn, micLocked,
  onToggleCamera, onToggleMic, onGuests, onComments, onModeration, onShare,
}: Props) {
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <View style={styles.glassWrap}>
      <BlurView intensity={Platform.OS === 'ios' ? 35 : 0} tint="dark" style={styles.glassBar}>
        <View style={styles.glassTint}>
          {open ? (
            <>
              <View style={styles.glassPrimaryRow}>
                <View style={styles.glassButtons}>
                  <GlassButton label="كاميرا" accessibilityLabel={cameraOn ? 'إيقاف الكاميرا' : 'تشغيل الكاميرا'}
                    active={cameraOn} off={!cameraOn} onPress={onToggleCamera}>
                    {cameraOn ? <Camera size={18} color="#FFFFFF" /> : <CameraOff size={18} color="#FDA4AF" />}
                  </GlassButton>
                  <GlassButton label="مايك" accessibilityLabel={micLocked ? 'المايك مكتوم بواسطة المضيف' : micOn ? 'كتم المايك' : 'تشغيل المايك'}
                    active={micOn && !micLocked} off={!micOn || micLocked} disabled={micLocked} onPress={onToggleMic}>
                    {micOn && !micLocked ? <Mic size={18} color="#FFFFFF" /> : <MicOff size={18} color="#FDA4AF" />}
                  </GlassButton>
                  {role === 'host' ? (
                    <>
                      <GlassButton label="الضيوف" onPress={onGuests}><Users size={18} color="#FFFFFF" /></GlassButton>
                      <GlassButton label="التعليقات" onPress={onComments}><MessageCircle size={18} color="#FFFFFF" /></GlassButton>
                    </>
                  ) : (
                    <GlassButton label="مشاركة" onPress={onShare}><Share2 size={18} color="#FFFFFF" /></GlassButton>
                  )}
                  {role === 'host' && (
                    <Pressable oasisKind="plain" accessibilityRole="button" accessibilityLabel={moreOpen ? 'إخفاء خيارات البث الإضافية' : 'إظهار خيارات البث الإضافية'}
                      accessibilityState={{ expanded: moreOpen }}
                      onPress={() => setMoreOpen(value => !value)}
                      style={[styles.glassMoreButton, moreOpen && styles.glassButtonActive]}>
                      {moreOpen ? <ChevronUp size={17} color="#FFFFFF" /> : <ChevronDown size={17} color="#FFFFFF" />}
                      <Text style={styles.glassButtonLabel}>المزيد</Text>
                    </Pressable>
                  )}
                </View>
                <Pressable oasisKind="plain" accessibilityRole="button" accessibilityLabel="طي أدوات البث"
                  onPress={onToggleOpen} style={styles.glassToggle}>
                  <ChevronDown size={18} color="#FFFFFF" />
                </Pressable>
              </View>

              {role === 'host' && moreOpen && (
                <View style={styles.glassSecondaryRow}>
                  <Pressable oasisKind="plain" accessibilityRole="button" accessibilityLabel="مشاركة رابط البث" onPress={onShare} style={styles.glassSecondaryButton}>
                    <Share2 size={16} color="#A7F3D0"/><Text style={styles.glassSecondaryLabel}>مشاركة البث</Text>
                  </Pressable>
                  <Pressable oasisKind="plain" accessibilityRole="button" accessibilityLabel="فتح أدوات الإشراف" onPress={onModeration} style={styles.glassSecondaryButton}>
                    <ShieldAlert size={16} color="#A7F3D0"/><Text style={styles.glassSecondaryLabel}>الإشراف</Text>
                  </Pressable>
                </View>
              )}
            </>
          ) : (
            <Pressable oasisKind="plain" accessibilityRole="button" accessibilityLabel="فتح أدوات البث"
              onPress={onToggleOpen} style={styles.glassCollapsedRow}>
              <Text style={styles.glassCollapsedText}>{role === 'host' ? 'أدوات المضيف' : 'أدوات الضيف'}</Text>
              <ChevronUp size={18} color="#FFFFFF" />
            </Pressable>
          )}
        </View>
      </BlurView>
    </View>
  );
}

function GlassButton({ children, label, accessibilityLabel, onPress, active, off, disabled }: {
  children: ReactNode; label: string; accessibilityLabel?: string; onPress: () => void;
  active?: boolean; off?: boolean; disabled?: boolean;
}) {
  return (
    <Pressable oasisKind="plain" accessibilityRole="button" accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      onPress={onPress} disabled={disabled}
      style={[styles.glassButton, active && styles.glassButtonActive, off && styles.glassButtonOff, disabled && { opacity: 0.68 }]}>
      {children}
      <Text style={styles.glassButtonLabel} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}
