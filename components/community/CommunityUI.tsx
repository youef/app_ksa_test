import type { ReactNode } from 'react';
import { memo, useMemo } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import {
  OasisPressable as Pressable,
  OasisTextInput as TextInput,
} from '@/components/oasis/OasisPrimitives';
import { useTheme } from '@/context/ThemeContext';

/* -------------------------------------------------------------------------- */
/*                                  Types                                     */
/* -------------------------------------------------------------------------- */

type CardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

type CommunityTextProps = {
  children: ReactNode;
  muted?: boolean;
  heading?: boolean;
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
};

type FieldProps = TextInputProps & {
  label?: string;
};

type ButtonProps = {
  title: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  secondary?: boolean;
  danger?: boolean;
  /** يُمرَّر كـ accessibilityHint */
  hint?: string;
};

type ErrorProps = {
  message?: string;
  onRetry?: () => void;
};

/* -------------------------------------------------------------------------- */
/*                                Card                                        */
/* -------------------------------------------------------------------------- */

function CommunityCardBase({ children, style }: CardProps) {
  const { colors: c } = useTheme();
  return (
    <View
      style={[
        communityStyles.card,
        { backgroundColor: c.surface, borderColor: c.line },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export const CommunityCard = memo(CommunityCardBase);

/* -------------------------------------------------------------------------- */
/*                                Text                                        */
/* -------------------------------------------------------------------------- */

function CommunityTextBase({
  children,
  muted = false,
  heading = false,
  numberOfLines,
  style,
}: CommunityTextProps) {
  const { colors: c } = useTheme();

  const computed = useMemo(
    () => ({
      color: muted ? c.muted : c.ink,
      textAlign: 'right' as const,
      fontSize: heading ? 17 : 13,
      lineHeight: heading ? 26 : 22,
      fontWeight: (heading ? '700' : '400') as '700' | '400',
    }),
    [muted, heading, c.muted, c.ink],
  );

  return (
    <Text style={[computed, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

export const CommunityText = memo(CommunityTextBase);

/* -------------------------------------------------------------------------- */
/*                                Field                                       */
/* -------------------------------------------------------------------------- */

function CommunityFieldBase({ label, style, ...props }: FieldProps) {
  const { colors: c } = useTheme();

  return (
    <View style={communityStyles.fieldWrap}>
      {label ? <CommunityText>{label}</CommunityText> : null}

      <TextInput
        {...props}
        accessibilityLabel={props.accessibilityLabel ?? label}
        placeholderTextColor={props.placeholderTextColor ?? c.muted}
        style={[
          communityStyles.input,
          { color: c.ink, borderColor: c.line, backgroundColor: c.background },
          props.multiline && communityStyles.inputMultiline,
          style,
        ]}
      />
    </View>
  );
}

export const CommunityField = memo(CommunityFieldBase);

/* -------------------------------------------------------------------------- */
/*                                Button                                      */
/* -------------------------------------------------------------------------- */

function CommunityButtonBase({
  title,
  onPress,
  busy = false,
  disabled = false,
  secondary = false,
  danger = false,
  hint,
}: ButtonProps) {
  const { colors: c } = useTheme();

  // danger له أولوية على secondary
  const isDanger = danger;
  const isSecondary = !danger && secondary;

  const bg = isDanger ? c.danger : isSecondary ? c.soft : c.primary;
  const fg = isSecondary ? c.primary : c.surface;

  const isDisabled = disabled || busy;

  return (
    <Pressable
      oasisKind="plain"
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={hint}
      accessibilityState={{ disabled: isDisabled, busy }}
      disabled={isDisabled}
      onPress={onPress}
      style={[
        communityStyles.button,
        { backgroundColor: bg, opacity: isDisabled ? 0.5 : 1 },
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <Text
          style={{
            color: fg,
            fontSize: 13,
            fontWeight: '700',
            textAlign: 'center',
          }}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export const CommunityButton = memo(CommunityButtonBase);

/* -------------------------------------------------------------------------- */
/*                                Error                                       */
/* -------------------------------------------------------------------------- */

function CommunityErrorBase({ message, onRetry }: ErrorProps) {
  const { colors: c } = useTheme();

  if (!message) return null;

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      accessibilityLabel={`خطأ: ${message}`}
      style={[
        communityStyles.card,
        { backgroundColor: c.dangerSoft, borderColor: c.danger },
      ]}
    >
      <Text style={{ color: c.danger, textAlign: 'right', lineHeight: 22 }}>
        {message}
      </Text>

      {onRetry ? (
        <CommunityButton
          title="إعادة المحاولة"
          secondary
          onPress={onRetry}
          hint="يعيد المحاولة"
        />
      ) : null}
    </View>
  );
}

export const CommunityError = memo(CommunityErrorBase);

/* -------------------------------------------------------------------------- */
/*                              Layout Helpers                                */
/* -------------------------------------------------------------------------- */

function CommunityRowBase({ children }: { children: ReactNode }) {
  return <View style={communityStyles.row}>{children}</View>;
}

export const CommunityRow = memo(CommunityRowBase);

function CommunityContentBase({ children }: { children: ReactNode }) {
  return <View style={communityStyles.content}>{children}</View>;
}

export const CommunityContent = memo(CommunityContentBase);

/* -------------------------------------------------------------------------- */
/*                              Styles                                        */
/* -------------------------------------------------------------------------- */

export const communityStyles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 19,
    padding: 16,
    gap: 12,
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    textAlign: 'right',
    fontSize: 14,
  },
  inputMultiline: {
    minHeight: 90,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  fieldWrap: {
    gap: 7,
  },
  button: {
    minHeight: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  content: {
    padding: 16,
    gap: 13,
    maxWidth: 780,
    width: '100%',
    alignSelf: 'center',
  },
});