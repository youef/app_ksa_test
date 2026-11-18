import { OasisPressable as Pressable } from '@/components/oasis/OasisPrimitives';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Castle, Coins, Crown, RefreshCw, Shield, Ship, Swords, Trees, Trophy, Users, Wheat, X } from 'lucide-react-native';
import { AppHeader } from '@/components/shared/AppHeader';
import { useTheme } from '@/context/ThemeContext';
import { useBottomNavInset } from '@/lib/bottomNav';
import { supabase } from '@/lib/supabase';

type GameAction = 'collect' | 'recruit' | 'fortify' | 'upgrade' | 'pirates' | 'attack';
type Section = 'island' | 'war' | 'ranking';
type Captain = { id: string; alias: string; level: number; gold: number; timber: number; food: number; troops: number; fortress: number; trophies: number; wins: number; losses: number; last_attack_at: string | null };
type Rival = { id: string; alias: string; level: number; trophies: number; fortress: number };
type Leader = { alias: string; level: number; trophies: number; wins: number };
type BattleLog = { id: string; opponent: string; victory: boolean; attacked: boolean; gold: number; when: string };
type GameState = { joined: boolean; me: Captain; rank: number; leaders: Leader[]; targets: Rival[]; history: BattleLog[] };
type Result = { message?: string; battle?: { won: boolean; attack: number; defense: number; lost_troops: number; gold: number } };
type Tile = { emoji: string; name: string; action: GameAction; colors: [string, string] };
const TILES: Tile[] = [
  { emoji: '🌲', name: 'الغابة', action: 'collect', colors: ['#8DD199','#4EAE72'] },
  { emoji: '🌾', name: 'المزرعة', action: 'collect', colors: ['#D9E99B','#8BC559'] },
  { emoji: '🏰', name: 'القلعة', action: 'upgrade', colors: ['#EED8AA','#BD9A67'] },
  { emoji: '⛏️', name: 'المنجم', action: 'collect', colors: ['#D9CAA0','#AA945F'] },
  { emoji: '🌳', name: 'البستان', action: 'collect', colors: ['#A4DA9C','#5BAF75'] },
  { emoji: '🛡️', name: 'الحصن', action: 'fortify', colors: ['#C9D4D8','#829FAB'] },
  { emoji: '⚔️', name: 'الثكنة', action: 'recruit', colors: ['#E7C6A3','#B9865F'] },
  { emoji: '🌲', name: 'الأشجار', action: 'collect', colors: ['#8BCD93','#4E9F6B'] },
  { emoji: '🌱', name: 'الحقل', action: 'collect', colors: ['#D3E99C','#8ABF5D'] },
  { emoji: '⚓', name: 'الميناء', action: 'pirates', colors: ['#92D7DE','#4BA6BB'] },
  { emoji: '🏡', name: 'القرية', action: 'collect', colors: ['#BEE0A0','#7CA95E'] },
  { emoji: '🌿', name: 'الواحة', action: 'collect', colors: ['#A8D9A0','#4DB37A'] },
  { emoji: '🌾', name: 'السنابل', action: 'collect', colors: ['#CFE39A','#89BC5E'] },
  { emoji: '🪨', name: 'السور', action: 'fortify', colors: ['#D0D8D9','#84969C'] },
  { emoji: '🌳', name: 'الحديقة', action: 'collect', colors: ['#8CCDA0','#4D9D74'] },
  { emoji: '⛵', name: 'السفن', action: 'pirates', colors: ['#80C9D6','#3886A5'] },
];
const ACTIONS: Record<GameAction, string> = {
  collect: 'حصاد الموارد', recruit: 'تدريب ٨ جنود', fortify: 'تحصين القلعة',
  upgrade: 'ترقية القلعة', pirates: 'قتال قراصنة الضباب', attack: 'غزو جزيرة',
};
const COSTS: Record<string, string> = {
  collect: 'الموارد تتجدد تلقائيًا كل دقيقة', recruit: '٥٥ ذهب و٧٠ مؤونة',
  fortify: '٥٥ ذهب و٩٠ خشب', pirates: '٨ جنود على الأقل · استراحة دقيقتين',
};
const fmt = (n: number) => Number(n || 0).toLocaleString('ar-SA');

