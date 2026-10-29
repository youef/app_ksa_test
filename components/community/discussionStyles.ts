import { StyleSheet } from 'react-native';

/* -------------------------------------------------------------------------- */
/*                          Design Tokens (Radius)                            */
/* -------------------------------------------------------------------------- */

const RADIUS = {
  card: 22,
  composer: 18,
} as const;

/* -------------------------------------------------------------------------- */
/*                              Base Text Fragment                            */
/* -------------------------------------------------------------------------- */

// خصائص نصية مشتركة — تُدمج في كل نمط نص
const baseText = {
  textAlign: 'right' as const,
} as const;

/* -------------------------------------------------------------------------- */
/*                                  Styles                                    */
/* -------------------------------------------------------------------------- */

export const discussionStyles = StyleSheet.create({
  /* --------------------------------- Page -------------------------------- */
  page: {
    width: '100%',
    maxWidth: 820,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24, // مساحة أسفل الصفحة
    gap: 16,
  },

  /* --------------------------------- Card -------------------------------- */
  card: {
    borderRadius: RADIUS.card,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    overflow: 'hidden', // يحمي الزوايا من فيضان المحتوى
  },

  /* ------------------------------ Section Header -------------------------- */
  sectionHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },

  /* -------------------------------- Typography ---------------------------- */
  title: {
    ...baseText,
    fontSize: 16,
    lineHeight: 25,
    fontWeight: '700',
    flexShrink: 1,
    minWidth: 0, // ضروري لـ flexShrink في حاويات RTL
  },

  hint: {
    ...baseText,
    fontSize: 12,
    lineHeight: 20,
  },
});

/* -------------------------------------------------------------------------- */
/*                              Helper (optional)                             */
/* -------------------------------------------------------------------------- */

/**
 * helper اختياري لتمرير الألوان مع الأنماط.
 * مثال:
 *   <View style={[discussionStyles.card, withColors({ bg: c.surface, border: c.line })]}>
 */
export function withColors(opts: {
  bg?: string;
  border?: string;
  text?: string;
}) {
  const out: Record<string, string> = {};
  if (opts.bg) out.backgroundColor = opts.bg;
  if (opts.border) out.borderColor = opts.border;
  if (opts.text) out.color = opts.text;
  return out;
}