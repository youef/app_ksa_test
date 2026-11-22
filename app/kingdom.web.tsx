import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import KingdomWorld3D, { AVATARS, SITES, WORLD_HALF, type AvatarKey, type GameSite, type WorldPosition } from '@/components/game/KingdomWorld3D.web';
import AvatarPreview3D from '@/components/game/AvatarPreview3D.web';

type GameAction = 'collect' | 'recruit' | 'fortify' | 'upgrade' | 'pirates' | 'attack';
type Captain = { id: string; alias: string; avatar_key?: AvatarKey; gold: number; timber: number; food: number; troops: number; fortress: number; level: number; trophies: number; wins: number; last_attack_at: string | null };
type Target = { id: string; alias: string; level: number; trophies: number; fortress: number };
type Leader = { alias: string; level: number; trophies: number; wins: number };
type Log = { id: string; opponent: string; victory: boolean; gold: number; attacked: boolean; when: string };
type GameState = { joined: boolean; me: Captain; rank: number; targets: Target[]; leaders: Leader[]; history: Log[] };
type Battle = { won: boolean; attack: number; defense: number; lost_troops: number; gold: number; timber: number };
type Panel = 'none' | 'map' | 'wars' | 'ranks' | 'help';
const num = (n: number) => Number(n || 0).toLocaleString('ar-SA');
const safe = 'env(safe-area-inset-top, 0px)';
const glass = 'linear-gradient(150deg, rgba(5,46,43,.91), rgba(8,64,56,.88))';
const primary: CSSProperties = { border: '1px solid rgba(196,255,226,.35)', background: '#087D63', color: '#FFFFFF', borderRadius: 13, padding: '11px 14px', fontWeight: 800, fontSize: 13, cursor: 'pointer', minHeight: 42 };
const smallButton: CSSProperties = { background: 'rgba(255,255,255,.13)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,.24)', borderRadius: 12, padding: '9px 11px', fontWeight: 800, fontSize: 12, cursor: 'pointer', minHeight: 39 };
const muted: CSSProperties = { color: '#BED6CD', fontSize: 11.5, lineHeight: 1.7 };
const panelCard: CSSProperties = { background: 'rgba(255,255,255,.09)', borderRadius: 12, padding: 10, border: '1px solid rgba(255,255,255,.10)' };
const actionNames: Record<GameAction, string> = {
  collect: 'احصد الموارد', recruit: 'جنّد ٨ محاربين', fortify: 'حصّن قلعتك', upgrade: 'طوّر القلعة',
  pirates: 'هاجم القراصنة', attack: 'غزو الجزيرة',
};
const quickSites: Record<GameSite, string> = {
  castle: 'ترقية القلعة', forest: 'حصاد الخشب', farm: 'حصاد المؤونة', barracks: 'تجنيد الجيش',
  harbor: 'أسطول القراصنة', mine: 'حصاد الذهب', arena: 'حصّن دفاعاتك', village: 'حصاد موارد القرية',
};
const gamePos = (x: number, z: number) => ({ x: 160 + x / WORLD_HALF * 145, y: 160 + z / WORLD_HALF * 145 });

