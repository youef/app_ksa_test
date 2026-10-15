import type { ReactNode } from 'react';
import { BlurView } from 'expo-blur';
import { Platform, Pressable, Text, View } from 'react-native';
import { Camera, CameraOff, ChevronDown, ChevronUp, MessageCircle, Mic, MicOff, Radio, Share2, ShieldAlert, Users } from 'lucide-react-native';
import { styles } from '@/components/lives/liveRoomStyles';

type Role = 'host' | 'viewer' | 'guest';
type Props = {
  role: Role;
  open: boolean;
  onToggleOpen: () => void;
  cameraOn: boolean;
  micOn: boolean;
  micLocked: boolean;
  bottomInset: number;
  onToggleCamera: () => void;
  onToggleMic: () => void;
  onGuests: () => void;
  onComments: () => void;
  onModeration: () => void;
  onShare: () => void;
  onEnd: () => void;
};

export default function LiveHostControlBar({
  role, open, onToggleOpen, cameraOn, micOn, micLocked, bottomInset,
  onToggleCamera, onToggleMic, onGuests, onComments, onModeration, onShare, onEnd,
}: Props) {
  return (
    <View style={[styles.glassWrap, { marginBottom: Math.max(bottomInset, 10) }]}>
      <BlurView intensity={Platform.OS === 'ios' ? 48 : 0} tint="dark" style={styles.glassBar}>
        <View style={styles.glassTint}>
          <Pressable onPress={onToggleOpen} style={styles.glassToggle} accessibilityLabel={open ? 'طي الأدوات' : 'فتح الأدوات'}>
            {open ? <ChevronDown size={18} color="#fff" /> : <ChevronUp size={18} color="#fff" />}
          </Pressable>
          {open ? (
            <View style={styles.glassButtons}>
              <GlassButton active={cameraOn} label="كاميرا" onPress={onToggleCamera}>{cameraOn ? <Camera size={20} color="#fff" /> : <CameraOff size={20} color="#fb7185" />}</GlassButton>
              <GlassButton active={micOn && !micLocked} disabled={micLocked} label={micLocked ? 'كتم المضيف' : 'مايك'} onPress={onToggleMic}>{micOn && !micLocked ? <Mic size={20} color="#fff" /> : <MicOff size={20} color="#fb7185" />}</GlassButton>
              {role === 'host' && <GlassButton label="الضيوف" onPress={onGuests}><Users size={20} color="#fff" /></GlassButton>}
              {role === 'host' && <GlassButton label="التعليقات" onPress={onComments}><MessageCircle size={20} color="#fff" /></GlassButton>}
              {role === 'host' && <GlassButton label="الإشراف" onPress={onModeration}><ShieldAlert size={20} color="#a7f3d0" /></GlassButton>}
              <GlassButton label="مشاركة" onPress={onShare}><Share2 size={19} color="#fff" /></GlassButton>
              {role === 'host' && <GlassButton danger label="إنهاء" onPress={onEnd}><Radio size={19} color="#fff" /></GlassButton>}
            </View>
          ) : (
            <Text style={styles.glassCollapsedText}>{role === 'host' ? 'تحكم المضيف' : 'تحكم الضيف'}</Text>
          )}
        </View>
      </BlurView>
    </View>
  );
}

function GlassButton({ children, label, onPress, active, danger, disabled }: {
  children: ReactNode; label: string; onPress: () => void; active?: boolean; danger?: boolean; disabled?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.glassButton, active && styles.glassButtonActive, danger && styles.glassButtonDanger, disabled && { opacity: 0.5 }]}>
      {children}
      <Text style={styles.glassButtonLabel} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}
