/* ============================================================
   PIXEL PARTIES TCG — Frontend Application
   ============================================================ */
const { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, createContext, useContext } = React;

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
let SKINS_DB = {}; // cardName → [skinName, ...]

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

  // Load skins registry
  try {
    const skRes = await fetch('/api/skins');
    const skData = await skRes.json();
    SKINS_DB = skData.skins || {};
  } catch { SKINS_DB = {}; }
}

function cardImageUrl(cardName, skinOverrides) {
  // If a skin is selected for this card, use the skin image
  if (skinOverrides && skinOverrides[cardName]) {
    return '/cards/skins/' + encodeURIComponent(skinOverrides[cardName]) + '.png';
  }
  const file = AVAILABLE_MAP[cardName];
  return file ? '/cards/' + encodeURIComponent(file) : null;
}

function skinImageUrl(skinName) {
  return '/cards/skins/' + encodeURIComponent(skinName) + '.png';
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
  // Main deck potions require Nicolas
  const mainPotions = (deck.mainDeck || []).filter(n => CARDS_BY_NAME[n]?.cardType === 'Potion');
  if (mainPotions.length > 0 && !hasNicolasHero(deck)) reasons.push('Main deck contains Potions but no Nicolas, the Hidden Alchemist');
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

function hasNicolasHero(deck) {
  return (deck.heroes || []).some(h => h?.hero === 'Nicolas, the Hidden Alchemist');
}

function canAddCard(deck, cardName, section) {
  const card = CARDS_BY_NAME[cardName];
  if (!card) return false;
  const ct = card.cardType;
  // Token cards cannot be added to any deck
  if (ct === 'Token') return false;
  // Per-card copy limit (e.g. Performance has maxCopies: 4 despite being an Ability)
  const cardMax = card.maxCopies;
  // Heroes: 1 team-slot copy + up to 4 in main / side deck → 5 global cap.
  const heroGlobalMax = cardMax || 5;
  if (section === 'main') {
    // Heroes legal in main deck (Goff-style attach mechanic).
    if (ct === 'Hero') {
      if ((deck.mainDeck || []).length >= 60) return false;
      const inMain = (deck.mainDeck || []).filter(n => n === cardName).length;
      if (inMain >= 4) return false;
      if (countInDeck(deck, cardName) >= heroGlobalMax) return false;
      return true;
    }
    // Potions allowed in main deck ONLY if Nicolas is a hero
    if (ct === 'Potion') {
      if (!hasNicolasHero(deck)) return false;
      if ((deck.mainDeck || []).length >= 60) return false;
      // Total potions across main + potion deck cannot exceed 15
      const totalPotions = (deck.mainDeck || []).filter(n => CARDS_BY_NAME[n]?.cardType === 'Potion').length
        + (deck.potionDeck || []).length;
      if (totalPotions >= 15) return false;
      if (countInDeck(deck, cardName) >= (cardMax || 2)) return false;
      return true;
    }
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
    // Team slot caps at 1 of each Hero regardless of how many copies
    // sit in main/side deck.
    const inTeam = (deck.heroes || []).filter(h => h?.hero === cardName).length;
    if (inTeam >= 1) return false;
    if (countInDeck(deck, cardName) >= heroGlobalMax) return false;
    return true;
  }
  if (section === 'side') {
    if ((deck.sideDeck || []).length >= 15) return false;
    if (ct === 'Ability' && !cardMax) return true; // Unlimited unless maxCopies set
    if (ct === 'Hero') {
      const inSide = (deck.sideDeck || []).filter(n => n === cardName).length;
      if (inSide >= 4) return false;
      if (countInDeck(deck, cardName) >= heroGlobalMax) return false;
      return true;
    }
    const maxC = cardMax || (ct === 'Potion' ? 2 : 4);
    if (countInDeck(deck, cardName) >= maxC) return false;
    return true;
  }
  return false;
}

function typeColor(ct) {
  const m = { Hero:'#aa44ff', 'Ascended Hero':'#6622aa', Creature:'#44dd44', Spell:'#ff4444',
    Attack:'#ff4444', Artifact:'#ffd700', Potion:'#a0703c', Ability:'#44aaff', Token:'#888' };
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

function CardMini({ card, onClick, onRightClick, count, maxCount, dimmed, style, dragData, inGallery, isCover, skins }) {
  const [tt, setTT] = useState(null);
  const imgUrl = cardImageUrl(card.name, skins);
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
      <div className={'card-mini ' + typeClass(card.cardType) + (dimmed ? ' dimmed' : '') + (foilClass ? ' ' + foilClass : '') + (isCover ? ' card-mini-cover' : '')}
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
        <button className="btn btn-big" onClick={() => setScreen('shop')} style={{ fontSize: 16, borderColor: '#ffd700', color: '#ffd700', background: 'rgba(255,215,0,.08)' }}>✦ SHOP</button>
        <button className="btn btn-big btn-success" onClick={() => setScreen('profile')} style={{ fontSize: 16 }}>♛ VIEW PROFILE</button>
      </div>
      <div style={{ marginTop: 30, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ color: user.color || 'var(--accent)', fontWeight: 700 }} className="orbit-font">{user.username}</span>
        <span className="badge" style={{ background: 'rgba(170,255,0,.12)', color: 'var(--accent3)' }}>ELO {user.elo}</span>
        <span className="badge" style={{ background: 'rgba(255,215,0,.12)', color: '#ffd700', display: 'flex', alignItems: 'center', gap: 4 }}>
          <img src="/data/sc.png" style={{ width: 14, height: 14, imageRendering: 'pixelated' }} /> {user.sc || 0}
        </span>
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

  // Sleeve gallery (was cardback gallery)
  const [showSleeveGallery, setShowSleeveGallery] = useState(false);
  const [uploadedCardbacks, setUploadedCardbacks] = useState([]);
  const [ownedSleeves, setOwnedSleeves] = useState([]);

  // Avatar gallery
  const [showAvatarGallery, setShowAvatarGallery] = useState(false);
  const [standardAvatars, setStandardAvatars] = useState([]);
  const [ownedAvatars, setOwnedAvatars] = useState([]);

  // Board gallery
  const [showBoardGallery, setShowBoardGallery] = useState(false);
  const [board, setBoard] = useState(user.board || null);
  const [ownedBoards, setOwnedBoards] = useState([]);

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
    // Load standard avatars and owned shop items
    api('/profile/standard-avatars').then(d => setStandardAvatars(d.avatars || [])).catch(() => {});
    api('/shop/owned').then(d => {
      setOwnedAvatars(d.owned?.avatar || []);
      setOwnedSleeves(d.owned?.sleeve || []);
      setOwnedBoards(d.owned?.board || []);
    }).catch(() => {});
  }, []);

  // Intercept Escape to close gallery modals
  useEffect(() => {
    if (!showSleeveGallery && !showAvatarGallery && !showBoardGallery) return;
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        setShowSleeveGallery(false);
        setShowAvatarGallery(false);
        setShowBoardGallery(false);
      }
    };
    window.addEventListener('keydown', handleEsc, true);
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, [showSleeveGallery, showAvatarGallery, showBoardGallery]);

  // Default avatar to first available if none set
  useEffect(() => {
    if (!avatar && standardAvatars.length > 0) {
      setAvatar('/avatars/' + encodeURIComponent(standardAvatars[0]));
    }
  }, [standardAvatars]);

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

  // Quick-save a single field without touching other unsaved edits
  const quickSaveAvatar = async (newAvatar) => {
    setAvatar(newAvatar);
    setShowAvatarGallery(false);
    try {
      const data = await api('/profile', { method: 'PUT', body: JSON.stringify({
        color: user.color || '#00f0ff', avatar: newAvatar, cardback: user.cardback, bio: user.bio || ''
      })});
      setUser(data.user);
    } catch (e) { notify(e.message, 'error'); }
  };

  const quickSaveSleeve = async (newSleeve) => {
    setCardback(newSleeve);
    setShowSleeveGallery(false);
    try {
      const data = await api('/profile', { method: 'PUT', body: JSON.stringify({
        color: user.color || '#00f0ff', avatar: user.avatar, cardback: newSleeve, bio: user.bio || ''
      })});
      setUser(data.user);
    } catch (e) { notify(e.message, 'error'); }
  };

  const quickSaveBoard = async (newBoard) => {
    setBoard(newBoard);
    setShowBoardGallery(false);
    try {
      const data = await api('/profile', { method: 'PUT', body: JSON.stringify({
        color: user.color || '#00f0ff', avatar: user.avatar, cardback: user.cardback, bio: user.bio || '', board: newBoard
      })});
      setUser(data.user);
    } catch (e) { notify(e.message, 'error'); }
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
              <div className="profile-avatar-frame" style={{ borderColor: rank.color, boxShadow: `0 0 20px ${rank.glow}, 0 0 40px ${rank.glow}, inset 0 0 15px ${rank.glow}`, cursor: 'pointer' }}
                onClick={() => setShowAvatarGallery(true)}>
                <div className="profile-avatar-inner">
                  {avatar
                    ? <img src={avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 56, opacity: 0.5 }}>👤</span>}
                </div>
                <div className="profile-avatar-upload-overlay">
                  <span>✎</span>
                </div>
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

            {/* ELO + SC display */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="orbit-font" style={{ fontSize: 22, fontWeight: 700, color: rank.color }}>{user.elo || 1000}</span>
                <span style={{ fontSize: 12, color: 'var(--text2)' }}>ELO</span>
              </div>
              <span style={{ color: 'var(--bg4)', fontSize: 20 }}>│</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }} className="sc-icon-hover-parent">
                <div style={{ position: 'relative', cursor: 'pointer' }} className="sc-icon-wrapper">
                  <img src="/data/sc.png" style={{ width: 20, height: 20, imageRendering: 'pixelated' }} />
                  <div className="sc-icon-tooltip">
                    <img src="/data/sc.png" style={{ width: 96, height: 96, imageRendering: 'pixelated' }} />
                  </div>
                </div>
                <span className="orbit-font" style={{ fontSize: 20, fontWeight: 700, color: '#ffd700' }}>{user.sc || 0}</span>
                <span style={{ fontSize: 11, color: 'var(--text2)' }}>SC</span>
              </div>
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

          {/* Combined: Sleeve + Battle Record + Name Color + Top Heroes */}
          <div className="profile-section profile-section-wide" style={{ flex: 'none' }}>
            <div style={{ display: 'flex', gap: 28, alignItems: 'stretch' }}>

              {/* Sleeve — large preview */}
              <div className="profile-cardback-preview profile-cardback-xl profile-cardback-clickable" onClick={() => setShowSleeveGallery(true)}>
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

                {/* Sleeve info */}
                <div style={{ paddingTop: 14, paddingBottom: 14, borderBottom: '1px solid var(--bg4)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className="profile-section-label">SLEEVE</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, flex: 1 }}>
                      {cardback ? 'Custom Sleeve' : 'Default Sleeve'}
                    </div>
                    <button className="btn" style={{ padding: '6px 16px', fontSize: 11 }}
                      onClick={() => setShowSleeveGallery(true)}>
                      CHANGE
                    </button>
                  </div>
                </div>

                {/* Board info */}
                <div style={{ paddingTop: 14, flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className="profile-section-label">BOARD</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {board ? (
                      <div style={{ width: 80, height: 45, borderRadius: 4, overflow: 'hidden', border: '1px solid var(--bg4)', flexShrink: 0 }}>
                        <img src={'/data/shop/boards/' + encodeURIComponent(board) + '.png'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ) : null}
                    <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, flex: 1 }}>
                      {board ? board : 'Default Board'}
                    </div>
                    <button className="btn" style={{ padding: '6px 16px', fontSize: 11 }}
                      onClick={() => setShowBoardGallery(true)}>
                      CHANGE
                    </button>
                  </div>
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

          {/* Sleeve Gallery Modal */}
          {showSleeveGallery && (
            <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowSleeveGallery(false); }}>
              <div className="modal" style={{ maxWidth: 620, width: '90vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
                  <h3 className="orbit-font" style={{ fontSize: 14, color: 'var(--accent)', flex: 1 }}>SELECT SLEEVE</h3>
                  <button className="btn" style={{ padding: '4px 12px', fontSize: 10 }} onClick={() => setShowSleeveGallery(false)}>✕ CLOSE</button>
                </div>
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  <div className="profile-cb-gallery">
                    {/* Default sleeve */}
                    <div className={'profile-cb-gallery-item' + (!cardback ? ' active' : '')} onClick={() => quickSaveSleeve(null)}>
                      <div className="profile-cb-gallery-card">
                        <img src="/cardback.png" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <div className="profile-cb-gallery-label">Default</div>
                    </div>
                    {/* Owned shop sleeves */}
                    {ownedSleeves.map(sleeveId => (
                      <div key={sleeveId} className={'profile-cb-gallery-item' + (cardback === '/data/shop/sleeves/' + sleeveId + '.png' ? ' active' : '')}
                        onClick={() => quickSaveSleeve('/data/shop/sleeves/' + sleeveId + '.png')}>
                        <div className="profile-cb-gallery-card">
                          <img src={'/data/shop/sleeves/' + encodeURIComponent(sleeveId) + '.png'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <div className="profile-cb-gallery-label">{sleeveId}</div>
                      </div>
                    ))}
                    {/* Previously uploaded cardbacks (legacy) */}
                    {uploadedCardbacks.map((cb, i) => (
                      <div key={'up' + i} className={'profile-cb-gallery-item' + (cardback === cb ? ' active' : '')} onClick={() => quickSaveSleeve(cb)}>
                        <div className="profile-cb-gallery-card">
                          <img src={cb} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <div className="profile-cb-gallery-label">Custom {i + 1}</div>
                      </div>
                    ))}
                  </div>
                  {ownedSleeves.length === 0 && uploadedCardbacks.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--text2)', fontSize: 11, marginTop: 12 }}>
                      Visit the Shop to unlock more sleeves!
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Avatar Gallery Modal */}
          {showAvatarGallery && (
            <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowAvatarGallery(false); }}>
              <div className="modal" style={{ maxWidth: 620, width: '90vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
                  <h3 className="orbit-font" style={{ fontSize: 14, color: 'var(--accent)', flex: 1 }}>SELECT AVATAR</h3>
                  <button className="btn" style={{ padding: '4px 12px', fontSize: 10 }} onClick={() => setShowAvatarGallery(false)}>✕ CLOSE</button>
                </div>
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  <div className="profile-avatar-gallery">
                    {/* Standard avatars (free) */}
                    {standardAvatars.map(file => {
                      const url = '/avatars/' + encodeURIComponent(file);
                      return (
                        <div key={file} className={'profile-avatar-gallery-item' + (avatar === url ? ' active' : '')}
                          onClick={() => quickSaveAvatar(url)}>
                          <div className="profile-avatar-gallery-img">
                            <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                          <div className="profile-cb-gallery-label">{file.replace(/\.[^.]+$/, '')}</div>
                        </div>
                      );
                    })}
                    {/* Owned shop avatars */}
                    {ownedAvatars.map(avatarId => {
                      const url = '/data/shop/avatars/' + encodeURIComponent(avatarId) + '.png';
                      return (
                        <div key={avatarId} className={'profile-avatar-gallery-item' + (avatar === url ? ' active' : '')}
                          onClick={() => quickSaveAvatar(url)}>
                          <div className="profile-avatar-gallery-img">
                            <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                          <div className="profile-cb-gallery-label">{avatarId}</div>
                        </div>
                      );
                    })}
                  </div>
                  {standardAvatars.length === 0 && ownedAvatars.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--text2)', fontSize: 11, marginTop: 12 }}>
                      Visit the Shop to unlock more avatars!
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Board Gallery Modal */}
          {showBoardGallery && (
            <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowBoardGallery(false); }}>
              <div className="modal" style={{ maxWidth: 620, width: '90vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
                  <h3 className="orbit-font" style={{ fontSize: 14, color: 'var(--accent)', flex: 1 }}>SELECT BOARD</h3>
                  <button className="btn" style={{ padding: '4px 12px', fontSize: 10 }} onClick={() => setShowBoardGallery(false)}>✕ CLOSE</button>
                </div>
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  <div className="profile-cb-gallery">
                    {/* Default board */}
                    <div className={'profile-cb-gallery-item' + (!board ? ' active' : '')} onClick={() => quickSaveBoard(null)}>
                      <div className="profile-cb-gallery-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg3)' }}>
                        <span style={{ fontSize: 11, color: 'var(--text2)' }}>Default</span>
                      </div>
                      <div className="profile-cb-gallery-label">Default</div>
                    </div>
                    {/* Owned shop boards */}
                    {ownedBoards.map(boardId => (
                      <div key={boardId} className={'profile-cb-gallery-item' + (board === boardId ? ' active' : '')}
                        onClick={() => quickSaveBoard(boardId)}>
                        <div className="profile-cb-gallery-card">
                          <img src={'/data/shop/boards/' + encodeURIComponent(boardId) + '.png'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <div className="profile-cb-gallery-label">{boardId}</div>
                      </div>
                    ))}
                  </div>
                  {ownedBoards.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--text2)', fontSize: 11, marginTop: 12 }}>
                      Visit the Shop to unlock boards!
                    </div>
                  )}
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
                  const img = d.repSkin ? skinImageUrl(d.repSkin) : getCardImage(d.repCard);
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
//  SHOP SCREEN
// ═══════════════════════════════════════════

// Purchase celebration overlay — centered on the bought item
function PurchaseCelebration({ cx, cy, onDone }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ox = cx ?? canvas.width / 2;
    const oy = cy ?? canvas.height / 2;
    const particles = [];
    const colors = ['#ffd700', '#ffaa00', '#fff8b0', '#ff00aa', '#00f0ff', '#aaff00', '#ff6600', '#ffffff'];
    const shapes = ['star', 'circle', 'diamond', 'spark'];
    // Burst from item position
    for (let i = 0; i < 120; i++) {
      const angle = (Math.PI * 2 * i / 120) + (Math.random() - 0.5) * 0.5;
      const speed = 3 + Math.random() * 9;
      particles.push({
        x: ox, y: oy,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 2,
        size: 3 + Math.random() * 8, color: colors[Math.floor(Math.random() * colors.length)],
        shape: shapes[Math.floor(Math.random() * shapes.length)],
        life: 1, decay: 0.008 + Math.random() * 0.012,
        rotation: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 0.2,
        gravity: 0.06 + Math.random() * 0.04,
      });
    }
    // Sparkle ring around item
    for (let i = 0; i < 40; i++) {
      const angle = (Math.PI * 2 * i / 40);
      const dist = 50 + Math.random() * 30;
      particles.push({
        x: ox + Math.cos(angle) * dist, y: oy + Math.sin(angle) * dist,
        vx: Math.cos(angle) * 1.5, vy: Math.sin(angle) * 1.5,
        size: 2 + Math.random() * 4, color: '#ffd700',
        shape: 'spark', life: 1, decay: 0.015 + Math.random() * 0.01,
        rotation: 0, rotSpeed: 0, gravity: 0,
      });
    }
    let frame;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      for (const p of particles) {
        if (p.life <= 0) continue;
        alive = true;
        p.x += p.vx; p.y += p.vy; p.vy += p.gravity;
        p.life -= p.decay; p.rotation += p.rotSpeed;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        const s = p.size * (0.5 + p.life * 0.5);
        if (p.shape === 'circle') {
          ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill();
        } else if (p.shape === 'diamond') {
          ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.6, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.6, 0); ctx.closePath(); ctx.fill();
        } else if (p.shape === 'star') {
          ctx.beginPath();
          for (let j = 0; j < 5; j++) {
            const a = (j * Math.PI * 2 / 5) - Math.PI / 2;
            const r = j % 2 === 0 ? s : s * 0.4;
            j === 0 ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            const a2 = ((j + 0.5) * Math.PI * 2 / 5) - Math.PI / 2;
            ctx.lineTo(Math.cos(a2) * s * 0.4, Math.sin(a2) * s * 0.4);
          }
          ctx.closePath(); ctx.fill();
        } else {
          ctx.fillRect(-s, -1, s * 2, 2);
          ctx.fillRect(-1, -s, 2, s * 2);
        }
        ctx.restore();
      }
      if (alive) frame = requestAnimationFrame(draw);
      else onDone();
    };
    frame = requestAnimationFrame(draw);
    const timer = setTimeout(onDone, 2500);
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); };
  }, []);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, pointerEvents: 'none' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
      <div className="shop-purchase-text" style={{ top: Math.max(40, (cy ?? window.innerHeight / 2) - 60), left: cx ?? '50%' }}>PURCHASED!</div>
    </div>
  );
}

