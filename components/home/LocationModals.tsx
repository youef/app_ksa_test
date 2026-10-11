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
  busy: boolean;
  message: string;
  region: string;
  city: string;
  district: string;
  onUpdate: () => void;
  onOpenSettings: () => void;
};

/**
 * Mandatory weekly "confirm your real location" prompt.
 * There is deliberately no skip/later button: the user cannot continue browsing
 * their neighbourhood feed until the real GPS location is confirmed.
 */
export function WeeklyLocationPrompt({
  visible, busy, message, region, city, district, onUpdate, onOpenSettings,
}: PromptProps) {
  const hasCity = Boolean(city) && city !== 'كل المدن';
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.locationPromptBackdrop}>
        <View style={styles.locationPromptCard}>
          <View style={styles.locationGateIcon}><MapPin size={26} color="#059669" /></View>
          <Text style={styles.locationPromptTitle}>تحديث موقعك الأسبوعي</Text>
          <Text style={styles.locationPromptText}>
            هل ما زلت في نفس الحي؟ حدّث موقعك لتصلك منشورات وتنبيهات جيرانك بدقة.
          </Text>

          <View style={styles.locationPromptLockRow}>
            <MapPin size={15} color="#059669" />
            <Text style={styles.locationPromptLockText}>
              {hasCity
                ? `مدينتك الحالية عبر GPS: ${city}${district && district !== 'كل الأحياء' ? ` · حي ${district}` : ''}`
                : 'لم نثبّت مدينتك بعد. نحتاج موقعك الحقيقي للمتابعة.'}
            </Text>
          </View>

          <Text style={styles.locationPromptNotice}>
            التحقق من الموقع إلزامي ولا يمكن تخطّيه. سيتم قراءة موقعك الحقيقي عبر GPS وتثبيت مدينتك، ولن تتمكن من تغييرها يدوياً لاحقاً.
          </Text>

          {!!message && <Text style={styles.locationPromptMessage}>{message}</Text>}

          <View style={styles.locationPromptActions}>
            <Pressable
              style={styles.locationPromptAllow}
              onPress={onUpdate}
              disabled={busy}
              accessibilityRole="button"
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.locationPromptAllowText}>تحديث الآن عبر GPS</Text>
              )}
            </Pressable>
          </View>

          <Pressable onPress={onOpenSettings} accessibilityRole="button" hitSlop={6}>
            <Text style={styles.locationPromptHelp}>المتصفح لا يدعم الموقع أو رفضت الإذن؟ اضغط هنا لطريقة التفعيل</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
