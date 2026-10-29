import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Send } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';

/* -------------------------------------------------------------------------- */
/*                                  Types                                     */
/* -------------------------------------------------------------------------- */

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  onSend: () => void;
  placeholder?: string;
  sendLabel?: string;
  busy?: boolean;
  disabled?: boolean;
  maxLength?: number;
  onFocusChange?: (focused: boolean) => void;
  style?: StyleProp<ViewStyle>;
};

/* -------------------------------------------------------------------------- */
/*                                Constants                                   */
/* -------------------------------------------------------------------------- */

const MIN_HEIGHT = 48;
const MAX_HEIGHT = 128;
const COUNTER_THRESHOLD_RATIO = 0.8; // 80% من maxLength
const WEB_EVENT_NAME = 'hayna:composer-focus';

/* -------------------------------------------------------------------------- */
/*                              Web Event Helper                              */
/* -------------------------------------------------------------------------- */

function emitWebFocusEvent(focused: boolean) {
  if (Platform.OS !== 'web') return;
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent(WEB_EVENT_NAME, { detail: { focused } }),
    );
  } catch {
    // بيئات قديمة — تجاهل
  }
}

/* -------------------------------------------------------------------------- */
/*                                Component                                   */
/* -------------------------------------------------------------------------- */

function DiscussionComposerBase({
  value,
  onChangeText,
  onSend,
  placeholder = 'اكتب ردك…',
  sendLabel = 'إرسال الرد',
  busy = false,
  disabled = false,
  maxLength = 500,
  onFocusChange,
  style,
}: Props) {
  const { colors } = useTheme();
  const [height, setHeight] = useState(MIN_HEIGHT);
  const [focused, setFocused] = useState(false);

  const trimmedLength = value.trim().length;
  const canSend = trimmedLength > 0 && !busy && !disabled;
  const isDisabled = disabled || busy;
  const showCounter =
    focused || value.length >= Math.floor(maxLength * COUNTER_THRESHOLD_RATIO);

  /* -------------------------- Reset on clear ------------------------- */
  useEffect(() => {
    if (!value) setHeight(MIN_HEIGHT);
  }, [value]);

  /* ----------------------- Emit blur on unmount ---------------------- */
  useEffect(() => {
    return () => {
      emitWebFocusEvent(false);
    };
  }, []);

  /* --------------------------- Focus change -------------------------- */
  const changeFocus = useCallback(
    (next: boolean) => {
      setFocused(next);
      onFocusChange?.(next);
      emitWebFocusEvent(next);
    },
    [onFocusChange],
  );

  const handleFocus = useCallback(() => changeFocus(true), [changeFocus]);
  const handleBlur = useCallback(() => changeFocus(false), [changeFocus]);

  /* ---------------------- Content size handler ----------------------- */
  const handleContentSizeChange = useCallback(
    (event: { nativeEvent: { contentSize: { height: number } } }) => {
      const measured = event.nativeEvent.contentSize.height;
      if (!Number.isFinite(measured)) return;
      const next = Math.min(
        MAX_HEIGHT,
        Math.max(MIN_HEIGHT, Math.round(measured)),
      );
      setHeight(next);
    },
    [],
  );

  /* ------------------------------- Button ---------------------------- */
  const sendBg = useMemo(() => {
    if (busy) return colors.primary;
    if (!canSend) return colors.line;
    return colors.primary;
  }, [busy, canSend, colors.primary, colors.line]);

  const sendFg = canSend ? colors.surface : colors.muted;

  return (
    <View style={[styles.container, style]}>
      <View
        style={[
          styles.frame,
          {
            backgroundColor: colors.soft,
            borderColor: focused ? colors.primary : colors.line,
          },
        ]}
      >
        <TextInput
          testID="discussion-composer-input"
          accessibilityLabel={placeholder}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          editable={!isDisabled}
          multiline
          maxLength={maxLength}
          textAlignVertical="top"
          onContentSizeChange={handleContentSizeChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={[styles.input, { height, color: colors.ink }]}
        />

        <Pressable
          testID="discussion-composer-send"
          accessibilityRole="button"
          accessibilityLabel={sendLabel}
          accessibilityHint="يرسل النص الحالي"
          accessibilityState={{ disabled: !canSend, busy }}
          disabled={!canSend}
          onPress={onSend}
          style={({ pressed }) => [
            styles.send,
            {
              backgroundColor: sendBg,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
          hitSlop={2}
        >
          {busy ? (
            <ActivityIndicator
              size="small"
              color={colors.surface}
              accessibilityLabel="جارٍ الإرسال"
            />
          ) : (
            <Send size={18} color={sendFg} />
          )}
        </Pressable>
      </View>

      {showCounter ? (
        <Text
          style={[styles.counter, { color: colors.muted }]}
          accessibilityLiveRegion="polite"
        >
          {value.length} / {maxLength}
        </Text>
      ) : null}
    </View>
  );
}

export const DiscussionComposer = memo(DiscussionComposerBase);

/* -------------------------------------------------------------------------- */
/*                                  Styles                                    */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 4,
  },
  frame: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-end',
    borderWidth: 1,
    borderRadius: 18,
    padding: 4,
    gap: 4,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: MIN_HEIGHT,
    maxHeight: MAX_HEIGHT,
    paddingHorizontal: 10,
    paddingVertical: 12,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'right',
    backgroundColor: 'transparent',
    borderWidth: 0,
    ...(Platform.OS === 'web' ? { outlineWidth: 0 } : {}),
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    flexShrink: 0,
  },
  counter: {
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'left',
    paddingHorizontal: 6,
  },
});