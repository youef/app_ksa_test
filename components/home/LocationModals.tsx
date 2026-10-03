import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { styles } from './homeStyles';

type GateProps = {
  visible: boolean;
  busy: boolean;
  message: string;
  region: string;
  city: string;
  district: string;
  hasExactLocation: boolean;
  onSetupLocation: () => void;
  onEnableNotifications: () => void;
};

/** Mandatory first-login setup: location, then notifications. */
export function LocationGateModal({
  visible, busy, message, region, city, district, hasExactLocation,
  onSetupLocation, onEnableNotifications,
}: GateProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.locationGateOverlay}>
        <View style={styles.locationGateCard}>
          <View style={styles.locationGateIcon}><MapPin size={28} color="#059669" /></View>
          <Text style={styles.locationGateTitle}>نحتاج موقعك قبل البدء</Text>
          <Text style={styles.locationGateText}>
            حدّد موقعك تلقائياً لربط حسابك بالمنطقة والمدينة والحي، ثم فعّل الإشعارات لتصلك أخبار وتنبيهات حيّك فوراً.
          </Text>

          <View style={styles.locationGateStatus}>
            <View style={styles.locationGateStatusRow}>
              <MapPin size={17} color="#059669" />
              <Text style={styles.locationGateStatusText}>
                {hasExactLocation ? `الموقع: ${region} · ${city} · حي ${district}` : 'الموقع غير مكتمل'}
              </Text>
            </View>
          </View>

          {!!message && <Text style={styles.locationGateMessage}>{message}</Text>}

          <Pressable
            style={styles.locationGatePrimary}
            onPress={hasExactLocation ? onEnableNotifications : onSetupLocation}
            disabled={busy}
            accessibilityRole="button"
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.locationGatePrimaryText}>
                {hasExactLocation ? 'تفعيل الإشعارات والمتابعة' : 'تحديد موقعي تلقائياً'}
              </Text>
            )}
          </Pressable>

          <Text style={styles.locationGateRequired}>
            تحديد الموقع مطلوب. الإشعارات يمكن تفعيلها الآن أو لاحقاً من الإعدادات.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

type PromptProps = {
  visible: boolean;
  onAllow: () => void;
  onLater: () => void;
};

/** Weekly "refresh my location" prompt (was missing its Modal in the original). */
export function WeeklyLocationPrompt({ visible, onAllow, onLater }: PromptProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onLater}>
      <View style={styles.locationPromptBackdrop}>
        <View style={styles.locationPromptCard}>
          <View style={styles.locationGateIcon}><MapPin size={26} color="#059669" /></View>
          <Text style={styles.locationPromptTitle}>تحديث موقعك الأسبوعي</Text>
          <Text style={styles.locationPromptText}>
            هل ما زلت في نفس الحي؟ حدّث موقعك لتصلك منشورات وتنبيهات جيرانك بدقة.
          </Text>
          <View style={styles.locationPromptActions}>
            <Pressable style={styles.locationPromptAllow} onPress={onAllow} accessibilityRole="button">
              <Text style={styles.locationPromptAllowText}>تحديث الآن</Text>
            </Pressable>
            <Pressable style={styles.locationPromptLater} onPress={onLater} accessibilityRole="button">
              <Text style={styles.locationPromptLaterText}>لاحقاً</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
