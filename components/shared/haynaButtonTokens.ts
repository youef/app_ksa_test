/** Hayna UI sizing contract — use these tokens instead of page-specific button heights. */
export const HAYNA_BUTTON = {
  heroHeight: 48,
  standardHeight: 44,
  compactHeight: 44,
  iconSize: 20,
  horizontalPadding: 18,
  contentGap: 8,
  verticalGap: 10,
  fontSize: 16,
  maxContentWidth: 440,
} as const;

export const HAYNA_BUTTON_IMAGES = {
  primary: '/design-system/hayna-v1/buttons/primary-hero-default.png',
  secondary: '/design-system/hayna-v1/buttons/secondary-hero-default.png',
} as const;

/**
 * Rules:
 * 1. Primary and secondary buttons within the same action group share width and height.
 * 2. Use heroHeight (48) for welcome/auth, standardHeight (44) for forms, compactHeight (44) for small contextual actions.
 * 3. Use width: '100%' inside the same parent container. Do not use arbitrary minWidth or different side padding.
 * 4. Use flat backgrounds; image assets must not determine control geometry.
 * 5. Put text and icons above artwork. Do not inject JSX inside onPress callbacks.
 * 6. Keep destructive, disabled, navigation and filter actions semantically distinct.
 * 7. Verify RTL, mobile and web, long Arabic labels and loading states before deployment.
 */