export default function Kingdom() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const bottomNavInset = useBottomNavInset();
  const [state, setState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState<Section>('island');
  const [tileIndex, setTileIndex] = useState(2);
  const [rival, setRival] = useState<Rival | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [battle, setBattle] = useState<Result['battle'] | null>(null);
  const [clock, setClock] = useState(Date.now());
  const tile = TILES[tileIndex];
  const me = state?.me;
  const tileSize = Math.floor((Math.min(width - 26, 560) - 54) / 4);
  const countdown = me?.last_attack_at
    ? Math.max(0, Math.ceil((new Date(me.last_attack_at).getTime() + 120000 - clock) / 1000)) : 0;
  const canAttack = countdown === 0 && (me?.troops || 0) >= 8;

  const reload = useCallback(async (join = false) => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { router.replace('/auth'); return; }
    const { data, error: queryError } = await supabase.rpc(join ? 'hayna_game_join' : 'hayna_game_state');
    if (queryError) throw queryError;
    setState(data as GameState);
  }, []);
  useEffect(() => {
    let mounted = true;
    void reload(true).catch((e: any) => { if (mounted) setError(e?.message || 'تعذّر تشغيل اللعبة'); })
      .finally(() => { if (mounted) setLoading(false); });
    const tick = setInterval(() => setClock(Date.now()), 15000);
    return () => { mounted = false; clearInterval(tick); };
  }, [reload]);
  const command = useCallback(async (action: GameAction, targetId?: string) => {
    if (busy) return;
    setBusy(true); setNotice(''); setError(''); setBattle(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('hayna_game_command',
        { p_action: action, p_target_id: targetId || null });
      if (rpcError) throw rpcError;
      const result = data as Result;
      setNotice(result?.message || 'تمت العملية');
      setBattle(result?.battle || null);
      setRival(null);
      await reload();
    } catch (e: any) { setError(e?.message || 'تعذّرت العملية، حاول من جديد'); }
    finally { setBusy(false); }
  }, [busy, reload]);

  const upgradeCost = fmt((me?.level || 1) * 140) + ' ذهب و' + fmt((me?.level || 1) * 105) + ' خشب';
  const cost = tile.action === 'upgrade' ? upgradeCost : COSTS[tile.action];
  const resources = [
    { title: 'ذهب', count: me?.gold || 0, Icon: Coins, color: '#DAA02C' },
    { title: 'خشب', count: me?.timber || 0, Icon: Trees, color: '#42966C' },
    { title: 'مؤونة', count: me?.food || 0, Icon: Wheat, color: '#D18E3B' },
    { title: 'جنود', count: me?.troops || 0, Icon: Swords, color: '#438FAB' },
  ];
  const tabs = [
    { value: 'island', title: 'جزيرتي', Icon: Castle },
    { value: 'war', title: 'الحروب', Icon: Swords },
    { value: 'ranking', title: 'الترتيب', Icon: Trophy },
  ] as const;

  return <View style={[styles.screen, { backgroundColor: colors.background }]}>
    <AppHeader variant="sub" fallbackRoute="/more" title="ممالك حيّنا" subtitle="حرب وجزر · هوية مجهولة"
      rightAction={<Pressable oasisKind="plain" accessibilityRole="button" accessibilityLabel="تحديث معلومات اللعبة"
        onPress={() => void reload().catch((e: any) => setError(e?.message || 'خطأ تحديث'))}
        style={[styles.refresh, { backgroundColor: colors.soft }]}><RefreshCw size={18} color={colors.primary}/></Pressable>}/>
    <ScrollView showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.content, { paddingBottom: bottomNavInset + 30 }]}>
      <LinearGradient colors={['#073A44', '#0D655E', '#139677']} style={styles.hero}>
        <View style={styles.heroRow}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>🏝️ جزيرتك السريّة</Text>
            <Text style={styles.heroName}>{me?.alias || 'قائد مجهول'}</Text>
            <Text style={styles.heroSub}>لا تظهر هويتك الحقيقية أو موقعك لأي خصم</Text>
          </View>
          <View style={styles.heroSymbol}><Castle size={35} color="#FFE7BA"/><Text style={styles.heroLevel}>LV {me?.level || 1}</Text></View>
        </View>
        <View style={styles.heroStats}>
          <Text style={styles.heroStat}>🏆 {fmt(me?.trophies || 0)} كأس</Text>
          <Text style={styles.heroStat}>🛡️ دفاع {fmt(me?.fortress || 0)}</Text>
          <Text style={styles.heroStat}>👑 #{fmt(state?.rank || 1)}</Text>
        </View>
      </LinearGradient>

      {error ? <View style={[styles.notice, { backgroundColor: colors.dangerSoft }]}><Text accessibilityRole="alert" style={[styles.noticeText, { color: colors.danger }]}>{error}</Text></View> : null}
      {notice ? <View style={[styles.notice, { backgroundColor: colors.soft }]}><Text style={[styles.noticeText, { color: colors.primary }]}>{notice}</Text></View> : null}
      {battle && <View style={[styles.notice, { backgroundColor: battle.won ? '#E9F9ED' : '#FFF0E9' }]}>
        <Text style={styles.battleResult}>{battle.won ? '🏆 انتصار!' : '🛡️ انتهت المعركة بالخسارة'}</Text>
        <Text style={styles.battleStats}>قوتك {fmt(battle.attack)} · قوة الخصم {fmt(battle.defense)} · فقدت {fmt(battle.lost_troops)} جنود · غنمت {fmt(battle.gold)} ذهب</Text>
      </View>}
      {loading ? <View style={styles.loading}><ActivityIndicator size="large" color={colors.primary}/><Text style={{ color: colors.muted }}>تجهيز الجزيرة...</Text></View>
        : !state?.joined || !me ? <View style={[styles.empty, { borderColor: colors.line, backgroundColor: colors.surface }]}>
          <Castle color={colors.primary} size={25}/>
          <Text style={[styles.subtext, { color: colors.muted }]}>تعذّر إنشاء جزيرتك. تحقق من تسجيل الدخول وتفعيل اللعبة.</Text>
          <Pressable oasisKind="plain" style={[styles.primary, { backgroundColor: colors.primary }]}
            onPress={() => { setError(''); setLoading(true); void reload(true).catch((e: any) => setError(e?.message || 'تعذّر الاتصال')).finally(() => setLoading(false)); }}>
            <Text style={styles.primaryText}>إعادة المحاولة</Text>
          </Pressable>
        </View> : <>
          <View style={styles.resources}>
            {resources.map(({ title, count, Icon, color }) => <View key={title}
              style={[styles.resource, { backgroundColor: colors.surface, borderColor: colors.line }]}>
              <View style={[styles.resourceIcon, { backgroundColor: colors.soft }]}><Icon size={18} color={color}/></View>
              <View style={styles.resourceCopy}><Text style={[styles.resourceLabel, { color: colors.muted }]}>{title}</Text><Text style={[styles.resourceValue, { color: colors.ink }]}>{fmt(count)}</Text></View>
            </View>)}
          </View>
          <View style={[styles.tabs, { borderColor: colors.line, backgroundColor: colors.surface }]}>
            {tabs.map(({ value, title, Icon }) => <Pressable key={value} oasisKind="plain" accessibilityRole="tab"
              accessibilityState={{ selected: section === value }} onPress={() => setSection(value)}
              style={[styles.tab, section === value && { backgroundColor: colors.primary }]}>
              <Icon size={17} color={section === value ? '#FFFFFF' : colors.muted}/>
              <Text style={[styles.tabText, { color: section === value ? '#FFFFFF' : colors.muted }]}>{title}</Text>
            </Pressable>)}
          </View>

          {section === 'island' && <>
            <View style={styles.sectionHeading}><View style={styles.headingCopy}>
              <Text style={[styles.heading, { color: colors.ink }]}>جزيرتك الحيّة</Text>
              <Text style={[styles.subtext, { color: colors.muted }]}>اختر أي مبنى أو مزرعة لتبدأ اللعب</Text>
            </View><Text style={styles.headingEmoji}>🌴</Text></View>
            <LinearGradient colors={['#B4E6E5', '#79BDBE', '#DBEFB9']} style={styles.island}>
              <View style={styles.islandTop}><Text style={styles.islandTiny}>🌤️ أجواء الجزيرة</Text><Text style={styles.islandTiny}>بحر المغامرات</Text></View>
              <View style={styles.board}>
                {TILES.map((part, i) => <Pressable key={i} oasisKind="plain" accessibilityRole="button"
                  accessibilityLabel={part.name + ' · ' + ACTIONS[part.action]}
                  accessibilityState={{ selected: tileIndex === i }} onPress={() => setTileIndex(i)}
                  style={[styles.tileOuter, { width: tileSize, height: tileSize + 5 },
                    tileIndex === i && styles.tileSelected]}>
                  <LinearGradient colors={part.colors} style={styles.tile}>
                    <Text style={styles.tileEmoji}>{part.emoji}</Text>
                    <Text numberOfLines={1} style={styles.tileName}>{part.name}</Text>
                  </LinearGradient>
                </Pressable>)}
              </View>
              <Text style={styles.islandTiny}>🌿 احصد · طوّر · حصّن · حارب</Text>
            </LinearGradient>
            <View style={[styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
              <View style={styles.actionTop}><View style={styles.headingCopy}>
                <Text style={[styles.actionTitle, { color: colors.ink }]}>{tile.name} · {ACTIONS[tile.action]}</Text>
                <Text style={[styles.subtext, { color: colors.muted }]}>{cost}</Text>
              </View><Text style={styles.headingEmoji}>{tile.emoji}</Text></View>
              <Pressable oasisKind="plain" accessibilityRole="button" disabled={busy || (tile.action === 'pirates' && !canAttack)}
                onPress={() => void command(tile.action)}
                style={[styles.primary, { backgroundColor: colors.primary }, (busy || (tile.action === 'pirates' && !canAttack)) && styles.disabled]}>
                {busy ? <ActivityIndicator color="#FFFFFF" size="small"/> : <Castle size={17} color="#FFFFFF"/>}
                <Text style={styles.primaryText}>{ACTIONS[tile.action]}</Text>
              </Pressable>
            </View>
            <View style={styles.quickActions}>
              {([{ action: 'collect', title: 'حصاد', Icon: Wheat }, { action: 'recruit', title: 'تجنيد', Icon: Users },
                { action: 'fortify', title: 'تحصين', Icon: Shield }] as const).map(({ action, title, Icon }) =>
                <Pressable key={action} oasisKind="plain" disabled={busy} accessibilityRole="button" onPress={() => void command(action)}
                  style={[styles.quick, { borderColor: colors.line, backgroundColor: colors.surface }]}>
                  <Icon size={19} color={colors.primary}/><Text style={[styles.quickText, { color: colors.ink }]}>{title}</Text>
                </Pressable>)}
            </View>
            <Text style={[styles.help, { color: colors.muted }]}>الموارد تتجدد بمرور الوقت. نتيجة الحروب والغنائم تُحسم في السيرفر لمنع التلاعب.</Text>
          </>}

          {section === 'war' && <>
            <View style={styles.sectionHeading}><View style={styles.headingCopy}>
              <Text style={[styles.heading, { color: colors.ink }]}>ساحة الحروب</Text>
              <Text style={[styles.subtext, { color: colors.muted }]}>{countdown > 0 ? 'السفن تستعد · ' + Math.ceil(countdown / 60) + ' د' : (me.troops < 8 ? 'تحتاج ٨ جنود على الأقل' : 'أسطولك جاهز للهجوم')}</Text>
            </View><Text style={styles.headingEmoji}>⚔️</Text></View>
            <LinearGradient colors={['#093D4C', '#12667C']} style={styles.pirateCard}>
              <View style={styles.headingCopy}><Text style={styles.pirateTitle}>🏴‍☠️ قراصنة الضباب</Text>
                <Text style={styles.pirateSub}>حارب أسطول اللعبة واغنم الموارد، حتى لو كنت أول لاعب ينضم!</Text></View>
              <Pressable oasisKind="plain" accessibilityRole="button" disabled={busy || !canAttack}
                onPress={() => void command('pirates')} style={[styles.pirateButton, (busy || !canAttack) && styles.disabled]}>
                <Ship size={18} color="#064E48"/><Text style={styles.pirateButtonText}>ابدأ المعركة</Text>
              </Pressable>
            </LinearGradient>
            <Text style={[styles.heading, { color: colors.ink }]}>🏰 جزر المنافسين المجهولين</Text>
            {!state.targets.length ? <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.line }]}>
              <Shield size={27} color={colors.primary}/><Text style={[styles.subtext, { color: colors.muted }]}>ما فيه خصوم متاحين حاليًا. تقدر تقاتل القراصنة أو تعود بعد انضمام لاعبين آخرين.</Text>
            </View> : state.targets.map(target => <View key={target.id} style={[styles.opponent, { backgroundColor: colors.surface, borderColor: colors.line }]}>
              <View style={[styles.opponentIcon, { backgroundColor: colors.soft }]}><Castle size={23} color={colors.primary}/></View>
              <View style={styles.headingCopy}><Text style={[styles.rowTitle, { color: colors.ink }]}>{target.alias}</Text>
                <Text style={[styles.subtext, { color: colors.muted }]}>مستوى {fmt(target.level)} · {fmt(target.trophies)} كأس · دفاع {fmt(target.fortress)}</Text></View>
              <Pressable oasisKind="plain" accessibilityRole="button" accessibilityLabel={'الهجوم على ' + target.alias}
                disabled={busy || !canAttack} onPress={() => setRival(target)}
                style={[styles.attack, { backgroundColor: colors.primary }, (busy || !canAttack) && styles.disabled]}>
                <Swords size={16} color="#FFFFFF"/><Text style={styles.attackText}>غزو</Text>
              </Pressable>
            </View>)}
            <Text style={[styles.help, { color: colors.muted }]}>لا تظهر أسماء حسابات حيّنا ولا المدن أو الأحياء في المعارك. يحصل الخصم على حماية بعد الهجوم.</Text>
            <Text style={[styles.heading, { color: colors.ink }]}>📜 سجل المواجهات</Text>
            {!state.history.length ? <Text style={[styles.subtext, { color: colors.muted }]}>ما خضت معارك حتى الآن.</Text>
              : state.history.map(h => <View key={h.id} style={[styles.history, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                <Text style={styles.headingEmoji}>{h.victory ? '🏆' : '🛡️'}</Text>
                <View style={styles.headingCopy}><Text style={[styles.rowTitle, { color: colors.ink }]}>{h.victory ? 'فوز' : 'خسارة'} · {h.opponent}</Text>
                  <Text style={[styles.subtext, { color: colors.muted }]}>{h.attacked ? 'أنت المهاجم' : 'دافعت عن الجزيرة'}</Text></View>
              </View>)}
          </>}

          {section === 'ranking' && <>
            <View style={styles.sectionHeading}><View style={styles.headingCopy}>
              <Text style={[styles.heading, { color: colors.ink }]}>أبطال المملكة</Text>
              <Text style={[styles.subtext, { color: colors.muted }]}>ترتيب اللاعبين بالألقاب المستعارة فقط</Text>
            </View><Trophy size={28} color="#CF9C3B"/></View>
            <View style={[styles.myRank, { backgroundColor: colors.soft }]}><Crown size={22} color="#C99732"/>
              <Text style={[styles.rowTitle, { color: colors.ink }]}>ترتيبك الحالي: #{fmt(state.rank)}</Text></View>
            {state.leaders.map((person, index) => <View key={person.alias}
              style={[styles.leader, { backgroundColor: person.alias === me.alias ? colors.soft : colors.surface, borderColor: colors.line }]}>
              <View style={[styles.rankNumber, { backgroundColor: index < 3 ? '#FFF2D2' : colors.soft }]}><Text style={styles.rankText}>{fmt(index + 1)}</Text></View>
              <View style={styles.headingCopy}><Text style={[styles.rowTitle, { color: colors.ink }]}>{person.alias === me.alias ? person.alias + ' · أنت' : person.alias}</Text>
                <Text style={[styles.subtext, { color: colors.muted }]}>قلعة {fmt(person.level)} · {fmt(person.wins)} انتصار</Text></View>
              <Trophy size={16} color="#C99732"/><Text style={[styles.rowTitle, { color: colors.ink }]}>{fmt(person.trophies)}</Text>
            </View>)}
          </>}
        </>}
    </ScrollView>
    <Modal visible={Boolean(rival)} transparent animationType="fade" onRequestClose={() => setRival(null)}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
          <Pressable oasisKind="plain" accessibilityRole="button" accessibilityLabel="إلغاء الغزو" onPress={() => setRival(null)}
            style={styles.close}><X size={20} color={colors.muted}/></Pressable>
          <Text style={{ fontSize: 43 }}>⚔️</Text>
          <Text style={[styles.heading, { color: colors.ink }]}>هل أنت مستعد للغزو؟</Text>
          <Text style={[styles.subtext, { color: colors.muted, textAlign: 'center' }]}>ستهاجم {rival?.alias}، وقد تخسر جنودًا حتى لو فزت. الخصم لا يعرف حسابك الحقيقي.</Text>
          <View style={styles.modalButtons}>
            <Pressable oasisKind="plain" accessibilityRole="button" onPress={() => setRival(null)}
              style={[styles.modalCancel, { backgroundColor: colors.soft }]}><Text style={[styles.rowTitle, { color: colors.primary }]}>إلغاء</Text></Pressable>
            <Pressable oasisKind="plain" accessibilityRole="button" disabled={busy}
              onPress={() => { if (rival?.id) void command('attack', rival.id); }}
              style={[styles.modalConfirm, { backgroundColor: colors.primary }]}><Swords size={18} color="#FFFFFF"/><Text style={styles.primaryText}>هجوم</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { maxWidth: 590, width: '100%', paddingHorizontal: 13, paddingTop: 12, alignSelf: 'center', gap: 12 },
  refresh: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  hero: { borderRadius: 19, padding: 16, overflow: 'hidden', gap: 14 },
  heroRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 11 },
  heroCopy: { flex: 1, alignItems: 'flex-end', gap: 5 },
  heroEyebrow: { color: '#A7F3CF', fontSize: 11, fontWeight: '700' },
  heroName: { color: '#FFFFFF', fontSize: 23, fontWeight: '900', textAlign: 'right' },
  heroSub: { color: '#CDEEE4', fontSize: 10.5, textAlign: 'right', lineHeight: 17 },
  heroSymbol: { width: 86, height: 84, borderRadius: 17, backgroundColor: 'rgba(0,38,34,.4)', alignItems: 'center', justifyContent: 'center', gap: 5 },
  heroLevel: { color: '#FFE5A7', fontSize: 11, fontWeight: '900' },
  heroStats: { flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 6 },
  heroStat: { fontSize: 10.5, fontWeight: '700', color: '#FFFFFF', backgroundColor: 'rgba(0,38,34,.28)', paddingVertical: 8, paddingHorizontal: 8, borderRadius: 10 },
  resources: { flexDirection: 'row-reverse', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  resource: { width: '48.8%', borderWidth: 1, borderRadius: 13, minHeight: 62, padding: 9, flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  resourceIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  resourceCopy: { flex: 1, alignItems: 'flex-end', gap: 3 },
  resourceLabel: { fontSize: 10.5 },
  resourceValue: { fontSize: 17, fontWeight: '800' },
  tabs: { flexDirection: 'row-reverse', borderWidth: 1, borderRadius: 14, gap: 4, padding: 4 },
  tab: { minHeight: 42, flex: 1, borderRadius: 11, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 5 },
  tabText: { fontSize: 11.5, fontWeight: '800' },
  sectionHeading: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9, marginTop: 5 },
  headingCopy: { flex: 1, alignItems: 'flex-end', gap: 4, minWidth: 0 },
  heading: { fontSize: 15.5, textAlign: 'right', fontWeight: '800' },
  subtext: { fontSize: 11.5, lineHeight: 18, textAlign: 'right' },
  headingEmoji: { fontSize: 24 },
  island: { alignItems: 'center', borderRadius: 18, borderWidth: 1, borderColor: '#B0D9B8', padding: 9, gap: 8 },
  islandTop: { width: '100%', flexDirection: 'row-reverse', justifyContent: 'space-between' },
  islandTiny: { color: '#1B605A', fontSize: 10, fontWeight: '800' },
  board: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-around', gap: 5, borderWidth: 8, borderRadius: 17, borderColor: '#A27A53', backgroundColor: '#A17A52', padding: 5 },
  tileOuter: { borderWidth: 2, borderColor: '#A47A50', overflow: 'hidden', borderRadius: 11 },
  tileSelected: { borderColor: '#FFF6BC', borderWidth: 3 },
  tile: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 3 },
  tileEmoji: { fontSize: 27, textAlign: 'center' },
  tileName: { fontSize: 9.5, color: '#31553A', fontWeight: '900', textAlign: 'center' },
  actionCard: { borderWidth: 1, borderRadius: 15, padding: 12, gap: 10 },
  actionTop: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  actionTitle: { fontSize: 13.5, fontWeight: '800' },
  primary: { minHeight: 43, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 12 },
  primaryText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '800' },
  disabled: { opacity: .46 },
  quickActions: { flexDirection: 'row-reverse', gap: 8 },
  quick: { flex: 1, borderWidth: 1, borderRadius: 13, minHeight: 55, alignItems: 'center', justifyContent: 'center', gap: 5 },
  quickText: { fontSize: 11.5, fontWeight: '800' },
  help: { fontSize: 11, lineHeight: 18, textAlign: 'right', paddingHorizontal: 5 },
  pirateCard: { borderRadius: 17, padding: 15, gap: 14 },
  pirateTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  pirateSub: { color: '#D6F3F3', fontSize: 11.5, lineHeight: 19, textAlign: 'right' },
  pirateButton: { minHeight: 43, flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center', gap: 9, backgroundColor: '#E0F8E1', borderRadius: 12 },
  pirateButtonText: { fontWeight: '800', color: '#064E48', fontSize: 12.5 },
  opponent: { minHeight: 68, borderWidth: 1, borderRadius: 13, padding: 10, flexDirection: 'row-reverse', alignItems: 'center', gap: 9 },
  opponentIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 12.5, fontWeight: '800', textAlign: 'right' },
  attack: { minHeight: 37, minWidth: 67, borderRadius: 10, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 5 },
  attackText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '800' },
  history: { minHeight: 58, borderWidth: 1, borderRadius: 12, paddingHorizontal: 11, flexDirection: 'row-reverse', alignItems: 'center', gap: 9 },
  myRank: { minHeight: 58, borderRadius: 14, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 10 },
  leader: { minHeight: 60, borderWidth: 1, borderRadius: 13, paddingHorizontal: 11, flexDirection: 'row-reverse', alignItems: 'center', gap: 9 },
  rankNumber: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rankText: { color: '#8B5921', fontWeight: '900', fontSize: 12 },
  notice: { padding: 12, borderRadius: 13, alignItems: 'center', gap: 5 },
  noticeText: { fontSize: 12, lineHeight: 19, textAlign: 'center', fontWeight: '700' },
  battleResult: { color: '#194D41', fontSize: 14, fontWeight: '900' },
  battleStats: { color: '#51635F', fontSize: 10.5, lineHeight: 17, textAlign: 'center' },
  loading: { minHeight: 200, alignItems: 'center', justifyContent: 'center', gap: 12 },
  empty: { borderWidth: 1, borderRadius: 15, padding: 20, alignItems: 'center', gap: 11 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,24,24,.65)', justifyContent: 'center', paddingHorizontal: 22 },
  modalCard: { padding: 20, alignItems: 'center', borderRadius: 20, gap: 12 },
  close: { position: 'absolute', left: 12, top: 12, width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  modalButtons: { flexDirection: 'row-reverse', gap: 9, width: '100%', marginTop: 6 },
  modalCancel: { flex: 1, minHeight: 43, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  modalConfirm: { flex: 1, minHeight: 43, justifyContent: 'center', alignItems: 'center', flexDirection: 'row-reverse', gap: 7, borderRadius: 12 },
});
