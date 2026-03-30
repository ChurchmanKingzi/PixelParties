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
  if (section === 'main') {
    if (ct === 'Hero' || ct === 'Potion') return false;
    if ((deck.mainDeck || []).length >= 60) return false;
    if (ct !== 'Ability' && countInDeck(deck, cardName) >= 4) return false;
    return true;
  }
  if (section === 'potion') {
    if (ct !== 'Potion') return false;
    if ((deck.potionDeck || []).length >= 15) return false;
    if (countInDeck(deck, cardName) >= 2) return false;
    return true;
  }
  if (section === 'hero') {
    if (ct !== 'Hero') return false;
    if (!(deck.heroes || []).some(h => !h || !h.hero)) return false;
    // Heroes: max 1 copy total across all sections (hero slots + side deck)
    if (countInDeck(deck, cardName) >= 1) return false;
    return true;
  }
  if (section === 'side') {
    if ((deck.sideDeck || []).length >= 15) return false;
    if (ct === 'Ability') return true;
    const maxC = ct === 'Hero' ? 1 : ct === 'Potion' ? 2 : 4;
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
const TOOLTIP_W = 870;
let activeDragData = null; // module-level drag tracker for within-section reordering
let _persistedUnsaved = {}; // persists unsaved deck changes across screen switches
let _persistedSectionHist = {}; // persists per-section undo history across screen switches

// Compute negative animation-delay to sync all foil overlays to a common timeline
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

function foilSyncStyle() {
  const t = performance.now();
  return {
    '--foil-sync-s1': `${-(t % 1500)}ms`,
    '--foil-sync-s2': `${-(t % 1100)}ms`,
    '--foil-sync-s3': `${-(t % 1800)}ms`,
    '--foil-sync-s4': `${-(t % 900)}ms`,
    '--foil-sync-shimmer': `${-(t % 5000)}ms`,
  };
}

function FoilOverlay({ syncStyle }) {
  return (
    <div className="foil-shine-overlay" style={syncStyle}>
      <div className="foil-sweep-1" />
      <div className="foil-sweep-2" />
      <div className="foil-sweep-3" />
      <div className="foil-sweep-4" />
      <div className="foil-iridescent" />
      {SPARKLE_POSITIONS.map((sp, i) => (
        <div key={i} className="foil-sparkle"
          style={{
            left: sp.x + '%', top: sp.y + '%', color: sp.color,
            '--sp-dur': sp.dur + 's',
            '--sp-delay': `calc(${sp.delay}s + var(--foil-sync-s1, 0s))`,
          }} />
      ))}
    </div>
  );
}
function CardMini({ card, onClick, onRightClick, count, maxCount, dimmed, style, dragData }) {
  const [tt, setTT] = useState(null);
  const imgUrl = cardImageUrl(card.name);
  const isFoil = card.foil === 'secret_rare';
  const foilSync = useRef(isFoil ? foilSyncStyle() : null);
  const show = (e) => {
    const goLeft = e.clientX > window.innerWidth / 2;
    const tx = goLeft
      ? Math.max(4, e.clientX - TOOLTIP_W - 80)
      : Math.min(e.clientX + 80, window.innerWidth - TOOLTIP_W - 10);
    setTT({ x: tx, y: Math.max(8, Math.min(e.clientY - 220, window.innerHeight - 460)) });
  };
  const hide = () => setTT(null);
  const onDragStart = (e) => {
    if (dragData) {
      e.dataTransfer.setData('application/json', JSON.stringify(dragData));
      e.dataTransfer.effectAllowed = 'move';
      activeDragData = dragData;
    } else e.preventDefault();
    setTT(null);
  };
  const onDragEnd = () => { activeDragData = null; };
  return (
    <>
      <div className={'card-mini ' + typeClass(card.cardType) + (dimmed ? ' dimmed' : '') + (isFoil ? ' foil-secret-rare' : '')}
        style={style}
        draggable={!!dragData}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onClick={onClick}
        onContextMenu={(e) => { e.preventDefault(); onRightClick && onRightClick(); }}
        onMouseEnter={show} onMouseLeave={hide} onMouseMove={show}>
        {isFoil && <FoilOverlay syncStyle={foilSync.current} />}
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
        <div className="tooltip" style={{ left: tt.x, top: tt.y, width: TOOLTIP_W, display: 'flex', gap: 18 }}>
          {imgUrl && (
            <div style={{ position: 'relative', flexShrink: 0, width: 280, height: 392 }}>
              <img src={imgUrl} alt="" style={{ width: 280, height: 392, objectFit: 'cover', border: isFoil ? '2px solid rgba(255,215,0,.5)' : '1px solid var(--bg4)' }} />
              {isFoil && <FoilOverlay syncStyle={foilSync.current} />}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, marginBottom: 8, color: typeColor(card.cardType), fontSize: 26 }}>{card.name}</div>
            <div style={{ fontSize: 20, color: 'var(--text2)', marginBottom: 10 }}>
              {card.cardType}{card.subtype ? ' · ' + card.subtype : ''}{card.archetype ? ' · ' + card.archetype : ''}
            </div>
            {card.level != null && <div style={{ fontSize: 22 }}>Level: {card.level}</div>}
            <div style={{ display: 'flex', gap: 16, fontSize: 22, marginBottom: 10 }}>
              {card.hp != null && <span>HP: {card.hp}</span>}
              {card.atk != null && <span>ATK: {card.atk}</span>}
              {card.cost != null && <span>Cost: {card.cost}</span>}
            </div>
            {(card.spellSchool1 || card.spellSchool2) &&
              <div style={{ fontSize: 20, color: '#aa88ff', marginBottom: 6 }}>Schools: {[card.spellSchool1, card.spellSchool2].filter(Boolean).join(', ')}</div>}
            {(card.startingAbility1 || card.startingAbility2) &&
              <div style={{ fontSize: 20, color: '#ffcc44', marginBottom: 6 }}>Abilities: {[card.startingAbility1, card.startingAbility2].filter(Boolean).join(', ')}</div>}
            {card.effect &&
              <div style={{ fontSize: 20, marginTop: 8, lineHeight: 1.45, maxHeight: 260, overflow: 'auto', whiteSpace: 'pre-wrap' }}>{card.effect}</div>}
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
function ProfileScreen() {
  const { user, setUser, setScreen, notify } = useContext(AppContext);
  const [color, setColor] = useState(user.color || '#00f0ff');
  const [avatar, setAvatar] = useState(user.avatar);
  const [cardback, setCardback] = useState(user.cardback);

  const handleAvatar = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const fd = new FormData(); fd.append('avatar', file);
    try {
      const res = await fetch('/api/profile/avatar', {
        method: 'POST', body: fd,
        headers: AUTH_TOKEN ? { 'x-auth-token': AUTH_TOKEN } : {}
      });
      const data = await res.json();
      if (data.avatar) { setAvatar(data.avatar); notify('Avatar uploaded!', 'success'); }
    } catch (e) { notify(e.message, 'error'); }
  };

  const handleCardback = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (ev) => {
      img.onload = async () => {
        const ratio = img.width / img.height;
        const target = 750 / 1050;
        if (Math.abs(ratio - target) > 0.02) {
          notify('Cardback must have a 750×1050 ratio!', 'error');
          return;
        }
        const fd = new FormData(); fd.append('cardback', file);
        try {
          const res = await fetch('/api/profile/cardback', {
            method: 'POST', body: fd,
            headers: AUTH_TOKEN ? { 'x-auth-token': AUTH_TOKEN } : {}
          });
          const data = await res.json();
          if (data.cardback) { setCardback(data.cardback); notify('Cardback uploaded!', 'success'); }
        } catch (err) { notify(err.message, 'error'); }
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    try {
      const data = await api('/profile', { method: 'PUT', body: JSON.stringify({ color, avatar, cardback }) });
      setUser(data.user);
      notify('Profile saved!', 'success');
    } catch (e) { notify(e.message, 'error'); }
  };

  return (
    <div className="screen-full">
      <div className="top-bar">
        <button className="btn" style={{ padding: '4px 12px', fontSize: 10 }} onClick={() => setScreen('menu')}>← BACK</button>
        <h2 className="orbit-font" style={{ fontSize: 16, color: 'var(--accent)' }}>PLAYER PROFILE</h2>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="animate-in">
        <div className="panel" style={{ width: 500, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
            <div>
              <div style={{ width: 100, height: 100, border: '2px solid var(--bg4)', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 8 }}>
                {avatar ? <img src={avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 40 }}>👤</span>}
              </div>
              <label className="btn" style={{ padding: '4px 8px', fontSize: 9, display: 'block', textAlign: 'center', cursor: 'pointer' }}>
                UPLOAD<input type="file" accept="image/*" onChange={handleAvatar} style={{ display: 'none' }} />
              </label>
            </div>
            <div style={{ flex: 1 }}>
              <div className="orbit-font" style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>USERNAME</div>
              <div className="orbit-font" style={{ fontSize: 22, fontWeight: 700, color }}>{user.username}</div>
              <div style={{ marginTop: 12 }}>
                <span className="badge" style={{ background: 'rgba(170,255,0,.12)', color: 'var(--accent3)', fontSize: 14, padding: '4px 10px' }}>ELO {user.elo}</span>
              </div>
            </div>
          </div>
          <div>
            <div className="orbit-font" style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>NAME COLOR</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: 40, height: 30, border: 'none', cursor: 'pointer', background: 'none' }} />
              <span style={{ color, fontWeight: 700 }}>{user.username}</span>
            </div>
          </div>
          <div>
            <div className="orbit-font" style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 4 }}>CARD BACK</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
              <div style={{ width: 75, height: 105, border: '2px solid var(--bg4)', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {cardback ? <img src={cardback} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 10, color: 'var(--text2)' }}>Default</span>}
              </div>
              <div>
                <label className="btn" style={{ padding: '4px 8px', fontSize: 9, cursor: 'pointer' }}>
                  UPLOAD (750×1050)<input type="file" accept="image/*" onChange={handleCardback} style={{ display: 'none' }} />
                </label>
                {cardback && <button className="btn btn-danger" style={{ padding: '4px 8px', fontSize: 9, marginLeft: 8 }} onClick={() => setCardback(null)}>REMOVE</button>}
              </div>
            </div>
          </div>
          <button className="btn btn-success btn-big" onClick={save}>SAVE PROFILE</button>
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
function DropSection({ sectionId, onDrop, children, className, style }) {
  const [over, setOver] = useState(false);
  return (
    <div className={(className || '') + (over ? ' drop-target' : '')}
      style={style}
      onDragOver={(e) => {
        // Only show drop target for cross-section or database drops
        if (activeDragData && activeDragData.fromSection !== sectionId) {
          e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false);
        try { const d = JSON.parse(e.dataTransfer.getData('application/json')); onDrop(d); } catch {} }}>
      {children}
    </div>
  );
}

// Wrapper for cards inside deck sections — enables within-section reordering via drag
function DeckCardSlot({ section, index, onReorder, children }) {
  const [dropSide, setDropSide] = useState(null);
  return (
    <div style={{ position: 'relative' }}
      onDragOver={(e) => {
        if (!activeDragData || activeDragData.fromSection !== section) return;
        if (activeDragData.fromIndex === index) return;
        e.preventDefault(); e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        setDropSide(e.clientX < rect.left + rect.width / 2 ? 'left' : 'right');
      }}
      onDragLeave={() => setDropSide(null)}
      onDrop={(e) => {
        e.preventDefault(); e.stopPropagation(); setDropSide(null);
        if (!activeDragData || activeDragData.fromSection !== section) return;
        const targetIdx = dropSide === 'left' ? index : index + 1;
        onReorder(activeDragData.fromIndex, targetIdx);
      }}>
      {dropSide === 'left' && <div style={{ position:'absolute', left:-2, top:0, bottom:0, width:3, background:'var(--accent3)', zIndex:5 }} />}
      {dropSide === 'right' && <div style={{ position:'absolute', right:-2, top:0, bottom:0, width:3, background:'var(--accent3)', zIndex:5 }} />}
      {children}
    </div>
  );
}

// Hero slot wrapper — enables hero swapping via drag
function HeroSlot({ slotIndex, onSwap, children }) {
  const [over, setOver] = useState(false);
  return (
    <div style={{ position: 'relative' }}
      onDragOver={(e) => {
        if (!activeDragData || activeDragData.fromSection !== 'hero') return;
        if (activeDragData.fromIndex === slotIndex) return;
        e.preventDefault(); e.stopPropagation(); setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault(); e.stopPropagation(); setOver(false);
        if (!activeDragData || activeDragData.fromSection !== 'hero') return;
        onSwap(activeDragData.fromIndex, slotIndex);
      }}>
      {over && <div style={{ position:'absolute', inset:0, border:'2px solid var(--accent3)', zIndex:5, pointerEvents:'none' }} />}
      {children}
    </div>
  );
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
  const handleDrop = useCallback((targetSection, dragData) => {
    if (!dragData || !dragData.cardName || !currentDeck) return;
    const { cardName, fromSection, fromIndex } = dragData;
    if (fromSection === targetSection) return;
    if (!fromSection) { addCardTo(cardName, targetSection); return; }
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
    if (!canAddCard(tempDeck, cardName, targetSection)) return;
    const card = CARDS_BY_NAME[cardName];
    if (targetSection === 'main') tempDeck.mainDeck.push(cardName);
    else if (targetSection === 'potion') tempDeck.potionDeck.push(cardName);
    else if (targetSection === 'side') tempDeck.sideDeck.push(cardName);
    else if (targetSection === 'hero') {
      const es = tempDeck.heroes.findIndex(h => !h || !h.hero);
      if (es < 0) return;
      tempDeck.heroes[es] = { hero: cardName, ability1: card?.startingAbility1 || null, ability2: card?.startingAbility2 || null };
    }
    // Push to both sections' histories
    const changes = {};
    if (fromSection === 'main' || targetSection === 'main') changes.main = tempDeck.mainDeck;
    if (fromSection === 'heroes' || targetSection === 'heroes' || fromSection === 'hero' || targetSection === 'hero') changes.heroes = tempDeck.heroes;
    if (fromSection === 'potion' || targetSection === 'potion') changes.potion = tempDeck.potionDeck;
    if (fromSection === 'side' || targetSection === 'side') changes.side = tempDeck.sideDeck;
    updateSections(changes);
  }, [currentDeck, addCardTo, updateSections]);

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
            <DropSection sectionId="hero" onDrop={(d) => handleDrop('hero', d)} className="deck-section">
              <SecHeader sec="heroes" color="#bb77ff" icon="👑" label="HEROES" count={heroes.filter(h=>h&&h.hero).length} max={3} />
              <div className="deck-section-body" style={{ display: 'flex', flexWrap: 'nowrap', justifyContent: 'space-evenly', gap: 40, padding: 12 }}>
                {heroes.map((h, i) => (
                  <HeroSlot key={i} slotIndex={i} onSwap={swapHeroes}>
                    <div style={{ display: 'flex', flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                      {/* Hero card first (166×230) */}
                      {h && h.hero && CARDS_BY_NAME[h.hero] ? (
                        <div style={{ position: 'relative' }}>
                          <CardMini card={CARDS_BY_NAME[h.hero]}
                            onClick={() => {}} onRightClick={() => removeFrom(h.hero, 'hero')}
                            dragData={{ cardName: h.hero, fromSection: 'hero', fromIndex: i }}
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
                ))}
              </div>
            </DropSection>

            {/* ── MAIN DECK ── */}
            <DropSection sectionId="main" onDrop={(d) => handleDrop('main', d)} className="deck-section">
              <SecHeader sec="main" color="#44aaff" icon="📋" label="MAIN DECK" count={(currentDeck?.mainDeck||[]).length} max={60}
                extra={<><TipBtn tip="Shuffle" className="btn" style={{ padding:'2px 6px', fontSize:8 }} onClick={shuffleMain}>🔀</TipBtn><TipBtn tip="Sort" className="btn" style={{ padding:'2px 6px', fontSize:8 }} onClick={() => sortSec('main')}>↕</TipBtn></>} />
              <div className="deck-section-body">
                {(currentDeck?.mainDeck || []).length === 0 && <div className="deck-empty-msg" style={{ color:'var(--text2)', fontSize:11, padding:10, textAlign:'center' }}>Right-click cards in the database to add. Left-click for options.</div>}
                {(currentDeck?.mainDeck || []).map((name, idx) => {
                  const card = CARDS_BY_NAME[name]; if (!card) return null;
                  return <DeckCardSlot key={'m-'+idx} section="main" index={idx} onReorder={(from,to) => reorderInSection('main',from,to)}>
                    <CardMini card={card} onClick={() => {}} onRightClick={() => removeFrom(name,'main',idx)} dragData={{ cardName:name, fromSection:'main', fromIndex:idx }} />
                  </DeckCardSlot>;
                })}
              </div>
            </DropSection>

            {/* ── POTION DECK ── */}
            <DropSection sectionId="potion" onDrop={(d) => handleDrop('potion', d)} className="deck-section">
              <SecHeader sec="potion" color="#c8a060" icon="🧪" label="POTION DECK" count={(currentDeck?.potionDeck||[]).length} max={15} note="(0 or 5–15)"
                extra={<TipBtn tip="Sort" className="btn" style={{ padding:'2px 6px', fontSize:8 }} onClick={() => sortSec('potion')}>↕</TipBtn>} />
              <div className="deck-section-body">
                {(currentDeck?.potionDeck || []).length === 0 && <div className="deck-empty-msg" style={{ color:'var(--text2)', fontSize:11, padding:10, textAlign:'center' }}>Empty — add 0 or 5–15 Potion cards</div>}
                {(currentDeck?.potionDeck || []).map((name, idx) => {
                  const card = CARDS_BY_NAME[name]; if (!card) return null;
                  return <DeckCardSlot key={'p-'+idx} section="potion" index={idx} onReorder={(from,to) => reorderInSection('potion',from,to)}>
                    <CardMini card={card} onClick={() => {}} onRightClick={() => removeFrom(name,'potion',idx)} dragData={{ cardName:name, fromSection:'potion', fromIndex:idx }} />
                  </DeckCardSlot>;
                })}
              </div>
            </DropSection>

            {/* ── SIDE DECK ── */}
            <DropSection sectionId="side" onDrop={(d) => handleDrop('side', d)} className="deck-section">
              <SecHeader sec="side" color="#888" icon="📦" label="SIDE DECK" count={(currentDeck?.sideDeck||[]).length} max={15}
                extra={<TipBtn tip="Sort" className="btn" style={{ padding:'2px 6px', fontSize:8 }} onClick={() => sortSec('side')}>↕</TipBtn>} />
              <div className="deck-section-body">
                {(currentDeck?.sideDeck || []).length === 0 && <div className="deck-empty-msg" style={{ color:'var(--text2)', fontSize:11, padding:10, textAlign:'center' }}>Empty — up to 15 cards of any type</div>}
                {(currentDeck?.sideDeck || []).map((name, idx) => {
                  const card = CARDS_BY_NAME[name]; if (!card) return null;
                  return <DeckCardSlot key={'s-'+idx} section="side" index={idx} onReorder={(from,to) => reorderInSection('side',from,to)}>
                    <CardMini card={card} onClick={() => {}} onRightClick={() => removeFrom(name,'side',idx)} dragData={{ cardName:name, fromSection:'side', fromIndex:idx }} />
                  </DeckCardSlot>;
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
                    dragData={{ cardName: card.name, fromSection: null }}
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
    const onRoomClosed = () => { setLobby(null); notify('Room was closed by host', 'error'); };
    const onJoinError = (msg) => notify(msg, 'error');
    const onPlayerJoined = (data) => setPlayerJoined(data.username);
    const onGameStarted = (r) => { setLobby(r); notify('Game started! (Gameplay not yet implemented)', 'success'); };

    socket.on('rooms', onRooms);
    socket.on('room_joined', onRoomJoined);
    socket.on('room_update', onRoomUpdate);
    socket.on('room_closed', onRoomClosed);
    socket.on('join_error', onJoinError);
    socket.on('player_joined', onPlayerJoined);
    socket.on('game_started', onGameStarted);

    const poll = setInterval(() => socket.emit('get_rooms'), 4000);

    return () => {
      socket.off('rooms', onRooms);
      socket.off('room_joined', onRoomJoined);
      socket.off('room_update', onRoomUpdate);
      socket.off('room_closed', onRoomClosed);
      socket.off('join_error', onJoinError);
      socket.off('player_joined', onPlayerJoined);
      socket.off('game_started', onGameStarted);
      clearInterval(poll);
    };
  }, []);

  const currentDeckObj = decks.find(d => d.id === selectedDeck);

  const createGame = () => {
    if (!currentDeckObj) { notify('Select a deck first', 'error'); return; }
    const v = isDeckLegal(currentDeckObj);
    if (!v.legal) { notify('Deck not legal: ' + v.reasons.join(', '), 'error'); return; }
    socket.emit('create_room', { type: gameType, playerPw: playerPw || null, specPw: specPw || null });
    setCreating(false);
    setPlayerPw(''); setSpecPw('');
  };

  const joinRoom = (room, asSpectator, pw) => {
    if (!asSpectator) {
      if (!currentDeckObj) { notify('Select a deck first', 'error'); return; }
      const v = isDeckLegal(currentDeckObj);
      if (!v.legal) { notify('Deck not legal: ' + v.reasons.join(', '), 'error'); return; }
    }
    // Check if password needed
    if (!asSpectator && room.hasPlayerPw && !pw) { setJoinTarget({ room, asSpectator: false }); return; }
    if (asSpectator && room.hasSpecPw && !pw) { setJoinTarget({ room, asSpectator: true }); return; }
    socket.emit('join_room', { roomId: room.id, password: pw || '', asSpectator });
    setJoinTarget(null); setJoinPw('');
  };

  const leaveRoom = () => {
    if (!lobby) return;
    socket.emit('leave_room', { roomId: lobby.id });
    setLobby(null);
  };

  // === LOBBY VIEW ===
  if (lobby) {
    const isHost = lobby.isHost;
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
          AUTH_TOKEN = document.cookie.replace(/(?:(?:^|.*;\s*)pp_token\s*=\s*([^;]*).*$)|^.*$/, '$1') || null;
          socket.emit('auth', AUTH_TOKEN);
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  // Sync accent color to user's profile color
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', user && user.color ? user.color : '#00f0ff');
  }, [user?.color]);

  // Escape key → return to main menu from any sub-screen
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && user && screen !== 'menu') {
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
