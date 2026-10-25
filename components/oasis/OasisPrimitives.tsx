import React, { forwardRef, useState, type ReactNode } from 'react';
import {
  Image, Platform, Pressable as NativePressable, TextInput as NativeTextInput, Text,
  StyleSheet, View, type PressableProps, type PressableStateCallbackType,
  type TextInputProps, type ViewProps, type ViewStyle, type TextStyle,
} from 'react-native';
import { OASIS, type OasisVariant, type OasisButtonSize } from '@/lib/oasis';
import { oasisAssets, type OasisAsset } from './assets';

export type OasisKind = 'auto' | 'plain' | 'action' | 'icon' | 'chip' | 'card';
type ActionProps = PressableProps & { oasisKind?: OasisKind; oasisVariant?: OasisVariant; oasisSize?: OasisButtonSize; oasisSurfaceState?: 'default' | 'selected' | 'unread' | 'notice' | 'error' };
const SIZE_HEIGHT = { xs: 32, sm: 36, icon: 44, md: 44, form: 44, lg: 48, hero: 48 } as const;
const GREEN = new Set(['#047857', '#059669', '#10b981', '#064e3b', '#065f46', '#16a34a', '#0f766e']);
const RED = new Set(['#b93838', '#dc2626', '#ef4444', '#b91c1c', '#be123c']);
function isDarkSurface(style: ViewStyle) {
  const color = String(style.backgroundColor || '').toLowerCase();
  const rgb = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgb) return Number(rgb[1]) * .2126 + Number(rgb[2]) * .7152 + Number(rgb[3]) * .0722 < 90;
  return ['#0d211b','#153c30','#064e3b','#173f30','#102a22','#020617','#0f172a'].includes(color);
}
function actionVariant(style: ViewStyle): OasisVariant {
  const color = String(style.backgroundColor || '').toLowerCase();
  if (RED.has(color) || [OASIS.colors.dangerSoft.toLowerCase(), '#fee2e2', '#fef2f2'].includes(color)) return 'danger';
  if (GREEN.has(color)) return 'primary';
  if (['#c4a45f', '#e8d8a4', '#f59e0b'].includes(color)) return 'gold';
  if (color === 'transparent' || !color) return 'ghost';
  if (isDarkSurface(style)) return 'primary';
  return 'secondary';
}
function actionSize(style: ViewStyle, kind: OasisKind): OasisButtonSize {
  const h = typeof style.height === 'number' ? style.height : typeof style.minHeight === 'number' ? style.minHeight : 0;
  if (kind === 'icon') return 'icon';
  if (kind === 'chip') return 'sm';
  if (h >= 60) return 'hero';
  if (h >= 55) return 'lg';
  if (h > 0 && h <= 44) return 'icon';
  if (h > 0 && h <= 48) return 'md';
  return 'form';
}
export function OasisArtwork({ asset, radius = 0, opacity = 1 }: { asset: OasisAsset; radius?: number; opacity?: number }) {
  const family = asset.split('/')[0];
  const inset = family === 'fields' ? 16 : family === 'cards' || family === 'chat' ? 22 : family === 'surfaces' || family === 'alerts' || family === 'navigation' ? 26 : family === 'buttons' ? (asset.includes('-xs-') ? 14 : asset.includes('-sm-') ? 18 : 20) : 0;
  // Nine-slice preserves corner radii and stroke weight at desktop and mobile widths.
  const webBorder = Platform.OS === 'web' && inset ? {
    borderStyle: 'solid', borderWidth: inset, borderColor: 'transparent',
    borderImageSource: 'url("/design-system/hayna-v1/' + asset + '@3x.png")',
    borderImageSlice: String(inset * 3) + ' fill', borderImageWidth: inset + 'px', borderImageRepeat: 'stretch',
  } as unknown as ViewStyle : undefined;
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFillObject, { borderRadius: radius, overflow: 'hidden', opacity }]}>
    {webBorder ? <View style={[StyleSheet.absoluteFillObject, webBorder]} /> : <Image accessible={false} source={oasisAssets[asset]} resizeMode="stretch" capInsets={inset ? { top: inset, left: inset, bottom: inset, right: inset } : undefined} style={styles.fill} />}
  </View>;
}

