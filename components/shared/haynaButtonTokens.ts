/** Hayna UI sizing contract — use these tokens instead of page-specific button heights. */
export const HAYNA_BUTTON = {
  heroHeight: 62,
  standardHeight: 52,
  compactHeight: 44,
  iconSize: 20,
  horizontalPadding: 18,
  contentGap: 8,
  verticalGap: 10,
  fontSize: 16,
  maxContentWidth: 440,
} as const;

export const HAYNA_BUTTON_IMAGES = {
  primary: '/images/buttons/hayna-login-button-bg.png',
  secondary: '/images/buttons/hayna-secondary-button-transparent.png',
} as const;

/**
 * Rules:
 * 1. Primary and secondary buttons within the same action group share width and height.
 * 2. Use heroHeight (62) for welcome/auth, standardHeight (52) for forms, compactHeight (44) for small contextual actions.
 * 3. Use width: '100%' inside the same parent container. Do not use arbitrary minWidth or different side padding.
 * 4. Artwork uses absoluteFillObject + resizeMode="stretch"; the image must not change layout.
 * 5. Put text and icons above artwork. Do not inject JSX inside onPress callbacks.
 * 6. Keep destructive, disabled, navigation and filter actions semantically distinct.
 * 7. Verify RTL, mobile and web, long Arabic labels and loading states before deployment.
 */
