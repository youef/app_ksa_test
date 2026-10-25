const fs=require('fs');const p='components/oasis/OasisPrimitives.tsx';let s=fs.readFileSync(p,'utf8');const start=s.indexOf('const TEXT_KEYS');const end=s.indexOf('const styles =',start);s=s.slice(0,start)+`/** Direct native input preserves flex layout, refs and Dynamic Type. */
export const OasisTextInput = forwardRef<NativeTextInput, TextInputProps & { 'aria-invalid'?: boolean | 'true' | 'false' }>(function OasisTextInput({ style, onFocus, onBlur, placeholderTextColor, selectionColor, ...props }, ref) {
  const [focused, setFocused] = useState(false);
  const flat = StyleSheet.flatten(style) || {};
  const framed = Boolean(flat.borderWidth || flat.backgroundColor && flat.backgroundColor !== 'transparent');
  const invalid = props['aria-invalid'] === true || props['aria-invalid'] === 'true';
  return <NativeTextInput {...props} ref={ref}
    onFocus={e => { setFocused(true); onFocus?.(e); }} onBlur={e => { setFocused(false); onBlur?.(e); }}
    placeholderTextColor={placeholderTextColor || OASIS.colors.muted} selectionColor={selectionColor || OASIS.colors.primary}
    style={[{ fontSize: 16, color: OASIS.colors.ink, textAlign: 'right', minWidth: 0 }, style,
      framed && { borderRadius: 10, minHeight: props.multiline ? 100 : 44, borderColor: invalid ? OASIS.colors.danger : focused ? OASIS.colors.primary : OASIS.colors.line },
      Platform.OS === 'web' && { outlineStyle: 'none' } as TextStyle]} />;
});
`+s.slice(end);s=s.replace(/    const imageState: OasisState[^\n]*\n/,'');fs.writeFileSync(p,s);
function edit(p,fn){fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8')))}
edit('components/shared/HeaderArtwork.tsx',()=>`import { StyleSheet, View } from 'react-native';\nimport { OASIS } from '@/lib/oasis';\nexport function HeaderArtwork({ dark = false }: { dark?: boolean }) { return <View pointerEvents="none" accessibilityElementsHidden style={[StyleSheet.absoluteFillObject, { backgroundColor: dark ? 'rgba(13,33,27,0.92)' : OASIS.colors.surface }]} />; }\n`);
edit('components/shared/GlassIconArtwork.tsx',()=>`/** Header icons use the toolbar background and a 44-point native hit area. */\nexport function GlassIconArtwork({ dark = false }: { dark?: boolean }) { return null; }\n`);
edit('components/shared/AppHeader.tsx',s=>s.replace('APP_HEADER_HEIGHT = 64','APP_HEADER_HEIGHT = 48').replace('HEADER_SIDE_WIDTH = 96','HEADER_SIDE_WIDTH = 88').replace("fontSize: 16, lineHeight: 21, fontWeight: '800'","fontSize: 17, lineHeight: 23, fontWeight: '600'").replace('fontSize: 11, lineHeight: 16','fontSize: 12, lineHeight: 16').replace("borderBottomColor: '#e4eee8'","borderBottomColor: OASIS.colors.line").replace('gap: 6 },\n  actionButton','gap: 0 },\n  actionButton').replace("fontSize: 9, lineHeight: 12","fontSize: 11, lineHeight: 13"));
edit('components/shared/Button.tsx',s=>s.replace('minHeight: 52, borderRadius: 20','minHeight: 44, borderRadius: 10').replace("fontWeight: '800'","fontWeight: '600'"));
edit('components/shared/HaynaActionButton.tsx',s=>s.replace("fontWeight: '900'","fontWeight: '600'"));
edit('components/oasis/OasisEmptyIllustration.tsx',s=>s.replace('compact ? 112 : 160','compact ? 72 : 96').replace('compact ? 98 : 140','compact ? 63 : 84'));
edit('components/home/OasisGlassFrame.tsx',s=>s.replace('borderRadius: 20, minHeight: 54','borderRadius: 12, minHeight: 44'));
edit('lib/bottomNav.ts',s=>s.replace('BOTTOM_NAV_HEIGHT = 80','BOTTOM_NAV_HEIGHT = 56'));
edit('app/_layout.tsx',s=>s.replace(/\s*@import url\([^\n]+\n/,'\n').replaceAll("'IBM Plex Sans Arabic', sans-serif","-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif").replace('#F5F3E9; color: #173F30','#F2F2F7; color: #1C1C1E').replace(/\s*<View pointerEvents="none" style=\{\{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 \}\}><Image accessible=\{false\} source=\{require\('\.\.\/public\/design-system\/hayna-v1\/backgrounds\/page.png'\)\} resizeMode="cover" style=\{\{ width: '100%', height: '100%' \}\} \/><\/View>/,''));
edit('components/BottomNav.tsx',s=>{const a=s.indexOf('        <View pointerEvents="none" style={styles.background}>');const b=s.indexOf('        <View style={styles.row}>',a);s=s.slice(0,a)+s.slice(b);const start=s.indexOf('                {isCreate ? (');const end=s.indexOf('              </Pressable>',start);s=s.slice(0,start)+`                <View style={styles.iconWrap}><Icon size={23} color={isActive ? OASIS.colors.primary : OASIS.colors.muted} strokeWidth={isActive ? 2.3 : 1.8} /></View>
                <Text numberOfLines={1} style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
`+s.slice(end);s=s.replace('left: 12,','left: 0,').replace('right: 12,','right: 0,').replace("backgroundColor: 'transparent',\n  },\n  surface",'backgroundColor: OASIS.colors.surface,\n    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: OASIS.colors.line,\n  },\n  surface');const x=s.indexOf('  surface: {');const y=s.indexOf('  background:',x);s=s.slice(0,x)+`  surface: { height: 56, maxWidth: 720, width: '100%', alignSelf: 'center' },\n`+s.slice(y);return s.replace('height: 98','height: 56').replace('paddingTop: 8','paddingTop: 2').replace('minHeight: 58','minHeight: 50').replace('height: 36','height: 26').replace('gap: 3','gap: 1')});