function foreground(children: ReactNode, color?: string): ReactNode {
  return React.Children.map(children, child => {
    if (!React.isValidElement(child)) return child;
    if (child.type === React.Fragment) return <>{foreground((child.props as { children?: ReactNode }).children, color)}</>;
    const element = child as React.ReactElement<{ style?: unknown; color?: string; children?: ReactNode }>;
    const originalStyle = element.props.style;
    const layer = {};
    const override: Record<string, unknown> = { style: typeof originalStyle === 'function' ? (state: unknown) => [layer, originalStyle(state)] : [layer, originalStyle] };
    if (color && element.type === Text) override.style = [layer, originalStyle, { color }];
    else if (color && element.props.color !== undefined) override.color = color;
    if (element.props.children) {
      const childStyle = typeof originalStyle === 'function' ? undefined : StyleSheet.flatten(originalStyle as ViewStyle);
      const childColor = childStyle?.backgroundColor && childStyle.backgroundColor !== 'transparent' ? undefined : color;
      override.children = foreground(element.props.children, childColor);
    }
    return React.cloneElement(element, override);
  });
}

/** Preserves native Pressable events, refs, callbacks, and render-prop children. */
export const OasisPressable = forwardRef<React.ElementRef<typeof NativePressable>, ActionProps>(function OasisPressable({ oasisKind = 'auto', oasisVariant, oasisSize, oasisSurfaceState, style, children, onFocus, onBlur, ...props }, ref) {
  const resolve = (state: PressableStateCallbackType) => {
    const original = StyleSheet.flatten(typeof style === 'function' ? style(state) : style) || {};
    let kind = oasisKind;
    if (kind === 'auto') {
      const h = typeof original.height === 'number' ? original.height : typeof original.minHeight === 'number' ? original.minHeight : undefined;
      const w = typeof original.width === 'number' ? original.width : undefined;
      const filled = GREEN.has(String(original.backgroundColor).toLowerCase()) || RED.has(String(original.backgroundColor).toLowerCase());
      kind = w && h && w <= 80 && h <= 80 && Math.abs(w - Number(h)) <= 8 ? 'icon' : filled && (!h || Number(h) <= 64) && original.alignItems === 'center' ? 'action' : 'plain';
    }
    const variant = oasisVariant || actionVariant(original);
    const size = oasisSize || actionSize(original, kind);
    const filled = variant === 'primary' || variant === 'danger';
    const backgroundColor = props.disabled ? OASIS.colors.line : variant === 'primary' ? OASIS.colors.primary : variant === 'danger' ? OASIS.colors.danger : variant === 'ghost' ? 'transparent' : variant === 'gold' ? OASIS.colors.warningSoft : OASIS.colors.soft;
    const geometry: ViewStyle | undefined = kind === 'action' || kind === 'chip' ? {
      minHeight: kind === 'chip' ? 32 : Math.max(SIZE_HEIGHT[size], OASIS.touchTarget),
      height: undefined,
      paddingHorizontal: original.paddingHorizontal ?? (kind === 'chip' ? 12 : 18),
      paddingVertical: kind === 'chip' ? 5 : 10, alignItems: 'center', justifyContent: 'center', borderRadius: kind === 'chip' ? 8 : 10,
      backgroundColor, borderWidth: 0, shadowOpacity: 0, elevation: 0,
    } : kind === 'icon' ? { minWidth: 44, minHeight: 44, borderRadius: 10, backgroundColor: filled ? backgroundColor : 'transparent', borderWidth: 0, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0, elevation: 0 } : kind === 'card' ? { borderRadius: 14, borderWidth: 1, borderColor: oasisSurfaceState === 'unread' || oasisSurfaceState === 'selected' || props.accessibilityState?.selected ? '#B8DDCB' : original.borderColor || OASIS.colors.line, backgroundColor: isDarkSurface(original) ? original.backgroundColor : oasisSurfaceState === 'unread' ? OASIS.colors.soft : original.backgroundColor || OASIS.colors.surface, shadowOpacity: 0, elevation: 0 } : undefined;
    return { original, geometry, kind, color: props.disabled ? OASIS.colors.muted : filled ? OASIS.colors.surface : OASIS.colors.primary };
  };
  return <NativePressable {...props} hitSlop={props.hitSlop ?? (oasisKind === 'chip' ? { top: 6, bottom: 6, left: 0, right: 0 } : undefined)} ref={ref} accessibilityRole={props.accessibilityRole || (props.onPress ? 'button' : undefined)}
    accessibilityState={{ ...props.accessibilityState, disabled: props.disabled || props.accessibilityState?.disabled }}
    onFocus={onFocus} onBlur={onBlur}
    style={state => { const r = resolve(state); return [r.original, r.geometry, state.pressed && { opacity: .7 }, props.disabled && styles.disabled]; }}>
    {state => { const r = resolve(state); const content = typeof children === 'function' ? children(state) : children; return r.kind === 'plain' || r.kind === 'card' ? content : foreground(content, r.color); }}
  </NativePressable>;
});

