/* ============================================================
   PIXEL PARTIES TCG — Frontend Application
   ============================================================ */
const { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, createContext, useContext } = React;

// ===== TOUCH DETECTION =====
window._isTouchDevice = false;
window.addEventListener('touchstart', function onFirstTouch() {
  window._isTouchDevice = true;
  window.removeEventListener('touchstart', onFirstTouch);
  // Auto-request fullscreen on mobile landscape
  if (window.innerWidth > window.innerHeight && document.documentElement.requestFullscreen) {
    try { document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {}); } catch {}
  }
}, { passive: true });

// Re-request fullscreen when rotating to landscape (if previously granted)
window.addEventListener('orientationchange', () => {
  if (!window._isTouchDevice) return;
  setTimeout(() => {
    if (window.innerWidth > window.innerHeight && !document.fullscreenElement && document.documentElement.requestFullscreen) {
      try { document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {}); } catch {}
    }
  }, 300);
});

// ===== MOBILE LONG-PRESS TOOLTIP SYSTEM =====
// Long-press (≥400ms) = show card tooltip, release = dismiss
// Quick tap = normal action (play card, open menu, etc.)
window._tapTooltipCard = null;
window._tapTooltipSetters = new Set();
window._longPressTimer = null;
window._longPressFired = false;
const LONG_PRESS_MS = 400;
window.LONG_PRESS_MS = LONG_PRESS_MS;

function setTapTooltip(cardName) {
  window._tapTooltipCard = cardName;
  window._tapTooltipSetters.forEach(fn => fn(cardName));
}
function clearTapTooltip() { setTapTooltip(null); }