function ShopScreen() {
  const { user, setUser, setScreen, notify } = useContext(AppContext);
  const [catalog, setCatalog] = useState(null);
  const [owned, setOwned] = useState({ avatar: [], sleeve: [], board: [], skin: [] });
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [tab, setTab] = useState('skins');
  const [skinFilter, setSkinFilter] = useState('');
  const [selected, setSelected] = useState(null); // { type, id }
  const [celebration, setCelebration] = useState(null); // { cx, cy } or null
  const [randomReveal, setRandomReveal] = useState(null); // { imgUrl, label, subtitle } or null

  useEffect(() => {
    (async () => {
      try {
        const [catData, ownData] = await Promise.all([
          api('/shop/catalog'),
          api('/shop/owned')
        ]);
        setCatalog(catData);
        setOwned(ownData.owned);
      } catch (e) { notify(e.message, 'error'); }
      setLoading(false);
    })();
  }, []);

  const toggleSelect = (type, id) => {
    setSelected(prev => (prev && prev.type === type && prev.id === id) ? null : { type, id });
  };

  // Get center coords of the clicked button's parent .shop-item
  const getItemCenter = (e) => {
    const item = e.target.closest('.shop-item') || e.target.closest('.shop-random-wrap');
    if (item) {
      const r = item.getBoundingClientRect();
      return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    }
    return { cx: e.clientX, cy: e.clientY };
  };

  const buyItem = async (itemType, itemId, price, e) => {
    if (e) e.stopPropagation();
    if (buying) return;
    if ((user.sc || 0) < price) { notify('Not enough SC!', 'error'); return; }
    const pos = e ? getItemCenter(e) : { cx: window.innerWidth / 2, cy: window.innerHeight / 2 };
    setBuying(true);
    try {
      const data = await api('/shop/buy', { method: 'POST', body: JSON.stringify({ itemType, itemId }) });
      setOwned(prev => ({ ...prev, [itemType]: [...prev[itemType], itemId] }));
      setUser(u => ({ ...u, sc: data.sc }));
      setCelebration(pos);
    } catch (e) { notify(e.message, 'error'); }
    setBuying(false);
  };

  const buyRandomSkin = async (e) => {
    if (buying) return;
    const rp = catalog?.randomPrices?.skin || 5;
    if ((user.sc || 0) < rp) { notify('Not enough SC!', 'error'); return; }
    const pos = e ? getItemCenter(e) : { cx: window.innerWidth / 2, cy: window.innerHeight / 2 };
    setBuying(true);
    try {
      const data = await api('/shop/buy-random-skin', { method: 'POST' });
      setOwned(prev => ({ ...prev, skin: [...prev.skin, data.skinName] }));
      setUser(u => ({ ...u, sc: data.sc }));
      setCelebration(pos);
      setRandomReveal({
        imgUrl: '/cards/skins/' + encodeURIComponent(data.skinName) + '.png',
        label: data.skinName,
        subtitle: data.heroName
      });
    } catch (e) { notify(e.message, 'error'); }
    setBuying(false);
  };

  const buyRandom = async (itemType, e) => {
    if (buying) return;
    const rp = catalog?.randomPrices?.[itemType] || 5;
    if ((user.sc || 0) < rp) { notify('Not enough SC!', 'error'); return; }
    const pos = e ? getItemCenter(e) : { cx: window.innerWidth / 2, cy: window.innerHeight / 2 };
    setBuying(true);
    try {
      const data = await api('/shop/buy-random', { method: 'POST', body: JSON.stringify({ itemType }) });
      setOwned(prev => ({ ...prev, [itemType]: [...prev[itemType], data.itemId] }));
      setUser(u => ({ ...u, sc: data.sc }));
      setCelebration(pos);
      const subdir = itemType === 'avatar' ? 'avatars' : 'sleeves';
      setRandomReveal({
        imgUrl: '/data/shop/' + subdir + '/' + encodeURIComponent(data.itemId) + '.png',
        label: null,
        subtitle: itemType === 'avatar' ? 'New Avatar!' : 'New Sleeve!'
      });
    } catch (e) { notify(e.message, 'error'); }
    setBuying(false);
  };

  if (loading || !catalog) {
    return <div className="screen-center"><div className="pixel-font" style={{ color: 'var(--accent)', animation: 'pulse 1.5s infinite' }}>Loading shop...</div></div>;
  }

  const prices = catalog.prices || { avatar: 10, sleeve: 10, board: 10, skin: 10 };
  const randomPrices = catalog.randomPrices || { skin: 5, avatar: 5, sleeve: 5 };
  const ownedSet = {
    avatar: new Set(owned.avatar),
    sleeve: new Set(owned.sleeve),
    board: new Set(owned.board),
    skin: new Set(owned.skin),
  };

  // Gather unique hero names for skin filter
  const heroNames = [...new Set((catalog.skins || []).map(s => s.heroName))].sort();
  const filteredSkins = skinFilter
    ? (catalog.skins || []).filter(s => s.heroName === skinFilter)
    : (catalog.skins || []);

  const isSelected = (type, id) => selected && selected.type === type && selected.id === id;

  const renderItemGrid = (items, type, imgBase) => {
    if (items.length === 0) return <div className="shop-empty">No items available yet</div>;
    const unownedCount = items.filter(it => !ownedSet[type].has(it.id)).length;
    const hasRandom = type === 'avatar' || type === 'sleeve';
    return (
      <React.Fragment>
        {hasRandom && (
          <div className="shop-random-wrap">
            <button className="btn shop-random-btn" disabled={buying || unownedCount === 0 || (user.sc || 0) < (randomPrices[type] || 5)}
              onClick={(e) => buyRandom(type, e)}>
              🎲 Random {type === 'avatar' ? 'Avatar' : 'Sleeve'} — <img src="/data/sc.png" className="shop-sc-icon" /> {randomPrices[type] || 5}
            </button>
            <span className="shop-random-hint">{unownedCount > 0 ? unownedCount + ' left to collect' : 'All collected!'}</span>
          </div>
        )}
        <div className="shop-grid">
          {items.map(item => {
            const isOwned = ownedSet[type].has(item.id);
            const sel = isSelected(type, item.id);
            return (
              <div key={item.id} className={'shop-item' + (isOwned ? ' shop-owned' : '') + (sel ? ' shop-selected' : '')}
                onClick={() => toggleSelect(type, item.id)}>
                <div className="shop-item-img-wrap">
                  <img src={imgBase + encodeURIComponent(item.file)} draggable={false} />
                  {isOwned && <div className="shop-owned-badge">OWNED</div>}
                </div>
                {!isOwned && (
                  <button className="btn shop-buy-btn" disabled={buying || (user.sc || 0) < prices[type]}
                    onClick={(e) => buyItem(type, item.id, prices[type], e)}>
                    <img src="/data/sc.png" className="shop-sc-icon" /> {prices[type]}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </React.Fragment>
    );
  };

  const renderSkinGrid = () => {
    if ((catalog.skins || []).length === 0) return <div className="shop-empty">No skins available yet</div>;
    const allOwned = ownedSet.skin;
    const unownedCount = (catalog.skins || []).filter(s => !allOwned.has(s.id)).length;
    return (
      <React.Fragment>
        {/* Random Skin Button */}
        <div className="shop-random-wrap">
          <button className="btn shop-random-btn" disabled={buying || unownedCount === 0 || (user.sc || 0) < (randomPrices.skin || 5)}
            onClick={(e) => buyRandomSkin(e)}>
            🎲 Random Skin — <img src="/data/sc.png" className="shop-sc-icon" /> {randomPrices.skin || 5}
          </button>
          <span className="shop-random-hint">{unownedCount > 0 ? unownedCount + ' skin' + (unownedCount !== 1 ? 's' : '') + ' left to collect' : 'All collected!'}</span>
        </div>
        {/* Hero filter */}
        {heroNames.length > 1 && (
          <div className="shop-filter-row">
            <select className="select" value={skinFilter} onChange={e => setSkinFilter(e.target.value)} style={{ maxWidth: 260, fontSize: 11 }}>
              <option value="">All Heroes</option>
              {heroNames.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
        )}
        <div className="shop-grid shop-grid-skins">
          {filteredSkins.map(skin => {
            const isOwned = ownedSet.skin.has(skin.id);
            const sel = isSelected('skin', skin.id);
            return (
              <div key={skin.id} className={'shop-item shop-skin-item' + (isOwned ? ' shop-owned' : ' shop-unowned-skin') + (sel ? ' shop-selected' : '')}
                onClick={() => toggleSelect('skin', skin.id)}>
                <div className="shop-item-img-wrap">
                  <img src={'/cards/skins/' + encodeURIComponent(skin.skinName) + '.png'} draggable={false}
                    className={!isOwned ? 'shop-skin-locked' : ''} />
                  {isOwned && <div className="shop-owned-badge">OWNED</div>}
                </div>
                <div className="shop-skin-name" title={skin.heroName}>{skin.skinName}</div>
                <div className="shop-item-hero">{skin.heroName}</div>
                {!isOwned && (
                  <button className="btn shop-buy-btn" disabled={buying || (user.sc || 0) < prices.skin}
                    onClick={(e) => buyItem('skin', skin.id, prices.skin, e)}>
                    <img src="/data/sc.png" className="shop-sc-icon" /> {prices.skin}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </React.Fragment>
    );
  };

  const tabs = [
    { id: 'skins', label: '🎨 Skins', count: (catalog.skins || []).length },
    { id: 'avatars', label: '👤 Avatars', count: (catalog.avatars || []).length },
    { id: 'sleeves', label: '🃏 Sleeves', count: (catalog.sleeves || []).length },
    { id: 'boards', label: '🎮 Boards', count: (catalog.boards || []).length },
  ];

  return (
    <div className="screen-full" style={{ background: 'linear-gradient(180deg, #0a0a12 0%, #12101f 40%, #0a0a12 100%)' }}>
      {celebration && <PurchaseCelebration cx={celebration.cx} cy={celebration.cy} onDone={() => setCelebration(null)} />}
      {randomReveal && (
        <div className="modal-overlay" style={{ zIndex: 90000 }} onClick={() => setRandomReveal(null)}>
          <div className="shop-reveal-modal animate-in" onClick={e => e.stopPropagation()}>
            <div className="shop-reveal-glow" />
            <div className="shop-reveal-img-wrap">
              <img src={randomReveal.imgUrl} draggable={false} />
            </div>
            {randomReveal.label && <div className="shop-reveal-label">{randomReveal.label}</div>}
            {randomReveal.subtitle && <div className="shop-reveal-subtitle">{randomReveal.subtitle}</div>}
            <button className="btn" style={{ marginTop: 16, padding: '8px 32px', fontSize: 13, borderColor: '#ffd700', color: '#ffd700' }}
              onClick={() => setRandomReveal(null)}>NICE!</button>
          </div>
        </div>
      )}
      <div className="top-bar">
        <button className="btn" style={{ padding: '4px 12px', fontSize: 10 }} onClick={() => setScreen('menu')}>← BACK</button>
        <h2 className="orbit-font" style={{ fontSize: 16, color: '#ffd700' }}>SHOP</h2>
        <div style={{ flex: 1 }} />
        <div className="badge" style={{ background: 'rgba(255,215,0,.12)', color: '#ffd700', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
          <img src="/data/sc.png" style={{ width: 16, height: 16, imageRendering: 'pixelated' }} /> {user.sc || 0} SC
        </div>
      </div>
      <div className="shop-tabs">
        {tabs.map(t => (
          <button key={t.id} className={'shop-tab' + (tab === t.id ? ' shop-tab-active' : '')} onClick={() => setTab(t.id)}>
            {t.label} <span className="shop-tab-count">{t.count}</span>
          </button>
        ))}
      </div>
      <div className="shop-content animate-in">
        {tab === 'skins' && renderSkinGrid()}
        {tab === 'avatars' && renderItemGrid(catalog.avatars || [], 'avatar', '/data/shop/avatars/')}
        {tab === 'sleeves' && renderItemGrid(catalog.sleeves || [], 'sleeve', '/data/shop/sleeves/')}
        {tab === 'boards' && renderItemGrid(catalog.boards || [], 'board', '/data/shop/boards/')}
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
  const [sampleDecks, setSampleDecks] = useState([]);
  const [showSamples, setShowSamples] = useState(true);
  const [sampleActive, setSampleActive] = useState(-1);
  const isSampleMode = sampleActive >= 0;
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

  // Load decks + sample decks
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
      try { const sd = await api('/sample-decks'); setSampleDecks(sd.decks || []); } catch (e) { /* ignore */ }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    const close = () => setCtxMenu(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, []);

  // Escape closes context menu / skin gallery before navigating away
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        if (skinGallery) { e.stopImmediatePropagation(); setSkinGallery(null); return; }
        if (ctxMenu) { e.stopImmediatePropagation(); setCtxMenu(null); return; }
      }
    };
    window.addEventListener('keydown', handleEsc, true);
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, [ctxMenu, skinGallery]);

  // Current deck with unsaved overlay
  const currentDeck = useMemo(() => {
    const base = isSampleMode ? sampleDecks[sampleActive] : decks[activeIdx];
    if (!base) return null;
    const overlay = unsaved[base.id];
    return overlay ? { ...base, ...overlay } : base;
  }, [decks, activeIdx, unsaved, sampleDecks, sampleActive, isSampleMode]);

  // Section key mapping
  const SK = { main: 'mainDeck', heroes: 'heroes', potion: 'potionDeck', side: 'sideDeck' };

  // Update one or more sections with per-section history
  const updateSections = (changes) => {
    const base = isSampleMode ? sampleDecks[sampleActive] : decks[activeIdx];
    const deckId = base?.id;
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
    const deckId = currentDeck?.id; if (!deckId) return;
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
    const deckId = currentDeck?.id; if (!deckId) return;
    const h = getSH(deckId, sec); if (h.idx >= h.stack.length - 1) return;
    h.idx++;
    setUnsaved(prev => ({ ...prev, [deckId]: { ...(prev[deckId] || {}), [SK[sec]]: h.stack[h.idx] } }));
    setHistoryTick(t => t + 1);
  };
  const canUndoSec = (sec) => { const id = currentDeck?.id; const h = id && shRef.current[id]?.[sec]; return h && h.idx > 0; };
  const canRedoSec = (sec) => { const id = currentDeck?.id; const h = id && shRef.current[id]?.[sec]; return h && h.idx < h.stack.length - 1; };

  // ——— Server operations ———
  const saveCurrent = async () => {
    if (!currentDeck) return;
    try {
      const data = await api('/decks/' + currentDeck.id, {
        method: 'PUT',
        body: JSON.stringify({ name: currentDeck.name, mainDeck: currentDeck.mainDeck, heroes: currentDeck.heroes, potionDeck: currentDeck.potionDeck, sideDeck: currentDeck.sideDeck, isDefault: currentDeck.isDefault, coverCard: currentDeck.coverCard || '', skins: currentDeck.skins || {} })
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
        if (isSampleMode) {
          // Sample deck rename → create a new real deck with this name and content
          const created = await api('/decks', { method: 'POST', body: JSON.stringify({ name: newName }) });
          await api('/decks/' + created.deck.id, { method: 'PUT', body: JSON.stringify({ name: newName, mainDeck: currentDeck.mainDeck, heroes: currentDeck.heroes, potionDeck: currentDeck.potionDeck, sideDeck: currentDeck.sideDeck, isDefault: false }) });
          const final = await api('/decks/' + created.deck.id);
          const sampleId = currentDeck.id;
          setUnsaved(prev => { const n = { ...prev }; delete n[sampleId]; return n; });
          delete shRef.current[sampleId];
          const newDecks = [...decks, final.deck]; setDecks(newDecks); setActiveIdx(newDecks.length - 1); setSampleActive(-1);
          notify('Sample deck saved as "' + newName + '"!', 'success');
        } else {
          const data = await api('/decks/' + currentDeck.id, {
            method: 'PUT',
            body: JSON.stringify({ name: newName, mainDeck: currentDeck.mainDeck, heroes: currentDeck.heroes, potionDeck: currentDeck.potionDeck, sideDeck: currentDeck.sideDeck, isDefault: currentDeck.isDefault, coverCard: currentDeck.coverCard || '', skins: currentDeck.skins || {} })
          });
          const newDecks = [...decks]; newDecks[activeIdx] = data.deck;
          const id = currentDeck.id;
          setUnsaved(prev => { const n = { ...prev }; delete n[id]; return n; });
          delete shRef.current[id];
          setHistoryTick(t => t + 1);
          setDecks(newDecks);
          notify('Deck renamed & saved!', 'success');
        }
      } catch (e) { notify(e.message, 'error'); }
    } else { setRenaming(false); }
  };

  const saveAs = async () => {
    if (!currentDeck) return;
    const newName = prompt('New deck name:', currentDeck.name + ' (Copy)');
    if (!newName) return;
    try {
      if (isSampleMode) {
        // Sample deck: create a brand new DB deck with the sample's content
        const created = await api('/decks', { method: 'POST', body: JSON.stringify({ name: newName }) });
        await api('/decks/' + created.deck.id, { method: 'PUT', body: JSON.stringify({ name: newName, mainDeck: currentDeck.mainDeck, heroes: currentDeck.heroes, potionDeck: currentDeck.potionDeck, sideDeck: currentDeck.sideDeck, isDefault: false }) });
        const final = await api('/decks/' + created.deck.id);
        const sampleId = currentDeck.id;
        setUnsaved(prev => { const n = { ...prev }; delete n[sampleId]; return n; });
        delete shRef.current[sampleId];
        const newDecks = [...decks, final.deck]; setDecks(newDecks); setActiveIdx(newDecks.length - 1); setSampleActive(-1);
      } else {
        await api('/decks/' + currentDeck.id, { method: 'PUT', body: JSON.stringify({ name: currentDeck.name, mainDeck: currentDeck.mainDeck, heroes: currentDeck.heroes, potionDeck: currentDeck.potionDeck, sideDeck: currentDeck.sideDeck, isDefault: currentDeck.isDefault, coverCard: currentDeck.coverCard || '', skins: currentDeck.skins || {} }) });
        const id = currentDeck.id;
        setUnsaved(prev => { const n = { ...prev }; delete n[id]; return n; });
        delete shRef.current[id];
        const data = await api('/decks/' + currentDeck.id + '/saveas', { method: 'POST', body: JSON.stringify({ name: newName }) });
        const newDecks = [...decks, data.deck]; setDecks(newDecks); setActiveIdx(newDecks.length - 1);
      }
      notify('Saved as "' + newName + '"!', 'success');
    } catch (e) { notify(e.message, 'error'); }
  };

  const deleteDeck = async () => {
    if (isSampleMode || decks.length <= 1) return;
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
      let deckId = currentDeck.id;
      // If it's a sample deck, save it as a real deck first
      if (isSampleMode) {
        const created = await api('/decks', { method: 'POST', body: JSON.stringify({ name: currentDeck.name }) });
        deckId = created.deck.id;
        const final = await api('/decks/' + deckId, { method: 'PUT', body: JSON.stringify({
          name: currentDeck.name, mainDeck: currentDeck.mainDeck, heroes: currentDeck.heroes,
          potionDeck: currentDeck.potionDeck, sideDeck: currentDeck.sideDeck || [], isDefault: true,
        }) });
        const sampleId = currentDeck.id;
        setUnsaved(prev => { const n = { ...prev }; delete n[sampleId]; return n; });
        delete shRef.current[sampleId];
        const newDecks = [...decks, final.deck].map(d => ({ ...d, isDefault: d.id === deckId }));
        setDecks(newDecks);
        setActiveIdx(newDecks.length - 1);
        setSampleActive(-1);
        notify('Sample deck saved & set as default!', 'success');
        return;
      }
      await api('/decks/' + deckId, { method: 'PUT', body: JSON.stringify({ isDefault: true }) });
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
    const replacedHero = heroes[slot]?.hero;
    heroes[slot] = { hero: cardName, ability1: card.startingAbility1 || null, ability2: card.startingAbility2 || null };
    // Nicolas removal cleanup: if replacing Nicolas with another hero, move potions out of main deck
    if (replacedHero === 'Nicolas, the Hidden Alchemist' && cardName !== 'Nicolas, the Hidden Alchemist') {
      const mainDeck = [...(currentDeck.mainDeck || [])];
      const potionDeck = [...(currentDeck.potionDeck || [])];
      const cleanedMain = [];
      for (const cn of mainDeck) {
        if (CARDS_BY_NAME[cn]?.cardType === 'Potion') {
          if (potionDeck.length < 15) potionDeck.push(cn);
        } else {
          cleanedMain.push(cn);
        }
      }
      updateSections({ heroes, main: cleanedMain, potion: potionDeck });
    } else {
      updateSections({ heroes });
    }
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
      // Nicolas removal: move main deck Potions back to potion deck
      if (cardName === 'Nicolas, the Hidden Alchemist') {
        const mainDeck = [...(currentDeck.mainDeck || [])];
        const potionDeck = [...(currentDeck.potionDeck || [])];
        const potionsInMain = [];
        const cleanedMain = [];
        for (const cn of mainDeck) {
          if (CARDS_BY_NAME[cn]?.cardType === 'Potion') potionsInMain.push(cn);
          else cleanedMain.push(cn);
        }
        // Move as many as possible to potion deck (cap 15)
        for (const pn of potionsInMain) {
          if (potionDeck.length < 15) potionDeck.push(pn);
          // else: overflow — removed from deck entirely
        }
        updateSections({ heroes, main: cleanedMain, potion: potionDeck });
      } else {
        updateSections({ heroes });
      }
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

  // Cover card management — auto-saves immediately (cover only, not rest of deck)
  const setCoverCard = useCallback(async (cardName) => {
    const base = isSampleMode ? sampleDecks[sampleActive] : decks[activeIdx];
    const deckId = base?.id;
    if (!deckId) return;
    // Update local state immediately for visual feedback
    if (!base.isSample) {
      const newDecks = [...decks];
      newDecks[activeIdx] = { ...newDecks[activeIdx], coverCard: cardName };
      setDecks(newDecks);
      // Also clear from unsaved overlay if it was there
      setUnsaved(prev => {
        const overlay = prev[deckId];
        if (!overlay) return prev;
        const n = { ...prev, [deckId]: { ...overlay } };
        delete n[deckId].coverCard;
        if (Object.keys(n[deckId]).length === 0) delete n[deckId];
        return n;
      });
      // Save just the cover card to the server
      try {
        await api('/decks/' + deckId, { method: 'PUT', body: JSON.stringify({ coverCard: cardName || '' }) });
      } catch (e) { /* silent */ }
    } else {
      // For sample decks, just use unsaved overlay (can't save to server)
      setUnsaved(prev => ({
        ...prev,
        [deckId]: { ...(prev[deckId] || {}), coverCard: cardName }
      }));
    }
  }, [decks, activeIdx, sampleDecks, sampleActive, isSampleMode]);

  // Auto-clear cover card if it's no longer in any section
  useEffect(() => {
    if (!currentDeck?.coverCard) return;
    const allCards = [
      ...(currentDeck.mainDeck || []),
      ...(currentDeck.potionDeck || []),
      ...(currentDeck.sideDeck || []),
      ...(currentDeck.heroes || []).filter(h => h?.hero).map(h => h.hero),
    ];
    if (!allCards.includes(currentDeck.coverCard)) {
      setCoverCard('');
    }
  }, [currentDeck?.mainDeck, currentDeck?.potionDeck, currentDeck?.sideDeck, currentDeck?.heroes]);

  // Skin management — auto-saves immediately (like cover card)
  const [skinGallery, setSkinGallery] = useState(null); // { cardName, skins: [...] }
  const [ownedSkins, setOwnedSkins] = useState(null); // Set of owned skin IDs (null = loading)

  // Load owned skins from shop
  useEffect(() => {
    (async () => {
      try {
        const data = await api('/shop/owned');
        setOwnedSkins(new Set(data.owned?.skin || []));
      } catch { setOwnedSkins(new Set()); }
    })();
  }, []);

  const setSkin = useCallback(async (cardName, skinName) => {
    const base = isSampleMode ? sampleDecks[sampleActive] : decks[activeIdx];
    const deckId = base?.id;
    if (!deckId) return;
    const oldSkins = currentDeck?.skins || {};
    const newSkins = { ...oldSkins };
    if (skinName) newSkins[cardName] = skinName;
    else delete newSkins[cardName];

    if (!base.isSample) {
      const newDecks = [...decks];
      newDecks[activeIdx] = { ...newDecks[activeIdx], skins: newSkins };
      setDecks(newDecks);
      setUnsaved(prev => {
        const overlay = prev[deckId];
        if (!overlay) return prev;
        const n = { ...prev, [deckId]: { ...overlay } };
        delete n[deckId].skins;
        if (Object.keys(n[deckId]).length === 0) delete n[deckId];
        return n;
      });
      try {
        await api('/decks/' + deckId, { method: 'PUT', body: JSON.stringify({ skins: newSkins }) });
      } catch (e) { /* silent */ }
    } else {
      setUnsaved(prev => ({
        ...prev,
        [deckId]: { ...(prev[deckId] || {}), skins: newSkins }
      }));
    }
  }, [decks, activeIdx, sampleDecks, sampleActive, isSampleMode, currentDeck?.skins]);

  // Auto-clear skins for cards no longer in any section
  useEffect(() => {
    if (!currentDeck?.skins || Object.keys(currentDeck.skins).length === 0) return;
    const allCards = new Set([
      ...(currentDeck.mainDeck || []),
      ...(currentDeck.potionDeck || []),
      ...(currentDeck.sideDeck || []),
      ...(currentDeck.heroes || []).filter(h => h?.hero).map(h => h.hero),
    ]);
    for (const cardName of Object.keys(currentDeck.skins)) {
      if (!allCards.has(cardName)) setSkin(cardName, null);
    }
  }, [currentDeck?.mainDeck, currentDeck?.potionDeck, currentDeck?.sideDeck, currentDeck?.heroes]);

  // Left-click deck card → cover card + skin menu
  const showCoverMenu = useCallback((cardName, e) => {
    if (!currentDeck) return;
    const isCover = currentDeck.coverCard === cardName;
    const hasSkins = SKINS_DB[cardName] && SKINS_DB[cardName].length > 0;
    const items = [
      isCover
        ? { label: 'Remove as cover card', icon: '✕', color: 'var(--danger)', action: () => setCoverCard('') }
        : { label: 'Make this the cover card', icon: '⭐', color: '#ffd700', action: () => setCoverCard(cardName) },
    ];
    if (hasSkins) {
      const availOpts = ownedSkins ? SKINS_DB[cardName].filter(s => ownedSkins.has(s)) : SKINS_DB[cardName];
      if (availOpts.length > 0) {
        items.push({ label: 'Select skin', icon: '🎨', color: 'var(--accent)', action: () => setSkinGallery({ cardName, options: availOpts }) });
      }
    }
    setCtxMenu({ x: e.clientX, y: e.clientY, items });
  }, [currentDeck, setCoverCard]);

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

    // Nicolas removal cleanup: move main deck Potions to potion deck
    if (fromSection === 'hero' && targetSection !== 'hero' && cardName === 'Nicolas, the Hidden Alchemist') {
      const potionsInMain = [];
      const cleanedMain = [];
      for (const cn of tempDeck.mainDeck) {
        if (CARDS_BY_NAME[cn]?.cardType === 'Potion') potionsInMain.push(cn);
        else cleanedMain.push(cn);
      }
      for (const pn of potionsInMain) {
        if (tempDeck.potionDeck.length < 15) tempDeck.potionDeck.push(pn);
      }
      tempDeck.mainDeck = cleanedMain;
    }

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
    const nicolasCleanup = fromSection === 'hero' && targetSection !== 'hero' && cardName === 'Nicolas, the Hidden Alchemist';
    if (fromSection === 'main' || targetSection === 'main' || nicolasCleanup) changes.main = tempDeck.mainDeck;
    if (fromSection === 'heroes' || targetSection === 'heroes' || fromSection === 'hero' || targetSection === 'hero') changes.heroes = tempDeck.heroes;
    if (fromSection === 'potion' || targetSection === 'potion' || nicolasCleanup) changes.potion = tempDeck.potionDeck;
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
    reader.onload = async (ev) => {
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

      // Auto-save imported deck (only for user decks, not sample decks)
      const deckToSave = isSampleMode ? null : decks[activeIdx];
      if (deckToSave) {
        try {
          const data = await api('/decks/' + deckToSave.id, {
            method: 'PUT',
            body: JSON.stringify({ name: deckToSave.name, mainDeck: mainCards, heroes: importedHeroes, potionDeck: potionCards, sideDeck: sideCards, isDefault: deckToSave.isDefault, coverCard: deckToSave.coverCard || '', skins: deckToSave.skins || {} })
          });
          const newDecks = [...decks]; newDecks[activeIdx] = data.deck; setDecks(newDecks);
          setUnsaved(prev => { const n = { ...prev }; delete n[deckToSave.id]; return n; });
          delete shRef.current[deckToSave.id];
          setHistoryTick(t => t + 1);
        } catch (e) { /* silent — local state already updated */ }
      }

      notify('Deck imported' + (deckToSave ? ' & saved' : '') + '! (' + mainCards.length + ' main, ' + potionCards.length + ' potions, ' + sideCards.length + ' side)', 'success');
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
        <button className={'btn' + (hasUnsaved && !isSampleMode ? ' btn-flash-save' : '')} style={{ padding: '4px 10px', fontSize: 9 }} onClick={saveCurrent} disabled={!hasUnsaved || isSampleMode}
          title={isSampleMode ? 'Cannot save sample decks — use Save As or Rename' : ''}>💾 SAVE</button>
        <button className="btn btn-accent2" style={{ padding: '4px 10px', fontSize: 9 }} onClick={saveAs}>SAVE AS</button>
        <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: 9 }} onClick={deleteDeck} disabled={decks.length <= 1 || isSampleMode}>🗑 DELETE</button>
        <button className="btn btn-success" style={{ padding: '4px 10px', fontSize: 9 }} onClick={setDefault}
          disabled={!validation.legal || currentDeck?.isDefault}
          title={!validation.legal ? validation.reasons.join(', ') : currentDeck?.isDefault ? 'Already default' : isSampleMode ? 'Will save sample deck and set as default' : 'Set as default deck'}>
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
                <div key={d.id} className={'deck-list-item' + (i === activeIdx && !isSampleMode ? ' active' : '')} onClick={() => { setActiveIdx(i); setSampleActive(-1); }}>
                  {d.isDefault && <span style={{ color: '#ffd700', fontSize: 10 }}>★</span>}
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}{hasChanges ? ' *' : ''}</span>
                  <span style={{ fontSize: 8, color: v.legal ? 'var(--success)' : 'var(--danger)' }}>{v.legal ? '✓' : '✗'}</span>
                </div>
              );
            })}
            {sampleDecks.length > 0 && (
              <>
                <div style={{ padding: '6px 8px 4px', display: 'flex', alignItems: 'center', gap: 6, borderTop: '1px solid var(--bg4)', marginTop: 4 }}>
                  <span style={{ fontSize: 9, color: 'var(--text2)', fontWeight: 700, flex: 1 }}>SAMPLE DECKS</span>
                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 9, color: 'var(--accent)', padding: 0 }}
                    onClick={() => setShowSamples(v => !v)}>{showSamples ? 'Hide' : 'Show'}</button>
                </div>
                {showSamples && sampleDecks.map((d, i) => {
                  const v = isDeckLegal(d); const hasChanges = unsaved[d.id];
                  return (
                    <div key={d.id} className={'deck-list-item deck-list-sample' + (isSampleMode && sampleActive === i ? ' active' : '')}
                      onClick={() => setSampleActive(i)}>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}{hasChanges ? ' *' : ''}</span>
                      <span style={{ fontSize: 8, color: v.legal ? 'var(--success)' : 'var(--danger)' }}>{v.legal ? '✓' : '✗'}</span>
                    </div>
                  );
                })}
              </>
            )}
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
                            onClick={(e) => showCoverMenu(h.hero, e)} onRightClick={() => removeFrom(h.hero, 'hero')}
                            style={{ width: 166, height: 230, aspectRatio: 'unset' }} isCover={h.hero === currentDeck?.coverCard} skins={currentDeck?.skins} />
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
                    <CardMini card={card} onClick={(e) => showCoverMenu(item.card, e)} onRightClick={() => removeFrom(item.card,'main',item.origIdx)} isCover={item.card === currentDeck?.coverCard} skins={currentDeck?.skins} />
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
                    <CardMini card={card} onClick={(e) => showCoverMenu(item.card, e)} onRightClick={() => removeFrom(item.card,'potion',item.origIdx)} isCover={item.card === currentDeck?.coverCard} skins={currentDeck?.skins} />
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
                    <CardMini card={card} onClick={(e) => showCoverMenu(item.card, e)} onRightClick={() => removeFrom(item.card,'side',item.origIdx)} isCover={item.card === currentDeck?.coverCard} skins={currentDeck?.skins} />
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
      {skinGallery && (
        <div className="modal-overlay" style={{ background: 'rgba(0,0,0,.7)', zIndex: 10000 }} onClick={() => setSkinGallery(null)}>
          <div className="skin-gallery-panel animate-in" onClick={e => e.stopPropagation()}>
            <div className="orbit-font" style={{ fontSize: 14, color: 'var(--accent)', marginBottom: 12 }}>
              🎨 Select Skin — {skinGallery.cardName}
            </div>
            <div className="skin-gallery-grid">
              <div className={'skin-gallery-item' + (!currentDeck?.skins?.[skinGallery.cardName] ? ' skin-selected' : '')}
                onClick={() => { setSkin(skinGallery.cardName, null); setSkinGallery(null); }}>
                <img src={cardImageUrl(skinGallery.cardName)} draggable={false} />
                <div className="skin-gallery-label">Original</div>
              </div>
              {skinGallery.options.map(skinName => (
                <div key={skinName} className={'skin-gallery-item' + (currentDeck?.skins?.[skinGallery.cardName] === skinName ? ' skin-selected' : '')}
                  onClick={() => { setSkin(skinGallery.cardName, skinName); setSkinGallery(null); }}>
                  <img src={skinImageUrl(skinName)} draggable={false} />
                  <div className="skin-gallery-label">{skinName}</div>
                </div>
              ))}
            </div>
            <button className="btn" style={{ marginTop: 12, padding: '6px 20px', fontSize: 11 }}
              onClick={() => setSkinGallery(null)}>Close</button>
          </div>
        </div>
      )}

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

function BoardCard({ cardName, faceDown, flipped, label, hp, maxHp, atk, hpPosition, style, noTooltip, skins }) {
  const [tt, setTT] = useState(false);
  const card = faceDown ? null : CARDS_BY_NAME[cardName];
  const imgUrl = card ? cardImageUrl(card.name, skins) : null;

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
      {atk != null && hpPosition === 'hero' && (
        <div className="board-card-atk board-card-atk-hero">
          {atk}
        </div>
      )}
      {tt && card && ReactDOM.createPortal(
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
        </div>,
        document.body
      )}
    </div>
  );
}

function BoardZone({ type, cards, label, faceDown, flipped, stackLabel, children, onClick, onHoverCard, style }) {
  const cls = 'board-zone board-zone-' + type;
  const topCardName = cards && cards.length > 0 && !faceDown ? cards[cards.length - 1] : null;
  const suppressChildTooltip = !!onClick && !!onHoverCard;
  return (
    <div className={cls + (onClick && cards?.length > 0 ? ' board-zone-clickable' : '')}
      style={style}
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

// Floating damage number for creatures (finds by support zone data attributes)
function CreatureDamageNumber({ amount, ownerLabel, heroIdx, zoneSlot }) {
  const [pos, setPos] = useState(null);
  useEffect(() => {
    const el = document.querySelector(`[data-support-zone="1"][data-support-owner="${ownerLabel}"][data-support-hero="${heroIdx}"][data-support-slot="${zoneSlot}"]`);
    if (el) {
      const r = el.getBoundingClientRect();
      setPos({ x: r.left + r.width / 2, y: r.top + r.height * 0.3 });
    }
  }, [ownerLabel, heroIdx, zoneSlot]);

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

function GoldLossNumber({ amount, playerIdx, isMe }) {
  const [pos, setPos] = useState(null);
  useEffect(() => {
    const el = document.querySelector(`[data-gold-player="${playerIdx}"]`);
    if (el) {
      const r = el.getBoundingClientRect();
      setPos({ x: r.left - 10, y: isMe ? r.top - 40 : r.bottom + 10, isMe });
    }
  }, [playerIdx]);

  if (!pos) return null;
  return (
    <div className={isMe ? 'gold-loss-number' : 'gold-loss-number gold-loss-down'} style={{ left: pos.x, top: pos.y }}>
      -{amount}
    </div>
  );
}

// Floating level change number above a creature
function LevelChangeNumber({ delta, owner, heroIdx, zoneSlot, myIdx }) {
  const [pos, setPos] = useState(null);
  useEffect(() => {
    const ownerLabel = owner === myIdx ? 'me' : 'opp';
    const el = document.querySelector(`[data-support-zone][data-support-owner="${ownerLabel}"][data-support-hero="${heroIdx}"][data-support-slot="${zoneSlot}"]`);
    if (el) {
      const r = el.getBoundingClientRect();
      setPos({ x: r.left + r.width / 2, y: r.top });
    }
  }, [owner, heroIdx, zoneSlot]);

  if (!pos) return null;
  return (
    <div className={delta > 0 ? 'level-change-number' : 'level-change-number level-change-negative'} style={{ left: pos.x, top: pos.y }}>
      {delta > 0 ? '+' : ''}{delta}
    </div>
  );
}

// Floating HP change number above a hero (Toughness)
function ToughnessHpNumber({ amount, owner, heroIdx, myIdx }) {
  const [pos, setPos] = useState(null);
  useEffect(() => {
    const ownerLabel = owner === myIdx ? 'me' : 'opp';
    const el = document.querySelector(`[data-hero-zone][data-hero-owner="${ownerLabel}"][data-hero-idx="${heroIdx}"]`);
    if (el) {
      const r = el.getBoundingClientRect();
      setPos({ x: r.left + r.width / 2, y: r.top - 10 });
    }
  }, [owner, heroIdx]);

  if (!pos) return null;
  return (
    <div className={amount > 0 ? 'toughness-hp-number toughness-hp-up' : 'toughness-hp-number toughness-hp-down'} style={{ left: pos.x, top: pos.y }}>
      {amount > 0 ? '+' : ''}{amount}
    </div>
  );
}

// Floating ATK change number above a hero (Fighting)
function FightingAtkNumber({ amount, owner, heroIdx, myIdx }) {
  const [pos, setPos] = useState(null);
  useEffect(() => {
    const ownerLabel = owner === myIdx ? 'me' : 'opp';
    const el = document.querySelector(`[data-hero-zone][data-hero-owner="${ownerLabel}"][data-hero-idx="${heroIdx}"]`);
    if (el) {
      const r = el.getBoundingClientRect();
      setPos({ x: r.left + r.width / 2, y: r.top - 10 });
    }
  }, [owner, heroIdx]);

  if (!pos) return null;
  return (
    <div className={amount > 0 ? 'fighting-atk-number fighting-atk-up' : 'fighting-atk-number fighting-atk-down'} style={{ left: pos.x, top: pos.y }}>
      {amount > 0 ? '+' : ''}{amount}
    </div>
  );
}

// Floating card that animates from deck position to hand slot position
function DrawAnimCard({ cardName, origIdx, startX, startY, dimmed }) {
  const [endPos, setEndPos] = useState(null);

  useEffect(() => {
    // Wait one frame for the invisible hand slot to be laid out
    requestAnimationFrame(() => {
      const targetSlot = document.querySelector(`.game-hand-me .hand-slot[data-hand-idx="${origIdx}"]`);
      if (targetSlot) {
        const r = targetSlot.getBoundingClientRect();
        setEndPos({ x: r.left, y: r.top });
      }
    });
  }, [origIdx]);

  // Before we know the end position, render at deck position (hidden)
  if (!endPos) return null;

  const dx = endPos.x - startX;
  const dy = endPos.y - startY;

  return (
    <div className={'draw-anim-card' + (dimmed ? ' hand-card-dimmed' : '')}
      style={{ left: startX, top: startY, '--dx': dx + 'px', '--dy': dy + 'px' }}>
      <BoardCard cardName={cardName} />
    </div>
  );
}

// Opponent draw animation — face-down card flies from opp deck to opp hand
function OppDrawAnimCard({ id, startX, startY, endX, endY, cardName, cardbackUrl }) {
  const dx = endX - startX;
  const dy = endY - startY;
  return (
    <div className="draw-anim-card"
      style={{ left: startX, top: startY, '--dx': dx + 'px', '--dy': dy + 'px' }}>
      {cardName ? (
        <BoardCard cardName={cardName} noTooltip />
      ) : (
        <div className="board-card face-down" style={{ width: '100%', height: '100%' }}>
          <img src={cardbackUrl || "/cardback.png"} style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
        </div>
      )}
    </div>
  );
}

function DiscardAnimCard({ cardName, startX, startY, endX, endY, dest }) {
  const dx = endX - startX;
  const dy = endY - startY;
  const card = CARDS_BY_NAME[cardName];
  const imgUrl = card ? cardImageUrl(card.name) : null;
  const isDeleted = dest === 'deleted';
  const isDeckReturn = dest === 'deck';
  return (
    <div className={'discard-anim-card' + (isDeleted ? ' discard-anim-deleted' : '') + (isDeckReturn ? ' discard-anim-deck-return' : '')}
      style={{ left: startX, top: startY, '--dx': dx + 'px', '--dy': dy + 'px' }}>
      <div className="board-card" style={{ width: '100%', height: '100%' }}>
        {imgUrl ? <img src={imgUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
        : <div className="board-card-text">{cardName || '?'}</div>}
      </div>
      {isDeleted && <div className="delete-energy-overlay" />}
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
      onMouseDown={onDown} onClick={e => e.stopPropagation()}>
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
function CardRevealOverlay({ reveals, onRemove }) {
  return (
    <div className="card-reveal-stack">
      {reveals.map((rev, idx) => (
        <CardRevealEntry key={rev.id} cardName={rev.cardName} onDone={() => onRemove(rev.id)} />
      ))}
    </div>
  );
}

function CardRevealEntry({ cardName, onDone }) {
  const card = CARDS_BY_NAME[cardName];
  const imgUrl = card ? cardImageUrl(card.name) : null;
  const foilType = card?.foil || null;
  const [hovered, setHovered] = useState(false);
  useEffect(() => {
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, []);
  if (!card) return null;
  return (
    <>
      <div className="card-reveal-entry"
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        <div className="card-reveal-card">
          {imgUrl ? (
            <img src={imgUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6,
              border: foilType === 'diamond_rare' ? '3px solid rgba(120,200,255,.7)' : foilType === 'secret_rare' ? '3px solid rgba(255,215,0,.6)' : '2px solid var(--bg4)' }} draggable={false} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg3)', borderRadius: 6, border: '2px solid var(--bg4)', padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: typeColor(card.cardType), marginBottom: 8 }}>{card.name}</div>
              <div style={{ fontSize: 14, color: 'var(--text2)' }}>{card.cardType}</div>
            </div>
          )}
        </div>
      </div>
      {hovered && card && ReactDOM.createPortal(
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
        </div>,
        document.body
      )}
    </>
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

function PoisonedOverlay({ stacks }) {
  const bubbles = useMemo(() => Array.from({ length: 8 }, () => ({
    x: 10 + Math.random() * 80,
    y: 20 + Math.random() * 60,
    size: 6 + Math.random() * 5,
    delay: Math.random() * 2.5,
    dur: 0.8 + Math.random() * 0.8,
  })), []);
  return (
    <div className="status-poisoned-overlay">
      {bubbles.map((b, i) => (
        <span key={i} className="poisoned-particle" style={{
          left: b.x + '%', top: b.y + '%', fontSize: b.size,
          animationDelay: b.delay + 's', animationDuration: b.dur + 's',
        }}>☠️</span>
      ))}
      {stacks >= 1 && <div className="poison-stack-count">{stacks}</div>}
    </div>
  );
}

// ═══ GENERIC GAME TOOLTIP ═══
// Global tooltip system — renders at top level, escapes overflow:hidden.
// Usage: onMouseEnter={e => showGameTooltip(e, 'text')} onMouseLeave={hideGameTooltip}
function showGameTooltip(e, text) {
  const r = e.currentTarget.getBoundingClientRect();
  window._gameTooltip = { text, x: r.right + 6, y: r.top + r.height / 2 };
  window.dispatchEvent(new Event('gameTooltip'));
}
function hideGameTooltip() {
  window._gameTooltip = null;
  window.dispatchEvent(new Event('gameTooltip'));
}
function GameTooltip() {
  const [tip, setTip] = useState(null);
  useEffect(() => {
    const handler = () => setTip(window._gameTooltip ? { ...window._gameTooltip } : null);
    window.addEventListener('gameTooltip', handler);
    return () => window.removeEventListener('gameTooltip', handler);
  }, []);
  if (!tip) return null;
  return (
    <div className="game-tooltip" style={{ position: 'fixed', left: tip.x, top: tip.y, transform: 'translateY(-50%)', zIndex: 9990 }}>
      {tip.text}
    </div>
  );
}

// Status badges — small icons showing active negative statuses at a glance
function StatusBadges({ statuses, counters, isHero }) {
  const badges = [];
  const s = statuses || {};
  const c = counters || {};
  if (s.frozen || c.frozen) badges.push({ key: 'frozen', icon: '❄️', tooltip: 'Frozen: Cannot act and has its effects and Abilities negated.' + (isHero ? ' Cannot be equipped with Artifacts.' : '') });
  if (s.stunned || c.stunned) badges.push({ key: 'stunned', icon: '⚡', tooltip: 'Stunned: Cannot act and has its effects and Abilities negated.' });
  if (s.burned || c.burned) badges.push({ key: 'burned', icon: '🔥', tooltip: 'Burned: Takes 60 damage at the start of each of its owner\'s turns.' });
  if (s.poisoned || c.poisoned) {
    const stacks = s.poisoned?.stacks || c.poisonStacks || c.poisoned || 1;
    badges.push({ key: 'poisoned', icon: '☠️', tooltip: `Poisoned: Takes ${30 * stacks} damage at the start of each of its owner's turns.` });
  }
  if (s.negated || c.negated) badges.push({ key: 'negated', icon: '🚫', tooltip: isHero ? 'Negated: Has its effects and Abilities negated.' : 'Negated: Has its effects negated.' });
  if (badges.length === 0) return null;
  return (
    <div className="status-badges-row">
      {badges.map(b => (
        <div key={b.key} className="status-badge"
          onMouseEnter={e => showGameTooltip(e, b.tooltip)}
          onMouseLeave={hideGameTooltip}>
          {b.icon}
        </div>
      ))}
    </div>
  );
}

// Buff column — displays positive buff icons on heroes/creatures
function BuffColumn({ buffs }) {
  if (!buffs || Object.keys(buffs).length === 0) return null;
  const BUFF_ICONS = { cloudy: { icon: '☁️', tooltip: 'Takes half damage from all sources!' }, dark_gear_negated: { icon: '⚙️', tooltip: 'Effects negated by Dark Gear!' }, diplomacy_negated: { icon: '🕊️', tooltip: 'Effects negated due to Diplomacy!' }, necromancy_negated: { icon: '💀', tooltip: 'Effects negated due to Necromancy!' }, freeze_immune: { icon: '🔥', tooltip: 'Cannot be Frozen!' }, immortal: { icon: '✨', tooltip: 'Cannot have its HP dropped below 1.' }, combo_locked: { icon: '🔒', tooltip: 'Cannot perform Actions this turn.' }, submerged: { icon: '🌊', tooltip: 'Unaffected by all cards and effects while other possible targets exist!' }, negative_status_immune: { icon: '😎', tooltip: 'Immune to all negative status effects!' } };
  return (
    <div className="buff-column">
      {Object.entries(buffs).map(([key]) => {
        const def = BUFF_ICONS[key] || { icon: '✦', tooltip: key };
        return (
          <div key={key} className="buff-icon"
            onMouseEnter={e => showGameTooltip(e, def.tooltip)}
            onMouseLeave={hideGameTooltip}>
            {def.icon}
          </div>
        );
      })}
    </div>
  );
}

// Wind swirl — gentle wind particles spiraling around target
function WindEffect({ x, y }) {
  const particles = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const angle = (i / 14) * Math.PI * 2;
    const radius = 20 + Math.random() * 30;
    return {
      startAngle: angle,
      radius,
      size: 6 + Math.random() * 8,
      delay: i * 40 + Math.random() * 60,
      dur: 500 + Math.random() * 300,
      char: ['~','≈','∿','⌇','·'][Math.floor(Math.random() * 5)],
    };
  }), []);
  return (
    <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
      <div className="anim-wind-flash" />
      {particles.map((p, i) => (
        <div key={'wp'+i} className="anim-wind-particle" style={{
          '--startAngle': p.startAngle + 'rad', '--radius': p.radius + 'px', '--size': p.size + 'px',
          animationDelay: p.delay + 'ms', animationDuration: p.dur + 'ms',
        }}>{p.char}</div>
      ))}
    </div>
  );
}

// Shadow summon effect — dark tendrils rising from below
function ShadowSummonEffect({ x, y }) {
  const tendrils = useMemo(() => Array.from({ length: 16 }, () => {
    const xOff = -30 + Math.random() * 60;
    return {
      xOff,
      size: 6 + Math.random() * 10,
      delay: Math.random() * 200,
      dur: 400 + Math.random() * 400,
      char: ['▓','░','▒','◆','●'][Math.floor(Math.random() * 5)],
    };
  }), []);
  const wisps = useMemo(() => Array.from({ length: 10 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 10 + Math.random() * 25;
    return {
      dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed,
      size: 2 + Math.random() * 4,
      color: ['#6633aa','#442288','#553399','#221144','#7744bb'][Math.floor(Math.random() * 5)],
      delay: 300 + Math.random() * 200,
      dur: 300 + Math.random() * 300,
    };
  }), []);
  return (
    <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
      <div className="anim-shadow-flash" />
      {tendrils.map((t, i) => (
        <div key={'st'+i} className="anim-shadow-tendril" style={{
          '--xOff': t.xOff + 'px', '--size': t.size + 'px',
          animationDelay: t.delay + 'ms', animationDuration: t.dur + 'ms',
        }}>{t.char}</div>
      ))}
      {wisps.map((w, i) => (
        <div key={'sw'+i} className="anim-explosion-particle" style={{
          '--dx': w.dx + 'px', '--dy': w.dy + 'px', '--size': w.size + 'px',
          '--color': w.color, animationDelay: w.delay + 'ms', animationDuration: w.dur + 'ms',
        }} />
      ))}
    </div>
  );
}

// Gold sparkle — particles burst from the gold counter
function GoldSparkleEffect({ x, y }) {
  const sparkles = useMemo(() => Array.from({ length: 12 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 12 + Math.random() * 25;
    return {
      dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed,
      size: 3 + Math.random() * 5,
      color: ['#ffd700','#ffcc00','#ffee55','#fff','#ffaa00'][Math.floor(Math.random() * 5)],
      delay: Math.random() * 150,
      dur: 400 + Math.random() * 400,
    };
  }), []);
  return (
    <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
      <div className="anim-gold-flash" />
      {sparkles.map((s, i) => (
        <div key={'gs'+i} className="anim-explosion-particle" style={{
          '--dx': s.dx + 'px', '--dy': s.dy + 'px', '--size': s.size + 'px',
          '--color': s.color, animationDelay: s.delay + 'ms', animationDuration: s.dur + 'ms',
        }} />
      ))}
    </div>
  );
}

// Beer bubbles — yellow bubbles and foam rising upward
function BeerBubblesEffect({ x, y }) {
  const bubbles = useMemo(() => Array.from({ length: 18 }, () => ({
    xOff: -25 + Math.random() * 50,
    size: 4 + Math.random() * 8,
    delay: Math.random() * 300,
    dur: 500 + Math.random() * 500,
    color: ['#ffd700','#ffcc33','#fff8dc','#ffe680','#fff'][Math.floor(Math.random() * 5)],
    wobble: -8 + Math.random() * 16,
  })), []);
  return (
    <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
      <div className="anim-gold-flash" />
      {bubbles.map((b, i) => (
        <div key={'bb'+i} className="anim-beer-bubble" style={{
          '--xOff': b.xOff + 'px', '--size': b.size + 'px', '--wobble': b.wobble + 'px',
          '--color': b.color, animationDelay: b.delay + 'ms', animationDuration: b.dur + 'ms',
        }} />
      ))}
    </div>
  );
}

function CreatureDeathEffect({ x, y }) {
  // Rising soul particles + flash + falling sparkles
  const souls = useMemo(() => Array.from({ length: 14 }, () => ({
    dx: -20 + Math.random() * 40,
    dy: -(40 + Math.random() * 60),
    size: 4 + Math.random() * 6,
    color: ['#ffffff','#aaccff','#88aaff','#ccddff','#ddeeff'][Math.floor(Math.random() * 5)],
    delay: Math.random() * 200,
    dur: 600 + Math.random() * 500,
  })), []);
  const sparks = useMemo(() => Array.from({ length: 18 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 15 + Math.random() * 40;
    return {
      dx: Math.cos(angle) * speed,
      dy: Math.sin(angle) * speed,
      size: 2 + Math.random() * 4,
      color: ['#ff4444','#ff6666','#ffaaaa','#ff8888','#cc3333'][Math.floor(Math.random() * 5)],
      delay: 50 + Math.random() * 150,
      dur: 400 + Math.random() * 400,
    };
  }), []);
  return (
    <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
      <div className="anim-creature-death-flash" />
      {souls.map((p, i) => (
        <div key={'s'+i} className="anim-creature-death-soul" style={{
          '--dx': p.dx + 'px', '--dy': p.dy + 'px', '--size': p.size + 'px',
          '--color': p.color, animationDelay: p.delay + 'ms', animationDuration: p.dur + 'ms',
        }} />
      ))}
      {sparks.map((p, i) => (
        <div key={'k'+i} className="anim-creature-death-spark" style={{
          '--dx': p.dx + 'px', '--dy': p.dy + 'px', '--size': p.size + 'px',
          '--color': p.color, animationDelay: p.delay + 'ms', animationDuration: p.dur + 'ms',
        }} />
      ))}
    </div>
  );
}

const ANIM_REGISTRY = {
  explosion: ExplosionEffect,
  creature_death: CreatureDeathEffect,
  freeze: FreezeEffect,
  ice_encase: IceEncaseEffect,
  electric_strike: ElectricStrikeEffect,
  flame_strike: FlameStrikeEffect,
  stranglehold_squeeze: (() => {
    return function StrangleholdSqueezeEffect({ x, y }) {
      useEffect(() => {
        const timer = setTimeout(() => {
          const els = document.querySelectorAll('[data-hero-zone],[data-support-zone]');
          let best = null, bestDist = Infinity;
          els.forEach(el => {
            const r = el.getBoundingClientRect();
            const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
            const d = Math.abs(cx - x) + Math.abs(cy - y);
            if (d < bestDist) { bestDist = d; best = el; }
          });
          if (best && bestDist < 80) {
            best.classList.add('stranglehold-squeezed');
            setTimeout(() => best.classList.remove('stranglehold-squeezed'), 1200);
          }
        }, 50);
        return () => clearTimeout(timer);
      }, []);
      return null; // No visual overlay — the CSS class does all the work
    };
  })(),
  tiger_impact: (() => {
    return function TigerImpactEffect({ x, y }) {
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 64, animation: 'tigerFadeInOut 1.2s ease-in-out forwards', marginLeft: -32, marginTop: -32 }}>🐯</div>
        </div>
      );
    };
  })(),
  ox_impact: (() => {
    return function OxImpactEffect({ x, y }) {
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 64, animation: 'tigerFadeInOut 1.2s ease-in-out forwards', marginLeft: -32, marginTop: -32 }}>𖤍</div>
        </div>
      );
    };
  })(),
  snake_impact: (() => {
    return function SnakeImpactEffect({ x, y }) {
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 64, animation: 'tigerFadeInOut 1.2s ease-in-out forwards', marginLeft: -32, marginTop: -32 }}>🐍</div>
        </div>
      );
    };
  })(),
  whirlwind_spin: (() => {
    return function WhirlwindSpinEffect({ x, y }) {
      useEffect(() => {
        const els = document.querySelectorAll('[data-hero-zone],[data-support-zone]');
        let best = null, bestDist = Infinity;
        els.forEach(el => {
          const r = el.getBoundingClientRect();
          const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
          const d = Math.abs(cx - x) + Math.abs(cy - y);
          if (d < bestDist) { bestDist = d; best = el; }
        });
        if (best && bestDist < 80) {
          best.classList.add('whirlwind-spinning');
          setTimeout(() => best.classList.remove('whirlwind-spinning'), 2200);
        }
      }, []);
      return null;
    };
  })(),
  deep_sea_bubbles: (() => {
    return function DeepSeaBubblesEffect({ x, y }) {
      const bubbles = useMemo(() => Array.from({ length: 20 }, () => ({
        xOff: -40 + Math.random() * 80,
        startY: 25 + Math.random() * 30,
        endY: -80 - Math.random() * 60,
        delay: Math.random() * 800,
        dur: 800 + Math.random() * 600,
        size: 6 + Math.random() * 14,
        opacity: 0.4 + Math.random() * 0.4,
        wobble: -8 + Math.random() * 16,
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          {bubbles.map((b, i) => (
            <div key={'bb'+i} style={{
              position: 'absolute', left: b.xOff, top: b.startY,
              width: b.size, height: b.size, borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 35%, rgba(100,160,220,.6), rgba(20,50,100,.3))',
              border: '1px solid rgba(80,140,200,.4)',
              boxShadow: `inset 0 -2px 4px rgba(10,30,60,.3), 0 0 ${b.size/2}px rgba(40,80,140,.3)`,
              animation: `bubbleRise ${b.dur}ms ease-out ${b.delay}ms forwards`,
              opacity: 0,
              '--endY': b.endY + 'px',
              '--wobble': b.wobble + 'px',
              '--bubbleOpacity': b.opacity,
            }} />
          ))}
        </div>
      );
    };
  })(),
  holy_revival: (() => {
    // Golden-white holy light rising upward — revival/resurrection effect
    return function HolyRevivalEffect({ x, y }) {
      const rays = useMemo(() => Array.from({ length: 16 }, () => ({
        angle: Math.random() * 360,
        len: 60 + Math.random() * 80,
        width: 2 + Math.random() * 3,
        delay: Math.random() * 400,
        dur: 600 + Math.random() * 400,
      })), []);
      const sparkles = useMemo(() => Array.from({ length: 24 }, () => ({
        xOff: -50 + Math.random() * 100,
        startY: 20 + Math.random() * 30,
        endY: -60 - Math.random() * 80,
        delay: 200 + Math.random() * 600,
        dur: 500 + Math.random() * 500,
        size: 4 + Math.random() * 8,
        color: ['#fffbe6','#ffd700','#fff','#ffe082','#fff9c4'][Math.floor(Math.random() * 5)],
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          <div className="anim-flame-flash" style={{ width: 160, height: 160, marginLeft: -80, marginTop: -80, background: 'radial-gradient(circle, rgba(255,255,240,.9) 0%, rgba(255,215,0,.4) 35%, rgba(255,255,200,.1) 60%, transparent 80%)', animationDuration: '800ms' }} />
          <div className="anim-flame-flash" style={{ width: 100, height: 100, marginLeft: -50, marginTop: -50, background: 'radial-gradient(circle, rgba(255,255,255,.95) 0%, rgba(255,240,180,.5) 40%, transparent 70%)', animationDelay: '200ms', animationDuration: '600ms' }} />
          {rays.map((r, i) => (
            <div key={'hr'+i} style={{
              position: 'absolute', left: 0, top: 0,
              transform: `rotate(${r.angle}deg)`,
              transformOrigin: 'center center',
            }}>
              <div style={{
                width: r.width, height: r.len, marginLeft: -r.width/2,
                background: 'linear-gradient(to top, rgba(255,215,0,.8), rgba(255,255,240,.3) 70%, transparent)',
                borderRadius: r.width,
                transformOrigin: 'center bottom',
                animation: `holyRayGrow ${r.dur}ms ease-out ${r.delay}ms forwards`,
                opacity: 0,
              }} />
            </div>
          ))}
          {sparkles.map((s, i) => (
            <div key={'hs'+i} style={{
              position: 'absolute', left: s.xOff, top: s.startY,
              width: s.size, height: s.size, borderRadius: '50%',
              background: s.color,
              boxShadow: `0 0 ${s.size}px ${s.color}`,
              animation: `holySparkleRise ${s.dur}ms ease-out ${s.delay}ms forwards`,
              opacity: 0,
            }} />
          ))}
        </div>
      );
    };
  })(),
  arrow_rain: (() => {
    // Sharp arrow projectiles raining down from above — Rain of Arrows
    return function ArrowRainEffect({ x, y }) {
      const arrows = useMemo(() => Array.from({ length: 28 }, (_, i) => ({
        xOff: -70 + Math.random() * 140,
        startY: -150 - Math.random() * 100,
        delay: Math.random() * 600,
        dur: 200 + Math.random() * 200,
        rot: 170 + Math.random() * 20,
        len: 18 + Math.random() * 14,
      })), []);
      const impacts = useMemo(() => Array.from({ length: 16 }, () => ({
        xOff: -50 + Math.random() * 100,
        delay: 250 + Math.random() * 500,
        dur: 300 + Math.random() * 200,
        size: 3 + Math.random() * 5,
        color: ['#ffcc44','#ff8800','#ffaa22','#ddaa00','#ffe066'][Math.floor(Math.random() * 5)],
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          <div className="anim-flame-flash" style={{ width: 80, height: 80, marginLeft: -40, marginTop: -40, background: 'radial-gradient(circle, rgba(255,200,50,.5) 0%, rgba(255,150,0,.2) 50%, transparent 80%)', animationDelay: '300ms' }} />
          {arrows.map((a, i) => (
            <div key={'ar'+i} style={{
              position: 'absolute', left: a.xOff, top: a.startY,
              animation: `arrowFall ${a.dur}ms ease-in ${a.delay}ms forwards`,
              opacity: 0,
            }}>
              <div style={{
                width: 2, height: a.len,
                background: 'linear-gradient(to bottom, transparent 0%, #ffdd66 20%, #ffaa22 80%, #ff8800 100%)',
                borderRadius: '0 0 1px 1px',
                boxShadow: '0 0 4px rgba(255,200,50,.6)',
                transform: `rotate(${a.rot}deg)`,
                transformOrigin: 'center top',
              }}>
                <div style={{ position: 'absolute', bottom: -4, left: -3, width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '6px solid #ff8800' }} />
              </div>
            </div>
          ))}
          {impacts.map((imp, i) => (
            <div key={'ai'+i} className="anim-explosion-particle" style={{
              '--dx': imp.xOff + 'px', '--dy': (Math.random() * -20) + 'px', '--size': imp.size + 'px',
              '--color': imp.color, animationDelay: imp.delay + 'ms', animationDuration: imp.dur + 'ms',
            }} />
          ))}
        </div>
      );
    };
  })(),
  flame_avalanche: (() => {
    // Massive, screen-shaking fire effect for Flame Avalanche
    return function FlameAvalancheEffect({ x, y }) {
      const flames = useMemo(() => Array.from({ length: 40 }, () => {
        const angle = Math.random() * Math.PI * 2;
        const dist = 80 + Math.random() * 100;
        return {
          startX: Math.cos(angle) * dist,
          startY: Math.sin(angle) * dist,
          size: 16 + Math.random() * 24,
          delay: Math.random() * 400,
          dur: 400 + Math.random() * 400,
          char: ['🔥','🔥','🔥','🔥','💥','✦','☄️'][Math.floor(Math.random() * 7)],
        };
      }), []);
      const sparks = useMemo(() => Array.from({ length: 30 }, () => {
        const angle = Math.random() * Math.PI * 2;
        const speed = 30 + Math.random() * 60;
        return {
          dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed,
          size: 4 + Math.random() * 8,
          color: ['#ff2200','#ff4400','#ff8800','#ffcc00','#ffaa00','#ff0000','#ff6600'][Math.floor(Math.random() * 7)],
          delay: Math.random() * 300,
          dur: 500 + Math.random() * 400,
        };
      }), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          <div className="anim-flame-flash" style={{ width: 200, height: 200, marginLeft: -100, marginTop: -100, background: 'radial-gradient(circle, rgba(255,100,0,.9) 0%, rgba(255,60,0,.6) 30%, rgba(255,0,0,.2) 60%, transparent 80%)' }} />
          <div className="anim-flame-flash" style={{ width: 140, height: 140, marginLeft: -70, marginTop: -70, animationDelay: '100ms', background: 'radial-gradient(circle, rgba(255,255,200,.8) 0%, rgba(255,180,0,.4) 40%, transparent 70%)' }} />
          {flames.map((f, i) => (
            <div key={'fa'+i} className="anim-flame-shard" style={{
              '--startX': f.startX + 'px', '--startY': f.startY + 'px', '--size': f.size + 'px',
              animationDelay: f.delay + 'ms', animationDuration: f.dur + 'ms',
            }}>{f.char}</div>
          ))}
          {sparks.map((s, i) => (
            <div key={'fas'+i} className="anim-explosion-particle" style={{
              '--dx': s.dx + 'px', '--dy': s.dy + 'px', '--size': s.size + 'px',
              '--color': s.color, animationDelay: s.delay + 'ms', animationDuration: s.dur + 'ms',
            }} />
          ))}
        </div>
      );
    };
  })(),
  wind: WindEffect,
  shadow_summon: ShadowSummonEffect,
  gold_sparkle: GoldSparkleEffect,
  beer_bubbles: BeerBubblesEffect,
  juice_bubbles: (() => {
    // Orange juice bubbles — same as beer but orange palette
    return function JuiceBubblesEffect({ x, y }) {
      const bubbles = useMemo(() => Array.from({ length: 18 }, () => ({
        xOff: -25 + Math.random() * 50,
        size: 4 + Math.random() * 8,
        delay: Math.random() * 300,
        dur: 500 + Math.random() * 500,
        color: ['#ff8c00','#ffa033','#ffcc66','#ff6600','#ffe0b0'][Math.floor(Math.random() * 5)],
        wobble: -8 + Math.random() * 16,
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          <div className="anim-gold-flash" style={{ background: 'radial-gradient(circle, rgba(255,140,0,.8) 0%, rgba(255,100,0,.3) 40%, transparent 70%)' }} />
          {bubbles.map((b, i) => (
            <div key={'jb'+i} className="anim-beer-bubble" style={{
              '--xOff': b.xOff + 'px', '--size': b.size + 'px', '--wobble': b.wobble + 'px',
              '--color': b.color, animationDelay: b.delay + 'ms', animationDuration: b.dur + 'ms',
            }} />
          ))}
        </div>
      );
    };
  })(),
  poison_tick: (() => {
    return function PoisonTickEffect({ x, y }) {
      const bubbles = useMemo(() => Array.from({ length: 14 }, () => ({
        xOff: -25 + Math.random() * 50,
        size: 4 + Math.random() * 7,
        delay: Math.random() * 250,
        dur: 400 + Math.random() * 400,
        color: ['#9933cc','#7722aa','#bb55ee','#6611aa','#dd88ff'][Math.floor(Math.random() * 5)],
        wobble: -8 + Math.random() * 16,
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          <div className="anim-gold-flash" style={{ background: 'radial-gradient(circle, rgba(130,0,180,.8) 0%, rgba(100,0,160,.3) 40%, transparent 70%)' }} />
          {bubbles.map((b, i) => (
            <div key={'pt'+i} className="anim-beer-bubble" style={{
              '--xOff': b.xOff + 'px', '--size': b.size + 'px', '--wobble': b.wobble + 'px',
              '--color': b.color, animationDelay: b.delay + 'ms', animationDuration: b.dur + 'ms',
            }} />
          ))}
        </div>
      );
    };
  })(),
  poison_vial: (() => {
    return function PoisonVialEffect({ x, y }) {
      const ooze = useMemo(() => Array.from({ length: 12 }, () => ({
        xOff: -30 + Math.random() * 60,
        size: 6 + Math.random() * 10,
        delay: Math.random() * 200,
        dur: 500 + Math.random() * 500,
        wobble: -10 + Math.random() * 20,
        color: ['#7722bb','#9933dd','#6611aa','#aa44ee','#551199'][Math.floor(Math.random() * 5)],
      })), []);
      const skulls = useMemo(() => Array.from({ length: 5 }, () => ({
        xOff: -20 + Math.random() * 40,
        delay: 200 + Math.random() * 300,
        dur: 600 + Math.random() * 400,
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          <div className="anim-gold-flash" style={{ background: 'radial-gradient(circle, rgba(100,0,160,.9) 0%, rgba(80,0,140,.4) 40%, transparent 70%)' }} />
          {ooze.map((o, i) => (
            <div key={'po'+i} className="anim-beer-bubble" style={{
              '--xOff': o.xOff + 'px', '--size': o.size + 'px', '--wobble': o.wobble + 'px',
              '--color': o.color, animationDelay: o.delay + 'ms', animationDuration: o.dur + 'ms',
            }} />
          ))}
          {skulls.map((s, i) => (
            <div key={'ps'+i} className="anim-beer-bubble" style={{
              '--xOff': s.xOff + 'px', '--size': '14px', '--wobble': '0px',
              '--color': 'rgba(150,50,200,.6)', animationDelay: s.delay + 'ms', animationDuration: s.dur + 'ms',
              fontSize: 14, opacity: 0,
            }}>💀</div>
          ))}
        </div>
      );
    };
  })(),
  tea_steam: (() => {
    return function TeaSteamEffect({ x, y }) {
      const particles = useMemo(() => Array.from({ length: 16 }, () => ({
        xOff: -20 + Math.random() * 40,
        size: 5 + Math.random() * 7,
        delay: Math.random() * 300,
        dur: 500 + Math.random() * 500,
        char: ['🍃','~','≈','☁','·','🍃'][Math.floor(Math.random() * 6)],
        color: ['#88cc66','#aaddaa','#66aa44','#ccddbb','#bbeeaa'][Math.floor(Math.random() * 5)],
        wobble: -8 + Math.random() * 16,
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          <div className="anim-gold-flash" style={{ background: 'radial-gradient(circle, rgba(100,180,80,.7) 0%, rgba(80,150,60,.3) 40%, transparent 70%)' }} />
          {particles.map((p, i) => (
            <div key={'ts'+i} className="anim-beer-bubble" style={{
              '--xOff': p.xOff + 'px', '--size': p.size + 'px', '--wobble': p.wobble + 'px',
              '--color': p.color, animationDelay: p.delay + 'ms', animationDuration: p.dur + 'ms',
              fontSize: p.size,
            }}>{p.char}</div>
          ))}
        </div>
      );
    };
  })(),
  coffee_steam: (() => {
    return function CoffeeSteamEffect({ x, y }) {
      const particles = useMemo(() => Array.from({ length: 16 }, () => ({
        xOff: -22 + Math.random() * 44,
        size: 5 + Math.random() * 7,
        delay: Math.random() * 300,
        dur: 500 + Math.random() * 500,
        char: ['☕','~','≈','☁','·','♨'][Math.floor(Math.random() * 6)],
        color: ['#3a2a1a','#5c3d1e','#2a1a0a','#8b6b4a','#4a3020'][Math.floor(Math.random() * 5)],
        wobble: -8 + Math.random() * 16,
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          <div className="anim-gold-flash" style={{ background: 'radial-gradient(circle, rgba(60,40,20,.8) 0%, rgba(40,25,10,.4) 40%, transparent 70%)' }} />
          {particles.map((p, i) => (
            <div key={'cs'+i} className="anim-beer-bubble" style={{
              '--xOff': p.xOff + 'px', '--size': p.size + 'px', '--wobble': p.wobble + 'px',
              '--color': p.color, animationDelay: p.delay + 'ms', animationDuration: p.dur + 'ms',
              fontSize: p.size,
            }}>{p.char}</div>
          ))}
        </div>
      );
    };
  })(),
  magic_hammer: (() => {
    return function MagicHammerEffect({ x, y, w, h }) {
      const targetW = w || 70;
      const targetH = h || 90;
      const hammerW = 55;
      const hammerH = 80;
      // Impact sparks
      const sparks = useMemo(() => Array.from({ length: 14 }, () => {
        const angle = -Math.PI * 0.15 + Math.random() * Math.PI * 1.3; // mostly sideways/upward
        const speed = 20 + Math.random() * 50;
        return {
          dx: Math.cos(angle) * speed,
          dy: -Math.abs(Math.sin(angle) * speed) - 5,
          size: 2 + Math.random() * 4,
          color: ['#ccc','#fff','#aaa','#ff8','#ffa'][Math.floor(Math.random() * 5)],
          delay: 320 + Math.random() * 80,
          dur: 250 + Math.random() * 200,
        };
      }), []);
      // Apply squash class to actual target DOM element
      useEffect(() => {
        const timer = setTimeout(() => {
          // Find the hero or support zone element under this animation
          const els = document.querySelectorAll('[data-hero-zone],[data-support-zone]');
          let best = null, bestDist = Infinity;
          els.forEach(el => {
            const r = el.getBoundingClientRect();
            const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
            const d = Math.abs(cx - x) + Math.abs(cy - y);
            if (d < bestDist) { bestDist = d; best = el; }
          });
          if (best && bestDist < 80) {
            best.classList.add('magic-hammer-squashed');
            setTimeout(() => best.classList.remove('magic-hammer-squashed'), 650);
          }
        }, 330);
        return () => clearTimeout(timer);
      }, []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          {/* Hammerhead — drops from above, bounces back */}
          <div className="anim-hammer-head" style={{
            width: hammerW, height: hammerH,
            marginLeft: -hammerW / 2, marginTop: -targetH / 2 - hammerH,
          }} />
          {/* Impact flash */}
          <div className="anim-hammer-impact" />
          {/* Impact sparks */}
          {sparks.map((s, i) => (
            <div key={'hs'+i} className="anim-explosion-particle" style={{
              '--dx': s.dx + 'px', '--dy': s.dy + 'px', '--size': s.size + 'px',
              '--color': s.color, animationDelay: s.delay + 'ms', animationDuration: s.dur + 'ms',
            }} />
          ))}
        </div>
      );
    };
  })(),
  dark_gear_spin_cw: (() => {
    return function DarkGearCWEffect({ x, y }) {
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          <div className="anim-dark-gear-flash" />
          <div className="anim-dark-gear cw">⚙</div>
        </div>
      );
    };
  })(),
  dark_gear_spin_ccw: (() => {
    return function DarkGearCCWEffect({ x, y }) {
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          <div className="anim-dark-gear-flash" />
          <div className="anim-dark-gear ccw">⚙</div>
        </div>
      );
    };
  })(),
  cloud_gather: (() => {
    return function CloudGatherEffect({ x, y }) {
      const puffs = useMemo(() => Array.from({ length: 16 }, () => {
        const angle = Math.random() * Math.PI * 2;
        const dist = 60 + Math.random() * 50;
        return {
          startX: Math.cos(angle) * dist,
          startY: Math.sin(angle) * dist,
          size: 14 + Math.random() * 18,
          delay: Math.random() * 300,
          dur: 500 + Math.random() * 300,
        };
      }), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          {puffs.map((p, i) => (
            <div key={'cg'+i} style={{
              position: 'absolute', left: p.startX, top: p.startY,
              fontSize: p.size, color: '#fff',
              filter: 'drop-shadow(0 0 6px rgba(255,255,255,.7))',
              animation: `cloudGather ${p.dur}ms ease-in ${p.delay}ms forwards`,
              opacity: 0,
              '--startX': p.startX + 'px', '--startY': p.startY + 'px',
            }}>☁</div>
          ))}
          <div style={{
            position: 'absolute', left: -20, top: -14,
            fontSize: 40, color: '#fff',
            filter: 'drop-shadow(0 0 10px rgba(220,240,255,.8))',
            animation: 'cloudFormCenter 400ms ease-out 600ms forwards',
            opacity: 0,
          }}>☁️</div>
        </div>
      );
    };
  })(),
  cloud_disperse: (() => {
    return function CloudDisperseEffect({ x, y }) {
      const puffs = useMemo(() => Array.from({ length: 18 }, () => {
        const angle = Math.random() * Math.PI * 2;
        const dist = 50 + Math.random() * 60;
        return {
          endX: Math.cos(angle) * dist,
          endY: Math.sin(angle) * dist,
          size: 10 + Math.random() * 14,
          delay: 250 + Math.random() * 200,
          dur: 400 + Math.random() * 300,
        };
      }), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          <div style={{
            position: 'absolute', left: -20, top: -14,
            fontSize: 40, color: '#fff',
            filter: 'drop-shadow(0 0 10px rgba(220,240,255,.8))',
            animation: 'cloudDisperseCenter 350ms ease-in forwards',
            opacity: 1,
          }}>☁️</div>
          {puffs.map((p, i) => (
            <div key={'cd'+i} style={{
              position: 'absolute', left: 0, top: 0,
              fontSize: p.size, color: '#fff',
              filter: 'drop-shadow(0 0 5px rgba(255,255,255,.6))',
              animation: `cloudDisperse ${p.dur}ms ease-out ${p.delay}ms forwards`,
              opacity: 0,
              '--endX': p.endX + 'px', '--endY': p.endY + 'px',
            }}>☁</div>
          ))}
        </div>
      );
    };
  })(),
  golden_ankh_revival: (() => {
    return function GoldenAnkhRevivalEffect({ x, y }) {
      const ankhs = useMemo(() => Array.from({ length: 12 }, () => ({
        xOff: -45 + Math.random() * 90,
        startY: 20 + Math.random() * 30,
        endY: -70 - Math.random() * 80,
        delay: 100 + Math.random() * 500,
        dur: 700 + Math.random() * 500,
        size: 14 + Math.random() * 16,
        rot: -20 + Math.random() * 40,
      })), []);
      const sparkles = useMemo(() => Array.from({ length: 20 }, () => ({
        xOff: -50 + Math.random() * 100,
        startY: 10 + Math.random() * 40,
        endY: -50 - Math.random() * 70,
        delay: 200 + Math.random() * 600,
        dur: 500 + Math.random() * 500,
        size: 3 + Math.random() * 7,
        color: ['#ffd700','#ffec80','#fff5cc','#ffb300','#ffe066'][Math.floor(Math.random() * 5)],
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          <div className="anim-flame-flash" style={{ width: 150, height: 150, marginLeft: -75, marginTop: -75, background: 'radial-gradient(circle, rgba(255,215,0,.85) 0%, rgba(255,180,0,.4) 35%, rgba(255,240,150,.1) 60%, transparent 80%)', animationDuration: '900ms' }} />
          <div className="anim-flame-flash" style={{ width: 90, height: 90, marginLeft: -45, marginTop: -45, background: 'radial-gradient(circle, rgba(255,255,220,.95) 0%, rgba(255,215,0,.5) 40%, transparent 70%)', animationDelay: '250ms', animationDuration: '700ms' }} />
          {ankhs.map((a, i) => (
            <div key={'ak'+i} style={{
              position: 'absolute', left: a.xOff, top: a.startY,
              fontSize: a.size, color: '#ffd700',
              filter: 'drop-shadow(0 0 6px rgba(255,200,0,.9))',
              transform: `rotate(${a.rot}deg)`,
              animation: `ankhFloat ${a.dur}ms ease-out ${a.delay}ms forwards`,
              opacity: 0,
              '--endY': a.endY + 'px',
            }}>𓋹</div>
          ))}
          {sparkles.map((s, i) => (
            <div key={'as'+i} style={{
              position: 'absolute', left: s.xOff, top: s.startY,
              width: s.size, height: s.size, borderRadius: '50%',
              background: s.color,
              boxShadow: `0 0 ${s.size}px ${s.color}`,
              animation: `ankhFloat ${s.dur}ms ease-out ${s.delay}ms forwards`,
              opacity: 0,
              '--endY': s.endY + 'px',
            }} />
          ))}
        </div>
      );
    };
  })(),
  thaw: ThawEffect,
  music_notes: (() => {
    return function MusicNotesEffect({ x, y }) {
      const notes = useMemo(() => Array.from({ length: 32 }, () => {
        const angle = Math.random() * Math.PI * 2;
        const dist = 20 + Math.random() * 60;
        return {
          startX: Math.cos(angle) * dist * 0.4,
          startY: Math.random() * 20 - 10,
          endX: Math.cos(angle) * dist,
          endY: -40 - Math.random() * 120,
          size: 16 + Math.random() * 20,
          delay: Math.random() * 600,
          dur: 700 + Math.random() * 500,
          char: ['♪','♫','🎵','🎶','♩','♬'][Math.floor(Math.random() * 6)],
          rot: -30 + Math.random() * 60,
          opacity: 0.7 + Math.random() * 0.3,
        };
      }), []);
      const sparkles = useMemo(() => Array.from({ length: 16 }, () => ({
        xOff: -40 + Math.random() * 80,
        startY: 10 + Math.random() * 20,
        endY: -50 - Math.random() * 60,
        delay: 100 + Math.random() * 500,
        dur: 500 + Math.random() * 400,
        size: 3 + Math.random() * 5,
        color: ['#ff66aa','#ffaa44','#66ccff','#ffdd55','#cc88ff','#44ffaa'][Math.floor(Math.random() * 6)],
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          <div className="anim-flame-flash" style={{ width: 100, height: 100, marginLeft: -50, marginTop: -50, background: 'radial-gradient(circle, rgba(255,100,200,.4) 0%, rgba(200,100,255,.2) 40%, transparent 70%)' }} />
          {notes.map((n, i) => (
            <div key={'mn'+i} style={{
              position: 'absolute', left: n.startX, top: n.startY,
              fontSize: n.size, opacity: 0,
              transform: `rotate(${n.rot}deg)`,
              animation: `musicNoteFloat ${n.dur}ms ease-out ${n.delay}ms forwards`,
              '--endX': n.endX + 'px', '--endY': n.endY + 'px',
              '--noteOpacity': n.opacity,
              filter: `hue-rotate(${Math.random() * 360}deg)`,
              textShadow: '0 0 8px rgba(255,150,255,.6)',
            }}>{n.char}</div>
          ))}
          {sparkles.map((s, i) => (
            <div key={'ms'+i} style={{
              position: 'absolute', left: s.xOff, top: s.startY,
              width: s.size, height: s.size, borderRadius: '50%',
              background: s.color,
              boxShadow: `0 0 ${s.size + 2}px ${s.color}`,
              animation: `holySparkleRise ${s.dur}ms ease-out ${s.delay}ms forwards`,
              opacity: 0,
            }} />
          ))}
        </div>
      );
    };
  })(),
  necromancy_summon: (() => {
    return function NecromancySummonEffect({ x, y }) {
      const skulls = useMemo(() => Array.from({ length: 12 }, () => {
        const angle = Math.random() * Math.PI * 2;
        const dist = 30 + Math.random() * 50;
        return {
          startX: Math.cos(angle) * dist * 0.3,
          startY: Math.random() * 15,
          endX: Math.cos(angle) * dist,
          endY: -30 - Math.random() * 90,
          size: 16 + Math.random() * 16,
          delay: Math.random() * 500,
          dur: 600 + Math.random() * 500,
          char: ['💀','☠️','💀','☠️','💀','👻'][Math.floor(Math.random() * 6)],
          rot: -20 + Math.random() * 40,
        };
      }), []);
      const particles = useMemo(() => Array.from({ length: 28 }, () => {
        const angle = Math.random() * Math.PI * 2;
        const speed = 20 + Math.random() * 50;
        return {
          dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed - 20,
          size: 4 + Math.random() * 8,
          color: ['#8b00ff','#6a0dad','#9932cc','#4b0082','#7b2d8e','#cc44ff','#220033'][Math.floor(Math.random() * 7)],
          delay: Math.random() * 400,
          dur: 400 + Math.random() * 400,
        };
      }), []);
      const wisps = useMemo(() => Array.from({ length: 8 }, () => ({
        xOff: -30 + Math.random() * 60,
        startY: 20 + Math.random() * 20,
        endY: -50 - Math.random() * 50,
        delay: 100 + Math.random() * 400,
        dur: 700 + Math.random() * 400,
        size: 10 + Math.random() * 15,
        opacity: 0.4 + Math.random() * 0.3,
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          <div className="anim-flame-flash" style={{ width: 120, height: 120, marginLeft: -60, marginTop: -60, background: 'radial-gradient(circle, rgba(100,0,180,.7) 0%, rgba(60,0,120,.4) 40%, transparent 70%)' }} />
          <div className="anim-flame-flash" style={{ width: 80, height: 80, marginLeft: -40, marginTop: -40, animationDelay: '100ms', background: 'radial-gradient(circle, rgba(180,50,255,.5) 0%, rgba(100,0,200,.2) 50%, transparent 70%)' }} />
          {skulls.map((s, i) => (
            <div key={'ns'+i} style={{
              position: 'absolute', left: s.startX, top: s.startY,
              fontSize: s.size, opacity: 0,
              transform: `rotate(${s.rot}deg)`,
              animation: `musicNoteFloat ${s.dur}ms ease-out ${s.delay}ms forwards`,
              '--endX': s.endX + 'px', '--endY': s.endY + 'px',
              '--noteOpacity': 0.85,
              textShadow: '0 0 12px rgba(130,0,220,.8), 0 0 24px rgba(80,0,160,.4)',
            }}>{s.char}</div>
          ))}
          {particles.map((p, i) => (
            <div key={'np'+i} className="anim-explosion-particle" style={{
              '--dx': p.dx + 'px', '--dy': p.dy + 'px', '--size': p.size + 'px',
              '--color': p.color, animationDelay: p.delay + 'ms', animationDuration: p.dur + 'ms',
            }} />
          ))}
          {wisps.map((w, i) => (
            <div key={'nw'+i} style={{
              position: 'absolute', left: w.xOff, top: w.startY,
              width: w.size, height: w.size, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(150,50,255,.6), rgba(80,0,150,.2))',
              boxShadow: '0 0 8px rgba(130,0,220,.5)',
              animation: `holySparkleRise ${w.dur}ms ease-out ${w.delay}ms forwards`,
              opacity: 0,
            }} />
          ))}
        </div>
      );
    };
  })(),
  dumbbell_pump: (() => {
    // Dumbbell pumps up and down twice — Muscle Training
    return function DumbbellPumpEffect({ x, y }) {
      const sparks1 = useMemo(() => Array.from({ length: 10 }, () => {
        const angle = Math.random() * Math.PI;
        const speed = 15 + Math.random() * 30;
        return {
          dx: Math.cos(angle) * speed - speed / 2,
          dy: -Math.abs(Math.sin(angle) * speed),
          size: 2 + Math.random() * 4,
          color: ['#ffcc00','#ff8800','#ffaa33','#ffe066','#fff'][Math.floor(Math.random() * 5)],
          delay: 480 + Math.random() * 60,
          dur: 300 + Math.random() * 200,
        };
      }), []);
      const sparks2 = useMemo(() => Array.from({ length: 10 }, () => {
        const angle = Math.random() * Math.PI;
        const speed = 15 + Math.random() * 30;
        return {
          dx: Math.cos(angle) * speed - speed / 2,
          dy: -Math.abs(Math.sin(angle) * speed),
          size: 2 + Math.random() * 4,
          color: ['#ffcc00','#ff8800','#ffaa33','#ffe066','#fff'][Math.floor(Math.random() * 5)],
          delay: 1080 + Math.random() * 60,
          dur: 300 + Math.random() * 200,
        };
      }), []);
      const weightStyle = {
        width: 10, height: 36,
        background: 'linear-gradient(to right, #999, #555)',
        borderRadius: 3,
        boxShadow: '0 2px 6px rgba(0,0,0,.5), inset 0 1px 2px rgba(255,255,255,.3)',
      };
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          <div style={{
            animation: 'dumbbellPump 1.5s ease-in-out forwards',
            display: 'flex', flexDirection: 'row', alignItems: 'center',
            marginLeft: -35, marginTop: -50,
          }}>
            <div style={weightStyle} />
            <div style={{
              width: 50, height: 8,
              background: 'linear-gradient(to bottom, #bbb, #888, #bbb)',
              boxShadow: 'inset 0 0 4px rgba(0,0,0,.3)',
            }} />
            <div style={weightStyle} />
          </div>
          {sparks1.map((s, i) => (
            <div key={'ms1'+i} className="anim-explosion-particle" style={{
              '--dx': s.dx + 'px', '--dy': s.dy + 'px', '--size': s.size + 'px',
              '--color': s.color, animationDelay: s.delay + 'ms', animationDuration: s.dur + 'ms',
            }} />
          ))}
          {sparks2.map((s, i) => (
            <div key={'ms2'+i} className="anim-explosion-particle" style={{
              '--dx': s.dx + 'px', '--dy': s.dy + 'px', '--size': s.size + 'px',
              '--color': s.color, animationDelay: s.delay + 'ms', animationDuration: s.dur + 'ms',
            }} />
          ))}
        </div>
      );
    };
  })(),
  water_splash: (() => {
    // Water splash — hero dives into water (Jump in the River)
    return function WaterSplashEffect({ x, y }) {
      const drops = useMemo(() => Array.from({ length: 24 }, () => {
        const angle = -Math.PI * 0.1 + Math.random() * Math.PI * 1.2;
        const speed = 25 + Math.random() * 55;
        return {
          dx: Math.cos(angle) * speed,
          dy: -Math.abs(Math.sin(angle) * speed) - 10,
          size: 4 + Math.random() * 8,
          delay: Math.random() * 200,
          dur: 500 + Math.random() * 400,
          color: ['#4488cc','#66aaee','#3377bb','#88ccff','#aaddff','#2266aa'][Math.floor(Math.random() * 6)],
        };
      }), []);
      const ripples = useMemo(() => Array.from({ length: 3 }, (_, i) => ({
        delay: i * 200,
        dur: 800 + i * 200,
        size: 40 + i * 30,
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          <div className="anim-flame-flash" style={{ width: 120, height: 60, marginLeft: -60, marginTop: -10, background: 'radial-gradient(ellipse, rgba(60,140,220,.7) 0%, rgba(40,100,180,.3) 50%, transparent 80%)' }} />
          {ripples.map((r, i) => (
            <div key={'wr'+i} style={{
              position: 'absolute', left: -r.size/2, top: -8,
              width: r.size, height: r.size * 0.35, borderRadius: '50%',
              border: '2px solid rgba(100,180,255,.5)',
              animation: `waterRipple ${r.dur}ms ease-out ${r.delay}ms forwards`,
              opacity: 0,
            }} />
          ))}
          {drops.map((d, i) => (
            <div key={'wd'+i} className="anim-explosion-particle" style={{
              '--dx': d.dx + 'px', '--dy': d.dy + 'px', '--size': d.size + 'px',
              '--color': d.color, animationDelay: d.delay + 'ms', animationDuration: d.dur + 'ms',
            }} />
          ))}
        </div>
      );
    };
  })(),
  sunglasses_drop: (() => {
    // Sunglasses slowly descend onto the Hero — Divine Gift of Coolness
    return function SunglassesDropEffect({ x, y }) {
      const sparkles = useMemo(() => Array.from({ length: 12 }, () => ({
        xOff: -30 + Math.random() * 60,
        startY: -5 + Math.random() * 15,
        endY: -40 - Math.random() * 50,
        delay: 1000 + Math.random() * 400,
        dur: 500 + Math.random() * 400,
        size: 3 + Math.random() * 5,
        color: ['#ffdd44','#fff','#ffcc00','#ffe088','#ffffff'][Math.floor(Math.random() * 5)],
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          <div style={{
            animation: 'sunglassesDrop 1.8s ease-in-out forwards',
            fontSize: 48, marginLeft: -24, marginTop: -70,
            filter: 'drop-shadow(0 2px 8px rgba(0,0,0,.4))',
          }}>🕶️</div>
          {sparkles.map((s, i) => (
            <div key={'sg'+i} style={{
              position: 'absolute', left: s.xOff, top: s.startY,
              width: s.size, height: s.size, borderRadius: '50%',
              background: s.color,
              boxShadow: `0 0 ${s.size + 2}px ${s.color}`,
              animation: `holySparkleRise ${s.dur}ms ease-out ${s.delay}ms forwards`,
              opacity: 0,
            }} />
          ))}
        </div>
      );
    };
  })(),
  anger_mark: (() => {
    // 💢 anger symbol — pops in and fades (Challenge redirect)
    return function AngerMarkEffect({ x, y }) {
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 52, animation: 'tigerFadeInOut 1s ease-in-out forwards', marginLeft: -26, marginTop: -36 }}>💢</div>
        </div>
      );
    };
  })(),
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

// Status select prompt component (for Beer, etc.) — must be a proper component for hooks
function CardGalleryMultiPrompt({ ep, onRespond }) {
  const cards = ep.cards || [];
  const maxSelect = ep.selectCount || 3;
  const minSelect = ep.minSelect || (ep.maxBudget != null ? 1 : maxSelect);
  const maxBudget = ep.maxBudget;
  const costKey = ep.costKey || 'cost';
  const [selected, setSelected] = useState([]);

  const totalCost = maxBudget != null
    ? selected.reduce((sum, name) => {
        const entry = cards.find(c => c.name === name);
        return sum + (entry?.[costKey] || 0);
      }, 0)
    : 0;

  const toggleCard = (name) => {
    setSelected(prev => {
      if (prev.includes(name)) return prev.filter(n => n !== name);
      if (prev.length >= maxSelect) return prev;
      // Budget check
      if (maxBudget != null) {
        const entry = cards.find(c => c.name === name);
        const entryCost = entry?.[costKey] || 0;
        const currentTotal = prev.reduce((sum, n) => {
          const e = cards.find(c => c.name === n);
          return sum + (e?.[costKey] || 0);
        }, 0);
        if (currentTotal + entryCost > maxBudget) return prev;
      }
      return [...prev, name];
    });
  };

  const canConfirm = selected.length >= minSelect && selected.length <= maxSelect;

  return (
    <div className="modal-overlay" onClick={ep.cancellable !== false ? () => onRespond({ cancelled: true }) : undefined}>
      <div className="modal animate-in deck-viewer-modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span className="orbit-font" style={{ fontSize: 13, color: 'var(--accent)' }}>
            {ep.title || 'Select Cards'}
          </span>
          {ep.cancellable !== false && (
            <button className="btn" style={{ padding: '4px 12px', fontSize: 10 }}
              onClick={() => onRespond({ cancelled: true })}>✕ CANCEL</button>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>
          {ep.description}
          {maxBudget != null && (
            <span style={{ marginLeft: 8, color: totalCost > maxBudget * 0.8 ? '#ffaa33' : 'var(--accent)', fontWeight: 600 }}>
              (Cost: {totalCost}/{maxBudget})
            </span>
          )}
        </div>
        <div className="deck-viewer-grid">
          {cards.map((entry, i) => {
            const card = CARDS_BY_NAME[entry.name];
            if (!card) return null;
            const isSel = selected.includes(entry.name);
            const entryCost = entry[costKey] || 0;
            const wouldExceedBudget = maxBudget != null && !isSel && totalCost + entryCost > maxBudget;
            const atMax = !isSel && selected.length >= maxSelect;
            const dimmed = wouldExceedBudget || atMax;
            return (
              <div key={entry.name + '-' + i} style={{ position: 'relative' }}>
                <CardMini card={card}
                  onClick={dimmed ? undefined : () => toggleCard(entry.name)}
                  style={{ width: '100%', height: 120, cursor: dimmed ? 'not-allowed' : 'pointer',
                    outline: isSel ? '3px solid var(--accent)' : 'none',
                    filter: isSel ? 'brightness(1.2)' : (dimmed ? 'brightness(0.4) saturate(0.3)' : 'none'),
                  }} />
                {isSel && <div style={{ position: 'absolute', top: 3, right: 3, background: 'var(--accent)', color: '#000', fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 3, zIndex: 5 }}>✓</div>}
                {maxBudget != null && <div style={{ position: 'absolute', bottom: 3, left: 3, background: 'rgba(0,0,0,.7)', color: '#ffd700', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, zIndex: 5 }}>{entryCost}G</div>}
              </div>
            );
          })}
        </div>
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button className={'btn ' + (ep.confirmClass || '')} style={{ padding: '8px 24px', fontSize: 12 }}
            disabled={!canConfirm}
            onClick={() => onRespond({ selectedCards: selected })}>
            {ep.confirmLabel || `Confirm (${selected.length}/${maxSelect})`}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusSelectPrompt({ ep, onRespond }) {
  const [localSelected, setLocalSelected] = useState(() => (ep.statuses || []).map(s => s.key));
  const toggleStatus = (key) => {
    setLocalSelected(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };
  return (
    <DraggablePanel className="first-choice-panel animate-in" style={{ borderColor: '#33dd55', minWidth: 260 }}>
      <div className="orbit-font" style={{ fontSize: 13, color: '#33dd55', marginBottom: 4 }}>{ep.title}</div>
      <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>{ep.description}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
        {(ep.statuses || []).map(s => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 8px', borderRadius: 4,
            background: localSelected.includes(s.key) ? 'rgba(50,220,80,.15)' : 'rgba(255,255,255,.03)',
            border: localSelected.includes(s.key) ? '1px solid rgba(50,220,80,.5)' : '1px solid rgba(255,255,255,.08)',
          }} onClick={() => toggleStatus(s.key)}>
            <span style={{ fontSize: 16 }}>{s.icon}</span>
            <span style={{ fontSize: 12, color: localSelected.includes(s.key) ? '#88ffaa' : 'var(--text2)' }}>{s.label}{s.stacks > 1 ? ` (×${s.stacks})` : ''}</span>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: localSelected.includes(s.key) ? '#33dd55' : 'var(--text2)', opacity: .6 }}>
              {localSelected.includes(s.key) ? '✓' : '○'}
            </span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button className="btn btn-success" style={{ padding: '6px 20px', fontSize: 11 }}
          onClick={() => onRespond({ selectedStatuses: localSelected })}>
          {ep.confirmLabel || 'Confirm'}
        </button>
        {ep.cancellable !== false && (
          <button className="btn" style={{ padding: '6px 16px', fontSize: 11 }}
            onClick={() => onRespond({ cancelled: true })}>← Back</button>
        )}
      </div>
    </DraggablePanel>
  );
}

function GameBoard({ gameState, lobby, onLeave }) {
  const { user, notify } = useContext(AppContext);
  const isSpectator = gameState.isSpectator || false;
  const myIdx = gameState.myIndex;
  const oppIdx = myIdx === 0 ? 1 : 0;
  const me = gameState.players[myIdx];
  const opp = gameState.players[oppIdx];
  const gameSkins = useMemo(() => ({ ...(me.deckSkins || {}), ...(opp.deckSkins || {}) }), [me.deckSkins, opp.deckSkins]);
  const result = gameState.result;
  const iWon = result && result.winnerIdx === myIdx;
  const oppLeft = opp.left || false;
  const oppDisconnected = opp.disconnected || false;
  const meDisconnected = me.disconnected || false;
  const myRematchSent = !isSpectator && (gameState.rematchRequests || []).includes(user.id);

  // Board skin helpers — construct zone background style from board ID
  const boardZoneStyle = (boardId, zoneType) => {
    if (!boardId) return undefined;
    const num = boardId.replace(/\D/g, '');
    return {
      backgroundImage: 'url(/data/shop/boards/' + encodeURIComponent(zoneType + num) + '.png)',
      backgroundSize: 'cover', backgroundPosition: 'center',
    };
  };
  const myBoardZone = (zoneType) => boardZoneStyle(me.board, zoneType);
  const oppBoardZone = (zoneType) => boardZoneStyle(opp.board, zoneType);

  // Area zone positioning — measure hero zones to find midpoints between columns
  const boardCenterRef = useRef(null);
  const [areaPositions, setAreaPositions] = useState([undefined, undefined]);

  useEffect(() => {
    const measure = () => {
      const container = boardCenterRef.current;
      if (!container) return;
      // Find all hero zones from the "me" side (bottom) for stable measurement
      const myHeroes = container.querySelectorAll('[data-hero-owner="me"][data-hero-zone]');
      if (myHeroes.length < 3) return;
      const containerRect = container.getBoundingClientRect();
      const rects = Array.from(myHeroes).sort((a, b) => +a.dataset.heroIdx - +b.dataset.heroIdx).map(el => el.getBoundingClientRect());
      // Midpoint between hero 0 right edge and hero 1 left edge
      const mid01 = ((rects[0].left + rects[0].right) / 2 + (rects[1].left + rects[1].right) / 2) / 2 - containerRect.left - 34;
      // Midpoint between hero 1 right edge and hero 2 left edge
      const mid12 = ((rects[1].left + rects[1].right) / 2 + (rects[2].left + rects[2].right) / 2) / 2 - containerRect.left - 34;
      setAreaPositions([mid01, mid12]);
    };
    measure();
    window.addEventListener('resize', measure);
    const timer = setTimeout(measure, 200);
    return () => { window.removeEventListener('resize', measure); clearTimeout(timer); };
  }, [gameState.turn, gameState.players[0]?.islandZoneCount, gameState.players[1]?.islandZoneCount]);

  // Local hand state for reordering
  const [hand, setHand] = useState(me.hand || []);
  const handKeyRef = useRef(JSON.stringify(me.hand || []));
  const [drawAnimCards, setDrawAnimCards] = useState([]); // [{id, cardName, origIdx}]
  const prevHandLenRef = useRef((me.hand || []).length);
  // Spectator: track bottom player hand count for draw animations (like opponent draw)
  const [specMeDrawAnims, setSpecMeDrawAnims] = useState([]);
  const [specMeDrawHidden, setSpecMeDrawHidden] = useState(new Set());
  const prevSpecMeHandCountRef = useRef(me.handCount || 0);
  useEffect(() => {
    if (isSpectator) {
      // Spectator mode: use handCount-based detection (same as opponent draw)
      const newCount = me.handCount || 0;
      const prevCount = prevSpecMeHandCountRef.current;
      if (newCount > prevCount) {
        const hiddenIdxs = new Set();
        for (let i = prevCount; i < newCount; i++) hiddenIdxs.add(i);
        setSpecMeDrawHidden(prev => new Set([...prev, ...hiddenIdxs]));
        requestAnimationFrame(() => {
          const deckEl = document.querySelector('[data-my-deck]');
          const handCards = document.querySelectorAll('.game-hand-me .game-hand-cards .hand-card');
          const deckRect = deckEl?.getBoundingClientRect();
          if (deckRect && handCards.length > 0) {
            const newAnims = [];
            for (let i = 0; i < newCount - prevCount; i++) {
              const targetCard = handCards[handCards.length - 1 - (newCount - prevCount - 1 - i)];
              const targetRect = targetCard?.getBoundingClientRect();
              if (!targetRect) continue;
              newAnims.push({
                id: Date.now() + Math.random() + i,
                startX: deckRect.left + deckRect.width / 2 - 32,
                startY: deckRect.top + deckRect.height / 2 - 45,
                endX: targetRect.left, endY: targetRect.top,
              });
            }
            if (newAnims.length > 0) {
              setSpecMeDrawAnims(prev => [...prev, ...newAnims]);
              setTimeout(() => {
                setSpecMeDrawAnims(prev => prev.filter(a => !newAnims.some(n => n.id === a.id)));
                setSpecMeDrawHidden(prev => {
                  const next = new Set(prev);
                  hiddenIdxs.forEach(idx => next.delete(idx));
                  return next.size > 0 ? next : new Set();
                });
              }, 500);
            } else {
              setSpecMeDrawHidden(new Set());
            }
          } else {
            setSpecMeDrawHidden(new Set());
          }
        });
      }
      prevSpecMeHandCountRef.current = newCount;
      return;
    }
    const newKey = JSON.stringify(me.hand || []);
    if (newKey !== handKeyRef.current) {
      const newHand = me.hand || [];
      const prevLen = prevHandLenRef.current;
      handKeyRef.current = newKey;
      setHand(newHand);
      // Detect newly drawn cards (added at end of hand)
      if (newHand.length > prevLen) {
        const deckEl = document.querySelector('[data-my-deck]');
        const deckRect = deckEl?.getBoundingClientRect();
        if (deckRect) {
          const newAnims = [];
          for (let i = prevLen; i < newHand.length; i++) {
            newAnims.push({
              id: Date.now() + Math.random() + i,
              cardName: newHand[i],
              origIdx: i,
              startX: deckRect.left + deckRect.width / 2 - 32,
              startY: deckRect.top + deckRect.height / 2 - 45,
            });
          }
          setDrawAnimCards(prev => [...prev, ...newAnims]);
          setTimeout(() => {
            setDrawAnimCards(prev => prev.filter(a => !newAnims.some(n => n.id === a.id)));
          }, 500);
        }
      }
      prevHandLenRef.current = newHand.length;
    }
  }, [me.hand, me.handCount]);

  // Opponent draw animation tracking
  const [oppDrawAnims, setOppDrawAnims] = useState([]);
  const [oppDrawHidden, setOppDrawHidden] = useState(new Set()); // indices to hide during anim
  const prevOppHandCountRef = useRef(opp.handCount || 0);
  useEffect(() => {
    const newCount = opp.handCount || 0;
    const prevCount = prevOppHandCountRef.current;
    if (newCount > prevCount) {
      // Hide new cards immediately (visibility:hidden preserves layout for position reading)
      const hiddenIdxs = new Set();
      for (let i = prevCount; i < newCount; i++) hiddenIdxs.add(i);
      setOppDrawHidden(prev => new Set([...prev, ...hiddenIdxs]));
      // Wait one frame for DOM to update with new hand cards
      requestAnimationFrame(() => {
        const deckEl = document.querySelector('[data-opp-deck]');
        const handCards = document.querySelectorAll('.game-hand-opp .game-hand-cards .hand-card');
        const deckRect = deckEl?.getBoundingClientRect();
        if (deckRect && handCards.length > 0) {
          const newAnims = [];
          const deckSearchPending = deckSearchPendingRef.current;
          for (let i = 0; i < newCount - prevCount; i++) {
            // Target the last card(s) in the hand — new cards appear at the end
            const targetCard = handCards[handCards.length - 1 - (newCount - prevCount - 1 - i)];
            const targetRect = targetCard?.getBoundingClientRect();
            if (!targetRect) continue;
            const sx = deckRect.left + deckRect.width / 2 - 32;
            const sy = deckRect.top + deckRect.height / 2 - 45;
            // If this is a deck-searched card, show face-up in the normal draw animation
            if (deckSearchPending.length > 0) {
              const searchCardName = deckSearchPending.shift();
              newAnims.push({
                id: Date.now() + Math.random() + i,
                startX: sx, startY: sy,
                endX: targetRect.left, endY: targetRect.top,
                cardName: searchCardName, // Face-up
              });
            } else {
              newAnims.push({
                id: Date.now() + Math.random() + i,
                startX: sx, startY: sy,
                endX: targetRect.left, endY: targetRect.top,
              });
            }
          }
          if (newAnims.length > 0) {
            setOppDrawAnims(prev => [...prev, ...newAnims]);
            setTimeout(() => {
              setOppDrawAnims(prev => prev.filter(a => !newAnims.some(n => n.id === a.id)));
              setOppDrawHidden(prev => {
                const next = new Set(prev);
                hiddenIdxs.forEach(idx => next.delete(idx));
                return next.size > 0 ? next : new Set();
              });
            }, 500);
          } else {
            setOppDrawHidden(prev => {
              const next = new Set(prev);
              hiddenIdxs.forEach(idx => next.delete(idx));
              return next.size > 0 ? next : new Set();
            });
          }
        } else {
          setOppDrawHidden(new Set());
        }
      });
    }
    prevOppHandCountRef.current = newCount;
  }, [opp.handCount]);

  // ─── Discard/Delete animation tracking (hand-to-pile + board-to-pile, both players) ───
  const [gameAnims, setGameAnims] = useState([]); // Active particle animations (moved up for creature death access)
  const [beamAnims, setBeamAnims] = useState([]); // Beam animations (laser, etc.)
  const [ramAnims, setRamAnims] = useState([]); // Ram animations (hero charges to target and back)
  const [transferAnims, setTransferAnims] = useState([]); // Card transfer animations (Dark Gear, etc.)
  const [projectileAnims, setProjectileAnims] = useState([]); // Projectile animations (phoenix cannon, etc.)
  const [discardAnims, setDiscardAnims] = useState([]);
  const [myDiscardHidden, setMyDiscardHidden] = useState(0);
  const [oppDiscardHidden, setOppDiscardHidden] = useState(0);
  const [myDeletedHidden, setMyDeletedHidden] = useState(0);
  const [oppDeletedHidden, setOppDeletedHidden] = useState(0);
  const myHandRectsRef = useRef([]);
  const oppHandRectsRef = useRef([]);
  const boardCardRectsRef = useRef({ me: {}, opp: {} }); // cardName → [DOMRect, ...]
  const prevMyHandForDiscardRef = useRef([...(me.hand || [])]);
  const prevMyHandCountForDiscardRef = useRef(me.handCount || 0); // spectator mode
  const prevMyDiscardLenRef = useRef((me.discardPile || []).length);
  const prevMyDeletedLenRef = useRef((me.deletedPile || []).length);
  const prevOppHandCountForDiscardRef = useRef(opp.handCount || 0);
  const prevOppDiscardLenRef = useRef((opp.discardPile || []).length);
  const prevOppDeletedLenRef = useRef((opp.deletedPile || []).length);

  // Helper: build pile-target rect
  const getPileCenter = (selector) => {
    const el = document.querySelector(selector);
    const r = el?.getBoundingClientRect();
    return r ? { x: r.left + r.width / 2 - 32, y: r.top + r.height / 2 - 45 } : null;
  };

  // Helper: create anims from board rects for unmatched pile entries
  const animsFromBoard = (entries, boardRects, dest, destSelector) => {
    const target = getPileCenter(destSelector);
    if (!target) return [];
    const anims = [];
    for (const cardName of entries) {
      const positions = boardRects[cardName];
      if (!positions || positions.length === 0) continue;
      const sr = positions.shift();
      anims.push({ id: Date.now() + Math.random(), cardName, startX: sr.left, startY: sr.top, endX: target.x, endY: target.y, dest });
    }
    return anims;
  };

  // Helper: schedule anim state + pile hiding
  const scheduleAnims = (newAnims, setDiscardHidden, setDeletedHidden) => {
    if (newAnims.length === 0) return;
    const dc = newAnims.filter(a => a.dest === 'discard').length;
    const dl = newAnims.filter(a => a.dest === 'deleted').length;
    if (dc > 0) setDiscardHidden(prev => prev + dc);
    if (dl > 0) setDeletedHidden(prev => prev + dl);
    setDiscardAnims(prev => [...prev, ...newAnims]);
    setTimeout(() => {
      setDiscardAnims(prev => prev.filter(a => !newAnims.some(n => n.id === a.id)));
      if (dc > 0) setDiscardHidden(prev => Math.max(0, prev - dc));
      if (dl > 0) setDeletedHidden(prev => Math.max(0, prev - dl));
    }, 500);
  };

  // Helper: capture board card positions into boardCardRectsRef
  const captureBoardRects = () => {
    const br = { me: {}, opp: {} };
    for (const ow of ['me', 'opp']) {
      const pi = ow === 'me' ? myIdx : oppIdx;
      const p = gameState.players[pi];
      if (!p) continue;
      document.querySelectorAll(`[data-support-zone][data-support-owner="${ow}"]`).forEach(el => {
        const cards = p.supportZones?.[el.dataset.supportHero]?.[el.dataset.supportSlot] || [];
        if (cards.length > 0) { const r = el.getBoundingClientRect(); for (const cn of cards) (br[ow][cn] = br[ow][cn] || []).push(r); }
      });
      document.querySelectorAll(`[data-ability-zone][data-ability-owner="${ow}"]`).forEach(el => {
        const cards = p.abilityZones?.[el.dataset.abilityHero]?.[el.dataset.abilitySlot] || [];
        if (cards.length > 0) { const r = el.getBoundingClientRect(); for (const cn of cards) (br[ow][cn] = br[ow][cn] || []).push(r); }
      });
      document.querySelectorAll(`[data-surprise-zone][data-surprise-owner="${ow}"]`).forEach(el => {
        const cards = p.surpriseZones?.[el.dataset.surpriseHero] || [];
        if (cards.length > 0) { const r = el.getBoundingClientRect(); for (const cn of cards) (br[ow][cn] = br[ow][cn] || []).push(r); }
      });
    }
    boardCardRectsRef.current = br;
  };

  // Own discard/delete detection (useLayoutEffect prevents flash before paint)
  useLayoutEffect(() => {
    if (isSpectator) {
      // Spectator mode: use handCount-based detection (same as opponent discard)
      const newCount = me.handCount || 0;
      const prevCount = prevMyHandCountForDiscardRef.current;
      const newDiscardLen = (me.discardPile || []).length;
      const prevDiscardLen = prevMyDiscardLenRef.current;
      const newDeletedLen = (me.deletedPile || []).length;
      const prevDeletedLen = prevMyDeletedLenRef.current;
      const discardGrew = newDiscardLen > prevDiscardLen;
      const deletedGrew = newDeletedLen > prevDeletedLen;

      if (discardGrew || deletedGrew) {
        const newDiscardEntries = discardGrew ? [...me.discardPile.slice(prevDiscardLen)] : [];
        const newDeletedEntries = deletedGrew ? [...me.deletedPile.slice(prevDeletedLen)] : [];
        const newAnims = [];

        // 1. Match against hand removals (hand count decreased)
        if (newCount < prevCount) {
          const storedRects = myHandRectsRef.current;
          let handSlotCursor = prevCount - 1;
          const handDiscardCount = Math.min(prevCount - newCount, newDiscardEntries.length);
          for (let i = 0; i < handDiscardCount; i++) {
            const sr = storedRects[Math.max(0, Math.min(handSlotCursor--, storedRects.length - 1))];
            if (!sr) continue;
            const cardName = newDiscardEntries.shift();
            const t = getPileCenter('[data-my-discard]');
            if (t) newAnims.push({ id: Date.now() + Math.random() + i, cardName, startX: sr.left, startY: sr.top, endX: t.x, endY: t.y, dest: 'discard' });
          }
          const handDeletedCount = Math.min(Math.max(0, (prevCount - newCount) - handDiscardCount), newDeletedEntries.length);
          for (let i = 0; i < handDeletedCount; i++) {
            const sr = storedRects[Math.max(0, Math.min(handSlotCursor--, storedRects.length - 1))];
            if (!sr) continue;
            const cardName = newDeletedEntries.shift();
            const t = getPileCenter('[data-my-deleted]');
            if (t) newAnims.push({ id: Date.now() + Math.random() + 0.5 + i, cardName, startX: sr.left, startY: sr.top, endX: t.x, endY: t.y, dest: 'deleted' });
          }
        }

        // 2. Remaining entries from board
        const br = boardCardRectsRef.current.me || {};
        const boardAnims = [...animsFromBoard(newDiscardEntries, br, 'discard', '[data-my-discard]'), ...animsFromBoard(newDeletedEntries, br, 'deleted', '[data-my-deleted]')];
        newAnims.push(...boardAnims);
        for (const a of boardAnims) {
          const card = CARDS_BY_NAME[a.cardName];
          if (card?.cardType === 'Creature') {
            const id = Date.now() + Math.random();
            setGameAnims(prev => [...prev, { id, type: 'creature_death', x: a.startX + 32, y: a.startY + 45 }]);
            setTimeout(() => setGameAnims(prev => prev.filter(g => g.id !== id)), 1200);
          }
        }
        scheduleAnims(newAnims, setMyDiscardHidden, setMyDeletedHidden);
      }

      // Spectator: Mulligan / hand-return-to-deck (hand count shrinks but no pile grows)
      if (!discardGrew && !deletedGrew && newCount < prevCount && (gameState.mulliganPending || gameState.handReturnToDeck)) {
        const storedRects = myHandRectsRef.current;
        const deckEl = document.querySelector('[data-my-deck]');
        const deckR = deckEl?.getBoundingClientRect();
        const deckTarget = deckR ? { x: deckR.left + deckR.width / 2 - 32, y: deckR.top + deckR.height / 2 - 45 } : null;
        if (deckTarget) {
          const returnAnims = [];
          for (let i = 0; i < prevCount - newCount; i++) {
            const sr = storedRects[Math.max(0, prevCount - 1 - i)];
            if (!sr) continue;
            returnAnims.push({ id: Date.now() + Math.random() + i, cardName: '', startX: sr.left, startY: sr.top, endX: deckTarget.x, endY: deckTarget.y, dest: 'deck' });
          }
          if (returnAnims.length > 0) {
            setDiscardAnims(prev => [...prev, ...returnAnims]);
            setTimeout(() => setDiscardAnims(prev => prev.filter(a => !returnAnims.some(n => n.id === a.id))), 500);
          }
        }
      }

      // Capture positions for NEXT cycle (spectator uses face-down .hand-card)
      requestAnimationFrame(() => {
        const rects = [];
        document.querySelectorAll('.game-hand-me .hand-card').forEach((el, i) => { rects[i] = el.getBoundingClientRect(); });
        myHandRectsRef.current = rects;
        captureBoardRects();
      });

      prevMyHandCountForDiscardRef.current = newCount;
      prevMyDiscardLenRef.current = newDiscardLen;
      prevMyDeletedLenRef.current = newDeletedLen;
      return;
    }

    const newHand = me.hand || [];
    const prevHand = prevMyHandForDiscardRef.current;
    const newDiscardLen = (me.discardPile || []).length;
    const prevDiscardLen = prevMyDiscardLenRef.current;
    const newDeletedLen = (me.deletedPile || []).length;
    const prevDeletedLen = prevMyDeletedLenRef.current;
    const discardGrew = newDiscardLen > prevDiscardLen;
    const deletedGrew = newDeletedLen > prevDeletedLen;

    if (discardGrew || deletedGrew) {
      const newDiscardEntries = discardGrew ? [...me.discardPile.slice(prevDiscardLen)] : [];
      const newDeletedEntries = deletedGrew ? [...me.deletedPile.slice(prevDeletedLen)] : [];
      const newAnims = [];

      // 1. Match against hand removals
      if (newHand.length < prevHand.length) {
        // Sequential subsequence match: newHand is a subsequence of prevHand
        // (splice preserves relative order), so a forward scan correctly
        // identifies which exact positions were removed — even for duplicates.
        const removed = [];
        let ni = 0;
        for (let i = 0; i < prevHand.length; i++) {
          if (ni < newHand.length && prevHand[i] === newHand[ni]) {
            ni++;
          } else {
            removed.push({ cardName: prevHand[i], handIdx: i });
          }
        }
        const storedRects = myHandRectsRef.current;
        for (const r of removed) {
          const sr = storedRects[r.handIdx];
          if (!sr) continue;
          let idx = newDiscardEntries.indexOf(r.cardName);
          if (idx >= 0) {
            newDiscardEntries.splice(idx, 1);
            const t = getPileCenter('[data-my-discard]');
            if (t) newAnims.push({ id: Date.now() + Math.random(), cardName: r.cardName, startX: sr.left, startY: sr.top, endX: t.x, endY: t.y, dest: 'discard' });
            continue;
          }
          idx = newDeletedEntries.indexOf(r.cardName);
          if (idx >= 0) {
            newDeletedEntries.splice(idx, 1);
            const t = getPileCenter('[data-my-deleted]');
            if (t) newAnims.push({ id: Date.now() + Math.random(), cardName: r.cardName, startX: sr.left, startY: sr.top, endX: t.x, endY: t.y, dest: 'deleted' });
          }
        }
      }

      // 2. Remaining entries came from the board — use stored board positions
      const br = boardCardRectsRef.current.me || {};
      const boardAnims = [...animsFromBoard(newDiscardEntries, br, 'discard', '[data-my-discard]'), ...animsFromBoard(newDeletedEntries, br, 'deleted', '[data-my-deleted]')];
      newAnims.push(...boardAnims);

      // Trigger creature death effect for board-sourced creatures
      for (const a of boardAnims) {
        const card = CARDS_BY_NAME[a.cardName];
        if (card?.cardType === 'Creature') {
          const id = Date.now() + Math.random();
          setGameAnims(prev => [...prev, { id, type: 'creature_death', x: a.startX + 32, y: a.startY + 45 }]);
          setTimeout(() => setGameAnims(prev => prev.filter(g => g.id !== id)), 1200);
        }
      }

      scheduleAnims(newAnims, setMyDiscardHidden, setMyDeletedHidden);
    }

    // Mulligan / hand-return-to-deck: cards returning to deck (hand shrinks but no pile grows)
    if (!discardGrew && !deletedGrew && newHand.length < prevHand.length && (gameState.mulliganPending || gameState.handReturnToDeck)) {
      const removed = [];
      let ni = 0;
      for (let i = 0; i < prevHand.length; i++) {
        if (ni < newHand.length && prevHand[i] === newHand[ni]) { ni++; }
        else { removed.push({ cardName: prevHand[i], handIdx: i }); }
      }
      const storedRects = myHandRectsRef.current;
      const deckEl = document.querySelector('[data-my-deck]');
      const deckR = deckEl?.getBoundingClientRect();
      const deckTarget = deckR ? { x: deckR.left + deckR.width / 2 - 32, y: deckR.top + deckR.height / 2 - 45 } : null;
      if (deckTarget) {
        const returnAnims = [];
        for (const r of removed) {
          const sr = storedRects[r.handIdx];
          if (!sr) continue;
          returnAnims.push({ id: Date.now() + Math.random(), cardName: r.cardName, startX: sr.left, startY: sr.top, endX: deckTarget.x, endY: deckTarget.y, dest: 'deck' });
        }
        if (returnAnims.length > 0) {
          setDiscardAnims(prev => [...prev, ...returnAnims]);
          setTimeout(() => setDiscardAnims(prev => prev.filter(a => !returnAnims.some(n => n.id === a.id))), 500);
        }
      }
    }

    // Capture positions for NEXT cycle
    requestAnimationFrame(() => {
      const rects = [];
      document.querySelectorAll('.game-hand-me .hand-slot').forEach((el, i) => { rects[i] = el.getBoundingClientRect(); });
      myHandRectsRef.current = rects;
      captureBoardRects();
    });

    prevMyHandForDiscardRef.current = [...newHand];
    prevMyDiscardLenRef.current = newDiscardLen;
    prevMyDeletedLenRef.current = newDeletedLen;
  }, [me.hand, me.handCount, me.discardPile, me.deletedPile]);

  // Opponent discard/delete detection (useLayoutEffect prevents flash before paint)
  useLayoutEffect(() => {
    const newCount = opp.handCount || 0;
    const prevCount = prevOppHandCountForDiscardRef.current;
    const newDiscardLen = (opp.discardPile || []).length;
    const prevDiscardLen = prevOppDiscardLenRef.current;
    const newDeletedLen = (opp.deletedPile || []).length;
    const prevDeletedLen = prevOppDeletedLenRef.current;
    const discardGrew = newDiscardLen > prevDiscardLen;
    const deletedGrew = newDeletedLen > prevDeletedLen;

    if (discardGrew || deletedGrew) {
      const newDiscardEntries = discardGrew ? [...opp.discardPile.slice(prevDiscardLen)] : [];
      const newDeletedEntries = deletedGrew ? [...opp.deletedPile.slice(prevDeletedLen)] : [];
      const newAnims = [];

      // 1. Match against hand removals (hand count decreased)
      if (newCount < prevCount) {
        const storedRects = oppHandRectsRef.current;
        let handSlotCursor = prevCount - 1;
        const handDiscardCount = Math.min(prevCount - newCount, newDiscardEntries.length);
        for (let i = 0; i < handDiscardCount; i++) {
          const sr = storedRects[Math.max(0, Math.min(handSlotCursor--, storedRects.length - 1))];
          if (!sr) continue;
          const cardName = newDiscardEntries.shift();
          const t = getPileCenter('[data-opp-discard]');
          if (t) newAnims.push({ id: Date.now() + Math.random() + i, cardName, startX: sr.left, startY: sr.top, endX: t.x, endY: t.y, dest: 'discard' });
        }
        const handDeletedCount = Math.min(Math.max(0, (prevCount - newCount) - handDiscardCount), newDeletedEntries.length);
        for (let i = 0; i < handDeletedCount; i++) {
          const sr = storedRects[Math.max(0, Math.min(handSlotCursor--, storedRects.length - 1))];
          if (!sr) continue;
          const cardName = newDeletedEntries.shift();
          const t = getPileCenter('[data-opp-deleted]');
          if (t) newAnims.push({ id: Date.now() + Math.random() + 0.5 + i, cardName, startX: sr.left, startY: sr.top, endX: t.x, endY: t.y, dest: 'deleted' });
        }
      }

      // 2. Remaining entries came from the opponent's board
      const br = boardCardRectsRef.current.opp || {};
      const boardAnims = [...animsFromBoard(newDiscardEntries, br, 'discard', '[data-opp-discard]'), ...animsFromBoard(newDeletedEntries, br, 'deleted', '[data-opp-deleted]')];
      newAnims.push(...boardAnims);

      // Trigger creature death effect for board-sourced creatures
      for (const a of boardAnims) {
        const card = CARDS_BY_NAME[a.cardName];
        if (card?.cardType === 'Creature') {
          const id = Date.now() + Math.random();
          setGameAnims(prev => [...prev, { id, type: 'creature_death', x: a.startX + 32, y: a.startY + 45 }]);
          setTimeout(() => setGameAnims(prev => prev.filter(g => g.id !== id)), 1200);
        }
      }

      scheduleAnims(newAnims, setOppDiscardHidden, setOppDeletedHidden);
    }

    // Opponent mulligan / hand-return-to-deck: cards returning to deck (hand count shrinks but no pile grows)
    if (!discardGrew && !deletedGrew && newCount < prevCount && (gameState.mulliganPending || gameState.handReturnToDeck)) {
      const storedRects = oppHandRectsRef.current;
      const deckEl = document.querySelector('[data-opp-deck]');
      const deckR = deckEl?.getBoundingClientRect();
      const deckTarget = deckR ? { x: deckR.left + deckR.width / 2 - 32, y: deckR.top + deckR.height / 2 - 45 } : null;
      if (deckTarget) {
        const returnAnims = [];
        for (let i = 0; i < prevCount - newCount; i++) {
          const sr = storedRects[Math.max(0, prevCount - 1 - i)];
          if (!sr) continue;
          returnAnims.push({ id: Date.now() + Math.random() + i, cardName: '', startX: sr.left, startY: sr.top, endX: deckTarget.x, endY: deckTarget.y, dest: 'deck' });
        }
        if (returnAnims.length > 0) {
          setDiscardAnims(prev => [...prev, ...returnAnims]);
          setTimeout(() => setDiscardAnims(prev => prev.filter(a => !returnAnims.some(n => n.id === a.id))), 500);
        }
      }
    }

    // Capture positions for NEXT cycle
    requestAnimationFrame(() => {
      const rects = [];
      document.querySelectorAll('.game-hand-opp .hand-card').forEach((el, i) => { rects[i] = el.getBoundingClientRect(); });
      oppHandRectsRef.current = rects;
      captureBoardRects();
    });

    prevOppHandCountForDiscardRef.current = newCount;
    prevOppDiscardLenRef.current = newDiscardLen;
    prevOppDeletedLenRef.current = newDeletedLen;
  }, [opp.handCount, opp.discardPile, opp.deletedPile]);

  // Phase helpers
  const currentPhase = gameState.currentPhase || 0;
  const activePlayer = gameState.activePlayer || 0;
  const isMyTurn = !isSpectator && activePlayer === myIdx;
  const activePlayerData = gameState.players[activePlayer];
  const phaseColor = activePlayerData?.color || 'var(--accent)';

  // Card graying logic based on phase
  const ACTION_TYPES = ['Attack', 'Spell', 'Creature'];

  // Check if a creature can be played on ANY hero (level/spell school reqs + free zone)
  const canCreatureBePlayed = (card) => {
    if (!card || card.cardType !== 'Creature') return false;
    return [0,1,2].some(hi => canHeroPlayCard(me, hi, card) && findFreeSupportSlot(me, hi) >= 0);
  };

  // Check if a Spell or Attack can be used by ANY hero (level/spell school reqs, no zone needed)
  const canActionCardBePlayed = (card) => {
    if (!card) return false;
    if (card.cardType === 'Creature') return canCreatureBePlayed(card);
    // Spells and Attacks: just need a hero that meets spell school requirements
    return [0,1,2].some(hi => canHeroPlayCard(me, hi, card));
  };

  const getCardDimmed = (cardName) => {
    if (gameState.awaitingFirstChoice) return false; // Let player see hand clearly
    if (gameState.mulliganPending) return false; // Let player see hand during mulligan
    if (gameState.potionTargeting) return true; // All cards dimmed during targeting

    // Hero Action mode (Coffee) — only eligible cards are playable
    const heroActionPrompt = gameState.effectPrompt?.type === 'heroAction' && gameState.effectPrompt.ownerIdx === myIdx ? gameState.effectPrompt : null;
    if (heroActionPrompt) {
      return !(heroActionPrompt.eligibleCards || []).includes(cardName);
    }

    // Force Discard mode (Wheels) — all cards are selectable
    const forceDiscardPrompt = gameState.effectPrompt?.type === 'forceDiscard' && gameState.effectPrompt.ownerIdx === myIdx;
    if (forceDiscardPrompt) return false;

    // Cancellable Force Discard mode (Training, etc.) — all cards are selectable
    const forceDiscardCancellable = gameState.effectPrompt?.type === 'forceDiscardCancellable' && gameState.effectPrompt.ownerIdx === myIdx;
    if (forceDiscardCancellable) return false;

    // Ability Attach mode (Training, etc.) — only eligible abilities are visible
    const abilityAttachPrompt = gameState.effectPrompt?.type === 'abilityAttach' && gameState.effectPrompt.ownerIdx === myIdx;
    if (abilityAttachPrompt) {
      return !(gameState.effectPrompt.eligibleCards || []).includes(cardName);
    }

    if (!isMyTurn) return true;
    const card = CARDS_BY_NAME[cardName];
    if (!card) return false;
    const isActionType = ACTION_TYPES.includes(card.cardType);
    if (currentPhase === 2 || currentPhase === 4) {
      // Main Phase 1 or 2: gray out action types UNLESS they have Additional Action coverage
      if (isActionType) {
        // Check if this is an inherent action (playable without additional action provider)
        const isInherent = (gameState.inherentActionCards || []).includes(cardName);
        // Check if any Additional Action covers this card
        const additionalActions = gameState.additionalActions || [];
        const hasAdditional = additionalActions.some(aa => aa.eligibleHandCards.includes(cardName));
        if (!hasAdditional && !isInherent) return true;
        // Has additional action — check summonLocked for creatures
        if (card.cardType === 'Creature' && me.summonLocked) return true;
        // Check if the card can actually be played on any hero
        if (!canActionCardBePlayed(card)) return true;
        return false; // Un-gray: playable via Additional Action
      }
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
      // Gray out Potions with no valid targets or when locked
      if (card.cardType === 'Potion') {
        if (me.potionLocked) return true;
        if ((gameState.unactivatableArtifacts || []).includes(cardName)) return true;
      }
      // Gray out spells/attacks with custom play conditions that aren't met (Flame Avalanche, etc.)
      if ((gameState.blockedSpells || []).includes(cardName)) return true;
      return false;
    } else if (currentPhase === 3) {
      // Action Phase: gray out non-action types, and check playability
      if (!isActionType) return true;
      if (card.cardType === 'Creature' && (gameState.summonBlocked || []).includes(cardName)) return true;
      if (card.cardType === 'Creature' && me.summonLocked) return true;
      if ((gameState.blockedSpells || []).includes(cardName)) return true;
      if (!canActionCardBePlayed(card)) return true;
      return false;
    }
    return true; // Start, Resource, End phases: all dimmed
  };

  // Mouse-based drag state (reorder)
  const [handDrag, setHandDrag] = useState(null);
  const handRef = useRef(null);
  const handAnimDataRef = useRef(null); // FLIP animation data: { oldRects[], indexMap[] }

  // ── Hand Shuffle & Sort with FLIP animation ──
  const captureHandRects = () => {
    const slots = handRef.current?.querySelectorAll('.hand-slot');
    if (!slots) return [];
    const rects = [];
    slots.forEach((el, i) => rects[i] = el.getBoundingClientRect());
    return rects;
  };

  const shuffleHand = () => {
    if (hand.length <= 1) return;
    const oldRects = captureHandRects();
    const indices = hand.map((_, i) => i);
    // Fisher-Yates shuffle on indices
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const newHand = indices.map(i => hand[i]);
    // indexMap[newIdx] = oldIdx
    handAnimDataRef.current = { oldRects, indexMap: indices };
    setHand(newHand);
    socket.emit('reorder_hand', { roomId: gameState.roomId, hand: newHand });
  };

  const sortHand = () => {
    if (hand.length <= 1) return;
    const oldRects = captureHandRects();
    const TYPE_ORDER = { Hero: 0, Creature: 1, Ability: 2, Spell: 3, Attack: 4, Artifact: 5, Potion: 6 };
    // Build indexed entries for stable sort
    const entries = hand.map((card, i) => ({ card, oldIdx: i }));
    entries.sort((a, b) => {
      const ca = CARDS_BY_NAME[a.card], cb = CARDS_BY_NAME[b.card];
      const ta = TYPE_ORDER[ca?.cardType] ?? 99, tb = TYPE_ORDER[cb?.cardType] ?? 99;
      if (ta !== tb) return ta - tb;
      return a.card.localeCompare(b.card);
    });
    const newHand = entries.map(e => e.card);
    const indexMap = entries.map(e => e.oldIdx); // indexMap[newIdx] = oldIdx
    handAnimDataRef.current = { oldRects, indexMap };
    setHand(newHand);
    socket.emit('reorder_hand', { roomId: gameState.roomId, hand: newHand });
  };

  // FLIP animation effect — runs after React re-renders the hand
  useLayoutEffect(() => {
    if (!handAnimDataRef.current) return;
    const { oldRects, indexMap } = handAnimDataRef.current;
    handAnimDataRef.current = null;
    const slots = handRef.current?.querySelectorAll('.hand-slot');
    if (!slots || slots.length === 0) return;
    slots.forEach((el, newIdx) => {
      const oldIdx = indexMap[newIdx];
      if (oldIdx === undefined || !oldRects[oldIdx]) return;
      const newRect = el.getBoundingClientRect();
      const dx = oldRects[oldIdx].left - newRect.left;
      if (Math.abs(dx) < 1) return;
      el.style.transition = 'none';
      el.style.transform = `translateX(${dx}px)`;
    });
    // Force reflow, then animate to final positions
    void handRef.current?.offsetHeight;
    slots.forEach((el) => {
      if (!el.style.transform || el.style.transform === 'none') return;
      el.style.transition = 'transform 0.3s ease-out';
      el.style.transform = '';
    });
    // Clean up transition after animation
    const cleanup = () => {
      slots.forEach(el => { el.style.transition = ''; });
    };
    setTimeout(cleanup, 350);
  }, [hand]);

  // Play-mode drag state (Action Phase — dragging to board)
  const [playDrag, setPlayDrag] = useState(null);

  // Ability drag state (Main Phases — dragging ability to hero/zone)
  const [abilityDrag, setAbilityDrag] = useState(null); // { idx, cardName, card, mouseX, mouseY, targetHero, targetZone }

  // Additional Action provider selection state
  const [pendingAdditionalPlay, setPendingAdditionalPlay] = useState(null); // { cardName, handIndex, heroIdx, zoneSlot, providers: [{cardId, cardName, heroIdx, zoneSlot}] }
  const [pendingAbilityActivation, setPendingAbilityActivation] = useState(null); // { heroIdx, zoneIdx, abilityName, level }

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
    // Frozen/stunned/negated/bound heroes can't perform Actions —
    // playing a card from hand IS an Action.
    if (card.cardType !== 'Ability') {
      if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated || hero.statuses?.bound) return false;
    }
    // Combo lock: only the locked hero can act
    if (playerData.comboLockHeroIdx != null && playerData.comboLockHeroIdx !== heroIdx) return false;
    // Main Phase: per-hero inherent action restrictions (Muscle Training, etc.)
    // If a card is playable ONLY via inherent action and this hero isn't eligible, block it.
    if (currentPhase === 2 || currentPhase === 4) {
      const inherentHeroes = gameState.inherentActionHeroes?.[card.name];
      if (inherentHeroes !== undefined) {
        const hasAdditional = (gameState.additionalActions || []).some(aa => aa.eligibleHandCards.includes(card.name));
        if (!hasAdditional && !inherentHeroes.includes(heroIdx)) return false;
      }
    }
    // Bonus actions: only allowed card types during active bonus
    if (playerData.bonusActions?.heroIdx === heroIdx && playerData.bonusActions.remaining > 0) {
      const allowed = playerData.bonusActions.allowedTypes || [];
      if (allowed.length > 0 && !allowed.includes(card.cardType)) return false;
    }
    // Per-hero duplicate Attack ban (Ghuanjun)
    if (card.cardType === 'Attack' && hero.ghuanjunAttacksUsed?.includes(card.name)) return false;
    // Apply board-wide level reductions from `reduceCardLevel` hooks (Elven
    // Forager, …). The server provides the per-card delta in
    // `cardLevelReductions`; we subtract it so the UI agrees with the
    // server's `heroMeetsLevelReq`.
    const rawLevel = card.level || 0;
    const reduction = (gameState.cardLevelReductions || {})[card.name] || 0;
    const level = Math.max(0, rawLevel - reduction);
    if (level === 0 && !card.spellSchool1) return true; // No requirements
    const abZones = playerData.abilityZones[heroIdx] || [];
    const countAbility = (school) => {
      let count = 0;
      for (const slot of abZones) {
        if (!slot || slot.length === 0) continue;
        const baseAbility = slot[0]; // Performance transforms into this
        for (const abName of slot) {
          if (abName === school) count++;
          else if (abName === 'Performance' && baseAbility === school) count++;
        }
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
    if (isSpectator) {
      const firstPlayer = gameState.players[gameState.activePlayer || 0];
      return { text: `${firstPlayer?.username || 'Player'} goes first!`, color: 'var(--accent)' };
    }
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
      if (isSpectator) {
        const ap = gameState.players[gameState.activePlayer || 0];
        setAnnouncement({ text: `${ap?.username || 'Player'}'s turn!`, color: 'var(--accent)', short: true });
      } else if ((gameState.activePlayer || 0) === myIdx) {
        setAnnouncement({ text: 'YOUR TURN!', color: 'var(--success)', short: true });
      }
    }
  }, [gameState.turn, gameState.awaitingFirstChoice]);

  const [mulliganDecided, setMulliganDecided] = useState(false);
  // Reset mulligan state when a new game starts
  useEffect(() => {
    if (!gameState.mulliganPending) setMulliganDecided(false);
  }, [gameState.mulliganPending]);

  // Reset SC earned display when a new round starts (result clears)
  useEffect(() => {
    if (!gameState.result) setScEarned(null);
  }, [gameState.result]);

  const onHandMouseDown = (e, idx) => {
    if (e.button !== 0) return;
    if (isSpectator) return; // Spectators can't interact with cards
    const cardName = hand[idx];
    const dimmed = getCardDimmed(cardName);

    // Force Discard mode — clicking any card discards it
    const forceDiscardActive = gameState.effectPrompt?.type === 'forceDiscard' && gameState.effectPrompt.ownerIdx === myIdx;
    if (forceDiscardActive) {
      e.preventDefault();
      socket.emit('effect_prompt_response', { roomId: gameState.roomId, response: { cardName, handIndex: idx } });
      return;
    }

    // Cancellable Force Discard mode (Training, etc.) — clicking a card discards it
    const forceDiscardCancellableActive = gameState.effectPrompt?.type === 'forceDiscardCancellable' && gameState.effectPrompt.ownerIdx === myIdx;
    if (forceDiscardCancellableActive) {
      e.preventDefault();
      socket.emit('effect_prompt_response', { roomId: gameState.roomId, response: { cardName, handIndex: idx } });
      return;
    }

    e.preventDefault();
    const card = CARDS_BY_NAME[cardName];

    // Ability Attach mode (Training, etc.) — only eligible ability cards are draggable
    const abilityAttachPrompt = gameState.effectPrompt?.type === 'abilityAttach' && gameState.effectPrompt.ownerIdx === myIdx ? gameState.effectPrompt : null;
    const isAbilityAttachEligible = abilityAttachPrompt && (abilityAttachPrompt.eligibleCards || []).includes(cardName);

    const heroActionPrompt = gameState.effectPrompt?.type === 'heroAction' && gameState.effectPrompt.ownerIdx === myIdx ? gameState.effectPrompt : null;
    const isHeroAction = !dimmed && heroActionPrompt && (heroActionPrompt.eligibleCards || []).includes(cardName);
    const isPlayable = !dimmed && (isHeroAction || (isMyTurn && card && ACTION_TYPES.includes(card.cardType)
      && !(card.cardType === 'Creature' && (gameState.summonBlocked || []).includes(cardName))
      && (currentPhase === 3 || ((currentPhase === 2 || currentPhase === 4) && ((gameState.additionalActions || []).some(aa => aa.eligibleHandCards.includes(cardName)) || (gameState.inherentActionCards || []).includes(cardName))))));
    const isAbilityPlayable = isAbilityAttachEligible || (!dimmed && isMyTurn && (currentPhase === 2 || currentPhase === 4) && card && card.cardType === 'Ability');
    const isEquipPlayable = !dimmed && isMyTurn && (currentPhase === 2 || currentPhase === 4) && card && card.cardType === 'Artifact'
      && (card.subtype || '').toLowerCase() === 'equipment' && (me.gold || 0) >= (card.cost || 0);
    const isArtifactActivatable = !dimmed && isMyTurn && (currentPhase === 2 || currentPhase === 4) && card
      && card.cardType === 'Artifact' && (card.subtype || '').toLowerCase() !== 'equipment';
    const isPotionActivatable = !dimmed && isMyTurn && (currentPhase === 2 || currentPhase === 4) && card && card.cardType === 'Potion';
    const startX = e.clientX, startY = e.clientY;
    let dragging = false;

    // Helper: check if cursor is inside the hand zone
    const isInsideHandZone = (mx, my) => {
      const r = handRef.current?.getBoundingClientRect();
      return r && mx >= r.left && mx <= r.right && my >= r.top && my <= r.bottom;
    };

    const onMove = (me2) => {
      if (!dragging) {
        if (Math.abs(me2.clientX - startX) + Math.abs(me2.clientY - startY) < 5) return;
        dragging = true;
      }

      const inHand = isInsideHandZone(me2.clientX, me2.clientY);

      // Inside hand zone → always reorder mode (any card type, even dimmed)
      if (inHand) {
        setPlayDrag(null);
        setAbilityDrag(null);
        setHandDrag({ idx, cardName, mouseX: me2.clientX, mouseY: me2.clientY });
        return;
      }

      // Outside hand zone — use card-type-specific drag mode
      setHandDrag(null);

      if (isAbilityPlayable) {
        // Ability play-mode drag — find valid hero/zone target
        let targetHero = -1, targetZone = -1;
        // During abilityAttach prompt, restrict to specified hero and skip abilityGivenThisTurn
        const attachHeroOnly = abilityAttachPrompt ? abilityAttachPrompt.heroIdx : -1;
        const skipAbilityGiven = !!abilityAttachPrompt;
        const canReceive = (hi, cn) => {
          if (attachHeroOnly >= 0 && hi !== attachHeroOnly) return false;
          // Custom canHeroReceiveAbility that optionally skips abilityGivenThisTurn
          const hero2 = me.heroes[hi];
          if (!hero2 || !hero2.name || hero2.hp <= 0) return false;
          if (!skipAbilityGiven && (me.abilityGivenThisTurn || [])[hi]) return false;
          const abZ = me.abilityZones[hi] || [[], [], []];
          const isCust = (gameState.customPlacementCards || []).includes(cn);
          if (isCust) return abZ.some(sl => (sl||[]).length > 0 && (sl||[]).length < 3);
          for (const sl of abZ) { if ((sl||[]).length > 0 && sl[0] === cn) return sl.length < 3; }
          return abZ.some(sl => (sl||[]).length === 0);
        };
        // Check hero zones
        const heroEls = document.querySelectorAll('[data-hero-zone]');
        for (const el of heroEls) {
          const r = el.getBoundingClientRect();
          if (me2.clientX >= r.left && me2.clientX <= r.right && me2.clientY >= r.top && me2.clientY <= r.bottom) {
            if (el.dataset.heroOwner === 'me') {
              const hi = parseInt(el.dataset.heroIdx);
              if (canReceive(hi, cardName)) { targetHero = hi; targetZone = -1; }
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
                if (canReceive(hi, cardName)) {
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
        const heroActionHeroIdx = heroActionPrompt?.heroIdx;
        const els = document.querySelectorAll('[data-support-zone]');
        for (const el of els) {
          const r = el.getBoundingClientRect();
          if (me2.clientX >= r.left && me2.clientX <= r.right && me2.clientY >= r.top && me2.clientY <= r.bottom) {
            const hi = parseInt(el.dataset.supportHero);
            const si = parseInt(el.dataset.supportSlot);
            const isOwn = el.dataset.supportOwner === 'me';
            // During heroAction, only the Coffee hero's zones are valid
            if (heroActionHeroIdx !== undefined && hi !== heroActionHeroIdx) continue;
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
      } else if (isPlayable && (card.cardType === 'Spell' || card.cardType === 'Attack')) {
        // Spell/Attack drag — target hero zones (hero must have required spell schools)
        let targetHero = -1;
        const heroActionHeroIdx2 = heroActionPrompt?.heroIdx;
        const heroEls2 = document.querySelectorAll('[data-hero-zone]');
        for (const el of heroEls2) {
          const r = el.getBoundingClientRect();
          if (me2.clientX >= r.left && me2.clientX <= r.right && me2.clientY >= r.top && me2.clientY <= r.bottom) {
            if (el.dataset.heroOwner === 'me') {
              const hi = parseInt(el.dataset.heroIdx);
              if (heroActionHeroIdx2 !== undefined && hi !== heroActionHeroIdx2) continue;
              if (canHeroPlayCard(me, hi, card)) targetHero = hi;
            }
          }
        }
        setPlayDrag({ idx, cardName, card, mouseX: me2.clientX, mouseY: me2.clientY, targetHero, targetSlot: -1, isSpell: true });
      } else {
        // Non-playable card outside hand zone — show floating card (no reorder gap)
        setPlayDrag(null);
        setAbilityDrag(null);
        setHandDrag({ idx, cardName, mouseX: me2.clientX, mouseY: me2.clientY });
      }
    };

    const onUp = (upEvent) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);

      if (!dragging) {
        // Click (no drag) — check for potion or non-equip artifact activation
        if (!dimmed && isMyTurn && (currentPhase === 2 || currentPhase === 4) && card) {
          if (card.cardType === 'Potion') {
            socket.emit('use_potion', { roomId: gameState.roomId, cardName, handIndex: idx });
          } else if (card.cardType === 'Artifact' && (card.subtype || '').toLowerCase() !== 'equipment') {
            socket.emit('use_artifact_effect', { roomId: gameState.roomId, cardName, handIndex: idx });
          }
        }
        setHandDrag(null); setPlayDrag(null); setAbilityDrag(null); return;
      }

      // Determine if dropped inside the hand zone
      const droppedInHand = isInsideHandZone(upEvent.clientX, upEvent.clientY);

      if (droppedInHand) {
        // Dropped inside hand zone — ALWAYS reorder, regardless of card type
        const newHand = [...hand];
        newHand.splice(idx, 1);
        const dropIdx = calcDropIdx(upEvent.clientX, idx);
        newHand.splice(dropIdx, 0, cardName);
        setHand(newHand);
        socket.emit('reorder_hand', { roomId: gameState.roomId, hand: newHand });
        setHandDrag(null); setPlayDrag(null); setAbilityDrag(null);
        return;
      }

      // Dropped outside hand zone — try to play/activate the card
      if (isAbilityPlayable) {
        setAbilityDrag(prev => {
          if (!prev || prev.targetHero < 0) return null;
          // During abilityAttach prompt — send as effect_prompt_response
          if (isAbilityAttachEligible) {
            socket.emit('effect_prompt_response', {
              roomId: gameState.roomId,
              response: { cardName: prev.cardName, handIndex: prev.idx, heroIdx: prev.targetHero, zoneSlot: prev.targetZone },
            });
          } else {
            socket.emit('play_ability', {
              roomId: gameState.roomId,
              cardName: prev.cardName,
              handIndex: prev.idx,
              heroIdx: prev.targetHero,
              zoneSlot: prev.targetZone,
            });
          }
          return null;
        });
      } else if (isPlayable && card.cardType === 'Creature') {
        setPlayDrag(prev => {
          if (!prev || prev.targetHero < 0 || prev.targetSlot < 0) return null;

          // Hero Action mode (Coffee) — send as effect_prompt_response
          if (isHeroAction) {
            socket.emit('effect_prompt_response', {
              roomId: gameState.roomId,
              response: { cardName: prev.cardName, handIndex: prev.idx, zoneSlot: prev.targetSlot },
            });
            return null;
          }

          // Check if this play uses an additional action
          const additionalActions = gameState.additionalActions || [];
          const matchingAAs = additionalActions.filter(aa => aa.eligibleHandCards.includes(prev.cardName));
          const isMainPhase = currentPhase === 2 || currentPhase === 4;
          const needsAdditional = isMainPhase || matchingAAs.length > 0;

          if (needsAdditional && matchingAAs.length > 0) {
            const allProviders = matchingAAs.flatMap(aa => aa.providers);
            if (allProviders.length > 1) {
              setPendingAdditionalPlay({
                cardName: prev.cardName, handIndex: prev.idx,
                heroIdx: prev.targetHero, zoneSlot: prev.targetSlot,
                providers: allProviders,
              });
              socket.emit('pending_placement', { roomId: gameState.roomId, heroIdx: prev.targetHero, zoneSlot: prev.targetSlot, cardName: prev.cardName });
              return null;
            }
            socket.emit('play_creature', {
              roomId: gameState.roomId, cardName: prev.cardName,
              handIndex: prev.idx, heroIdx: prev.targetHero, zoneSlot: prev.targetSlot,
              additionalActionProvider: allProviders[0].cardId,
            });
          } else {
            socket.emit('play_creature', {
              roomId: gameState.roomId, cardName: prev.cardName,
              handIndex: prev.idx, heroIdx: prev.targetHero, zoneSlot: prev.targetSlot,
            });
          }
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
      } else if (isPlayable && (card.cardType === 'Spell' || card.cardType === 'Attack')) {
        setPlayDrag(prev => {
          if (!prev || prev.targetHero < 0) return null;

          // Hero Action mode (Coffee) — send as effect_prompt_response
          if (isHeroAction) {
            socket.emit('effect_prompt_response', {
              roomId: gameState.roomId,
              response: { cardName: prev.cardName, handIndex: prev.idx, heroIdx: prev.targetHero },
            });
            return null;
          }

          socket.emit('play_spell', {
            roomId: gameState.roomId,
            cardName: prev.cardName,
            handIndex: prev.idx,
            heroIdx: prev.targetHero,
          });
          return null;
        });
      } else if (isArtifactActivatable) {
        // Non-equip artifact dragged outside hand — activate
        socket.emit('use_artifact_effect', { roomId: gameState.roomId, cardName, handIndex: idx });
      } else if (isPotionActivatable) {
        // Potion dragged outside hand — activate
        socket.emit('use_potion', { roomId: gameState.roomId, cardName, handIndex: idx });
      }
      // Clean up all drag states
      setHandDrag(null); setPlayDrag(null); setAbilityDrag(null);
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
  }, [hand, handDrag, playDrag, abilityDrag]);

  const [showSurrender, setShowSurrender] = useState(false);
  const [scEarned, setScEarned] = useState(null); // { rewards: [{id,title,amount,description}], total }

  // Listen for SC earned event
  useEffect(() => {
    const onSC = (data) => setScEarned(data);
    const onSCSpec = (data) => {
      // Spectators get both players' SC data — just show a combined view
      if (isSpectator) setScEarned(data);
    };
    socket.on('sc_earned', onSC);
    socket.on('sc_earned_spectator', onSCSpec);
    return () => { socket.off('sc_earned', onSC); socket.off('sc_earned_spectator', onSCSpec); };
  }, []);
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

  // Listen for additional action icon hover
  const [aaTooltipKey, setAaTooltipKey] = useState(null);
  useEffect(() => {
    const onHover = () => setAaTooltipKey(window._aaTooltipKey || null);
    window.addEventListener('aaHover', onHover);
    return () => window.removeEventListener('aaHover', onHover);
  }, []);

  const [potionSelection, setPotionSelection] = useState([]); // Selected target IDs during potion targeting
  // Clear selection when targeting changes (prevents stale selections between multi-step effects)
  useEffect(() => {
    setPotionSelection([]);
  }, [gameState.potionTargeting]);
  const [oppPendingPlacement, setOppPendingPlacement] = useState(null); // { owner, heroIdx, zoneSlot, cardName }
  useEffect(() => {
    const onOppPending = (data) => setOppPendingPlacement(data);
    socket.on('opponent_pending_placement', onOppPending);
    return () => socket.off('opponent_pending_placement', onOppPending);
  }, []);
  const [explosions, setExplosions] = useState([]); // Target IDs currently showing explosion
  const [cardReveals, setCardReveals] = useState([]); // [{id, cardName}] — stacked reveals
  const [summonGlow, setSummonGlow] = useState(null); // { owner, heroIdx, zoneSlot }
  const [oppTargetHighlight, setOppTargetHighlight] = useState([]); // Target IDs highlighted on opponent's screen
  const [burnTickingHeroes, setBurnTickingHeroes] = useState([]); // Hero keys ('pi-hi') currently showing burn escalation
  const [abilityFlash, setAbilityFlash] = useState(null); // { owner, heroIdx, zoneIdx } — flashing ability zone
  const [levelChanges, setLevelChanges] = useState([]); // [{id, delta, owner, heroIdx, zoneSlot}]
  const deckSearchPendingRef = useRef([]); // Card names queued before sync triggers opp draw anim
  const [reactionChain, setReactionChain] = useState(null); // [{id, cardName, owner, cardType, isInitialCard, negated, status}]
  const [cameraFlash, setCameraFlash] = useState(false);
  const [toughnessHpChanges, setToughnessHpChanges] = useState([]); // [{id, amount, owner, heroIdx}]
  const toughnessHpSuppressRef = useRef({}); // { 'owner-heroIdx': true } — suppress damage numbers for Toughness HP removal
  const [fightingAtkChanges, setFightingAtkChanges] = useState([]); // [{id, amount, owner, heroIdx}]

  // Listen for opponent card reveal
  useEffect(() => {
    const onReveal = ({ cardName }) => setCardReveals(prev => [...prev, { id: Date.now() + Math.random(), cardName }]);
    const onDeckSearchAdd = ({ cardName, playerIdx }) => {
      // If the OPPONENT searched, prepare face-up draw animation
      if (playerIdx !== myIdx) {
        deckSearchPendingRef.current = [...deckSearchPendingRef.current, cardName];
      }
    };
    // Reaction chain events
    const onChainUpdate = ({ links }) => {
      setReactionChain(links.map(l => ({ ...l, status: l.negated ? 'negated' : 'pending' })));
    };
    const onChainResolvingStart = () => {}; // Chain is about to resolve
    const onChainLinkResolving = ({ linkIndex }) => {
      setReactionChain(prev => prev?.map((l, i) => i === linkIndex ? { ...l, status: 'resolving' } : l));
    };
    const onChainLinkResolved = ({ linkIndex }) => {
      setReactionChain(prev => prev?.map((l, i) => i === linkIndex ? { ...l, status: 'resolved' } : l));
    };
    const onChainLinkNegated = ({ linkIndex, negationStyle }) => {
      setReactionChain(prev => prev?.map((l, i) => i === linkIndex ? { ...l, status: 'negated', negated: true, negationStyle: negationStyle || null } : l));
    };
    const onChainDone = () => {
      setTimeout(() => setReactionChain(null), 800);
    };
    const onCameraFlash = () => {
      setCameraFlash(true);
      setTimeout(() => setCameraFlash(false), 900);
    };
    const onToughnessHp = ({ owner, heroIdx, amount }) => {
      const entry = { id: Date.now() + Math.random(), amount, owner, heroIdx };
      setToughnessHpChanges(prev => [...prev, entry]);
      setTimeout(() => setToughnessHpChanges(prev => prev.filter(e => e.id !== entry.id)), 1800);
      // Mark this hero's HP change as non-damage so the damage number system skips it
      if (amount < 0) {
        toughnessHpSuppressRef.current[`${owner}-${heroIdx}`] = true;
      }
    };
    const onFightingAtk = ({ owner, heroIdx, amount }) => {
      const entry = { id: Date.now() + Math.random(), amount, owner, heroIdx };
      setFightingAtkChanges(prev => [...prev, entry]);
      setTimeout(() => setFightingAtkChanges(prev => prev.filter(e => e.id !== entry.id)), 1800);
    };
    const onSummon = ({ owner, heroIdx, zoneSlot, cardName }) => {
      setSummonGlow({ owner, heroIdx, zoneSlot });
      setTimeout(() => setSummonGlow(null), 1200);
    };
    const onBurnTick = ({ heroes }) => {
      const keys = heroes.map(h => `${h.owner}-${h.heroIdx}`);
      setBurnTickingHeroes(keys);
      setTimeout(() => setBurnTickingHeroes([]), 1500);
    };
    const onZoneAnim = ({ type, owner, heroIdx, zoneSlot }) => {
      const ownerLabel = owner === myIdx ? 'me' : 'opp';
      const sel = zoneSlot >= 0
        ? `[data-support-zone][data-support-owner="${ownerLabel}"][data-support-hero="${heroIdx}"][data-support-slot="${zoneSlot}"]`
        : `[data-hero-zone][data-hero-owner="${ownerLabel}"][data-hero-idx="${heroIdx}"]`;
      setTimeout(() => playAnimation(type, sel, { duration: 1000 }), 100);
    };
    const onLevelChange = ({ delta, owner, heroIdx, zoneSlot }) => {
      const entry = { id: Date.now() + Math.random(), delta, owner, heroIdx, zoneSlot };
      setLevelChanges(prev => [...prev, entry]);
      setTimeout(() => setLevelChanges(prev => prev.filter(e => e.id !== entry.id)), 1600);
    };
    const onAbilityActivated = ({ owner, heroIdx, zoneIdx, abilityName }) => {
      const ownerLabel = owner === myIdx ? 'me' : 'opp';
      const abSel = `[data-ability-zone][data-ability-owner="${ownerLabel}"][data-ability-hero="${heroIdx}"][data-ability-slot="${zoneIdx}"]`;
      // Set flash overlay on the ability zone (visible to both players)
      setAbilityFlash({ owner, heroIdx, zoneIdx });
      setTimeout(() => setAbilityFlash(null), 1800);
      // Big flashy burst on the ability zone — staggered multi-layer
      setTimeout(() => playAnimation('gold_sparkle', abSel, { duration: 1400 }), 50);
      setTimeout(() => playAnimation('gold_sparkle', abSel, { duration: 1200 }), 250);
      setTimeout(() => playAnimation('gold_sparkle', abSel, { duration: 1000 }), 450);
      // Sparkle on the gold counter after a short delay
      setTimeout(() => {
        const goldEl = document.querySelector(`[data-gold-player="${owner}"]`);
        if (goldEl) {
          playAnimation('gold_sparkle', goldEl, { duration: 1000 });
          setTimeout(() => playAnimation('gold_sparkle', goldEl, { duration: 800 }), 200);
        }
      }, 400);
    };
    const onBeamAnimation = ({ sourceOwner, sourceHeroIdx, targetOwner, targetHeroIdx, targetZoneSlot, color, duration }) => {
      const srcLabel = sourceOwner === myIdx ? 'me' : 'opp';
      const tgtLabel = targetOwner === myIdx ? 'me' : 'opp';
      const srcEl = document.querySelector(`[data-hero-zone][data-hero-owner="${srcLabel}"][data-hero-idx="${sourceHeroIdx}"]`);
      let tgtEl;
      if (targetZoneSlot !== undefined && targetZoneSlot >= 0) {
        tgtEl = document.querySelector(`[data-support-zone][data-support-owner="${tgtLabel}"][data-support-hero="${targetHeroIdx}"][data-support-slot="${targetZoneSlot}"]`);
      } else {
        tgtEl = document.querySelector(`[data-hero-zone][data-hero-owner="${tgtLabel}"][data-hero-idx="${targetHeroIdx}"]`);
      }
      if (!srcEl || !tgtEl) return;
      const sr = srcEl.getBoundingClientRect();
      const tr = tgtEl.getBoundingClientRect();
      const id = Date.now() + Math.random();
      const dur = duration || 1500;
      setBeamAnims(prev => [...prev, {
        id, color: color || '#ff2222',
        x1: sr.left + sr.width / 2, y1: sr.top + sr.height / 2,
        x2: tr.left + tr.width / 2, y2: tr.top + tr.height / 2,
      }]);
      // Also play explosion on target
      setTimeout(() => playAnimation('explosion', tgtEl, { duration: 800 }), 250);
      setTimeout(() => setBeamAnims(prev => prev.filter(a => a.id !== id)), dur);
    };
    socket.on('card_reveal', onReveal);
    socket.on('deck_search_add', onDeckSearchAdd);
    socket.on('reaction_chain_update', onChainUpdate);
    socket.on('reaction_chain_resolving_start', onChainResolvingStart);
    socket.on('reaction_chain_link_resolving', onChainLinkResolving);
    socket.on('reaction_chain_link_resolved', onChainLinkResolved);
    socket.on('reaction_chain_link_negated', onChainLinkNegated);
    socket.on('reaction_chain_done', onChainDone);
    socket.on('camera_flash', onCameraFlash);
    socket.on('toughness_hp_change', onToughnessHp);
    socket.on('fighting_atk_change', onFightingAtk);
    socket.on('summon_effect', onSummon);
    socket.on('burn_tick', onBurnTick);
    socket.on('play_zone_animation', onZoneAnim);
    socket.on('level_change', onLevelChange);
    socket.on('ability_activated', onAbilityActivated);
    socket.on('play_beam_animation', onBeamAnimation);
    const onPermanentAnim = ({ owner, permId, type }) => {
      const ownerLabel = owner === myIdx ? 'me' : 'opp';
      const el = document.querySelector(`[data-perm-id="${permId}"][data-perm-owner="${ownerLabel}"]`);
      if (el) playAnimation(type || 'holy_revival', el, { duration: 1200 });
    };
    socket.on('play_permanent_animation', onPermanentAnim);
    const onRamAnimation = ({ sourceOwner, sourceHeroIdx, targetOwner, targetHeroIdx, targetZoneSlot, cardName, duration }) => {
      const srcLabel = sourceOwner === myIdx ? 'me' : 'opp';
      const tgtLabel = targetOwner === myIdx ? 'me' : 'opp';
      const srcEl = document.querySelector(`[data-hero-zone][data-hero-owner="${srcLabel}"][data-hero-idx="${sourceHeroIdx}"]`);
      let tgtEl;
      if (targetZoneSlot !== undefined && targetZoneSlot >= 0) {
        tgtEl = document.querySelector(`[data-support-zone][data-support-owner="${tgtLabel}"][data-support-hero="${targetHeroIdx}"][data-support-slot="${targetZoneSlot}"]`);
      } else {
        tgtEl = document.querySelector(`[data-hero-zone][data-hero-owner="${tgtLabel}"][data-hero-idx="${targetHeroIdx}"]`);
      }
      if (!srcEl || !tgtEl) return;
      const sr = srcEl.getBoundingClientRect();
      const tr = tgtEl.getBoundingClientRect();
      const dx = tr.left + tr.width / 2 - (sr.left + sr.width / 2);
      const dy = tr.top + tr.height / 2 - (sr.top + sr.height / 2);
      // Angle so the card's top edge faces the target
      const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
      const id = Date.now() + Math.random();
      const dur = duration || 1600;
      setRamAnims(prev => [...prev, {
        id, cardName,
        srcX: sr.left + sr.width / 2, srcY: sr.top + sr.height / 2,
        tgtX: tr.left + tr.width / 2, tgtY: tr.top + tr.height / 2,
        srcOwner: sourceOwner, srcHeroIdx: sourceHeroIdx, dur, angle,
      }]);
      setTimeout(() => setRamAnims(prev => prev.filter(a => a.id !== id)), dur);
    };
    socket.on('play_ram_animation', onRamAnimation);
    const onCardTransfer = ({ sourceOwner, sourceHeroIdx, sourceZoneSlot, targetOwner, targetHeroIdx, targetZoneSlot, cardName, duration, particles }) => {
      const srcLabel = sourceOwner === myIdx ? 'me' : 'opp';
      const tgtLabel = targetOwner === myIdx ? 'me' : 'opp';
      // Support hero zones (zoneSlot === -1) as source or target
      const srcEl = sourceZoneSlot < 0
        ? document.querySelector(`[data-hero-zone][data-hero-owner="${srcLabel}"][data-hero-idx="${sourceHeroIdx}"]`)
        : document.querySelector(`[data-support-zone][data-support-owner="${srcLabel}"][data-support-hero="${sourceHeroIdx}"][data-support-slot="${sourceZoneSlot}"]`);
      const tgtEl = targetZoneSlot < 0
        ? document.querySelector(`[data-hero-zone][data-hero-owner="${tgtLabel}"][data-hero-idx="${targetHeroIdx}"]`)
        : document.querySelector(`[data-support-zone][data-support-owner="${tgtLabel}"][data-support-hero="${targetHeroIdx}"][data-support-slot="${targetZoneSlot}"]`);
      if (!srcEl || !tgtEl) return;
      const sr = srcEl.getBoundingClientRect();
      const tr = tgtEl.getBoundingClientRect();
      const id = Date.now() + Math.random();
      const dur = duration || 800;
      setTransferAnims(prev => [...prev, {
        id, cardName,
        srcX: sr.left + sr.width / 2 - 34, srcY: sr.top + sr.height / 2 - 48,
        tgtX: tr.left + tr.width / 2 - 34, tgtY: tr.top + tr.height / 2 - 48,
        dur,
      }]);
      setTimeout(() => setTransferAnims(prev => prev.filter(a => a.id !== id)), dur + 100);
      // Play particle effects on source and target if requested
      if (particles) {
        playAnimation(particles, srcEl, { duration: dur });
        setTimeout(() => playAnimation(particles, tgtEl, { duration: dur }), 200);
      }
    };
    socket.on('play_card_transfer', onCardTransfer);
    const onProjectileAnimation = ({ sourceOwner, sourceHeroIdx, targetOwner, targetHeroIdx, targetZoneSlot, emoji, duration, trailClass, emojiStyle, projectileClass }) => {
      const srcLabel = sourceOwner === myIdx ? 'me' : 'opp';
      const tgtLabel = targetOwner === myIdx ? 'me' : 'opp';
      const srcEl = document.querySelector(`[data-hero-zone][data-hero-owner="${srcLabel}"][data-hero-idx="${sourceHeroIdx}"]`);
      let tgtEl;
      if (targetZoneSlot !== undefined && targetZoneSlot >= 0) {
        tgtEl = document.querySelector(`[data-support-zone][data-support-owner="${tgtLabel}"][data-support-hero="${targetHeroIdx}"][data-support-slot="${targetZoneSlot}"]`);
      } else {
        tgtEl = document.querySelector(`[data-hero-zone][data-hero-owner="${tgtLabel}"][data-hero-idx="${targetHeroIdx}"]`);
      }
      if (!srcEl || !tgtEl) return;
      const sr = srcEl.getBoundingClientRect();
      const tr = tgtEl.getBoundingClientRect();
      const id = Date.now() + Math.random();
      const dur = duration || 600;
      setProjectileAnims(prev => [...prev, {
        id, emoji: emoji || '🐦‍🔥',
        trailClass: trailClass || null,
        emojiStyle: emojiStyle || null,
        projectileClass: projectileClass || null,
        srcX: sr.left + sr.width / 2, srcY: sr.top + sr.height / 2,
        tgtX: tr.left + tr.width / 2, tgtY: tr.top + tr.height / 2,
        dur,
      }]);
      setTimeout(() => setProjectileAnims(prev => prev.filter(a => a.id !== id)), dur + 200);
    };
    socket.on('play_projectile_animation', onProjectileAnimation);
    const onDeckToDeleted = ({ owner, cards }) => {
      const prefix = owner === myIdx ? 'my' : 'opp';
      const deckEl = document.querySelector(`[data-${prefix}-deck]`);
      const deletedEl = document.querySelector(`[data-${prefix}-deleted]`);
      const deckR = deckEl?.getBoundingClientRect();
      const delR = deletedEl?.getBoundingClientRect();
      if (!deckR || !delR || !cards || cards.length === 0) return;
      const startX = deckR.left + deckR.width / 2 - 32;
      const startY = deckR.top + deckR.height / 2 - 45;
      const endX = delR.left + delR.width / 2 - 32;
      const endY = delR.top + delR.height / 2 - 45;
      const newAnims = cards.map((cardName, i) => ({
        id: Date.now() + Math.random() + i,
        cardName, startX, startY, endX, endY, dest: 'deleted',
        delay: i * 150,
      }));
      // Stagger the animations
      for (const anim of newAnims) {
        setTimeout(() => {
          setDiscardAnims(prev => [...prev, anim]);
          setTimeout(() => setDiscardAnims(prev => prev.filter(a => a.id !== anim.id)), 500);
        }, anim.delay);
      }
    };
    socket.on('deck_to_deleted', onDeckToDeleted);
    return () => {
      socket.off('card_reveal', onReveal); socket.off('deck_search_add', onDeckSearchAdd);
      socket.off('reaction_chain_update', onChainUpdate); socket.off('reaction_chain_resolving_start', onChainResolvingStart);
      socket.off('reaction_chain_link_resolving', onChainLinkResolving); socket.off('reaction_chain_link_resolved', onChainLinkResolved);
      socket.off('reaction_chain_link_negated', onChainLinkNegated); socket.off('reaction_chain_done', onChainDone);
      socket.off('camera_flash', onCameraFlash); socket.off('toughness_hp_change', onToughnessHp); socket.off('fighting_atk_change', onFightingAtk);
      socket.off('summon_effect', onSummon); socket.off('burn_tick', onBurnTick);
      socket.off('play_zone_animation', onZoneAnim); socket.off('level_change', onLevelChange);
      socket.off('ability_activated', onAbilityActivated); socket.off('play_beam_animation', onBeamAnimation);
      socket.off('play_permanent_animation', onPermanentAnim);
      socket.off('play_ram_animation', onRamAnimation);
      socket.off('play_card_transfer', onCardTransfer);
      socket.off('play_projectile_animation', onProjectileAnimation);
      socket.off('deck_to_deleted', onDeckToDeleted);
    };
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
          } else if (type === 'hero') {
            selector = `[data-hero-zone][data-hero-owner="${ownerLabel}"][data-hero-idx="${heroIdx}"]`;
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
    if (isSpectator) {
      socket.emit('leave_room', { roomId: gameState.roomId });
    } else {
      socket.emit('leave_game', { roomId: gameState.roomId });
    }
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

  // Escape closes surrender dialog, deck viewer, cancels potion targeting, cancels effect prompts, or declines mulligan
  useEffect(() => {
    const mulliganActive = gameState.mulliganPending && !mulliganDecided && !isSpectator;
    if (!showSurrender && !deckViewer && !pileViewer && !gameState.potionTargeting && !gameState.effectPrompt && !mulliganActive) return;
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        if (mulliganActive) { setMulliganDecided(true); socket.emit('mulligan_decision', { roomId: gameState.roomId, accept: false }); return; }
        if (pendingAbilityActivation) { setPendingAbilityActivation(null); return; }
        if (gameState.effectPrompt && gameState.effectPrompt.ownerIdx === myIdx && gameState.effectPrompt.cancellable !== false) {
          socket.emit('effect_prompt_response', { roomId: gameState.roomId, response: { cancelled: true } });
        } else if (gameState.potionTargeting && gameState.potionTargeting.ownerIdx === myIdx) {
          if (gameState.potionTargeting.config?.cancellable === false) return;
          socket.emit('cancel_potion', { roomId: gameState.roomId });
          setPotionSelection([]);
        } else if (pileViewer) setPileViewer(null);
        else if (pendingAdditionalPlay) { setPendingAdditionalPlay(null); socket.emit('pending_placement_clear', { roomId: gameState.roomId }); }
        else if (deckViewer) setDeckViewer(null);
        else if (showSurrender) setShowSurrender(false);
      }
    };
    window.addEventListener('keydown', handleEsc, true);
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, [showSurrender, deckViewer, pileViewer, gameState.potionTargeting, gameState.effectPrompt, pendingAdditionalPlay, pendingAbilityActivation, gameState.mulliganPending, mulliganDecided]);

  // Space hotkey — advance to next phase
  useEffect(() => {
    const handleSpace = (e) => {
      if (e.code !== 'Space') return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (isSpectator) return;
      const isMyTurn = (gameState.activePlayer || 0) === myIdx;
      if (!isMyTurn || gameState.result || gameState.effectPrompt || gameState.potionTargeting || gameState.mulliganPending) return;
      const cp = gameState.currentPhase;
      const nextMap = { 2: 3, 3: 4, 4: 5 }; // Main1→Action, Action→Main2, Main2→End
      const target = nextMap[cp];
      if (target == null) return;
      e.preventDefault();
      socket.emit('advance_phase', { roomId: gameState.roomId, targetPhase: target });
    };
    window.addEventListener('keydown', handleSpace);
    return () => window.removeEventListener('keydown', handleSpace);
  }, [gameState.activePlayer, gameState.currentPhase, gameState.result, gameState.effectPrompt, gameState.potionTargeting, gameState.mulliganPending, gameState.roomId, myIdx]);

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
  const [creatureDamageNumbers, setCreatureDamageNumbers] = useState([]);
  const [goldGains, setGoldGains] = useState([]);
  const [goldLosses, setGoldLosses] = useState([]);
  const prevHpRef = useRef(null);
  const prevCreatureHpRef = useRef(null);
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
          // Skip if this HP decrease was from Toughness removal (not real damage)
          if (toughnessHpSuppressRef.current[key]) {
            delete toughnessHpSuppressRef.current[key];
            continue;
          }
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

    // Build current creature HP map — include ALL creatures on the board
    const currentCreatureHp = {};
    for (let pi = 0; pi < 2; pi++) {
      const p = gameState.players[pi];
      for (let hi = 0; hi < (p.supportZones || []).length; hi++) {
        const zones = p.supportZones[hi] || [];
        for (let si = 0; si < zones.length; si++) {
          const slot = zones[si] || [];
          if (slot.length === 0) continue;
          const cKey = `${pi}-${hi}-${si}`;
          const counters = (gameState.creatureCounters || {})[cKey];
          // Use currentHp from counters if available, otherwise max HP from card DB
          const maxHp = CARDS_BY_NAME[slot[0]]?.hp;
          if (maxHp != null) {
            currentCreatureHp[cKey] = counters?.currentHp ?? maxHp;
          }
        }
      }
    }
    // Compare creature HP
    if (prevCreatureHpRef.current) {
      const newCreatureDmg = [];
      for (const [key, curHp] of Object.entries(currentCreatureHp)) {
        const prevHp = prevCreatureHpRef.current[key];
        if (prevHp != null && curHp < prevHp) {
          const [ownerStr, heroIdxStr, slotStr] = key.split('-');
          const ownerIdx = parseInt(ownerStr);
          newCreatureDmg.push({
            id: Date.now() + Math.random(),
            amount: prevHp - curHp,
            ownerLabel: ownerIdx === myIdx ? 'me' : 'opp',
            heroIdx: parseInt(heroIdxStr),
            zoneSlot: parseInt(slotStr),
          });
        }
      }
      if (newCreatureDmg.length > 0) {
        setCreatureDamageNumbers(prev => [...prev, ...newCreatureDmg]);
        setTimeout(() => {
          setCreatureDamageNumbers(prev => prev.filter(d => !newCreatureDmg.some(n => n.id === d.id)));
        }, 1800);
      }
    }
    prevCreatureHpRef.current = currentCreatureHp;

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
        // Trigger gold sparkle animation on the gold counter
        for (const g of newGoldGains) {
          const sel = `[data-gold-player="${g.playerIdx}"]`;
          setTimeout(() => playAnimation('gold_sparkle', sel, { duration: 1200 }), 50);
        }
      }
      // Detect gold losses
      const newGoldLosses = [];
      for (let pi = 0; pi < 2; pi++) {
        const diff = currentGold[pi] - prevGoldRef.current[pi];
        if (diff < 0) {
          newGoldLosses.push({ id: Date.now() + Math.random() + pi + 0.5, amount: -diff, playerIdx: pi });
        }
      }
      if (newGoldLosses.length > 0) {
        setGoldLosses(prev => [...prev, ...newGoldLosses]);
        setTimeout(() => {
          setGoldLosses(prev => prev.filter(g => !newGoldLosses.some(n => n.id === g.id)));
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
  const isTargeting = !isSpectator && !result && pt && pt.ownerIdx === myIdx;
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
      // Check global max total
      const maxTotal = config.maxTotal ?? Infinity;
      if (prev.length >= maxTotal) return prev; // At global limit — can't add more
      return [...prev, targetId];
    });
  };

  const canConfirmPotion = (() => {
    if (pt?.config?.alwaysConfirmable) return true;
    if (potionSelection.length === 0) return false;
    const minReq = pt?.config?.minRequired || 0;
    return potionSelection.length >= minReq;
  })();

  // ── Effect prompt helpers (confirm, card gallery, zone picker) ──
  const ep = gameState.effectPrompt;
  const isMyEffectPrompt = !isSpectator && !result && ep && ep.ownerIdx === myIdx;
  const isOppEffectPrompt = !isSpectator && !result && ep && ep.ownerIdx !== myIdx && ep.ownerIdx !== (gameState.activePlayer ?? -1);
  const zonePickSet = new Set();
  if (isMyEffectPrompt && ep.type === 'zonePick') {
    for (const z of (ep.zones || [])) {
      zonePickSet.add(`${myIdx}-${z.heroIdx}-${z.slotIdx}`);
    }
  }
  const respondToPrompt = (response) => {
    socket.emit('effect_prompt_response', { roomId: gameState.roomId, response });
  };

  // Escape key dismisses deckSearchReveal prompts (opponent's search result confirmation)
  useEffect(() => {
    const ep = gameState.effectPrompt;
    if (!ep || ep.type !== 'deckSearchReveal' || ep.ownerIdx !== myIdx) return;
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        respondToPrompt({ confirmed: true });
      }
    };
    window.addEventListener('keydown', handleEsc, true);
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, [gameState.effectPrompt]);

  // ── SC earned display helper ──
  const renderSCEarned = () => {
    if (!scEarned) return null;
    if (isSpectator) {
      // Spectator sees both players' SC data
      const entries = [];
      for (const [piStr, data] of Object.entries(scEarned)) {
        if (data?.total > 0) {
          const pName = gameState.players[parseInt(piStr)]?.username || 'Player';
          entries.push({ name: pName, ...data });
        }
      }
      if (entries.length === 0) return null;
      return (
        <div style={{ marginTop: 20, marginBottom: 20, textAlign: 'center' }}>
          {entries.map(e => (
            <div key={e.name} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#ffd700', fontWeight: 700, fontSize: 15 }}>
                <span>{e.name}:</span>
                <span>{e.total}</span>
                <img src="/data/sc.png" style={{ width: 18, height: 18, imageRendering: 'pixelated' }} />
                <span>earned!</span>
              </div>
              <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {(e.rewards || []).map(r => (
                  <div key={r.id} style={{ fontSize: 12, color: 'var(--text2)' }}>
                    <span style={{ color: '#ffd700', fontWeight: 600 }}>{r.title}</span>
                    {' — '}{r.description}{' '}
                    <span style={{ color: '#ffd700' }}>+{r.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }
    if (!scEarned.total || scEarned.total <= 0) return null;
    return (
      <div style={{ marginTop: 20, marginBottom: 20, textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#ffd700', fontWeight: 700, fontSize: 18, textShadow: '0 0 12px rgba(255,215,0,.5)' }}>
          <span>{scEarned.total}</span>
          <img src="/data/sc.png" style={{ width: 24, height: 24, imageRendering: 'pixelated' }} />
          <span>earned!</span>
        </div>
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(scEarned.rewards || []).map(r => (
            <div key={r.id} style={{ fontSize: 13, color: 'var(--text2)' }}>
              <span style={{ color: '#ffd700', fontWeight: 700 }}>{r.title}</span>
              {' — '}{r.description}{' '}
              <span style={{ color: '#ffd700', fontWeight: 700 }}>+{r.amount}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

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

    // Board skin: extract number from board ID (e.g. "board1" → "1")
    const boardNum = p.board ? p.board.replace(/\D/g, '') : null;
    const zs = (zoneType) => boardNum ? {
      backgroundImage: 'url(/data/shop/boards/' + encodeURIComponent(zoneType + boardNum) + '.png)',
      backgroundSize: 'cover', backgroundPosition: 'center',
    } : undefined;
    const zsMerge = (zoneType, extra) => {
      const bg = zs(zoneType);
      return bg ? { ...bg, ...extra } : extra;
    };

    const heroRow = (
      <div className="board-row board-hero-row">
        {[0, 1, 2].flatMap(i => {
          const hero = heroes[i];
          const isDead = hero && hero.hp !== undefined && hero.hp <= 0;
          const abilityAttachActive = !isOpp && gameState.effectPrompt?.type === 'abilityAttach' && gameState.effectPrompt?.ownerIdx === myIdx;
          const abilityIneligible = !isOpp && abilityDrag && (() => {
            if (abilityAttachActive) {
              // During abilityAttach: only the specified hero is eligible, skip abilityGivenThisTurn
              if (i !== gameState.effectPrompt.heroIdx) return true;
              const hero2 = heroes[i];
              if (!hero2 || !hero2.name || hero2.hp <= 0) return true;
              // Check ability zone capacity without abilityGivenThisTurn
              const abZ = abZones[i] || [[], [], []];
              const cn = abilityDrag.cardName;
              const isCust = (gameState.customPlacementCards || []).includes(cn);
              if (isCust) return !abZ.some(sl => (sl||[]).length > 0 && (sl||[]).length < 3);
              for (const sl of abZ) { if ((sl||[]).length > 0 && sl[0] === cn) return sl.length >= 3; }
              return !abZ.some(sl => (sl||[]).length === 0);
            }
            return !canHeroReceiveAbility(p, i, abilityDrag.cardName);
          })();
          const equipIneligible = !isOpp && playDrag && playDrag.isEquip && (() => {
            const hero = heroes[i];
            if (!hero || !hero.name || hero.hp <= 0) return true;
            if (hero.statuses?.frozen) return true; // Can't equip to frozen heroes
            const supZ = supZones[i] || [];
            for (let z = 0; z < 3; z++) { if ((supZ[z] || []).length === 0) return false; }
            return true;
          })();
          const creatureIneligible = !isOpp && playDrag && playDrag.card?.cardType === 'Creature' && !playDrag.isEquip && (() => {
            if (!canHeroPlayCard(p, i, playDrag.card)) return true;
            if (findFreeSupportSlot(p, i) < 0) return true;
            return false;
          })();
          const spellAttackIneligible = !isOpp && playDrag && !playDrag.isEquip && (playDrag.card?.cardType === 'Spell' || playDrag.card?.cardType === 'Attack') && !canHeroPlayCard(p, i, playDrag.card);
          // During heroAction, dim all heroes except the Coffee hero
          const heroActionDimmed = !isOpp && gameState.effectPrompt?.type === 'heroAction' && gameState.effectPrompt?.ownerIdx === myIdx && gameState.effectPrompt?.heroIdx !== i;
          const abilityTarget = !isOpp && abilityDrag && abilityDrag.targetHero === i && abilityDrag.targetZone < 0;
          const equipTarget = !isOpp && playDrag && playDrag.isEquip && playDrag.targetHero === i && playDrag.targetSlot === -1;
          const spellTarget = !isOpp && playDrag && playDrag.isSpell && playDrag.targetHero === i;
          const pi = isOpp ? oppIdx : myIdx;
          const heroTargetId = `hero-${pi}-${i}`;
          const isValidHeroTarget = isTargeting && validTargetIds.has(heroTargetId);
          const isSelectedHeroTarget = selectedSet.has(heroTargetId);
          const isFrozen = hero?.statuses?.frozen;
          const isStunned = hero?.statuses?.stunned;
          const isImmune = hero?.statuses?.immune;
          const isNegated = hero?.statuses?.negated;
          const isBurned = hero?.statuses?.burned;
          const isPoisoned = hero?.statuses?.poisoned;
          const isShielded = hero?.statuses?.shielded;
          // Check if this hero has an active hero effect
          const isHeroEffectActive = !isOpp && (gameState.activeHeroEffects || []).some(e => e.heroIdx === i);
          const isRamming = ramAnims.some(r => r.srcOwner === pi && r.srcHeroIdx === i);
          const onHeroClick = isHeroEffectActive && !isValidHeroTarget
            ? () => socket.emit('activate_hero_effect', { roomId: gameState.roomId, heroIdx: i })
            : (isValidHeroTarget ? () => togglePotionTarget(heroTargetId) : undefined);
          const heroGroup = (
            <div key={i} className="board-hero-group">
              {columnLayout[i].maxZones > 3 && Array.from({ length: columnLayout[i].maxLeft }).map((_, s) => (
                <div key={'lpad-'+s} className="board-zone-spacer" />
              ))}
              <div className="board-zone-spacer" />
              <div className={'board-zone board-zone-hero' + (isDead ? ' board-zone-dead' : '') + ((abilityIneligible || equipIneligible || creatureIneligible || spellAttackIneligible || heroActionDimmed) ? ' board-zone-dead' : '') + ((abilityTarget || equipTarget || spellTarget) ? ' board-zone-play-target' : '') + (isValidHeroTarget ? ' potion-target-valid' : '') + (isSelectedHeroTarget ? ' potion-target-selected' : '') + (oppTargetHighlight.includes(heroTargetId) ? ' opp-target-highlight' : '') + (isHeroEffectActive ? ' zone-hero-effect-active' : '')}
                data-hero-zone="1" data-hero-idx={i} data-hero-owner={ownerLabel} data-hero-name={hero?.name || ''}
                onClick={onHeroClick}
                style={zsMerge('hero', (isHeroEffectActive || isValidHeroTarget) ? { cursor: 'pointer' } : undefined)}>
                {hero?.name && !isRamming ? (
                  <BoardCard cardName={hero.name} hp={hero.hp} maxHp={hero.maxHp} atk={hero.atk} hpPosition="hero" skins={gameSkins} />
                ) : hero?.name && isRamming ? (
                  <div className="board-zone-empty" style={{ opacity: 0.3 }}>{hero.name.split(',')[0]}</div>
                ) : (
                  <div className="board-zone-empty">{'Hero ' + (i+1)}</div>
                )}
                {hero?.name && isFrozen && <FrozenOverlay />}
                {hero?.name && isStunned && <div className="status-stunned-overlay"><div className="stun-bolt s1" /><div className="stun-bolt s2" /><div className="stun-bolt s3" /></div>}
                {hero?.name && isNegated && <NegatedOverlay />}
                {hero?.name && isBurned && <BurnedOverlay ticking={burnTickingHeroes.includes(`${pi}-${i}`)} />}
                {hero?.name && isPoisoned && <PoisonedOverlay stacks={isPoisoned.stacks || 1} />}
                {hero?.name && (isFrozen || isStunned || isBurned || isPoisoned || isNegated) && <StatusBadges statuses={hero.statuses} isHero={true} />}
                {hero?.name && isShielded && <ImmuneIcon heroName={hero.name} statusType="shielded" />}
                {hero?.name && isImmune && !isShielded && <ImmuneIcon heroName={hero.name} statusType="immune" />}
                {hero?.name && hero.buffs && <BuffColumn buffs={hero.buffs} />}
                {!isOpp && gameState.bonusActions?.heroIdx === i && gameState.bonusActions.remaining > 0 && (
                  <div className="bonus-action-counter"
                    onMouseEnter={e => showGameTooltip(e, `${gameState.bonusActions.remaining} bonus Action${gameState.bonusActions.remaining > 1 ? 's' : ''} remaining`)}
                    onMouseLeave={hideGameTooltip}>
                    ⚔️{gameState.bonusActions.remaining}
                  </div>
                )}
              </div>
              <div data-surprise-zone="1" data-surprise-hero={i} data-surprise-owner={ownerLabel}><BoardZone type="surprise" cards={surZones[i] || []} label="Surprise" style={zs('surprise')} /></div>
              {columnLayout[i].maxZones > 3 && Array.from({ length: columnLayout[i].maxRight }).map((_, s) => (
                <div key={'rpad-'+s} className="board-zone-spacer" />
              ))}
            </div>
          );
          if (i < 2) {
            return [heroGroup, <div key={'area-gap-'+i} className="board-area-spacer" />];
          }
          return [heroGroup];
        })}
      </div>
    );

    const abilityRow = (
      <div className="board-row">
        {[0, 1, 2].flatMap(i => {
          const hero = heroes[i];
          const isDead = hero && hero.hp !== undefined && hero.hp <= 0;
          const isFrozenOrStunned = hero?.statuses?.frozen || hero?.statuses?.stunned || hero?.statuses?.negated;
          const abilityAttachActive2 = !isOpp && gameState.effectPrompt?.type === 'abilityAttach' && gameState.effectPrompt?.ownerIdx === myIdx;
          const heroIneligible = !isOpp && abilityDrag && (() => {
            if (abilityAttachActive2) {
              if (i !== gameState.effectPrompt.heroIdx) return true;
              const hero2 = heroes[i];
              if (!hero2 || !hero2.name || hero2.hp <= 0) return true;
              const abZ = abZones[i] || [[], [], []];
              const cn = abilityDrag.cardName;
              const isCust = (gameState.customPlacementCards || []).includes(cn);
              if (isCust) return !abZ.some(sl => (sl||[]).length > 0 && (sl||[]).length < 3);
              for (const sl of abZ) { if ((sl||[]).length > 0 && sl[0] === cn) return sl.length >= 3; }
              return !abZ.some(sl => (sl||[]).length === 0);
            }
            return !canHeroReceiveAbility(p, i, abilityDrag.cardName);
          })();
          const abilityGroup = (
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
                // Check if this ability is activatable (action-costing)
                const isActivatable = !isOpp && cards.length > 0 && (gameState.activatableAbilities || []).some(a => a.heroIdx === i && a.zoneIdx === z);
                // Check if this ability is free-activatable (no action cost, Main Phase)
                const freeAbilityEntry = !isOpp && cards.length > 0 && (gameState.freeActivatableAbilities || []).find(a => a.heroIdx === i && a.zoneIdx === z);
                const isFreeActivatable = freeAbilityEntry?.canActivate === true;
                const isFreeExhausted = freeAbilityEntry && !freeAbilityEntry.canActivate;
                // Also activatable during heroAction if listed
                const heroActionPromptAbilities = (!isOpp && gameState.effectPrompt?.type === 'heroAction' && gameState.effectPrompt?.ownerIdx === myIdx) ? (gameState.effectPrompt.activatableAbilities || []) : [];
                const isHeroActionActivatable = heroActionPromptAbilities.some(a => a.heroIdx === i && a.zoneIdx === z);
                const canActivate = isActivatable || isHeroActionActivatable || isFreeActivatable;
                const isFlashing = abilityFlash && abilityFlash.owner === (isOpp ? oppIdx : myIdx) && abilityFlash.heroIdx === i && abilityFlash.zoneIdx === z;
                const onAbilityClick = canActivate ? () => {
                  if (isFreeActivatable) {
                    // Free activation — no confirmation needed, activate directly
                    socket.emit('activate_free_ability', { roomId: gameState.roomId, heroIdx: i, zoneIdx: z });
                  } else {
                    setPendingAbilityActivation({ heroIdx: i, zoneIdx: z, abilityName: cards[0], level: cards.length, isHeroAction: isHeroActionActivatable });
                  }
                } : (isValidPotionTarget ? () => togglePotionTarget(abTargetId) : undefined);
                return (
                  <div key={z}
                    className={'board-zone board-zone-ability' + (heroIneligible || isDead || isFrozenOrStunned ? ' board-zone-dead' : '') + (isAbTarget ? ' board-zone-play-target' : '') + (isValidPotionTarget ? ' potion-target-valid' : '') + (isSelectedPotionTarget ? ' potion-target-selected' : '') + (isExploding ? ' zone-exploding' : '') + (oppTargetHighlight.includes(abTargetId) ? ' opp-target-highlight' : '') + (canActivate && !isFreeActivatable ? ' zone-ability-activatable' : '') + (isFreeActivatable ? ' zone-ability-free-activatable' : '') + (isFlashing ? ' zone-ability-activated' : '')}
                    data-ability-zone="1" data-ability-hero={i} data-ability-slot={z} data-ability-owner={ownerLabel}
                    onClick={onAbilityClick}
                    style={zsMerge('ability', canActivate ? { cursor: 'pointer' } : (isValidPotionTarget ? { cursor: 'pointer' } : undefined))}>
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
          if (i < 2) return [abilityGroup, <div key={'abspc-'+i} className="board-area-spacer" />];
          return [abilityGroup];
        })}
      </div>
    );

    const supportRow = (
      <div className="board-row">
        {[0, 1, 2].flatMap(i => {
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
          const supportGroup = (
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
              const isZonePickTarget = !isOpp && zonePickSet.has(`${pi}-${i}-${z}`);
              // During creature drag: highlight valid zones, dim invalid ones
              const isDraggingCreature = !isOpp && playDrag && playDrag.card?.cardType === 'Creature' && !playDrag.isEquip;
              const heroActionActive = !isOpp && gameState.effectPrompt?.type === 'heroAction' && gameState.effectPrompt?.ownerIdx === myIdx;
              const heroActionHeroIdx = heroActionActive ? gameState.effectPrompt.heroIdx : undefined;
              const isDragValidZone = isDraggingCreature && cards.length === 0 && canHeroPlayCard(me, i, playDrag.card) && z < ((me.supportZones[i] || []).length || 3) && (heroActionHeroIdx === undefined || heroActionHeroIdx === i);
              const isDragInvalidZone = isDraggingCreature && !isDragValidZone;
              // heroAction: dim zones for non-Coffee heroes
              const isHeroActionZoneDimmed = heroActionActive && !isDraggingCreature && i !== heroActionHeroIdx;
              // Additional Action provider selection highlight
              const isProviderZone = !isOpp && pendingAdditionalPlay && pendingAdditionalPlay.providers.some(p => p.heroIdx === i && p.zoneSlot === z);
              const isProviderSelectionActive = !isOpp && !!pendingAdditionalPlay;
              return (
                <div key={z} className={'board-zone board-zone-support' + (isIsland ? ' board-zone-island' : '') + ((isPlayTarget || isAutoTarget) ? ' board-zone-play-target' : '') + (isValidEquipTarget ? ' potion-target-valid' : '') + (isSelectedEquipTarget ? ' potion-target-selected' : '') + (isEquipExploding ? ' zone-exploding' : '') + (isSummonGlow ? ' zone-summon-glow' : '') + (equipTargetIds.some(id => oppTargetHighlight.includes(id)) ? ' opp-target-highlight' : '') + (isZonePickTarget ? ' zone-pick-target' : '') + (isDragValidZone ? ' zone-drag-valid' : '') + (isDragInvalidZone ? ' zone-drag-invalid' : '') + (isProviderZone ? ' zone-provider-highlight' : '') + (isProviderSelectionActive && !isProviderZone ? ' zone-provider-dimmed' : '') + (isHeroActionZoneDimmed ? ' zone-drag-invalid' : '')}
                  data-support-zone="1" data-support-hero={i} data-support-slot={z} data-support-owner={ownerLabel} data-support-island={isIsland ? 'true' : 'false'}
                  onClick={isProviderZone ? () => {
                    const provider = pendingAdditionalPlay.providers.find(p => p.heroIdx === i && p.zoneSlot === z);
                    if (provider) {
                      socket.emit('play_creature', {
                        roomId: gameState.roomId, cardName: pendingAdditionalPlay.cardName,
                        handIndex: pendingAdditionalPlay.handIndex, heroIdx: pendingAdditionalPlay.heroIdx,
                        zoneSlot: pendingAdditionalPlay.zoneSlot, additionalActionProvider: provider.cardId,
                      });
                      setPendingAdditionalPlay(null);
                      socket.emit('pending_placement_clear', { roomId: gameState.roomId });
                    }
                  } : isZonePickTarget ? () => respondToPrompt({ heroIdx: i, slotIdx: z }) : isValidEquipTarget ? () => equipTargetIds.forEach(id => togglePotionTarget(id)) : undefined}
                  style={zsMerge('support', (isValidEquipTarget || isZonePickTarget || isProviderZone) ? { cursor: 'pointer' } : undefined)}>
                  {(isPlayTarget || isAutoTarget) && playDrag.card ? (
                    <BoardCard cardName={playDrag.cardName} hp={playDrag.card.hp} maxHp={playDrag.card.hp} hpPosition="creature" style={{ opacity: 0.5 }} />
                  ) : (!isOpp && pendingAdditionalPlay && pendingAdditionalPlay.heroIdx === i && pendingAdditionalPlay.zoneSlot === z) ? (
                    <BoardCard cardName={pendingAdditionalPlay.cardName} hp={CARDS_BY_NAME[pendingAdditionalPlay.cardName]?.hp} maxHp={CARDS_BY_NAME[pendingAdditionalPlay.cardName]?.hp} hpPosition="creature" style={{ opacity: 0.6 }} />
                  ) : (isOpp && oppPendingPlacement && oppPendingPlacement.heroIdx === i && oppPendingPlacement.zoneSlot === z) ? (
                    <BoardCard cardName={oppPendingPlacement.cardName} hp={CARDS_BY_NAME[oppPendingPlacement.cardName]?.hp} maxHp={CARDS_BY_NAME[oppPendingPlacement.cardName]?.hp} hpPosition="creature" style={{ opacity: 0.6 }} />
                  ) : cards.length > 0 ? (
                    (() => { const cKey = `${pi}-${i}-${z}`; const cc = (gameState.creatureCounters || {})[cKey]; const isCreature = CARDS_BY_NAME[cards[cards.length-1]]?.cardType === 'Creature'; return !isCreature ? (
                      <BoardCard cardName={cards[cards.length-1]} skins={gameSkins} />
                    ) : (
                    <>
                    {cards.length === 1 ? (
                      (() => { const curHp = cc?.currentHp ?? CARDS_BY_NAME[cards[0]]?.hp; return <BoardCard cardName={cards[0]} hp={curHp} maxHp={CARDS_BY_NAME[cards[0]]?.hp} hpPosition="creature" skins={gameSkins} />; })()
                    ) : (
                      <div className="board-stack">
                        {(() => { const curHp = cc?.currentHp ?? CARDS_BY_NAME[cards[cards.length-1]]?.hp; return <BoardCard cardName={cards[cards.length-1]} hp={curHp} maxHp={CARDS_BY_NAME[cards[cards.length-1]]?.hp} hpPosition="creature" label={cards.length+''} skins={gameSkins} />; })()}
                      </div>
                    )}
                    {(() => { const lvl = cc?.level; return lvl ? <div className="creature-level">Lv{lvl}</div> : null; })()}
                    {(() => { return cc?.additionalActionAvail ? <div className="additional-action-icon"
                      onMouseEnter={() => { window._aaTooltipKey = cKey; window.dispatchEvent(new Event('aaHover')); }}
                      onMouseLeave={() => { window._aaTooltipKey = null; window.dispatchEvent(new Event('aaHover')); }}
                    >⚡</div> : null; })()}
                    {cc?.burned ? <BurnedOverlay /> : null}
                    {cc?.frozen ? <FrozenOverlay /> : null}
                    {cc?.negated ? <NegatedOverlay /> : null}
                    {cc?.poisoned ? <PoisonedOverlay stacks={cc.poisonStacks || 1} /> : null}
                    {(cc?.frozen || cc?.stunned || cc?.burned || cc?.poisoned || cc?.negated) ? <StatusBadges counters={cc} isHero={false} /> : null}
                    {cc?.buffs ? <BuffColumn buffs={cc.buffs} /> : null}
                    </>
                    ); })()
                  ) : (
                    <div className="board-zone-empty">{isIsland ? 'Island' : 'Support'}</div>
                  )}
                </div>
              );
            })}
          </div>
          );
          if (i < 2) return [supportGroup, <div key={'supspc-'+i} className="board-area-spacer" />];
          return [supportGroup];
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
        {isSpectator ? (
          <button className="btn btn-danger" style={{ padding: '4px 12px', fontSize: 10 }} onClick={handleLeave}>
            ✕ LEAVE
          </button>
        ) : (
          <button className="btn btn-danger" style={{ padding: '4px 12px', fontSize: 10 }} onClick={() => result ? handleLeave() : setShowSurrender(true)}>
            {result ? '✕ LEAVE' : '⚑ SURRENDER'}
          </button>
        )}
        <h2 className="orbit-font" style={{ fontSize: 14, color: isSpectator ? 'var(--text2)' : 'var(--accent)' }}>
          {isSpectator ? '👁 SPECTATING' : 'PIXEL PARTIES'}
        </h2>
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
              <div key={i} className="board-card face-down hand-card" style={oppDrawHidden.has(i) ? { visibility: 'hidden' } : undefined}>
                <img src={opp.cardback || "/cardback.png"} style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
              </div>
            ))}
          </div>
          <div className="game-gold-display">
            <span className="game-gold-icon">🪙</span>
            <span className="game-gold-value orbit-font" data-gold-player={oppIdx}>{opp.gold || 0}</span>
          </div>
        </div>
        {/* Board */}
        <div className={'game-board' + (showFirstChoice ? ' game-board-dimmed' : '') + (pt?.config?.greenSelect ? ' beer-targeting' : '')}>
          <div className="board-util board-util-left">
            <div className="board-util-side">
              <div data-opp-discard="1"><BoardZone type="discard" cards={oppDiscardHidden > 0 ? opp.discardPile.slice(0, -oppDiscardHidden) : opp.discardPile} label="Discard" onClick={() => setPileViewer({ title: 'Opponent Discard', cards: opp.discardPile })} onHoverCard={setHoveredPileCard} style={oppBoardZone('discard')} /></div>
              <div data-opp-deleted="1"><BoardZone type="deleted" cards={oppDeletedHidden > 0 ? opp.deletedPile.slice(0, -oppDeletedHidden) : opp.deletedPile} label="Deleted" onClick={() => setPileViewer({ title: 'Opponent Deleted', cards: opp.deletedPile })} onHoverCard={setHoveredPileCard} style={oppBoardZone('delete')} /></div>
              <div className="board-util-spacer" />
            </div>
            <div className="board-util-mid" />
            <div className="board-util-side">
              <div className="board-util-spacer" />
              <div data-my-deleted="1"><BoardZone type="deleted" cards={myDeletedHidden > 0 ? me.deletedPile.slice(0, -myDeletedHidden) : me.deletedPile} label="Deleted" onClick={() => setPileViewer({ title: 'My Deleted', cards: me.deletedPile })} onHoverCard={setHoveredPileCard} style={myBoardZone('delete')} /></div>
              <div data-my-discard="1"><BoardZone type="discard" cards={myDiscardHidden > 0 ? me.discardPile.slice(0, -myDiscardHidden) : me.discardPile} label="Discard" onClick={() => setPileViewer({ title: 'My Discard', cards: me.discardPile })} onHoverCard={setHoveredPileCard} style={myBoardZone('discard')} /></div>
            </div>
          </div>

          <div className="board-center" ref={boardCenterRef} style={{ position: 'relative' }}>
            {/* ── Generic Player Debuff Warnings ── */}
            {(() => {
              const debuffs = [];
              if (me.summonLocked) debuffs.push({ key: 'summon-me', text: 'You cannot summon any more Creatures this turn!', color: '#ff6644' });
              if (opp.summonLocked) debuffs.push({ key: 'summon-opp', text: `${opp.username} cannot summon any more Creatures this turn!`, color: '#cc8800' });
              if (me.damageLocked) debuffs.push({ key: 'damage-me', icon: '🔥', text: 'You cannot deal any more damage to your opponent this turn!', color: '#ff4444' });
              if (opp.damageLocked) debuffs.push({ key: 'damage-opp', icon: '🛡️', text: `${opp.username} cannot deal damage to your targets this turn!`, color: '#ff8844' });
              if (me.potionLocked) debuffs.push({ key: 'potion-me', icon: '🧪', text: 'You cannot play any more Potions this turn!', color: '#aa44ff' });
              if (opp.potionLocked) debuffs.push({ key: 'potion-opp', icon: '🧪', text: `${opp.username} cannot play any more Potions this turn!`, color: '#8844cc' });
              return debuffs.map(d => (
                <div key={d.key} className="summon-lock-warning" style={{ color: d.color }}>
                  {d.icon ? d.icon + ' ' : ''}{d.text}
                </div>
              ));
            })()}
            {pendingAdditionalPlay && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 200, fontSize: 13, fontWeight: 700, color: '#ffcc00', textShadow: '0 0 10px rgba(255,200,0,.5), 2px 2px 0 #000', textAlign: 'center', pointerEvents: 'none', animation: 'summonLockPulse 1.5s ease-in-out infinite', whiteSpace: 'nowrap' }}>Choose which additional Action to use!</div>}
            <div className="board-player-side board-side-opp">{renderPlayerSide(opp, true)}</div>
            <div className="board-area-zones-center">
              <BoardZone type="area" cards={gameState.areaZones?.[myIdx] || []} label="Area" style={{...myBoardZone('area'), left: areaPositions[0]}} />
              <BoardZone type="area" cards={gameState.areaZones?.[oppIdx] || []} label="Area" style={{...oppBoardZone('area'), left: areaPositions[1]}} />
            </div>
            <div className="board-mid-row" style={{ position: 'relative' }}>
              <div className="board-phase-tracker">
                {['Start Phase', 'Resource Phase', 'Main Phase 1', 'Action Phase', 'Main Phase 2', 'End Phase'].map((phase, i) => {
                  const isActive = currentPhase === i;
                  // Which phases can the active player click to advance to?
                  const canClick = isMyTurn && !result && !gameState.effectPrompt && (
                    (currentPhase === 2 && (i === 3 || i === 5)) || // Main1 → Action or End
                    (currentPhase === 3 && (i === 4 || i === 5)) || // Action → Main2 or End
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
              {gameState.format > 1 && !result && (
                <div className="set-score-fixed orbit-font">
                  <span style={{ color: 'var(--success)' }}>{gameState.setScore?.[myIdx] || 0}</span>
                  <span style={{ color: 'var(--text2)', margin: '0 8px' }}>—</span>
                  <span style={{ color: 'var(--danger)' }}>{gameState.setScore?.[oppIdx] || 0}</span>
                  <span style={{ fontSize: 10, color: 'var(--text2)', marginLeft: 10 }}>Bo{gameState.format}</span>
                </div>
              )}
            </div>
            <div className="board-player-side board-side-me">{renderPlayerSide(me, false)}</div>
            {/* Permanent zones — positioned absolutely to avoid layout interference */}
            {(opp.permanents || []).length > 0 && (
              <div className="board-permanents board-permanents-opp">
                {opp.permanents.map(perm => (
                  <div key={perm.id} className="board-permanent-slot" data-perm-id={perm.id} data-perm-owner="opp">
                    <BoardCard cardName={perm.name} />
                  </div>
                ))}
              </div>
            )}
            {(me.permanents || []).length > 0 && (
              <div className="board-permanents board-permanents-me">
                {me.permanents.map(perm => (
                  <div key={perm.id} className="board-permanent-slot" data-perm-id={perm.id} data-perm-owner="me">
                    <BoardCard cardName={perm.name} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="board-util board-util-right">
            <div className="board-util-side">
              <BoardZone type="deck" label="Deck" faceDown style={oppBoardZone('deck')}>
                <div className="board-card face-down" data-opp-deck="1"><img src={opp.cardback || "/cardback.png"} style={{width:'100%',height:'100%',objectFit:'cover'}} draggable={false} /><div className="board-card-label">{opp.deckCount}</div></div>
              </BoardZone>
              <BoardZone type="potion" label="Potions" faceDown style={oppBoardZone('potion')}>
                {opp.potionDeckCount > 0 && <div className="board-card face-down"><img src={opp.cardback || "/cardback.png"} style={{width:'100%',height:'100%',objectFit:'cover'}} draggable={false} /><div className="board-card-label">{opp.potionDeckCount}</div></div>}
              </BoardZone>
              <div className="board-util-spacer" />
            </div>
            <div className="board-util-mid" />
            <div className="board-util-side">
              <div className="board-util-spacer" />
              <div onClick={() => !isSpectator && me.potionDeckCount > 0 && setDeckViewer('potion')} style={{ cursor: !isSpectator && me.potionDeckCount > 0 ? 'pointer' : 'default' }}>
              <BoardZone type="potion" label="Potions" faceDown style={myBoardZone('potion')}>
                {me.potionDeckCount > 0 && <div className="board-card face-down"><img src={me.cardback || "/cardback.png"} style={{width:'100%',height:'100%',objectFit:'cover'}} draggable={false} /><div className="board-card-label">{me.potionDeckCount}</div></div>}
              </BoardZone>
              </div>
              <div onClick={() => !isSpectator && me.deckCount > 0 && setDeckViewer('deck')} style={{ cursor: !isSpectator && me.deckCount > 0 ? 'pointer' : 'default' }} data-my-deck="1">
              <BoardZone type="deck" label="Deck" faceDown style={myBoardZone('deck')}>
                <div className="board-card face-down"><img src={me.cardback || "/cardback.png"} style={{width:'100%',height:'100%',objectFit:'cover'}} draggable={false} /><div className="board-card-label">{me.deckCount}</div></div>
              </BoardZone>
              </div>
            </div>
          </div>
        </div>

        {/* My hand (bottom player) — drag to reorder for players, face-down for spectators */}
        <div className="game-hand game-hand-me" ref={isSpectator ? undefined : handRef}>
          <div className="game-hand-info">
            {me.avatar && <img src={me.avatar} className="game-hand-avatar game-hand-avatar-big" />}
            <span className="orbit-font" style={{ fontSize: 18, fontWeight: 800, color: me.color }}>{me.username}</span>
            {meDisconnected && <span style={{ fontSize: 10, color: 'var(--danger)', animation: 'pulse 1.5s infinite' }}>DISCONNECTED</span>}
          </div>
          {isSpectator ? (
            <div className="game-hand-cards">
              {Array.from({ length: me.handCount || 0 }).map((_, i) => (
                <div key={i} className="board-card face-down hand-card" style={specMeDrawHidden.has(i) ? { visibility: 'hidden' } : undefined}>
                  <img src={me.cardback || "/cardback.png"} style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
                </div>
              ))}
            </div>
          ) : (
            <div className="game-hand-cards">
              {displayHand.map((item, i) => {
                if (item.isGap) return <div key="gap" className="hand-drop-gap" />;
                const isBeingDragged = handDrag && handDrag.idx === item.origIdx;
                const dimmed = getCardDimmed(item.card);
                const isDrawAnim = drawAnimCards.some(a => a.origIdx === item.origIdx);
                const isPendingPlay = pendingAdditionalPlay && pendingAdditionalPlay.handIndex === item.origIdx;
                const isForceDiscard = gameState.effectPrompt?.type === 'forceDiscard' && gameState.effectPrompt?.ownerIdx === myIdx;
                const isForceDiscardCancellable = gameState.effectPrompt?.type === 'forceDiscardCancellable' && gameState.effectPrompt?.ownerIdx === myIdx;
                const isAbilityAttach = gameState.effectPrompt?.type === 'abilityAttach' && gameState.effectPrompt?.ownerIdx === myIdx;
                const isAttachEligible = isAbilityAttach && (gameState.effectPrompt.eligibleCards || []).includes(item.card);
                const isAnyDiscard = isForceDiscard || isForceDiscardCancellable;
                return (
                  <div key={'h-' + item.origIdx} data-hand-idx={item.origIdx}
                    className={'hand-slot' + (isBeingDragged ? ' hand-dragging' : '') + (dimmed ? ' hand-card-dimmed' : '') + (isAnyDiscard ? ' hand-discard-target' : '') + (isAttachEligible ? ' hand-card-attach-eligible' : '') + (isAbilityAttach && !isAttachEligible ? ' hand-card-attach-dimmed' : '')}
                    style={(isDrawAnim || isPendingPlay) ? { visibility: 'hidden' } : undefined}
                    onMouseDown={(e) => onHandMouseDown(e, item.origIdx)}
                    onMouseEnter={() => isAnyDiscard && setHoveredPileCard(item.card)}
                    onMouseLeave={() => isAnyDiscard && setHoveredPileCard(null)}>
                    <BoardCard cardName={item.card} noTooltip={isAnyDiscard} skins={gameSkins} />
                  </div>
                );
              })}
            </div>
          )}
          {!isSpectator && (
            <div className="hand-actions">
              <button className="btn hand-action-btn" onClick={sortHand} title="Sort hand by type, then name">Sort</button>
              <button className="btn hand-action-btn" onClick={shuffleHand} title="Shuffle hand randomly">Shuffle</button>
            </div>
          )}
          <div className="game-gold-display">
            <span className="game-gold-icon">🪙</span>
            <span className="game-gold-value orbit-font" data-gold-player={myIdx}>{me.gold || 0}</span>
          </div>
        </div>

        </div>
      {/* end game-layout */}

      {/* Floating draw animation cards (outside game-layout to avoid overflow clip) */}
      {!isSpectator && drawAnimCards.map(anim => (
        <DrawAnimCard key={anim.id} cardName={anim.cardName} origIdx={anim.origIdx}
          startX={anim.startX} startY={anim.startY} dimmed={getCardDimmed(anim.cardName)} />
      ))}
      {oppDrawAnims.map(anim => (
        <OppDrawAnimCard key={anim.id} startX={anim.startX} startY={anim.startY}
          endX={anim.endX} endY={anim.endY} cardName={anim.cardName} cardbackUrl={opp.cardback} />
      ))}
      {/* Spectator: bottom player draw animations (face-down, like opponent) */}
      {isSpectator && specMeDrawAnims.map(anim => (
        <OppDrawAnimCard key={anim.id} startX={anim.startX} startY={anim.startY}
          endX={anim.endX} endY={anim.endY} cardbackUrl={me.cardback} />
      ))}

      {/* Floating discard animation cards */}
      {discardAnims.map(anim => (
        <DiscardAnimCard key={anim.id} cardName={anim.cardName} dest={anim.dest}
          startX={anim.startX} startY={anim.startY} endX={anim.endX} endY={anim.endY} />
      ))}

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
      {creatureDamageNumbers.map(d => (
        <CreatureDamageNumber key={d.id} amount={d.amount} ownerLabel={d.ownerLabel} heroIdx={d.heroIdx} zoneSlot={d.zoneSlot} />
      ))}

      {/* Gold gain numbers */}
      {goldGains.map(g => (
        <GoldGainNumber key={g.id} amount={g.amount} playerIdx={g.playerIdx} isMe={g.playerIdx === myIdx} />
      ))}

      {/* Gold loss numbers */}
      {goldLosses.map(g => (
        <GoldLossNumber key={g.id} amount={g.amount} playerIdx={g.playerIdx} isMe={g.playerIdx === myIdx} />
      ))}

      {/* Level change numbers */}
      {levelChanges.map(lc => (
        <LevelChangeNumber key={lc.id} delta={lc.delta} owner={lc.owner} heroIdx={lc.heroIdx} zoneSlot={lc.zoneSlot} myIdx={myIdx} />
      ))}

      {/* Toughness HP change numbers */}
      {toughnessHpChanges.map(thp => (
        <ToughnessHpNumber key={thp.id} amount={thp.amount} owner={thp.owner} heroIdx={thp.heroIdx} myIdx={myIdx} />
      ))}

      {/* Fighting ATK change numbers */}
      {fightingAtkChanges.map(fa => (
        <FightingAtkNumber key={fa.id} amount={fa.amount} owner={fa.owner} heroIdx={fa.heroIdx} myIdx={myIdx} />
      ))}

      {/* Modular game animations (explosions, etc.) */}
      {gameAnims.map(a => (
        <GameAnimationRenderer key={a.id} {...a} />
      ))}

      {/* Beam animations (laser beams, etc.) */}
      {beamAnims.length > 0 && (
        <div className="beam-animation-container">
          <svg>
            {beamAnims.map(b => (
              <g key={b.id}>
                <line className="beam-line-outer" x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} />
                <line className="beam-line-glow" x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} />
                <line className="beam-line-core" x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} style={{ stroke: b.color }} />
                <circle className="beam-impact" cx={b.x2} cy={b.y2} r="5" fill={b.color} opacity="0.8" />
              </g>
            ))}
          </svg>
        </div>
      )}

      {/* Ram animations (hero charges to target and back) */}
      {ramAnims.map(r => (
        <div key={r.id} className="ram-anim-card" style={{
          left: r.srcX - 34, top: r.srcY - 48,
          '--ramDx': (r.tgtX - r.srcX) + 'px',
          '--ramDy': (r.tgtY - r.srcY) + 'px',
          '--ramAngle': (r.angle || 0) + 'deg',
          animationDuration: r.dur + 'ms',
        }}>
          <BoardCard cardName={r.cardName} noTooltip />
          <div className="ram-flame-trail" />
        </div>
      ))}

      {/* Card transfer animations (Dark Gear creature steal, etc.) */}
      {transferAnims.map(t => (
        <div key={t.id} className="transfer-anim-card" style={{
          left: t.srcX, top: t.srcY,
          '--transferDx': (t.tgtX - t.srcX) + 'px',
          '--transferDy': (t.tgtY - t.srcY) + 'px',
          animationDuration: t.dur + 'ms',
        }}>
          <BoardCard cardName={t.cardName} noTooltip />
        </div>
      ))}

      {/* Projectile animations (phoenix cannon, etc.) */}
      {projectileAnims.map(p => (
        <div key={p.id} className="projectile-anim" style={{
          left: p.srcX, top: p.srcY,
          '--projDx': (p.tgtX - p.srcX) + 'px',
          '--projDy': (p.tgtY - p.srcY) + 'px',
          animationDuration: p.dur + 'ms',
        }}>
          <span className={p.projectileClass || 'projectile-emoji'} style={p.emojiStyle || {}}>{p.projectileClass ? '' : p.emoji}</span>
          <div className={p.trailClass || 'projectile-flame-trail'} />
        </div>
      ))}

      {/* Opponent card reveal */}
      {cardReveals.length > 0 && (
        <CardRevealOverlay reveals={cardReveals} onRemove={(id) => setCardReveals(prev => prev.filter(r => r.id !== id))} />
      )}

      {/* ── Reaction Chain Visualization ── */}
      {reactionChain && reactionChain.length >= 2 && (
        <div className="reaction-chain-overlay">
          <div className="reaction-chain-label orbit-font">Chain</div>
          <div className="reaction-chain-cards">
            {reactionChain.map((link, i) => (
              <div key={link.id} className={
                'reaction-chain-card'
                + (link.status === 'resolving' ? ' chain-glow' : '')
                + (link.status === 'negated' ? ' chain-negated' : '')
                + (link.status === 'resolved' ? ' chain-resolved' : '')
              }>
                <BoardCard cardName={link.cardName} style={{ width: 80, height: 112, borderRadius: 4 }} />
                {link.isInitialCard && <div className="chain-badge chain-badge-initial">INITIAL</div>}
                {link.status === 'negated' && <div className="chain-negate-symbol">🚫</div>}
                {link.status === 'negated' && link.negationStyle === 'ice' && (
                  <div className="chain-ice-overlay">
                    <div className="chain-ice-crystal" style={{ left: 8, top: 12, fontSize: 14, animationDelay: '0ms' }}>❄</div>
                    <div className="chain-ice-crystal" style={{ left: 55, top: 30, fontSize: 18, animationDelay: '50ms' }}>❄</div>
                    <div className="chain-ice-crystal" style={{ left: 20, top: 55, fontSize: 12, animationDelay: '100ms' }}>❆</div>
                    <div className="chain-ice-crystal" style={{ left: 50, top: 75, fontSize: 16, animationDelay: '150ms' }}>❄</div>
                    <div className="chain-ice-crystal" style={{ left: 12, top: 85, fontSize: 14, animationDelay: '200ms' }}>❅</div>
                    <div className="chain-ice-crystal" style={{ left: 40, top: 15, fontSize: 11, animationDelay: '80ms' }}>❆</div>
                  </div>
                )}
                <div className="chain-owner-dot" style={{ background: link.owner === myIdx ? 'var(--accent)' : 'var(--danger)' }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Camera Flash ── */}
      {cameraFlash && (
        <div className="camera-flash-overlay">
          <div className="camera-flash-icon">
            <svg viewBox="0 0 100 100" width="120" height="120">
              <rect x="20" y="30" width="60" height="45" rx="8" fill="#ff69b4" stroke="#fff" strokeWidth="2"/>
              <circle cx="50" cy="52" r="14" fill="#222" stroke="#fff" strokeWidth="2"/>
              <circle cx="50" cy="52" r="8" fill="#4af"/>
              <rect x="38" y="24" width="24" height="10" rx="3" fill="#ff69b4" stroke="#fff" strokeWidth="1.5"/>
              <ellipse cx="28" cy="22" rx="10" ry="16" fill="none" stroke="#ff69b4" strokeWidth="2" transform="rotate(-30 28 22)"/>
              <ellipse cx="72" cy="22" rx="10" ry="16" fill="none" stroke="#ff69b4" strokeWidth="2" transform="rotate(30 72 22)"/>
            </svg>
          </div>
        </div>
      )}

      {/* ── Global Game Tooltip ── */}
      <GameTooltip />

      {/* Immune status tooltip */}
      {immuneTooltip && (() => {
        const el = document.querySelector(`[data-hero-name="${CSS.escape(immuneTooltip)}"] .status-immune-icon`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return <div className="immune-tooltip" style={{ position: 'fixed', left: r.right + 8, top: r.top - 4 }}>{immuneTooltipType === 'shielded' ? 'Immune to anything during your first turn!' : 'Cannot be Frozen, Stunned or otherwise incapacitated this turn.'}</div>;
      })()}

      {/* Additional Action icon tooltip */}
      {aaTooltipKey && (() => {
        const [ow, hi, sl] = aaTooltipKey.split('-');
        const ownerLabel = parseInt(ow) === myIdx ? 'me' : 'opp';
        const el = document.querySelector(`[data-support-owner="${ownerLabel}"][data-support-hero="${hi}"][data-support-slot="${sl}"] .additional-action-icon`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return <div className="immune-tooltip" style={{ position: 'fixed', left: r.right + 8, top: r.top - 4, borderColor: 'rgba(255,200,0,.4)', color: '#ffdd88' }}>Provides an additional Action.</div>;
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
            <DraggablePanel className="modal animate-in deck-viewer-modal" style={{ maxWidth: 600 }}>
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
            </DraggablePanel>
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
            <DraggablePanel className="modal animate-in deck-viewer-modal">
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
            </DraggablePanel>
          </div>
        );
      })()}

      {/* ── Effect Prompt: Confirm Dialog ── */}
      {isMyEffectPrompt && ep.type === 'confirm' && (
        <DraggablePanel className="first-choice-panel animate-in" style={{ borderColor: 'var(--accent)' }}>
          <div className="orbit-font" style={{ fontSize: 13, color: 'var(--accent)', marginBottom: 8 }}>{ep.title || 'Confirm'}</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>{ep.message}</div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn btn-success" style={{ padding: '10px 24px', fontSize: 13 }}
              onClick={() => respondToPrompt({ confirmed: true })}>
              {ep.confirmLabel || 'Yes'}
            </button>
            <button className="btn" style={{ padding: '10px 24px', fontSize: 13, borderColor: 'var(--danger)', color: 'var(--danger)' }}
              onClick={() => respondToPrompt({ cancelled: true })}>
              {ep.cancelLabel || 'No'}
            </button>
          </div>
        </DraggablePanel>
      )}

      {/* ── Effect Prompt: Player Picker ── */}
      {isMyEffectPrompt && ep.type === 'playerPicker' && (
        <DraggablePanel className="first-choice-panel animate-in" style={{ borderColor: 'var(--accent)', minWidth: 280 }}>
          <div className="orbit-font" style={{ fontSize: 13, color: 'var(--accent)', marginBottom: 8 }}>{ep.title || 'Choose a Player'}</div>
          {ep.description && <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 14 }}>{ep.description}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1].map(pIdx => {
              const p = pIdx === myIdx ? me : opp;
              const isMe = pIdx === myIdx;
              const clr = isMe ? 'var(--success)' : 'var(--danger)';
              return (
                <button key={pIdx} className="btn" style={{ padding: '12px 18px', fontSize: 13, borderColor: clr, color: clr, display: 'flex', alignItems: 'center', gap: 12 }}
                  onClick={() => respondToPrompt({ playerIdx: pIdx })}>
                  {p.avatar && <img src={p.avatar} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />}
                  <div>
                    <div style={{ fontWeight: 700 }}>{p.username}{isMe ? ' (you)' : ''}</div>
                  </div>
                </button>
              );
            })}
            {ep.cancellable !== false && (
              <button className="btn" style={{ padding: '8px 18px', fontSize: 11, borderColor: 'var(--danger)', color: 'var(--danger)', marginTop: 4 }}
                onClick={() => respondToPrompt({ cancelled: true })}>Cancel (Esc)</button>
            )}
          </div>
        </DraggablePanel>
      )}

      {/* ── Effect Prompt: Option Picker (generic multi-option) ── */}
      {isMyEffectPrompt && ep.type === 'optionPicker' && (
        <DraggablePanel className="first-choice-panel animate-in" style={{ borderColor: 'var(--accent)' }}>
          <div className="orbit-font" style={{ fontSize: 13, color: 'var(--accent)', marginBottom: 8 }}>{ep.title || 'Choose'}</div>
          {ep.description && <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 14 }}>{ep.description}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(ep.options || []).map(opt => (
              <button key={opt.id} className="btn" style={{ padding: '10px 18px', fontSize: 12, borderColor: opt.color || 'var(--accent)', color: opt.color || 'var(--accent)', textAlign: 'left' }}
                onClick={() => respondToPrompt({ optionId: opt.id })}>
                <div style={{ fontWeight: 600 }}>{opt.label}</div>
                {opt.description && <div style={{ fontSize: 10, opacity: .7, marginTop: 2 }}>{opt.description}</div>}
              </button>
            ))}
            {ep.cancellable !== false && (
              <button className="btn" style={{ padding: '8px 18px', fontSize: 11, borderColor: 'var(--danger)', color: 'var(--danger)', marginTop: 4 }}
                onClick={() => respondToPrompt({ cancelled: true })}>Cancel (Esc)</button>
            )}
          </div>
        </DraggablePanel>
      )}

      {/* ── Effect Prompt: Card Gallery Picker ── */}
      {isMyEffectPrompt && ep.type === 'cardGallery' && (() => {
        const cards = ep.cards || [];
        return (
          <div className="modal-overlay" onClick={ep.cancellable !== false ? () => respondToPrompt({ cancelled: true }) : undefined}>
            <DraggablePanel className="modal animate-in deck-viewer-modal" style={{ maxWidth: 600 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span className="orbit-font" style={{ fontSize: 13, color: 'var(--accent)' }}>
                  {ep.title || 'Select a Card'}
                </span>
                {ep.cancellable !== false && (
                  <button className="btn" style={{ padding: '4px 12px', fontSize: 10 }}
                    onClick={() => respondToPrompt({ cancelled: true })}>✕ CANCEL</button>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>{ep.description}</div>
              <div className="deck-viewer-grid">
                {cards.map((entry, i) => {
                  const card = CARDS_BY_NAME[entry.name];
                  if (!card) return null;
                  return (
                    <div key={entry.name + '-' + entry.source + '-' + i} style={{ position: 'relative' }}>
                      <CardMini card={card}
                        onClick={() => respondToPrompt({ cardName: entry.name, source: entry.source })}
                        style={{ width: '100%', height: 120, cursor: 'pointer' }} />
                      {entry.count != null && (
                        <div style={{
                          position: 'absolute', top: 3, right: 3,
                          background: 'rgba(0,0,0,.75)', color: '#fff',
                          fontSize: 10, fontWeight: 700, padding: '1px 5px',
                          borderRadius: 3, pointerEvents: 'none', zIndex: 5,
                          border: '1px solid rgba(255,255,255,.25)',
                        }}>×{entry.count}</div>
                      )}
                      <div className="gallery-source-badge" style={{
                        background: entry.source === 'hand' ? 'rgba(80,200,120,.85)' : entry.source === 'discard' ? 'rgba(180,80,200,.85)' : 'rgba(80,140,220,.85)',
                      }}>
                        {entry.source === 'hand' ? 'HAND' : entry.source === 'discard' ? 'DISCARD' : 'DECK'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </DraggablePanel>
          </div>
        );
      })()}

      {/* ── Effect Prompt: Multi-Select Card Gallery ── */}
      {isMyEffectPrompt && ep.type === 'cardGalleryMulti' && (
        <CardGalleryMultiPrompt ep={ep} onRespond={respondToPrompt} />
      )}

      {/* ── Effect Prompt: Zone Picker Panel ── */}
      {isMyEffectPrompt && ep.type === 'zonePick' && (
        <DraggablePanel className="first-choice-panel animate-in" style={{ borderColor: 'var(--accent)' }}>
          <div className="orbit-font" style={{ fontSize: 13, color: 'var(--accent)', marginBottom: 8 }}>{ep.title || 'Select a Zone'}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>{ep.description}</div>
          <div style={{ fontSize: 11, color: 'var(--text2)', opacity: .7 }}>Click a highlighted zone on the board.</div>
          {ep.cancellable !== false && (
            <button className="btn" style={{ marginTop: 10, padding: '6px 16px', fontSize: 11 }}
              onClick={() => respondToPrompt({ cancelled: true })}>← Back</button>
          )}
        </DraggablePanel>
      )}

      {/* ── Effect Prompt: Status Select (Beer, etc.) ── */}
      {isMyEffectPrompt && ep.type === 'statusSelect' && (
        <StatusSelectPrompt key={ep.title} ep={ep} onRespond={respondToPrompt} />
      )}

      {/* ── Effect Prompt: Hero Action (Coffee) ── */}
      {isMyEffectPrompt && ep.type === 'heroAction' && (
        <DraggablePanel className="first-choice-panel animate-in" style={{ borderColor: '#8b6b4a' }}>
          <div className="orbit-font" style={{ fontSize: 13, color: '#cc9966', marginBottom: 4 }}>☕ {ep.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10 }}>{ep.description}</div>
          <div style={{ fontSize: 11, color: 'var(--text2)', opacity: .7, marginBottom: 12 }}>Drag a highlighted card onto {ep.heroName}'s zones to play it.</div>
          <button className="btn" style={{ padding: '6px 16px', fontSize: 11, borderColor: 'var(--danger)', color: 'var(--danger)' }}
            onClick={() => respondToPrompt({ cancelled: true })}>Cancel (Esc)</button>
        </DraggablePanel>
      )}

      {/* ── Waiting for opponent (when they have an active effect prompt) ── */}
      {isOppEffectPrompt && !gameState.potionTargeting && (
        <DraggablePanel className="first-choice-panel animate-in" style={{ borderColor: 'var(--accent)', minWidth: 260 }}>
          <div className="orbit-font" style={{ fontSize: 12, color: 'var(--accent)', marginBottom: 6 }}>
            {ep.type === 'cardGallery' ? '🔍 Opponent is choosing...' :
             ep.type === 'confirm' ? '⏳ Waiting for confirmation...' :
             '⏳ Waiting for opponent...'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text2)' }}>
            {ep.type === 'cardGallery' ? 'Waiting for opponent to choose a card...' :
             ep.type === 'confirm' ? 'Waiting for opponent to confirm your selection...' :
             ep.type === 'zonePick' ? 'Waiting for opponent to select a zone...' :
             ep.type === 'heroAction' ? 'Waiting for opponent to play a card...' :
             ep.type === 'forceDiscard' || ep.type === 'forceDiscardCancellable' ? 'Waiting for opponent to discard...' :
             'Waiting for opponent...'}
          </div>
        </DraggablePanel>
      )}

      {/* ── Waiting for opponent's pre-game hero effect (Bill, etc.) ── */}
      {!isSpectator && !result && gameState.heroEffectPending && gameState.heroEffectPending.ownerIdx !== myIdx && (
        <DraggablePanel className="first-choice-panel animate-in" style={{ borderColor: 'var(--accent)', minWidth: 280 }}>
          <div className="orbit-font" style={{ fontSize: 12, color: 'var(--accent)', marginBottom: 6 }}>
            ⏳ Waiting for opponent...
          </div>
          <div style={{ fontSize: 11, color: 'var(--text2)' }}>
            Waiting for opponent to resolve {gameState.heroEffectPending.heroName || 'hero'}'s effect...
          </div>
        </DraggablePanel>
      )}

      {/* ── Ability Activation Confirmation ── */}
      {pendingAbilityActivation && !result && (
        <DraggablePanel className="first-choice-panel animate-in" style={{ borderColor: '#ffcc33' }}>
          <div className="orbit-font" style={{ fontSize: 13, color: '#ffcc33', marginBottom: 8 }}>⚡ Activate Ability</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 16 }}>Activate {pendingAbilityActivation.abilityName} (Lv.{pendingAbilityActivation.level})?</div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn btn-success" style={{ padding: '8px 20px', fontSize: 12 }}
              onClick={() => {
                const pa = pendingAbilityActivation;
                setPendingAbilityActivation(null);
                if (pa.isHeroAction) {
                  socket.emit('effect_prompt_response', { roomId: gameState.roomId, response: { abilityActivation: true, heroIdx: pa.heroIdx, zoneIdx: pa.zoneIdx } });
                } else {
                  socket.emit('activate_ability', { roomId: gameState.roomId, heroIdx: pa.heroIdx, zoneIdx: pa.zoneIdx });
                }
              }}>Yes!</button>
            <button className="btn" style={{ padding: '8px 20px', fontSize: 12, borderColor: 'var(--danger)', color: 'var(--danger)' }}
              onClick={() => setPendingAbilityActivation(null)}>No</button>
          </div>
        </DraggablePanel>
      )}

      {/* ── Force Discard Prompt (Wheels) ── */}
      {isMyEffectPrompt && ep.type === 'forceDiscard' && (
        <DraggablePanel className="first-choice-panel animate-in" style={{ borderColor: 'var(--danger)' }}>
          <div className="orbit-font" style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 4 }}>{ep.title || 'Discard'}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10 }}>{ep.description}</div>
          <div style={{ fontSize: 11, color: 'var(--danger)', opacity: .8 }}>Click a card in your hand to discard it.</div>
        </DraggablePanel>
      )}

      {/* ── Cancellable Force Discard Prompt (Training, etc.) ── */}
      {isMyEffectPrompt && ep.type === 'forceDiscardCancellable' && (
        <DraggablePanel className="first-choice-panel animate-in" style={{ borderColor: 'var(--danger)' }}>
          <div className="orbit-font" style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 4 }}>{ep.title || 'Discard'}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10 }}>{ep.description}</div>
          <div style={{ fontSize: 11, color: 'var(--danger)', opacity: .8, marginBottom: 12 }}>Click a card in your hand to discard it.</div>
          <button className="btn" style={{ padding: '6px 16px', fontSize: 11, borderColor: 'var(--danger)', color: 'var(--danger)' }}
            onClick={() => respondToPrompt({ cancelled: true })}>Cancel (Esc)</button>
        </DraggablePanel>
      )}

      {/* ── Ability Attach Prompt (Training, etc.) ── */}
      {isMyEffectPrompt && ep.type === 'abilityAttach' && (
        <DraggablePanel className="first-choice-panel animate-in" style={{ borderColor: 'rgba(100,220,150,.85)' }}>
          <div className="orbit-font" style={{ fontSize: 13, color: '#7fffaa', marginBottom: 4 }}>✦ {ep.title || 'Attach Ability'}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10 }}>{ep.description}</div>
          <div style={{ fontSize: 11, color: '#7fffaa', opacity: .8, marginBottom: 12 }}>Drag a highlighted Ability from your hand onto the Hero.</div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            {ep.canFinish && (
              <button className="btn btn-success" style={{ padding: '6px 16px', fontSize: 11 }}
                onClick={() => respondToPrompt({ finished: true })}>Done</button>
            )}
            <button className="btn" style={{ padding: '6px 16px', fontSize: 11, borderColor: 'var(--danger)', color: 'var(--danger)' }}
              onClick={() => respondToPrompt({ cancelled: true })}>Cancel (Esc)</button>
          </div>
        </DraggablePanel>
      )}

      {/* ── Effect Prompt: Deck Search Reveal (opponent sees searched card) ── */}
      {isMyEffectPrompt && ep.type === 'deckSearchReveal' && (() => {
        return (
          <div className="modal-overlay" style={{ zIndex: 10070, background: 'rgba(0,0,0,.55)' }}
            onClick={() => respondToPrompt({ confirmed: true })}>
            <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }} onClick={e => e.stopPropagation()}>
              <div className="orbit-font" style={{ fontSize: 14, color: 'var(--accent)', textShadow: '0 2px 8px rgba(0,0,0,.8)' }}>
                {ep.title || 'Card Searched'}
              </div>
              <div style={{
                boxShadow: '0 0 50px rgba(0,0,0,.9), 0 0 100px rgba(255,255,255,.08)',
                borderRadius: 8,
              }}>
                <BoardCard cardName={ep.cardName} style={{ width: 220, height: 308, borderRadius: 8 }} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                {ep.searcherName} searched this card from their deck.
              </div>
              <button className="btn btn-success" style={{ padding: '10px 36px', fontSize: 13 }}
                onClick={() => {
                  respondToPrompt({ confirmed: true });
                }}>
                OK
              </button>
            </div>
          </div>
        );
      })()}

      {/* Rematch first-choice dialog (loser only) — floating panel so hand is visible */}
      {showFirstChoice && !isSpectator && (
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

      {/* Spectator: waiting for first-choice decision */}
      {isSpectator && gameState.awaitingFirstChoice && (
        <DraggablePanel className="first-choice-panel animate-in" style={{ borderColor: 'var(--accent)', minWidth: 280 }}>
          <div className="orbit-font" style={{ fontSize: 14, color: 'var(--accent)', marginBottom: 10 }}>⏳ NEXT ROUND</div>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>
            {gameState.choosingPlayerName
              ? <><span style={{ color: 'var(--accent2)', fontWeight: 700 }}>{gameState.choosingPlayerName}</span> is deciding who goes first...</>
              : 'Deciding who goes first...'}
          </div>
        </DraggablePanel>
      )}

      {/* Potion/Artifact targeting panel */}
      {!isSpectator && isTargeting && pt && !gameState.effectPrompt && (
        <DraggablePanel className="first-choice-panel" style={{ borderColor: 'var(--danger)', animation: 'fadeIn .2s ease-out' }}>
          <div className="pixel-font" style={{ fontSize: 12, color: pt.config?.greenSelect ? '#33dd55' : 'var(--danger)', marginBottom: 8 }}>{pt.potionName}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 14 }}>{pt.config?.description || 'Select targets'}</div>
          {pt.config?.maxTotal > 0 && pt.validTargets?.length > 0 && (
            <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 10, fontWeight: 600 }}>
              {potionSelection.length} / {pt.config.maxTotal} selected
              {pt.config.minRequired > 0 && potionSelection.length < pt.config.minRequired
                ? ` (min ${pt.config.minRequired})`
                : ''}
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className={'btn ' + (pt.config?.confirmClass || 'btn-success')} style={{ padding: '8px 24px', fontSize: 12 }}
              disabled={!canConfirmPotion}
              onClick={() => { socket.emit('confirm_potion', { roomId: gameState.roomId, selectedIds: potionSelection }); }}>
              {pt.config?.confirmLabel || 'Confirm'}
              {pt.config?.dynamicCostPerTarget > 0 && ` (${pt.config.dynamicCostPerTarget * potionSelection.length} Gold)`}
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

      {/* Mulligan prompt */}
      {!isSpectator && gameState.mulliganPending && !announcement && !mulliganDecided && (
        <DraggablePanel className="first-choice-panel animate-in" style={{ borderColor: 'var(--accent)', minWidth: 300 }}>
          <div className="orbit-font" style={{ fontSize: 15, color: 'var(--accent)', marginBottom: 10 }}>MULLIGAN</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>Would you like to replace your hand with 5 new cards?</div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn btn-success" style={{ padding: '10px 28px', fontSize: 13 }}
              onClick={() => { setMulliganDecided(true); socket.emit('mulligan_decision', { roomId: gameState.roomId, accept: true }); }}>
              Yes, replace
            </button>
            <button className="btn" style={{ padding: '10px 28px', fontSize: 13, borderColor: 'var(--accent)', color: 'var(--accent)' }}
              onClick={() => { setMulliganDecided(true); socket.emit('mulligan_decision', { roomId: gameState.roomId, accept: false }); }}>
              No, keep
            </button>
          </div>
        </DraggablePanel>
      )}
      {!isSpectator && gameState.mulliganPending && mulliganDecided && (
        <DraggablePanel className="first-choice-panel animate-in" style={{ borderColor: 'var(--accent)', minWidth: 240 }}>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>Waiting for opponent...</div>
        </DraggablePanel>
      )}
      {/* Spectator: waiting for mulligan */}
      {isSpectator && gameState.mulliganPending && (
        <DraggablePanel className="first-choice-panel animate-in" style={{ borderColor: 'var(--accent)', minWidth: 280 }}>
          <div className="orbit-font" style={{ fontSize: 14, color: 'var(--accent)', marginBottom: 10 }}>⏳ MULLIGAN</div>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>Players are deciding to mulligan...</div>
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

      {/* Win/Loss overlay — round result (non-final) */}
      {result && !showFirstChoice && !result.setOver && result.format > 1 && (
        <div className="modal-overlay" style={{ background: 'rgba(0,0,0,.65)' }}>
          <div className="animate-in" style={{ textAlign: 'center' }}>
            <div className="pixel-font" style={{
              fontSize: 28, marginBottom: 12,
              color: isSpectator ? 'var(--accent)' : (iWon ? 'var(--success)' : 'var(--danger)'),
              textShadow: isSpectator ? '0 0 30px rgba(0,240,255,.3)' : (iWon ? '0 0 30px rgba(51,255,136,.4)' : '0 0 30px rgba(255,51,102,.4)'),
            }}>
              {isSpectator ? `${result.winnerName} wins the round!` : (iWon ? 'ROUND WIN!' : 'ROUND LOSS')}
            </div>
            <div className="orbit-font" style={{ fontSize: 32, marginBottom: 8, color: 'var(--text)' }}>
              {result.setScore[0]} — {result.setScore[1]}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>Next round starting soon...</div>
            {renderSCEarned()}
          </div>
        </div>
      )}

      {/* Set complete overlay — fireworks + final score */}
      {result && !showFirstChoice && result.setOver && result.format > 1 && (
        <div className="modal-overlay set-complete-overlay" style={{ background: 'rgba(0,0,0,.8)' }}>
          <div className="set-fireworks">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="firework-particle" style={{
                '--fw-x': (Math.random() * 200 - 100) + 'px',
                '--fw-y': (Math.random() * -200 - 40) + 'px',
                '--fw-color': ['#ffd700','#ff3366','#33ff88','#44aaff','#ff8800','#cc44ff'][i % 6],
                '--fw-delay': (Math.random() * 2) + 's',
                '--fw-dur': (1 + Math.random()) + 's',
                left: (20 + Math.random() * 60) + '%',
                top: (30 + Math.random() * 30) + '%',
              }} />
            ))}
          </div>
          <div className="animate-in" style={{ textAlign: 'center', position: 'relative', zIndex: 2 }}>
            <div className="pixel-font" style={{
              fontSize: 40, marginBottom: 8,
              color: isSpectator ? '#ffd700' : (iWon ? '#ffd700' : 'var(--danger)'),
              textShadow: isSpectator ? '0 0 40px rgba(255,215,0,.6)' : (iWon ? '0 0 40px rgba(255,215,0,.6)' : '0 0 40px rgba(255,51,102,.5)'),
            }}>
              {isSpectator ? `🏆 ${result.winnerName} WINS! 🏆` : (iWon ? '🏆 SET VICTORY! 🏆' : 'SET DEFEAT')}
            </div>
            <div className="orbit-font" style={{ fontSize: 48, margin: '16px 0', color: 'var(--text)' }}>
              {result.setScore[0]} — {result.setScore[1]}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 4 }}>
              Best of {result.format}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>
              {result.reason === 'disconnect_timeout' ? `${result.loserName} timed out` :
               result.reason === 'surrender' ? `${result.loserName} surrendered` :
               result.reason === 'all_heroes_dead' ? `All of ${result.loserName}'s heroes defeated!` : ''}
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
            {renderSCEarned()}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              {isSpectator ? (
                <button className="btn btn-danger" style={{ padding: '12px 32px', fontSize: 14 }} onClick={handleLeave}>LEAVE</button>
              ) : !oppLeft && !oppDisconnected ? (
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

      {/* Win/Loss overlay — Bo1 or fallback */}
      {result && !showFirstChoice && (result.setOver || !result.format || result.format === 1) && !(result.format > 1) && (
        <div className="modal-overlay" style={{ background: 'rgba(0,0,0,.75)' }}>
          <div className="animate-in" style={{ textAlign: 'center' }}>
            <div className="pixel-font" style={{
              fontSize: 36, marginBottom: 16,
              color: isSpectator ? '#ffd700' : (iWon ? 'var(--success)' : 'var(--danger)'),
              textShadow: isSpectator ? '0 0 40px rgba(255,215,0,.5)' : (iWon ? '0 0 40px rgba(51,255,136,.5)' : '0 0 40px rgba(255,51,102,.5)'),
            }}>
              {isSpectator ? `🏆 ${result.winnerName} WINS!` : (iWon ? 'YOU WIN!' : 'YOU LOSE')}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8 }}>
              {isSpectator ? (
                result.reason === 'disconnect_timeout' ? `${result.loserName} timed out` :
                result.reason === 'surrender' ? `${result.loserName} surrendered` :
                result.reason === 'all_heroes_dead' ? `All of ${result.loserName}'s heroes defeated!` : ''
              ) : (
                result.reason === 'disconnect_timeout' ? 'Opponent timed out' :
                result.reason === 'opponent_left' ? 'Opponent left the game' :
                result.reason === 'surrender' ? (iWon ? 'Opponent surrendered' : 'You surrendered') :
                result.reason === 'all_heroes_dead' ? (iWon ? 'All enemy heroes defeated!' : 'All your heroes were defeated') : ''
              )}
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
            {renderSCEarned()}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              {isSpectator ? (
                <button className="btn btn-danger" style={{ padding: '12px 32px', fontSize: 14 }} onClick={handleLeave}>LEAVE</button>
              ) : !oppLeft && !oppDisconnected ? (
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
  const { user, setScreen, notify, setInBattle } = useContext(AppContext);
  const [decks, setDecks] = useState([]);
  const [sampleDecks, setSampleDecks] = useState([]);
  const [selectedDeck, setSelectedDeck] = useState('');
  const [rooms, setRooms] = useState([]);
  const [creating, setCreating] = useState(false);
  const [gameType, setGameType] = useState('unranked');
  const [gameFormat, setGameFormat] = useState(1);
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

  // Sync battle music state
  useEffect(() => {
    setInBattle(!!gameState);
    return () => setInBattle(false);
  }, [gameState, setInBattle]);

  // Load decks + sample decks
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
      try {
        const sd = await api('/sample-decks');
        if (sd.decks) setSampleDecks(sd.decks);
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

  const currentDeckObj = decks.find(d => d.id === selectedDeck) || sampleDecks.find(d => d.id === selectedDeck);

  const createGame = () => {
    if (!currentDeckObj) { notify('Select a deck first', 'error'); return; }
    const v = isDeckLegal(currentDeckObj);
    if (!v.legal) { notify('Deck not legal: ' + v.reasons.join(', '), 'error'); return; }
    socket.emit('create_room', { type: gameType, format: gameFormat, playerPw: playerPw || null, specPw: specPw || null, deckId: selectedDeck });
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
        <label style={{ fontSize: 12, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
          🃏 Deck:
          <select className="select" value={selectedDeck} onChange={e => setSelectedDeck(e.target.value)} style={{ fontSize: 12, minWidth: 180, padding: '4px 8px', borderColor: 'var(--accent)', color: 'var(--text)' }}>
            {decks.map(d => <option key={d.id} value={d.id}>{d.name} {isDeckLegal(d).legal ? '✓' : '✗'}{d.isDefault ? ' ★' : ''}</option>)}
            {sampleDecks.filter(d => isDeckLegal(d).legal).length > 0 && <option disabled>── Sample Decks ──</option>}
            {sampleDecks.filter(d => isDeckLegal(d).legal).map(d => <option key={d.id} value={d.id}>📋 {d.name}</option>)}
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
                  <div style={{ display: 'flex', gap: 4 }}>
                    {r.format > 1 && <span className="badge" style={{ background: 'rgba(255,255,255,.08)', color: 'var(--text2)' }}>Bo{r.format}</span>}
                    <span className="badge" style={{ background: r.type === 'ranked' ? 'rgba(255,170,0,.12)' : 'rgba(0,240,255,.12)', color: r.type === 'ranked' ? 'var(--accent4)' : 'var(--accent)' }}>
                      {r.type}
                    </span>
                  </div>
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
                  <div style={{ display: 'flex', gap: 4 }}>
                    {r.format > 1 && <span className="badge" style={{ background: 'rgba(255,255,255,.08)', color: 'var(--text2)' }}>Bo{r.format}</span>}
                    <span className="badge" style={{ background: 'rgba(255,0,170,.12)', color: 'var(--accent2)' }}>LIVE</span>
                  </div>
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
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Format</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className={'btn' + (gameFormat === 1 ? ' btn-format-active' : '')} onClick={() => setGameFormat(1)} style={{ flex: 1 }}>Bo1</button>
                  <button className={'btn' + (gameFormat === 3 ? ' btn-format-active' : '')} onClick={() => setGameFormat(3)} style={{ flex: 1 }}>Bo3</button>
                  <button className={'btn' + (gameFormat === 5 ? ' btn-format-active' : '')} onClick={() => setGameFormat(5)} style={{ flex: 1 }}>Bo5</button>
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
// ═══════════════════════════════════════════
//  MUSIC MANAGER
//  Plays bgm_menu on loop outside of battle,
//  bgm_battle on loop during battle.
//  Handles browser autoplay policy by unlocking
//  audio on first user interaction.
// ═══════════════════════════════════════════

const _bgmMenu = typeof Audio !== 'undefined' ? new Audio('/music/bgm_menu.mp3') : null;
const _bgmBattle = typeof Audio !== 'undefined' ? new Audio('/music/bgm_battle.mp3') : null;
if (_bgmMenu) { _bgmMenu.loop = true; _bgmMenu.volume = 0.4; }
if (_bgmBattle) { _bgmBattle.loop = true; _bgmBattle.volume = 0.4; }

function MusicManager({ inBattle }) {
  const unlocked = useRef(false);
  const currentTrack = useRef(null); // 'menu' | 'battle'

  const switchTrack = useCallback((target) => {
    if (currentTrack.current === target) return;
    const fadeOut = target === 'battle' ? _bgmMenu : _bgmBattle;
    const fadeIn = target === 'battle' ? _bgmBattle : _bgmMenu;
    if (!fadeIn) return;

    // Quick crossfade
    if (fadeOut && !fadeOut.paused) {
      const fo = fadeOut;
      const origVol = fo.volume;
      let step = 0;
      const fadeInterval = setInterval(() => {
        step++;
        fo.volume = Math.max(0, origVol * (1 - step / 8));
        if (step >= 8) { clearInterval(fadeInterval); fo.pause(); fo.volume = origVol; fo.currentTime = 0; }
      }, 40);
    }

    fadeIn.volume = 0;
    fadeIn.play().then(() => {
      let step = 0;
      const targetVol = 0.4;
      const fadeInterval = setInterval(() => {
        step++;
        fadeIn.volume = Math.min(targetVol, targetVol * (step / 8));
        if (step >= 8) clearInterval(fadeInterval);
      }, 40);
    }).catch(() => {}); // Autoplay blocked — will retry on interaction

    currentTrack.current = target;
  }, []);

  // Unlock audio on first user interaction
  useEffect(() => {
    if (unlocked.current) return;
    const unlock = () => {
      if (unlocked.current) return;
      unlocked.current = true;
      switchTrack(inBattle ? 'battle' : 'menu');
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('click', unlock, { once: false });
    window.addEventListener('keydown', unlock, { once: false });
    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [inBattle]);

  // Switch tracks when inBattle changes
  useEffect(() => {
    if (!unlocked.current) return;
    switchTrack(inBattle ? 'battle' : 'menu');
  }, [inBattle, switchTrack]);

  return null; // No visual output
}

function App() {
  const [user, setUser] = useState(null);
  const [screen, setScreen] = useState('menu');
  const [loading, setLoading] = useState(true);
  const [notif, setNotif] = useState(null);
  const [inBattle, setInBattle] = useState(false);

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

  const ctx = { user, setUser, screen, setScreen, notify, inBattle, setInBattle };

  return (
    <AppContext.Provider value={ctx}>
      <MusicManager inBattle={inBattle} />
      {notif && <Notification key={notif.id} message={notif.message} type={notif.type} onClose={() => setNotif(null)} />}
      {!user ? <AuthScreen /> :
        screen === 'menu' ? <MainMenu /> :
        screen === 'play' ? <PlayScreen /> :
        screen === 'deckbuilder' ? <DeckBuilder /> :
        screen === 'shop' ? <ShopScreen /> :
        screen === 'profile' ? <ProfileScreen /> :
        <MainMenu />}
    </AppContext.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