export type OasisSurfaceKind = 'card' | 'icon' | 'field' | 'sheet' | 'bubble-in' | 'bubble-out' | 'live-panel' | 'notice';
type SurfaceProps = ViewProps & { oasisSurface?: OasisSurfaceKind; oasisAsset?: OasisAsset };
export const OasisSurface = forwardRef<View, SurfaceProps>(function OasisSurface({ oasisSurface = 'card', oasisAsset, style, children, ...props }, ref) {
  return <View {...props} ref={ref} style={[{ backgroundColor: oasisSurface === 'live-panel' ? OASIS.colors.liveSurface : oasisSurface === 'bubble-out' ? '#DCF0E2' : oasisSurface === 'icon' || oasisSurface === 'field' ? OASIS.colors.background : OASIS.colors.surface, borderRadius: oasisSurface === 'icon' || oasisSurface === 'field' ? 10 : 14 }, style, { shadowOpacity: 0, elevation: 0 }]}>
    {children}
  </View>;
});

/** Direct native input preserves flex layout, refs and Dynamic Type. */
export const OasisTextInput = forwardRef<NativeTextInput, TextInputProps & { 'aria-invalid'?: boolean | 'true' | 'false' }>(function OasisTextInput({ style, onFocus, onBlur, placeholderTextColor, selectionColor, ...props }, ref) {
  const [focused, setFocused] = useState(false);
  const flat = StyleSheet.flatten(style) || {};
  const framed = Boolean(flat.borderWidth || flat.backgroundColor && flat.backgroundColor !== 'transparent');
  const invalid = props['aria-invalid'] === true || props['aria-invalid'] === 'true' || [OASIS.colors.danger, '#dc2626', '#c2413a'].includes(String(flat.borderColor));
  return <NativeTextInput {...props} ref={ref}
    onFocus={e => { setFocused(true); onFocus?.(e); }} onBlur={e => { setFocused(false); onBlur?.(e); }}
    placeholderTextColor={placeholderTextColor || OASIS.colors.muted} selectionColor={selectionColor || OASIS.colors.primary}
    style={[{ fontSize: 16, color: OASIS.colors.ink, textAlign: 'right', minWidth: 0 }, style,
      framed && { borderRadius: 10, minHeight: props.multiline ? 100 : 44, borderColor: invalid ? OASIS.colors.danger : focused ? OASIS.colors.primary : OASIS.colors.line },
      Platform.OS === 'web' && { outlineStyle: 'none', outlineWidth: 0 } as unknown as TextStyle]} />;
});
const styles = StyleSheet.create({ fill: { width: '100%', height: '100%' }, artworkHost: { position: 'relative', backgroundColor: 'transparent', borderColor: 'transparent' }, disabled: { opacity: .65 } });