// Dismiss tooltip on any touch end (after long-press)
document.addEventListener('touchend', () => {
  clearTimeout(window._longPressTimer);
  if (window._longPressFired) {
    // Small delay so the tooltip is visible before dismissing
    setTimeout(clearTapTooltip, 50);
    window._longPressFired = false;
  }
}, { passive: true });
document.addEventListener('touchmove', () => {
  // Cancel long-press if finger moves
  clearTimeout(window._longPressTimer);
}, { passive: true });
// ===== UNIFIED POINTER HELPERS (mouse + touch) =====
// Extracts {x,y} from any mouse or touch event.
function getPointerXY(e) {
  if (e.touches && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  if (e.changedTouches && e.changedTouches.length > 0) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  return { x: e.clientX, y: e.clientY };
}
window.getPointerXY = getPointerXY;

// ── CAPTURE-PHASE TOUCH PREVENTION ──
// This listener fires BEFORE React's event delegation and before the browser's
// compositor decides to scroll. Without this, React's delegated onTouchStart
// calls preventDefault() too late — the browser has already claimed the touch
// for native scrolling, which kills subsequent touchmove events.
// Elements with [data-touch-drag] opt in to this early prevention.
document.addEventListener('touchstart', function(e) {
  const drag = e.target.closest('[data-touch-drag]');
  if (drag && e.cancelable) {
    e.preventDefault();
  }
}, { capture: true, passive: false });

// Registers move+up listeners for BOTH mouse and touch, returns a cleanup function.
// onMove(x, y, rawEvent), onUp(x, y, rawEvent)
function addDragListeners(onMove, onUp) {
  const handleMouseMove = (e) => onMove(e.clientX, e.clientY, e);
  const handleMouseUp = (e) => { cleanup(); onUp(e.clientX, e.clientY, e); };
  const handleTouchMove = (e) => {
    if (e.cancelable) e.preventDefault(); // prevent scroll while dragging
    const t = e.touches[0];
    if (t) onMove(t.clientX, t.clientY, e);
  };
  const handleTouchEnd = (e) => {
    cleanup();
    const t = e.changedTouches[0];
    if (t) onUp(t.clientX, t.clientY, e);
    else onUp(0, 0, e);
  };
  const handleTouchCancel = (e) => { cleanup(); onUp(0, 0, e); };
  function cleanup() {
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
    window.removeEventListener('touchmove', handleTouchMove);
    window.removeEventListener('touchend', handleTouchEnd);
    window.removeEventListener('touchcancel', handleTouchCancel);
  }
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
  window.addEventListener('touchmove', handleTouchMove, { passive: false });
  window.addEventListener('touchend', handleTouchEnd);
  window.addEventListener('touchcancel', handleTouchCancel);
  return cleanup;
}
window.addDragListeners = addDragListeners;

// ===== API HELPER =====
window.AUTH_TOKEN = null;

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (window.AUTH_TOKEN) headers['x-auth-token'] = window.AUTH_TOKEN;
  const res = await fetch('/api' + path, { ...opts, headers: { ...headers, ...opts.headers } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ===== SOCKET =====
const socket = io();
function emitSocket(event, data) { socket.emit(event, data); }

// Handle session superseded by another tab
socket.on('superseded', ({ reason }) => {
  document.body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#1a1a2e;color:#fff;font-family:sans-serif;text-align:center;padding:20px"><div><h2 style="color:#ff6644">⚠️ Session Taken Over</h2><p style="color:#aaa;max-width:400px">${reason || 'This session was opened in another tab.'}</p><button onclick="location.reload()" style="margin-top:16px;padding:10px 24px;background:#4488ff;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:16px">Reload</button></div></div>`;
});

// ===== CARD DB =====
window.ALL_CARDS = [];          // every card from cards.json (for rule lookups)
window.CARDS_BY_NAME = {};      // name → card object (full DB, needed for deck validation)
window.AVAILABLE_CARDS = [];    // only cards with images in ./cards (shown in browser)
window.AVAILABLE_MAP = {};      // card name → image filename
window.CARD_TYPES = [];
window.SUBTYPES = [];
window.SPELL_SCHOOLS = [];
window.STARTING_ABILITIES = [];
window.ARCHETYPES = [];
window.SKINS_DB = {}; // cardName → [skinName, ...]

// ═══════════════════════════════════════════
//  HAND-LIMIT MODIFIER REGISTRY
//  Source of truth for any frontend code that needs to compute "how
//  many cards can this player have in hand given their current board".
//  The battle engine derives this from CardInstance counters directly
//  (cards/effects/_engine.js — handLimitReduction on support cards,
//  _shouldBypassHandLimit for bypasses). In the puzzle builder and
//  any other pre-battle UI, we don't have instances yet — just card
//  names on zones — so we mirror the engine's rules here.
//
//  Entry shape: { zone, delta, bypass? }
//    zone:   'support' | 'area'  — where the card lives
//    delta:  number that SHRINKS the hand cap per copy (positive = smaller
//            hand; negative = larger hand). Mirrors the engine's
//            handLimitReduction counter semantics exactly.
//    bypass: optional (state, side) → bool. If any entry on this player's
//            side returns true, the cap is lifted entirely. Used by Big
//            Gwen which requires at least one Pollution Token to activate.
//
//  When adding a future card that modifies the hand cap, add its entry
//  here and its effect module — keep them in sync.
// ═══════════════════════════════════════════
window.CARD_HAND_LIMIT_MODIFIERS = {
  'Pollution Token': { zone: 'support', delta: 1 },
  'Royal Corgi':     { zone: 'support', delta: -3 },
  'The Great Clock Tower "Big Gwen"': {
    zone: 'area',
    delta: 0,
    // Big Gwen lifts the cap only while the owner controls at least one
    // Pollution Token on their support zones.
    bypass: (sideState) => {
      const zones = sideState?.supportZones || [];
      for (const heroSlot of zones) {
        for (const zone of (heroSlot || [])) {
          if ((zone || []).includes('Pollution Token')) return true;
        }
      }
      return false;
    },
  },
};

/**
 * Compute a player's effective max hand size from their board state.
 * Pre-battle equivalent of _engine.js enforceHandLimit — no instance
 * state (no statuses), so every card contributes its delta unconditionally
 * IF its attached hero slot is filled.
 *
 * @param {object} sideState - { heroes, supportZones }
 * @param {string[]} areaZone - array of Area card names on this side
 * @returns {number} effective max hand size (≥ 1)
 */
window.computeSupportHandLimit = function (sideState, areaZone) {
  const supportZones = sideState?.supportZones || [];
  const heroes = sideState?.heroes || [];

  // Bypass check (Big Gwen, future cards). Any `true` wins.
  for (const cardName of (areaZone || [])) {
    const entry = window.CARD_HAND_LIMIT_MODIFIERS[cardName];
    if (!entry || entry.zone !== 'area') continue;
    if (typeof entry.bypass === 'function' && entry.bypass(sideState)) {
      return Infinity; // No cap while bypass is active
    }
  }

  // Puzzle-builder convenience: while the side has ZERO Pollution Tokens on
  // its board, hand size is uncapped. The cap only matters as a constraint
  // the builder has to work around once Pollution starts accumulating, so
  // leaving it at 7 while there's no pollution in play is just noise.
  let pollutionCount = 0;
  for (let hi = 0; hi < supportZones.length; hi++) {
    if (!heroes[hi]) continue;
    const heroZones = supportZones[hi] || [];
    for (const zone of heroZones) {
      for (const cardName of (zone || [])) {
        if (cardName === 'Pollution Token') pollutionCount++;
      }
    }
  }
  if (pollutionCount === 0) return Infinity;

  let cap = 7;
  for (let hi = 0; hi < supportZones.length; hi++) {
    // Skip zones attached to an empty hero slot — those cards wouldn't
    // fire hooks (engine's isCardEffectActive returns false).
    if (!heroes[hi]) continue;
    const heroZones = supportZones[hi] || [];
    for (const zone of heroZones) {
      for (const cardName of (zone || [])) {
        const entry = window.CARD_HAND_LIMIT_MODIFIERS[cardName];
        if (entry && entry.zone === 'support') cap -= entry.delta;
      }
    }
  }
  return Math.max(1, cap);
};

async function loadCardDB() {
  // Load full card database (needed for rule lookups on existing decks)
  const res = await fetch('/data/cards.json');
  const cards = await res.json();
  // Mutate in-place so destructured references from other files stay valid
  window.ALL_CARDS.length = 0;
  window.ALL_CARDS.push(...cards.sort((a, b) => a.name.localeCompare(b.name)));
  for (const k of Object.keys(window.CARDS_BY_NAME)) delete window.CARDS_BY_NAME[k];
  window.ALL_CARDS.forEach(c => { window.CARDS_BY_NAME[c.name] = c; });

  // Load available cards (only those with images in ./cards)
  try {
    const avRes = await fetch('/api/cards/available');
    const avData = await avRes.json();
    for (const k of Object.keys(window.AVAILABLE_MAP)) delete window.AVAILABLE_MAP[k];
    Object.assign(window.AVAILABLE_MAP, avData.available || {});
  } catch {
    for (const k of Object.keys(window.AVAILABLE_MAP)) delete window.AVAILABLE_MAP[k];
  }

  // Filter to only available cards; build filter dropdowns from this subset
  const avSet = new Set(Object.keys(window.AVAILABLE_MAP));
  window.AVAILABLE_CARDS.length = 0;
  window.AVAILABLE_CARDS.push(...window.ALL_CARDS.filter(c => avSet.has(c.name)));

  const typesSet = new Set(), subSet = new Set(), ssSet = new Set(), saSet = new Set(), arSet = new Set();
  window.AVAILABLE_CARDS.forEach(c => {
    typesSet.add(c.cardType);
    if (c.subtype) subSet.add(c.subtype);
    if (c.spellSchool1) ssSet.add(c.spellSchool1);
    if (c.spellSchool2) ssSet.add(c.spellSchool2);
    if (c.startingAbility1) saSet.add(c.startingAbility1);
    if (c.startingAbility2) saSet.add(c.startingAbility2);
    if (c.archetype) arSet.add(c.archetype);
  });
  window.CARD_TYPES.length = 0; window.CARD_TYPES.push(...[...typesSet].sort());
  window.SUBTYPES.length = 0; window.SUBTYPES.push(...[...subSet].sort());
  window.SPELL_SCHOOLS.length = 0; window.SPELL_SCHOOLS.push(...[...ssSet].sort());
  window.STARTING_ABILITIES.length = 0; window.STARTING_ABILITIES.push(...[...saSet].sort());
  window.ARCHETYPES.length = 0; window.ARCHETYPES.push(...[...arSet].sort());

  // Load skins registry
  try {
    const skRes = await fetch('/api/skins');
    const skData = await skRes.json();
    for (const k of Object.keys(window.SKINS_DB)) delete window.SKINS_DB[k];
    Object.assign(window.SKINS_DB, skData.skins || {});
  } catch {
    for (const k of Object.keys(window.SKINS_DB)) delete window.SKINS_DB[k];
  }
}

function cardImageUrl(cardName, skinOverrides) {
  // If a skin is selected for this card, use the skin image
  if (skinOverrides && skinOverrides[cardName]) {
    return '/cards/skins/' + encodeURIComponent(skinOverrides[cardName]) + '.png';
  }
  const file = window.AVAILABLE_MAP[cardName];
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
  const mainPotions = (deck.mainDeck || []).filter(n => window.CARDS_BY_NAME[n]?.cardType === 'Potion');
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
  const card = window.CARDS_BY_NAME[cardName];
  if (!card) return false;
  const ct = card.cardType;
  // Token cards cannot be added to any deck
  if (ct === 'Token') return false;
  // Per-card copy limit (e.g. Performance has maxCopies: 4 despite being an Ability)
  const cardMax = card.maxCopies;
  if (section === 'main') {
    if (ct === 'Hero') return false;
    // Potions allowed in main deck ONLY if Nicolas is a hero
    if (ct === 'Potion') {
      if (!hasNicolasHero(deck)) return false;
      if ((deck.mainDeck || []).length >= 60) return false;
      // Total potions across main + potion deck cannot exceed 15
      const totalPotions = (deck.mainDeck || []).filter(n => window.CARDS_BY_NAME[n]?.cardType === 'Potion').length
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
    const ca = window.CARDS_BY_NAME[a], cb = window.CARDS_BY_NAME[b];
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
window.activeDragData = null; // shared drag tracker (cross-file)

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

  // Use shared board tooltip if available (game context), otherwise inline tooltip
  const useSharedTooltip = !!window._boardTooltipSetter;

  // Sync with global tap-tooltip state (dismiss when another card is tapped)
  useEffect(() => {
    if (!window._isTouchDevice) return;
    const sync = (activeCard) => {
      if (activeCard !== card.name) {
        setTT(false);
      }
    };
    window._tapTooltipSetters.add(sync);
    return () => window._tapTooltipSetters.delete(sync);
  }, [card.name]);

  const show = (e) => {
    if (window.activeDragData || window.deckDragState) return;
    if (useSharedTooltip) {
      window._boardTooltipSetter(card);
    } else {
      setTT(true);
    }
  };
  const hide = () => {
    if (useSharedTooltip) {
      window._boardTooltipSetter(null);
    } else {
      setTT(false);
    }
  };
  // Touch: long-press to show tooltip, quick tap for action
  const handleClick = (e) => {
    if (window._isTouchDevice && window._longPressFired) {
      // Long-press just ended — don't fire click action
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onClick && onClick(e);
  };
  const handleTouchStart = (e) => {
    if (!window._isTouchDevice) return;
    window._longPressFired = false;
    window._longPressTimer = setTimeout(() => {
      window._longPressFired = true;
      setTapTooltip(card.name);
      if (useSharedTooltip) window._boardTooltipSetter(card); else setTT(true);
    }, LONG_PRESS_MS);
  };
  const onDragStart = (e) => {
    if (dragData) {
      e.dataTransfer.setData('application/json', JSON.stringify(dragData));
      e.dataTransfer.effectAllowed = 'move';
      window.activeDragData = dragData;
    } else e.preventDefault();
    setTT(false);
  };
  const onDragEnd = () => { window.activeDragData = null; };
  const ttBorderColor = foilType === 'diamond_rare' ? '2px solid rgba(120,200,255,.6)' : foilType === 'secret_rare' ? '2px solid rgba(255,215,0,.5)' : '1px solid var(--bg4)';
  return (
    <>
      <div className={'card-mini ' + typeClass(card.cardType) + (dimmed ? ' dimmed' : '') + (foilClass ? ' ' + foilClass : '') + (isCover ? ' card-mini-cover' : '')}
        style={style}
        draggable={!!dragData}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
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
      {tt && !useSharedTooltip && (
        <div className={'tooltip card-tooltip' + (inGallery ? ' card-tooltip-gallery' : '')} style={{
          right: inGallery ? GALLERY_W : 0, top: TOP_BAR_H, width: GALLERY_W,
          height: 'calc(100vh - ' + TOP_BAR_H + 'px)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {imgUrl && (
            <div className="card-tooltip-img" style={{ position: 'relative', width: '100%', flexShrink: 0 }}>
              <img src={imgUrl} alt="" style={{
                width: '100%', aspectRatio: '750/1050', objectFit: 'cover', display: 'block',
                border: ttBorderColor
              }} />
              {isFoil && <FoilOverlay bands={foilBands} shimmerOffset={foilMeta.current.shimmerOffset} sparkleDelays={foilMeta.current.sparkleDelays} foilType={foilType} />}
            </div>
          )}
          <div className="card-tooltip-info" style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
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

// ═══════════════════════════════════════════
//  VOLUME CONTROL
// ═══════════════════════════════════════════
function VolumeControl() {
  const [open, setOpen] = useState(false);
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('pp_volume');
    return saved != null ? parseFloat(saved) : 0.4;
  });
  const [muted, setMuted] = useState(() => localStorage.getItem('pp_muted') === '1');
  const ref = useRef(null);

  // Apply volume changes to music
  useEffect(() => {
    localStorage.setItem('pp_volume', volume);
    localStorage.setItem('pp_muted', muted ? '1' : '0');
    if (window._ppSetMusicVolume) window._ppSetMusicVolume(muted ? 0 : volume);
  }, [volume, muted]);

  // Expose initial state on mount for MusicManager
  useEffect(() => {
    window._ppGetVolume = () => muted ? 0 : volume;
  }, [volume, muted]);

  // Close slider when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const icon = muted || volume === 0 ? '🔇' : volume < 0.25 ? '🔈' : volume < 0.6 ? '🔉' : '🔊';

  return (
    <div className="volume-control" ref={ref}>
      <button className="volume-btn"
        onClick={() => setOpen(o => !o)}
        onContextMenu={(e) => { e.preventDefault(); setMuted(m => !m); }}>
        {icon}
      </button>
      {open && (
        <div className="volume-slider-popup">
          <input type="range" min="0" max="1" step="0.01" value={muted ? 0 : volume}
            className="volume-slider"
            onChange={e => { setVolume(parseFloat(e.target.value)); if (muted) setMuted(false); }} />
        </div>
      )}
    </div>
  );
}

// ===== CROSS-FILE EXPORTS =====
window.api = api;
window.emitSocket = emitSocket;
window.socket = socket;
window.loadCardDB = loadCardDB;
window.cardImageUrl = cardImageUrl;
window.skinImageUrl = skinImageUrl;
window.isDeckLegal = isDeckLegal;
window.countInDeck = countInDeck;
window.hasNicolasHero = hasNicolasHero;
window.canAddCard = canAddCard;

/**
 * Check if a card's TYPE is compatible with a deck section.
 * Only checks type rules (Hero→hero, Potion→potion/main-with-Nicolas, Token→nowhere).
 * Does NOT check copy limits, deck size, or other quantity constraints.
 * Used by both the deck builder and side-deck phase for rule validation.
 * When adding new card effects that modify deckbuilding rules, update THIS function
 * AND the server-side mirror: canCardTypeEnterPool() in server.js.
 */
function canCardTypeEnterSection(deck, cardName, section) {
  const card = window.CARDS_BY_NAME[cardName];
  if (!card) return false;
  const ct = card.cardType;
  if (ct === 'Token') return false;
  if (section === 'main') {
    if (ct === 'Hero') return false;
    if (ct === 'Potion') return hasNicolasHero(deck);
    return true;
  }
  if (section === 'potion') {
    return ct === 'Potion';
  }
  if (section === 'hero') {
    return ct === 'Hero';
  }
  if (section === 'side') {
    return true; // Any non-token card can be in side deck
  }
  return false;
}
// ═══════════════════════════════════════════
//  SHARED GAME TOOLTIP + STATUS BADGES + BUFFS
//  Centralized system for hover tooltips on
//  status badges and buff icons. Used by board,
//  puzzle creator, and any future screen.
// ═══════════════════════════════════════════

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

function StatusBadges({ statuses, counters, buffs, isHero, player, cardName }) {
  const badges = [];
  const s = statuses || {};
  const c = counters || {};
  // Buffs live on the hero/creature separately from statuses/counters. For
  // creatures they're also nested under counters.buffs, so fall back there.
  const b = buffs || c.buffs || {};
  const dur = (statusData) => {
    if (!statusData || typeof statusData !== 'object') return ' Wears off at the end of its owner\'s turn.';
    if (statusData.duration != null && statusData.duration > 1) return ` Lasts for ${statusData.duration} of its owner's turns.`;
    return ' Wears off at the end of its owner\'s turn.';
  };
  const durStart = (statusData) => ' Wears off at the start of its owner\'s turn.';
  if (s.frozen || c.frozen) {
    const fr = s.frozen || c.frozen;
    const remaining = (fr && typeof fr === 'object' && fr.duration != null) ? fr.duration : null;
    badges.push({
      key: 'frozen', icon: '❄️',
      tooltip: 'Frozen: Cannot act and has its effects and Abilities negated.' + (isHero ? ' Cannot be equipped with Artifacts.' : '') + dur(fr),
      duration: remaining,
    });
  }
  if (s.stunned || c.stunned) {
    // Medusa's Curse stuns are paired with the medusa_petrified buff, which
    // drops all incoming damage to 0 — surface that directly on the stun
    // badge so the player can see "this stun is the damage-immune variant"
    // without having to read the buff column.
    if (b.medusa_petrified) {
      badges.push({
        key: 'stunned', icon: '🗿',
        tooltip: "Stunned (Petrified): Cannot act and has its effects and Abilities negated. Takes 0 damage from all sources. (Medusa's Curse)",
      });
    } else {
      badges.push({ key: 'stunned', icon: '⚡', tooltip: 'Stunned: Cannot act and has its effects and Abilities negated.' + dur(s.stunned || c.stunned) });
    }
  }
  if (c._baihuStunned) badges.push({ key: 'petrified', icon: '🪨', tooltip: `Petrified: Stunned and immune to all damage. Lasts for ${c._baihuStunned.duration || 1} of its owner's turns.` });
  if (s.burned || c.burned) badges.push({ key: 'burned', icon: '🔥', tooltip: 'Burned: Takes 60 damage at the start of each of its owner\'s turns.' });
  if (s.poisoned || c.poisoned) {
    const stacks = s.poisoned?.stacks || c.poisonStacks || c.poisoned || 1;
    const perStack = player?.poisonDamagePerStack || 30;
    const isUnhealable = s.poisoned?.unhealable || c.poisonedUnhealable;
    badges.push({ key: 'poisoned', icon: isUnhealable ? '💀' : '☠️', tooltip: `${isUnhealable ? 'Unhealable ' : ''}Poisoned: Takes ${perStack * stacks} damage at the start of each of its owner's turns.${isUnhealable ? ' Cannot be removed.' : ''}`, className: isUnhealable ? 'status-unhealable' : '' });
  }
  if (s.negated || c.negated) badges.push({ key: 'negated', icon: '🚫', tooltip: (isHero ? 'Negated: Has its effects and Abilities negated.' : 'Negated: Has its effects negated.') + dur(s.negated || c.negated) });
  if (s.nulled || c.nulled) badges.push({ key: 'nulled', icon: '🔇', tooltip: (isHero ? 'Nulled: Cannot cast Spells.' : 'Nulled: Has its effects negated.') + dur(s.nulled || c.nulled) });
  if (s.immune) badges.push({ key: 'immune', icon: '🛡️', tooltip: 'Immune: Cannot be affected by Crowd Control effects.' + durStart(s.immune) });
  if (s.shielded) badges.push({ key: 'shielded', icon: '✨', tooltip: 'Shielded: Cannot be affected by anything during its first turn.' + durStart(s.shielded) });
  if (s.untargetable) badges.push({ key: 'untargetable', icon: '🦋', tooltip: 'Untargetable: Cannot be chosen by the opponent with Attacks, Spells or Creature effects while other Heroes can be chosen.' });
  if (s.healReversed) badges.push({ key: 'healReversed', icon: '💀', tooltip: 'Overheal Shock: Takes any healing as damage.' });
  if (s.charmed) badges.push({ key: 'charmed', icon: '💘', tooltip: 'Charmed: Under opponent control and immune to all effects.' });
  if (badges.length === 0) return null;
  // Keep the big board-card tooltip up while hovering a status badge. Badges
  // are positioned just outside the card's bounds (left: -2px), so moving
  // onto one normally fires the card's mouseLeave and hides the preview.
  // Re-asserting the tooltip here, plus clearing it on badge leave, keeps
  // the two tooltips (status-description and card-preview) in sync.
  const tooltipCard = cardName && window.CARDS_BY_NAME ? window.CARDS_BY_NAME[cardName] : null;
  const showBoardTip = () => { if (tooltipCard) window._boardTooltipSetter?.(tooltipCard); };
  const hideBoardTip = () => { if (tooltipCard) window._boardTooltipSetter?.(null); };
  return (
    <div className="status-badges-row">
      {badges.map(b => (
        <div key={b.key} className={'status-badge' + (b.className ? ' ' + b.className : '')}
          onMouseEnter={e => { showGameTooltip(e, b.tooltip); showBoardTip(); }}
          onMouseLeave={() => { hideGameTooltip(); hideBoardTip(); }}>
          {b.icon}
          {b.duration != null && <span className="status-badge-duration">{b.duration}</span>}
        </div>
      ))}
    </div>
  );
}

function BuffColumn({ buffs, cardName }) {
  if (!buffs || Object.keys(buffs).length === 0) return null;
  const BUFF_ICONS = { cloudy: { icon: '☁️', tooltip: 'Takes half damage from all sources!' }, dark_gear_negated: { icon: '⚙️', tooltip: 'Effects negated by Dark Gear!' }, diplomacy_negated: { icon: '🕊️', tooltip: 'Effects negated due to Diplomacy!' }, necromancy_negated: { icon: '💀', tooltip: 'Effects negated due to Necromancy!' }, freeze_immune: { icon: '🔥', tooltip: 'Cannot be Frozen!' }, immortal: { icon: '✨', tooltip: 'Cannot have its HP dropped below 1.' }, combo_locked: { icon: '🔒', tooltip: 'Cannot perform Actions this turn.' }, submerged: { icon: '🌊', tooltip: 'Unaffected by all cards and effects while other possible targets exist!' }, negative_status_immune: { icon: '😎', tooltip: 'Immune to all negative status effects!' }, charmed: { icon: '💕', tooltip: 'Charmed! Under opponent control and immune to all effects.' }, golden_wings: { icon: '🪽', tooltip: 'Golden Wings: Fully immune to opponent effects until end of this turn.' }, anti_magic_enchanted: { icon: '🛡️', tooltip: 'Anti Magic Enchantment: Once per turn, the controlling player may negate a Spell that hits this Artifact\'s equipped Hero.' } };
  // medusa_petrified is surfaced through the Stunned status badge (as the
  // "Petrified" variant), so don't also render it as a separate buff icon —
  // that would double-represent the same effect. null_zone_negated is the
  // expiry-timer buff paired with the 'nulled' status badge (same reason).
  const BUFF_HIDDEN = new Set(['medusa_petrified', 'null_zone_negated']);
  // Same tooltip-bridge pattern as StatusBadges: buff icons are absolute-
  // positioned relative to the card and the cursor moving onto one fires
  // the card's mouseLeave, hiding the big preview. Re-assert the preview
  // on buff-icon hover so both tooltips (buff description + card preview)
  // stay in sync. The `.buff-icon:hover` entry in useCardTooltip's
  // hoverSelectors keeps the 300ms safety-sweep from wiping it back out.
  const tooltipCard = cardName && window.CARDS_BY_NAME ? window.CARDS_BY_NAME[cardName] : null;
  const showBoardTip = () => { if (tooltipCard) window._boardTooltipSetter?.(tooltipCard); };
  const hideBoardTip = () => { if (tooltipCard) window._boardTooltipSetter?.(null); };
  return (
    <div className="buff-column">
      {Object.entries(buffs).filter(([key]) => !BUFF_HIDDEN.has(key)).map(([key]) => {
        const def = BUFF_ICONS[key] || { icon: '✦', tooltip: key };
        return (
          <div key={key} className="buff-icon"
            onMouseEnter={e => { showGameTooltip(e, def.tooltip); showBoardTip(); }}
            onMouseLeave={() => { hideGameTooltip(); hideBoardTip(); }}>
            {def.icon}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════
//  SHARED CARD TOOLTIP SYSTEM
//  Reusable across board, deckbuilder, puzzle
//  creator, and any future interface.
//
//  CardTooltipContent — renders card image + info (no positioning).
//  useCardTooltip    — hook that manages tooltip state and wires
//                      window._boardTooltipSetter so BoardCard /
//                      CardMini components trigger it automatically.
// ═══════════════════════════════════════════

/**
 * Pure rendering component for card tooltip content.
 * Displays card image (with foil overlay), name, type, effect, stats,
 * starting abilities, and spell schools.
 * Pass extra context-specific info via `children`.
 */
function CardTooltipContent({ card, children }) {
  if (!card) return null;
  const imgUrl = cardImageUrl(card.name);
  const foilType = card.foil || null;
  const isFoil = foilType === 'secret_rare' || foilType === 'diamond_rare';
  return (
    <>
      {imgUrl && (
        <div style={{ position: 'relative', width: '100%', flexShrink: 0 }}>
          <img src={imgUrl} style={{
            width: '100%', aspectRatio: '750/1050', objectFit: 'cover', display: 'block',
            border: foilType === 'diamond_rare' ? '2px solid rgba(120,200,255,.6)'
                 : foilType === 'secret_rare' ? '2px solid rgba(255,215,0,.5)' : 'none'
          }} />
          {isFoil && <FoilOverlay bands={[]} shimmerOffset="0ms" sparkleDelays={[]} foilType={foilType} />}
        </div>
      )}
      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontWeight: 700, fontSize: 18, color: typeColor(card.cardType), marginBottom: 5 }}>{card.name}</div>
        <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 8 }}>
          {card.cardType}{card.subtype ? ' · ' + card.subtype : ''}{card.archetype ? ' · ' + card.archetype : ''}
        </div>
        {card.effect && <div style={{ fontSize: 14, marginTop: 4, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{card.effect}</div>}
        <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 8, display: 'flex', gap: 12 }}>
          {card.hp != null && <span style={{ color: '#ff6666' }}>♥ HP {card.hp}</span>}
          {card.atk != null && <span style={{ color: '#ffaa44' }}>⚔ ATK {card.atk}</span>}
          {card.cost != null && <span style={{ color: '#44aaff' }}>◆ Cost {card.cost}</span>}
          {card.level != null && <span>Lv{card.level}</span>}
        </div>
        {(card.startingAbility1 || card.startingAbility2) &&
          <div style={{ fontSize: 14, color: '#ffcc44', marginTop: 6 }}>Abilities: {[card.startingAbility1, card.startingAbility2].filter(Boolean).join(', ')}</div>}
        {(card.spellSchool1 || card.spellSchool2) &&
          <div style={{ fontSize: 14, color: '#aa88ff', marginTop: 4 }}>Schools: {[card.spellSchool1, card.spellSchool2].filter(Boolean).join(', ')}</div>}
        {children}
      </div>
    </>
  );
}

/**
 * Hook for managing card tooltip state.
 * Wires window._boardTooltipSetter so BoardCard and CardMini
 * components can trigger tooltips automatically via hover/touch.
 *
 * Options:
 *   defaultSide      — 'left' | 'right' (default: 'right')
 *   hoverSelectors   — CSS selector string for safety-clear check
 *
 * Returns: { tooltipCard, tooltipSide, showTooltip, hideTooltip, setTooltipCard, setTooltipSide }
 */
function useCardTooltip(opts) {
  const defaultSide = (opts && opts.defaultSide) || 'right';
  // Include .status-badge:hover and .buff-icon:hover so the 300ms safety-
  // clear below doesn't wipe the card preview while the cursor is over a
  // status badge or buff icon (both hang off the card's bounds and aren't
  // .board-card elements themselves).
  const hoverSelectors = (opts && opts.hoverSelectors) || '.board-card:hover, .card-mini:hover, .pz-search-card:hover, .pz-hand-card:hover, .status-badge:hover, .buff-icon:hover';
  const [tooltipCard, setTooltipCard] = useState(null);
  const [tooltipSide, setTooltipSide] = useState(defaultSide);

  // Wire global setter so BoardCard / CardMini components trigger this tooltip
  useEffect(() => {
    window._boardTooltipSetter = (card) => {
      setTooltipCard(card || null);
      if (card) setTooltipSide(defaultSide); // BoardCard hover → always use defaultSide
    };
    return () => { window._boardTooltipSetter = null; };
  }, [defaultSide]);

  // Touch: sync with global tap-tooltip state
  useEffect(() => {
    if (!window._isTouchDevice) return;
    const sync = (activeCard) => { if (!activeCard) setTooltipCard(null); };
    if (window._tapTooltipSetters) window._tapTooltipSetters.add(sync);
    return () => { if (window._tapTooltipSetters) window._tapTooltipSetters.delete(sync); };
  }, []);

  // Safety: clear tooltip when the hover source element disappears
  useEffect(() => {
    if (!tooltipCard || window._isTouchDevice) return;
    const check = () => {
      if (!document.querySelector(hoverSelectors)) setTooltipCard(null);
    };
    const id = setInterval(check, 300);
    return () => clearInterval(id);
  }, [tooltipCard, hoverSelectors]);

  const showTooltip = useCallback((card, side) => {
    setTooltipCard(card || null);
    if (side) setTooltipSide(side);
  }, []);
  const hideTooltip = useCallback(() => setTooltipCard(null), []);

  return { tooltipCard, tooltipSide, setTooltipSide, showTooltip, hideTooltip, setTooltipCard };
}

// ═══════════════════════════════════════════════════════════════
//  TEXTBOX — Generic dialogue box with typewriter effect
//  Supports **bold** and *italic* markdown in text.
//  Usage: showTextBox({ speaker: '/MoniaBot.png', speakerName: 'Monia Bot', text: 'Hello!', onDismiss: () => {} })
//         showTextBox(null)  to hide
// ═══════════════════════════════════════════════════════════════

// Parse inline **bold**, *italic*, and {color:text} into segments
function parseInlineMarkdown(raw) {
  const segments = [];
  let i = 0;
  let bold = false, italic = false, color = null;
  let buf = '';
  const flush = () => { if (buf) { segments.push({ text: buf, bold, italic, color }); buf = ''; } };
  while (i < raw.length) {
    if (raw[i] === '{' && !color) {
      const close = raw.indexOf(':', i + 1);
      if (close > i + 1) {
        flush();
        color = raw.slice(i + 1, close);
        i = close + 1;
        continue;
      }
    }
    if (raw[i] === '}' && color) {
      flush(); color = null; i++; continue;
    }
    if (raw[i] === '*' && raw[i + 1] === '*') {
      flush(); bold = !bold; i += 2;
    } else if (raw[i] === '*') {
      flush(); italic = !italic; i += 1;
    } else {
      buf += raw[i]; i++;
    }
  }
  flush();
  const plainText = segments.map(s => s.text).join('');
  return { segments, plainText };
}

// Render segments up to charCount visible characters
function renderMarkdownSlice(segments, charCount) {
  const els = [];
  let remaining = charCount;
  for (let i = 0; i < segments.length && remaining > 0; i++) {
    const seg = segments[i];
    const slice = seg.text.slice(0, remaining);
    remaining -= slice.length;
    const style = seg.color ? { color: seg.color } : undefined;
    let el;
    if (seg.bold && seg.italic) el = <strong key={i} style={style}><em>{slice}</em></strong>;
    else if (seg.bold) el = <strong key={i} style={style}>{slice}</strong>;
    else if (seg.italic) el = <em key={i} style={style}>{slice}</em>;
    else if (style) el = <span key={i} style={style}>{slice}</span>;
    else el = <span key={i}>{slice}</span>;
    els.push(el);
  }
  return els;
}

// Wrap each character in a shake span for erratic text animation
function applyShake(node, counterRef) {
  if (!counterRef) counterRef = { i: 0 };
  if (typeof node === 'string') {
    return [...node].map((ch) => {
      const ci = counterRef.i++;
      if (ch === '\n') return React.createElement('br', { key: ci });
      return React.createElement('span', { key: ci, className: 'textbox-shake-char', style: { animationDelay: (ci * 0.073 % 0.4) + 's' } }, ch);
    });
  }
  if (Array.isArray(node)) {
    return node.map((child) => applyShake(child, counterRef));
  }
  if (React.isValidElement(node)) {
    const newChildren = applyShake(node.props.children, counterRef);
    return React.cloneElement(node, { key: node.key }, newChildren);
  }
  return node;
}

let _textBoxSetter = null;

function showTextBox(opts) {
  if (_textBoxSetter) _textBoxSetter(opts || null);
}

function TextBox() {
  const [opts, setOpts] = useState(null);
  const [pages, setPages] = useState([]);
  const [pageIdx, setPageIdx] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [done, setDone] = useState(false);
  const [highlightRects, setHighlightRects] = useState([]);
  const [rightVisible, setRightVisible] = useState(false);
  const [rightExiting, setRightExiting] = useState(false);
  const [fading, setFading] = useState(false);
  const timerRef = useRef(null);
  const parsedRef = useRef({ segments: [], plainText: '' });
  const bodyRef = useRef(null);
  const onShowFiredRef = useRef(new Set());

  useEffect(() => { _textBoxSetter = setOpts; return () => { _textBoxSetter = null; }; }, []);

  const splitSentences = useCallback((text) => {
    const parts = [];
    const re = /[^.!?]*[.!?]+[\s]?|[^.!?]+$/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      if (m[0].trim()) parts.push(m[0]);
    }
    return parts.length ? parts : [text];
  }, []);

  useLayoutEffect(() => {
    if (!opts) { setPages([]); setPageIdx(0); setCharCount(0); setDone(false); setHighlightRects([]); setRightVisible(false); setRightExiting(false); setFading(false); onShowFiredRef.current = new Set(); return; }

    if (opts.pages && Array.isArray(opts.pages)) {
      setPages(opts.pages);
      setPageIdx(0);
      onShowFiredRef.current = new Set();
      return;
    }

    const text = (opts.text || '').trim();
    if (!text) { setPages([]); return; }
    const body = bodyRef.current;
    if (!body) { setPages([{ text }]); return; }
    const measure = document.createElement('span');
    measure.className = 'textbox-text';
    measure.style.cssText = 'visibility:hidden;pointer-events:none;';
    body.appendChild(measure);
    const maxH = body.clientHeight;
    const paragraphs = text.split('\n').map(p => p.trim()).filter(Boolean);
    const result = [];
    for (const para of paragraphs) {
      const sentences = splitSentences(para);
      let current = '';
      for (let i = 0; i < sentences.length; i++) {
        const candidate = current ? current + sentences[i] : sentences[i];
        measure.textContent = candidate.replace(/\*+/g, '').replace(/\{[^:}]+:/g, '').replace(/\}/g, '');
        if (measure.scrollHeight > maxH && current) {
          result.push({ text: current.trim() });
          current = sentences[i];
        } else {
          current = candidate;
        }
      }
      if (current.trim()) result.push({ text: current.trim() });
    }
    body.removeChild(measure);
    setPages(result.length ? result : [{ text }]);
    setPageIdx(0);
    onShowFiredRef.current = new Set();
  }, [opts, splitSentences]);

  // Start typewriter + handle per-page events
  useEffect(() => {
    clearInterval(timerRef.current);
    if (!pages.length) { setCharCount(0); setDone(false); return; }
    const page = pages[pageIdx];
    const raw = (typeof page === 'string' ? page : page?.text) || '';
    const parsed = parseInlineMarkdown(raw);
    parsedRef.current = parsed;
    setCharCount(0);
    setDone(false);

    // Per-page events
    if (page?.enterRight) setRightVisible(true);
    if (page?.onShow && !onShowFiredRef.current.has(pageIdx)) {
      onShowFiredRef.current.add(pageIdx);
      page.onShow();
    }

    let i = 0;
    const len = parsed.plainText.length;
    const speed = (opts && opts.speed) || 25;
    timerRef.current = setInterval(() => {
      i++;
      if (i >= len) { setCharCount(len); setDone(true); clearInterval(timerRef.current); }
      else setCharCount(i);
    }, speed);
    return () => clearInterval(timerRef.current);
  }, [pages, pageIdx]);

  // Highlights
  useEffect(() => {
    if (!pages.length) { setHighlightRects([]); return; }
    const page = pages[pageIdx];
    const hl = page?.highlights;
    if (!hl || !hl.length) { setHighlightRects([]); return; }
    const rects = [];
    for (const h of hl) {
      const sel = typeof h === 'string' ? h : h.selector;
      const pulse = typeof h === 'object' && h.pulse;
      if (!sel) continue;
      document.querySelectorAll(sel).forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) rects.push({ rect: r, pulse, html: el.outerHTML });
      });
    }
    setHighlightRects(rects);
  }, [pages, pageIdx]);

  const handleAdvance = useCallback(() => {
    if (!opts || fading) return;
    if (!done) {
      clearInterval(timerRef.current);
      setCharCount(parsedRef.current.plainText.length);
      setDone(true);
    } else if (pageIdx < pages.length - 1) {
      const currentPage = pages[pageIdx];
      if (currentPage?.exitRight) { setRightExiting(true); setTimeout(() => { setRightVisible(false); setRightExiting(false); }, 600); }
      setPageIdx(pageIdx + 1);
    } else {
      const currentPage = pages[pageIdx];
      if (currentPage?.exitRight) { setRightExiting(true); setTimeout(() => { setRightVisible(false); setRightExiting(false); }, 600); }
      // Fade out then dismiss
      setFading(true);
      const cb = opts.onDismiss;
      setTimeout(() => {
        setOpts(null);
        setFading(false);
        if (cb) cb();
      }, 1200);
    }
  }, [opts, done, pageIdx, pages, fading]);

  const handleBack = useCallback((e) => {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    if (pageIdx > 0) {
      clearInterval(timerRef.current);
      setPageIdx(pageIdx - 1);
    }
  }, [pageIdx]);

  useEffect(() => {
    if (!opts) return;
    const onKey = (e) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); handleAdvance(); }
      else if ((e.key === 'ArrowLeft' || e.key === 'Backspace') && pageIdx > 0) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); handleBack(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [opts, handleAdvance, handleBack, pageIdx]);

  useEffect(() => {
    if (!opts) return;
    const onClick = (e) => {
      if (e.target.closest('.textbox-back')) return;
      handleAdvance();
    };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('touchstart', onClick, { passive: true });
    return () => { window.removeEventListener('mousedown', onClick); window.removeEventListener('touchstart', onClick); };
  }, [opts, handleAdvance]);

  if (!opts) return null;

  const isLastPage = pageIdx >= pages.length - 1;
  const page = pages[pageIdx];
  const activeSide = page?.side || 'left';
  const leftName = (activeSide === 'left' && page?.speakerName) ? page.speakerName : opts.speakerName;
  const leftNameColor = activeSide === 'left' && page?.nameColor ? page.nameColor : undefined;
  const rightName = (activeSide === 'right' && page?.speakerName) ? page.speakerName : opts.rightSpeakerName;
  const rightNameColor = activeSide === 'right' && page?.nameColor ? page.nameColor : undefined;
  const hasRight = opts.rightSpeaker && rightVisible;

  return (
    <div className={'textbox-overlay' + (fading ? ' textbox-fading' : '')}>
      {highlightRects.map((h, i) => (
        <div key={i} className={'textbox-highlight' + (h.pulse ? ' textbox-highlight-pulse' : '')} style={{
          position: 'fixed',
          left: h.rect.left, top: h.rect.top,
          width: h.rect.width, height: h.rect.height,
          pointerEvents: 'none',
        }}>
          <div className="textbox-highlight-clone" dangerouslySetInnerHTML={{ __html: h.html }} />
        </div>
      ))}
      <div className="textbox">
        {opts.speaker && (
          <div className={'textbox-portrait' + (hasRight && activeSide !== 'left' ? ' textbox-portrait-inactive' : '')}>
            <div className="textbox-portrait-frame">
              <img src={opts.speaker} alt={opts.speakerName || ''} draggable={false} />
              {[...Array(8)].map((_, i) => <span key={i} className="textbox-sparkle" style={{ animationDelay: (i * 0.35) + 's', top: [10,60,5,50,30,65,15,45][i] + '%', left: [5,70,55,10,80,35,90,60][i] + '%' }} />)}
            </div>
            {leftName && <span className="textbox-speaker-name" style={leftNameColor ? { color: leftNameColor } : undefined}>{leftName}</span>}
          </div>
        )}
        <div className="textbox-body" ref={bodyRef}>
          <span className="textbox-text">{(() => { const els = renderMarkdownSlice(parsedRef.current.segments, charCount); return page?.shakeText ? applyShake(els) : els; })()}</span>
          {done && <span className="textbox-advance">{isLastPage ? '▼' : '▶'}</span>}
          {pages.length > 1 && (
            <div className="textbox-footer">
              {pageIdx > 0 && <span className="textbox-back" onClick={handleBack}>◀</span>}
              <span className="textbox-page-indicator">{pageIdx + 1}/{pages.length}</span>
            </div>
          )}
        </div>
        {opts.rightSpeaker && rightVisible && (
          <div className={'textbox-portrait textbox-portrait-right' + (activeSide !== 'right' ? ' textbox-portrait-inactive' : '') + (rightExiting ? ' textbox-portrait-exit' : '')}>
            <div className="textbox-portrait-frame">
              <img src={opts.rightSpeaker} alt={opts.rightSpeakerName || ''} draggable={false} />
              {[...Array(8)].map((_, i) => <span key={i} className="textbox-sparkle" style={{ animationDelay: (i * 0.25 + 0.1) + 's', top: [15,55,8,48,35,62,20,42][i] + '%', left: [8,65,50,15,75,30,85,55][i] + '%' }} />)}
            </div>
            {rightName && <span className="textbox-speaker-name" style={rightNameColor ? { color: rightNameColor } : undefined}>{rightName}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  TUTORIAL SCRIPTS — Intro/outro dialogue for each tutorial stage
//  Keyed by tutorial number (1, 2, 3...)
// ═══════════════════════════════════════════════════════════════
const TUTORIAL_SCRIPTS = {
  1: {
    intro: [
      { text: 'Heya! Welcome to the battlefield!' },
      { text: "To win a game of Pixel Parties, you must defeat all your opponent's Heroes by dropping their HP to 0!",
        highlights: ['[data-hero-owner="opp"][data-hero-name="Beato, the Butterfly Witch"]'] },
      { text: 'To do that, you can use {red:**Attacks**} or {red:**Spells**} to deal direct damage with your own Heroes, or summon {red:**Creatures**} to do the job for you.',
        highlights: ['.game-hand-me [data-card-name="Magic Hammer"]'] },
      { text: "Let's try hitting the opponent's {purple:*Beato*} with your big, strong {red:*Magic Hammer*} Spell!",
        highlights: [
          { selector: '[data-hero-owner="opp"][data-hero-name="Beato, the Butterfly Witch"]', pulse: true },
          { selector: '.game-hand-me [data-card-name="Magic Hammer"]', pulse: true },
        ] },
      { text: "But ... your {red:*Ida*} currently can't use that Spell.",
        highlights: ['[data-hero-owner="me"][data-hero-name="Ida, the Adept of Destruction"]'] },
      { text: "Its level is too high for her!" },
      { text: 'To use an Attack or Spell or summon a Creature with a Hero, it needs the correct {#88ccee:**Ability**} at an appropriate level first.' },
      { text: 'For Magic Hammer, that Ability is {#88ccee:**Destruction Magic**}, which Ida currently has 2 copies of attached to her.',
        highlights: [
          '[data-ability-owner="me"][data-card-name="Destruction Magic"]',
        ] },
      { text: "So her Destruction Magic is at {red:**level 2**}. But Magic Hammer is a {red:**level 3**} Spell! Ida needs one more Destruction Magic!" },
      { text: 'Attach it to her from your hand, then go into the Action Phase to actually cast your Spell with her and defeat Beato!',
        highlights: [
          '[data-hero-owner="me"][data-hero-name="Ida, the Adept of Destruction"]',
          '.game-hand-me .hand-slot',
          '[data-phase-name="Action Phase"]',
        ] },
    ],
    outro: [
      { text: 'Excellent job, beep-boop!' },
      { text: 'To use Attacks or Spells or summon Creatures, you need to spend {red:**Actions**}.' },
      { text: 'That is done during the {red:**Action Phase**} - but you only get one Action per Action Phase, so use it wisely!' },
    ],
  },
  2: {
    intro: [
      { text: 'Heya!' },
      { text: "In a real game, just defeating one Hero won't be enough - there's three of them for you to get rid of!" },
      { text: "Doing so with a single Spell will be very difficult, but {green:**Creatures**} can be used to deal lots of damage to multiple targets!" },
      { text: "Here, the {green:**Cosmic Skeletons**} can each deal 150 damage to a target.",
        highlights: [
          { selector: '[data-support-owner="me"][data-card-name="Cosmic Skeleton"]', pulse: true },
        ] },
      { text: "Let's go send them onto the enemy Heroes and turn them into burnt spots on the ground, beep-boop!" },
      { text: 'To activate a Creature\'s active effect, just click on it during either {red:**Main Phase**}!',
        highlights: [
          '[data-phase-name="Main Phase 1"]',
          '[data-phase-name="Main Phase 2"]',
        ] },
    ],
    outro: [
      { text: "Cool!" },
      { text: "The big upside of Creatures is that they can use their active effects every single turn." },
      { text: "So if you didn't win already - next turn, there'd be even more pain and lasers in your opponent's future!" },
      { text: "But the big downside is that Creatures cannot use their active effects the turn that they are summoned." },
      { text: "These Cosmic Skeletons already survived from a previous turn - you'll have to find ways to keep yours alive!" },
    ],
  },
  3: {
    opts: { rightSpeaker: '/Antonia.png', rightSpeakerName: 'Antonia' },
    intro: [
      { text: 'Heya, welcome back to the battlefield!' },
      { text: "{green:**Creatures**} are great for spreading damage, but there's more efficient ways to deal with a single strong target!",
        highlights: [
          { selector: '[data-hero-owner="opp"][data-hero-name*="Fiona"]', pulse: true },
        ] },
      { text: 'Just look at -', enterRight: true },
      { text: 'Khekhekhe! You want da damage?', side: 'right', speakerName: 'Jetpack Raccoon', nameColor: '#ff4444', shakeText: true },
      { text: 'I got da damages for ya!', side: 'right', speakerName: 'Jetpack Raccoon', nameColor: '#ff4444', shakeText: true },
      { text: "Listen, kiddo! Da real **big** damages aren't done with Blah-Blah-Spells or Who-Cares-Creatures!", side: 'right', speakerName: 'Jetpack Raccoon', nameColor: '#ff4444', shakeText: true },
      { text: "{red:**Attacks!**}\nDat's what it's all about, ya get me?!", side: 'right', speakerName: 'Jetpack Raccoon', nameColor: '#ff4444', shakeText: true },
      { text: "Can't go wrong with da BONK for **big** damages, right?", side: 'right', speakerName: 'Jetpack Raccoon', nameColor: '#ff4444', shakeText: true },
      { text: "Dere - I've done ya a little somethin' of a favor, ya see?", side: 'right', speakerName: 'Jetpack Raccoon', nameColor: '#ff4444', shakeText: true,
        onShow: () => {
          socket.emit('tutorial_modify', { type: 'tutorial3_boost' });
          const el = document.querySelector('[data-hero-owner="me"][data-hero-name*="Willy"]');
          if (el) { el.classList.add('tutorial-boost-anim'); setTimeout(() => el.classList.remove('tutorial-boost-anim'), 2500); }
        },
        highlights: [
          { selector: '[data-hero-owner="me"][data-hero-name*="Willy"]', pulse: true },
        ] },
      { text: "Attacks do harder BONKs when your Heroes got higher BONK stats, so dis lil' boost'll help you hit real hard!", side: 'right', speakerName: 'Jetpack Raccoon', nameColor: '#ff4444', shakeText: true,
        highlights: [
          { selector: '[data-hero-owner="me"][data-hero-name*="Willy"]', pulse: true },
          { selector: '[data-ability-owner="me"][data-card-name="Fighting"]', pulse: true },
        ] },
      { text: "Now use dat {red:**Attack**} in your hand to break some bones or somethin'!", side: 'right', speakerName: 'Jetpack Raccoon', nameColor: '#ff4444', shakeText: true,
        highlights: [
          '.game-hand-me .hand-slot',
        ] },
      { text: '...' },
      { text: "But that's not even...!" },
    ],
    outro: [
      { text: "Not bad, eh? Dat poor princess'll feel dat one for a while, khekhe...!", side: 'right', speakerName: 'Jetpack Raccoon', nameColor: '#ff4444', enterRight: true, shakeText: true },
      { text: "Or ... not feel it at all anymore, being *dead* an' all.", side: 'right', speakerName: 'Jetpack Raccoon', nameColor: '#ff4444', shakeText: true },
      { text: "Khekhekhekhe, you're fun to bozz around, Imma be back for ya later!", side: 'right', speakerName: 'Jetpack Raccoon', nameColor: '#ff4444', exitRight: true, shakeText: true },
      { text: '... you could have...', speakerName: 'Monia Bot', nameColor: 'silver' },
      { text: "... this wasn't even...!", speakerName: 'Monia Bot', nameColor: 'silver' },
      { text: '...', speakerName: 'Monia Bot', nameColor: 'silver' },
      { text: 'Okay. Attacks. Big strong. See you next lesson.', speakerName: 'Monia Bot', nameColor: 'silver' },
    ],
  },
  4: {
    intro: [
      { text: '...' },
      { text: '... is ... that raccoon gone?' },
      { text: '...' },
      { text: 'Good.' },
      { text: '...', speed: 80 },
      { text: 'Heya! Welcome back!' },
      { text: "What I was **trying** to say last time was that thing's interference wasn't even necessary.",
        onShow: () => { socket.emit('tutorial_modify', { type: 'tutorial4_suppress_reiza' }); } },
      { text: "There are a few status effects in this game that can help you win." },
      { text: "{#88ddff:**Freeze**} and {yellow:**Stun**} are the most common to stop your opponent." },
      { text: "But if one wears off naturally, its target becomes {silver:**immune**} to those effects for a turn!" },
      { text: "And {purple:**Poison**} and {orange:**Burn**} are used to weaken targets - or even finish them off!" },
      { text: "{orange:**Burn**} is {orange:**60**} damage a turn, {purple:**Poison**} {purple:**30**} ... but it {purple:**stacks**}!" },
      { text: "Your Hero {purple:**Medea**} even **doubles** any Poison damage dealt to your opponent!",
        highlights: [
          { selector: '[data-hero-owner="me"][data-hero-name*="Medea"]', pulse: true },
        ] },
      { text: "So! See your Hero {purple:**Reiza**}?",
        highlights: [
          { selector: '[data-hero-owner="me"][data-hero-name*="Reiza"]', pulse: true },
        ] },
      { text: "She Stuns AND Poisons anything she hits with an Attack!",
        highlights: [
          { selector: '[data-hero-owner="me"][data-hero-name*="Reiza"]', pulse: true },
        ] },
      { text: "And the cards in your hand? More than enough status damage to defeat all enemy Heroes!",
        highlights: [
          '.game-hand-me .hand-slot',
          '[data-hero-owner="opp"]',
        ] },
      { text: "And see that {silver:**Quick Attack**}? That thing can be used as an {red:**additional Action**}!",
        highlights: [
          { selector: '.game-hand-me [data-card-name="Quick Attack"]', pulse: true },
        ] },
      { text: "So you can use it even outside your {red:**Action Phase**}! You can use it and **not** use up your one main Action per turn!" },
      { text: 'Go ahead - apply as much status as you can and make the enemy Heroes succumb to it, beep-boop!' },
    ],
    outro: [
      { text: "Perfect! You can use {yellow:**Stun**}, {#88ddff:**Freeze**} and other inhibiting effects to slow your opponent down while {purple:**Poison**} and {orange:**Burn**} whittle them down!" },
    ],
  },
};

window.canCardTypeEnterSection = canCardTypeEnterSection;
window.typeColor = typeColor;
window.typeClass = typeClass;
window.sortDeckCards = sortDeckCards;
window.shuffleArray = shuffleArray;
window.AppContext = AppContext;
window.Notification = Notification;
window.CardMini = CardMini;
window.FoilOverlay = FoilOverlay;
window.useFoilBands = useFoilBands;
window.VolumeControl = VolumeControl;
window.CardTooltipContent = CardTooltipContent;
window.useCardTooltip = useCardTooltip;
window.showGameTooltip = showGameTooltip;
window.hideGameTooltip = hideGameTooltip;
window.GameTooltip = GameTooltip;
window.StatusBadges = StatusBadges;
window.BuffColumn = BuffColumn;
window.TextBox = TextBox;
window.showTextBox = showTextBox;
window.TUTORIAL_SCRIPTS = TUTORIAL_SCRIPTS;
