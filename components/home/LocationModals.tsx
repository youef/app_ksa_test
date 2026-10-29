import {
  OasisPressable as Pressable,
  OasisSurface,
} from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { memo } from 'react';
import { ActivityIndicator, Modal, Text, View } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { styles } from './homeStyles';
import {
  formatLocationParts,
  isRealCity,
  isRealDistrict,
} from '@/lib/locationFormat';

/* -------------------------------------------------------------------------- */
/*                            LocationGateModal                               */
/* -------------------------------------------------------------------------- */

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

function LocationGateModalBase({
  visible,
  busy,
  message,
  region,
  city,
  district,
  hasExactLocation,
  onSetupLocation,
  onEnableNotifications,
}: GateProps) {
  // يمنع زر الرجوع في Android من إغلاق وهمي
  const handleRequestClose = () => {
    if (busy) return;
    if (hasExactLocation) onEnableNotifications();
    else onSetupLocation();
  };

  const locationText = hasExactLocation
    ? `الموقع: ${formatLocationParts({ region, city, district })}`
    : 'الموقع غير مكتمل';

  const primaryLabel = hasExactLocation
    ? 'تفعيل الإشعارات والمتابعة'
    : 'تحديد موقعي تلقائياً';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleRequestClose}
    >
      <View
        style={styles.locationGateOverlay}
        accessibilityViewIsModal
        importantForAccessibility="yes"
      >
        <OasisSurface oasisSurface="card" style={styles.locationGateCard}>
          <View style={styles.locationGateIcon}>
            <MapPin size={28} color={OASIS.colors.primary} />
          </View>

          <Text style={styles.locationGateTitle}>نحتاج موقعك قبل البدء</Text>

          <Text style={styles.locationGateText}>
            حدّد موقعك تلقائياً لربط حسابك بالمنطقة والمدينة والحي، ثم فعّل
            الإشعارات لتصلك أخبار وتنبيهات حيّك فوراً.
          </Text>

          <View style={styles.locationGateStatus}>
            <View style={styles.locationGateStatusRow}>
              <MapPin size={17} color={OASIS.colors.primary} />
              <Text style={styles.locationGateStatusText} numberOfLines={3}>
                {locationText}
              </Text>
            </View>
          </View>

          {!!message && (
            <Text
              style={styles.locationGateMessage}
              accessibilityLiveRegion="assertive"
            >
              {message}
            </Text>
          )}

          <Pressable
            style={styles.locationGatePrimary}
            onPress={
              hasExactLocation ? onEnableNotifications : onSetupLocation
            }
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={primaryLabel}
            accessibilityState={{ disabled: busy, busy }}
            accessibilityHint="يكمل إعداد حسابك للبدء باستخدام التطبيق"
          >
            {busy ? (
              <ActivityIndicator
                color={OASIS.colors.surface}
                accessibilityLabel="جارٍ التحديد"
              />
            ) : (
              <Text style={styles.locationGatePrimaryText}>{primaryLabel}</Text>
            )}
          </Pressable>

          <Text style={styles.locationGateRequired}>
            تحديد الموقع مطلوب. الإشعارات يمكن تفعيلها الآن أو لاحقاً من
            الإعدادات.
          </Text>
        </OasisSurface>
      </View>
    </Modal>
  );
}

export const LocationGateModal = memo(LocationGateModalBase);

/* -------------------------------------------------------------------------- */
/*                          WeeklyLocationPrompt                              */
/* -------------------------------------------------------------------------- */

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

function WeeklyLocationPromptBase({
  visible,
  busy,
  message,
  region,
  city,
  district,
  onUpdate,
  onOpenSettings,
}: PromptProps) {
  const hasCity = isRealCity(city);
  const hasDistrict = isRealDistrict(district);

  // على Android، زر الرجوع يجب أن يفعّل التحديث بدل الإغلاق
  const handleRequestClose = () => {
    if (busy) return;
    onUpdate();
  };

  const cityLine = hasCity
    ? `مدينتك الحالية عبر GPS: ${city}${
        hasDistrict ? ` · حي ${district}` : ''
      }`
    : 'لم نثبّت مدينتك بعد. نحتاج موقعك الحقيقي للمتابعة.';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleRequestClose}
    >
      <View
        style={styles.locationPromptBackdrop}
        accessibilityViewIsModal
        importantForAccessibility="yes"
      >
        <OasisSurface oasisSurface="card" style={styles.locationPromptCard}>
          <View style={styles.locationGateIcon}>
            <MapPin size={26} color={OASIS.colors.primary} />
          </View>

          <Text style={styles.locationPromptTitle}>تحديث موقعك الأسبوعي</Text>

          <Text style={styles.locationPromptText}>
            هل ما زلت في نفس الحي؟ حدّث موقعك لتصلك منشورات وتنبيهات جيرانك
            بدقة.
          </Text>

          <View style={styles.locationPromptLockRow}>
            <MapPin size={15} color={OASIS.colors.primary} />
            <Text style={styles.locationPromptLockText} numberOfLines={3}>
              {cityLine}
            </Text>
          </View>

          <Text style={styles.locationPromptNotice}>
            التحقق من الموقع إلزامي ولا يمكن تخطّيه. سيتم قراءة موقعك الحقيقي
            عبر GPS وتثبيت مدينتك، ولن تتمكن من تغييرها يدوياً لاحقاً.
          </Text>

          {!!message && (
            <Text
              style={styles.locationPromptMessage}
              accessibilityLiveRegion="assertive"
            >
              {message}
            </Text>
          )}

          <View style={styles.locationPromptActions}>
            <Pressable
              style={styles.locationPromptAllow}
              onPress={onUpdate}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="تحديث الموقع الآن عبر GPS"
              accessibilityState={{ disabled: busy, busy }}
            >
              {busy ? (
                <ActivityIndicator
                  color={OASIS.colors.surface}
                  accessibilityLabel="جارٍ التحديث"
                />
              ) : (
                <Text style={styles.locationPromptAllowText}>
                  تحديث الآن عبر GPS
                </Text>
              )}
            </Pressable>
          </View>

          <Pressable
            onPress={onOpenSettings}
            disabled={busy}
            accessibilityRole="button"
            accessibilityState={{ disabled: busy }}
            accessibilityHint="يفتح إعدادات المتصفح أو الجهاز لتفعيل الموقع"
            hitSlop={6}
          >
            <Text style={styles.locationPromptHelp}>
              المتصفح لا يدعم الموقع أو رفضت الإذن؟ اضغط هنا لطريقة التفعيل
            </Text>
          </Pressable>
        </OasisSurface>
      </View>
    </Modal>
  );
}

export const WeeklyLocationPrompt = memo(WeeklyLocationPromptBase);