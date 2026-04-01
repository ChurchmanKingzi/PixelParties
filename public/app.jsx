/* ============================================================
   PIXEL PARTIES TCG — Frontend Application
   ============================================================ */
const { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext } = React;

// ===== API HELPER =====
let AUTH_TOKEN = null;

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (AUTH_TOKEN) headers['x-auth-token'] = AUTH_TOKEN;
  const res = await fetch('/api' + path, { ...opts, headers: { ...headers, ...opts.headers } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ===== SOCKET =====
const socket = io();
function emitSocket(event, data) { socket.emit(event, data); }

// ===== CARD DB =====
let ALL_CARDS = [];          // every card from cards.json (for rule lookups)
let CARDS_BY_NAME = {};      // name → card object (full DB, needed for deck validation)
let AVAILABLE_CARDS = [];    // only cards with images in ./cards (shown in browser)
let AVAILABLE_MAP = {};      // card name → image filename
let CARD_TYPES = [];
let SUBTYPES = [];
let SPELL_SCHOOLS = [];
let STARTING_ABILITIES = [];
let ARCHETYPES = [];

async function loadCardDB() {
  // Load full card database (needed for rule lookups on existing decks)
  const res = await fetch('/data/cards.json');
  const cards = await res.json();
  ALL_CARDS = cards.sort((a, b) => a.name.localeCompare(b.name));
  CARDS_BY_NAME = {};
  ALL_CARDS.forEach(c => { CARDS_BY_NAME[c.name] = c; });

  // Load available cards (only those with images in ./cards)
  try {
    const avRes = await fetch('/api/cards/available');
    const avData = await avRes.json();
    AVAILABLE_MAP = avData.available || {};
  } catch {
    AVAILABLE_MAP = {};
  }

  // Filter to only available cards; build filter dropdowns from this subset
  const avSet = new Set(Object.keys(AVAILABLE_MAP));
  AVAILABLE_CARDS = ALL_CARDS.filter(c => avSet.has(c.name));

  const typesSet = new Set(), subSet = new Set(), ssSet = new Set(), saSet = new Set(), arSet = new Set();
  AVAILABLE_CARDS.forEach(c => {
    typesSet.add(c.cardType);
    if (c.subtype) subSet.add(c.subtype);
    if (c.spellSchool1) ssSet.add(c.spellSchool1);
    if (c.spellSchool2) ssSet.add(c.spellSchool2);
    if (c.startingAbility1) saSet.add(c.startingAbility1);
    if (c.startingAbility2) saSet.add(c.startingAbility2);
    if (c.archetype) arSet.add(c.archetype);
  });
  CARD_TYPES = [...typesSet].sort();
  SUBTYPES = [...subSet].sort();
  SPELL_SCHOOLS = [...ssSet].sort();
  STARTING_ABILITIES = [...saSet].sort();
  ARCHETYPES = [...arSet].sort();
}

function cardImageUrl(cardName) {
  const file = AVAILABLE_MAP[cardName];
  return file ? '/cards/' + encodeURIComponent(file) : null;
}

// ===== DECK HELPERS =====
function isDeckLegal(deck) {
  if (!deck) return { legal: false, reasons: ['No deck'] };
  const reasons = [];
  if ((deck.mainDeck || []).length !== 60) reasons.push('Main deck needs exactly 60 cards (' + (deck.mainDeck||[]).length + '/60)');
  const filledHeroes = (deck.heroes || []).filter(h => h && h.hero);
  if (filledHeroes.length !== 3) reasons.push('Need exactly 3 Heroes (' + filledHeroes.length + '/3)');
  const pc = (deck.potionDeck || []).length;
  if (pc !== 0 && (pc < 5 || pc > 15)) reasons.push('Potion Deck must have 0 or 5-15 cards (' + pc + ')');
  return { legal: reasons.length === 0, reasons };
}

function countInDeck(deck, cardName, excludeSection) {
  let count = 0;
  if (excludeSection !== 'main') count += (deck.mainDeck || []).filter(n => n === cardName).length;
  if (excludeSection !== 'potion') count += (deck.potionDeck || []).filter(n => n === cardName).length;
  if (excludeSection !== 'side') count += (deck.sideDeck || []).filter(n => n === cardName).length;
  if (excludeSection !== 'heroes') {
    (deck.heroes || []).forEach(h => { if (h && h.hero === cardName) count++; });
  }
  return count;
}

function canAddCard(deck, cardName, section) {
  const card = CARDS_BY_NAME[cardName];
  if (!card) return false;
  const ct = card.cardType;
  // Per-card copy limit (e.g. Performance has maxCopies: 4 despite being an Ability)
  const cardMax = card.maxCopies;
  if (section === 'main') {
    if (ct === 'Hero' || ct === 'Potion') return false;
    if ((deck.mainDeck || []).length >= 60) return false;
    if (ct === 'Ability' && !cardMax) return true; // Unlimited unless maxCopies set
    if (countInDeck(deck, cardName) >= (cardMax || 4)) return false;
    return true;
  }
  if (section === 'potion') {
    if (ct !== 'Potion') return false;
    if ((deck.potionDeck || []).length >= 15) return false;
    if (countInDeck(deck, cardName) >= (cardMax || 2)) return false;
    return true;
  }
  if (section === 'hero') {
    if (ct !== 'Hero') return false;
    if (!(deck.heroes || []).some(h => !h || !h.hero)) return false;
    if (countInDeck(deck, cardName) >= (cardMax || 1)) return false;
    return true;
  }
  if (section === 'side') {
    if ((deck.sideDeck || []).length >= 15) return false;
    if (ct === 'Ability' && !cardMax) return true; // Unlimited unless maxCopies set
    const maxC = cardMax || (ct === 'Hero' ? 1 : ct === 'Potion' ? 2 : 4);
    if (countInDeck(deck, cardName) >= maxC) return false;
    return true;
  }
  return false;
}

function typeColor(ct) {
  const m = { Hero:'#ffd700', Creature:'#44aaff', Spell:'#aa44ff', Artifact:'#ff8844',
    Attack:'#ff4444', Potion:'#44ffaa', Ability:'#ffff44', 'Ascended Hero':'#ff44ff', Token:'#888' };
  return m[ct] || '#888';
}

function typeClass(ct) {
  return 'type-' + ct.replace(/\s+/g, '');
}

// Card type sort order for deck display
const TYPE_ORDER = { Creature:0, Spell:1, Attack:2, Artifact:3, Ability:4, Hero:5, 'Ascended Hero':6, Potion:7, Token:8 };
function sortDeckCards(names) {
  return [...names].sort((a, b) => {
    const ca = CARDS_BY_NAME[a], cb = CARDS_BY_NAME[b];
    if (!ca || !cb) return 0;
    const ta = TYPE_ORDER[ca.cardType] ?? 99, tb = TYPE_ORDER[cb.cardType] ?? 99;
    if (ta !== tb) return ta - tb;
    return a.localeCompare(b);
  });
}
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ===== CONTEXT =====
const AppContext = createContext();

// ===== NOTIFICATION COMPONENT =====
function Notification({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, []);
  return (
    <div className={'notification ' + (type || '')} onClick={onClose}>
      {message}
    </div>
  );
}

// ===== CARD MINI COMPONENT =====
// (tooltip dimensions defined inside CardMini)
let activeDragData = null; // module-level drag tracker for within-section reordering
let _persistedUnsaved = {}; // persists unsaved deck changes across screen switches
let _persistedSectionHist = {}; // persists per-section undo history across screen switches
let _pendingGameState = null; // buffered game state for reconnection

// Shine band gradient palettes
const BAND_GRADIENTS = [
  'linear-gradient(to right, transparent 0%, rgba(255,255,255,.06) 8%, rgba(255,80,200,.4) 18%, rgba(80,160,255,.5) 28%, rgba(255,255,60,.4) 38%, rgba(60,255,160,.5) 48%, rgba(200,80,255,.45) 58%, rgba(255,160,60,.35) 68%, rgba(255,255,255,.06) 82%, transparent 100%)',
  'linear-gradient(to right, transparent 0%, rgba(255,255,255,.04) 10%, rgba(255,120,60,.35) 25%, rgba(255,60,180,.4) 40%, rgba(255,200,60,.35) 55%, rgba(255,80,80,.3) 70%, rgba(255,255,255,.04) 85%, transparent 100%)',
  'linear-gradient(to right, transparent 0%, rgba(255,255,255,.05) 12%, rgba(60,200,255,.35) 25%, rgba(60,255,200,.35) 40%, rgba(160,80,255,.3) 55%, rgba(80,180,255,.3) 70%, rgba(255,255,255,.05) 85%, transparent 100%)',
  'linear-gradient(to right, transparent 0%, transparent 20%, rgba(255,255,255,.5) 45%, rgba(255,255,255,.65) 50%, rgba(255,255,255,.5) 55%, transparent 80%, transparent 100%)',
  'linear-gradient(to right, transparent 0%, rgba(255,200,100,.05) 10%, rgba(255,215,0,.35) 25%, rgba(255,180,60,.4) 40%, rgba(255,255,100,.3) 55%, rgba(255,200,60,.25) 70%, rgba(255,200,100,.05) 85%, transparent 100%)',
  'linear-gradient(to right, transparent 0%, rgba(200,100,255,.05) 10%, rgba(160,60,255,.3) 25%, rgba(255,60,255,.35) 40%, rgba(100,60,255,.3) 55%, rgba(180,100,255,.25) 70%, rgba(200,100,255,.05) 85%, transparent 100%)',
];

// Sparkle positions — secret rare (warm)
const SPARKLE_POSITIONS = [
  { x: 15, y: 20, color: '#ffe080', dur: 2.2, delay: 0 },
  { x: 75, y: 12, color: '#80d0ff', dur: 2.5, delay: 0.4 },
  { x: 45, y: 65, color: '#ff80d0', dur: 2.0, delay: 0.9 },
  { x: 85, y: 50, color: '#80ffb0', dur: 2.7, delay: 1.3 },
  { x: 25, y: 80, color: '#d080ff', dur: 2.3, delay: 1.7 },
  { x: 60, y: 35, color: '#ffffff', dur: 1.9, delay: 0.6 },
  { x: 10, y: 50, color: '#ffb060', dur: 2.6, delay: 2.0 },
  { x: 90, y: 85, color: '#60d0ff', dur: 2.1, delay: 1.1 },
  { x: 50, y: 10, color: '#ff60a0', dur: 2.4, delay: 0.2 },
  { x: 35, y: 90, color: '#a0ff60', dur: 2.8, delay: 1.5 },
  { x: 70, y: 70, color: '#ffffff', dur: 2.0, delay: 0.8 },
  { x: 20, y: 40, color: '#ffe0a0', dur: 2.3, delay: 1.9 },
];

// Sparkle positions — diamond rare: white + teal sparkles, no bands
const DIAMOND_SPARKLE_POSITIONS = [
  { x: 15, y: 10, color: '#ffffff', dur: 1.5, delay: 0.0 },
  { x: 80, y: 8,  color: '#70e8d0', dur: 1.7, delay: 0.4 },
  { x: 45, y: 28, color: '#ffffff', dur: 1.4, delay: 0.9 },
  { x: 8,  y: 45, color: '#80f0e0', dur: 1.6, delay: 0.2 },
  { x: 70, y: 42, color: '#ffffff', dur: 1.3, delay: 1.1 },
  { x: 35, y: 55, color: '#90f0e8', dur: 1.8, delay: 0.6 },
  { x: 88, y: 58, color: '#ffffff', dur: 1.5, delay: 1.4 },
  { x: 20, y: 75, color: '#70e0d0', dur: 1.4, delay: 0.3 },
  { x: 60, y: 72, color: '#ffffff', dur: 1.7, delay: 1.0 },
  { x: 50, y: 90, color: '#80eed8', dur: 1.6, delay: 0.7 },
];

// Hook: spawns random shine bands at random intervals
function useFoilBands(enabled) {
  const [bands, setBands] = useState([]);
  const nextId = useRef(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;
    const spawn = () => {
      const id = nextId.current++;
      const dur = 0.7 + Math.random() * 1.6;
      const w = 12 + Math.random() * 38;
      const grad = Math.floor(Math.random() * BAND_GRADIENTS.length);
      const o = 0.25 + Math.random() * 0.45;
      const from = -200 - Math.round(Math.random() * 100);
      const to = Math.ceil(10000 / w) + 200 + Math.round(Math.random() * 100);

      setBands(prev => [...prev, { id, dur, w, grad, o, from, to }]);
      setTimeout(() => setBands(prev => prev.filter(b => b.id !== id)), dur * 1000 + 50);
      timerRef.current = setTimeout(spawn, 150 + Math.random() * 700);
    };
    timerRef.current = setTimeout(spawn, Math.random() * 400);
    return () => clearTimeout(timerRef.current);
  }, [enabled]);

  return bands;
}

// Pure foil overlay renderer — receives bands from parent
function FoilOverlay({ bands, shimmerOffset, sparkleDelays, foilType }) {
  const isDiamond = foilType === 'diamond_rare';
  const sparkles = isDiamond ? DIAMOND_SPARKLE_POSITIONS : SPARKLE_POSITIONS;
  return (
    <div className={'foil-shine-overlay' + (isDiamond ? ' foil-shine-diamond' : '')}>
      {/* Secret rare: travelling shine bands */}
      {!isDiamond && bands.map(b => (
        <div key={b.id} className="foil-band" style={{
          '--band-dur': b.dur + 's',
          '--band-w': b.w + '%',
          '--band-o': b.o,
          '--band-from': b.from + '%',
          '--band-to': b.to + '%',
          backgroundImage: BAND_GRADIENTS[b.grad],
        }} />
      ))}
      <div className={isDiamond ? 'foil-iridescent-diamond' : 'foil-iridescent'} style={{ '--shimmer-offset': shimmerOffset }} />
      {sparkles.map((sp, i) => (
        <div key={i} className="foil-sparkle"
          style={{
            left: sp.x + '%', top: sp.y + '%', color: sp.color,
            '--sp-dur': sp.dur + 's',
            '--sp-delay': (sparkleDelays[i % sparkleDelays.length] || 0) + 's',
          }} />
      ))}
    </div>
  );
}

// Gallery panel dimensions
const GALLERY_W = 400;
const TOP_BAR_H = 41; // top bar approximate height

function CardMini({ card, onClick, onRightClick, count, maxCount, dimmed, style, dragData, inGallery }) {
  const [tt, setTT] = useState(null);
  const imgUrl = cardImageUrl(card.name);
  const foilType = card.foil; // 'secret_rare' | 'diamond_rare' | null
  const isFoil = foilType === 'secret_rare' || foilType === 'diamond_rare';
  const foilClass = foilType === 'diamond_rare' ? 'foil-diamond-rare' : foilType === 'secret_rare' ? 'foil-secret-rare' : '';
  const foilBands = useFoilBands(isFoil);
  const foilMeta = useRef(null);
  // Keep foilMeta in sync when isFoil changes (e.g. sort/reorder swaps card at same index)
  if (isFoil && !foilMeta.current) {
    foilMeta.current = {
      shimmerOffset: `${-Math.random() * 5000}ms`,
      sparkleDelays: SPARKLE_POSITIONS.map(sp => sp.delay + Math.random() * 2),
    };
  } else if (!isFoil && foilMeta.current) {
    foilMeta.current = null;
  }

  const show = (e) => {
    if (activeDragData || deckDragState) return;
    setTT(true);
  };
  const hide = () => setTT(false);
  const onDragStart = (e) => {
    if (dragData) {
      e.dataTransfer.setData('application/json', JSON.stringify(dragData));
      e.dataTransfer.effectAllowed = 'move';
      activeDragData = dragData;
    } else e.preventDefault();
    setTT(false);
  };
  const onDragEnd = () => { activeDragData = null; };
  const ttBorderColor = foilType === 'diamond_rare' ? '2px solid rgba(120,200,255,.6)' : foilType === 'secret_rare' ? '2px solid rgba(255,215,0,.5)' : '1px solid var(--bg4)';
  return (
    <>
      <div className={'card-mini ' + typeClass(card.cardType) + (dimmed ? ' dimmed' : '') + (foilClass ? ' ' + foilClass : '')}
        style={style}
        draggable={!!dragData}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onClick={onClick}
        onContextMenu={(e) => { e.preventDefault(); onRightClick && onRightClick(); }}
        onMouseEnter={show} onMouseLeave={hide}>
        {isFoil && <FoilOverlay bands={foilBands} shimmerOffset={foilMeta.current.shimmerOffset} sparkleDelays={foilMeta.current.sparkleDelays} foilType={foilType} />}
        {imgUrl ? (
          <img src={imgUrl} alt={card.name}
            style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', borderRadius:1 }}
            draggable={false} />
        ) : (
          <>
            <div>
              <div className="card-name">{card.name}</div>
              <div className="card-type" style={{ color: typeColor(card.cardType) }}>
                {card.cardType}{card.subtype ? ' · ' + card.subtype : ''}
              </div>
            </div>
            <div className="card-stats">
              {card.level != null && <span>Lv{card.level}</span>}
              {card.hp != null && <span style={{ color: '#ff6666' }}>♥{card.hp}</span>}
              {card.atk != null && <span style={{ color: '#ffaa44' }}>⚔{card.atk}</span>}
              {card.cost != null && <span style={{ color: '#44aaff' }}>◆{card.cost}</span>}
            </div>
          </>
        )}
        {count != null && (
          <div className="card-count" style={{ color: count >= maxCount && maxCount !== '∞' ? 'var(--danger)' : 'var(--accent3)',
            background: 'rgba(0,0,0,.7)', padding: '1px 4px', borderRadius: 2, zIndex: 1 }}>
            {count}/{maxCount === Infinity ? '∞' : maxCount}
          </div>
        )}
      </div>
      {tt && (
        <div className="tooltip" style={{
          right: inGallery ? GALLERY_W : 0, top: TOP_BAR_H, width: GALLERY_W,
          height: 'calc(100vh - ' + TOP_BAR_H + 'px)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {imgUrl && (
            <div style={{ position: 'relative', width: '100%', flexShrink: 0 }}>
              <img src={imgUrl} alt="" style={{
                width: '100%', aspectRatio: '750/1050', objectFit: 'cover', display: 'block',
                border: ttBorderColor
              }} />
              {isFoil && <FoilOverlay bands={foilBands} shimmerOffset={foilMeta.current.shimmerOffset} sparkleDelays={foilMeta.current.sparkleDelays} foilType={foilType} />}
            </div>
          )}
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
            <div style={{ fontWeight: 700, marginBottom: 5, color: typeColor(card.cardType), fontSize: 18 }}>{card.name}</div>
            <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 8 }}>
              {card.cardType}{card.subtype ? ' · ' + card.subtype : ''}{card.archetype ? ' · ' + card.archetype : ''}
            </div>
            {card.level != null && <div style={{ fontSize: 15 }}>Level: {card.level}</div>}
            <div style={{ display: 'flex', gap: 12, fontSize: 15, marginBottom: 8 }}>
              {card.hp != null && <span>HP: {card.hp}</span>}
              {card.atk != null && <span>ATK: {card.atk}</span>}
              {card.cost != null && <span>Cost: {card.cost}</span>}
            </div>
            {(card.spellSchool1 || card.spellSchool2) &&
              <div style={{ fontSize: 14, color: '#aa88ff', marginBottom: 4 }}>Schools: {[card.spellSchool1, card.spellSchool2].filter(Boolean).join(', ')}</div>}
            {(card.startingAbility1 || card.startingAbility2) &&
              <div style={{ fontSize: 14, color: '#ffcc44', marginBottom: 4 }}>Abilities: {[card.startingAbility1, card.startingAbility2].filter(Boolean).join(', ')}</div>}
            {card.effect &&
              <div style={{ fontSize: 14, marginTop: 6, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{card.effect}</div>}
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════
//  AUTH SCREEN
// ═══════════════════════════════════════════
function AuthScreen() {
  const { setUser } = useContext(AppContext);
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) { setError('Fill in all fields'); return; }
    setLoading(true); setError('');
    try {
      const data = await api('/auth/' + (mode === 'login' ? 'login' : 'signup'), {
        method: 'POST',
        body: JSON.stringify({ username: username.trim(), password })
      });
      AUTH_TOKEN = data.token;
      socket.emit('auth', data.token);
      setUser(data.user);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  return (
    <div className="screen-center">
      <div className="panel animate-in" style={{ width: 380, textAlign: 'center' }}>
        <h1 className="pixel-font" style={{ fontSize: 18, color: 'var(--accent)', marginBottom: 4, textShadow: '0 0 20px var(--accent)' }}>
          PIXEL PARTIES
        </h1>
        <div className="orbit-font" style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 24, letterSpacing: 2 }}>
          TRADING CARD GAME
        </div>
        <div className="tab-bar" style={{ marginBottom: 20 }}>
          <div className={'tab' + (mode === 'login' ? ' active' : '')} onClick={() => { setMode('login'); setError(''); }}>LOG IN</div>
          <div className={'tab' + (mode === 'signup' ? ' active' : '')} onClick={() => { setMode('signup'); setError(''); }}>SIGN UP</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input className="input" placeholder="Username" value={username}
            onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
          <input className="input" type="password" placeholder="Password" value={password}
            onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
          {error && <div style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</div>}
          <button className="btn btn-big" onClick={handleSubmit} disabled={loading}>
            {loading ? '...' : mode === 'login' ? 'LOG IN' : 'SIGN UP'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  MAIN MENU
// ═══════════════════════════════════════════
function MainMenu() {
  const { user, setScreen, setUser } = useContext(AppContext);
  const logout = async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch {}
    AUTH_TOKEN = null;
    setUser(null);
  };
  return (
    <div className="screen-center" style={{ flexDirection: 'column', gap: 20 }}>
      <h1 className="pixel-font" style={{ fontSize: 24, color: 'var(--accent)', textShadow: '0 0 30px var(--accent)' }}>PIXEL PARTIES</h1>
      <div className="orbit-font" style={{ fontSize: 12, color: 'var(--text2)', letterSpacing: 3, marginBottom: 20 }}>TRADING CARD GAME</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 280 }} className="animate-in">
        <button className="btn btn-big" onClick={() => setScreen('play')} style={{ fontSize: 16 }}>⚔ PLAY</button>
        <button className="btn btn-big btn-accent2" onClick={() => setScreen('deckbuilder')} style={{ fontSize: 16 }}>✦ EDIT DECK</button>
        <button className="btn btn-big btn-success" onClick={() => setScreen('profile')} style={{ fontSize: 16 }}>♛ VIEW PROFILE</button>
      </div>
      <div style={{ marginTop: 30, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ color: user.color || 'var(--accent)', fontWeight: 700 }} className="orbit-font">{user.username}</span>
        <span className="badge" style={{ background: 'rgba(170,255,0,.12)', color: 'var(--accent3)' }}>ELO {user.elo}</span>
        <button className="btn" style={{ padding: '4px 12px', fontSize: 10 }} onClick={logout}>LOGOUT</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  PROFILE SCREEN
// ═══════════════════════════════════════════

const RANK_TIERS = [
  { name: 'BRONZE',       min: 0,    color: '#cd7f32', glow: 'rgba(205,127,50,.5)',  icon: '⬡' },
  { name: 'SILVER',       min: 1200, color: '#c0c0c0', glow: 'rgba(192,192,192,.5)', icon: '⬡' },
  { name: 'GOLD',         min: 1400, color: '#ffd700', glow: 'rgba(255,215,0,.5)',    icon: '⬡' },
  { name: 'PLATINUM',     min: 1600, color: '#a8e8f0', glow: 'rgba(168,232,240,.5)', icon: '◈' },
  { name: 'DIAMOND',      min: 1800, color: '#b9f2ff', glow: 'rgba(185,242,255,.6)', icon: '◆' },
  { name: 'MASTER',       min: 2000, color: '#ff44cc', glow: 'rgba(255,68,204,.5)',   icon: '✦' },
  { name: 'GRANDMASTER',  min: 2200, color: '#ff8800', glow: 'rgba(255,136,0,.6)',    icon: '♛' },
];

function getRank(elo) {
  for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
    if (elo >= RANK_TIERS[i].min) return RANK_TIERS[i];
  }
  return RANK_TIERS[0];
}

function ProfileScreen() {
  const { user, setUser, setScreen, notify } = useContext(AppContext);
  const [color, setColor] = useState(user.color || '#00f0ff');
  const [avatar, setAvatar] = useState(user.avatar);
  const [cardback, setCardback] = useState(user.cardback);
  const [bio, setBio] = useState(user.bio || '');
  const [deckStats, setDeckStats] = useState({ total: 0, legal: 0, decks: [] });
  const [saving, setSaving] = useState(false);

  // Password change
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  // Cardback gallery
  const [showCbGallery, setShowCbGallery] = useState(false);
  const [uploadedCardbacks, setUploadedCardbacks] = useState([]);

  // Top heroes
  const [topHeroes, setTopHeroes] = useState([]);

  // Dirty tracking — compare against original user values
  const isDirty = color !== (user.color || '#00f0ff')
    || avatar !== user.avatar
    || cardback !== user.cardback
    || bio !== (user.bio || '');

  const rank = getRank(user.elo || 1000);
  const wins = user.wins || 0;
  const losses = user.losses || 0;
  const gamesPlayed = wins + losses;
  const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;
  const memberSince = user.created_at ? new Date(user.created_at * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }) : '—';

  // Next rank progress
  const nextRank = RANK_TIERS.find(r => r.min > (user.elo || 1000));
  const prevMin = rank.min;
  const nextMin = nextRank ? nextRank.min : rank.min;
  const eloProgress = nextRank ? Math.min(100, Math.round(((user.elo - prevMin) / (nextMin - prevMin)) * 100)) : 100;

  useEffect(() => {
    api('/profile/deck-stats').then(setDeckStats).catch(() => {});
    api('/profile/hero-stats').then(d => setTopHeroes(d.heroes || [])).catch(() => {});
    loadCardbackGallery();
  }, []);

  // Intercept Escape to close gallery modal before the global handler navigates away
  useEffect(() => {
    if (!showCbGallery) return;
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        setShowCbGallery(false);
      }
    };
    window.addEventListener('keydown', handleEsc, true); // capture phase
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, [showCbGallery]);

  const loadCardbackGallery = async () => {
    try {
      const data = await api('/profile/cardbacks');
      setUploadedCardbacks(data.cardbacks || []);
    } catch {}
  };

  const handleAvatar = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      try {
        const res = await fetch('/api/profile/avatar', {
          method: 'POST', body: JSON.stringify({ avatar: dataUrl }),
          headers: { 'Content-Type': 'application/json', ...(AUTH_TOKEN ? { 'x-auth-token': AUTH_TOKEN } : {}) }
        });
        const data = await res.json();
        if (data.avatar) { setAvatar(data.avatar); setUser(u => ({ ...u, avatar: data.avatar })); notify('Avatar uploaded!', 'success'); }
      } catch (e) { notify(e.message, 'error'); }
    };
    reader.readAsDataURL(file);
  };

  const handleCardbackUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      img.onload = async () => {
        const ratio = img.width / img.height;
        const target = 750 / 1050;
        if (Math.abs(ratio - target) > 0.02) {
          notify('Cardback must have a 750×1050 ratio!', 'error');
          return;
        }
        try {
          const res = await fetch('/api/profile/cardback', {
            method: 'POST', body: JSON.stringify({ cardback: dataUrl }),
            headers: { 'Content-Type': 'application/json', ...(AUTH_TOKEN ? { 'x-auth-token': AUTH_TOKEN } : {}) }
          });
          const data = await res.json();
          if (data.cardback) {
            setUploadedCardbacks(prev => [...prev, data.cardback]);
            setCardback(data.cardback);
            setUser(u => ({ ...u, cardback: data.cardback }));
            notify('Cardback uploaded!', 'success');
          }
        } catch (err) { notify(err.message, 'error'); }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setSaving(true);
    try {
      const data = await api('/profile', { method: 'PUT', body: JSON.stringify({ color, avatar, cardback, bio }) });
      setUser(data.user);
      notify('Profile saved!', 'success');
    } catch (e) { notify(e.message, 'error'); }
    setSaving(false);
  };

  const changePassword = async () => {
    if (!oldPw || !newPw) { notify('Fill in all password fields', 'error'); return; }
    if (newPw !== confirmPw) { notify('New passwords do not match', 'error'); return; }
    if (newPw.length < 3) { notify('New password must be 3+ characters', 'error'); return; }
    setPwSaving(true);
    try {
      await api('/profile/password', { method: 'POST', body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw }) });
      notify('Password changed!', 'success');
      setOldPw(''); setNewPw(''); setConfirmPw('');
    } catch (e) { notify(e.message, 'error'); }
    setPwSaving(false);
  };

  // Build card image URL for deck wall
  const getCardImage = (cardName) => {
    if (!cardName || !AVAILABLE_MAP[cardName]) return null;
    return '/cards/' + AVAILABLE_MAP[cardName];
  };

  // Display URL for current cardback (show default if none selected)
  const displayCardback = cardback || '/cardback.png';

  return (
    <div className="screen-full" style={{ background: 'linear-gradient(180deg, #0a0a12 0%, #12101f 40%, #0a0a12 100%)' }}>
      <div className="top-bar">
        <button className="btn" style={{ padding: '4px 12px', fontSize: 10 }} onClick={() => setScreen('menu')}>← BACK</button>
        <h2 className="orbit-font" style={{ fontSize: 16, color: 'var(--accent)' }}>PLAYER PROFILE</h2>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 10, color: 'var(--text2)' }}>Member since {memberSince}</div>
      </div>

      <div className="profile-layout animate-in" style={{ '--rank-color': rank.color, '--rank-glow': rank.glow }}>

        {/* ═══ LEFT COLUMN — PLAYER IDENTITY ═══ */}
        <div className="profile-identity-col">
          <div className="profile-identity-panel">

            {/* Avatar frame */}
            <div className="profile-hero-area">
              <div className="profile-avatar-frame" style={{ borderColor: rank.color, boxShadow: `0 0 20px ${rank.glow}, 0 0 40px ${rank.glow}, inset 0 0 15px ${rank.glow}` }}>
                <div className="profile-avatar-inner">
                  {avatar
                    ? <img src={avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 56, opacity: 0.5 }}>👤</span>}
                </div>
                <label className="profile-avatar-upload-overlay">
                  <span>✎</span>
                  <input type="file" accept="image/*" onChange={handleAvatar} style={{ display: 'none' }} />
                </label>
              </div>

              {/* Rank badge */}
              <div className="profile-rank-badge" style={{ background: rank.color, color: '#000' }}>
                <span style={{ fontSize: 12 }}>{rank.icon}</span>
                <span className="orbit-font" style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1 }}>{rank.name}</span>
              </div>
            </div>

            {/* Username */}
            <div className="orbit-font" style={{ fontSize: 30, fontWeight: 800, color, letterSpacing: 1, textShadow: `0 0 25px ${color}44`, textAlign: 'center', marginTop: 10 }}>
              {user.username}
            </div>

            {/* ELO display */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 6 }}>
              <span className="orbit-font" style={{ fontSize: 22, fontWeight: 700, color: rank.color }}>{user.elo || 1000}</span>
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>ELO</span>
            </div>

            {/* ELO progress bar */}
            {nextRank && (
              <div style={{ margin: '10px 0 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text2)', marginBottom: 3 }}>
                  <span>{rank.name}</span>
                  <span>{nextRank.name} ({nextMin})</span>
                </div>
                <div className="profile-elo-bar">
                  <div className="profile-elo-fill" style={{ width: eloProgress + '%', background: `linear-gradient(90deg, ${rank.color}, ${nextRank.color})` }} />
                </div>
              </div>
            )}

            {/* Divider */}
            <div style={{ borderTop: '1px solid var(--bg4)', margin: '16px 0' }} />

            {/* Bio */}
            <div>
              <div className="profile-section-label">MOTTO</div>
              <textarea
                className="profile-bio-input"
                value={bio}
                onChange={e => setBio(e.target.value.slice(0, 200))}
                placeholder="Write something memorable..."
                rows={3}
                maxLength={200}
              />
              <div style={{ textAlign: 'right', fontSize: 9, color: 'var(--text2)', marginTop: 2 }}>{bio.length}/200</div>
            </div>

            {/* Profile Backup */}
            <div style={{ borderTop: '1px solid var(--bg4)', margin: '12px 0', paddingTop: 12 }}>
              <div className="profile-section-label">PROFILE BACKUP</div>
              {/* Export/Import buttons hidden — profile data now persists via Turso DB */}
              <div style={{ fontSize: 9, color: 'var(--text2)', marginTop: 6, textAlign: 'center' }}>
                Profile data is stored in the cloud and persists across updates.
              </div>
            </div>

            {/* Save button at bottom of identity panel */}
            <div style={{ marginTop: 'auto', paddingTop: 16 }}>
              <button className="btn btn-success" style={{ width: '100%', padding: '12px 0', fontSize: 14 }} onClick={save} disabled={saving || !isDirty}>
                {saving ? '...' : isDirty ? 'SAVE PROFILE' : 'NO CHANGES'}
              </button>
            </div>

          </div>
        </div>

        {/* ═══ RIGHT COLUMN — STATS & CUSTOMIZATION ═══ */}
        <div className="profile-right-col">

          {/* Combined: Card Back + Battle Record + Name Color + Top Heroes */}
          <div className="profile-section profile-section-wide" style={{ flex: 'none' }}>
            <div style={{ display: 'flex', gap: 28, alignItems: 'stretch' }}>

              {/* Card Back — large preview */}
              <div className="profile-cardback-preview profile-cardback-xl profile-cardback-clickable" onClick={() => setShowCbGallery(true)}>
                <img src={displayCardback} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div className="profile-cardback-hover-overlay">CHANGE</div>
              </div>

              {/* Middle: stacked info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: 180 }}>

                {/* Battle Record */}
                <div style={{ paddingBottom: 14, borderBottom: '1px solid var(--bg4)' }}>
                  <div className="profile-section-label">BATTLE RECORD</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--success)', fontWeight: 700, fontSize: 15 }}>{wins}</span>
                    <span style={{ fontSize: 10, color: 'var(--text2)' }}>W</span>
                    <span style={{ color: 'var(--text2)', fontSize: 10 }}>/</span>
                    <span style={{ color: 'var(--danger)', fontWeight: 700, fontSize: 15 }}>{losses}</span>
                    <span style={{ fontSize: 10, color: 'var(--text2)' }}>L</span>
                    <span style={{ color: 'var(--bg4)', margin: '0 4px' }}>│</span>
                    <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 15 }}>{winRate}%</span>
                    <span style={{ fontSize: 10, color: 'var(--text2)' }}>Win Rate</span>
                    <span style={{ color: 'var(--bg4)', margin: '0 4px' }}>│</span>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{gamesPlayed}</span>
                    <span style={{ fontSize: 10, color: 'var(--text2)' }}>Games</span>
                  </div>
                </div>

                {/* Name Color */}
                <div style={{ paddingTop: 14, paddingBottom: 14, borderBottom: '1px solid var(--bg4)' }}>
                  <div className="profile-section-label">NAME COLOR</div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <input type="color" value={color} onChange={e => setColor(e.target.value)}
                      style={{ width: 44, height: 34, border: '1px solid var(--bg4)', cursor: 'pointer', background: 'none', padding: 0 }} />
                    <span style={{ color, fontWeight: 700, fontSize: 18 }}>{user.username}</span>
                    <span style={{ fontSize: 11, color: 'var(--text2)', marginLeft: 4 }}>Preview</span>
                  </div>
                </div>

                {/* Card Back info */}
                <div style={{ paddingTop: 14, flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className="profile-section-label">CARD BACK</div>
                  <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>
                    {cardback ? 'Custom Card Back' : 'Default Card Back'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.5 }}>
                    Click the preview or the button below to choose from your gallery.
                  </div>
                  <button className="btn" style={{ padding: '8px 20px', fontSize: 12, marginTop: 4, alignSelf: 'flex-start' }}
                    onClick={() => setShowCbGallery(true)}>
                    OPEN GALLERY
                  </button>
                </div>

              </div>

              {/* Right: Top Heroes */}
              <div style={{ borderLeft: '1px solid var(--bg4)', paddingLeft: 24, display: 'flex', flexDirection: 'column', flex: 1, minWidth: 140 }}>
                <div className="profile-section-label">TOP HEROES</div>
                {topHeroes.length === 0 ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ color: 'var(--text2)', fontSize: 11, textAlign: 'center', lineHeight: 1.6 }}>
                      No hero data yet.<br />Play games to track your best heroes!
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                    {topHeroes.map((h, i) => {
                      const heroImg = getCardImage(h.name);
                      const medal = ['🥇', '🥈', '🥉'][i];
                      return (
                        <div key={h.name} className="profile-top-hero">
                          <div className="profile-top-hero-rank">{medal}</div>
                          <div className="profile-top-hero-card">
                            {heroImg
                              ? <img src={heroImg} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <div style={{ width: '100%', height: '100%', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'var(--text2)' }}>?</div>
                            }
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="profile-top-hero-name" title={h.name}>{h.name}</div>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
                              <span className="orbit-font" style={{ fontSize: 14, fontWeight: 700, color: h.winRate >= 50 ? 'var(--success)' : 'var(--danger)' }}>
                                {h.winRate}%
                              </span>
                              <span style={{ fontSize: 9, color: 'var(--text2)' }}>
                                {h.wins}W / {h.losses}L
                              </span>
                            </div>
                            <div className="profile-top-hero-bar">
                              <div className="profile-top-hero-bar-fill" style={{ width: h.winRate + '%', background: h.winRate >= 50 ? 'var(--success)' : 'var(--danger)' }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Cardback Gallery Modal */}
          {showCbGallery && (
            <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowCbGallery(false); }}>
              <div className="modal" style={{ maxWidth: 620, width: '90vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
                  <h3 className="orbit-font" style={{ fontSize: 14, color: 'var(--accent)', flex: 1 }}>SELECT CARD BACK</h3>
                  <button className="btn" style={{ padding: '4px 12px', fontSize: 10 }} onClick={() => setShowCbGallery(false)}>✕ CLOSE</button>
                </div>
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  <div className="profile-cb-gallery">
                    {/* Default cardback */}
                    <div className={'profile-cb-gallery-item' + (!cardback ? ' active' : '')} onClick={() => { setCardback(null); setShowCbGallery(false); }}>
                      <div className="profile-cb-gallery-card">
                        <img src="/cardback.png" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <div className="profile-cb-gallery-label">Default</div>
                    </div>
                    {/* Uploaded cardbacks */}
                    {uploadedCardbacks.map((cb, i) => (
                      <div key={i} className={'profile-cb-gallery-item' + (cardback === cb ? ' active' : '')} onClick={() => { setCardback(cb); setShowCbGallery(false); }}>
                        <div className="profile-cb-gallery-card">
                          <img src={cb} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <div className="profile-cb-gallery-label">Custom {i + 1}</div>
                      </div>
                    ))}
                    {/* Upload new */}
                    <label className="profile-cb-gallery-item profile-cb-gallery-upload">
                      <div className="profile-cb-gallery-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 28, color: 'var(--accent)', opacity: 0.6 }}>+</span>
                        <span style={{ fontSize: 9, color: 'var(--text2)' }}>Upload New</span>
                        <span style={{ fontSize: 8, color: 'var(--text2)' }}>750×1050</span>
                      </div>
                      <input type="file" accept="image/*" onChange={handleCardbackUpload} style={{ display: 'none' }} />
                      <div className="profile-cb-gallery-label">Upload</div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Change Password */}
          <div className="profile-section profile-section-wide">
            <div className="profile-section-label">CHANGE PASSWORD</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <input className="input" type="password" placeholder="Current password" value={oldPw}
                onChange={e => setOldPw(e.target.value)} style={{ flex: 1 }} />
              <input className="input" type="password" placeholder="New password" value={newPw}
                onChange={e => setNewPw(e.target.value)} style={{ flex: 1 }} />
              <input className="input" type="password" placeholder="Repeat new password" value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)} style={{ flex: 1 }}
                onKeyDown={e => e.key === 'Enter' && changePassword()} />
              <button className="btn" style={{ padding: '8px 18px', fontSize: 11, whiteSpace: 'nowrap' }}
                onClick={changePassword} disabled={pwSaving}>
                {pwSaving ? '...' : 'CHANGE'}
              </button>
            </div>
          </div>

          {/* ═══ DECK COLLECTION + WALL ═══ */}
          <div className="profile-section profile-section-wide" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="profile-section-label" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span>DECK COLLECTION</span>
              <div style={{ display: 'flex', gap: 12, marginLeft: 'auto', fontSize: 9, borderBottom: 'none', paddingBottom: 0, marginBottom: 0 }}>
                <span style={{ color: 'var(--text)' }}>{deckStats.total} <span style={{ color: 'var(--text2)' }}>TOTAL</span></span>
                <span style={{ color: 'var(--success)' }}>{deckStats.legal} <span style={{ color: 'var(--text2)' }}>LEGAL</span></span>
                <span style={{ color: deckStats.total - deckStats.legal > 0 ? 'var(--danger)' : 'var(--text2)' }}>
                  {deckStats.total - deckStats.legal} <span style={{ color: 'var(--text2)' }}>ILLEGAL</span>
                </span>
              </div>
            </div>
            {(deckStats.decks || []).length === 0 ? (
              <div style={{ color: 'var(--text2)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
                No decks yet — head to the Deck Builder to create one!
              </div>
            ) : (
              <div className="profile-deck-wall">
                {(deckStats.decks || []).map(d => {
                  const img = getCardImage(d.repCard);
                  return (
                    <div key={d.id} className="profile-deck-tile" onClick={() => setScreen('deckbuilder')}>
                      <div className="profile-deck-tile-card">
                        {img
                          ? <img src={img} style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
                          : <div style={{ width: '100%', height: '100%', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: 'var(--text2)' }}>?</div>
                        }
                        {d.isDefault && <div className="profile-deck-tile-star" title="Default deck">★</div>}
                        <div className="profile-deck-tile-status" style={{ color: d.legal ? 'var(--success)' : 'var(--danger)' }}>
                          {d.legal ? '✓' : '✗'}
                        </div>
                      </div>
                      <div className="profile-deck-tile-name" title={d.name}>{d.name}</div>
                      <div className="profile-deck-tile-count">{d.cardCount}/60</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════
//  DECK BUILDER
// ═══════════════════════════════════════════

// Context menu sub-component
function CtxMenu({ x, y, items, onClose }) {
  useEffect(() => {
    const h = (e) => { if (!e.target.closest('.ctx-menu')) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  return (
    <div className="ctx-menu" style={{ left: Math.min(x, window.innerWidth - 200), top: Math.min(y, window.innerHeight - items.length * 40 - 10) }}>
      {items.map((it, i) => (
        <div key={i} className={'ctx-menu-item' + (it.disabled ? ' disabled' : '')}
          onClick={() => { if (!it.disabled) { it.action(); onClose(); } }}>
          <span style={{ color: it.color || 'var(--text)' }}>{it.icon || ''}</span>
          {it.label}
        </div>
      ))}
    </div>
  );
}

// Drop target wrapper for deck sections (cross-section drops)
// Deck drag state — module level so CardMini can check it
let deckDragState = null;

function DropSection({ sectionId, onDrop, onDragPos, children, className, style }) {
  const [over, setOver] = useState(false);
  const onDragOver = (e) => {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOver(true);
    if (onDragPos) onDragPos(sectionId, e.clientX, e.clientY);
  };
  const onDragLeave = () => { setOver(false); if (onDragPos) onDragPos(null); };
  const handleDrop = (e) => {
    e.preventDefault(); setOver(false);
    if (onDragPos) onDragPos(null);
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data && onDrop) onDrop(data, e.clientX, e.clientY);
    } catch {}
  };
  return (
    <div className={className || ''} style={{ ...style, outline: over ? '2px solid var(--accent)' : 'none' }}
      onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={handleDrop}>
      {children}
    </div>
  );
}

function DeckCardSlot({ children }) {
  return children;
}

function HeroSlot({ children }) {
  return <div>{children}</div>;
}

// Button with instant styled tooltip on hover
function TipBtn({ tip, children, ...props }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const onEnter = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPos({ x: rect.left + rect.width / 2, y: rect.top });
    setShow(true);
  };
  return (
    <>
      <button {...props} onMouseEnter={onEnter} onMouseLeave={() => setShow(false)}>
        {children}
      </button>
      {show && (
        <div style={{
          position: 'fixed', left: pos.x, top: pos.y - 28, transform: 'translateX(-50%)',
          background: 'var(--bg2)', border: '1px solid var(--accent)', color: 'var(--text)',
          padding: '3px 10px', fontSize: 11, fontFamily: "'Rajdhani', sans-serif", fontWeight: 600,
          whiteSpace: 'nowrap', zIndex: 9990, pointerEvents: 'none',
          boxShadow: '0 2px 8px rgba(0,0,0,.6)'
        }}>{tip}</div>
      )}
    </>
  );
}

function DeckBuilder() {
  const { user, setScreen, notify } = useContext(AppContext);
  const [decks, setDecks] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [unsaved, setUnsaved] = useState(_persistedUnsaved);

  // Sync unsaved changes to module-level persistence
  useEffect(() => { _persistedUnsaved = unsaved; }, [unsaved]);
  const [loaded, setLoaded] = useState(false);
  const [filters, setFilters] = useState({ name:'',effect:'',cardType:'',subtype:'',archetype:'',sa1:'',sa2:'',ss1:'',ss2:'',level:'',cost:'',hp:'',atk:'' });
  const [cardPage, setCardPage] = useState(0);
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState('');
  const [ctxMenu, setCtxMenu] = useState(null);
  const [historyTick, setHistoryTick] = useState(0);

  // Per-section undo/redo history
  // deckId -> { main:{stack,idx}, heroes:{stack,idx}, potion:{stack,idx}, side:{stack,idx} }
  const shRef = useRef(_persistedSectionHist);

  // Sync section history to module-level persistence
  useEffect(() => { _persistedSectionHist = shRef.current; });
  const getSH = (deckId, sec) => {
    if (!shRef.current[deckId]) shRef.current[deckId] = {};
    if (!shRef.current[deckId][sec]) shRef.current[deckId][sec] = { stack: [null], idx: 0 };
    return shRef.current[deckId][sec];
  };

  // Load decks
  useEffect(() => {
    (async () => {
      try {
        const data = await api('/decks');
        if (data.decks && data.decks.length > 0) {
          setDecks(data.decks);
          const defIdx = data.decks.findIndex(d => d.isDefault);
          if (defIdx >= 0) setActiveIdx(defIdx);
        } else {
          const nd = await api('/decks', { method: 'POST', body: JSON.stringify({ name: 'My First Deck' }) });
          setDecks([nd.deck]);
        }
      } catch (e) { notify(e.message, 'error'); }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    const close = () => setCtxMenu(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, []);

  // Current deck with unsaved overlay
  const currentDeck = useMemo(() => {
    if (!decks[activeIdx]) return null;
    const base = decks[activeIdx];
    const overlay = unsaved[base.id];
    return overlay ? { ...base, ...overlay } : base;
  }, [decks, activeIdx, unsaved]);

  // Section key mapping
  const SK = { main: 'mainDeck', heroes: 'heroes', potion: 'potionDeck', side: 'sideDeck' };

  // Update one or more sections with per-section history
  const updateSections = (changes) => {
    const deckId = decks[activeIdx]?.id;
    if (!deckId) return;
    for (const [sec, val] of Object.entries(changes)) {
      const h = getSH(deckId, sec);
      const truncated = h.stack.slice(0, h.idx + 1);
      truncated.push(val);
      if (truncated.length > 51) truncated.shift();
      h.idx = truncated.length - 1;
      h.stack = truncated;
    }
    setUnsaved(prev => {
      const overlay = { ...(prev[deckId] || {}) };
      for (const [sec, val] of Object.entries(changes)) overlay[SK[sec]] = val;
      return { ...prev, [deckId]: overlay };
    });
    setHistoryTick(t => t + 1);
  };

  // Compat shim for old-style calls
  const updateCurrent = (changes) => {
    const mapped = {};
    if ('mainDeck' in changes) mapped.main = changes.mainDeck;
    if ('heroes' in changes) mapped.heroes = changes.heroes;
    if ('potionDeck' in changes) mapped.potion = changes.potionDeck;
    if ('sideDeck' in changes) mapped.side = changes.sideDeck;
    if (Object.keys(mapped).length > 0) updateSections(mapped);
  };

  // Per-section undo/redo
  const undoSection = (sec) => {
    const deckId = decks[activeIdx]?.id; if (!deckId) return;
    const h = getSH(deckId, sec); if (h.idx <= 0) return;
    h.idx--;
    const val = h.stack[h.idx];
    setUnsaved(prev => {
      const overlay = { ...(prev[deckId] || {}) };
      if (val === null) delete overlay[SK[sec]];
      else overlay[SK[sec]] = val;
      if (Object.keys(overlay).length === 0) { const n = { ...prev }; delete n[deckId]; return n; }
      return { ...prev, [deckId]: overlay };
    });
    setHistoryTick(t => t + 1);
  };
  const redoSection = (sec) => {
    const deckId = decks[activeIdx]?.id; if (!deckId) return;
    const h = getSH(deckId, sec); if (h.idx >= h.stack.length - 1) return;
    h.idx++;
    setUnsaved(prev => ({ ...prev, [deckId]: { ...(prev[deckId] || {}), [SK[sec]]: h.stack[h.idx] } }));
    setHistoryTick(t => t + 1);
  };
  const canUndoSec = (sec) => { const id = decks[activeIdx]?.id; const h = id && shRef.current[id]?.[sec]; return h && h.idx > 0; };
  const canRedoSec = (sec) => { const id = decks[activeIdx]?.id; const h = id && shRef.current[id]?.[sec]; return h && h.idx < h.stack.length - 1; };

  // ——— Server operations ———
  const saveCurrent = async () => {
    if (!currentDeck) return;
    try {
      const data = await api('/decks/' + currentDeck.id, {
        method: 'PUT',
        body: JSON.stringify({ name: currentDeck.name, mainDeck: currentDeck.mainDeck, heroes: currentDeck.heroes, potionDeck: currentDeck.potionDeck, sideDeck: currentDeck.sideDeck, isDefault: currentDeck.isDefault })
      });
      const newDecks = [...decks]; newDecks[activeIdx] = data.deck;
      const id = currentDeck.id;
      setUnsaved(prev => { const n = { ...prev }; delete n[id]; return n; });
      delete shRef.current[id];
      setHistoryTick(t => t + 1);
      setDecks(newDecks);
      notify('Deck saved!', 'success');
    } catch (e) { notify(e.message, 'error'); }
  };

  const finishRename = async () => {
    if (renameVal.trim() && currentDeck) {
      const newName = renameVal.trim();
      setRenaming(false);
      try {
        const data = await api('/decks/' + currentDeck.id, {
          method: 'PUT',
          body: JSON.stringify({ name: newName, mainDeck: currentDeck.mainDeck, heroes: currentDeck.heroes, potionDeck: currentDeck.potionDeck, sideDeck: currentDeck.sideDeck, isDefault: currentDeck.isDefault })
        });
        const newDecks = [...decks]; newDecks[activeIdx] = data.deck;
        const id = currentDeck.id;
        setUnsaved(prev => { const n = { ...prev }; delete n[id]; return n; });
        delete shRef.current[id];
        setHistoryTick(t => t + 1);
        setDecks(newDecks);
        notify('Deck renamed & saved!', 'success');
      } catch (e) { notify(e.message, 'error'); }
    } else { setRenaming(false); }
  };

  const saveAs = async () => {
    if (!currentDeck) return;
    const newName = prompt('New deck name:', currentDeck.name + ' (Copy)');
    if (!newName) return;
    try {
      await api('/decks/' + currentDeck.id, { method: 'PUT', body: JSON.stringify({ name: currentDeck.name, mainDeck: currentDeck.mainDeck, heroes: currentDeck.heroes, potionDeck: currentDeck.potionDeck, sideDeck: currentDeck.sideDeck, isDefault: currentDeck.isDefault }) });
      const id = currentDeck.id;
      setUnsaved(prev => { const n = { ...prev }; delete n[id]; return n; });
      delete shRef.current[id];
      const data = await api('/decks/' + currentDeck.id + '/saveas', { method: 'POST', body: JSON.stringify({ name: newName }) });
      const newDecks = [...decks, data.deck]; setDecks(newDecks); setActiveIdx(newDecks.length - 1);
      notify('Saved as "' + newName + '"!', 'success');
    } catch (e) { notify(e.message, 'error'); }
  };

  const deleteDeck = async () => {
    if (decks.length <= 1) return;
    if (!confirm('Delete "' + currentDeck.name + '"?')) return;
    try {
      await api('/decks/' + currentDeck.id, { method: 'DELETE' });
      const id = currentDeck.id;
      const newDecks = decks.filter(d => d.id !== id);
      setUnsaved(prev => { const n = { ...prev }; delete n[id]; return n; });
      delete shRef.current[id];
      setDecks(newDecks); setActiveIdx(Math.min(activeIdx, newDecks.length - 1));
      notify('Deck deleted', 'success');
    } catch (e) { notify(e.message, 'error'); }
  };

  const setDefault = async () => {
    const v = isDeckLegal(currentDeck);
    if (!v.legal) { notify('Deck must be legal to set as default', 'error'); return; }
    try {
      await api('/decks/' + currentDeck.id, { method: 'PUT', body: JSON.stringify({ isDefault: true }) });
      setDecks(decks.map((d, i) => ({ ...d, isDefault: i === activeIdx })));
      notify('Set as default deck!', 'success');
    } catch (e) { notify(e.message, 'error'); }
  };

  // ——— Card operations ———
  const addCardTo = useCallback((cardName, section) => {
    if (!currentDeck) return false;
    const card = CARDS_BY_NAME[cardName];
    if (!card) return false;
    if (section === 'main') {
      if (!canAddCard(currentDeck, cardName, 'main')) return false;
      updateSections({ main: [...(currentDeck.mainDeck || []), cardName] });
      return true;
    }
    if (section === 'potion') {
      if (!canAddCard(currentDeck, cardName, 'potion')) return false;
      updateSections({ potion: [...(currentDeck.potionDeck || []), cardName] });
      return true;
    }
    if (section === 'side') {
      if (!canAddCard(currentDeck, cardName, 'side')) return false;
      updateSections({ side: [...(currentDeck.sideDeck || []), cardName] });
      return true;
    }
    if (section === 'hero') {
      if (!canAddCard(currentDeck, cardName, 'hero')) return false;
      const heroes = [...(currentDeck.heroes || [{ hero:null,ability1:null,ability2:null },{ hero:null,ability1:null,ability2:null },{ hero:null,ability1:null,ability2:null }])];
      const slot = heroes.findIndex(h => !h || !h.hero);
      if (slot < 0) return false;
      heroes[slot] = { hero: cardName, ability1: card.startingAbility1 || null, ability2: card.startingAbility2 || null };
      updateSections({ heroes });
      return true;
    }
    return false;
  }, [currentDeck, unsaved, decks, activeIdx]);

  // Add a card at a specific index within a section
  const addCardAt = useCallback((cardName, section, idx) => {
    if (!currentDeck) return false;
    if (!canAddCard(currentDeck, cardName, section)) return false;
    const keyMap = { main: 'mainDeck', potion: 'potionDeck', side: 'sideDeck' };
    const key = keyMap[section];
    if (!key) return addCardTo(cardName, section);
    const arr = [...(currentDeck[key] || [])];
    arr.splice(Math.min(idx, arr.length), 0, cardName);
    updateSections({ [section]: arr });
    return true;
  }, [currentDeck, unsaved, decks, activeIdx]);

  // Add hero to a specific slot (or first free), with swap if occupied
  const addCardToHeroSlot = useCallback((cardName, targetSlot) => {
    if (!currentDeck) return false;
    const card = CARDS_BY_NAME[cardName];
    if (!card || card.cardType !== 'Hero') return false;
    const heroes = [...(currentDeck.heroes || [{ hero:null,ability1:null,ability2:null },{ hero:null,ability1:null,ability2:null },{ hero:null,ability1:null,ability2:null }])].map(h => ({ ...h }));
    // Check if this hero is already in the deck
    if (heroes.some(h => h && h.hero === cardName)) return false;
    let slot = targetSlot != null ? targetSlot : heroes.findIndex(h => !h || !h.hero);
    if (slot < 0 || slot > 2) return false;
    heroes[slot] = { hero: cardName, ability1: card.startingAbility1 || null, ability2: card.startingAbility2 || null };
    updateSections({ heroes });
    return true;
  }, [currentDeck, unsaved, decks, activeIdx]);

  const removeFrom = useCallback((cardName, section, index) => {
    if (!currentDeck) return;
    const removeOne = (arr, idx) => { const n = [...arr]; if (idx != null) n.splice(idx, 1); else { const i = n.indexOf(cardName); if (i >= 0) n.splice(i, 1); } return n; };
    if (section === 'main') updateSections({ main: removeOne(currentDeck.mainDeck || [], index) });
    else if (section === 'potion') updateSections({ potion: removeOne(currentDeck.potionDeck || [], index) });
    else if (section === 'side') updateSections({ side: removeOne(currentDeck.sideDeck || [], index) });
    else if (section === 'hero') {
      const heroes = [...(currentDeck.heroes || [])];
      const slot = heroes.findIndex(h => h && h.hero === cardName);
      if (slot >= 0) heroes[slot] = { hero: null, ability1: null, ability2: null };
      updateSections({ heroes });
    }
  }, [currentDeck, unsaved, decks, activeIdx]);

  // Within-section reordering
  const reorderInSection = useCallback((section, fromIdx, toIdx) => {
    if (!currentDeck) return;
    const keyMap = { main: 'mainDeck', potion: 'potionDeck', side: 'sideDeck' };
    const arr = [...(currentDeck[keyMap[section]] || [])];
    if (fromIdx === toIdx || fromIdx + 1 === toIdx) return;
    const [card] = arr.splice(fromIdx, 1);
    const adjusted = toIdx > fromIdx ? toIdx - 1 : toIdx;
    arr.splice(adjusted, 0, card);
    updateSections({ [section]: arr });
  }, [currentDeck, unsaved, decks, activeIdx]);

  // Hero swapping
  const swapHeroes = useCallback((fromIdx, toIdx) => {
    if (!currentDeck) return;
    const heroes = [...(currentDeck.heroes || [])].map(h => ({ ...h }));
    [heroes[fromIdx], heroes[toIdx]] = [heroes[toIdx], heroes[fromIdx]];
    updateSections({ heroes });
  }, [currentDeck, unsaved, decks, activeIdx]);

  // Auto-add (right-click DB card)
  const autoAdd = useCallback((cardName) => {
    const card = CARDS_BY_NAME[cardName];
    if (!card) return;
    if (card.cardType === 'Hero') addCardTo(cardName, 'hero');
    else if (card.cardType === 'Potion') addCardTo(cardName, 'potion');
    else addCardTo(cardName, 'main');
  }, [addCardTo]);

  // Left-click DB card → context menu
  const showAddMenu = useCallback((cardName, e) => {
    const card = CARDS_BY_NAME[cardName];
    if (!card || !currentDeck) return;
    const items = [];
    if (card.cardType === 'Hero') {
      items.push({ label: 'Add to Heroes', icon: '👑', color: '#ffd700', disabled: !canAddCard(currentDeck, cardName, 'hero'), action: () => addCardTo(cardName, 'hero') });
    } else if (card.cardType === 'Potion') {
      items.push({ label: 'Add to Potion Deck', icon: '🧪', color: '#44ffaa', disabled: !canAddCard(currentDeck, cardName, 'potion'), action: () => addCardTo(cardName, 'potion') });
    } else {
      items.push({ label: 'Add to Main Deck', icon: '📋', color: '#44aaff', disabled: !canAddCard(currentDeck, cardName, 'main'), action: () => addCardTo(cardName, 'main') });
    }
    items.push({ label: 'Add to Side Deck', icon: '📦', color: '#888', disabled: !canAddCard(currentDeck, cardName, 'side'), action: () => addCardTo(cardName, 'side') });
    setCtxMenu({ x: e.clientX, y: e.clientY, items });
  }, [currentDeck, addCardTo]);

  // Cross-section drop
  const handleDrop = useCallback((targetSection, dragData, mouseX, mouseY) => {
    if (!dragData || !dragData.cardName || !currentDeck) return;
    const { cardName, fromSection, fromIndex, targetSlot } = dragData;
    if (fromSection === targetSection && targetSection !== 'hero') return;

    // Determine positional index from mouse if available
    let posIdx = null;
    if (mouseX != null && mouseY != null && targetSection !== 'hero') {
      const dropTarget = findDropTarget(mouseX, mouseY, null, -1);
      if (dropTarget && dropTarget.section === targetSection) posIdx = dropTarget.idx;
    }

    // Gallery drop (no fromSection)
    if (!fromSection) {
      if (targetSection === 'hero') {
        addCardToHeroSlot(cardName, targetSlot != null ? targetSlot : null);
      } else if (posIdx != null) {
        addCardAt(cardName, targetSection, posIdx);
      } else {
        addCardTo(cardName, targetSection);
      }
      return;
    }

    // Hero→Hero swap/move
    if (fromSection === 'hero' && targetSection === 'hero') {
      if (targetSlot != null && fromIndex != null) {
        swapHeroes(fromIndex, targetSlot);
      }
      return;
    }

    // Atomic cross-section move
    const tempDeck = {
      mainDeck: [...(currentDeck.mainDeck || [])],
      heroes: (currentDeck.heroes || []).map(h => ({ ...h })),
      potionDeck: [...(currentDeck.potionDeck || [])],
      sideDeck: [...(currentDeck.sideDeck || [])],
    };
    if (fromSection === 'main') { const idx = fromIndex != null ? fromIndex : tempDeck.mainDeck.indexOf(cardName); if (idx >= 0) tempDeck.mainDeck.splice(idx, 1); }
    else if (fromSection === 'potion') { const idx = fromIndex != null ? fromIndex : tempDeck.potionDeck.indexOf(cardName); if (idx >= 0) tempDeck.potionDeck.splice(idx, 1); }
    else if (fromSection === 'side') { const idx = fromIndex != null ? fromIndex : tempDeck.sideDeck.indexOf(cardName); if (idx >= 0) tempDeck.sideDeck.splice(idx, 1); }
    else if (fromSection === 'hero') { const s = tempDeck.heroes.findIndex(h => h && h.hero === cardName); if (s >= 0) tempDeck.heroes[s] = { hero: null, ability1: null, ability2: null }; }

    if (targetSection === 'hero') {
      if (!canAddCard(tempDeck, cardName, 'hero')) return;
      const card = CARDS_BY_NAME[cardName];
      const slot = targetSlot != null ? targetSlot : tempDeck.heroes.findIndex(h => !h || !h.hero);
      if (slot < 0) return;
      tempDeck.heroes[slot] = { hero: cardName, ability1: card?.startingAbility1 || null, ability2: card?.startingAbility2 || null };
    } else {
      if (!canAddCard(tempDeck, cardName, targetSection)) return;
      const key = { main: 'mainDeck', potion: 'potionDeck', side: 'sideDeck' }[targetSection];
      if (posIdx != null) {
        // Adjust index: if we removed from same array earlier, shift down
        let adj = posIdx;
        if (fromSection === targetSection && fromIndex != null && fromIndex < posIdx) adj--;
        tempDeck[key].splice(Math.min(adj, tempDeck[key].length), 0, cardName);
      } else {
        tempDeck[key].push(cardName);
      }
    }

    const changes = {};
    if (fromSection === 'main' || targetSection === 'main') changes.main = tempDeck.mainDeck;
    if (fromSection === 'heroes' || targetSection === 'heroes' || fromSection === 'hero' || targetSection === 'hero') changes.heroes = tempDeck.heroes;
    if (fromSection === 'potion' || targetSection === 'potion') changes.potion = tempDeck.potionDeck;
    if (fromSection === 'side' || targetSection === 'side') changes.side = tempDeck.sideDeck;
    updateSections(changes);
  }, [currentDeck, addCardTo, addCardAt, updateSections]);

  // Per-section sort/shuffle/empty
  const sortSec = (sec) => {
    if (!currentDeck) return;
    const keyMap = { main: 'mainDeck', potion: 'potionDeck', side: 'sideDeck' };
    if (keyMap[sec]) updateSections({ [sec]: sortDeckCards(currentDeck[keyMap[sec]] || []) });
  };
  const shuffleMain = () => { if (currentDeck) updateSections({ main: shuffleArray(currentDeck.mainDeck || []) }); };
  const emptySec = (sec) => {
    if (!currentDeck) return;
    const emptyVals = { main: [], heroes: [{hero:null,ability1:null,ability2:null},{hero:null,ability1:null,ability2:null},{hero:null,ability1:null,ability2:null}], potion: [], side: [] };
    updateSections({ [sec]: emptyVals[sec] });
  };

  // Section header builder
  const SecHeader = ({ sec, color, icon, label, count, max, extra, note }) => (
    <div className="deck-section-header" style={{ color }}>
      {icon} {label} ({count}/{max}){note && <span style={{ fontSize: 9, fontWeight: 400, color: 'var(--text2)', marginLeft: 4 }}>{note}</span>}
      <div style={{ flex: 1 }} />
      <TipBtn tip="Undo" className="btn" style={{ padding: '2px 6px', fontSize: 9, minWidth: 0 }} onClick={() => undoSection(sec)} disabled={!canUndoSec(sec)}>◀</TipBtn>
      <TipBtn tip="Redo" className="btn" style={{ padding: '2px 6px', fontSize: 9, minWidth: 0 }} onClick={() => redoSection(sec)} disabled={!canRedoSec(sec)}>▶</TipBtn>
      <TipBtn tip="Empty this section" className="btn" style={{ padding: '2px 6px', fontSize: 8, minWidth: 0 }} onClick={() => emptySec(sec)}>🗑</TipBtn>
      {extra}
    </div>
  );

  // Filter cards
  const filteredCards = useMemo(() => {
    let result = AVAILABLE_CARDS;
    const f = filters;
    if (f.name) result = result.filter(c => c.name.toLowerCase().includes(f.name.toLowerCase()));
    if (f.effect) result = result.filter(c => c.effect && c.effect.toLowerCase().includes(f.effect.toLowerCase()));
    if (f.cardType) result = result.filter(c => c.cardType === f.cardType);
    if (f.subtype) result = result.filter(c => c.subtype === f.subtype);
    if (f.archetype) result = result.filter(c => c.archetype === f.archetype);
    if (f.sa1) result = result.filter(c => c.startingAbility1 === f.sa1);
    if (f.sa2) result = result.filter(c => c.startingAbility2 === f.sa2);
    if (f.ss1) result = result.filter(c => c.spellSchool1 === f.ss1);
    if (f.ss2) result = result.filter(c => c.spellSchool2 === f.ss2);
    if (f.level !== '') result = result.filter(c => c.level != null && c.level === parseInt(f.level));
    if (f.cost !== '') result = result.filter(c => c.cost != null && c.cost === parseInt(f.cost));
    if (f.hp !== '') result = result.filter(c => c.hp != null && c.hp === parseInt(f.hp));
    if (f.atk !== '') result = result.filter(c => c.atk != null && c.atk === parseInt(f.atk));
    return result;
  }, [filters]);

  const pageCount = Math.ceil(filteredCards.length / 20);
  const pageCards = filteredCards.slice(cardPage * 20, (cardPage + 1) * 20);
  useEffect(() => setCardPage(0), [filters]);

  const validation = currentDeck ? isDeckLegal(currentDeck) : { legal: false, reasons: [] };
  const hasUnsaved = currentDeck && unsaved[currentDeck.id];
  const heroes = currentDeck?.heroes || [{ hero:null,ability1:null,ability2:null },{ hero:null,ability1:null,ability2:null },{ hero:null,ability1:null,ability2:null }];

  const importFileRef = useRef(null);

  // ── Deck drag & drop (mouse-based) ──
  const [deckDrag, setDeckDrag] = useState(null); // { section, fromIdx, cardName, card, mouseX, mouseY }
  const [galleryDragOver, setGalleryDragOver] = useState(null); // { section, mouseX, mouseY } for HTML5 drag preview

  const onGalleryDragPos = useCallback((section, mx, my) => {
    if (!section) { setGalleryDragOver(null); return; }
    setGalleryDragOver({ section, mouseX: mx, mouseY: my });
  }, []);

  const onDeckCardMouseDown = useCallback((e, section, fromIdx, cardName) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    let dragging = false;

    const onMove = (me2) => {
      if (!dragging) {
        if (Math.abs(me2.clientX - startX) + Math.abs(me2.clientY - startY) < 5) return;
        dragging = true;
        deckDragState = { section, fromIdx, cardName };
      }
      setDeckDrag({ section, fromIdx, cardName, card: CARDS_BY_NAME[cardName], mouseX: me2.clientX, mouseY: me2.clientY });
    };

    const onUp = (me2) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (!dragging) { setDeckDrag(null); deckDragState = null; return; }

      // Find which section body the mouse is over
      const dropTarget = findDropTarget(me2.clientX, me2.clientY, section, fromIdx);
      if (dropTarget) {
        if (dropTarget.section === section && section !== 'hero') {
          // Same section reorder
          reorderInSection(section, fromIdx, dropTarget.idx);
        } else if (dropTarget.section === 'hero' && section === 'hero') {
          // Hero→Hero: swap slots
          swapHeroes(fromIdx, dropTarget.idx);
        } else if (dropTarget.section === 'hero') {
          // Other→Hero: move to specific slot
          handleDrop('hero', { cardName, fromSection: section, fromIndex: fromIdx, targetSlot: dropTarget.idx });
        } else {
          // Cross-section move with position
          handleDrop(dropTarget.section, { cardName, fromSection: section, fromIndex: fromIdx }, me2.clientX, me2.clientY);
        }
      } else {
        // Dropped outside any section — remove from deck
        removeFrom(cardName, section, fromIdx);
      }
      setDeckDrag(null);
      deckDragState = null;
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [currentDeck, reorderInSection, swapHeroes, handleDrop, removeFrom]);

  const findDropTarget = (mouseX, mouseY, fromSection, fromIdx) => {
    // Check hero slots first
    const heroSlots = document.querySelectorAll('[data-hero-slot]');
    for (const slotEl of heroSlots) {
      const rect = slotEl.getBoundingClientRect();
      if (mouseX >= rect.left && mouseX <= rect.right && mouseY >= rect.top && mouseY <= rect.bottom) {
        return { section: 'hero', idx: parseInt(slotEl.dataset.heroSlot, 10) };
      }
    }
    // Check each section body for the drop target
    const sections = document.querySelectorAll('[data-deck-section]');
    for (const secEl of sections) {
      const rect = secEl.getBoundingClientRect();
      if (mouseX >= rect.left && mouseX <= rect.right && mouseY >= rect.top && mouseY <= rect.bottom) {
        const targetSection = secEl.dataset.deckSection;
        if (targetSection === 'hero') continue; // Handled above by individual hero slots
        const slots = secEl.querySelectorAll('.deck-drag-slot');
        let targetIdx = slots.length;
        for (let i = 0; i < slots.length; i++) {
          const sr = slots[i].getBoundingClientRect();
          if (mouseX < sr.left + sr.width / 2 && mouseY < sr.bottom) { targetIdx = i; break; }
          if (mouseY < sr.top) { targetIdx = i; break; }
        }
        return { section: targetSection, idx: targetIdx };
      }
    }
    return null;
  };

  // Compute display array for a section — always returns exactly `capacity` items
  const SECTION_CAP = { main: 60, potion: 15, side: 15 };
  const padToCapacity = (items, capacity) => {
    while (items.length < capacity) items.push({ card: null, origIdx: -1, isGap: false, isEmpty: true });
    return items.slice(0, capacity);
  };
  const buildDeckDisplay = (section, cards) => {
    const cap = SECTION_CAP[section] || 60;
    const baseItems = () => padToCapacity(
      cards.map((c, i) => ({ card: c, origIdx: i, isGap: false, isEmpty: false })), cap
    );

    // Gallery HTML5 drag — show gap without removing any card
    if (galleryDragOver && !deckDrag) {
      if (galleryDragOver.section !== section) return baseItems();
      const dropTarget = findDropTarget(galleryDragOver.mouseX, galleryDragOver.mouseY, null, -1);
      const filled = cards.map((c, i) => ({ card: c, origIdx: i, isGap: false, isEmpty: false }));
      if (dropTarget && dropTarget.section === section) {
        filled.splice(Math.min(dropTarget.idx, filled.length), 0, { card: null, origIdx: -1, isGap: true, isEmpty: false });
      }
      return padToCapacity(filled, cap);
    }

    if (!deckDrag) return baseItems();

    // Source section — remove dragged card and insert gap at cursor
    if (deckDrag.section === section) {
      const dropTarget = findDropTarget(deckDrag.mouseX, deckDrag.mouseY, deckDrag.section, deckDrag.fromIdx);
      const filled = [];
      for (let i = 0; i < cards.length; i++) {
        if (i === deckDrag.fromIdx) continue;
        filled.push({ card: cards[i], origIdx: i, isGap: false, isEmpty: false });
      }
      if (dropTarget && dropTarget.section === section) {
        const insertAt = Math.min(dropTarget.idx > deckDrag.fromIdx ? dropTarget.idx - 1 : dropTarget.idx, filled.length);
        filled.splice(insertAt, 0, { card: null, origIdx: -1, isGap: true, isEmpty: false });
      }
      return padToCapacity(filled, cap);
    }

    // Target section (cross-section drag) — show gap without removing any card
    const dropTarget = findDropTarget(deckDrag.mouseX, deckDrag.mouseY, null, -1);
    if (dropTarget && dropTarget.section === section) {
      const filled = cards.map((c, i) => ({ card: c, origIdx: i, isGap: false, isEmpty: false }));
      filled.splice(Math.min(dropTarget.idx, filled.length), 0, { card: null, origIdx: -1, isGap: true, isEmpty: false });
      return padToCapacity(filled, cap);
    }

    return baseItems();
  };

  // ── Export deck to .txt ──
  const exportDeck = () => {
    if (!currentDeck) return;
    const lines = ['=== PIXEL PARTIES DECK ===', 'Name: ' + (currentDeck.name || 'Unnamed'), ''];

    // Heroes
    lines.push('== HEROES ==');
    (currentDeck.heroes || []).forEach(h => {
      lines.push(h && h.hero ? h.hero : '(empty)');
    });
    lines.push('');

    // Helper: group card names into "Nx Name" lines
    const groupCards = (arr) => {
      const counts = {};
      (arr || []).forEach(n => { counts[n] = (counts[n] || 0) + 1; });
      return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0])).map(([name, cnt]) => cnt + 'x ' + name);
    };

    lines.push('== MAIN DECK ==');
    groupCards(currentDeck.mainDeck).forEach(l => lines.push(l));
    lines.push('');

    lines.push('== POTION DECK ==');
    groupCards(currentDeck.potionDeck).forEach(l => lines.push(l));
    lines.push('');

    lines.push('== SIDE DECK ==');
    groupCards(currentDeck.sideDeck).forEach(l => lines.push(l));

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (currentDeck.name || 'deck').replace(/[^a-zA-Z0-9_\- ]/g, '') + '.txt';
    a.click();
    URL.revokeObjectURL(url);
    notify('Deck exported!', 'success');
  };

  // ── Import deck from .txt ──
  const importDeck = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Reset input so the same file can be re-imported
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const lines = text.split(/\r?\n/);

      // Validate header
      if (!lines[0] || !lines[0].includes('PIXEL PARTIES DECK')) {
        notify('Invalid deck file — missing header', 'error');
        return;
      }

      let section = null;
      const heroNames = [];
      const mainCards = [];
      const potionCards = [];
      const sideCards = [];
      const errors = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Section headers
        if (line === '== HEROES ==') { section = 'heroes'; continue; }
        if (line === '== MAIN DECK ==') { section = 'main'; continue; }
        if (line === '== POTION DECK ==') { section = 'potion'; continue; }
        if (line === '== SIDE DECK ==') { section = 'side'; continue; }
        if (line.startsWith('Name:') || line.startsWith('===')) continue;

        if (section === 'heroes') {
          if (line === '(empty)') { heroNames.push(null); }
          else if (CARDS_BY_NAME[line]) { heroNames.push(line); }
          else { errors.push('Unknown hero: ' + line); }
        } else if (section === 'main' || section === 'potion' || section === 'side') {
          const m = line.match(/^(\d+)x\s+(.+)$/);
          if (!m) { errors.push('Bad line: ' + line); continue; }
          const count = parseInt(m[1], 10);
          const name = m[2].trim();
          if (!CARDS_BY_NAME[name]) { errors.push('Unknown card: ' + name); continue; }
          const arr = section === 'main' ? mainCards : section === 'potion' ? potionCards : sideCards;
          for (let j = 0; j < count; j++) arr.push(name);
        }
      }

      if (errors.length > 0) {
        notify(errors.length + ' error(s): ' + errors.slice(0, 3).join('; ') + (errors.length > 3 ? '...' : ''), 'error');
        return;
      }

      // Build heroes array with auto-filled abilities
      const importedHeroes = [0, 1, 2].map(i => {
        const name = heroNames[i] || null;
        if (!name) return { hero: null, ability1: null, ability2: null };
        const card = CARDS_BY_NAME[name];
        return { hero: name, ability1: card?.startingAbility1 || null, ability2: card?.startingAbility2 || null };
      });

      // Apply all sections at once
      updateSections({
        heroes: importedHeroes,
        main: mainCards,
        potion: potionCards,
        side: sideCards
      });

      notify('Deck imported! (' + mainCards.length + ' main, ' + potionCards.length + ' potions, ' + sideCards.length + ' side)', 'success');
    };
    reader.readAsText(file);
  };

  if (!loaded) return <div className="screen-center"><div className="pixel-font" style={{ color: 'var(--accent)', animation: 'pulse 1.5s infinite' }}>Loading decks...</div></div>;

  return (
    <div className="screen-full">
      {/* ── TOP BAR ── */}
      <div className="top-bar">
        <button className="btn" style={{ padding: '4px 10px', fontSize: 9 }} onClick={() => setScreen('menu')}>← MENU</button>
        <h2 className="orbit-font" style={{ fontSize: 14, color: 'var(--accent)', margin: '0 8px' }}>DECK BUILDER</h2>
        <div style={{ flex: 1 }} />
        <button className={'btn' + (hasUnsaved ? ' btn-flash-save' : '')} style={{ padding: '4px 10px', fontSize: 9 }} onClick={saveCurrent} disabled={!hasUnsaved}>💾 SAVE</button>
        <button className="btn btn-accent2" style={{ padding: '4px 10px', fontSize: 9 }} onClick={saveAs}>SAVE AS</button>
        <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: 9 }} onClick={deleteDeck} disabled={decks.length <= 1}>🗑 DELETE</button>
        <button className="btn btn-success" style={{ padding: '4px 10px', fontSize: 9 }} onClick={setDefault}
          disabled={!validation.legal || currentDeck?.isDefault}
          title={!validation.legal ? validation.reasons.join(', ') : currentDeck?.isDefault ? 'Already default' : 'Set as default deck'}>
          {currentDeck?.isDefault ? '★ DEFAULT' : '☆ SET DEFAULT'}
        </button>
        <div style={{ width: 1, height: 20, background: 'var(--bg4)', margin: '0 4px' }} />
        <button className="btn" style={{ padding: '4px 10px', fontSize: 9 }} onClick={exportDeck} disabled={!currentDeck}>📤 EXPORT</button>
        <label className="btn" style={{ padding: '4px 10px', fontSize: 9, cursor: 'pointer' }}>
          📥 IMPORT<input ref={importFileRef} type="file" accept=".txt" onChange={importDeck} style={{ display: 'none' }} />
        </label>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* ── LEFT: DECK LIST ── */}
        <div style={{ width: 170, background: 'var(--bg2)', borderRight: '1px solid var(--bg4)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div className="orbit-font" style={{ padding: 8, fontSize: 10, color: 'var(--text2)', fontWeight: 700 }}>YOUR DECKS</div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {decks.map((d, i) => {
              const v = isDeckLegal(d); const hasChanges = unsaved[d.id];
              return (
                <div key={d.id} className={'deck-list-item' + (i === activeIdx ? ' active' : '')} onClick={() => setActiveIdx(i)}>
                  {d.isDefault && <span style={{ color: '#ffd700', fontSize: 10 }}>★</span>}
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}{hasChanges ? ' *' : ''}</span>
                  <span style={{ fontSize: 8, color: v.legal ? 'var(--success)' : 'var(--danger)' }}>{v.legal ? '✓' : '✗'}</span>
                </div>
              );
            })}
          </div>
          <button className="btn" style={{ margin: 8, padding: 6, fontSize: 10 }} onClick={async () => {
            try { const data = await api('/decks', { method: 'POST', body: JSON.stringify({ name: 'Deck ' + (decks.length + 1) }) }); setDecks([...decks, data.deck]); setActiveIdx(decks.length); } catch (e) { notify(e.message, 'error'); }
          }}>+ NEW DECK</button>
        </div>

        {/* ── CENTER: ALL DECK SECTIONS ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {/* Deck name + validation */}
          <div style={{ padding: '6px 12px', background: 'var(--bg3)', borderBottom: '1px solid var(--bg4)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {renaming ? (
              <div style={{ display: 'flex', gap: 4, flex: 1 }}>
                <input className="input" value={renameVal} onChange={e => setRenameVal(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') finishRename(); }} autoFocus style={{ flex: 1 }} />
                <button className="btn" style={{ padding: '2px 8px', fontSize: 9 }} onClick={finishRename}>OK</button>
              </div>
            ) : (
              <>
                <span className="orbit-font" style={{ fontWeight: 700, fontSize: 15 }}>{currentDeck?.name}</span>
                <button style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 12 }}
                  onClick={() => { setRenameVal(currentDeck?.name || ''); setRenaming(true); }}>✏️</button>
              </>
            )}
            <div style={{ flex: 1 }} />
            {!validation.legal && <div style={{ fontSize: 9, color: 'var(--danger)', maxWidth: 300, textAlign: 'right' }}>{validation.reasons.join(' · ')}</div>}
            {validation.legal && <span className="badge" style={{ background: 'rgba(51,255,136,.12)', color: 'var(--success)' }}>LEGAL</span>}
          </div>

          {/* Scrollable deck body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>

            {/* ── HEROES ── */}
            <DropSection sectionId="hero" onDrop={(d, mx, my) => {
              const dt = findDropTarget(mx, my, null, -1);
              const slot = dt && dt.section === 'hero' ? dt.idx : null;
              handleDrop('hero', { ...d, targetSlot: slot }, mx, my);
            }} onDragPos={onGalleryDragPos} className="deck-section">
              <SecHeader sec="heroes" color="#bb77ff" icon="👑" label="HEROES" count={heroes.filter(h=>h&&h.hero).length} max={3} />
              <div className="deck-section-body" data-deck-section="hero" style={{ display: 'flex', flexWrap: 'nowrap', justifyContent: 'space-evenly', gap: 40, padding: 12 }}>
                {heroes.map((h, i) => {
                  const isDropTarget = (() => {
                    if (galleryDragOver && galleryDragOver.section === 'hero') return true;
                    if (deckDrag) {
                      const dt = findDropTarget(deckDrag.mouseX, deckDrag.mouseY, null, -1);
                      return dt && dt.section === 'hero' && dt.idx === i;
                    }
                    return false;
                  })();
                  return (
                  <HeroSlot key={i} slotIndex={i} onSwap={swapHeroes}>
                    <div data-hero-slot={i} style={{ display: 'flex', flexDirection: 'row', gap: 6, alignItems: 'center', outline: isDropTarget ? '2px solid var(--accent)' : 'none', borderRadius: 4, padding: 4 }}>
                      {/* Hero card first (166×230) */}
                      {h && h.hero && CARDS_BY_NAME[h.hero] ? (
                        <div style={{ position: 'relative' }}
                          onMouseDown={(e) => onDeckCardMouseDown(e, 'hero', i, h.hero)}>
                          <CardMini card={CARDS_BY_NAME[h.hero]}
                            onClick={() => {}} onRightClick={() => removeFrom(h.hero, 'hero')}
                            style={{ width: 166, height: 230, aspectRatio: 'unset' }} />
                          <button style={{ position: 'absolute', top: -5, right: -5, background: 'var(--danger)', color: '#fff',
                            border: 'none', width: 18, height: 18, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                            onClick={() => removeFrom(h.hero, 'hero')}>✕</button>
                        </div>
                      ) : (
                        <div className="card-slot" style={{ width: 166, height: 230, aspectRatio: 'unset', fontSize: 12 }}><span>Hero {i + 1}</span></div>
                      )}
                      {/* Starting Abilities stacked vertically */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {[h?.ability1, h?.ability2].map((ab, ai) => {
                          const abCard = ab ? CARDS_BY_NAME[ab] : null;
                          if (abCard) return <CardMini key={ai} card={abCard} onClick={() => {}} style={{ width: 'var(--card-w)', height: 'var(--card-h)', aspectRatio: 'unset' }} />;
                          return (
                            <div key={ai} className="ability-slot" style={{ width: 'var(--card-w)', height: 'var(--card-h)', aspectRatio: 'unset', fontSize: 10, padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {ab ? <span style={{ color: '#ffff44' }}>{ab}</span> : <span style={{ color: 'var(--text2)' }}>Ability {ai + 1}</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </HeroSlot>
                  );
                })}
              </div>
            </DropSection>

            {/* ── MAIN DECK ── */}
            <DropSection sectionId="main" onDrop={(d, mx, my) => handleDrop('main', d, mx, my)} onDragPos={onGalleryDragPos} className="deck-section">
              <SecHeader sec="main" color="#44aaff" icon="📋" label="MAIN DECK" count={(currentDeck?.mainDeck||[]).length} max={60}
                extra={<><TipBtn tip="Shuffle" className="btn" style={{ padding:'2px 6px', fontSize:8 }} onClick={shuffleMain}>🔀</TipBtn><TipBtn tip="Sort" className="btn" style={{ padding:'2px 6px', fontSize:8 }} onClick={() => sortSec('main')}>↕</TipBtn></>} />
              <div className="deck-section-body" data-deck-section="main">
                {buildDeckDisplay('main', currentDeck?.mainDeck || []).map((item, idx) => {
                  if (item.isGap) return <div key={'gap-'+idx} className="deck-drag-gap" />;
                  if (item.isEmpty) return <div key={'empty-'+idx} className="deck-drag-slot deck-empty-slot"><div className="card-slot" style={{ width: '100%', height: '100%', fontSize: 9 }} /></div>;
                  const card = CARDS_BY_NAME[item.card]; if (!card) return null;
                  const isDragging = deckDrag && deckDrag.section === 'main' && deckDrag.fromIdx === item.origIdx;
                  return <div key={'m-'+item.origIdx} className={'deck-drag-slot' + (isDragging ? ' deck-dragging' : '')}
                    onMouseDown={(e) => onDeckCardMouseDown(e, 'main', item.origIdx, item.card)}>
                    <CardMini card={card} onClick={() => {}} onRightClick={() => removeFrom(item.card,'main',item.origIdx)} />
                  </div>;
                })}
              </div>
            </DropSection>

            {/* ── POTION DECK ── */}
            <DropSection sectionId="potion" onDrop={(d, mx, my) => handleDrop('potion', d, mx, my)} onDragPos={onGalleryDragPos} className="deck-section">
              <SecHeader sec="potion" color="#c8a060" icon="🧪" label="POTION DECK" count={(currentDeck?.potionDeck||[]).length} max={15} note="(0 or 5–15)"
                extra={<TipBtn tip="Sort" className="btn" style={{ padding:'2px 6px', fontSize:8 }} onClick={() => sortSec('potion')}>↕</TipBtn>} />
              <div className="deck-section-body" data-deck-section="potion">
                {buildDeckDisplay('potion', currentDeck?.potionDeck || []).map((item, idx) => {
                  if (item.isGap) return <div key={'gap-'+idx} className="deck-drag-gap" />;
                  if (item.isEmpty) return <div key={'empty-'+idx} className="deck-drag-slot deck-empty-slot"><div className="card-slot" style={{ width: '100%', height: '100%', fontSize: 9 }} /></div>;
                  const card = CARDS_BY_NAME[item.card]; if (!card) return null;
                  const isDragging = deckDrag && deckDrag.section === 'potion' && deckDrag.fromIdx === item.origIdx;
                  return <div key={'p-'+item.origIdx} className={'deck-drag-slot' + (isDragging ? ' deck-dragging' : '')}
                    onMouseDown={(e) => onDeckCardMouseDown(e, 'potion', item.origIdx, item.card)}>
                    <CardMini card={card} onClick={() => {}} onRightClick={() => removeFrom(item.card,'potion',item.origIdx)} />
                  </div>;
                })}
              </div>
            </DropSection>

            {/* ── SIDE DECK ── */}
            <DropSection sectionId="side" onDrop={(d, mx, my) => handleDrop('side', d, mx, my)} onDragPos={onGalleryDragPos} className="deck-section">
              <SecHeader sec="side" color="#888" icon="📦" label="SIDE DECK" count={(currentDeck?.sideDeck||[]).length} max={15}
                extra={<TipBtn tip="Sort" className="btn" style={{ padding:'2px 6px', fontSize:8 }} onClick={() => sortSec('side')}>↕</TipBtn>} />
              <div className="deck-section-body" data-deck-section="side">
                {buildDeckDisplay('side', currentDeck?.sideDeck || []).map((item, idx) => {
                  if (item.isGap) return <div key={'gap-'+idx} className="deck-drag-gap" />;
                  if (item.isEmpty) return <div key={'empty-'+idx} className="deck-drag-slot deck-empty-slot"><div className="card-slot" style={{ width: '100%', height: '100%', fontSize: 9 }} /></div>;
                  const card = CARDS_BY_NAME[item.card]; if (!card) return null;
                  const isDragging = deckDrag && deckDrag.section === 'side' && deckDrag.fromIdx === item.origIdx;
                  return <div key={'s-'+item.origIdx} className={'deck-drag-slot' + (isDragging ? ' deck-dragging' : '')}
                    onMouseDown={(e) => onDeckCardMouseDown(e, 'side', item.origIdx, item.card)}>
                    <CardMini card={card} onClick={() => {}} onRightClick={() => removeFrom(item.card,'side',item.origIdx)} />
                  </div>;
                })}
              </div>
            </DropSection>

          </div>
        </div>

        {/* ── RIGHT: CARD DATABASE ── */}
        <div style={{ width: 400, background: 'var(--bg2)', borderLeft: '1px solid var(--bg4)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div className="orbit-font" style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text2)', fontWeight: 700 }}>
            CARD DATABASE ({filteredCards.length} / {AVAILABLE_CARDS.length})
          </div>
          {/* Filters */}
          <div style={{ padding: '4px 8px 8px', borderBottom: '1px solid var(--bg4)', flexShrink: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
              <input className="db-filter-input" placeholder="Search name..." value={filters.name} onChange={e => setFilters(p => ({ ...p, name: e.target.value }))} style={{ gridColumn: '1/3' }} />
              <input className="db-filter-input" placeholder="Search effect text..." value={filters.effect} onChange={e => setFilters(p => ({ ...p, effect: e.target.value }))} style={{ gridColumn: '1/3' }} />
              <select className="db-filter-select" value={filters.cardType} onChange={e => setFilters(p => ({ ...p, cardType: e.target.value }))}><option value="">All Types</option>{CARD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
              <select className="db-filter-select" value={filters.subtype} onChange={e => setFilters(p => ({ ...p, subtype: e.target.value }))}><option value="">All Subtypes</option>{SUBTYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
              <select className="db-filter-select" value={filters.archetype} onChange={e => setFilters(p => ({ ...p, archetype: e.target.value }))} style={{ gridColumn: '1/3' }}><option value="">All Archetypes</option>{ARCHETYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
              <select className="db-filter-select" value={filters.ss1} onChange={e => setFilters(p => ({ ...p, ss1: e.target.value }))}><option value="">Spell School 1</option>{SPELL_SCHOOLS.map(t => <option key={t} value={t}>{t}</option>)}</select>
              <select className="db-filter-select" value={filters.ss2} onChange={e => setFilters(p => ({ ...p, ss2: e.target.value }))}><option value="">Spell School 2</option>{SPELL_SCHOOLS.map(t => <option key={t} value={t}>{t}</option>)}</select>
              <select className="db-filter-select" value={filters.sa1} onChange={e => setFilters(p => ({ ...p, sa1: e.target.value }))}><option value="">Starting Ability 1</option>{STARTING_ABILITIES.map(t => <option key={t} value={t}>{t}</option>)}</select>
              <select className="db-filter-select" value={filters.sa2} onChange={e => setFilters(p => ({ ...p, sa2: e.target.value }))}><option value="">Starting Ability 2</option>{STARTING_ABILITIES.map(t => <option key={t} value={t}>{t}</option>)}</select>
              <input className="db-filter-input" type="number" placeholder="Level" value={filters.level} onChange={e => setFilters(p => ({ ...p, level: e.target.value }))} />
              <input className="db-filter-input" type="number" placeholder="Cost" value={filters.cost} onChange={e => setFilters(p => ({ ...p, cost: e.target.value }))} />
              <input className="db-filter-input" type="number" placeholder="HP" value={filters.hp} onChange={e => setFilters(p => ({ ...p, hp: e.target.value }))} />
              <input className="db-filter-input" type="number" placeholder="ATK" value={filters.atk} onChange={e => setFilters(p => ({ ...p, atk: e.target.value }))} />
            </div>
            {(() => { const anyActive = Object.values(filters).some(v => v !== ''); return (
              <button className="btn" style={{ width: '100%', padding: 4, fontSize: 10, marginTop: 5 }} disabled={!anyActive}
                onClick={() => setFilters({ name:'',effect:'',cardType:'',subtype:'',archetype:'',sa1:'',sa2:'',ss1:'',ss2:'',level:'',cost:'',hp:'',atk:'' })}>CLEAR FILTERS</button>
            ); })()}
          </div>
          {/* Card grid */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 6 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
              {pageCards.map((card, i) => {
                const canMain = canAddCard(currentDeck || {}, card.name, 'main');
                const canHero = canAddCard(currentDeck || {}, card.name, 'hero');
                const canPotion = canAddCard(currentDeck || {}, card.name, 'potion');
                const canSide = canAddCard(currentDeck || {}, card.name, 'side');
                const canAny = canMain || canHero || canPotion || canSide;
                return (
                  <CardMini key={card.name + '-' + i} card={card} dimmed={!canAny}
                    onClick={(e) => showAddMenu(card.name, e)}
                    onRightClick={() => autoAdd(card.name)}
                    dragData={canAny ? { cardName: card.name } : null}
                    inGallery
                    style={{ width: '100%', height: 120 }} />
                );
              })}
            </div>
            {filteredCards.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text2)', fontSize: 12, padding: 20 }}>No cards match filters</div>}
          </div>
          {pageCount > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 6, borderTop: '1px solid var(--bg4)' }}>
              <button className="btn" style={{ padding: '2px 8px', fontSize: 9 }} onClick={() => setCardPage(p => Math.max(0, p - 1))} disabled={cardPage === 0}>◄</button>
              <span style={{ fontSize: 11, color: 'var(--text2)' }}>{cardPage + 1} / {pageCount}</span>
              <button className="btn" style={{ padding: '2px 8px', fontSize: 9 }} onClick={() => setCardPage(p => Math.min(pageCount - 1, p + 1))} disabled={cardPage >= pageCount - 1}>►</button>
            </div>
          )}
        </div>
      </div>

      {ctxMenu && <CtxMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxMenu.items} onClose={() => setCtxMenu(null)} />}

      {/* Floating deck drag card */}
      {deckDrag && deckDrag.card && (
        <div className="hand-floating-card" style={{ left: deckDrag.mouseX - 43, top: deckDrag.mouseY - 60 }}>
          <CardMini card={deckDrag.card} onClick={() => {}} />
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════
//  GAME BOARD
// ═══════════════════════════════════════════

function BoardCard({ cardName, faceDown, flipped, label, hp, maxHp, hpPosition, style, noTooltip }) {
  const [tt, setTT] = useState(false);
  const card = faceDown ? null : CARDS_BY_NAME[cardName];
  const imgUrl = card ? cardImageUrl(card.name) : null;

  // Foil support
  const foilType = card?.foil || null;
  const isFoil = foilType === 'secret_rare' || foilType === 'diamond_rare';
  const foilClass = foilType === 'diamond_rare' ? 'foil-diamond-rare' : foilType === 'secret_rare' ? 'foil-secret-rare' : '';
  const foilBands = useFoilBands(isFoil);
  const foilMeta = useRef(null);
  if (isFoil && !foilMeta.current) {
    foilMeta.current = {
      shimmerOffset: `${-Math.random() * 5000}ms`,
      sparkleDelays: SPARKLE_POSITIONS.map(sp => sp.delay + Math.random() * 2),
    };
  } else if (!isFoil && foilMeta.current) {
    foilMeta.current = null;
  }

  return (
    <div className={'board-card' + (faceDown ? ' face-down' : '') + (flipped ? ' flipped' : '') + (foilClass ? ' ' + foilClass : '')}
      style={style}
      onMouseEnter={() => !noTooltip && !faceDown && card && setTT(true)}
      onMouseLeave={() => setTT(false)}>
      {isFoil && foilMeta.current && <FoilOverlay bands={foilBands} shimmerOffset={foilMeta.current.shimmerOffset} sparkleDelays={foilMeta.current.sparkleDelays} foilType={foilType} />}
      {faceDown ? (
        <img src="/cardback.png" style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
      ) : imgUrl ? (
        <img src={imgUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
      ) : (
        <div className="board-card-text">{cardName || '?'}</div>
      )}
      {label && <div className="board-card-label">{label}</div>}
      {hp != null && hpPosition && (
        <div className={'board-card-hp board-card-hp-' + hpPosition}>
          {hp}
        </div>
      )}
      {tt && card && (
        <div className="board-tooltip">
          {imgUrl && (
            <div style={{ position: 'relative', width: '100%', flexShrink: 0 }}>
              <img src={imgUrl} style={{ width: '100%', aspectRatio: '750/1050', objectFit: 'cover', display: 'block',
                border: foilType === 'diamond_rare' ? '2px solid rgba(120,200,255,.6)' : foilType === 'secret_rare' ? '2px solid rgba(255,215,0,.5)' : 'none' }} />
              {isFoil && foilMeta.current && <FoilOverlay bands={foilBands} shimmerOffset={foilMeta.current.shimmerOffset} sparkleDelays={foilMeta.current.sparkleDelays} foilType={foilType} />}
            </div>
          )}
          <div style={{ padding: '10px 12px' }}>
            <div style={{ fontWeight: 700, fontSize: 18, color: typeColor(card.cardType), marginBottom: 5 }}>{card.name}</div>
            <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 8 }}>
              {card.cardType}{card.subtype ? ' · ' + card.subtype : ''}{card.archetype ? ' · ' + card.archetype : ''}
            </div>
            {card.effect && <div style={{ fontSize: 14, marginTop: 4, lineHeight: 1.5 }}>{card.effect}</div>}
            <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 8, display: 'flex', gap: 12 }}>
              {card.hp != null && <span style={{ color: '#ff6666' }}>♥ HP {card.hp}</span>}
              {card.atk != null && <span style={{ color: '#ffaa44' }}>⚔ ATK {card.atk}</span>}
              {card.cost != null && <span style={{ color: '#44aaff' }}>◆ Cost {card.cost}</span>}
              {card.level != null && <span>Lv{card.level}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BoardZone({ type, cards, label, faceDown, flipped, stackLabel, children, onClick, onHoverCard }) {
  const cls = 'board-zone board-zone-' + type;
  const topCardName = cards && cards.length > 0 && !faceDown ? cards[cards.length - 1] : null;
  const suppressChildTooltip = !!onClick && !!onHoverCard;
  return (
    <div className={cls + (onClick && cards?.length > 0 ? ' board-zone-clickable' : '')}
      onClick={onClick && cards?.length > 0 ? onClick : undefined}
      onMouseEnter={() => topCardName && onHoverCard && !activeDragData && !deckDragState && onHoverCard(topCardName)}
      onMouseLeave={() => onHoverCard && onHoverCard(null)}>
      {cards && cards.length > 0 ? (
        cards.length === 1 ? (
          <BoardCard cardName={cards[0]} faceDown={faceDown} flipped={flipped} label={stackLabel} noTooltip={suppressChildTooltip} />
        ) : (
          <div className="board-stack">
            <BoardCard cardName={cards[cards.length - 1]} faceDown={faceDown} flipped={flipped} label={stackLabel || (cards.length + '')} noTooltip={suppressChildTooltip} />
          </div>
        )
      ) : children || (
        <div className="board-zone-empty">{label || ''}</div>
      )}
    </div>
  );
}

// Floating damage number that finds its target hero and animates above it
function DamageNumber({ amount, heroName }) {
  const [pos, setPos] = useState(null);
  useEffect(() => {
    const el = document.querySelector(`[data-hero-name="${CSS.escape(heroName)}"]`);
    if (el) {
      const r = el.getBoundingClientRect();
      setPos({ x: r.left + r.width / 2, y: r.top + r.height * 0.3 });
    } else {
      setPos({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    }
  }, [heroName]);

  if (!pos) return null;
  return (
    <div className="damage-number" style={{ left: pos.x, top: pos.y }}>
      -{amount}
    </div>
  );
}

// Floating gold gain number
function GoldGainNumber({ amount, playerIdx, isMe }) {
  const [pos, setPos] = useState(null);
  useEffect(() => {
    const el = document.querySelector(`[data-gold-player="${playerIdx}"]`);
    if (el) {
      const r = el.getBoundingClientRect();
      // Player's gold: float upward from above. Opponent's gold: float downward from below.
      setPos({ x: r.left - 10, y: isMe ? r.top - 40 : r.bottom + 10, isMe });
    }
  }, [playerIdx]);

  if (!pos) return null;
  return (
    <div className={isMe ? 'gold-gain-number' : 'gold-gain-number gold-gain-down'} style={{ left: pos.x, top: pos.y }}>
      +{amount}
    </div>
  );
}

// ═══════════════════════════════════════════
//  MODULAR GAME ANIMATION SYSTEM
//  Add new animation types by adding to ANIM_REGISTRY.
//  Usage: playAnimation('explosion', '#target-selector', { duration: 800 })
// ═══════════════════════════════════════════

// Draggable floating panel — used for targeting dialogs, first-choice, etc.
function DraggablePanel({ children, className, style }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const offsetRef = useRef({ x: 0, y: 0 });
  const panelRef = useRef(null);
  const onDown = (e) => {
    if (e.target.tagName === 'BUTTON') return; // Don't drag when clicking buttons
    const r = panelRef.current?.getBoundingClientRect();
    if (!r) return;
    offsetRef.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    setDragging(true);
    e.preventDefault();
  };
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      setPos({ x: e.clientX - offsetRef.current.x, y: e.clientY - offsetRef.current.y });
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging]);
  const hasCustomPos = pos.x !== 0 || pos.y !== 0;
  const posStyle = hasCustomPos
    ? { position: 'fixed', left: pos.x, top: pos.y, transform: 'none' }
    : {};
  return (
    <div ref={panelRef} className={className} style={{ ...style, ...posStyle, cursor: dragging ? 'grabbing' : 'grab' }}
      onMouseDown={onDown}>
      {children}
    </div>
  );
}

// Frozen overlay with animated snowflake particles
function FrozenOverlay() {
  const particles = useMemo(() => Array.from({ length: 14 }, () => ({
    x: 5 + Math.random() * 90,
    y: 5 + Math.random() * 90,
    size: 5 + Math.random() * 7,
    delay: Math.random() * 3,
    dur: 1.5 + Math.random() * 2,
    char: ['❄','❅','❆','✦','✧','·','*'][Math.floor(Math.random() * 7)],
  })), []);
  return (
    <div className="status-frozen-overlay">
      {particles.map((p, i) => (
        <span key={i} className="frozen-particle" style={{
          left: p.x + '%', top: p.y + '%', fontSize: p.size,
          animationDelay: p.delay + 's', animationDuration: p.dur + 's',
        }}>{p.char}</span>
      ))}
    </div>
  );
}

// Immune/Shielded status icon with instant custom tooltip
function ImmuneIcon({ heroName, statusType }) {
  const tooltipKey = statusType === 'shielded' ? 'shielded' : 'immune';
  return (
    <div className={'status-immune-icon' + (statusType === 'shielded' ? ' status-shielded-icon' : '')}
      onMouseEnter={() => { window._immuneTooltip = heroName; window._immuneTooltipType = tooltipKey; window.dispatchEvent(new Event('immuneHover')); }}
      onMouseLeave={() => { window._immuneTooltip = null; window._immuneTooltipType = null; window.dispatchEvent(new Event('immuneHover')); }}>
      🛡️
    </div>
  );
}

// Card reveal — opponent's played card appears centered and expands/fades
function CardRevealOverlay({ cardName, onDone }) {
  const card = CARDS_BY_NAME[cardName];
  const imgUrl = card ? cardImageUrl(card.name) : null;
  const foilType = card?.foil || null;
  useEffect(() => {
    const t = setTimeout(onDone, 1900);
    return () => clearTimeout(t);
  }, []);
  if (!card) return null;
  return (
    <div className="card-reveal-overlay">
      <div className="card-reveal-card">
        {imgUrl ? (
          <img src={imgUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4,
            border: foilType === 'diamond_rare' ? '3px solid rgba(120,200,255,.7)' : foilType === 'secret_rare' ? '3px solid rgba(255,215,0,.6)' : '2px solid var(--bg4)' }} draggable={false} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg3)', borderRadius: 4, border: '2px solid var(--bg4)', padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: typeColor(card.cardType), marginBottom: 6 }}>{card.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>{card.cardType}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function ExplosionEffect({ x, y }) {
  const particles = useMemo(() => Array.from({ length: 24 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 25 + Math.random() * 55;
    return {
      dx: Math.cos(angle) * speed,
      dy: Math.sin(angle) * speed,
      size: 3 + Math.random() * 8,
      color: ['#ff4400','#ff8800','#ffcc00','#ff2200','#ffaa00','#fff'][Math.floor(Math.random() * 6)],
      delay: Math.random() * 80,
      dur: 350 + Math.random() * 400,
    };
  }), []);
  return (
    <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
      <div className="anim-explosion-flash" />
      {particles.map((p, i) => (
        <div key={i} className="anim-explosion-particle" style={{
          '--dx': p.dx + 'px', '--dy': p.dy + 'px', '--size': p.size + 'px',
          '--color': p.color, animationDelay: p.delay + 'ms', animationDuration: p.dur + 'ms',
        }} />
      ))}
    </div>
  );
}

function FreezeEffect({ x, y, w, h }) {
  // Snowballs from right side + ice crystal burst
  const snowballs = useMemo(() => Array.from({ length: 8 }, (_, i) => ({
    startX: 120 + Math.random() * 40,
    startY: -40 + Math.random() * 40,
    delay: i * 60 + Math.random() * 40,
    dur: 250 + Math.random() * 150,
    size: 6 + Math.random() * 6,
  })), []);
  const crystals = useMemo(() => Array.from({ length: 16 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 15 + Math.random() * 35;
    return {
      dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed,
      size: 3 + Math.random() * 7,
      color: ['#aaddff','#88ccff','#cceeFF','#ffffff','#66bbff'][Math.floor(Math.random() * 5)],
      delay: 400 + Math.random() * 200,
      dur: 400 + Math.random() * 300,
    };
  }), []);
  return (
    <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
      {/* Ice flash */}
      <div className="anim-freeze-flash" />
      {/* Snowballs from right */}
      {snowballs.map((s, i) => (
        <div key={'sb'+i} className="anim-snowball" style={{
          '--startX': s.startX + 'px', '--startY': s.startY + 'px',
          '--size': s.size + 'px',
          animationDelay: s.delay + 'ms', animationDuration: s.dur + 'ms',
        }} />
      ))}
      {/* Ice crystal particles */}
      {crystals.map((c, i) => (
        <div key={'cr'+i} className="anim-explosion-particle" style={{
          '--dx': c.dx + 'px', '--dy': c.dy + 'px', '--size': c.size + 'px',
          '--color': c.color, animationDelay: c.delay + 'ms', animationDuration: c.dur + 'ms',
        }} />
      ))}
    </div>
  );
}

function ThawEffect({ x, y }) {
  const drips = useMemo(() => Array.from({ length: 12 }, () => ({
    xOff: -20 + Math.random() * 40,
    speed: 30 + Math.random() * 50,
    size: 3 + Math.random() * 5,
    delay: Math.random() * 300,
    dur: 500 + Math.random() * 400,
    color: ['#aaddff','#88ccff','#cceeFF','#ddf4ff'][Math.floor(Math.random() * 4)],
  })), []);
  return (
    <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
      <div className="anim-thaw-flash" />
      {drips.map((d, i) => (
        <div key={i} className="anim-thaw-drip" style={{
          '--xOff': d.xOff + 'px', '--speed': d.speed + 'px', '--size': d.size + 'px',
          '--color': d.color, animationDelay: d.delay + 'ms', animationDuration: d.dur + 'ms',
        }} />
      ))}
    </div>
  );
}

// Electric strike — small lightning bolts from all directions converging on target
function ElectricStrikeEffect({ x, y }) {
  const bolts = useMemo(() => Array.from({ length: 16 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const dist = 55 + Math.random() * 45;
    return {
      startX: Math.cos(angle) * dist,
      startY: Math.sin(angle) * dist,
      size: 8 + Math.random() * 10,
      delay: Math.random() * 200,
      dur: 150 + Math.random() * 150,
      rotation: (angle * 180 / Math.PI) + 180, // Point toward center
    };
  }), []);
  const sparks = useMemo(() => Array.from({ length: 14 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 12 + Math.random() * 30;
    return {
      dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed,
      size: 2 + Math.random() * 5,
      color: ['#ffe033','#fff','#ffcc00','#ffffaa','#ffd700'][Math.floor(Math.random() * 5)],
      delay: 250 + Math.random() * 150,
      dur: 250 + Math.random() * 250,
    };
  }), []);
  return (
    <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
      <div className="anim-electric-flash" />
      {bolts.map((b, i) => (
        <div key={'eb'+i} className="anim-electric-bolt" style={{
          '--startX': b.startX + 'px', '--startY': b.startY + 'px', '--size': b.size + 'px',
          '--rotation': b.rotation + 'deg',
          animationDelay: b.delay + 'ms', animationDuration: b.dur + 'ms',
        }}>⚡</div>
      ))}
      {sparks.map((s, i) => (
        <div key={'es'+i} className="anim-explosion-particle" style={{
          '--dx': s.dx + 'px', '--dy': s.dy + 'px', '--size': s.size + 'px',
          '--color': s.color, animationDelay: s.delay + 'ms', animationDuration: s.dur + 'ms',
        }} />
      ))}
    </div>
  );
}

// Negated overlay — persistent small electricity sparks on the hero
function NegatedOverlay() {
  const sparks = useMemo(() => Array.from({ length: 10 }, () => ({
    x: 8 + Math.random() * 84,
    y: 8 + Math.random() * 84,
    size: 7 + Math.random() * 6,
    delay: Math.random() * 2,
    dur: 0.4 + Math.random() * 0.6,
  })), []);
  return (
    <div className="status-negated-overlay">
      {sparks.map((s, i) => (
        <span key={i} className="negated-spark" style={{
          left: s.x + '%', top: s.y + '%', fontSize: s.size,
          animationDelay: s.delay + 's', animationDuration: s.dur + 's',
        }}>⚡</span>
      ))}
    </div>
  );
}

// Flame strike — fire converging from all directions onto target
function FlameStrikeEffect({ x, y }) {
  const flames = useMemo(() => Array.from({ length: 18 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const dist = 55 + Math.random() * 45;
    return {
      startX: Math.cos(angle) * dist,
      startY: Math.sin(angle) * dist,
      size: 10 + Math.random() * 12,
      delay: Math.random() * 180,
      dur: 200 + Math.random() * 150,
      char: ['🔥','🔥','🔥','✦','·'][Math.floor(Math.random() * 5)],
    };
  }), []);
  const sparks = useMemo(() => Array.from({ length: 12 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 15 + Math.random() * 30;
    return {
      dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed,
      size: 2 + Math.random() * 5,
      color: ['#ff4400','#ff8800','#ffcc00','#ff2200','#ffaa00'][Math.floor(Math.random() * 5)],
      delay: 300 + Math.random() * 150,
      dur: 300 + Math.random() * 250,
    };
  }), []);
  return (
    <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
      <div className="anim-flame-flash" />
      {flames.map((f, i) => (
        <div key={'fl'+i} className="anim-flame-shard" style={{
          '--startX': f.startX + 'px', '--startY': f.startY + 'px', '--size': f.size + 'px',
          animationDelay: f.delay + 'ms', animationDuration: f.dur + 'ms',
        }}>{f.char}</div>
      ))}
      {sparks.map((s, i) => (
        <div key={'fs'+i} className="anim-explosion-particle" style={{
          '--dx': s.dx + 'px', '--dy': s.dy + 'px', '--size': s.size + 'px',
          '--color': s.color, animationDelay: s.delay + 'ms', animationDuration: s.dur + 'ms',
        }} />
      ))}
    </div>
  );
}

// Burned overlay — persistent small flame particles on the hero
function BurnedOverlay({ ticking }) {
  const flames = useMemo(() => Array.from({ length: 10 }, () => ({
    x: 8 + Math.random() * 84,
    y: 15 + Math.random() * 70,
    size: 8 + Math.random() * 6,
    delay: Math.random() * 2,
    dur: 0.6 + Math.random() * 0.6,
  })), []);
  return (
    <div className={'status-burned-overlay' + (ticking ? ' burn-ticking' : '')}>
      {flames.map((f, i) => (
        <span key={i} className="burned-particle" style={{
          left: f.x + '%', top: f.y + '%', fontSize: f.size,
          animationDelay: f.delay + 's', animationDuration: f.dur + 's',
        }}>🔥</span>
      ))}
    </div>
  );
}

const ANIM_REGISTRY = {
  explosion: ExplosionEffect,
  freeze: FreezeEffect,
  ice_encase: IceEncaseEffect,
  electric_strike: ElectricStrikeEffect,
  flame_strike: FlameStrikeEffect,
  thaw: ThawEffect,
};

function IceEncaseEffect({ x, y }) {
  // Ice shards from ALL sides converging on target
  const shards = useMemo(() => Array.from({ length: 20 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 40;
    return {
      startX: Math.cos(angle) * dist,
      startY: Math.sin(angle) * dist,
      size: 4 + Math.random() * 8,
      delay: Math.random() * 150,
      dur: 200 + Math.random() * 200,
      char: ['❄','❅','❆','✦','·'][Math.floor(Math.random() * 5)],
    };
  }), []);
  const burstCrystals = useMemo(() => Array.from({ length: 12 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 10 + Math.random() * 25;
    return {
      dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed,
      size: 3 + Math.random() * 6,
      color: ['#aaddff','#88ccff','#cceeFF','#fff','#ddeeff'][Math.floor(Math.random() * 5)],
      delay: 350 + Math.random() * 100,
      dur: 300 + Math.random() * 200,
    };
  }), []);
  return (
    <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
      <div className="anim-freeze-flash" style={{ animationDelay: '300ms' }} />
      {shards.map((s, i) => (
        <div key={'sh'+i} className="anim-ice-shard" style={{
          '--startX': s.startX + 'px', '--startY': s.startY + 'px', '--size': s.size + 'px',
          animationDelay: s.delay + 'ms', animationDuration: s.dur + 'ms',
        }}>{s.char}</div>
      ))}
      {burstCrystals.map((c, i) => (
        <div key={'bc'+i} className="anim-explosion-particle" style={{
          '--dx': c.dx + 'px', '--dy': c.dy + 'px', '--size': c.size + 'px',
          '--color': c.color, animationDelay: c.delay + 'ms', animationDuration: c.dur + 'ms',
        }} />
      ))}
    </div>
  );
}

function GameAnimationRenderer({ type, x, y, w, h }) {
  const Component = ANIM_REGISTRY[type];
  if (!Component) return null;
  return <Component x={x} y={y} w={w} h={h} />;
}

// Renders an ability zone stack — handles Performance visual transformation
function AbilityStack({ cards }) {
  const [hovered, setHovered] = useState(false);
  // Check if top card is Performance — if so, display the ability below it
  const topCard = cards[cards.length - 1];
  const isTopPerformance = topCard === 'Performance';
  const displayName = isTopPerformance && cards.length > 1 ? cards[cards.length - 2] : topCard;

  return (
    <div className="board-ability-stack"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {cards.map((c, ci) => {
        // When top is Performance: show the underlying ability image for Performance cards,
        // but on hover, show the actual Performance card
        let showName = c;
        if (c === 'Performance' && !hovered && ci > 0) {
          // Not hovered: Performance looks like the ability below
          showName = cards.find(x => x !== 'Performance') || c;
        }
        return (
          <div key={ci} className="board-ability-stack-card" style={{ top: ci * 5 }}>
            <BoardCard cardName={hovered && ci === cards.length - 1 && isTopPerformance ? 'Performance' : showName} />
          </div>
        );
      })}
      {cards.length > 1 && <div className="board-card-label">{cards.length}</div>}
    </div>
  );
}

function GameBoard({ gameState, lobby, onLeave }) {
  const { user, notify } = useContext(AppContext);
  const myIdx = gameState.myIndex;
  const oppIdx = myIdx === 0 ? 1 : 0;
  const me = gameState.players[myIdx];
  const opp = gameState.players[oppIdx];
  const result = gameState.result;
  const iWon = result && result.winnerIdx === myIdx;
  const oppLeft = opp.left || false;
  const oppDisconnected = opp.disconnected || false;
  const myRematchSent = (gameState.rematchRequests || []).includes(user.id);

  // Local hand state for reordering
  const [hand, setHand] = useState(me.hand || []);
  const handKeyRef = useRef(JSON.stringify(me.hand || []));
  useEffect(() => {
    const newKey = JSON.stringify(me.hand || []);
    if (newKey !== handKeyRef.current) {
      handKeyRef.current = newKey;
      setHand(me.hand || []);
    }
  }, [me.hand]);

  // Phase helpers
  const currentPhase = gameState.currentPhase || 0;
  const activePlayer = gameState.activePlayer || 0;
  const isMyTurn = activePlayer === myIdx;
  const activePlayerData = gameState.players[activePlayer];
  const phaseColor = activePlayerData?.color || 'var(--accent)';

  // Card graying logic based on phase
  const ACTION_TYPES = ['Attack', 'Spell', 'Creature'];
  const getCardDimmed = (cardName) => {
    if (gameState.awaitingFirstChoice) return false; // Let player see hand clearly
    if (gameState.potionTargeting) return true; // All cards dimmed during targeting
    if (!isMyTurn) return true;
    const card = CARDS_BY_NAME[cardName];
    if (!card) return false;
    const isActionType = ACTION_TYPES.includes(card.cardType);
    if (currentPhase === 2 || currentPhase === 4) {
      // Main Phase 1 or 2: gray out action types
      if (isActionType) return true;
      // Gray out Abilities that can't be played on any hero
      if (card.cardType === 'Ability') {
        const canPlaySomewhere = [0,1,2].some(hi => canHeroReceiveAbility(me, hi, cardName));
        if (!canPlaySomewhere) return true;
      }
      // Gray out Artifacts if not enough gold
      if (card.cardType === 'Artifact') {
        if ((me.gold || 0) < (card.cost || 0)) return true;
        // Gray out Equip artifacts if no hero has a free base support zone
        const isEquip = (card.subtype || '').toLowerCase() === 'equipment';
        if (isEquip) {
          const hasTarget = [0,1,2].some(hi => {
            const hero = me.heroes[hi];
            if (!hero || !hero.name || hero.hp <= 0) return false;
            if (hero.statuses?.frozen) return false; // Can't equip to frozen heroes
            const supZones = me.supportZones[hi] || [];
            for (let z = 0; z < 3; z++) { if ((supZones[z] || []).length === 0) return true; }
            return false;
          });
          if (!hasTarget) return true;
        }
        // Gray out targeting artifacts/potions with no valid targets
        if ((gameState.unactivatableArtifacts || []).includes(cardName)) return true;
      }
      // Gray out Potions with no valid targets
      if (card.cardType === 'Potion') {
        if ((gameState.unactivatableArtifacts || []).includes(cardName)) return true;
      }
      return false;
    } else if (currentPhase === 3) {
      // Action Phase: gray out non-action types, and summon-blocked creatures
      if (!isActionType) return true;
      if (card.cardType === 'Creature' && (gameState.summonBlocked || []).includes(cardName)) return true;
      return false;
    }
    return true; // Start, Resource, End phases: all dimmed
  };

  // Mouse-based drag state (reorder)
  const [handDrag, setHandDrag] = useState(null);
  const handRef = useRef(null);

  // Play-mode drag state (Action Phase — dragging to board)
  const [playDrag, setPlayDrag] = useState(null);

  // Ability drag state (Main Phases — dragging ability to hero/zone)
  const [abilityDrag, setAbilityDrag] = useState(null); // { idx, cardName, card, mouseX, mouseY, targetHero, targetZone }

  // Check if a hero can receive a specific ability
  const canHeroReceiveAbility = (playerData, heroIdx, abilityName) => {
    const hero = playerData.heroes[heroIdx];
    if (!hero || !hero.name || hero.hp <= 0) return false;
    if ((playerData.abilityGivenThisTurn || [])[heroIdx]) return false;
    const abZones = playerData.abilityZones[heroIdx] || [[], [], []];
    const isCustom = (gameState.customPlacementCards || []).includes(abilityName);

    if (isCustom) {
      // Custom placement (e.g. Performance): needs any occupied zone with <3 cards
      return abZones.some(slot => (slot || []).length > 0 && (slot || []).length < 3);
    }

    // Standard: check if hero already has this ability
    for (const slot of abZones) {
      if ((slot || []).length > 0 && slot[0] === abilityName) {
        return slot.length < 3;
      }
    }
    // Doesn't have it — needs a free zone
    return abZones.some(slot => (slot || []).length === 0);
  };

  // Check if a hero can play a card (spell school + level check)
  const canHeroPlayCard = (playerData, heroIdx, card) => {
    const hero = playerData.heroes[heroIdx];
    if (!hero || !hero.name || hero.hp <= 0) return false;
    const level = card.level || 0;
    if (level === 0 && !card.spellSchool1) return true; // No requirements
    const abZones = playerData.abilityZones[heroIdx] || [];
    const countAbility = (school) => {
      let count = 0;
      for (const slot of abZones) {
        for (const abName of (slot || [])) { if (abName === school) count++; }
      }
      return count;
    };
    if (card.spellSchool1 && countAbility(card.spellSchool1) < level) return false;
    if (card.spellSchool2 && countAbility(card.spellSchool2) < level) return false;
    return true;
  };

  // Find free support zone slot for a hero
  const findFreeSupportSlot = (playerData, heroIdx) => {
    const supZones = playerData.supportZones[heroIdx] || [[], [], []];
    for (let s = 0; s < supZones.length; s++) {
      if (!supZones[s] || supZones[s].length === 0) return s;
    }
    return -1;
  };

  // Game start announcement + turn change announcements
  const [announcement, setAnnouncement] = useState(() => {
    if (gameState.reconnected || gameState.awaitingFirstChoice) return null;
    const goesFirst = (gameState.activePlayer || 0) === myIdx;
    return { text: goesFirst ? 'YOU GO FIRST!' : 'YOU GO SECOND!', color: goesFirst ? 'var(--success)' : 'var(--accent)' };
  });
  const prevTurnRef = useRef(gameState.turn);
  useEffect(() => {
    if (announcement) {
      const duration = announcement.short ? 2000 : 3500;
      const t = setTimeout(() => setAnnouncement(null), duration);
      return () => clearTimeout(t);
    }
  }, [announcement]);
  // Detect turn changes — but not during awaitingFirstChoice
  useEffect(() => {
    if (gameState.awaitingFirstChoice) { prevTurnRef.current = gameState.turn; return; }
    if (gameState.turn !== prevTurnRef.current) {
      prevTurnRef.current = gameState.turn;
      if ((gameState.activePlayer || 0) === myIdx) {
        setAnnouncement({ text: 'YOUR TURN!', color: 'var(--success)', short: true });
      }
    }
  }, [gameState.turn, gameState.awaitingFirstChoice]);

  const onHandMouseDown = (e, idx) => {
    if (e.button !== 0) return;
    const cardName = hand[idx];
    const dimmed = getCardDimmed(cardName);
    if (dimmed) return; // Don't drag dimmed cards

    e.preventDefault();
    const card = CARDS_BY_NAME[cardName];
    const isPlayable = isMyTurn && currentPhase === 3 && card && ACTION_TYPES.includes(card.cardType)
      && !(card.cardType === 'Creature' && (gameState.summonBlocked || []).includes(cardName));
    const isAbilityPlayable = isMyTurn && (currentPhase === 2 || currentPhase === 4) && card && card.cardType === 'Ability';
    const isEquipPlayable = isMyTurn && (currentPhase === 2 || currentPhase === 4) && card && card.cardType === 'Artifact'
      && (card.subtype || '').toLowerCase() === 'equipment' && (me.gold || 0) >= (card.cost || 0);
    const startX = e.clientX, startY = e.clientY;
    let dragging = false;

    const onMove = (me2) => {
      if (!dragging) {
        if (Math.abs(me2.clientX - startX) + Math.abs(me2.clientY - startY) < 5) return;
        dragging = true;
      }

      if (isAbilityPlayable) {
        // Ability play-mode drag — find valid hero/zone target
        let targetHero = -1, targetZone = -1;
        // Check hero zones
        const heroEls = document.querySelectorAll('[data-hero-zone]');
        for (const el of heroEls) {
          const r = el.getBoundingClientRect();
          if (me2.clientX >= r.left && me2.clientX <= r.right && me2.clientY >= r.top && me2.clientY <= r.bottom) {
            if (el.dataset.heroOwner === 'me') {
              const hi = parseInt(el.dataset.heroIdx);
              if (canHeroReceiveAbility(me, hi, cardName)) { targetHero = hi; targetZone = -1; }
            }
          }
        }
        // Check ability zones (more specific target)
        if (targetHero < 0) {
          const abEls = document.querySelectorAll('[data-ability-zone]');
          for (const el of abEls) {
            const r = el.getBoundingClientRect();
            if (me2.clientX >= r.left && me2.clientX <= r.right && me2.clientY >= r.top && me2.clientY <= r.bottom) {
              if (el.dataset.abilityOwner === 'me') {
                const hi = parseInt(el.dataset.abilityHero);
                const zi = parseInt(el.dataset.abilitySlot);
                if (canHeroReceiveAbility(me, hi, cardName)) {
                  const abSlot = (me.abilityZones[hi] || [])[zi] || [];
                  const isCustom = (gameState.customPlacementCards || []).includes(cardName);

                  if (isCustom) {
                    // Custom placement: occupied zones with <3 cards
                    if (abSlot.length > 0 && abSlot.length < 3) { targetHero = hi; targetZone = zi; }
                  } else {
                    // Standard: only matching or empty zones
                    const existingZone = ((me.abilityZones[hi] || []).findIndex(s => (s||[]).length > 0 && s[0] === cardName));
                    if (existingZone >= 0) {
                      if (zi === existingZone && abSlot.length < 3) { targetHero = hi; targetZone = zi; }
                    } else {
                      if (abSlot.length === 0) { targetHero = hi; targetZone = zi; }
                    }
                  }
                }
              }
            }
          }
        }
        setAbilityDrag({ idx, cardName, card, mouseX: me2.clientX, mouseY: me2.clientY, targetHero, targetZone });
      } else if (isPlayable && card.cardType === 'Creature') {
        // Play-mode drag — find valid drop target
        let targetHero = -1, targetSlot = -1;
        const els = document.querySelectorAll('[data-support-zone]');
        for (const el of els) {
          const r = el.getBoundingClientRect();
          if (me2.clientX >= r.left && me2.clientX <= r.right && me2.clientY >= r.top && me2.clientY <= r.bottom) {
            const hi = parseInt(el.dataset.supportHero);
            const si = parseInt(el.dataset.supportSlot);
            const isOwn = el.dataset.supportOwner === 'me';
            if (isOwn && canHeroPlayCard(me, hi, card) && findFreeSupportSlot(me, hi) >= 0) {
              // Check this specific slot is free (base or island zones OK for creatures)
              const slotCards = (me.supportZones[hi] || [])[si] || [];
              if (slotCards.length === 0 && si < ((me.supportZones[hi] || []).length || 3)) { targetHero = hi; targetSlot = si; }
            }
          }
        }
        setPlayDrag({ idx, cardName, card, mouseX: me2.clientX, mouseY: me2.clientY, targetHero, targetSlot });
      } else if (isEquipPlayable) {
        // Equip artifact drag — can drop on support zones OR heroes
        let targetHero = -1, targetSlot = -1;
        // Check hero zones first (auto-place in first free base support zone)
        const heroEls = document.querySelectorAll('[data-hero-zone]');
        for (const el of heroEls) {
          const r = el.getBoundingClientRect();
          if (me2.clientX >= r.left && me2.clientX <= r.right && me2.clientY >= r.top && me2.clientY <= r.bottom) {
            if (el.dataset.heroOwner === 'me') {
              const hi = parseInt(el.dataset.heroIdx);
              const hero = me.heroes[hi];
              if (hero && hero.name && hero.hp > 0) {
                // Check for a free base support zone (indices 0-2 only)
                const supZones = me.supportZones[hi] || [];
                for (let z = 0; z < 3; z++) {
                  if ((supZones[z] || []).length === 0) { targetHero = hi; targetSlot = -1; break; }
                }
              }
            }
          }
        }
        // Check support zones (specific placement)
        if (targetHero < 0) {
          const els = document.querySelectorAll('[data-support-zone]');
          for (const el of els) {
            const r = el.getBoundingClientRect();
            if (me2.clientX >= r.left && me2.clientX <= r.right && me2.clientY >= r.top && me2.clientY <= r.bottom) {
              const hi = parseInt(el.dataset.supportHero);
              const si = parseInt(el.dataset.supportSlot);
              const isOwn = el.dataset.supportOwner === 'me';
              const isIsland = el.dataset.supportIsland === 'true';
              if (isOwn && !isIsland && si < 3) { // Can only equip to base zones
                const hero = me.heroes[hi];
                if (hero && hero.name && hero.hp > 0) {
                  const slotCards = (me.supportZones[hi] || [])[si] || [];
                  if (slotCards.length === 0) { targetHero = hi; targetSlot = si; }
                }
              }
            }
          }
        }
        setPlayDrag({ idx, cardName, card, mouseX: me2.clientX, mouseY: me2.clientY, targetHero, targetSlot, isEquip: true });
      } else {
        setHandDrag({ idx, cardName, mouseX: me2.clientX, mouseY: me2.clientY });
      }
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);

      if (!dragging) {
        // Click (no drag) — check for potion or non-equip artifact activation
        if (isMyTurn && (currentPhase === 2 || currentPhase === 4) && card && !getCardDimmed(cardName)) {
          if (card.cardType === 'Potion') {
            socket.emit('use_potion', { roomId: gameState.roomId, cardName, handIndex: idx });
          } else if (card.cardType === 'Artifact' && (card.subtype || '').toLowerCase() !== 'equipment') {
            socket.emit('use_artifact_effect', { roomId: gameState.roomId, cardName, handIndex: idx });
          }
        }
        setHandDrag(null); setPlayDrag(null); setAbilityDrag(null); return;
      }

      if (isAbilityPlayable) {
        setAbilityDrag(prev => {
          if (!prev || prev.targetHero < 0) return null;
          socket.emit('play_ability', {
            roomId: gameState.roomId,
            cardName: prev.cardName,
            handIndex: prev.idx,
            heroIdx: prev.targetHero,
            zoneSlot: prev.targetZone,
          });
          return null;
        });
      } else if (isPlayable && card.cardType === 'Creature') {
        setPlayDrag(prev => {
          if (!prev || prev.targetHero < 0 || prev.targetSlot < 0) return null;
          socket.emit('play_creature', {
            roomId: gameState.roomId,
            cardName: prev.cardName,
            handIndex: prev.idx,
            heroIdx: prev.targetHero,
            zoneSlot: prev.targetSlot,
          });
          return null;
        });
      } else if (isEquipPlayable) {
        setPlayDrag(prev => {
          if (!prev || prev.targetHero < 0) return null;
          socket.emit('play_artifact', {
            roomId: gameState.roomId,
            cardName: prev.cardName,
            handIndex: prev.idx,
            heroIdx: prev.targetHero,
            zoneSlot: prev.targetSlot, // -1 means auto-place
          });
          return null;
        });
      } else {
        setHandDrag(prev => {
          if (!prev) return null;
          const newHand = [...hand];
          newHand.splice(prev.idx, 1);
          const dropIdx = calcDropIdx(prev.mouseX, prev.idx);
          newHand.splice(dropIdx, 0, prev.cardName);
          setHand(newHand);
          socket.emit('reorder_hand', { roomId: gameState.roomId, hand: newHand });
          return null;
        });
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const calcDropIdx = (mouseX, excludeIdx) => {
    if (!handRef.current) return 0;
    const slots = handRef.current.querySelectorAll('.hand-slot:not(.hand-dragging)');
    let targetIdx = slots.length;
    for (let i = 0; i < slots.length; i++) {
      const r = slots[i].getBoundingClientRect();
      if (mouseX < r.left + r.width / 2) { targetIdx = i; break; }
    }
    // Adjust for the removed card
    if (excludeIdx <= targetIdx) return targetIdx;
    return targetIdx;
  };

  // Build display hand with gap
  const displayHand = useMemo(() => {
    const dragIdx = handDrag?.idx ?? playDrag?.idx ?? abilityDrag?.idx ?? null;
    if (dragIdx === null) return hand.map((c, i) => ({ card: c, origIdx: i, isGap: false }));
    const filtered = [];
    for (let i = 0; i < hand.length; i++) {
      if (i === dragIdx) continue;
      filtered.push({ card: hand[i], origIdx: i, isGap: false });
    }
    // Only show gap for reorder drag, not play drag
    if (handDrag) {
      const dropIdx = calcDropIdx(handDrag.mouseX, handDrag.idx);
      filtered.splice(dropIdx, 0, { card: null, origIdx: -1, isGap: true });
    }
    return filtered;
  }, [hand, handDrag, playDrag]);

  const [showSurrender, setShowSurrender] = useState(false);
  const [showFirstChoice, setShowFirstChoice] = useState(false);
  const [deckViewer, setDeckViewer] = useState(null); // 'deck' | 'potion' | null
  const [pileViewer, setPileViewer] = useState(null); // { title, cards } | null
  const [hoveredPileCard, setHoveredPileCard] = useState(null); // card name for pile tooltip
  const [immuneTooltip, setImmuneTooltip] = useState(null); // hero name for immune tooltip
  const [immuneTooltipType, setImmuneTooltipType] = useState(null); // 'immune' or 'shielded'

  // Listen for immune icon hover (uses window event to escape component boundaries)
  useEffect(() => {
    const onHover = () => {
      setImmuneTooltip(window._immuneTooltip || null);
      setImmuneTooltipType(window._immuneTooltipType || null);
    };
    window.addEventListener('immuneHover', onHover);
    return () => window.removeEventListener('immuneHover', onHover);
  }, []);
  const [potionSelection, setPotionSelection] = useState([]); // Selected target IDs during potion targeting
  const [explosions, setExplosions] = useState([]); // Target IDs currently showing explosion
  const [gameAnims, setGameAnims] = useState([]); // Active particle animations
  const [cardReveal, setCardReveal] = useState(null); // Card name being revealed
  const [summonGlow, setSummonGlow] = useState(null); // { owner, heroIdx, zoneSlot }
  const [oppTargetHighlight, setOppTargetHighlight] = useState([]); // Target IDs highlighted on opponent's screen
  const [burnTickingHeroes, setBurnTickingHeroes] = useState([]); // Hero keys ('pi-hi') currently showing burn escalation

  // Listen for opponent card reveal
  useEffect(() => {
    const onReveal = ({ cardName }) => setCardReveal(cardName);
    const onSummon = ({ owner, heroIdx, zoneSlot, cardName }) => {
      setSummonGlow({ owner, heroIdx, zoneSlot });
      setTimeout(() => setSummonGlow(null), 1200);
    };
    const onBurnTick = ({ heroes }) => {
      const keys = heroes.map(h => `${h.owner}-${h.heroIdx}`);
      setBurnTickingHeroes(keys);
      setTimeout(() => setBurnTickingHeroes([]), 1500);
    };
    socket.on('card_reveal', onReveal);
    socket.on('summon_effect', onSummon);
    socket.on('burn_tick', onBurnTick);
    return () => { socket.off('card_reveal', onReveal); socket.off('summon_effect', onSummon); socket.off('burn_tick', onBurnTick); };
  }, []);

  /** Play a visual animation at a DOM element's position. */
  const playAnimation = (type, selector, options = {}) => {
    const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const id = Date.now() + Math.random();
    const dur = options.duration || 800;
    setGameAnims(prev => [...prev, { id, type, x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, ...options }]);
    setTimeout(() => setGameAnims(prev => prev.filter(a => a.id !== id)), dur);
  };

  // Listen for potion resolved — trigger explosion animation
  useEffect(() => {
    const onResolved = ({ destroyedIds, animationType }) => {
      if (!destroyedIds || destroyedIds.length === 0) return;
      setExplosions(destroyedIds);
      setTimeout(() => setExplosions([]), 800);
      // Spawn particle animations on each target after a tiny delay for DOM to update
      setTimeout(() => {
        for (const targetId of destroyedIds) {
          // Find DOM element by target ID — ability or equip
          const parts = targetId.split('-');
          const type = parts[0]; // 'ability' or 'equip'
          const ownerPi = parseInt(parts[1]);
          const heroIdx = parseInt(parts[2]);
          const slotIdx = parseInt(parts[3]);
          const ownerLabel = ownerPi === myIdx ? 'me' : 'opp';
          let selector;
          if (type === 'ability') {
            selector = `[data-ability-zone][data-ability-owner="${ownerLabel}"][data-ability-hero="${heroIdx}"][data-ability-slot="${slotIdx}"]`;
          } else {
            selector = `[data-support-zone][data-support-owner="${ownerLabel}"][data-support-hero="${heroIdx}"][data-support-slot="${slotIdx}"]`;
          }
          playAnimation(animationType || 'explosion', selector, { duration: 900 });
        }
      }, 50);
    };
    socket.on('potion_resolved', onResolved);
    return () => socket.off('potion_resolved', onResolved);
  }, []);

  // Listen for rematch first-choice prompt (loser only)
  useEffect(() => {
    const onChooseFirst = () => setShowFirstChoice(true);
    socket.on('rematch_choose_first', onChooseFirst);
    return () => socket.off('rematch_choose_first', onChooseFirst);
  }, []);

  const handleLeave = () => {
    socket.emit('leave_game', { roomId: gameState.roomId });
    onLeave();
  };
  const handleSurrender = () => {
    setShowSurrender(false);
    socket.emit('leave_game', { roomId: gameState.roomId });
    // Don't call onLeave — server will send updated game state with result
  };
  const handleRematch = () => {
    socket.emit('request_rematch', { roomId: gameState.roomId });
  };

  // Escape closes surrender dialog, deck viewer, or cancels potion targeting
  useEffect(() => {
    if (!showSurrender && !deckViewer && !pileViewer && !gameState.potionTargeting) return;
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        if (gameState.potionTargeting && gameState.potionTargeting.ownerIdx === myIdx) {
          if (gameState.potionTargeting.config?.cancellable === false) return; // Can't cancel
          socket.emit('cancel_potion', { roomId: gameState.roomId });
          setPotionSelection([]);
        } else if (pileViewer) setPileViewer(null);
        else if (deckViewer) setDeckViewer(null);
        else if (showSurrender) setShowSurrender(false);
      }
    };
    window.addEventListener('keydown', handleEsc, true);
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, [showSurrender, deckViewer, pileViewer, gameState.potionTargeting]);

  // Listen for opponent's target selections
  useEffect(() => {
    const onOppTargets = ({ selectedIds }) => setOppTargetHighlight(selectedIds || []);
    socket.on('opponent_targeting', onOppTargets);
    return () => socket.off('opponent_targeting', onOppTargets);
  }, []);

  // Broadcast selection changes to opponent
  useEffect(() => {
    if (isTargeting && gameState.roomId) {
      socket.emit('targeting_update', { roomId: gameState.roomId, selectedIds: potionSelection });
    }
  }, [potionSelection, isTargeting]);

  // Reset potion selection and opponent highlight when targeting clears
  useEffect(() => {
    if (!gameState.potionTargeting) {
      setPotionSelection([]);
      setOppTargetHighlight([]);
    }
  }, [gameState.potionTargeting]);

  // Damage number + Gold gain animations — detect changes from game state
  const [damageNumbers, setDamageNumbers] = useState([]);
  const [goldGains, setGoldGains] = useState([]);
  const prevHpRef = useRef(null);
  const prevGoldRef = useRef(null);
  const prevStatusRef = useRef(null);
  useEffect(() => {
    // Build current HP map
    const currentHp = {};
    for (let pi = 0; pi < 2; pi++) {
      const p = gameState.players[pi];
      for (let hi = 0; hi < (p.heroes || []).length; hi++) {
        const h = p.heroes[hi];
        if (h?.name) currentHp[`${pi}-${hi}`] = { name: h.name, hp: h.hp, owner: pi === myIdx ? 'me' : 'opp' };
      }
    }
    // Compare HP
    if (prevHpRef.current) {
      const newDmgNums = [];
      for (const [key, cur] of Object.entries(currentHp)) {
        const prev = prevHpRef.current[key];
        if (prev && cur.hp < prev.hp) {
          const dmg = prev.hp - cur.hp;
          newDmgNums.push({ id: Date.now() + Math.random(), amount: dmg, heroName: cur.name });
        }
      }
      if (newDmgNums.length > 0) {
        setDamageNumbers(prev => [...prev, ...newDmgNums]);
        setTimeout(() => {
          setDamageNumbers(prev => prev.filter(d => !newDmgNums.some(n => n.id === d.id)));
        }, 1800);
      }
    }
    prevHpRef.current = currentHp;

    // Compare Gold
    const currentGold = [gameState.players[0].gold || 0, gameState.players[1].gold || 0];
    if (prevGoldRef.current) {
      const newGoldGains = [];
      for (let pi = 0; pi < 2; pi++) {
        const diff = currentGold[pi] - prevGoldRef.current[pi];
        if (diff > 0) {
          newGoldGains.push({ id: Date.now() + Math.random() + pi, amount: diff, playerIdx: pi });
        }
      }
      if (newGoldGains.length > 0) {
        setGoldGains(prev => [...prev, ...newGoldGains]);
        setTimeout(() => {
          setGoldGains(prev => prev.filter(g => !newGoldGains.some(n => n.id === g.id)));
        }, 1800);
      }
    }
    prevGoldRef.current = currentGold;

    // Compare hero statuses for freeze/thaw animations
    const currentStatuses = {};
    for (let pi = 0; pi < 2; pi++) {
      for (let hi = 0; hi < (gameState.players[pi].heroes || []).length; hi++) {
        const h = gameState.players[pi].heroes[hi];
        if (h?.name) {
          const key = `${pi}-${hi}`;
          currentStatuses[key] = { ...h.statuses };
        }
      }
    }
    if (prevStatusRef.current) {
      for (const [key, cur] of Object.entries(currentStatuses)) {
        const prev = prevStatusRef.current[key] || {};
        const [pi, hi] = key.split('-').map(Number);
        const ownerLabel = pi === myIdx ? 'me' : 'opp';
        // Gained frozen or stunned → freeze animation
        if ((cur.frozen && !prev.frozen) || (cur.stunned && !prev.stunned)) {
          const sel = `[data-hero-zone][data-hero-owner="${ownerLabel}"][data-hero-idx="${hi}"]`;
          const animType = cur.frozen?.animationType || cur.stunned?.animationType || 'freeze';
          setTimeout(() => playAnimation(animType, sel, { duration: 1000 }), 50);
        }
        // Gained negated → electric strike animation
        if (cur.negated && !prev.negated) {
          const sel = `[data-hero-zone][data-hero-owner="${ownerLabel}"][data-hero-idx="${hi}"]`;
          const animType = cur.negated?.animationType || 'electric_strike';
          setTimeout(() => playAnimation(animType, sel, { duration: 1000 }), 50);
        }
        // Lost frozen or stunned → thaw animation
        if ((!cur.frozen && prev.frozen) || (!cur.stunned && prev.stunned)) {
          const sel = `[data-hero-zone][data-hero-owner="${ownerLabel}"][data-hero-idx="${hi}"]`;
          setTimeout(() => playAnimation('thaw', sel, { duration: 900 }), 50);
        }
        // Lost negated → thaw animation
        if (!cur.negated && prev.negated) {
          const sel = `[data-hero-zone][data-hero-owner="${ownerLabel}"][data-hero-idx="${hi}"]`;
          setTimeout(() => playAnimation('thaw', sel, { duration: 900 }), 50);
        }
        // Gained burned → flame strike animation
        if (cur.burned && !prev.burned) {
          const sel = `[data-hero-zone][data-hero-owner="${ownerLabel}"][data-hero-idx="${hi}"]`;
          const animType = cur.burned?.animationType || 'flame_strike';
          setTimeout(() => playAnimation(animType, sel, { duration: 1000 }), 50);
        }
      }
    }
    prevStatusRef.current = currentStatuses;
  }, [gameState]);

  // ── Potion targeting helpers ──
  const pt = gameState.potionTargeting;
  const isTargeting = pt && pt.ownerIdx === myIdx;
  const validTargetIds = isTargeting ? new Set((pt.validTargets || []).map(t => t.id)) : new Set();
  const selectedSet = new Set(potionSelection);

  const togglePotionTarget = (targetId) => {
    if (!isTargeting || !validTargetIds.has(targetId)) return;
    const target = pt.validTargets.find(t => t.id === targetId);
    if (!target) return;
    setPotionSelection(prev => {
      if (prev.includes(targetId)) {
        // Deselect
        return prev.filter(id => id !== targetId);
      }
      // Check exclusive types
      const config = pt.config || {};
      if (config.exclusiveTypes) {
        const prevTargets = prev.map(id => pt.validTargets.find(t => t.id === id)).filter(Boolean);
        const prevTypes = new Set(prevTargets.map(t => t.type));
        if (prevTypes.size > 0 && !prevTypes.has(target.type)) {
          // Switching type — clear previous
          return [targetId];
        }
      }
      // Check max per type
      const maxPerType = config.maxPerType || {};
      const max = maxPerType[target.type] ?? Infinity;
      const sameType = prev.filter(id => {
        const t2 = pt.validTargets.find(t => t.id === id);
        return t2 && t2.type === target.type;
      });
      if (sameType.length >= max) {
        // At limit — swap: remove oldest same-type selection, add new one
        const without = prev.filter(id => !sameType.includes(id));
        return [...without, targetId];
      }
      return [...prev, targetId];
    });
  };

  const canConfirmPotion = potionSelection.length > 0;

  // Compute per-column max support zone count AND left/right island padding across both players
  const columnLayout = [0, 1, 2].map(hi => {
    const counts = [0, 1].map(pi => {
      const ic = (gameState.players[pi].islandZoneCount || [0,0,0])[hi] || 0;
      return { left: Math.floor(ic / 2), right: ic - Math.floor(ic / 2) };
    });
    const maxLeft = Math.max(counts[0].left, counts[1].left);
    const maxRight = Math.max(counts[0].right, counts[1].right);
    const maxZones = maxLeft + 3 + maxRight;
    return { maxZones, maxLeft, maxRight };
  });

  // Render a player's side (3 hero columns, each with hero+surprise, 3 abilities, N supports)
  const renderPlayerSide = (p, isOpp) => {
    const heroes = p.heroes || [];
    const abZones = p.abilityZones || [];
    const supZones = p.supportZones || [];
    const surZones = p.surpriseZones || [];
    const islandCounts = p.islandZoneCount || [0, 0, 0];
    const ownerLabel = isOpp ? 'opp' : 'me';

    const heroRow = (
      <div className="board-row board-hero-row">
        {[0, 1, 2].map(i => {
          const hero = heroes[i];
          const isDead = hero && hero.hp !== undefined && hero.hp <= 0;
          const abilityIneligible = !isOpp && abilityDrag && !canHeroReceiveAbility(p, i, abilityDrag.cardName);
          const equipIneligible = !isOpp && playDrag && playDrag.isEquip && (() => {
            const hero = heroes[i];
            if (!hero || !hero.name || hero.hp <= 0) return true;
            if (hero.statuses?.frozen) return true; // Can't equip to frozen heroes
            const supZ = supZones[i] || [];
            for (let z = 0; z < 3; z++) { if ((supZ[z] || []).length === 0) return false; }
            return true;
          })();
          const abilityTarget = !isOpp && abilityDrag && abilityDrag.targetHero === i && abilityDrag.targetZone < 0;
          const equipTarget = !isOpp && playDrag && playDrag.isEquip && playDrag.targetHero === i && playDrag.targetSlot === -1;
          const pi = isOpp ? oppIdx : myIdx;
          const heroTargetId = `hero-${pi}-${i}`;
          const isValidHeroTarget = isTargeting && validTargetIds.has(heroTargetId);
          const isSelectedHeroTarget = selectedSet.has(heroTargetId);
          const isFrozen = hero?.statuses?.frozen;
          const isStunned = hero?.statuses?.stunned;
          const isImmune = hero?.statuses?.immune;
          const isNegated = hero?.statuses?.negated;
          const isBurned = hero?.statuses?.burned;
          const isShielded = hero?.statuses?.shielded;
          return (
            <div key={i} className="board-hero-group">
              {columnLayout[i].maxZones > 3 && Array.from({ length: columnLayout[i].maxLeft }).map((_, s) => (
                <div key={'lpad-'+s} className="board-zone-spacer" />
              ))}
              <div className="board-zone-spacer" />
              <div className={'board-zone board-zone-hero' + (isDead ? ' board-zone-dead' : '') + ((abilityIneligible || equipIneligible) ? ' board-zone-dead' : '') + ((abilityTarget || equipTarget) ? ' board-zone-play-target' : '') + (isValidHeroTarget ? ' potion-target-valid' : '') + (isSelectedHeroTarget ? ' potion-target-selected' : '') + (oppTargetHighlight.includes(heroTargetId) ? ' opp-target-highlight' : '')}
                data-hero-zone="1" data-hero-idx={i} data-hero-owner={ownerLabel} data-hero-name={hero?.name || ''}
                onClick={isValidHeroTarget ? () => togglePotionTarget(heroTargetId) : undefined}
                style={isValidHeroTarget ? { cursor: 'pointer' } : undefined}>
                {hero?.name ? (
                  <BoardCard cardName={hero.name} hp={hero.hp} maxHp={hero.maxHp} hpPosition="hero" />
                ) : (
                  <div className="board-zone-empty">{'Hero ' + (i+1)}</div>
                )}
                {hero?.name && isFrozen && <FrozenOverlay />}
                {hero?.name && isStunned && <div className="status-stunned-overlay"><div className="stun-bolt s1" /><div className="stun-bolt s2" /><div className="stun-bolt s3" /></div>}
                {hero?.name && isNegated && <NegatedOverlay />}
                {hero?.name && isBurned && <BurnedOverlay ticking={burnTickingHeroes.includes(`${pi}-${i}`)} />}
                {hero?.name && isShielded && <ImmuneIcon heroName={hero.name} statusType="shielded" />}
                {hero?.name && isImmune && !isShielded && <ImmuneIcon heroName={hero.name} statusType="immune" />}
              </div>
              <BoardZone type="surprise" cards={surZones[i] || []} label="Surprise" />
              {columnLayout[i].maxZones > 3 && Array.from({ length: columnLayout[i].maxRight }).map((_, s) => (
                <div key={'rpad-'+s} className="board-zone-spacer" />
              ))}
            </div>
          );
        })}
      </div>
    );

    const abilityRow = (
      <div className="board-row">
        {[0, 1, 2].map(i => {
          const hero = heroes[i];
          const isDead = hero && hero.hp !== undefined && hero.hp <= 0;
          const isFrozenOrStunned = hero?.statuses?.frozen || hero?.statuses?.stunned || hero?.statuses?.negated;
          const heroIneligible = !isOpp && abilityDrag && !canHeroReceiveAbility(p, i, abilityDrag.cardName);
          return (
            <div key={i} className="board-hero-group">
              {columnLayout[i].maxZones > 3 && Array.from({ length: columnLayout[i].maxLeft }).map((_, s) => (
                <div key={'ablpad-'+s} className="board-zone-spacer" />
              ))}
              {[0, 1, 2].map(z => {
                const cards = (abZones[i]||[])[z]||[];
                const isAbTarget = !isOpp && abilityDrag && abilityDrag.targetHero === i && abilityDrag.targetZone === z;
                const pi = isOpp ? oppIdx : myIdx;
                const abTargetId = `ability-${pi}-${i}-${z}`;
                const isValidPotionTarget = isTargeting && validTargetIds.has(abTargetId);
                const isSelectedPotionTarget = selectedSet.has(abTargetId);
                const isExploding = explosions.includes(abTargetId);
                return (
                  <div key={z}
                    className={'board-zone board-zone-ability' + (heroIneligible || isDead || isFrozenOrStunned ? ' board-zone-dead' : '') + (isAbTarget ? ' board-zone-play-target' : '') + (isValidPotionTarget ? ' potion-target-valid' : '') + (isSelectedPotionTarget ? ' potion-target-selected' : '') + (isExploding ? ' zone-exploding' : '') + (oppTargetHighlight.includes(abTargetId) ? ' opp-target-highlight' : '')}
                    data-ability-zone="1" data-ability-hero={i} data-ability-slot={z} data-ability-owner={ownerLabel}
                    onClick={isValidPotionTarget ? () => togglePotionTarget(abTargetId) : undefined}
                    style={isValidPotionTarget ? { cursor: 'pointer' } : undefined}>
                    {cards.length > 0 ? (
                      <AbilityStack cards={cards} />
                    ) : (
                      <div className="board-zone-empty">Ability</div>
                    )}
                  </div>
                );
              })}
              {columnLayout[i].maxZones > 3 && Array.from({ length: columnLayout[i].maxRight }).map((_, s) => (
                <div key={'abrpad-'+s} className="board-zone-spacer" />
              ))}
            </div>
          );
        })}
      </div>
    );

    const supportRow = (
      <div className="board-row">
        {[0, 1, 2].map(i => {
          const actualZoneCount = (supZones[i] || []).length || 3;
          const islandCount = islandCounts[i] || 0;
          const baseCount = actualZoneCount - islandCount;
          const myLeft = Math.floor(islandCount / 2);
          const myRight = islandCount - myLeft;
          const { maxLeft, maxRight } = columnLayout[i];

          // Build render order: left spacers, left islands, base zones, right islands, right spacers
          const renderOrder = [];
          // Left spacers (align with other player's islands)
          for (let s = 0; s < maxLeft - myLeft; s++) renderOrder.push({ z: -1, isIsland: false, isSpacer: true });
          // Left island zones
          for (let li = 0; li < myLeft; li++) renderOrder.push({ z: baseCount + li, isIsland: true });
          // Base zones
          for (let bz = 0; bz < baseCount; bz++) renderOrder.push({ z: bz, isIsland: false });
          // Right island zones
          for (let ri = 0; ri < myRight; ri++) renderOrder.push({ z: baseCount + myLeft + ri, isIsland: true });
          // Right spacers
          for (let s = 0; s < maxRight - myRight; s++) renderOrder.push({ z: -1, isIsland: false, isSpacer: true });

          // First free base zone (for equip auto-place highlight)
          let autoSlot = -1;
          for (let fz = 0; fz < baseCount; fz++) { if (((supZones[i]||[])[fz]||[]).length === 0) { autoSlot = fz; break; } }
          return (
          <div key={i} className="board-hero-group">
            {renderOrder.map((slot, renderIdx) => {
              if (slot.isSpacer) return <div key={'sp-'+renderIdx} className="board-zone-spacer" />;
              const z = slot.z;
              const isIsland = slot.isIsland;
              const cards = (supZones[i]||[])[z]||[];
              const isPlayTarget = !isOpp && playDrag && playDrag.targetHero === i && playDrag.targetSlot === z;
              const isAutoTarget = !isOpp && playDrag && playDrag.isEquip && playDrag.targetHero === i && playDrag.targetSlot === -1 && z === autoSlot;
              const pi = isOpp ? oppIdx : myIdx;
              // Check all possible equip target IDs for this zone
              const equipTargetIds = (pt?.validTargets || []).filter(t => t.type === 'equip' && t.owner === pi && t.heroIdx === i && t.slotIdx === z).map(t => t.id);
              const isValidEquipTarget = isTargeting && equipTargetIds.some(id => validTargetIds.has(id));
              const isSelectedEquipTarget = equipTargetIds.some(id => selectedSet.has(id));
              const isEquipExploding = equipTargetIds.some(id => explosions.includes(id));
              const isSummonGlow = summonGlow && summonGlow.owner === pi && summonGlow.heroIdx === i && summonGlow.zoneSlot === z;
              return (
                <div key={z} className={'board-zone board-zone-support' + (isIsland ? ' board-zone-island' : '') + ((isPlayTarget || isAutoTarget) ? ' board-zone-play-target' : '') + (isValidEquipTarget ? ' potion-target-valid' : '') + (isSelectedEquipTarget ? ' potion-target-selected' : '') + (isEquipExploding ? ' zone-exploding' : '') + (isSummonGlow ? ' zone-summon-glow' : '') + (equipTargetIds.some(id => oppTargetHighlight.includes(id)) ? ' opp-target-highlight' : '')}
                  data-support-zone="1" data-support-hero={i} data-support-slot={z} data-support-owner={ownerLabel} data-support-island={isIsland ? 'true' : 'false'}
                  onClick={isValidEquipTarget ? () => equipTargetIds.forEach(id => togglePotionTarget(id)) : undefined}
                  style={isValidEquipTarget ? { cursor: 'pointer' } : undefined}>
                  {(isPlayTarget || isAutoTarget) && playDrag.card ? (
                    <BoardCard cardName={playDrag.cardName} hp={playDrag.card.hp} maxHp={playDrag.card.hp} hpPosition="creature" style={{ opacity: 0.5 }} />
                  ) : cards.length > 0 ? (
                    <>
                    {cards.length === 1 ? (
                      <BoardCard cardName={cards[0]} hp={CARDS_BY_NAME[cards[0]]?.hp} maxHp={CARDS_BY_NAME[cards[0]]?.hp} hpPosition="creature" />
                    ) : (
                      <div className="board-stack">
                        <BoardCard cardName={cards[cards.length-1]} hp={CARDS_BY_NAME[cards[cards.length-1]]?.hp} maxHp={CARDS_BY_NAME[cards[cards.length-1]]?.hp} hpPosition="creature" label={cards.length+''} />
                      </div>
                    )}
                    {(() => { const cKey = `${pi}-${i}-${z}`; const lvl = (gameState.creatureCounters || {})[cKey]?.level; return lvl ? <div className="creature-level">Lv{lvl}</div> : null; })()}
                    </>
                  ) : (
                    <div className="board-zone-empty">{isIsland ? 'Island' : 'Support'}</div>
                  )}
                </div>
              );
            })}
          </div>
          );
        })}
      </div>
    );

    return isOpp
      ? <>{supportRow}{abilityRow}{heroRow}</>
      : <>{heroRow}{abilityRow}{supportRow}</>;
  };

  return (
    <div className="screen-full" style={{ background: '#0c0c14' }}>
      <div className="top-bar" style={{ justifyContent: 'space-between' }}>
        <button className="btn btn-danger" style={{ padding: '4px 12px', fontSize: 10 }} onClick={() => result ? handleLeave() : setShowSurrender(true)}>
          {result ? '✕ LEAVE' : '⚑ SURRENDER'}
        </button>
        <h2 className="orbit-font" style={{ fontSize: 14, color: 'var(--accent)' }}>PIXEL PARTIES</h2>
        <span className="badge" style={{ background: lobby?.type === 'ranked' ? 'rgba(255,170,0,.12)' : 'rgba(0,240,255,.12)', color: lobby?.type === 'ranked' ? 'var(--accent4)' : 'var(--accent)' }}>
          {lobby?.type?.toUpperCase() || 'GAME'}
        </span>
      </div>

      <div className="game-layout">
        {/* Opponent hand */}
        <div className="game-hand game-hand-opp">
          <div className="game-hand-info">
            {opp.avatar && <img src={opp.avatar} className="game-hand-avatar game-hand-avatar-big" />}
            <span className="orbit-font" style={{ fontSize: 18, fontWeight: 800, color: opp.color }}>{opp.username}</span>
            {oppDisconnected && <span style={{ fontSize: 10, color: 'var(--danger)', animation: 'pulse 1.5s infinite' }}>DISCONNECTED</span>}
          </div>
          <div className="game-hand-cards">
            {Array.from({ length: opp.handCount || 0 }).map((_, i) => (
              <div key={i} className="board-card face-down hand-card flipped">
                <img src="/cardback.png" style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
              </div>
            ))}
          </div>
          <div className="game-gold-display">
            <span className="game-gold-icon">🪙</span>
            <span className="game-gold-value orbit-font" data-gold-player={oppIdx}>{opp.gold || 0}</span>
          </div>
        </div>
        {/* Board */}
        <div className={'game-board' + (showFirstChoice ? ' game-board-dimmed' : '')}>
          <div className="board-util board-util-left">
            <BoardZone type="discard" cards={opp.discardPile} label="Discard" flipped onClick={() => setPileViewer({ title: 'Opponent Discard', cards: opp.discardPile })} onHoverCard={setHoveredPileCard} />
            <BoardZone type="deleted" cards={opp.deletedPile} label="Deleted" flipped onClick={() => setPileViewer({ title: 'Opponent Deleted', cards: opp.deletedPile })} onHoverCard={setHoveredPileCard} />
            <BoardZone type="area" cards={gameState.areaZones[0]} label="Area" />
            <BoardZone type="deleted" cards={me.deletedPile} label="Deleted" onClick={() => setPileViewer({ title: 'My Deleted', cards: me.deletedPile })} onHoverCard={setHoveredPileCard} />
            <BoardZone type="discard" cards={me.discardPile} label="Discard" onClick={() => setPileViewer({ title: 'My Discard', cards: me.discardPile })} onHoverCard={setHoveredPileCard} />
          </div>

          <div className="board-center">
            <div className="board-player-side board-side-opp">{renderPlayerSide(opp, true)}</div>
            <div className="board-mid-row">
              <div className="board-phase-tracker">
                {['Start Phase', 'Resource Phase', 'Main Phase 1', 'Action Phase', 'Main Phase 2', 'End Phase'].map((phase, i) => {
                  const isActive = currentPhase === i;
                  // Which phases can the active player click to advance to?
                  const canClick = isMyTurn && !result && (
                    (currentPhase === 2 && (i === 3 || i === 5)) || // Main1 → Action or End
                    (currentPhase === 3 && i === 4) ||              // Action → Main2
                    (currentPhase === 4 && i === 5)                 // Main2 → End
                  );
                  return (
                    <div key={i}
                      className={'board-phase-item' + (isActive ? ' active' : '') + (canClick ? ' clickable' : '')}
                      style={isActive ? { borderColor: phaseColor, boxShadow: `0 0 10px ${phaseColor}44` } : undefined}
                      onClick={() => {
                        if (canClick) socket.emit('advance_phase', { roomId: gameState.roomId, targetPhase: i });
                      }}>
                      {phase}
                    </div>
                  );
                })}
              </div>
              <div className="board-area-line" />
            </div>
            <div className="board-player-side board-side-me">{renderPlayerSide(me, false)}</div>
          </div>

          <div className="board-util board-util-right">
            <BoardZone type="deck" label="Deck" faceDown flipped>
              <div className="board-card face-down flipped"><img src="/cardback.png" style={{width:'100%',height:'100%',objectFit:'cover'}} draggable={false} /><div className="board-card-label">{opp.deckCount}</div></div>
            </BoardZone>
            <BoardZone type="potion" label="Potions" faceDown flipped>
              {opp.potionDeckCount > 0 && <div className="board-card face-down flipped"><img src="/cardback.png" style={{width:'100%',height:'100%',objectFit:'cover'}} draggable={false} /><div className="board-card-label">{opp.potionDeckCount}</div></div>}
            </BoardZone>
            <BoardZone type="area" cards={gameState.areaZones[1]} label="Area" />
            <div onClick={() => me.potionDeckCount > 0 && setDeckViewer('potion')} style={{ cursor: me.potionDeckCount > 0 ? 'pointer' : 'default' }}>
            <BoardZone type="potion" label="Potions" faceDown>
              {me.potionDeckCount > 0 && <div className="board-card face-down"><img src="/cardback.png" style={{width:'100%',height:'100%',objectFit:'cover'}} draggable={false} /><div className="board-card-label">{me.potionDeckCount}</div></div>}
            </BoardZone>
            </div>
            <div onClick={() => me.deckCount > 0 && setDeckViewer('deck')} style={{ cursor: me.deckCount > 0 ? 'pointer' : 'default' }}>
            <BoardZone type="deck" label="Deck" faceDown>
              <div className="board-card face-down"><img src="/cardback.png" style={{width:'100%',height:'100%',objectFit:'cover'}} draggable={false} /><div className="board-card-label">{me.deckCount}</div></div>
            </BoardZone>
            </div>
          </div>
        </div>

        {/* My hand — drag to reorder */}
        <div className="game-hand game-hand-me" ref={handRef}>
          <div className="game-hand-cards">
            {displayHand.map((item, i) => {
              if (item.isGap) return <div key="gap" className="hand-drop-gap" />;
              const isBeingDragged = handDrag && handDrag.idx === item.origIdx;
              const dimmed = getCardDimmed(item.card);
              return (
                <div key={'h-' + item.origIdx} className={'hand-slot' + (isBeingDragged ? ' hand-dragging' : '') + (dimmed ? ' hand-card-dimmed' : '')}
                  onMouseDown={(e) => onHandMouseDown(e, item.origIdx)}>
                  <BoardCard cardName={item.card} />
                </div>
              );
            })}
          </div>
          <div className="game-gold-display">
            <span className="game-gold-icon">🪙</span>
            <span className="game-gold-value orbit-font" data-gold-player={myIdx}>{me.gold || 0}</span>
          </div>
        </div>

        </div>
      {/* end game-layout */}

      {/* Floating drag card (outside game-layout to avoid overflow clip) */}
      {handDrag && (
        <div className="hand-floating-card" style={{ left: handDrag.mouseX - 32, top: handDrag.mouseY - 45 }}>
          <BoardCard cardName={handDrag.cardName} />
        </div>
      )}
      {playDrag && (
        <div className="hand-floating-card" style={{ left: playDrag.mouseX - 32, top: playDrag.mouseY - 45 }}>
          <BoardCard cardName={playDrag.cardName} />
        </div>
      )}
      {abilityDrag && (
        <div className="hand-floating-card" style={{ left: abilityDrag.mouseX - 32, top: abilityDrag.mouseY - 45 }}>
          <BoardCard cardName={abilityDrag.cardName} />
        </div>
      )}

      {/* Damage numbers */}
      {damageNumbers.map(d => (
        <DamageNumber key={d.id} amount={d.amount} heroName={d.heroName} />
      ))}

      {/* Gold gain numbers */}
      {goldGains.map(g => (
        <GoldGainNumber key={g.id} amount={g.amount} playerIdx={g.playerIdx} isMe={g.playerIdx === myIdx} />
      ))}

      {/* Modular game animations (explosions, etc.) */}
      {gameAnims.map(a => (
        <GameAnimationRenderer key={a.id} {...a} />
      ))}

      {/* Opponent card reveal */}
      {cardReveal && (
        <CardRevealOverlay cardName={cardReveal} onDone={() => setCardReveal(null)} />
      )}

      {/* Immune status tooltip */}
      {immuneTooltip && (() => {
        const el = document.querySelector(`[data-hero-name="${CSS.escape(immuneTooltip)}"] .status-immune-icon`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return <div className="immune-tooltip" style={{ position: 'fixed', left: r.right + 8, top: r.top - 4 }}>{immuneTooltipType === 'shielded' ? 'Immune to anything during your first turn!' : 'Cannot be Frozen, Stunned or otherwise incapacitated this turn.'}</div>;
      })()}

      {/* Pile hover tooltip (rendered at top level to escape overflow clipping) */}
      {hoveredPileCard && CARDS_BY_NAME[hoveredPileCard] && (() => {
        const card = CARDS_BY_NAME[hoveredPileCard];
        const imgUrl = cardImageUrl(card.name);
        const foilType = card.foil || null;
        const isFoil = foilType === 'secret_rare' || foilType === 'diamond_rare';
        return (
          <div className="board-tooltip">
            {imgUrl && (
              <div style={{ position: 'relative', width: '100%', flexShrink: 0 }}>
                <img src={imgUrl} style={{ width: '100%', aspectRatio: '750/1050', objectFit: 'cover', display: 'block',
                  border: foilType === 'diamond_rare' ? '2px solid rgba(120,200,255,.6)' : foilType === 'secret_rare' ? '2px solid rgba(255,215,0,.5)' : 'none' }} />
              </div>
            )}
            <div style={{ padding: '10px 12px' }}>
              <div style={{ fontWeight: 700, fontSize: 18, color: typeColor(card.cardType), marginBottom: 5 }}>{card.name}</div>
              <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 8 }}>
                {card.cardType}{card.subtype ? ' · ' + card.subtype : ''}{card.archetype ? ' · ' + card.archetype : ''}
              </div>
              {card.effect && <div style={{ fontSize: 14, marginTop: 4, lineHeight: 1.5 }}>{card.effect}</div>}
              <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 8, display: 'flex', gap: 12 }}>
                {card.hp != null && <span style={{ color: '#ff6666' }}>♥ HP {card.hp}</span>}
                {card.atk != null && <span style={{ color: '#ffaa44' }}>⚔ ATK {card.atk}</span>}
                {card.cost != null && <span style={{ color: '#44aaff' }}>◆ Cost {card.cost}</span>}
                {card.level != null && <span>Lv{card.level}</span>}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Surrender confirmation */}
      {showSurrender && (
        <div className="modal-overlay" onClick={() => setShowSurrender(false)}>
          <div className="modal animate-in" onClick={e => e.stopPropagation()} style={{ maxWidth: 340, textAlign: 'center' }}>
            <div className="pixel-font" style={{ fontSize: 14, color: 'var(--danger)', marginBottom: 16 }}>SURRENDER?</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>Do you really want to give up?</div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn btn-danger" style={{ padding: '10px 28px', fontSize: 13 }} onClick={handleSurrender}>YES</button>
              <button className="btn" style={{ padding: '10px 28px', fontSize: 13 }} onClick={() => setShowSurrender(false)}>NO</button>
            </div>
          </div>
        </div>
      )}

      {/* Deck viewer */}
      {deckViewer && (() => {
        const raw = deckViewer === 'potion' ? (me.potionDeckCards || []) : (me.mainDeckCards || []);
        const TYPE_ORDER = ['Hero','Creature','Spell','Attack','Artifact','Ability','Potion','Ascended Hero','Token'];
        const sorted = [...raw].sort((a, b) => {
          const ca = CARDS_BY_NAME[a], cb = CARDS_BY_NAME[b];
          const ta = TYPE_ORDER.indexOf(ca?.cardType || ''), tb = TYPE_ORDER.indexOf(cb?.cardType || '');
          if (ta !== tb) return ta - tb;
          return a.localeCompare(b);
        });
        return (
          <div className="modal-overlay" onClick={() => setDeckViewer(null)}>
            <div className="modal animate-in deck-viewer-modal" onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span className="orbit-font" style={{ fontSize: 13, color: 'var(--accent)' }}>
                  {deckViewer === 'potion' ? '🧪 POTION DECK' : '📋 MAIN DECK'} ({sorted.length})
                </span>
                <button className="btn" style={{ padding: '4px 12px', fontSize: 10 }} onClick={() => setDeckViewer(null)}>✕ CLOSE</button>
              </div>
              <div className="deck-viewer-grid">
                {sorted.map((name, i) => {
                  const card = CARDS_BY_NAME[name];
                  if (!card) return null;
                  return <CardMini key={name + '-' + i} card={card} onClick={() => {}} style={{ width: '100%', height: 120 }} />;
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Pile viewer (discard/deleted) */}
      {pileViewer && (() => {
        const TYPE_ORDER = ['Hero','Creature','Spell','Attack','Artifact','Ability','Potion','Ascended Hero','Token'];
        const sorted = [...(pileViewer.cards || [])].sort((a, b) => {
          const ca = CARDS_BY_NAME[a], cb = CARDS_BY_NAME[b];
          const ta = TYPE_ORDER.indexOf(ca?.cardType || ''), tb = TYPE_ORDER.indexOf(cb?.cardType || '');
          if (ta !== tb) return ta - tb;
          return a.localeCompare(b);
        });
        return (
          <div className="modal-overlay" onClick={() => setPileViewer(null)}>
            <div className="modal animate-in deck-viewer-modal" onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span className="orbit-font" style={{ fontSize: 13, color: 'var(--accent)' }}>
                  {pileViewer.title} ({sorted.length})
                </span>
                <button className="btn" style={{ padding: '4px 12px', fontSize: 10 }} onClick={() => setPileViewer(null)}>✕ CLOSE</button>
              </div>
              {sorted.length > 0 ? (
                <div className="deck-viewer-grid">
                  {sorted.map((name, i) => {
                    const card = CARDS_BY_NAME[name];
                    if (!card) return null;
                    return <CardMini key={name + '-' + i} card={card} onClick={() => {}} style={{ width: '100%', height: 120 }} />;
                  })}
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text2)', padding: 20 }}>Empty</div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Rematch first-choice dialog (loser only) — floating panel so hand is visible */}
      {showFirstChoice && (
        <DraggablePanel className="first-choice-panel animate-in">
          <div className="pixel-font" style={{ fontSize: 14, color: 'var(--accent)', marginBottom: 12 }}>REMATCH!</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>Would you like to go first or second?</div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn btn-success" style={{ padding: '12px 28px', fontSize: 13 }}
              onClick={() => { setShowFirstChoice(false); socket.emit('rematch_first_choice', { roomId: gameState.roomId, goFirst: true }); }}>
              GO FIRST
            </button>
            <button className="btn" style={{ padding: '12px 28px', fontSize: 13, borderColor: 'var(--accent)', color: 'var(--accent)' }}
              onClick={() => { setShowFirstChoice(false); socket.emit('rematch_first_choice', { roomId: gameState.roomId, goFirst: false }); }}>
              GO SECOND
            </button>
          </div>
        </DraggablePanel>
      )}

      {/* Potion/Artifact targeting panel */}
      {isTargeting && pt && (
        <DraggablePanel className="first-choice-panel" style={{ borderColor: 'var(--danger)', animation: 'fadeIn .2s ease-out' }}>
          <div className="pixel-font" style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 8 }}>{pt.potionName}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 14 }}>{pt.config?.description || 'Select targets'}</div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className={'btn ' + (pt.config?.confirmClass || 'btn-success')} style={{ padding: '8px 24px', fontSize: 12 }}
              disabled={!canConfirmPotion}
              onClick={() => { socket.emit('confirm_potion', { roomId: gameState.roomId, selectedIds: potionSelection }); }}>
              {pt.config?.confirmLabel || 'Confirm'}
            </button>
            {pt.config?.cancellable !== false && (
              <button className="btn" style={{ padding: '8px 24px', fontSize: 12 }}
                onClick={() => { socket.emit('cancel_potion', { roomId: gameState.roomId }); setPotionSelection([]); }}>
                Cancel
              </button>
            )}
          </div>
        </DraggablePanel>
      )}

      {/* Game announcements */}
      {announcement && (
        <div className={'game-announcement' + (announcement.short ? ' game-announcement-short' : '')}
          onClick={() => setAnnouncement(null)} style={{ cursor: 'pointer' }}>
          <div className="game-announcement-text" style={{ color: announcement.color }}>
            {announcement.text}
          </div>
        </div>
      )}

      {/* Win/Loss overlay */}
      {result && !showFirstChoice && (
        <div className="modal-overlay" style={{ background: 'rgba(0,0,0,.75)' }}>
          <div className="animate-in" style={{ textAlign: 'center' }}>
            <div className="pixel-font" style={{
              fontSize: 36, marginBottom: 16,
              color: iWon ? 'var(--success)' : 'var(--danger)',
              textShadow: iWon ? '0 0 40px rgba(51,255,136,.5)' : '0 0 40px rgba(255,51,102,.5)',
            }}>
              {iWon ? 'YOU WIN!' : 'YOU LOSE'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8 }}>
              {result.reason === 'disconnect_timeout' ? 'Opponent timed out' :
               result.reason === 'opponent_left' ? 'Opponent left the game' :
               result.reason === 'surrender' ? (iWon ? 'Opponent surrendered' : 'You surrendered') :
               result.reason === 'all_heroes_dead' ? (iWon ? 'All enemy heroes defeated!' : 'All your heroes were defeated') : ''}
            </div>
            {result.eloChanges && (
              <div style={{ marginBottom: 20 }}>
                {result.eloChanges.map(ec => (
                  <div key={ec.username} style={{ fontSize: 12, color: ec.username === user.username ? 'var(--text)' : 'var(--text2)' }}>
                    {ec.username}: {ec.oldElo} → <span style={{ color: ec.newElo > ec.oldElo ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>{ec.newElo}</span>
                    {' '}({ec.newElo > ec.oldElo ? '+' : ''}{ec.newElo - ec.oldElo})
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              {!oppLeft && !oppDisconnected ? (
                <>
                  <button className="btn btn-success" style={{ padding: '12px 32px', fontSize: 14 }} onClick={handleRematch} disabled={myRematchSent}>
                    {myRematchSent ? '⏳ WAITING...' : '🔄 REMATCH'}
                  </button>
                  <button className="btn btn-danger" style={{ padding: '12px 32px', fontSize: 14 }} onClick={handleLeave}>LEAVE</button>
                </>
              ) : (
                <button className="btn btn-danger" style={{ padding: '12px 32px', fontSize: 14 }} onClick={handleLeave}>LEAVE</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════
//  PLAY SCREEN
// ═══════════════════════════════════════════
function PlayScreen() {
  const { user, setScreen, notify } = useContext(AppContext);
  const [decks, setDecks] = useState([]);
  const [selectedDeck, setSelectedDeck] = useState('');
  const [rooms, setRooms] = useState([]);
  const [creating, setCreating] = useState(false);
  const [gameType, setGameType] = useState('unranked');
  const [playerPw, setPlayerPw] = useState('');
  const [specPw, setSpecPw] = useState('');
  const [joinPw, setJoinPw] = useState('');
  const [joinTarget, setJoinTarget] = useState(null);
  const [lobby, setLobby] = useState(null);
  const [playerJoined, setPlayerJoined] = useState(null);
  const [gameState, setGameState] = useState(() => {
    // Check for buffered reconnection state
    const pending = _pendingGameState;
    _pendingGameState = null;
    return pending;
  });

  // Load decks
  useEffect(() => {
    (async () => {
      try {
        const data = await api('/decks');
        if (data.decks) {
          setDecks(data.decks);
          const def = data.decks.find(d => d.isDefault);
          if (def) setSelectedDeck(def.id);
          else if (data.decks.length) setSelectedDeck(data.decks[0].id);
        }
      } catch {}
    })();
  }, []);

  // Socket events
  useEffect(() => {
    socket.emit('get_rooms');

    const onRooms = (r) => setRooms(r);
    const onRoomJoined = (r) => setLobby(r);
    const onRoomUpdate = (r) => setLobby(prev => prev ? r : null);
    const onRoomClosed = () => { setLobby(null); setGameState(null); notify('Room was closed by host', 'error'); };
    const onJoinError = (msg) => notify(msg, 'error');
    const onPlayerJoined = (data) => setPlayerJoined(data.username);
    const onGameStarted = (r) => { setLobby(r); };
    const onGameState = (state) => { setGameState(state); };

    socket.on('rooms', onRooms);
    socket.on('room_joined', onRoomJoined);
    socket.on('room_update', onRoomUpdate);
    socket.on('room_closed', onRoomClosed);
    socket.on('join_error', onJoinError);
    socket.on('player_joined', onPlayerJoined);
    socket.on('game_started', onGameStarted);
    socket.on('game_state', onGameState);

    const poll = setInterval(() => socket.emit('get_rooms'), 4000);

    return () => {
      socket.off('rooms', onRooms);
      socket.off('room_joined', onRoomJoined);
      socket.off('room_update', onRoomUpdate);
      socket.off('room_closed', onRoomClosed);
      socket.off('join_error', onJoinError);
      socket.off('player_joined', onPlayerJoined);
      socket.off('game_started', onGameStarted);
      socket.off('game_state', onGameState);
      clearInterval(poll);
    };
  }, []);

  const currentDeckObj = decks.find(d => d.id === selectedDeck);

  const createGame = () => {
    if (!currentDeckObj) { notify('Select a deck first', 'error'); return; }
    const v = isDeckLegal(currentDeckObj);
    if (!v.legal) { notify('Deck not legal: ' + v.reasons.join(', '), 'error'); return; }
    socket.emit('create_room', { type: gameType, playerPw: playerPw || null, specPw: specPw || null, deckId: selectedDeck });
    setCreating(false);
    setPlayerPw(''); setSpecPw('');
  };

  const joinRoom = (room, asSpectator, pw) => {
    if (!asSpectator) {
      if (!currentDeckObj) { notify('Select a deck first', 'error'); return; }
      const v = isDeckLegal(currentDeckObj);
      if (!v.legal) { notify('Deck not legal: ' + v.reasons.join(', '), 'error'); return; }
    }
    if (!asSpectator && room.hasPlayerPw && !pw) { setJoinTarget({ room, asSpectator: false }); return; }
    if (asSpectator && room.hasSpecPw && !pw) { setJoinTarget({ room, asSpectator: true }); return; }
    socket.emit('join_room', { roomId: room.id, password: pw || '', asSpectator, deckId: selectedDeck });
    setJoinTarget(null); setJoinPw('');
  };

  const leaveRoom = () => {
    if (lobby) socket.emit('leave_room', { roomId: lobby.id });
    setLobby(null);
    setGameState(null);
  };

  // Intercept Escape: close lobby/game/create-modal/join-modal, or return to menu from room list
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        if (gameState) return; // Let GameBoard handle Escape during active game
        e.stopImmediatePropagation();
        if (joinTarget) { setJoinTarget(null); }
        else if (creating) { setCreating(false); }
        else if (lobby) { leaveRoom(); }
        else { setScreen('menu'); } // Room list → back to main menu
      }
    };
    window.addEventListener('keydown', handleEsc, true);
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, [lobby, gameState, creating, joinTarget]);

  // === GAME BOARD VIEW ===
  if (gameState) {
    return <GameBoard gameState={gameState} lobby={lobby} onLeave={leaveRoom} />;
  }

  // === LOBBY VIEW ===
  if (lobby) {
    const isHost = lobby.host === user.username;
    const hasOpponent = lobby.players.length >= 2;
    return (
      <div className="screen-full">
        <div className="top-bar">
          <button className="btn btn-danger" style={{ padding: '4px 12px', fontSize: 10 }} onClick={leaveRoom}>
            {isHost ? 'CLOSE ROOM' : 'LEAVE'}
          </button>
          <h2 className="orbit-font" style={{ fontSize: 14, color: 'var(--accent)' }}>GAME LOBBY</h2>
          <span className="badge" style={{ background: lobby.type === 'ranked' ? 'rgba(255,170,0,.12)' : 'rgba(0,240,255,.12)', color: lobby.type === 'ranked' ? 'var(--accent4)' : 'var(--accent)' }}>
            {lobby.type.toUpperCase()}
          </span>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="animate-in">
          <div className="panel" style={{ width: 420, textAlign: 'center' }}>
            <div className="orbit-font" style={{ fontSize: 18, fontWeight: 700, marginBottom: 24 }}>
              {hasOpponent ? '⚔️ READY TO BATTLE!' : '⏳ Waiting for opponent...'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 40, marginBottom: 24 }}>
              {lobby.players.map((p, i) => (
                <div key={p} style={{ textAlign: 'center' }}>
                  <div style={{ width: 64, height: 64, border: '2px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', fontSize: 26 }}>
                    {i === 0 ? '👑' : '⚔️'}
                  </div>
                  <div style={{ fontWeight: 700, color: i === 0 ? 'var(--accent)' : 'var(--accent2)' }}>{p}</div>
                  <div style={{ fontSize: 10, color: 'var(--text2)' }}>{i === 0 ? 'HOST' : 'CHALLENGER'}</div>
                </div>
              ))}
              {lobby.players.length < 2 && (
                <div style={{ textAlign: 'center', opacity: .3 }}>
                  <div style={{ width: 64, height: 64, border: '2px dashed var(--bg4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', fontSize: 22 }}>?</div>
                  <div style={{ fontSize: 10 }}>Waiting...</div>
                </div>
              )}
            </div>
            {(lobby.spectators || []).length > 0 && (
              <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 16 }}>
                👁 Spectators: {lobby.spectators.join(', ')}
              </div>
            )}
            {isHost && hasOpponent && (
              <button className="btn btn-success btn-big glow-border" style={{ marginBottom: 12 }}
                onClick={() => socket.emit('start_game', { roomId: lobby.id })}>
                🎮 START PLAYING!
              </button>
            )}
            {!isHost && lobby.players.includes(user.username) && (
              <button className="btn" style={{ fontSize: 10, marginTop: 8 }}
                onClick={() => socket.emit('swap_to_spectator', { roomId: lobby.id })}>
                SWITCH TO SPECTATOR
              </button>
            )}
            {!lobby.players.includes(user.username) && (lobby.spectators || []).includes(user.username) && lobby.players.length < 2 && lobby.status !== 'playing' && (
              <button className="btn btn-accent2" style={{ fontSize: 10, marginTop: 8 }}
                onClick={() => {
                  if (!currentDeckObj) { notify('Select a deck first', 'error'); return; }
                  const v = isDeckLegal(currentDeckObj);
                  if (!v.legal) { notify('Deck not legal: ' + v.reasons.join(', '), 'error'); return; }
                  socket.emit('swap_to_player', { roomId: lobby.id, deckId: selectedDeck });
                }}>
                ⚔ SWITCH TO PLAYER
              </button>
            )}
            {lobby.status === 'playing' && (
              <div className="orbit-font" style={{ color: 'var(--accent3)', marginTop: 12, fontSize: 14, animation: 'pulse 1.5s infinite' }}>
                🎮 GAME IN PROGRESS
              </div>
            )}
          </div>
        </div>
        {/* Player joined pop-up */}
        {playerJoined && (
          <div className="modal-overlay" onClick={() => setPlayerJoined(null)}>
            <div className="modal animate-in" onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⚔️</div>
              <div className="orbit-font" style={{ fontSize: 16, marginBottom: 8 }}>
                <span style={{ color: 'var(--accent2)' }}>{playerJoined}</span> has joined!
              </div>
              <button className="btn" onClick={() => setPlayerJoined(null)}>OK</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // === ROOM BROWSER ===
  const openRooms = rooms.filter(r => r.status === 'waiting' && r.playerCount < 2);
  const activeRooms = rooms.filter(r => r.status === 'playing' || r.playerCount >= 2);

  return (
    <div className="screen-full">
      <div className="top-bar">
        <button className="btn" style={{ padding: '4px 12px', fontSize: 10 }} onClick={() => setScreen('menu')}>← BACK</button>
        <h2 className="orbit-font" style={{ fontSize: 16, color: 'var(--accent)' }}>PLAY</h2>
        <div style={{ flex: 1 }} />
        <label style={{ fontSize: 11, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 6 }}>
          Deck:
          <select className="select" value={selectedDeck} onChange={e => setSelectedDeck(e.target.value)} style={{ fontSize: 11 }}>
            {decks.map(d => <option key={d.id} value={d.id}>{d.name} {isDeckLegal(d).legal ? '✓' : '✗'}</option>)}
          </select>
        </label>
        <button className="btn btn-accent2" onClick={() => setCreating(true)}>+ CREATE GAME</button>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }} className="animate-in">
        {/* Open Games */}
        <div style={{ flex: 1, borderRight: '1px solid var(--bg4)', display: 'flex', flexDirection: 'column' }}>
          <div className="orbit-font" style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: 'var(--accent)', borderBottom: '1px solid var(--bg4)' }}>
            OPEN GAMES ({openRooms.length})
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
            {openRooms.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text2)', fontSize: 11, padding: 20 }}>No open games. Create one!</div>}
            {openRooms.map(r => (
              <div key={r.id} className="room-card" onClick={() => joinRoom(r, false)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700 }}>{r.host}</span>
                  <span className="badge" style={{ background: r.type === 'ranked' ? 'rgba(255,170,0,.12)' : 'rgba(0,240,255,.12)', color: r.type === 'ranked' ? 'var(--accent4)' : 'var(--accent)' }}>
                    {r.type}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 2 }}>
                  {r.hasPlayerPw ? '🔒 Password' : '🔓 Open'} · {r.playerCount}/2 players
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* In Progress */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="orbit-font" style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: 'var(--accent2)', borderBottom: '1px solid var(--bg4)' }}>
            IN PROGRESS ({activeRooms.length})
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
            {activeRooms.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text2)', fontSize: 11, padding: 20 }}>No active games</div>}
            {activeRooms.map(r => (
              <div key={r.id} className="room-card" onClick={() => joinRoom(r, true)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700 }}>{r.players.join(' vs ')}</span>
                  <span className="badge" style={{ background: 'rgba(255,0,170,.12)', color: 'var(--accent2)' }}>LIVE</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 2 }}>
                  👁 {r.spectatorCount} watching · Click to spectate
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Create Game Modal */}
      {creating && (
        <div className="modal-overlay" onClick={() => setCreating(false)}>
          <div className="modal animate-in" onClick={e => e.stopPropagation()}>
            <h3 className="orbit-font" style={{ marginBottom: 16, color: 'var(--accent)' }}>CREATE GAME</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Game Type</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className={'btn' + (gameType === 'unranked' ? ' glow-border' : '')} onClick={() => setGameType('unranked')} style={{ flex: 1 }}>UNRANKED</button>
                  <button className={'btn btn-accent2' + (gameType === 'ranked' ? ' glow-border' : '')} onClick={() => setGameType('ranked')} style={{ flex: 1 }}>RANKED</button>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Player Password (optional)</div>
                <input className="input" type="password" placeholder="Leave empty for open game" value={playerPw} onChange={e => setPlayerPw(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Spectator Password (optional)</div>
                <input className="input" type="password" placeholder="Leave empty for open spectating" value={specPw} onChange={e => setSpecPw(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" style={{ flex: 1 }} onClick={() => setCreating(false)}>CANCEL</button>
                <button className="btn btn-success" style={{ flex: 1 }} onClick={createGame}>CREATE</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Password modal */}
      {joinTarget && (
        <div className="modal-overlay" onClick={() => { setJoinTarget(null); setJoinPw(''); }}>
          <div className="modal animate-in" onClick={e => e.stopPropagation()}>
            <h3 className="orbit-font" style={{ marginBottom: 16, color: 'var(--accent)' }}>PASSWORD REQUIRED</h3>
            <input className="input" type="password" placeholder="Enter password..." value={joinPw}
              onChange={e => setJoinPw(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') joinRoom(joinTarget.room, joinTarget.asSpectator, joinPw); }}
              autoFocus />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => { setJoinTarget(null); setJoinPw(''); }}>CANCEL</button>
              <button className="btn btn-success" style={{ flex: 1 }} onClick={() => joinRoom(joinTarget.room, joinTarget.asSpectator, joinPw)}>JOIN</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
//  APP ROOT
// ═══════════════════════════════════════════
function App() {
  const [user, setUser] = useState(null);
  const [screen, setScreen] = useState('menu');
  const [loading, setLoading] = useState(true);
  const [notif, setNotif] = useState(null);

  const notify = useCallback((message, type) => {
    setNotif({ message, type, id: Date.now() });
  }, []);

  // Auto-login + load card DB
  useEffect(() => {
    (async () => {
      try {
        await loadCardDB();
        const data = await api('/auth/me');
        if (data.user) {
          setUser(data.user);
          AUTH_TOKEN = data.token || null;
          if (AUTH_TOKEN) socket.emit('auth', AUTH_TOKEN);
        }
      } catch {}
      setLoading(false);
    })();

    // Listen for game reconnection
    const onReconnectGame = (state) => {
      if (state.reconnected) {
        _pendingGameState = state;
        setScreen('play');
      }
    };
    socket.on('game_state', onReconnectGame);
    return () => socket.off('game_state', onReconnectGame);
  }, []);

  // Sync accent color to user's profile color
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', user && user.color ? user.color : '#00f0ff');
  }, [user?.color]);

  // Escape key → return to main menu from any sub-screen (except play — handled by PlayScreen/GameBoard)
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && user && screen !== 'menu' && screen !== 'play') {
        setScreen('menu');
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [screen, user]);

  if (loading) {
    return (
      <div className="screen-center">
        <div className="pixel-font" style={{ color: 'var(--accent)', animation: 'pulse 1.5s infinite', fontSize: 14 }}>LOADING...</div>
      </div>
    );
  }

  const ctx = { user, setUser, screen, setScreen, notify };

  return (
    <AppContext.Provider value={ctx}>
      {notif && <Notification key={notif.id} message={notif.message} type={notif.type} onClose={() => setNotif(null)} />}
      {!user ? <AuthScreen /> :
        screen === 'menu' ? <MainMenu /> :
        screen === 'play' ? <PlayScreen /> :
        screen === 'deckbuilder' ? <DeckBuilder /> :
        screen === 'profile' ? <ProfileScreen /> :
        <MainMenu />}
    </AppContext.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
