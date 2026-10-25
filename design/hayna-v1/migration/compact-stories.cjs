const fs=require('fs');const p='app/stories.tsx';let s=fs.readFileSync(p,'utf8');s=s.replace("import { oasisAssets } from '@/components/oasis/assets';\n",'').replace('OasisPressable as Pressable, OasisSurface','OasisPressable as Pressable').replace('useCallback, useEffect, useRef, useState','useCallback, useState').replace('Image, ImageBackground, Platform, ActivityIndicator, RefreshControl, Animated','Image, ActivityIndicator, RefreshControl').replace('Plus, ShieldCheck, Sparkles, ChevronDown, UserPlus, Check','Plus, ShieldCheck, ChevronDown, UserPlus, Check').replace("import { LinearGradient } from 'expo-linear-gradient';\n",'');const a=s.indexOf('  const storyRingPulse =');const b=s.indexOf('  useFocusEffect',a);s=s.slice(0,a)+`  const [gridWidth, setGridWidth] = useState(0);
  const columns = gridWidth >= 640 ? 3 : 2;
  const cardWidth = gridWidth ? (gridWidth - 10 * (columns - 1)) / columns : undefined;
  const mediaHeight = cardWidth ? Math.min(160, Math.round(cardWidth * .88)) : 144;

`+s.slice(b);s=s.replace('<Plus size={15} color={OASIS.colors.surface} strokeWidth={2.5} />','<Plus size={21} color={OASIS.colors.primary} strokeWidth={2} />');s=s.replace(/        <Image source=\{\{ uri: Platform.OS === 'web'[^\n]+\n/,'');s=s.replace('<Plus size={27}','<Plus size={22}');s=s.replace('<Animated.View style={[styles.ringOuter, group.hasUnseen ? { borderColor: ringColor(author), borderWidth: 3.5 } : styles.ringSeen, group.stories.length > 1 && { transform: [{ scale: storyRingPulse }] }]}>' , '<View style={[styles.ringOuter, group.hasUnseen ? { borderColor: ringColor(author) } : styles.ringSeen]}>').replace('</Animated.View>','</View>');s=s.replace('bottomNavInset + 30','bottomNavInset + 12');s=s.replace('<View style={styles.storiesGrid}>','<View style={styles.storiesGrid} onLayout={event => setGridWidth(event.nativeEvent.layout.width)}>');const start=s.indexOf('                  <Pressable oasisKind="card" key={group.authorId}');const end=s.indexOf('\n                );',start);
s=s.slice(0,start)+`                  <Pressable oasisKind="card" key={group.authorId}
                    style={[styles.storyCard, { width: cardWidth || '48%' }]}
                    onPress={() => openAuthorStories(group.stories, trendingAuthors)}
                    accessibilityRole="button" accessibilityLabel={"فتح يوميات " + name}>
                    <View style={[styles.storyCardMedia, { backgroundColor: bg, height: mediaHeight }]}>
                      {hasMedia ? <Image accessible={false} source={{ uri: story.image_url }} style={styles.storyCardImage} resizeMode="cover" /> :
                        <View style={styles.storyTextCard}>
                          <Text style={[styles.storyTextSnippet, { color: previewTextColor(bg) }]} numberOfLines={4}>{story.content || 'يوميات جديدة'}</Text>
                        </View>}
                      <View style={styles.previewBadge}><Text style={styles.previewBadgeText}>{group.stories.length} {group.stories.length === 1 ? 'يومية' : 'يوميات'}</Text></View>
                    </View>
                    <View style={styles.cardFooter}>
                      <View style={styles.cardAvatarWrap}>
                        {!author?.hide_name && author?.avatar_url ? <Image source={{ uri: author.avatar_url }} style={styles.cardAvatar} /> :
                          <View style={styles.cardAvatarFallback}><Text style={styles.cardAvatarLetter}>{author?.hide_name ? '؟' : name[0]}</Text></View>}
                        {verified && <View style={styles.cardVerifyBadge}><ShieldCheck size={9} color={OASIS.colors.surface} /></View>}
                      </View>
                      <View style={styles.cardCopy}>
                        <Text style={styles.cardAuthorName} numberOfLines={1}>{name}</Text>
                        <Text style={styles.cardTimeText} numberOfLines={1}>{relativeTime(story.created_at)}</Text>
                      </View>
                      {group.authorId !== viewerId ? <Pressable oasisKind="plain" accessibilityRole="button" accessibilityState={{ selected: followingIds.includes(group.authorId) }} accessibilityLabel={(followingIds.includes(group.authorId) ? 'إلغاء متابعة ' : 'متابعة ') + name} onPress={event => { event.stopPropagation(); void toggleFollow(group.authorId); }} style={styles.followButton}>
                        {followingIds.includes(group.authorId) ? <Check size={17} color={OASIS.colors.primary} /> : <UserPlus size={17} color={OASIS.colors.primary} />}
                      </Pressable> : null}
                    </View>
                    <View style={styles.seenRow}><View style={[styles.statusDot, { backgroundColor: allSeen ? OASIS.colors.muted : OASIS.colors.primary }]} /><Text style={styles.storySeenLabel}>{allSeen ? 'تمت المشاهدة' : 'يوميات جديدة'}</Text></View>
                  </Pressable>`+s.slice(end);
const styleStart=s.indexOf('const styles = StyleSheet.create(');s=s.slice(0,styleStart)+`/** Keep text readable on the author's chosen story background. */
function previewTextColor(background: string) {
  const hex = background.replace('#', '');
  const normalized = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return '#FFFFFF';
  const rgb = [0, 2, 4].map(i => parseInt(normalized.slice(i, i + 2), 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722 > .179 ? '#1C1C1E' : '#FFFFFF';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: OASIS.colors.background },
  addStoryBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  scroll: { padding: 12 },
  loadingBox: { paddingVertical: 36, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { fontSize: 13, color: OASIS.colors.muted },
  emptyBox: { backgroundColor: OASIS.colors.surface, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: OASIS.colors.line, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: OASIS.colors.ink, textAlign: 'center' },
  emptySub: { fontSize: 13, color: OASIS.colors.muted, textAlign: 'center', lineHeight: 20 },
  emptyActionBtn: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, backgroundColor: OASIS.colors.primary, paddingHorizontal: 16, marginTop: 4 },
  emptyActionBtnText: { color: OASIS.colors.surface, fontSize: 14, fontWeight: '600' },
  ringsSection: { backgroundColor: OASIS.colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: OASIS.colors.line, paddingVertical: 10 },
  sectionHeading: { color: OASIS.colors.ink, fontSize: 17, fontWeight: '600' },
  sectionSubheading: { color: OASIS.colors.muted, fontSize: 12, lineHeight: 18 },
  ringsScroll: { flexDirection: 'row-reverse', paddingHorizontal: 12, gap: 12, paddingVertical: 2 },
  ringItem: { width: 60, alignItems: 'center', gap: 5 },
  ringOuter: { width: 48, height: 48, borderRadius: 24, padding: 2, borderWidth: 2, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  ringSeen: { borderColor: OASIS.colors.line },
  ringInner: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', backgroundColor: OASIS.colors.background },
  ringAvatar: { width: '100%', height: '100%' },
  ringAvatarFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: OASIS.colors.soft },
  ringInitial: { color: OASIS.colors.primary, fontSize: 17, fontWeight: '600' },
  ringCount: { position: 'absolute', bottom: -3, right: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: OASIS.colors.primary, borderWidth: 2, borderColor: OASIS.colors.surface, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  ringCountText: { color: OASIS.colors.surface, fontSize: 11, fontWeight: '600' },
  ringName: { color: OASIS.colors.ink, fontSize: 11, textAlign: 'center', maxWidth: 60 },
  trendingSectionTitleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7, marginBottom: 12 },
  trendingSectionAccent: { width: 3, height: 18, borderRadius: 2, backgroundColor: OASIS.colors.primary },
  storiesGrid: { direction: 'ltr', flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  storyCard: { borderRadius: 14, overflow: 'hidden', backgroundColor: OASIS.colors.surface, borderWidth: 1, borderColor: OASIS.colors.line },
  storyCardMedia: { position: 'relative', overflow: 'hidden' },
  storyCardImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  storyTextCard: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingTop: 32, paddingBottom: 12 },
  storyTextSnippet: { fontSize: 14, fontWeight: '500', textAlign: 'center', lineHeight: 21 },
  previewBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,.48)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  previewBadgeText: { color: '#FFFFFF', fontSize: 11 },
  cardFooter: { flexDirection: 'row-reverse', alignItems: 'center', paddingRight: 8, paddingLeft: 2, gap: 6, minHeight: 52 },
  cardAvatarWrap: { position: 'relative' },
  cardAvatar: { width: 26, height: 26, borderRadius: 13 },
  cardAvatarFallback: { width: 26, height: 26, borderRadius: 13, backgroundColor: OASIS.colors.soft, alignItems: 'center', justifyContent: 'center' },
  cardAvatarLetter: { color: OASIS.colors.primary, fontSize: 12, fontWeight: '600' },
  cardVerifyBadge: { position: 'absolute', bottom: -2, left: -2, width: 12, height: 12, borderRadius: 6, backgroundColor: OASIS.colors.primary, alignItems: 'center', justifyContent: 'center' },
  cardCopy: { flex: 1, minWidth: 0, alignItems: 'flex-end' },
  cardAuthorName: { color: OASIS.colors.ink, fontSize: 12, fontWeight: '600' },
  cardTimeText: { color: OASIS.colors.muted, fontSize: 11, marginTop: 2 },
  followButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  seenRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingBottom: 8 },
  statusDot: { width: 4, height: 4, borderRadius: 2 },
  storySeenLabel: { fontSize: 11, color: OASIS.colors.muted },
  loadMoreButton: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 7, alignSelf: 'center', marginTop: 16, paddingHorizontal: 16, backgroundColor: OASIS.colors.soft },
  loadMoreButtonText: { color: OASIS.colors.primary, fontSize: 13, fontWeight: '600' },
});
`;
fs.writeFileSync(p,s);
