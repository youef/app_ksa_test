import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { OasisSurface } from '@/components/oasis/OasisPrimitives';
import type { OasisAsset } from '@/components/oasis/assets';
import { useTheme } from '@/context/ThemeContext';

/* -------------------------------------------------------------------------- */
/*                                 Types                                      */
/* -------------------------------------------------------------------------- */

export type GlassFrameVariant = 'weather' | 'location';

export type OasisGlassFrameProps = {
  children: ReactNode;
  /** يسمح بتمرير كائن أو مصفوفة أو undefined — كما يفعل RN القياسي */
  style?: StyleProp<ViewStyle>;
  variant?: GlassFrameVariant;
  /** وصف وصولي — يُقرأ بواسطة قارئ الشاشة إن مُرِّر */
  accessibilityLabel?: string;
  /** هل العنصر تفاعلي؟ (button, link...) */
  accessibilityRole?: 'none' | 'button' | 'link' | 'summary';
};

/* -------------------------------------------------------------------------- */
/*                               Config                                       */
/* -------------------------------------------------------------------------- */

const SURFACE_ASSET: Record<GlassFrameVariant, OasisAsset> = {
  weather: 'cards/notice-small',
  location: 'cards/default-small',
};

/* -------------------------------------------------------------------------- */
/*                               Component                                    */
/* -------------------------------------------------------------------------- */

export default function OasisGlassFrame({
  children,
  style,
  variant = 'weather',
  accessibilityLabel,
  accessibilityRole,
}: OasisGlassFrameProps) {
  const { colors } = useTheme();

  const borderColor = colors?.line ?? 'rgba(0,0,0,0.08)';

  return (
    <OasisSurface
      oasisAsset={SURFACE_ASSET[variant]}
      style={[styles.outer, { borderColor }, style]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
    >
      <View style={styles.content}>{children}</View>
    </OasisSurface>
  );
}

/* -------------------------------------------------------------------------- */
/*                                 Styles                                     */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  outer: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 44,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
});