export default function Kingdom3D() {
  const [accountId, setAccountId] = useState('');
  const [state, setState] = useState<GameState | null>(null);
  const [avatar, setAvatar] = useState<AvatarKey>('knight');
  const [spawn, setSpawn] = useState({ x: 0, z: 6 });
  const [position, setPosition] = useState<WorldPosition>({ x: 0, z: 6, site: null, siteName: 'ساحة المملكة', distance: 999 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [previewKey, setPreviewKey] = useState<AvatarKey>('knight');
  const [panel, setPanel] = useState<Panel>('none');
  const [target, setTarget] = useState<Target | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [battle, setBattle] = useState<Battle | null>(null);
  const [tick, setTick] = useState(Date.now());
  const [waypoint, setWaypoint] = useState<GameSite | null>(null);
  const me = state?.me;
  const paused = avatarOpen || panel !== 'none' || Boolean(target);
  const canAttack = (me?.troops || 0) >= 8 && (!me?.last_attack_at || Date.now() - new Date(me.last_attack_at).getTime() >= 120000);
  const cooldown = me?.last_attack_at ? Math.max(0, Math.ceil((120000 - (tick - new Date(me.last_attack_at).getTime())) / 1000)) : 0;

  const reload = useCallback(async (join = false) => {
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!auth.user) { router.replace('/auth'); return; }
    setAccountId(auth.user.id);
    const { data, error: rpcError } = await supabase.rpc(join ? 'hayna_game_join' : 'hayna_game_state');
    if (rpcError) throw rpcError;
    const payload = data as GameState;
    if (!payload?.joined || !payload?.me) throw Error('تعذّر إنشاء الجزيرة الخاصة بك');
    setState(payload);
    setAvatar(payload.me.avatar_key || 'knight');
    setPreviewKey(payload.me.avatar_key || 'knight');
    return auth.user.id;
  }, []);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const userId = await reload(true);
        if (mounted && userId) {
          try {
            const coords = JSON.parse(localStorage.getItem('hayna-kingdom-position-' + userId) || 'null');
            if (typeof coords?.x === 'number' && typeof coords?.z === 'number'
              && Math.abs(coords.x) < WORLD_HALF && Math.abs(coords.z) < WORLD_HALF) {
              setSpawn({ x: coords.x, z: coords.z });
            }
            if (!localStorage.getItem('hayna-kingdom-avatar-intro-' + userId)) setAvatarOpen(true);
          } catch { /* Private mode: game still works without local storage. */ }
        }
      } catch (e: any) {
        if (mounted) setError(e?.message || 'تعذّر تشغيل العالم');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    const interval = setInterval(() => setTick(Date.now()), 1000);
    return () => { mounted = false; clearInterval(interval); };
  }, [reload]);

  const remember = useCallback((x: number, z: number) => {
    if (!accountId) return;
    try { localStorage.setItem('hayna-kingdom-position-' + accountId, JSON.stringify({ x, z })); }
    catch { /* Storage is optional. */ }
  }, [accountId]);

  const chooseAvatar = useCallback(async (key: AvatarKey) => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const { error: rpcError } = await supabase.rpc('hayna_game_set_avatar', { p_avatar_key: key });
      if (rpcError) throw rpcError;
      setSpawn({ x: position.x, z: position.z });
      setAvatar(key);
      setState(current => current ? { ...current, me: { ...current.me, avatar_key: key } } : current);
      setAvatarOpen(false);
      if (accountId) {
        try { localStorage.setItem('hayna-kingdom-avatar-intro-' + accountId, '1'); } catch { /* optional */ }
      }
      setMessage('تم حفظ شخصيتك الجديدة');
    } catch (e: any) { setError(e?.message || 'تعذر حفظ الشخصية'); }
    finally { setBusy(false); }
  }, [busy, position.x, position.z, accountId]);

  const command = useCallback(async (action: GameAction, targetId?: string) => {
    if (busy) return;
    setBusy(true); setMessage(''); setError(''); setBattle(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('hayna_game_command', { p_action: action, p_target_id: targetId || null });
      if (rpcError) throw rpcError;
      const result = data as { message?: string; battle?: Battle };
      setMessage(result?.message || 'تمت العملية بنجاح');
      setBattle(result?.battle || null);
      setTarget(null);
      await reload();
    } catch (e: any) { setError(e?.message || 'تعذّر تنفيذ العملية'); }
    finally { setBusy(false); }
  }, [busy, reload]);

  const site = position.site ? SITES.find(s => s.key === position.site) : null;
  const waypointTarget = waypoint ? SITES.find(s => s.key === waypoint) : null;
  const waypointDistance = waypointTarget ? Math.round(Math.hypot(waypointTarget.x - position.x, waypointTarget.z - position.z)) : null;
  const playerDot = gamePos(position.x, position.z);
  const avatarProfile = AVATARS.find(a => a.key === avatar) || AVATARS[0];

  return <main dir="rtl" style={{ position: 'fixed', inset: 0, overflow: 'hidden', width: '100%', height: '100dvh', color: '#FFFFFF',
    background: '#174D51', fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif', touchAction: 'none' }}>
    {!loading && me && <KingdomWorld3D avatarKey={avatar} initialX={spawn.x} initialZ={spawn.z}
      paused={paused} onPosition={setPosition} onRemember={remember} onError={setError}/>}
    {loading && <div style={{ display: 'grid', placeContent: 'center', height: '100%', gap: 16, textAlign: 'center' }}>
      <div style={{ fontSize: 60 }}>🏰</div><b>جارٍ تحميل عالم ممالك حيّنا...</b>
      <p style={muted}>نبني قلعتك ونجهز شخصيتك</p>
    </div>}

    <header style={{ position: 'absolute', top: 0, right: 0, left: 0, padding: 'calc(' + safe + ' + 8px) 11px 9px',
      background: 'linear-gradient(180deg,rgba(2,27,34,.92),rgba(3,38,35,.75) 85%,transparent)',
      display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, pointerEvents: 'auto' }}>
        <button type="button" style={smallButton} aria-label="العودة إلى تطبيق حيّنا" onClick={() => router.push('/more')}>❯</button>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
          <strong style={{ display: 'block', fontSize: 17 }}>🏰 ممالك حيّنا <span style={{ fontSize: 10, color: '#98E8CB' }}>3D</span></strong>
          <span style={{ color: '#D2EFE1', fontSize: 10, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{me?.alias || 'عالمك المفتوح'} · المستوى {num(me?.level || 1)} · المركز #{num(state?.rank || 1)} · {num(me?.wins || 0)} انتصار</span>
        </div>
        <button type="button" onClick={() => { setPreviewKey(avatar); setAvatarOpen(true); }} style={{ ...smallButton, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 9px' }}>
          <span style={{ fontSize: 22 }}>{avatarProfile.emoji}</span><span style={{ fontSize: 11 }}>شخصيتي</span>
        </button>
        <button type="button" aria-label="فتح مساعدة التحكم" onClick={() => setPanel(panel === 'help' ? 'none' : 'help')} style={smallButton}>؟</button>
      </div>
      {me && <div style={{ display: 'flex', gap: 5, justifyContent: 'space-between', pointerEvents: 'auto' }}>
        {[
          { icon: '🪙', value: me.gold },
          { icon: '🌳', value: me.timber },
          { icon: '🌾', value: me.food },
          { icon: '⚔️', value: me.troops },
          { icon: '🏆', value: me.trophies },
        ].map((resource, i) => <div key={i} style={{ minWidth: 0, flex: 1, borderRadius: 10, padding: '6px 4px', background: 'rgba(2,28,32,.67)',
          border: '1px solid rgba(255,255,255,.1)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 800 }}>
          <span>{resource.icon}</span><span>{num(resource.value)}</span>
        </div>)}
      </div>}
    </header>

    {!loading && me && <nav aria-label="أدوات المملكة" style={{ position: 'absolute', top: 'calc(' + safe + ' + 107px)', right: 10, display: 'flex', flexDirection: 'column', gap: 6, width: 112, padding: 7, borderRadius: 17, background: 'rgba(3,39,39,.78)', border: '1px solid rgba(255,255,255,.18)', boxShadow: '0 10px 28px rgba(0,20,22,.28)', backdropFilter: 'blur(14px)' }}>
      {([
        ['map', '🗺️', 'الخريطة'], ['wars', '⚔️', 'الحروب'], ['ranks', '🏆', 'المتصدرون'], ['help', '❔', 'المساعدة'],
      ] as const).map(([key, symbol, name]) => <button type="button" key={key} onClick={() => setPanel(panel === key ? 'none' : key)}
        aria-label={name} aria-pressed={panel === key} title={name}
        style={{ ...smallButton, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 8, width: '100%', minHeight: 39, padding: '8px 10px', fontSize: 12, background: panel === key ? '#087D63' : 'rgba(255,255,255,.08)', borderColor: panel === key ? 'rgba(196,255,226,.55)' : 'rgba(255,255,255,.12)' }}>
        <span style={{ fontSize: 17 }}>{symbol}</span><span>{name}</span>
      </button>)}
      <button type="button" aria-label="تحديث بيانات المملكة" title="تحديث بيانات المملكة" style={{ ...smallButton, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 8, width: '100%', minHeight: 39, padding: '8px 10px', fontSize: 12 }}
        onClick={() => void reload().catch((e: any) => setError(e?.message || 'تعذّر التحديث'))}><span style={{ fontSize: 17 }}>⟳</span><span>تحديث</span></button>
    </nav>}

    {!loading && me && <div style={{ position: 'absolute', top: 'calc(' + safe + ' + 112px)', left: 11, borderRadius: 12,
      background: 'rgba(4,41,40,.77)', border: '1px solid rgba(255,255,255,.17)', padding: '9px 11px',
      backdropFilter: 'blur(9px)', maxWidth: '45%', textAlign: 'right' }}>
      <div style={{ fontSize: 12, fontWeight: 900 }}>📍 {site?.name || 'أرض المملكة'}</div>
      <div style={{ fontSize: 10, color: '#C0DCD2', marginTop: 4 }}>
        {waypointTarget ? '🎯 ' + waypointTarget.name + ' · ' + num(waypointDistance || 0) + ' متر' : 'اسحب الشاشة لتغيير الكاميرا'}
      </div>
    </div>}

    {!loading && me && site && !paused && <aside style={{ position: 'absolute', bottom: 173, right: 13, left: 147, maxWidth: 370,
      borderRadius: 17, background: glass, border: '1px solid rgba(255,255,255,.25)', padding: 12,
      boxShadow: '0 9px 25px rgba(1,26,29,.35)', backdropFilter: 'blur(12px)' }}>
      <div style={{ color: '#E1FFEA', fontSize: 12, fontWeight: 900 }}>{site.emoji} {site.name}</div>
      <p style={{ ...muted, margin: '4px 0 9px' }}>{quickSites[site.key]}</p>
      <button type="button" disabled={busy || (site.action === 'pirates' && !canAttack)} onClick={() => void command(site.action)}
        style={{ ...primary, minHeight: 40, width: '100%', opacity: (busy || (site.action === 'pirates' && !canAttack)) ? .55 : 1 }}>
        {busy ? 'جارٍ التنفيذ…' : actionNames[site.action]}
      </button>
    </aside>}

    {!loading && me && <div style={{ position: 'absolute', bottom: 'max(5px, env(safe-area-inset-bottom))', left: '50%', transform: 'translateX(-50%)',
      padding: '6px 13px', borderRadius: 22, fontSize: 10.5, background: 'rgba(4,44,41,.68)', color: '#E8FFF2',
      pointerEvents: 'none', whiteSpace: 'nowrap' }}>🎮 حرّك العصا · اسحب الكاميرا · اركض واقفز</div>}

    {(error || message || battle) && <div role={error ? 'alert' : 'status'} style={{ position: 'absolute', left: 13, right: 13, top: 'calc(' + safe + ' + 172px)',
      maxWidth: 440, margin: '0 auto', background: error ? 'rgba(135,36,37,.94)' : 'rgba(5,67,51,.94)',
      border: '1px solid rgba(255,255,255,.25)', borderRadius: 13, padding: '11px 14px', textAlign: 'center',
      fontSize: 12, lineHeight: 1.75, boxShadow: '0 5px 18px #04292044' }}>
      {error || message}{battle && <div style={{ marginTop: 4 }}>{battle.won ? '🏆 فوز' : '🛡️ خسارة'} · خسرت {num(battle.lost_troops)} جنود · غنمت {num(battle.gold)} ذهب</div>}
      <button type="button" aria-label="إغلاق الرسالة" onClick={() => { setError(''); setMessage(''); setBattle(null); }} style={{ color: '#FFFFFF', border: 0, background: 'transparent', position: 'absolute', top: 0, left: 2, fontSize: 20 }}>×</button>
    </div>}

    {panel !== 'none' && <div style={{ position: 'absolute', top: 'calc(' + safe + ' + 153px)', bottom: 153, right: 66, width: 'min(352px, calc(100vw - 84px))',
      background: glass, boxShadow: '0 18px 36px rgba(0,20,22,.42)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 18,
      backdropFilter: 'blur(18px)', padding: 14, overflowY: 'auto', overscrollBehavior: 'contain', touchAction: 'pan-y' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <strong style={{ fontSize: 16 }}>{panel === 'map' ? '🗺️ خريطة العالم' : panel === 'wars' ? '⚔️ ساحة المعارك' : panel === 'ranks' ? '🏆 المتصدرون' : '🎮 طريقة اللعب'}</strong>
        <button type="button" aria-label="إغلاق اللوحة" onClick={() => setPanel('none')} style={smallButton}>✕</button>
      </div>
      {panel === 'map' && <>
        <p style={muted}>العالم واسع. اختر وجهة ثم تحرك نحوها باستخدام عصا التحكم.</p>
        <svg viewBox="0 0 320 320" role="img" aria-label="خريطة العالم فيها القلعة والقرية والغابة والميناء وموقع شخصيتك"
          style={{ width: '100%', borderRadius: 15, background: '#AED4A7', border: '5px solid #D3BC7F' }}>
          <rect width="320" height="320" fill="#8EBE8A" rx="14" />
          <rect x="8" y="8" width="304" height="304" rx="14" fill="none" stroke="#3D93AB" strokeWidth="15"/>
          {SITES.map(s => {
            const p = gamePos(s.x,s.z);
            return <line key={'road'+s.key} x1="160" y1="160" x2={p.x} y2={p.y} stroke="#E3CF9C" strokeWidth="5"/>;
          })}
          {SITES.map(s => {
            const p = gamePos(s.x,s.z);
            return <g key={s.key} onClick={() => { setWaypoint(s.key); setPanel('none'); }} style={{ cursor: 'pointer' }}>
              <circle cx={p.x} cy={p.y} r="11" fill="#0E685D" stroke="#FFFFFF" strokeWidth="2"/>
              <text x={p.x} y={p.y+5} fontSize="15" textAnchor="middle">{s.emoji}</text>
            </g>;
          })}
          <circle cx={playerDot.x} cy={playerDot.y} r="7" fill="#EF4F4B" stroke="#FFFFFF" strokeWidth="3"/>
        </svg>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 9 }}>
          {SITES.map(s => <button key={s.key} type="button" onClick={() => { setWaypoint(s.key); setPanel('none'); }} style={{ ...smallButton, textAlign: 'right', fontSize: 11 }}>{s.emoji} {s.name}</button>)}
        </div>
      </>}
      {panel === 'wars' && <>
        <div style={panelCard}>
          <strong>🏴‍☠️ قراصنة الضباب</strong>
          <p style={muted}>ابدأ معركة حتى لو لم ينضم لاعبين آخرون. تحتاج ٨ جنود.</p>
          <button type="button" disabled={busy || !canAttack} onClick={() => void command('pirates')}
            style={{ ...primary, width: '100%', opacity: canAttack ? 1 : .5 }}>{busy ? 'جارٍ القتال…' : 'ابدأ المعركة'}</button>
          {cooldown > 0 && <p style={muted}>موعد الهجوم القادم بعد {num(cooldown)} ثانية</p>}
        </div>
        <p style={{ ...muted, marginTop: 13 }}>جزر حقيقية بأسماء مستعارة؛ لا تظهر هوية المستخدم أو موقعه.</p>
        {state?.targets.length ? state.targets.map(r => <div key={r.id} style={{ ...panelCard, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1 }}><strong style={{ fontSize: 12 }}>{r.alias}</strong><div style={muted}>قلعة {num(r.level)} · {num(r.trophies)} كأس</div></div>
          <button type="button" disabled={busy || !canAttack} onClick={() => setTarget(r)}
            style={{ ...smallButton, background: '#087D63', opacity: canAttack ? 1 : .5 }}>غزو</button>
        </div>) : <p style={muted}>ما فيه جزر متاحة الآن. حارب القراصنة وطور جيشك.</p>}
        <h4 style={{ marginBottom: 8 }}>📜 آخر المعارك</h4>
        {state?.history.map(log => <div key={log.id} style={{ ...panelCard, fontSize: 11, marginBottom: 6 }}>
          {log.victory ? '🏆 فوز' : '🛡️ خسارة'} · {log.opponent} · {num(log.gold)} ذهب
        </div>)}
      </>}
      {panel === 'ranks' && <>
        <p style={muted}>ترتيبك #{num(state?.rank || 1)} · ترتيب الكؤوس لأسماء الشخصيات المجهولة.</p>
        {state?.leaders.map((leader, i) => <div key={leader.alias} style={{ ...panelCard, marginBottom: 7,
          display: 'flex', alignItems: 'center', gap: 9, background: leader.alias === me?.alias ? 'rgba(17,130,100,.45)' : 'rgba(255,255,255,.08)' }}>
          <span style={{ fontSize: 15, minWidth: 25 }}>{i < 3 ? ['🥇','🥈','🥉'][i] : num(i+1)}</span>
          <div style={{ flex: 1 }}><strong style={{ fontSize: 12 }}>{leader.alias}</strong><div style={muted}>{num(leader.wins)} انتصار · قلعة {num(leader.level)}</div></div>
          <strong>🏆 {num(leader.trophies)}</strong>
        </div>)}
      </>}
      {panel === 'help' && <>
        <div style={{ ...panelCard, lineHeight: 2, fontSize: 12 }}>
          <p>🎮 <b>الجوال:</b> حرّك العصا اليسرى للمشي، واسحب في العالم لتدوير الكاميرا. زر الركض للتسريع وزر القفز للقفز.</p>
          <p>⌨️ <b>الكمبيوتر:</b> استخدم WASD أو الأسهم للحركة، Shift للركض وSpace للقفز، واسحب الماوس لتدوير الكاميرا.</p>
          <p>🏰 <b>المواقع:</b> اقترب من القلعة أو المزرعة أو الغابة أو الميناء، ثم اضغط زر التفاعل الذي يظهر.</p>
          <p>👤 <b>شخصيتك:</b> اختر من ست شخصيات أصلية، وسيُحفظ اختيارك في حساب اللعبة.</p>
          <p>⚔️ <b>الحروب:</b> اللعب ضد القراصنة أو غزو جزر حقيقية، بدون إظهار الهوية الشخصية.</p>
        </div>
      </>}
    </div>}

    {avatarOpen && <div role="dialog" aria-modal="true" aria-label="اختيار الشخصية"
      style={{ position: 'absolute', inset: 0, background: 'rgba(1,21,24,.83)', display: 'grid', placeItems: 'center',
        padding: 15, paddingTop: 'calc(' + safe + ' + 10px)', zIndex: 10, backdropFilter: 'blur(9px)' }}>
      <section style={{ background: 'linear-gradient(150deg,#0D3F3F,#0C584F)', width: 'min(460px,100%)', maxHeight: '85dvh', overflow: 'auto', touchAction: 'pan-y',
        borderRadius: 23, padding: 18, border: '1px solid #6DAA93', boxShadow: '0 20px 70px rgba(0,12,18,.55)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div><strong style={{ fontSize: 20 }}>اختر بطلك</strong><div style={muted}>٦ شخصيات أصلية بأساليب وأزياء مختلفة</div></div>
          <button type="button" onClick={() => setAvatarOpen(false)} aria-label="إغلاق اختيار الشخصية" style={smallButton}>✕</button>
        </div>
        <div style={{ marginTop: 13 }}>
          <AvatarPreview3D avatarKey={previewKey}/>
          <div style={{ fontSize: 12, color: '#D6F7E9', textAlign: 'center', marginTop: 7 }}>
            معاينة متحركة · {AVATARS.find(a => a.key === previewKey)?.name}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 9, marginTop: 13 }}>
          {AVATARS.map(person => <button type="button" key={person.key} disabled={busy} aria-label={'معاينة شخصية ' + person.name}
            onClick={() => setPreviewKey(person.key)}
            style={{ textAlign: 'center', minHeight: 144, padding: 12, color: '#FFFFFF', borderRadius: 16, cursor: 'pointer',
              border: previewKey === person.key ? '2px solid #FFE39D' : '1px solid rgba(255,255,255,.3)',
              background: 'linear-gradient(150deg,' + person.color + ',#123C40)', display: 'grid', placeItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 39, lineHeight: 1.2 }}>{person.emoji}</span>
            <b style={{ fontSize: 15 }}>{person.name} {previewKey === person.key ? '✓' : ''}</b>
            <span style={{ fontSize: 10.5, opacity: .9 }}>{person.title}</span>
          </button>)}
        </div>
        <button type="button" disabled={busy} onClick={() => void chooseAvatar(previewKey)}
          style={{ ...primary, width: '100%', marginTop: 13, minHeight: 47, fontSize: 14, opacity: busy ? .65 : 1 }}>
          {busy ? 'جارٍ حفظ شخصيتك…' : 'اعتماد شخصية ' + (AVATARS.find(a => a.key === previewKey)?.name || '')}
        </button>
        <p style={{ ...muted, marginBottom: 0, textAlign: 'center' }}>شاهد الشخصية ثلاثية الأبعاد قبل اعتمادها. تقدر تغيرها في أي وقت.</p>
      </section>
    </div>}

    {target && <div role="dialog" aria-modal="true" aria-label="تأكيد غزو الجزيرة"
      style={{ position: 'absolute', inset: 0, zIndex: 11, background: 'rgba(0,19,22,.79)', display: 'grid', placeItems: 'center', padding: 18 }}>
      <section style={{ background: '#0B514B', padding: 23, borderRadius: 19, textAlign: 'center', maxWidth: 370, border: '1px solid #7BB89E' }}>
        <div style={{ fontSize: 40 }}>⚔️</div><h2 style={{ fontSize: 19 }}>تأكيد الهجوم</h2>
        <p style={muted}>ستغزو {target.alias}. قد تخسر جنودًا حتى عند الفوز. الهوية الحقيقية للطرفين مخفية.</p>
        <div style={{ display: 'flex', gap: 9 }}>
          <button type="button" style={{ ...smallButton, flex: 1 }} onClick={() => setTarget(null)}>إلغاء</button>
          <button type="button" style={{ ...primary, flex: 1 }} disabled={busy} onClick={() => void command('attack', target.id)}>ابدأ الغزو</button>
        </div>
      </section>
    </div>}
  </main>;
}
