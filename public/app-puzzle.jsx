// ═══════════════════════════════════════════
//  PIXEL PARTIES — PUZZLE CREATOR (SANDBOX)
//  Reuses existing board layout classes and
//  game-engine-compatible data structures.
// ═══════════════════════════════════════════
const { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, useContext } = React;
const { AppContext, cardImageUrl, VolumeControl, CARDS_BY_NAME, CardTooltipContent, useCardTooltip, StatusBadges, BuffColumn, GameTooltip, socket } = window;
const { FrozenOverlay, NegatedOverlay, BurnedOverlay, PoisonedOverlay, HealReversedOverlay, ImmuneIcon } = window;

// ── Ambient pixel motes for the Puzzle Creator ─────────────────────────
// Same visual language as the battle board (reuses the global
// .board-ambiance / .board-mote CSS and the hand-mote-float keyframes),
// implemented locally because app-puzzle.js loads BEFORE app-board.js and
// cannot reference its components.
//   variant 'board': sparse, dim, long rises — mounted as the FIRST child
//     of .pz-plane-clip so it paints behind the tilted plane (same layer
//     order as BoardAmbiance inside .board-plane-clip in battle).
//   variant 'hand': denser, brighter, short rises — mounted inside the
//     two hand bars; .board-ambiance's overflow:hidden clips the rise at
//     the bar edge.
// Colors mirror the battle defaults (cyan/red + white sparkles) — creator
// players carry no color identity. Strictly decorative: pointer-events
// none via the container class.
function PzAmbiance({ variant }) {
  const motes = useMemo(() => {
    const isHand = variant === 'hand';
    const N = isHand ? 40 : 56;
    const arr = [];
    for (let i = 0; i < N; i++) {
      const dur = (isHand ? 3 : 4) + Math.random() * 5;
      arr.push({
        top: Math.random() * 100,
        left: Math.random() * 100,
        size: 2 + Math.floor(Math.random() * 3),
        dur,
        delay: -Math.random() * dur,
        dx: (Math.random() * 2 - 1) * (isHand ? 22 : 34),
        dy: -((isHand ? 20 : 40) + Math.random() * (isHand ? 60 : 130)),
        max: (isHand ? 0.22 : 0.14) + Math.random() * 0.22,
        color: Math.random() < 0.25 ? '#ffffff'
             : (Math.random() < 0.5 ? '#00f0ff' : '#ff5577'),
      });
    }
    return arr;
  }, [variant]);
  return (
    <div className="board-ambiance" aria-hidden="true">
      {motes.map((p, i) => (
        <span key={i} className="board-mote" style={{
          top: p.top + '%', left: p.left + '%',
          '--p-size': p.size + 'px', '--p-color': p.color,
          '--p-dur': p.dur + 's', '--p-delay': p.delay + 's',
          '--p-dx': p.dx + 'px', '--p-dy': p.dy + 'px', '--p-max': p.max,
        }} />
      ))}
    </div>
  );
}
const { GameBoard } = window;

const emptyPlayer = () => ({
  heroes: [null, null, null],
  abilityZones: [[[], [], []], [[], [], []], [[], [], []]],
  supportZones: [[[], [], []], [[], [], []], [[], [], []]],
  surpriseZones: [[], [], []],
  hand: [], gold: 0, permanents: [], islandZoneCount: [0, 0, 0],
  mainDeck: [], potionDeck: [], sideDeck: [],
  discardPile: [], deletedPile: [],
  // Coolness Stack — only writable while "Wowhalla, the Hall of the
  // Cool" is in this player's Area zone. The puzzle UI shows / hides
  // the editor accordingly; the array is dropped to [] when Wowhalla
  // leaves the Area in the editor.
  coolnessStack: [],
});

// Dream-Landers attach pairs. Each Creature listed here can hold the
// associated Hero attached underneath via `inst.counters.attachedHero`
// (the generic attach plumbing in `engine.actionAttachHeroToCreature`).
// The puzzle creator surfaces a "hero attached" toggle inside the stat
// editor for these — clicking it sets `_creatureStatuses[hi-slot]
// .attachedHero` to the hero name (or unsets it). The server's puzzle
// loader picks the toggle up and re-runs each creature script's
// `onAttachHero` so HP / counter bumps land identically to the
// in-game attach action.
const ATTACHABLE_HERO_PAIRS = {
  'Goff, the Burnbringer':            'Gon, the Frostbringer',
  'Smug Mastermind Antonia':          'Cool Rescuer Monia',
  'Stellin, the Calm Dictator':       'Stellan, the Calm Cat',
  'Smugbeth, the Rebel of no Rules':  'Lizbeth, the Reaper of the Light',
  'Clausss, the No-Nonsense Cultist': 'Klaus, the Cult Leader',
  'Wolflesia, the Canine Flower':     'Rafflesia, the Poison Princess',
  'Unsettling Opportunist Vullary':   'Cute Princess Mary',
};

// ── Player-level debuff registry ──
//
// Each entry maps a stable key (used in saved puzzle data) to a label
// shown in the Puzzle Creator UI and to the matching player-state
// flag the server applies at puzzle start. Keep in sync with the
// `applyPuzzleDebuffs` function on the server (server.js → createPuzzleGame).
//
// `flagKey` is the player-state property the server sets to `true`
// when this debuff is active. `flashbanged` is special: it also
// requires a tracked Flashbang instance in the deleted pile, handled
// server-side. Any new debuff just needs a registry entry plus a
// matching server-side branch.
const PLAYER_DEBUFF_REGISTRY = [
  { key: 'flashbanged',       label: '⚪ Flashbanged (turn ends after first action)', flagKey: '_flashbangedDebuff' },
  { key: 'summonLocked',      label: '🚫 Summon-locked',                              flagKey: 'summonLocked'        },
  { key: 'damageLocked',      label: '🛡️ Damage-locked',                              flagKey: 'damageLocked'        },
  { key: 'oppHandLocked',     label: '🫲 Opp-hand-locked',                            flagKey: 'oppHandLocked'       },
  { key: 'itemLocked',        label: '🔨 Item-locked (must delete to play artifact)', flagKey: 'itemLocked'          },
  { key: 'potionLocked',      label: '🧪 Potion-locked',                              flagKey: 'potionLocked'        },
  { key: 'supportSpellLocked',label: '💚 Support-spell-locked',                       flagKey: 'supportSpellLocked'  },
  { key: 'forsaken',          label: '🏴‍☠️ Forsaken (discards delete instead)',         flagKey: '_discardToDeleteActive' },
  { key: 'handLocked',        label: '🔒 Hand-locked (no draw/search)',               flagKey: 'handLocked'          },
];

// ── Per-side multi-select dropdown for starting debuffs ──
//
// Renders a small "⚠️ Debuffs (N)" toggle button. Clicking it opens
// a panel of checkboxes pulled from PLAYER_DEBUFF_REGISTRY; toggling
// a checkbox updates the selected list via `onChange`. The parent
// PuzzleCreator owns `isOpen` so it can ensure only one side's menu
// is open at a time and so an outside click closes it.
//
// The `me` side sits in the staging hand at the BOTTOM of the
// viewport, so its dropdown opens UPWARD (bottom: calc(100% + 4px))
// to avoid landing below the visible area. The `opp` side sits near
// the top of the board, so its dropdown opens DOWNWARD.
function DebuffSelector({ side, selected, onChange, isOpen, onToggle, onClose }) {
  const isOpp = side === 'opp';
  const accent = isOpp ? '#ff8844' : '#88ccff';
  const containerRef = useRef(null);

  // Click-outside dismissal — close the dropdown when the user clicks
  // anywhere that isn't this selector's tree.
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, onClose]);

  const toggle = (key) => {
    const has = selected.includes(key);
    onChange(has ? selected.filter(k => k !== key) : [...selected, key]);
  };

  // Pop direction: opp opens downward (it sits near the top of the
  // viewport); me opens upward (it sits in the bottom hand row, so
  // a downward dropdown would land off-screen).
  const dropdownPosStyle = isOpp
    ? { top: 'calc(100% + 4px)' }
    : { bottom: 'calc(100% + 4px)' };

  return (
    <div ref={containerRef} style={{ position: 'relative', alignSelf: 'stretch', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          padding: '6px 10px', fontSize: 11, fontWeight: 700,
          background: isOpen ? `rgba(${isOpp ? '255,136,68' : '136,204,255'},.18)` : 'rgba(0,0,0,.25)',
          border: `1px solid ${accent}55`,
          color: accent,
          borderRadius: 4, cursor: 'pointer',
          marginLeft: 8, whiteSpace: 'nowrap',
        }}
        title={`${isOpp ? 'Opponent' : 'Player'}'s starting debuffs`}>
        ⚠️ Debuffs ({selected.length})
      </button>
      {isOpen && (
        <div style={{
          position: 'absolute',
          right: 0,
          ...dropdownPosStyle,
          width: 270, maxHeight: 320, overflowY: 'auto',
          background: 'rgba(15,15,25,0.97)',
          border: `1px solid ${accent}66`,
          borderRadius: 6,
          padding: '6px 4px',
          zIndex: 10001,
          boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
        }}>
          <div style={{ padding: '4px 8px 6px', fontSize: 10, color: accent, opacity: 0.85, borderBottom: `1px solid ${accent}33`, marginBottom: 4 }}>
            {isOpp ? "Opponent's" : "Your"} starting debuffs
          </div>
          {PLAYER_DEBUFF_REGISTRY.map(d => {
            const checked = selected.includes(d.key);
            return (
              <label key={d.key} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 8px', cursor: 'pointer',
                color: checked ? accent : 'var(--text2)',
                fontSize: 11,
                background: checked ? `rgba(${isOpp ? '255,136,68' : '136,204,255'},.10)` : 'transparent',
                borderRadius: 3,
              }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(d.key)}
                  style={{ accentColor: accent, cursor: 'pointer', flexShrink: 0 }}
                />
                <span>{d.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PuzzleCreator() {
  const { user, setScreen, notify, setBgmMode } = useContext(AppContext);

  // ── Load saved state from localStorage ──
  const loadSaved = () => {
    try {
      const raw = localStorage.getItem('pz-creator-state');
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return null;
  };
  const saved = useMemo(loadSaved, []);

  // Normalize saved-state players so any field added after the save was
  // taken (e.g. `sideDeck`) defaults to a safe empty value. Without
  // this, drag-drop helpers that call `pp[key].push(...)` would throw
  // on saves predating the field.
  const normalizePlayer = (raw) => {
    const base = emptyPlayer();
    if (!raw) return base;
    return {
      ...base, ...raw,
      sideDeck: Array.isArray(raw.sideDeck) ? raw.sideDeck : [],
      coolnessStack: Array.isArray(raw.coolnessStack) ? raw.coolnessStack : [],
    };
  };
  const [players, setPlayers] = useState(
    (saved?.players || []).length === 2
      ? saved.players.map(normalizePlayer)
      : [emptyPlayer(), emptyPlayer()]
  );
  const [areaZones, setAreaZones] = useState(saved?.areaZones || [[], []]);
  // Doom Clock: Startzaehler je Seite (Als Vorgabe 5.8.). 0..19 —
  // 20 waere sofortige Niederlage, das ergibt als AUFBAU keinen Sinn.
  const [doomCounters, setDoomCounters] = useState(saved?.doomCounters || [0, 0]);
  const [hand, setHand] = useState(saved?.hand || []);
  const [oppHand, setOppHand] = useState(saved?.oppHand || []);
  const [puzzleName, setPuzzleName] = useState(saved?.puzzleName || '');
  // Per-player starting debuff lists. Each entry is a key from
  // PLAYER_DEBUFF_REGISTRY below; the server applies them at puzzle
  // start (sets the matching player-state flag, tracks any helper
  // instances like Flashbang's deleted-pile sentinel, etc.).
  const [meDebuffs, setMeDebuffs]   = useState(saved?.meDebuffs   || []);
  const [oppDebuffs, setOppDebuffs] = useState(saved?.oppDebuffs  || []);
  const [debuffMenuOpen, setDebuffMenuOpen] = useState(null); // 'me' | 'opp' | null
  // Same shape as the Deck Builder's `filters` state (see app-deckbuilder.jsx
  // line ~110). The puzzle gallery's filter sidebar consumes this directly.
  // Kept independent from the deck builder's state so they don't share a
  // mutable global between the two screens. The sidebar's `name` field is
  // the only name-search surface — there's no separate quick-search input.
  const [puzzleFilters, setPuzzleFilters] = useState({
    name: '', effect: '', cardType: '', subtype: '', archetype: '',
    sa1: '', sa2: '', ss1: '', ss2: '',
    level: '', cost: '', hp: '', atk: '',
  });
  // Collapse the filter sidebar to reclaim its width for a wider card
  // grid (3 → 5 columns), mirroring the deck builder's collapsible filters.
  const [puzzleFiltersCollapsed, setPuzzleFiltersCollapsed] = useState(false);
  // Geometrie des Suchpanels, gespiegelt aus style.css:
  //   .pz-search-panel   width: 580px
  //   .pz-filter-sidebar width: 200px + 1px border-right
  // Der Karten-Tooltip legt sich deckungsgleich ueber die Galerie, also
  // ueber den Bereich RECHTS der Filterspalte.
  const PZ_PANEL_W = 580;
  const PZ_FILTER_W = 201;
  const galleryLeft = puzzleFiltersCollapsed ? 0 : PZ_FILTER_W;
  const [validated, setValidated] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editHp, setEditHp] = useState('');
  const [editMaxHp, setEditMaxHp] = useState('');
  const [editAtk, setEditAtk] = useState('');
  const [dragCardName, setDragCardName] = useState(null);
  const [dragHandIdx, setDragHandIdx] = useState(null);
  const [dragHandSource, setDragHandSource] = useState(null); // 'hand' or 'oppHand'
  const [dragSource, setDragSource] = useState(null);
  const [dragOverZone, setDragOverZone] = useState(null);
  const [viewPile, setViewPile] = useState(null);
  const boardWrapRef = useRef(null);
  const dragEntityData = useRef(null);
  const searchResultsRef = useRef(null);
  const customScrollRef = useRef(null);
  const scrollThumbRef = useRef(null);
  const scrollDragRef = useRef(null);
  const [removePopupPos, setRemovePopupPos] = useState(null);

  // ── Mobile tap-to-place (alternative to drag/drop) ──
  const [mobileSelected, setMobileSelected] = useState(null); // { cardName, handIdx, handSource }
  const isTouchDevice = 'ontouchstart' in window;
  const touchStartRef = useRef(null);
  const lastTapRef = useRef({ time: 0, handSource: null, handIdx: -1 }); // double-tap detection

  // Filtered card search results. Declared up here (before the scrollbar
  // effect below depends on it) so it's initialized when that effect's
  // dependency array is evaluated during render — otherwise referencing it
  // later triggers a temporal-dead-zone error.
  const searchResults = useMemo(() => {
    let result = window.AVAILABLE_CARDS || [];
    // Sidebar filter set — mirrors the deck builder's filter pipeline.
    const f = puzzleFilters;
    if (f.name) result = result.filter(c => c.name.toLowerCase().includes(f.name.toLowerCase()));
    if (f.effect) result = result.filter(c => c.effect && c.effect.toLowerCase().includes(f.effect.toLowerCase()));
    if (f.cardType) result = result.filter(c => c.cardType === f.cardType);
    if (f.subtype) result = result.filter(c => c.subtype === f.subtype);
    if (f.archetype) result = result.filter(c => c.archetype === f.archetype);
    if (f.sa1) result = result.filter(c => c.startingAbility1 === f.sa1 || c.startingAbility2 === f.sa1);
    if (f.sa2) result = result.filter(c => c.startingAbility1 === f.sa2 || c.startingAbility2 === f.sa2);
    if (f.ss1) result = result.filter(c => c.spellSchool1 === f.ss1 || c.spellSchool2 === f.ss1);
    if (f.ss2) result = result.filter(c => c.spellSchool1 === f.ss2 || c.spellSchool2 === f.ss2);
    if (f.level !== '') result = result.filter(c => c.level != null && c.level === parseInt(f.level));
    if (f.cost !== '') result = result.filter(c => c.cost != null && c.cost === parseInt(f.cost));
    if (f.hp !== '') result = result.filter(c => c.hp != null && c.hp === parseInt(f.hp));
    if (f.atk !== '') result = result.filter(c => c.atk != null && c.atk === parseInt(f.atk));
    return result;
  }, [puzzleFilters]);

  // ── Custom scrollbar for mobile (CSS scrollbars aren't touch-interactive) ──
  const updateScrollThumb = useCallback(() => {
    const el = searchResultsRef.current;
    const thumb = scrollThumbRef.current;
    const track = customScrollRef.current;
    if (!el || !thumb || !track) return;
    const ratio = el.clientHeight / el.scrollHeight;
    if (ratio >= 1) { track.style.display = 'none'; return; }
    track.style.display = '';
    const trackH = track.clientHeight;
    const thumbH = Math.max(40, trackH * ratio);
    const scrollRatio = el.scrollTop / (el.scrollHeight - el.clientHeight);
    thumb.style.height = thumbH + 'px';
    thumb.style.top = (scrollRatio * (trackH - thumbH)) + 'px';
  }, []);

  useEffect(() => {
    const el = searchResultsRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollThumb, { passive: true });
    const ro = new ResizeObserver(updateScrollThumb);
    ro.observe(el);
    updateScrollThumb();
    return () => { el.removeEventListener('scroll', updateScrollThumb); ro.disconnect(); };
  }, [updateScrollThumb, searchResults]);

  const scrollTrackTouch = useCallback((e) => {
    e.stopPropagation();
    const el = searchResultsRef.current;
    const track = customScrollRef.current;
    if (!el || !track) return;
    const t = e.touches[0];
    const trackRect = track.getBoundingClientRect();
    const ratio = (t.clientY - trackRect.top) / trackRect.height;
    el.scrollTop = ratio * (el.scrollHeight - el.clientHeight);
  }, []);

  const scrollThumbTouchStart = useCallback((e) => {
    e.stopPropagation();
    const el = searchResultsRef.current;
    const track = customScrollRef.current;
    if (!el || !track) return;
    const t = e.touches[0];
    scrollDragRef.current = { startY: t.clientY, startScroll: el.scrollTop, trackH: track.clientHeight, thumbH: scrollThumbRef.current?.clientHeight || 40 };
  }, []);

  const scrollThumbTouchMove = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const d = scrollDragRef.current;
    const el = searchResultsRef.current;
    if (!d || !el) return;
    const t = e.touches[0];
    const dy = t.clientY - d.startY;
    const scrollRange = el.scrollHeight - el.clientHeight;
    const trackRange = d.trackH - d.thumbH;
    if (trackRange <= 0) return;
    el.scrollTop = d.startScroll + (dy / trackRange) * scrollRange;
  }, []);

  const scrollThumbTouchEnd = useCallback((e) => {
    e.stopPropagation();
    scrollDragRef.current = null;
  }, []);

  // Measure selected card's viewport position after render
  useLayoutEffect(() => {
    if (!mobileSelected) { setRemovePopupPos(null); return; }
    const handEl = document.querySelector(
      mobileSelected.handSource === 'oppHand' ? '.pz-hand-opp' : '.pz-hand:not(.pz-hand-opp)'
    );
    if (!handEl) { setRemovePopupPos(null); return; }
    const cards = handEl.querySelectorAll('.pz-hand-card');
    const card = cards[mobileSelected.handIdx];
    if (!card) { setRemovePopupPos(null); return; }
    const cardRect = card.getBoundingClientRect();
    const isOpp = mobileSelected.handSource === 'oppHand';
    setRemovePopupPos({
      left: cardRect.left + cardRect.width / 2,
      top: isOpp ? cardRect.bottom + 4 : cardRect.top - 4,
      isOpp,
    });
  }, [mobileSelected]);
  // Reliable mobile tap: tracks touch start position, only fires on short taps without movement
  const mobileTapHandlers = useCallback((onTap) => {
    if (!isTouchDevice) return {};
    return {
      onTouchStart: (e) => { const t = e.touches[0]; touchStartRef.current = { x: t.clientX, y: t.clientY, time: Date.now() }; },
      onTouchEnd: (e) => {
        const start = touchStartRef.current;
        if (!start) return;
        touchStartRef.current = null;
        const t = e.changedTouches[0];
        const dx = Math.abs(t.clientX - start.x), dy = Math.abs(t.clientY - start.y);
        if (dx < 15 && dy < 15 && Date.now() - start.time < 400) {
          e.preventDefault(); // prevent click from also firing
          onTap();
        }
      },
    };
  }, [isTouchDevice]);

  // ── Touch drag system (mobile) ──
  const touchDragRef = useRef(null); // { cardName, handIdx, handSource, source, ghost }
  const touchDragStart = useCallback((cardName, handIdx, handSource, sourceZone, e) => {
    if (!isTouchDevice) return;
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY, time: Date.now() };
    touchDragRef.current = { cardName, handIdx, handSource, sourceZone, startX: t.clientX, startY: t.clientY, dragging: false, ghost: null };
  }, [isTouchDevice]);

  const touchDragMove = useCallback((e) => {
    const td = touchDragRef.current;
    if (!td) return;
    const t = e.touches[0];
    const dx = Math.abs(t.clientX - td.startX), dy = Math.abs(t.clientY - td.startY);
    // Start dragging after 12px movement threshold
    if (!td.dragging && (dx > 12 || dy > 12)) {
      td.dragging = true;
      touchStartRef.current = null; // cancel tap
      setMobileSelected(null);
      // Create ghost
      const ghost = document.createElement('div');
      ghost.className = 'pz-touch-drag-ghost';
      const img = cardImageUrl(td.cardName);
      ghost.innerHTML = img ? `<img src="${img}" style="width:100%;height:100%;object-fit:cover;border-radius:3px;" />` : `<span style="font-size:8px;color:#fff;">${td.cardName}</span>`;
      document.body.appendChild(ghost);
      td.ghost = ghost;
      setDragCardName(td.cardName);
    }
    if (td.dragging) {
      e.preventDefault(); // prevent scroll while dragging
      td.ghost.style.left = (t.clientX - 30) + 'px';
      td.ghost.style.top = (t.clientY - 42) + 'px';
      // Highlight zone under finger
      td.ghost.style.display = 'none';
      const el = document.elementFromPoint(t.clientX, t.clientY);
      td.ghost.style.display = '';
      const zoneEl = el?.closest('[data-pz-zone]') || el?.closest('[data-pz-hand]');
      const zoneKey = zoneEl?.dataset?.pzZone || (zoneEl?.dataset?.pzHand ? 'hand:' + zoneEl.dataset.pzHand : null);
      setDragOverZone(zoneKey || null);
    }
  }, []);

  const touchDragEnd = useCallback((e) => {
    const td = touchDragRef.current;
    touchDragRef.current = null;
    if (!td?.dragging) return;
    if (td.ghost) { td.ghost.remove(); td.ghost = null; }
    setDragCardName(null);
    setDragOverZone(null);
    const t = e.changedTouches[0];
    const el = document.elementFromPoint(t.clientX, t.clientY);
    const zoneEl = el?.closest('[data-pz-zone]');
    const handEl = el?.closest('[data-pz-hand]');
    if (zoneEl) {
      const [si, zt, hi, slot] = zoneEl.dataset.pzZone.split('-');
      const siN = parseInt(si), hiN = parseInt(hi), slotN = parseInt(slot);
      // Same-zone drop → no-op (don't wipe ability/support zones, no SFX).
      if (td.sourceZone && td.sourceZone.zt === zt && td.sourceZone.si === siN && td.sourceZone.hi === hiN && td.sourceZone.slot === slotN) return;
      if (canDrop(td.cardName, zt, siN, hiN, slotN)) {
        // Remove from source
        if (td.handIdx != null) { if (td.handSource === 'oppHand') removeFromOppHand(td.handIdx); else removeFromHand(td.handIdx); }
        if (td.sourceZone) clearZone(td.sourceZone.zt, td.sourceZone.si, td.sourceZone.hi, td.sourceZone.slot);
        // Place
        if (zt === 'hero') placeHero(td.cardName, siN, hiN);
        else if (zt === 'ability') placeAbility(td.cardName, siN, hiN, slotN);
        else if (zt === 'support') placeSupport(td.cardName, siN, hiN, slotN);
        else if (zt === 'surprise') placeSurprise(td.cardName, siN, hiN);
        else if (zt === 'area') placeArea(td.cardName, siN);
        else if (zt === 'permanent') placePermanent(td.cardName, siN);
      }
    } else if (handEl) {
      const handType = handEl.dataset.pzHand;
      // Dropping back on the same hand it came from → do nothing
      if (td.handSource === handType && td.handIdx != null) return;
      // Remove from source hand or zone
      if (td.handIdx != null) { if (td.handSource === 'oppHand') removeFromOppHand(td.handIdx); else removeFromHand(td.handIdx); }
      if (td.sourceZone) clearZone(td.sourceZone.zt, td.sourceZone.si, td.sourceZone.hi, td.sourceZone.slot);
      // Add to target hand
      if (handType === 'hand') addToHand({ name: td.cardName });
      else if (handType === 'oppHand') addToOppHand({ name: td.cardName });
      if (window.playSFX) window.playSFX('draw');
    }
  }, [canDrop, clearZone, removeFromHand, removeFromOppHand, placeHero, placeAbility, placeSupport, placeSurprise, placeArea, placePermanent, addToHand, addToOppHand]);

  // ── Puzzle Battle State ──
  const [puzzleGameState, setPuzzleGameState] = useState(null);
  const puzzleRoomRef = useRef(null); // stores roomId during puzzle battle

  // ── Auto-save state to localStorage on every change ──
  useEffect(() => {
    try { localStorage.setItem('pz-creator-state', JSON.stringify({ players, areaZones, doomCounters, hand, oppHand, puzzleName, meDebuffs, oppDebuffs })); } catch (_) {}
  }, [players, areaZones, doomCounters, hand, oppHand, puzzleName, meDebuffs, oppDebuffs]);

  const puzzleIgnoreRef = useRef(false); // true after leaving — blocks inflight game_state updates

  // ── Musik im Creator ──
  // Editor: Erstellen-Thema. Testlauf: Probieren-Thema — ein
  // Durchspielen bleibt ein Durchspielen, auch aus dem Creator heraus.
  //
  // ACHTUNG, Reihenfolge: hier stand vorher ein `if (!puzzleGameState)
  // setBgmMode('puzzleCreate')` MIT `return () => setBgmMode('menu')`.
  // React raeumt bei JEDER Dep-Aenderung erst auf und laesst dann den
  // Rumpf laufen. Startete der Testlauf, feuerte also zuerst das
  // Aufraeumen ('menu') und der Rumpf tat danach nichts, weil
  // `puzzleGameState` gesetzt war — es blieb die Hauptmenue-Musik.
  // Der Rumpf setzt den Modus jetzt IMMER, und das Aufraeumen laeuft
  // nur noch beim tatsaechlichen Verlassen des Creators.
  useEffect(() => {
    if (!setBgmMode) return;
    setBgmMode(puzzleGameState ? 'puzzleAttempt' : 'puzzleCreate');
  }, [puzzleGameState, setBgmMode]);

  const bgmRef = useRef(setBgmMode);
  bgmRef.current = setBgmMode;
  useEffect(() => () => { if (bgmRef.current) bgmRef.current('menu'); }, []);

  // ── Puzzle Battle: socket listeners ──
  useEffect(() => {
    const onGameState = (state) => {
      if (!state.isPuzzle || puzzleIgnoreRef.current) return;
      puzzleRoomRef.current = state.roomId;
      setPuzzleGameState(state);
      // Musik steuert der Effekt oben aus `puzzleGameState`.
    };
    const onPuzzleError = (msg) => {
      notify('Puzzle error: ' + msg, 'error');
    };
    socket.on('game_state', onGameState);
    socket.on('puzzle_error', onPuzzleError);
    return () => {
      socket.off('game_state', onGameState);
      socket.off('puzzle_error', onPuzzleError);
    };
  }, [notify, setBgmMode]);

  // ── Puzzle Battle: leave handler ──
  const onPuzzleLeave = useCallback(() => {
    const gs = puzzleGameState;
    const roomId = puzzleRoomRef.current;
    puzzleIgnoreRef.current = true;  // Block any inflight game_state updates
    puzzleRoomRef.current = null;
    // Read result before clearing
    const result = gs?.result;
    const success = result?.isPuzzle && result?.puzzleResult === 'success';
    // Clean up server-side
    if (roomId) socket.emit('leave_game', { roomId });
    // Return to creator
    setPuzzleGameState(null);
    puzzleRoomRef.current = null;
    // Musik: der Effekt oben schaltet beim Zuruecksetzen von
    // `puzzleGameState` von selbst auf 'puzzleCreate'.
    if (result) {
      setValidated(success);
      notify(success ? '🧩 Puzzle validated! Export is now available.' : 'Puzzle not cleared — adjust and try again.', success ? 'success' : 'info');
    }
  }, [puzzleGameState, notify, setBgmMode]);

  const handleReset = useCallback(() => {
    setPlayers([emptyPlayer(), emptyPlayer()]);
    setAreaZones([[], []]);
    setDoomCounters([0, 0]);
    setHand([]);
    setOppHand([]);
    setMeDebuffs([]);
    setOppDebuffs([]);
    setValidated(false);
    setEditTarget(null);
    setViewPile(null);
    try { localStorage.removeItem('pz-creator-state'); } catch (_) {}
    notify('Puzzle reset!', 'info');
  }, [notify]);

  // ── Tooltip (shared hook — wires BoardCard hover automatically) ──
  const { tooltipCard, tooltipSide, showTooltip: _showTooltip, hideTooltip, setTooltipCard, setTooltipSide } = useCardTooltip({ defaultSide: 'left' });
  // On touch devices, suppress hover tooltips (they never dismiss since there's no mouseLeave)
  const showTooltip = isTouchDevice ? () => {} : _showTooltip;

  // Re-register the board tooltip setter after returning from a validation battle.
  // GameBoard's unmount cleanup nullifies window._boardTooltipSetter — restore it here
  // whenever puzzleGameState transitions back to null.
  //
  // CRITICAL: must mirror useCardTooltip's own setter by resetting `tooltipSide`
  // to the default ('left') whenever a card is shown via BoardCard hover. If we
  // only set the card, a prior gallery hover ('right' side) leaks through — the
  // tooltip renders over the board, obscuring the card being hovered.
  useEffect(() => {
    if (puzzleGameState) return; // GameBoard is mounted and owns the setter
    window._boardTooltipSetter = (card) => {
      setTooltipCard(card || null);
      if (card) setTooltipSide('left');
    };
    return () => { window._boardTooltipSetter = null; };
  }, [puzzleGameState, setTooltipCard, setTooltipSide]);

  const cardDB = window.CARDS_BY_NAME || {};
  const getCard = useCallback((name) => cardDB[name] || null, [cardDB]);

  // ── Ascension map: Ascended Hero name → base Hero name ──
  const ascensionMap = useMemo(() => {
    const map = {};
    const allCards = window.AVAILABLE_CARDS || [];
    for (const c of allCards) {
      if (c.cardType !== 'Ascended Hero' || !c.effect) continue;
      // Pattern: on top of a/an "Base Hero Name"  OR  Ascend from "Base Hero Name"
      const m = c.effect.match(/(?:on top of an? |Ascend from )"([^"]+)"/);
      if (m) {
        const baseName = m[1];
        // Waflav variants reference just "Waflav" — resolve to the actual Hero card
        if (baseName === 'Waflav') {
          const waflav = allCards.find(h => h.cardType === 'Hero' && h.name.startsWith('Waflav'));
          if (waflav) map[c.name] = waflav.name;
        } else {
          // Verify the base hero exists in the card DB
          if (cardDB[baseName]) map[c.name] = baseName;
        }
      }
    }
    return map;
  }, [cardDB]);

  // ── Board skin helper (same as existing game board) ──
  const zs = useCallback((zoneType) => {
    const boardId = user?.board;
    if (!boardId) return undefined;
    const num = boardId.replace(/\D/g, '');
    return {
      backgroundImage: 'url(/data/shop/boards/' + encodeURIComponent(zoneType + num) + '.png)',
      backgroundSize: 'cover', backgroundPosition: 'center',
    };
  }, [user?.board]);

  // ── Board auto-scaling ──
  // v8: fixes two v7 bugs Al hit:
  //   • FLICKER + REVERT (creator): the height shrink only applied while
  //     currently overflowing — the pass after a shrink measured "fits"
  //     and reset scale to the width value, oscillating big/small until
  //     the pass limiter froze it (usually on big). Now every pass
  //     steers toward the same fixed point min(widthFit, heightFit), so
  //     the iteration is a contraction and cannot bounce back.
  //   • TINY ZONES IN TEST MODE: --board-scale lives GLOBALLY on
  //     documentElement, and entering test mode does not unmount this
  //     component — only its render output becomes <GameBoard/>. The
  //     creator's ResizeObserver then fired one last time for the
  //     detached container with 0×0 → width formula clamped to
  //     MIN_SCALE 0.5 → and the rAF re-measure chain kept re-asserting
  //     0.5 for several frames, overriding GameBoard's own correct
  //     scaler. Guards: bail when the container is detached/zero-sized,
  //     and the effect now depends on test mode so it disconnects the
  //     observer and cancels pending rAFs on the mode switch (GameBoard
  //     owns the variable while mounted; on leaving test mode this
  //     effect re-runs and takes over again).
  // The height pass measures the plane's TRANSFORMED bounding box, so
  // the pseudo-3D projection (vertical compression + near-edge
  // overhang) is priced in automatically. Labels and min-heights don't
  // scale linearly with --board-scale, so the fit converges over a few
  // bounded rAF passes. It also publishes --pz-overhang: with the
  // plane's top-pivot tilt, the near rows project PAST the layout box
  // toward the camera — the margin reserves that space so they never
  // paint over the YOU label / staging hand.
  const inPuzzleTest = !!puzzleGameState;
  // Handle for the scaler's updateScale so state-driven effects can
  // re-kick a fit pass (see the effect after the scaler).
  const scaleKickRef = useRef(null);
  useEffect(() => {
    if (inPuzzleTest) return; // GameBoard owns --board-scale in test mode
    const container = boardWrapRef.current;
    if (!container) return;
    const IDEAL_WIDTH = 1000;
    const MIN_SCALE = 0.5;
    const MAX_SCALE = 1.1;
    let raf = 0, passes = 0;
    const updateScale = () => {
      // Detached or collapsed container (mode switch, hidden tab):
      // never write a scale derived from a 0×0 measurement.
      if (!container.isConnected || container.clientWidth === 0) return;
      // Preserve the user's scroll offsets across this pass: during
      // pz-flat-measure the plane loses transform + overhang padding/
      // margin, scrollWidth/scrollHeight momentarily shrink, and the
      // browser CLAMPS the offsets down — a clamp that survives the
      // restore (same "snap back to far left" loop as on the battle
      // board). Restored, re-clamped against the FINAL extents, at the
      // end of the pass.
      const prevSL = container.scrollLeft;
      const prevST = container.scrollTop;
      const widthScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, container.clientWidth / IDEAL_WIDTH));
      let scale = widthScale;
      // ── Legit-hscroll detection (v9, rev v13) ──
      // Measure the column FLAT (tilt neutralized) so only LAYOUT width
      // counts: transform overflow of the tilted plane must never open
      // the horizontal scrollbar. Layout overflow is real — Flying
      // Island zones or a narrow viewport — and switches the wrap into
      // pz-can-hscroll (tilt stays on + min-content chain, style.css).
      // IMPORTANT: container.scrollWidth alone cannot detect this. The
      // wrap's base overflow-x is `clip`, and a clipped box's reported
      // scrolling area EXCLUDES the clipped-away descendant overflow —
      // the read never rises above clientWidth, so the scrollbar could
      // never latch. (The battle detector reads under overflow-x:auto
      // thanks to its flat-measure exception — that asymmetry is why
      // battle worked and the creator silently didn't.) The layout
      // truth lives in the rows instead: row boxes stretch to the
      // container, but their first→last children span the real content
      // extent regardless of any ancestor clipping. scrollWidth is
      // still folded in via max() — in hscroll mode (overflow auto)
      // it's authoritative and also covers non-row content.
      container.classList.add('pz-flat-measure');
      let layoutW = container.scrollWidth;
      container.querySelectorAll('.pz-board-plane .board-row').forEach(row => {
        const k = row.children;
        if (!k.length) return;
        const w = k[k.length - 1].getBoundingClientRect().right - k[0].getBoundingClientRect().left;
        if (w > layoutW) layoutW = w;
      });
      // Belt: union of every zone rect — structure-independent floor.
      // Immune to any future row/group wrapper reshuffling: as long as
      // zones exist, their horizontal span IS the board's layout width.
      let zMinL = Infinity, zMaxR = -Infinity;
      container.querySelectorAll('.pz-board-plane .board-zone').forEach(z => {
        const r = z.getBoundingClientRect();
        if (r.width === 0) return;
        if (r.left < zMinL) zMinL = r.left;
        if (r.right > zMaxR) zMaxR = r.right;
      });
      if (zMaxR > zMinL && (zMaxR - zMinL) > layoutW) layoutW = zMaxR - zMinL;
      container.classList.remove('pz-flat-measure');
      // Hysteresis (v16): a single +4 threshold flaps when the layout
      // width sits right at the edge (exactly 3 Flying Islands) —
      // latching shows the scrollbar → clientHeight shrinks → the
      // scaler shrinks the board → width drops under the threshold →
      // unlatch → scrollbar gone → scale back up → relatch, forever
      // (the constant interface jitter). Once latched, stay latched
      // until the content is CLEARLY under the line.
      const wasLatched = container.classList.contains('pz-can-hscroll');
      const needsHScroll = layoutW > container.clientWidth + (wasLatched ? -36 : 4);
      // Diagnostics valve: run `window.PP_HSCROLL_DEBUG = true` in the
      // console to trace why the scrollbar does / doesn't latch.
      if (window.PP_HSCROLL_DEBUG) {
        console.log('[pz-hscroll]', {
          layoutW: Math.round(layoutW),
          clientWidth: container.clientWidth,
          needsHScroll,
          latched: container.classList.contains('pz-can-hscroll'),
          scale: getComputedStyle(document.documentElement).getPropertyValue('--board-scale').trim(),
        });
      }
      container.classList.toggle('pz-can-hscroll', needsHScroll);
      const plane = container.querySelector('.pz-board-plane');
      // v17: overhang from the projected CONTENT extent — absolute
      // assignment, not incremental. v16 measured the plane BOX
      // (including its own padding) against the clip box and added the
      // spill to the padding each pass. That can never converge: a box
      // whose projection is magnified by f can never contain its own
      // projection — every pixel of added padding is itself projected
      // to f pixels of new spill, so the loop diverged geometrically
      // (pad_{n+1} = f·pad_n + …), ballooning the padding to thousands
      // of px: gigantic scroll range, and the extreme lateral
      // perspective displacement smeared the zones into slivers.
      // The CONTENT's projected extent, in contrast, is finite and
      // independent of the padding (content sits centered in the box
      // and the magnification is symmetric about that center), so
      // needPad = (projectedContent − layoutContent) / 2 is a fixed
      // point: assigning it absolutely is idempotent and lands in one
      // pass. Clipping the padding's own projected (empty) region at
      // the clip wrapper is intentional and harmless.
      // v18: two-sided overhang — with the anchor on the middle hero
      // the projection is asymmetric about the box center; the side
      // farther from the anchor needs more padding. Same content-based
      // absolute math as v17 (never the box!), per side, corrected by
      // the measured signed gap (contracting recurrence, |1−f| < 1).
      if (plane && needsHScroll) {
        const clipBox = plane.closest('.pz-plane-clip');
        let pL = Infinity, pR = -Infinity;
        plane.querySelectorAll('.board-zone').forEach(z => {
          const r = z.getBoundingClientRect(); // transform ACTIVE
          if (r.width === 0) return;
          if (r.left < pL) pL = r.left;
          if (r.right > pR) pR = r.right;
        });
        if (clipBox && pR > pL) {
          const cr = clipBox.getBoundingClientRect();
          const cs = getComputedStyle(plane);
          const padL = parseFloat(cs.paddingLeft) || 0;
          const padR = parseFloat(cs.paddingRight) || 0;
          const contentW = Math.max(1, plane.offsetWidth - padL - padR);
          const newL = Math.min(contentW, Math.max(0, padL + (cr.left - pL)));
          const newR = Math.min(contentW, Math.max(0, padR + (pR - cr.right)));
          const prevL = parseFloat(container.style.getPropertyValue('--pz-overhang-l')) || 0;
          const prevR = parseFloat(container.style.getPropertyValue('--pz-overhang-r')) || 0;
          if (Math.abs(newL - prevL) > 0.5) container.style.setProperty('--pz-overhang-l', newL.toFixed(1) + 'px');
          if (Math.abs(newR - prevR) > 0.5) container.style.setProperty('--pz-overhang-r', newR.toFixed(1) + 'px');
        }
      } else if (container.style.getPropertyValue('--pz-overhang-l') || container.style.getPropertyValue('--pz-overhang-r')) {
        container.style.setProperty('--pz-overhang-l', '0px');
        container.style.setProperty('--pz-overhang-r', '0px');
      }
      if (plane) {
        const cur = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--board-scale')) || 1;
        const planeRect = plane.getBoundingClientRect(); // transformed extent (flat in hscroll mode)
        if (planeRect.height > 0) {
          // Visual overhang of the tilted plane past its layout box.
          // With margin-bottom set to exactly this value, the plane's
          // layout consumption equals its visual extent (offsetHeight +
          // overhang = rect height) — so `needed` below can use the
          // rect height directly without double counting. Only write on
          // meaningful change to avoid layout churn.
          const overhang = Math.max(0, planeRect.height - plane.offsetHeight);
          const prevOverhang = parseFloat(container.style.getPropertyValue('--pz-overhang')) || 0;
          if (Math.abs(overhang - prevOverhang) > 0.5) {
            container.style.setProperty('--pz-overhang', overhang.toFixed(1) + 'px');
          }
          // Everything else in the column: hand bars, side labels…
          // The plane sits inside .pz-plane-clip, which is the actual
          // DIRECT child of the wrap — compare against that box, or
          // its offsetHeight (containing the plane) would be added to
          // othersH and the plane double-counted in `needed`.
          const planeBox = plane.closest('.pz-plane-clip') || plane;
          let othersH = 0;
          for (const child of container.children) {
            if (child !== planeBox) othersH += child.offsetHeight;
          }
          const cs = getComputedStyle(container);
          const chrome = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0)
            + (parseFloat(cs.rowGap) || 0) * Math.max(0, container.children.length - 1);
          const needed = planeRect.height + othersH + chrome;
          // Fixed point: ALWAYS steer toward the height fit (grow when
          // there is room, shrink when overflowing), capped by the
          // width fit — never "reset to width and re-shrink". The 6px
          // headroom keeps the converged state safely BELOW the
          // overflow threshold: subpixel rounding of the fit otherwise
          // leaves a 1–3px scrollHeight excess that surfaces as a
          // near-immobile vertical scrollbar.
          const heightFit = cur * ((container.clientHeight - 6) / Math.max(1, needed));
          scale = Math.max(MIN_SCALE, Math.min(widthScale, heightFit));
          // ── Visual width fit (v9, responsive) ──
          // overflow-x is `clip` outside hscroll mode, so the PROJECTED
          // width of the widest row content must fit the wrap on every
          // monitor or zones would be cut off. Row boxes stretch to full
          // width (flex), so measure actual content extent from the
          // first/last child rects — the near rows magnified by the
          // projection are automatically the binding case.
          if (!needsHScroll) {
            let maxContentW = 0;
            plane.querySelectorAll('.board-row').forEach(row => {
              const k = row.children;
              if (!k.length) return;
              const w = k[k.length - 1].getBoundingClientRect().right - k[0].getBoundingClientRect().left;
              if (w > maxContentW) maxContentW = w;
            });
            if (maxContentW > 0) {
              const widthFitVisual = cur * ((container.clientWidth - 6) / maxContentW);
              scale = Math.max(MIN_SCALE, Math.min(scale, widthFitVisual));
            }
          }
        }
      }
      const prev = parseFloat(document.documentElement.style.getPropertyValue('--board-scale')) || 0;
      // ── Anchor measurement (v21: END of the pass, anchor only) ───
      // Runs after the latch toggle + overhang updates so the measured
      // frame is the rendered frame. Fold positions are no longer
      // measured at all — they are state-derived flow layout (see the
      // pz-area-fold JSX). Placed BEFORE the scroll restore below: the
      // flat toggle can clamp a latched scroll offset, and the restore
      // must run afterwards to repair it.
      container.classList.add('pz-flat-measure');
      const heroesMe = container.querySelectorAll('[data-hero-zone][data-hero-owner="me"]');
      const planeFlat = container.querySelector('.pz-board-plane');
      if (planeFlat && heroesMe.length >= 3) {
        const hz = Array.from(heroesMe)
          .sort((a, b) => +a.dataset.heroIdx - +b.dataset.heroIdx)
          .map(el => el.getBoundingClientRect());
        const plFlat = planeFlat.getBoundingClientRect();
        // Flat measurement = CONTENT coordinates; the origins consume
        // BOX coordinates — add the live padding-left (v19 lesson).
        const padLLive = parseFloat(container.style.getPropertyValue('--pz-overhang-l')) || 0;
        const anchorX = (hz[1].left + hz[1].right) / 2 - plFlat.left + padLLive;
        const prevAnchor = parseFloat(container.style.getPropertyValue('--pz-anchor-x')) || -1;
        if (Math.abs(anchorX - prevAnchor) > 0.5) {
          container.style.setProperty('--pz-anchor-x', anchorX.toFixed(1) + 'px');
        }
      }
      container.classList.remove('pz-flat-measure');
      // Latch-state change = frame change: force one settle pass so all
      // measurements re-run against the frame the browser applied.
      if (wasLatched !== needsHScroll && passes < 5) {
        passes++;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(updateScale);
      }
      // Restore the scroll offsets saved at the top of the pass,
      // re-clamped to the final extents (a genuinely shrunken board
      // lands on its new edge instead of past it).
      if (prevSL > 0) {
        const maxSL = Math.max(0, container.scrollWidth - container.clientWidth);
        const tSL = Math.min(prevSL, maxSL);
        if (container.scrollLeft !== tSL) container.scrollLeft = tSL;
      }
      if (prevST > 0) {
        const maxST = Math.max(0, container.scrollHeight - container.clientHeight);
        const tST = Math.min(prevST, maxST);
        if (container.scrollTop !== tST) container.scrollTop = tST;
      }
      if (Math.abs(prev - scale) > 0.003) {
        document.documentElement.style.setProperty('--board-scale', scale.toFixed(4));
        // Re-measure after the new scale lands (non-linear parts:
        // labels, min-heights, the projection itself) — bounded.
        if (passes < 5) {
          passes++;
          raf = requestAnimationFrame(updateScale);
        }
      } else {
        passes = 0;
      }
    };
    const ro = new ResizeObserver(() => { passes = 0; updateScale(); });
    ro.observe(container);
    // The wrap's own size doesn't change when its CONTENT grows (hand
    // bars filling up, rows changing) — observe the column children too
    // so those changes re-trigger the fit. The scale deadband above
    // stops the observe→resize→observe feedback once converged.
    for (const child of container.children) ro.observe(child);
    // v16: expose the pass for the state-kick effect below. Pure WIDTH
    // changes of row content (adding/removing island zones) resize NO
    // observed border box — every observed element stretches to the
    // wrap's width and keeps its height — so the RO alone can miss the
    // exact moment the 3rd island crosses the hscroll threshold, and
    // the fold's area positions would lag one interaction behind.
    scaleKickRef.current = () => { passes = 0; updateScale(); };
    updateScale();
    return () => { scaleKickRef.current = null; ro.disconnect(); cancelAnimationFrame(raf); document.documentElement.style.setProperty('--board-scale', '1'); };
  }, [inPuzzleTest]);

  // Re-run the fit whenever layout-relevant creator state changes —
  // covers the RO blind spot described above (island zones, area
  // cards, hand bars all reshaping content without resizing any
  // observed box).
  useEffect(() => {
    if (scaleKickRef.current) scaleKickRef.current();
  }, [players, areaZones, hand, oppHand]);

  const invalidate = useCallback(() => setValidated(false), []);
  // Invalidate whenever hands change (covers add, remove, reorder, drag-drop)
  const handMountedRef = useRef(false);
  useEffect(() => {
    if (!handMountedRef.current) { handMountedRef.current = true; return; }
    invalidate();
  }, [hand, oppHand]);
  const updatePlayer = useCallback((idx, fn) => {
    setPlayers(prev => { const next = [...prev]; next[idx] = fn(JSON.parse(JSON.stringify(prev[idx]))); return next; });
    invalidate();
  }, [invalidate]);
  const updateArea = useCallback((idx, fn) => {
    setAreaZones(prev => {
      const next = [...prev];
      const before = [...prev[idx]];
      const after = fn([...prev[idx]]);
      next[idx] = after;
      // If "Wowhalla, the Hall of the Cool" was just removed from this
      // player's Area, drop their Coolness Stack — the Stack only
      // exists while Wowhalla is in play.
      const hadWowhalla = before.includes('Wowhalla, the Hall of the Cool');
      const hasWowhalla = after.includes('Wowhalla, the Hall of the Cool');
      if (hadWowhalla && !hasWowhalla) {
        setPlayers(ps => {
          const cp = [...ps];
          if (cp[idx]?.coolnessStack?.length > 0) {
            cp[idx] = { ...cp[idx], coolnessStack: [] };
          }
          return cp;
        });
      }
      return next;
    });
    invalidate();
  }, [invalidate]);

  // add/remove helpers do NOT play SFX themselves — they're called both from
  // user-facing actions AND as part of drag-to-place flows where they'd
  // double up with placement/discard. Call sites play the sound instead.
  const addToHand = useCallback((card) => { setHand(prev => [...prev, card.name]); invalidate(); }, [invalidate]);
  const removeFromHand = useCallback((idx) => { setHand(prev => prev.filter((_, i) => i !== idx)); invalidate(); }, [invalidate]);
  const addToOppHand = useCallback((card) => { setOppHand(prev => [...prev, card.name]); invalidate(); }, [invalidate]);
  const removeFromOppHand = useCallback((idx) => { setOppHand(prev => prev.filter((_, i) => i !== idx)); invalidate(); }, [invalidate]);

  // ── Placement ──
  const placeHero = useCallback((cardName, si, hi) => {
    const c = getCard(cardName); if (!c || (c.cardType !== 'Hero' && c.cardType !== 'Ascended Hero')) return;
    if (window.playSFX) window.playSFX('placement');
    updatePlayer(si, (p) => {
      const old = p.heroes[hi];
      if (old) setHand(prev => [...prev, old.name]);
      p.heroes[hi] = { name: c.name, hp: c.hp || 0, maxHp: c.hp || 0, atk: c.atk || 0, baseAtk: c.atk || 0, statuses: {} };
      p.abilityZones[hi] = [[], [], []];
      // For Ascended Heroes, use the base hero's starting abilities
      const abilitySource = c.cardType === 'Ascended Hero' && ascensionMap[c.name]
        ? getCard(ascensionMap[c.name]) || c
        : c;
      if (abilitySource.startingAbility1 && abilitySource.startingAbility2 && abilitySource.startingAbility1 === abilitySource.startingAbility2) {
        p.abilityZones[hi][1] = [abilitySource.startingAbility1, abilitySource.startingAbility2];
      } else {
        if (abilitySource.startingAbility1) p.abilityZones[hi][0] = [abilitySource.startingAbility1];
        if (abilitySource.startingAbility2) p.abilityZones[hi][1] = [abilitySource.startingAbility2];
      }
      return p;
    });
  }, [getCard, updatePlayer, ascensionMap]);

  const placeAbility = useCallback((cardName, si, hi, slot) => {
    const c = getCard(cardName); if (!c || c.cardType !== 'Ability') return;
    if (!players[si].heroes[hi]) { notify('Place a Hero first!', 'error'); return; }
    if (window.playSFX) window.playSFX('placement');
    const zone = players[si].abilityZones[hi][slot];
    if (zone.length > 0 && zone[0] === cardName && zone.length >= 3) { notify('Max level!', 'error'); return; }
    if (zone.length > 0 && zone[0] !== cardName) setHand(prev => [...prev, ...zone]);
    updatePlayer(si, (p) => {
      if (p.abilityZones[hi][slot].length > 0 && p.abilityZones[hi][slot][0] === cardName) p.abilityZones[hi][slot].push(cardName);
      else p.abilityZones[hi][slot] = [cardName];
      // Biomancy sync: when Biomancy is placed/stacked on a hero, every
      // Biomancy Token already sitting on that hero snaps to the new level.
      if (cardName === 'Biomancy') {
        let n = 0;
        for (const s of (p.abilityZones[hi] || [])) for (const cc of (s || [])) if (cc === 'Biomancy') n++;
        const level = Math.max(1, Math.min(3, n || 1));
        const stats = { 1: 40, 2: 60, 3: 80 }[level];
        for (let z = 0; z < (p.supportZones[hi] || []).length; z++) {
          const cards = p.supportZones[hi][z] || [];
          if (!cards.length) continue;
          const sc = getCard(cards[0]);
          if (sc?.cardType !== 'Potion') continue;
          if (!p._customSupportHp) p._customSupportHp = [[null,null,null],[null,null,null],[null,null,null]];
          p._customSupportHp[hi][z] = stats;
          if (!p._creatureStatuses) p._creatureStatuses = {};
          const cs = { ...(p._creatureStatuses[hi + '-' + z] || {}), biomancyLevel: level };
          p._creatureStatuses[hi + '-' + z] = cs;
        }
      }
      return p;
    });
  }, [getCard, players, updatePlayer, notify]);

  // Biomancy Token stats by level. Matches engine's biomancy.js LEVEL_STATS.
  const BIOMANCY_STATS = { 1: 40, 2: 60, 3: 80 };
  // Count a hero's Biomancy ability level = number of "Biomancy" cards
  // across its three ability slots, clamped to 1..3 (a Biomancy Token is
  // at least level 1 even on a hero with no Biomancy ability, per user
  // intent that tokens always have a sensible default).
  const getHeroBiomancyLevel = useCallback((p, hi) => {
    const ab = (p.abilityZones?.[hi] || []);
    let n = 0;
    for (const slot of ab) for (const c of (slot || [])) if (c === 'Biomancy') n++;
    return Math.max(1, Math.min(3, n || 1));
  }, []);

  const placeSupport = useCallback((cardName, si, hi, slot) => {
    if (window.playSFX) window.playSFX('placement');
    const zone = players[si].supportZones[hi][slot];
    if (zone.length > 0) {
      // Replacing a Flying Island — drop exactly 2 island zones (the
      // rightmost pair). Multiple stacked Flying Islands each keep their
      // own 2 zones; only the replaced card's pair goes.
      if (zone[0] === 'Flying Island in the Sky') {
        updatePlayer(si, (p) => {
          const islandCount = (p.islandZoneCount || [0,0,0])[hi] || 0;
          const removeCount = Math.min(2, islandCount);
          if (removeCount > 0) {
            p.supportZones[hi].splice(p.supportZones[hi].length - removeCount, removeCount);
            p.islandZoneCount[hi] = islandCount - removeCount;
          }
          // Clear old creature metadata
          if (p._customSupportHp?.[hi]) p._customSupportHp[hi][slot] = null;
          if (p._creatureStatuses) delete p._creatureStatuses[hi + '-' + slot];
          p.supportZones[hi][slot] = [cardName];
          // Set default HP from card data
          const nc = getCard(cardName);
          if (nc?.hp) { if (!p._customSupportHp) p._customSupportHp = [[null,null,null],[null,null,null],[null,null,null]]; p._customSupportHp[hi][slot] = nc.hp; }
          // If new card is also a Flying Island, re-add islands
          if (cardName === 'Flying Island in the Sky') {
            if (!p.islandZoneCount) p.islandZoneCount = [0, 0, 0];
            p.supportZones[hi].push([], []);
            p.islandZoneCount[hi] += 2;
          }
          return p;
        });
        setHand(prev => [...prev, ...zone]);
        return;
      }
      setHand(prev => [...prev, ...zone]);
    }
    updatePlayer(si, (p) => {
      // Clear old creature metadata when replacing
      if (p._customSupportHp?.[hi]) p._customSupportHp[hi][slot] = null;
      if (p._creatureStatuses) delete p._creatureStatuses[hi + '-' + slot];
      p.supportZones[hi][slot] = [cardName];
      const nc = getCard(cardName);
      // Potions placed into a Support Zone become Biomancy Tokens. Stamp
      // their initial level from the hero's Biomancy ability count so
      // puzzle authors get the "matches ability" default for free; the
      // user can override via the stat editor.
      if (nc?.cardType === 'Potion') {
        const level = getHeroBiomancyLevel(p, hi);
        const stats = BIOMANCY_STATS[level];
        if (!p._customSupportHp) p._customSupportHp = [[null,null,null],[null,null,null],[null,null,null]];
        p._customSupportHp[hi][slot] = stats;
        if (!p._creatureStatuses) p._creatureStatuses = {};
        p._creatureStatuses[hi + '-' + slot] = { biomancyLevel: level };
      } else if (nc?.hp) {
        if (!p._customSupportHp) p._customSupportHp = [[null,null,null],[null,null,null],[null,null,null]];
        p._customSupportHp[hi][slot] = nc.hp;
      }
      // Flying Island adds 2 island zones
      if (cardName === 'Flying Island in the Sky') {
        if (!p.islandZoneCount) p.islandZoneCount = [0, 0, 0];
        p.supportZones[hi].push([], []);
        p.islandZoneCount[hi] += 2;
      }
      return p;
    });
  }, [players, updatePlayer, getCard, getHeroBiomancyLevel]);

  const placeSurprise = useCallback((cardName, si, hi) => {
    if (!players[si].heroes[hi]) { notify('Place a Hero first!', 'error'); return; }
    if (window.playSFX) window.playSFX('placement');
    if (players[si].surpriseZones[hi].length > 0) setHand(prev => [...prev, ...players[si].surpriseZones[hi]]);
    updatePlayer(si, (p) => { p.surpriseZones[hi] = [cardName]; return p; });
  }, [players, updatePlayer, notify]);

  const placeArea = useCallback((cardName, si) => {
    if (window.playSFX) window.playSFX('placement');
    if (areaZones[si].length > 0) setHand(prev => [...prev, ...areaZones[si]]);
    updateArea(si, () => [cardName]);
  }, [areaZones, updateArea]);

  const placePermanent = useCallback((cardName, si) => {
    if (window.playSFX) window.playSFX('placement');
    updatePlayer(si, (p) => { p.permanents.push({ name: cardName, id: 'p' + Date.now() + Math.random() }); return p; });
  }, [updatePlayer]);

  const removeCard = useCallback((si, zt, hi, slot) => {
    if (window.playSFX) window.playSFX('discard');
    if (zt === 'hero') updatePlayer(si, (p) => { p.heroes[hi] = null; p.abilityZones[hi] = [[], [], []]; p.supportZones[hi] = [[], [], []]; p.surpriseZones[hi] = []; if (p.islandZoneCount) p.islandZoneCount[hi] = 0; return p; });
    else if (zt === 'ability') updatePlayer(si, (p) => { p.abilityZones[hi][slot] = []; return p; });
    else if (zt === 'support') updatePlayer(si, (p) => {
      const removedCard = p.supportZones[hi][slot][0];
      p.supportZones[hi][slot] = [];
      // Clear creature metadata
      if (p._customSupportHp?.[hi]) p._customSupportHp[hi][slot] = null;
      if (p._creatureStatuses) delete p._creatureStatuses[hi + '-' + slot];
      // If removing ONE Flying Island, remove exactly 2 island zones
      // (the rightmost pair). Multiple stacked Flying Islands on the same
      // hero each contribute their own 2 zones, so destroying one copy
      // must not wipe out the other copies' zones.
      if (removedCard === 'Flying Island in the Sky') {
        const islandCount = (p.islandZoneCount || [0,0,0])[hi] || 0;
        const removeCount = Math.min(2, islandCount);
        if (removeCount > 0) {
          p.supportZones[hi].splice(p.supportZones[hi].length - removeCount, removeCount);
          if (!p.islandZoneCount) p.islandZoneCount = [0,0,0];
          p.islandZoneCount[hi] = islandCount - removeCount;
        }
      }
      return p;
    });
    else if (zt === 'surprise') updatePlayer(si, (p) => { p.surpriseZones[hi] = []; return p; });
    else if (zt === 'area') updateArea(si, () => []);
    else if (zt === 'permanent') updatePlayer(si, (p) => { p.permanents.splice(slot, 1); return p; });
  }, [updatePlayer, updateArea]);

  const canDrop = useCallback((cardName, zt, si, hi, slot) => {
    const c = getCard(cardName); if (!c) return false;
    const p = players[si];
    // Creature-like: cardType OR subtype contains "Creature". This catches
    // standard Creatures, Creature/Token hybrids, and Artifact-Creature
    // hybrids (Pollution Spewer and any future card with cardType: 'Artifact'
    // + subtype: 'Creature') — they all occupy a Support Zone as a Creature.
    const isCreatureLike = c.cardType === 'Creature'
      || c.cardType === 'Token'
      || c.cardType === 'Creature/Token'
      || (c.subtype || '').split('/').some(t => t.trim() === 'Creature');
    if (zt === 'hero') return c.cardType === 'Hero' || c.cardType === 'Ascended Hero';
    if (zt === 'ability') return c.cardType === 'Ability' && !!p.heroes[hi];
    if (zt === 'support') {
      const islandCount = (p.islandZoneCount || [0,0,0])[hi] || 0;
      const baseCount = (p.supportZones[hi] || []).length - islandCount;
      const isIsland = slot != null && slot >= baseCount;
      // Potions dropped into a Support Zone become Biomancy Tokens — a
      // Creature/Token with 40/60/80 HP and a "once per turn: deal 40/60/80
      // damage" effect, scaling with the Hero's Biomancy Ability level.
      // Allow them on both base and Island zones (they're Creature-like).
      if (c.cardType === 'Potion') return true;
      if (isIsland) return isCreatureLike;
      return isCreatureLike || c.subtype === 'Equipment' || c.subtype === 'Attachment';
    }
    if (zt === 'surprise') return !!p.heroes[hi] && c.subtype === 'Surprise';
    if (zt === 'area') return c.subtype === 'Area';
    if (zt === 'permanent') return true;
    return false;
  }, [getCard, players]);

  // ── Drag ──
  const onDragStart = useCallback((e, cardName, handIdx, source, handSource) => {
    setDragCardName(cardName); setDragHandIdx(handIdx); setDragSource(source || null); setDragHandSource(handSource || null);
    hideTooltip(); // dismiss tooltip during drag
    e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', '');
  }, []);
  /**
   * Override the native HTML5 drag image with a fixed-size card preview.
   * Without this, the browser auto-generates the drag ghost from the
   * source element — and since gallery cards are now 3-per-row (~115px
   * wide) but in-hand / on-board cards are 48–60px, the ghost was much
   * larger than the destination slot. Sized to match `.pz-touch-drag-
   * ghost` (60×84) so the desktop ghost is visually consistent with
   * the existing mobile-touch ghost.
   *
   * Implementation: builds a transient absolutely-positioned <div>
   * with a card image, attaches it to body (off-viewport so it doesn't
   * flicker), calls `setDragImage`, then schedules removal on next
   * tick — by which point the browser has already cached the image.
   */
  const setDragGhost = useCallback((e, cardName) => {
    if (!e?.dataTransfer?.setDragImage) return;
    const ghost = document.createElement('div');
    ghost.style.cssText = 'position:absolute;top:-1000px;left:-1000px;width:60px;height:84px;border:2px solid var(--accent,#0ff);border-radius:4px;background:var(--bg3,#222);overflow:hidden;';
    const url = cardImageUrl(cardName);
    if (url) {
      const img = document.createElement('img');
      img.src = url;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
      img.draggable = false;
      ghost.appendChild(img);
    } else {
      ghost.textContent = cardName;
      ghost.style.color = '#fff';
      ghost.style.fontSize = '8px';
      ghost.style.padding = '4px';
    }
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 30, 42);
    setTimeout(() => { try { document.body.removeChild(ghost); } catch {} }, 0);
  }, []);
  const onDragEnd = useCallback(() => { setDragCardName(null); setDragHandIdx(null); setDragSource(null); setDragHandSource(null); setDragOverZone(null); dragEntityData.current = null; }, []);
  // Silently clear a zone (no return to hand — used when moving between zones)
  const clearZone = useCallback((zt, si, hi, slot) => {
    if (zt === 'hero') updatePlayer(si, (p) => { p.heroes[hi] = null; p.abilityZones[hi] = [[], [], []]; p.supportZones[hi] = [[], [], []]; p.surpriseZones[hi] = []; if (p.islandZoneCount) p.islandZoneCount[hi] = 0; return p; });
    else if (zt === 'ability') updatePlayer(si, (p) => { p.abilityZones[hi][slot] = []; return p; });
    else if (zt === 'support') updatePlayer(si, (p) => {
      const removedCard = p.supportZones[hi][slot]?.[0];
      p.supportZones[hi][slot] = [];
      // Clear creature metadata for this slot
      if (p._customSupportHp?.[hi]) p._customSupportHp[hi][slot] = null;
      if (p._creatureStatuses) delete p._creatureStatuses[hi + '-' + slot];
      if (removedCard === 'Flying Island in the Sky') {
        const ic = (p.islandZoneCount || [0,0,0])[hi] || 0;
        const rm = Math.min(2, ic);
        if (rm > 0) { p.supportZones[hi].splice(p.supportZones[hi].length - rm, rm); p.islandZoneCount[hi] = ic - rm; }
      }
      return p;
    });
    else if (zt === 'surprise') updatePlayer(si, (p) => { p.surpriseZones[hi] = []; return p; });
    else if (zt === 'area') updateArea(si, () => []);
    else if (zt === 'permanent') updatePlayer(si, (p) => { p.permanents.splice(slot, 1); return p; });
  }, [updatePlayer, updateArea]);

  const handleDrop = useCallback((zt, si, hi, slot) => {
    if (dragCardName == null) return;
    if (!canDrop(dragCardName, zt, si, hi, slot)) return;
    // Same-zone drop (e.g. dragging a hero back onto its own zone): no-op.
    // Skipping this is critical — otherwise clearZone + placeHero would
    // wipe the hero's ability/support zones and play a stray placement SFX.
    if (dragSource && dragSource.zt === zt && dragSource.si === si && dragSource.hi === hi && dragSource.slot === slot) {
      setDragCardName(null); setDragHandIdx(null); setDragSource(null); setDragHandSource(null); setDragOverZone(null); dragEntityData.current = null;
      return;
    }
    const entityData = dragEntityData.current;
    // Remove from source first (board zone or hand)
    if (dragSource) clearZone(dragSource.zt, dragSource.si, dragSource.hi, dragSource.slot);
    if (dragHandIdx != null) { if (dragHandSource === 'oppHand') removeFromOppHand(dragHandIdx); else removeFromHand(dragHandIdx); }
    // Place in target
    if (zt === 'hero') placeHero(dragCardName, si, hi);
    else if (zt === 'ability') placeAbility(dragCardName, si, hi, slot);
    else if (zt === 'support') placeSupport(dragCardName, si, hi, slot);
    else if (zt === 'surprise') placeSurprise(dragCardName, si, hi);
    else if (zt === 'area') placeArea(dragCardName, si);
    else if (zt === 'permanent') placePermanent(dragCardName, si);
    // Restore entity metadata from drag source
    if (entityData) {
      if (zt === 'hero' && entityData.type === 'hero') {
        updatePlayer(si, (p) => {
          if (p.heroes[hi]) {
            p.heroes[hi].hp = entityData.data.hp;
            p.heroes[hi].maxHp = entityData.data.maxHp;
            p.heroes[hi].atk = entityData.data.atk;
            if (entityData.data.hp <= 0) {
              p.heroes[hi].statuses = {};
              p.heroes[hi].buffs = undefined;
            } else {
              p.heroes[hi].statuses = entityData.data.statuses || {};
              if (entityData.data.buffs) p.heroes[hi].buffs = entityData.data.buffs;
            }
          }
          return p;
        });
      } else if (zt === 'support' && entityData.type === 'support') {
        updatePlayer(si, (p) => {
          if (entityData.data.customHp != null) {
            if (!p._customSupportHp) p._customSupportHp = [[null,null,null],[null,null,null],[null,null,null]];
            p._customSupportHp[hi][slot] = entityData.data.customHp;
          }
          if (entityData.data.statuses) {
            if (!p._creatureStatuses) p._creatureStatuses = {};
            p._creatureStatuses[hi + '-' + slot] = entityData.data.statuses;
          }
          return p;
        });
      }
    }
    setDragCardName(null); setDragHandIdx(null); setDragSource(null); setDragHandSource(null); setDragOverZone(null); dragEntityData.current = null;
  }, [dragCardName, dragHandIdx, dragHandSource, dragSource, canDrop, clearZone, placeHero, placeAbility, placeSupport, placeSurprise, placeArea, placePermanent, removeFromHand, removeFromOppHand, updatePlayer]);

  // Drop onto player hand zone
  const handleHandDrop = useCallback((e) => {
    e.preventDefault();
    if (dragCardName == null) return;
    // Own hand → own hand is a no-op; don't emit SFX in that case.
    const noop = dragHandSource === 'hand' && dragHandIdx != null;
    if (dragSource) clearZone(dragSource.zt, dragSource.si, dragSource.hi, dragSource.slot);
    // From oppHand → remove from there and add here
    if (dragHandSource === 'oppHand' && dragHandIdx != null) { removeFromOppHand(dragHandIdx); setHand(prev => [...prev, dragCardName]); }
    // From board or gallery → add to hand
    else if (dragHandIdx == null) setHand(prev => [...prev, dragCardName]);
    // From own hand → no-op (reorder not needed)
    if (!noop && window.playSFX) window.playSFX('draw');
    setDragCardName(null); setDragHandIdx(null); setDragSource(null); setDragHandSource(null); setDragOverZone(null); dragEntityData.current = null;
  }, [dragCardName, dragHandIdx, dragHandSource, dragSource, clearZone, removeFromOppHand]);

  // Drop onto opponent hand zone
  const handleOppHandDrop = useCallback((e) => {
    e.preventDefault();
    if (dragCardName == null) return;
    const noop = dragHandSource === 'oppHand' && dragHandIdx != null;
    if (dragSource) clearZone(dragSource.zt, dragSource.si, dragSource.hi, dragSource.slot);
    // From player hand → remove from there and add here
    if (dragHandSource === 'hand' && dragHandIdx != null) { removeFromHand(dragHandIdx); setOppHand(prev => [...prev, dragCardName]); }
    // From board or gallery → add to opp hand
    else if (dragHandIdx == null) setOppHand(prev => [...prev, dragCardName]);
    // From own oppHand → no-op (reorder not needed)
    if (!noop && window.playSFX) window.playSFX('draw');
    setDragCardName(null); setDragHandIdx(null); setDragSource(null); setDragHandSource(null); setDragOverZone(null); dragEntityData.current = null;
  }, [dragCardName, dragHandIdx, dragHandSource, dragSource, clearZone, removeFromHand]);

  // ── Pile zone helpers ──
  const handlePileDrop = useCallback((e, si, key) => {
    e.preventDefault(); setDragOverZone(null);
    if (dragCardName == null) return;
    if (dragSource) clearZone(dragSource.zt, dragSource.si, dragSource.hi, dragSource.slot);
    if (dragHandIdx != null) { if (dragHandSource === 'oppHand') removeFromOppHand(dragHandIdx); else removeFromHand(dragHandIdx); }
    updatePlayer(si, pp => { pp[key].push(dragCardName); return pp; });
    setDragCardName(null); setDragHandIdx(null); setDragSource(null); setDragHandSource(null); dragEntityData.current = null;
  }, [dragCardName, dragHandIdx, dragHandSource, dragSource, clearZone, removeFromHand, removeFromOppHand, updatePlayer]);

  const removePileCard = useCallback((si, key, idx) => {
    updatePlayer(si, pp => { pp[key].splice(idx, 1); return pp; });
    // Auto-close if empty
    if (viewPile && viewPile.si === si && viewPile.key === key && players[si][key].length <= 1) setViewPile(null);
  }, [updatePlayer, viewPile, players]);

  const movePileCard = useCallback((si, key, fromIdx, toIdx) => {
    updatePlayer(si, pp => {
      const card = pp[key].splice(fromIdx, 1)[0];
      pp[key].splice(toIdx, 0, card);
      return pp;
    });
  }, [updatePlayer]);

  // ── Stat editor ──
  const [editStatuses, setEditStatuses] = useState({});
  const [editBuffs, setEditBuffs] = useState({});
  const [editBiomancyLevel, setEditBiomancyLevel] = useState(null);
  // Sleeping Beauty link target: slot index (0/1/2) of the linked
  // hero, or null when no link is set. The link is per-SLOT, not per-
  // hero name, so a hero swapped into the slot mid-puzzle inherits the
  // tether automatically (matches the in-game behavior).
  const [editLinkedHeroSlot, setEditLinkedHeroSlot] = useState(null);
  // For Dream-Landers Creatures: tracks which Hero (if any) is attached
  // to the Creature being edited. Null = no Hero attached.
  const [editAttachedHero, setEditAttachedHero] = useState(null);
  // For Cute Hydra: number of Head Counters on the creature being edited.
  // Null when the open editor target isn't a Cute Hydra.
  const [editHeadCounter, setEditHeadCounter] = useState(null);
  // For Cosmic Depths counter-consumers (Argos / Analyzer / Gatherer):
  // number of Change Counters this card starts the puzzle with. Argos is
  // a Hero (counters live on `hero._changeCounters`); Analyzer + Gatherer
  // are Creatures (counters live on `inst.counters.changeCounter` and
  // are puzzle-saved under `_creatureStatuses[hi-slot].changeCounter`).
  // Null when the open editor target isn't one of these cards.
  const [editChangeCounter, setEditChangeCounter] = useState(null);
  // For the Waflav archetype: number of Evolution Counters the Hero starts
  // the puzzle with. Lives on `hero._evolutionCounters` — same shape as
  // Argos' Change Counters. Null when the open editor target isn't a
  // Waflav form, so the section stays hidden.
  const [editEvolutionCounter, setEditEvolutionCounter] = useState(null);
  // For Charm of Balance: number of Balance Counters this Equipment starts
  // the puzzle with. Saved under `_creatureStatuses[hi-slot].balance` and
  // applied server-side as `inst.counters.balance` (alongside headCounter
  // and changeCounter). Null for non-Charm targets so the editor section
  // stays hidden.
  const [editBalanceCounter, setEditBalanceCounter] = useState(null);
  // For Sparkfly Queen: which sacrifice gifts (Architect / Attendant /
  // Worker) the Queen carries. Gifts are normally granted by Hive's Crown
  // when sacrificing a Sparkfly Creature; in puzzle mode the author can
  // pre-stamp any combination directly. Saved under
  // `_creatureStatuses[hi-slot]._sparkflyGiftFlags` and applied
  // server-side via `grantInheritedAbility` from `_sparkfly-shared`. Null
  // when the open editor target isn't a Sparkfly Queen.
  const [editSparkflyGifts, setEditSparkflyGifts] = useState(null);
  // For Anti Magic: the level (1/2/3) of Spell immunity it grants the
  // host Hero. Stored under `_creatureStatuses[hi-slot].antiMagicLevel`
  // and applied server-side as both `inst.counters.antiMagicLevel` AND
  // the host Hero's `buffs.magic_immune.level`, so the badge tooltip
  // and target-filter both use the authored level. Null when the open
  // editor target isn't an Anti Magic.
  const [editAntiMagicLevel, setEditAntiMagicLevel] = useState(null);
  // Cards whose puzzle starting state can include Change Counters.
  // Hardcoded here because the script-side `cpuMeta.counterConsumer`
  // flag isn't reachable from the client; mirrors the convention used
  // for the Head-Counter / Sleeping-Beauty editors above.
  const COUNTER_CONSUMER_HEROES = new Set(['Argos, the Eye of the Cosmos']);
  // Waflav base form + all five Ascended forms. Matched via the card
  // database's `archetype` field rather than a hard-coded name list, so a
  // future sixth form works without touching the editor.
  const isWaflavHeroName = (name) => {
    if (!name) return false;
    const cd = getCard(name);
    return !!cd && cd.archetype === 'Waflav';
  };
  const COUNTER_CONSUMER_CREATURES = new Set([
    'Analyzer from the Cosmic Depths',
    'Gatherer from the Cosmic Depths',
  ]);
  const openStatEditor = useCallback((si, zt, hi, slot) => {
    const p = players[si];
    if (zt === 'hero') {
      const h = p.heroes[hi]; if (!h) return;
      setEditTarget({ si, zt, hi, slot });
      setEditHp(String(h.hp)); setEditMaxHp(String(h.maxHp)); setEditAtk(String(h.atk));
      // Hydrate statuses, collapsing Death Knight's Bound-with-source
      // into the cosmetic `silenced` toggle so the editor doesn't
      // surface both rows for the same effect.
      const heroStatuses = { ...(h.statuses || {}) };
      const dkBound = heroStatuses.bound;
      const isDkBound = dkBound && (typeof dkBound === 'object')
        && dkBound.source === 'Skeleton Death Knight';
      if (isDkBound) {
        delete heroStatuses.bound;
        heroStatuses.silenced = true;
      }
      setEditStatuses(heroStatuses);
      setEditBuffs({ ...(h.buffs || {}) });
      // Argos starts the puzzle with N Change Counters — hydrate the
      // counter input from the saved hero state. Null for non-Argos
      // heroes so the editor section stays hidden.
      setEditChangeCounter(COUNTER_CONSUMER_HEROES.has(h.name)
        ? (h._changeCounters || 0)
        : null);
      setEditEvolutionCounter(isWaflavHeroName(h.name)
        ? (h._evolutionCounters || 0)
        : null);
    } else if (zt === 'support') {
      const cards = p.supportZones[hi][slot]; if (!cards.length) return;
      const c = getCard(cards[0]);
      setEditTarget({ si, zt, hi, slot });
      setEditHp(String(c?.hp ? (p._customSupportHp?.[hi]?.[slot] ?? c.hp) : '')); setEditMaxHp(''); setEditAtk('');
      const cs = p._creatureStatuses?.[hi + '-' + slot] || {};
      // Strip `buffs` out of editStatuses cleanly — they're tracked in
      // editBuffs. Spreading `cs` directly (as before) carried the buffs
      // key through, which then survived the save path because saveStats
      // did `merged = { ...editStatuses }` without clearing the legacy
      // key, so unchecking every buff couldn't actually remove them.
      const { buffs: _csBuffs, ...csWithoutBuffs } = cs;
      // Collapse Death Knight's negated+_dkSilenced pairing into the
      // cosmetic `silenced` toggle. Mirrors the hero-side hydration:
      // we don't want both rows lit up for the same effect.
      if (csWithoutBuffs.negated && csWithoutBuffs._dkSilenced) {
        delete csWithoutBuffs.negated;
        delete csWithoutBuffs._dkSilenced;
        csWithoutBuffs.silenced = true;
      }
      setEditStatuses(csWithoutBuffs);
      setEditBuffs({ ...(cs.buffs || {}) });
      // Biomancy Token: Potion in a support zone — carries a `biomancyLevel`
      // in creatureStatuses. Hydrate the level picker so the dedicated
      // editor branch shows and the generic stat/status inputs are hidden.
      setEditBiomancyLevel(c?.cardType === 'Potion' ? (cs.biomancyLevel || 1) : null);
      // Dream-Landers attach: hydrate the toggle from the saved state.
      setEditAttachedHero(cs.attachedHero || null);
      // Cute Hydra: hydrate Head Counter from the saved state. Null
      // for non-Hydra creatures so the editor section stays hidden.
      setEditHeadCounter(c?.name === 'Cute Hydra' ? (cs.headCounter || 0) : null);
      // Sleeping Beauty: hydrate the linked-hero slot. `_linkedHeroIdx`
      // is a slot index (0/1/2) into the controller's heroes array.
      // Default to null so the picker reads as "no link" until the
      // author commits to a slot.
      setEditLinkedHeroSlot(c?.name === 'Sleeping Beauty'
        ? (typeof cs._linkedHeroIdx === 'number' ? cs._linkedHeroIdx : null)
        : null);
      // Analyzer / Gatherer can start the puzzle with N Change Counters
      // — hydrate from the saved creature-status. Null for other
      // Creatures so the editor section stays hidden.
      setEditChangeCounter(COUNTER_CONSUMER_CREATURES.has(c?.name)
        ? (cs.changeCounter || 0)
        : null);
      // Charm of Balance: hydrate Balance Counters from the saved state.
      // Null for non-Charm targets so the editor section stays hidden.
      setEditBalanceCounter(c?.name === 'Charm of Balance'
        ? (cs.balance || 0)
        : null);
      // Sparkfly Queen: hydrate the gift checklist from the saved
      // `_sparkflyGiftFlags`. Null for other Creatures so the editor
      // section stays hidden.
      setEditSparkflyGifts(c?.name === 'Sparkfly Queen'
        ? {
            architect: !!cs._sparkflyGiftFlags?.architect,
            attendant: !!cs._sparkflyGiftFlags?.attendant,
            worker:    !!cs._sparkflyGiftFlags?.worker,
          }
        : null);
      // Anti Magic: hydrate the immunity level (1/2/3). Default to 1
      // when no level is saved yet so the picker has a sensible
      // starting point. Null for non-Anti-Magic targets so the editor
      // section stays hidden.
      setEditAntiMagicLevel(c?.name === 'Anti Magic'
        ? Math.max(1, Math.min(3, cs.antiMagicLevel || 1))
        : null);
    }
  }, [players, getCard]);

  const saveStats = useCallback(() => {
    if (!editTarget) return;
    const { si, zt, hi, slot } = editTarget;
    if (zt === 'hero') updatePlayer(si, (p) => {
      if (p.heroes[hi]) {
        p.heroes[hi].hp = parseInt(editHp) || 0;
        p.heroes[hi].maxHp = parseInt(editMaxHp) || 0;
        p.heroes[hi].atk = parseInt(editAtk) || 0;
        if (p.heroes[hi].hp <= 0) {
          p.heroes[hi].statuses = {};
          p.heroes[hi].buffs = undefined;
        } else {
          // Expand Death Knight's `silenced` cosmetic toggle into the
          // underlying primitive: Bound with `source: "Skeleton Death
          // Knight"`. The status badge keys on that source to render
          // the Silenced badge in-game; the engine's natural-expiry
          // pipeline handles the rest unchanged.
          const heroStatusOut = { ...editStatuses };
          if (heroStatusOut.silenced) {
            delete heroStatusOut.silenced;
            heroStatusOut.bound = { source: 'Skeleton Death Knight' };
          }
          p.heroes[hi].statuses = heroStatusOut;
          p.heroes[hi].buffs = Object.keys(editBuffs).length > 0 ? { ...editBuffs } : undefined;
        }
        // Argos: persist Change Counters as `_changeCounters` on the
        // hero — the engine reads this directly via the shared cosmic
        // helpers (getChangeCounters / removeChangeCounters), so the
        // puzzle Argos starts with the authored counter value.
        if (editChangeCounter != null && editChangeCounter > 0) {
          p.heroes[hi]._changeCounters = editChangeCounter;
        } else {
          delete p.heroes[hi]._changeCounters;
        }
        // Waflav: Evolution Counters decide which Ascended forms are
        // reachable, so authoring them is what makes a Waflav puzzle
        // playable at all (4 counters = Deep-Drowned on turn 1).
        if (editEvolutionCounter != null && editEvolutionCounter > 0) {
          p.heroes[hi]._evolutionCounters = editEvolutionCounter;
        } else {
          delete p.heroes[hi]._evolutionCounters;
        }
      }
      return p;
    });
    else if (zt === 'support') updatePlayer(si, (p) => {
      const cards = p.supportZones[hi]?.[slot] || [];
      const c = cards.length ? getCard(cards[0]) : null;
      const isEquip = c && c.cardType === 'Artifact' && (c.subtype || '').toLowerCase() === 'equipment';
      const isBiomancyToken = c?.cardType === 'Potion' && editBiomancyLevel != null;
      // Biomancy Token: the saved state is ONLY biomancyLevel + the HP
      // derived from the level. Everything else is stripped.
      if (isBiomancyToken) {
        const lv = Math.max(1, Math.min(3, editBiomancyLevel || 1));
        const stats = { 1: 40, 2: 60, 3: 80 }[lv];
        if (!p._customSupportHp) p._customSupportHp = [[null,null,null],[null,null,null],[null,null,null]];
        p._customSupportHp[hi][slot] = stats;
        if (!p._creatureStatuses) p._creatureStatuses = {};
        p._creatureStatuses[hi + '-' + slot] = { biomancyLevel: lv };
        return p;
      }
      if (editHp !== '') {
        if (!p._customSupportHp) p._customSupportHp = [[null,null,null],[null,null,null],[null,null,null]];
        p._customSupportHp[hi][slot] = parseInt(editHp) || 0;
      }
      if (!p._creatureStatuses) p._creatureStatuses = {};
      // Equip Artifacts: strip out every status/buff that isn't AME so
      // stale creature-data doesn't persist across a Creature → Equip swap.
      let merged;
      if (isEquip) {
        merged = {};
        if (editBuffs.anti_magic_enchanted) merged.buffs = { anti_magic_enchanted: true };
      } else {
        merged = { ...editStatuses };
        // Defensive: always drop any legacy `buffs` field that might have
        // leaked in from the editStatuses spread. editBuffs is the sole
        // source of truth for buffs, so an empty editBuffs means the
        // saved state must not have any `buffs` key.
        delete merged.buffs;
        // Expand Death Knight's `silenced` cosmetic toggle into the
        // underlying primitives: `negated` (functional negation) +
        // `_dkSilenced` (cosmetic marker StatusBadges keys on for the
        // Silenced badge). Server-side puzzle loader propagates both
        // onto inst.counters at game start.
        if (merged.silenced) {
          delete merged.silenced;
          merged.negated = true;
          merged._dkSilenced = true;
        }
        if (Object.keys(editBuffs).length > 0) merged.buffs = { ...editBuffs };
      }
      // Dream-Landers attach: persist `attachedHero` only if set so the
      // puzzle JSON stays clean for Creatures without an attachment.
      delete merged.attachedHero;
      if (editAttachedHero) merged.attachedHero = editAttachedHero;
      // Cute Hydra: persist `headCounter` only when the editor was open
      // on a Hydra (editHeadCounter !== null) AND the value is positive.
      // 0 / null leave the key absent so the puzzle JSON stays clean
      // for non-Hydra creatures.
      delete merged.headCounter;
      if (editHeadCounter != null && editHeadCounter > 0) {
        merged.headCounter = editHeadCounter;
      }
      // Sleeping Beauty: persist the linked-hero slot when the author
      // committed to one. `_linkedHeroOwner` is implicit (= si, Beauty's
      // controller) and stamped server-side. Slot null = no link.
      delete merged._linkedHeroIdx;
      delete merged._linkedHeroOwner;
      if (c?.name === 'Sleeping Beauty' && editLinkedHeroSlot != null) {
        merged._linkedHeroIdx = editLinkedHeroSlot;
      }
      // Analyzer / Gatherer: persist starting Change Counters. The
      // server's puzzle loader applies this to `inst.counters.changeCounter`
      // (see `cs.changeCounter` branch alongside `cs.headCounter`).
      delete merged.changeCounter;
      if (editChangeCounter != null && editChangeCounter > 0) {
        merged.changeCounter = editChangeCounter;
      }
      // Charm of Balance: persist starting Balance Counters. Server
      // applies as `inst.counters.balance`.
      delete merged.balance;
      if (editBalanceCounter != null && editBalanceCounter > 0) {
        merged.balance = editBalanceCounter;
      }
      // Sparkfly Queen: persist the gift checklist. Server reads
      // `_sparkflyGiftFlags` and runs the same `grantInheritedAbility`
      // path Hive's Crown uses, so the buffs / inherited-effect text /
      // Attendant immunity all line up identically with a live game.
      delete merged._sparkflyGiftFlags;
      if (editSparkflyGifts && (editSparkflyGifts.architect || editSparkflyGifts.attendant || editSparkflyGifts.worker)) {
        merged._sparkflyGiftFlags = {
          architect: !!editSparkflyGifts.architect,
          attendant: !!editSparkflyGifts.attendant,
          worker:    !!editSparkflyGifts.worker,
        };
      }
      // Anti Magic: persist the immunity level. Server applies it as
      // `inst.counters.antiMagicLevel` AND stamps the host Hero's
      // `buffs.magic_immune.level` so the badge + target-filter both
      // read the authored level.
      delete merged.antiMagicLevel;
      if (c?.name === 'Anti Magic' && editAntiMagicLevel != null) {
        merged.antiMagicLevel = Math.max(1, Math.min(3, editAntiMagicLevel));
      }
      p._creatureStatuses[hi + '-' + slot] = merged;
      return p;
    });
    setEditTarget(null);
  }, [editTarget, editHp, editMaxHp, editAtk, editStatuses, editBuffs, editBiomancyLevel, editAttachedHero, editHeadCounter, editLinkedHeroSlot, editChangeCounter, editEvolutionCounter, editBalanceCounter, editSparkflyGifts, editAntiMagicLevel, updatePlayer, getCard]);

  const toggleHeroDead = useCallback(() => {
    if (!editTarget || editTarget.zt !== 'hero') return;
    const { si, hi } = editTarget;
    const h = players[si].heroes[hi];
    if (!h) return;
    if (h.hp > 0) {
      // Kill: set HP to 0, clear all statuses and buffs
      setEditHp('0');
      setEditStatuses({});
      setEditBuffs({});
      updatePlayer(si, (p) => { if (p.heroes[hi]) { p.heroes[hi].hp = 0; p.heroes[hi].statuses = {}; p.heroes[hi].buffs = undefined; } return p; });
    } else {
      // Revive: set HP to maxHp
      const full = String(h.maxHp || 0);
      setEditHp(full);
      updatePlayer(si, (p) => { if (p.heroes[hi]) p.heroes[hi].hp = p.heroes[hi].maxHp; return p; });
    }
  }, [editTarget, players, updatePlayer]);

  const handleVerify = useCallback(() => {
    if (!players[0].heroes.some(Boolean) || !players[1].heroes.some(Boolean)) { notify('Both sides need at least one Hero!', 'error'); return; }
    // Hand size pre-check — uses the shared hand-limit registry so Pollution
    // Tokens, Royal Corgi, Big Gwen, and any future cap-modifying card are
    // accounted for automatically. The registry lives in app-shared.jsx
    // and must stay in sync with the engine's counter semantics.
    const maxHand0 = window.computeSupportHandLimit(players[0], areaZones?.[0] || []);
    if (hand.length > maxHand0) {
      notify('Your hand has too many cards! (max ' + (maxHand0 === Infinity ? '∞' : maxHand0) + ' given the current board)', 'error');
      return;
    }
    const maxHand1 = window.computeSupportHandLimit(players[1], areaZones?.[1] || []);
    if (oppHand.length > maxHand1) {
      notify('Opponent hand has too many cards! (max ' + (maxHand1 === Infinity ? '∞' : maxHand1) + ' given the current board)', 'error');
      return;
    }
    // Send puzzle to server — starts a real battle against a CPU opponent
    puzzleIgnoreRef.current = false;
    socket.emit('start_puzzle', { players, areaZones, doomCounters, hand, oppHand, playerDebuffs: [meDebuffs, oppDebuffs] });
  }, [players, areaZones, doomCounters, hand, oppHand, meDebuffs, oppDebuffs, notify]);

  const handleExport = useCallback(() => {
    if (!validated) return;
    const data = { players, areaZones, doomCounters, hand, oppHand, playerDebuffs: [meDebuffs, oppDebuffs], version: 1 };
    socket.emit('export_puzzle', data);
  }, [validated, players, areaZones, hand, oppHand, meDebuffs, oppDebuffs]);

  // Listen for encrypted puzzle from server
  useEffect(() => {
    const onExported = ({ data }) => {
      const fileName = (puzzleName.trim() || 'puzzle') + '.json';
      const blob = new Blob([JSON.stringify({ data })], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fileName; a.click();
      URL.revokeObjectURL(url);
      notify('Puzzle exported!', 'success');
    };
    socket.on('puzzle_exported', onExported);
    return () => socket.off('puzzle_exported', onExported);
  }, [puzzleName, notify]);

  useEffect(() => {
    const h = (e) => {
      if (e.key !== 'Escape') return;
      // While the embedded GameBoard puzzle battle is running, let its
      // own Escape handler take precedence — don't tear down the
      // creator from underneath it.
      if (puzzleGameState) return;
      // Pop-ups close one level at a time so a "viewing a deck pile"
      // Escape doesn't boot the whole creator. Order matters: most
      // transient overlay first, navigation away last.
      if (viewPile)           { e.preventDefault(); e.stopImmediatePropagation(); if (window.playSFX) window.playSFX('ui_cancel', { volume: 0.4 }); setViewPile(null);            return; }
      if (debuffMenuOpen)     { e.preventDefault(); e.stopImmediatePropagation(); if (window.playSFX) window.playSFX('ui_cancel', { volume: 0.4 }); setDebuffMenuOpen(null);      return; }
      if (removePopupPos)     { e.preventDefault(); e.stopImmediatePropagation(); if (window.playSFX) window.playSFX('ui_cancel', { volume: 0.4 }); setRemovePopupPos(null);      return; }
      if (mobileSelected)     { e.preventDefault(); e.stopImmediatePropagation(); if (window.playSFX) window.playSFX('ui_cancel', { volume: 0.4 }); setMobileSelected(null);      return; }
      if (editTarget)         { e.preventDefault(); e.stopImmediatePropagation(); if (window.playSFX) window.playSFX('ui_cancel', { volume: 0.4 }); setEditTarget(null);          return; }
      // No open overlay — actually leave the creator.
      e.stopImmediatePropagation();
      if (window.playSFX) window.playSFX('ui_cancel', { volume: 0.4 });
      setScreen('menu');
    };
    window.addEventListener('keydown', h, true); return () => window.removeEventListener('keydown', h, true);
  }, [editTarget, puzzleGameState, viewPile, debuffMenuOpen, removePopupPos, mobileSelected]);

  // ── Surprise eligibility: can the host Hero actually cast this
  //    Surprise (a Spell)? Mirrors the main board's canHeroPlayCard
  //    school+level rule, including ability-side gap coverage:
  //      • a matching spell-school stacked to >= the card's level, OR
  //      • Divinity (free) / Wisdom (paid) stacks covering the gap.
  //    Both Divinity AND Wisdom count here because Surprises are
  //    Spells (the board's drop-highlight excludes Wisdom only because
  //    that path also covers Creatures, which Wisdom can't). ──
  const isSurpriseUsable = useCallback((p, hi, cardName) => {
    const hero = p.heroes[hi];
    if (!hero) return false;
    const c = getCard(cardName);
    if (!c) return false;
    // No spell-school requirement → any Hero can use it.
    if (!c.spellSchool1 && !c.spellSchool2) return true;
    const level = (typeof c.level === 'number') ? c.level : 0;
    // Count stacked copies of an ability across the Hero's 3 slots.
    const abZones = p.abilityZones[hi] || [];
    const countAbility = (name) => {
      let n = 0;
      for (const slot of abZones) {
        if (!slot) continue;
        for (const ab of slot) if (ab === name) n++;
      }
      return n;
    };
    // Direct: a matching spell-school stacked to >= the card's level.
    if (c.spellSchool1 && countAbility(c.spellSchool1) >= level) return true;
    if (c.spellSchool2 && countAbility(c.spellSchool2) >= level) return true;
    // Gap coverage: Divinity (free) + Wisdom (paid) stacks act as
    // wildcard level contributors toward either declared school —
    // matches the engine's combined coverage semantics.
    const cover = countAbility('Divinity') + countAbility('Wisdom');
    if (cover > 0) {
      if (c.spellSchool1 && countAbility(c.spellSchool1) + cover >= level) return true;
      if (c.spellSchool2 && countAbility(c.spellSchool2) + cover >= level) return true;
    }
    return false;
  }, [getCard]);

  // ── Status effect and buff constants ──
  const STATUS_LIST = [
    { key: 'frozen', label: '❄️ Frozen', color: '#66ccff',
      tooltip: 'Frozen: cannot act and has its effects and Abilities negated. Wears off at the end of its owner\'s turn.' },
    { key: 'stunned', label: '⚡ Stunned', color: '#ffdd44',
      tooltip: 'Stunned: cannot act and has its effects and Abilities negated. Wears off at the end of its owner\'s turn.' },
    { key: 'burned', label: '🔥 Burned', color: '#ff6633',
      tooltip: 'Burned: takes 60 damage at the start of each of its owner\'s turns. Permanent until cleansed or healed.' },
    { key: 'poisoned', label: '☠️ Poisoned', color: '#aa44ff', stacks: true,
      tooltip: 'Poisoned: takes 30 damage per stack at the start of each of its owner\'s turns. Permanent until cleansed or healed.' },
    { key: 'negated', label: '🚫 Negated', color: '#888',
      tooltip: 'Negated: has its effects negated. Heroes also lose their attached Abilities. Wears off at the end of its owner\'s turn.' },
    { key: 'bound', label: '⛓️ Bound', color: '#9988aa',
      tooltip: 'Bound: cannot perform Actions. Wears off at the end of its owner\'s turn.' },
    // Skeleton Death Knight's cosmetic skin of Bound (heroes) /
    // Negated (creatures). Saved by transforming the toggle into the
    // underlying primitives — `bound` with `source: 'Skeleton Death
    // Knight'` for heroes, `negated: 1` + `_dkSilenced: 1` for
    // creatures — so the engine's existing expiry / cleanse logic
    // handles it without per-card hacks. Hydrated by detecting those
    // markers on click and lighting up this toggle instead of the
    // underlying primitive.
    { key: 'silenced', label: '🤐 Silenced', color: '#1f8a44',
      tooltip: 'Silenced: Heroes cannot perform Actions; Creatures have their effects negated. Skeleton Death Knight\'s effect.' },
    { key: 'shielded', label: '🛡️ Shielded', color: '#44ddff',
      tooltip: 'Shielded: immune to ALL status effects (first-turn protection variant).' },
    { key: 'immune', label: '✨ Immune', color: '#ffdd88',
      tooltip: 'Immune: cannot have CC statuses (Frozen / Stunned / Negated / Bound) re-applied. Wears off at the start of its owner\'s next turn.' },
    { key: 'healReversed', label: '💔 Heal Reversed', color: '#ff4488',
      tooltip: 'Heal Reversed: any healing this target would receive deals damage instead.' },
    { key: 'untargetable', label: '👻 Untargetable', color: '#aaaacc',
      tooltip: 'Untargetable: cannot be chosen as a target by Attacks, Spells, or Creature effects.' },
  ];
  const BUFF_LIST = [
    { key: 'cloudy', label: '☁️ Cloudy', color: '#88bbdd',
      tooltip: 'Cloudy: takes half damage from all sources.' },
    { key: 'freeze_immune', label: '🔥 Freeze Immune', color: '#ff8844',
      tooltip: 'Freeze Immune: cannot be Frozen.' },
    { key: 'submerged', label: '🌊 Submerged', color: '#4488ff', scope: 'oppHero',
      tooltip: 'Submerged: unaffected by all cards and effects while other possible targets exist on this side.' },
    { key: 'negative_status_immune', label: '😎 Status Immune', color: '#44ff88',
      tooltip: 'Negative Status Immune: cannot have any negative status effect applied.' },
    // String of Fine — 0-damage shield until controller's next turn.
    // True damage (Acid Vial, Rockfall, etc.) bypasses this by design.
    { key: 'damage_immune', label: '💠 Damage Immune', color: '#88ddff',
      tooltip: 'Damage Immune: takes no damage from any sources. (Bypassed by unblockable damage like Acid Vial.)' },
    // Taunt: the opponent must target this Hero/Creature with Attacks,
    // Spells, and Creature effects if possible. Multiple Taunters on a
    // side = opponent picks any. Applies to Heroes AND Creatures.
    { key: 'forcesTargeting', label: '🎯 Taunt', color: '#ff5060',
      tooltip: 'Taunt: the opponent MUST target this with Attacks / Spells / Creature effects when possible. Multiple Taunters → opponent picks one.' },
    // Equip-Artifact-only buff: Anti Magic Enchantment. The scope tag below
    // flips rendering so this buff ONLY shows up when editing an Equipment
    // Artifact, and for that zone type ONLY this buff is offered (all
    // creature/hero statuses + buffs are hidden).
    { key: 'anti_magic_enchanted', label: '🛡️ Anti Magic Enchantment', color: '#ffaa33', scope: 'equip',
      tooltip: 'Anti Magic Enchantment: once per turn, the controlling player may negate a Spell that hits the equipped Hero.' },
  ];

  // ── Column layout for island zone alignment across all rows (matching existing board) ──
  const columnLayout = useMemo(() => [0, 1, 2].map(hi => {
    const counts = [0, 1].map(pi => {
      const ic = (players[pi].islandZoneCount || [0,0,0])[hi] || 0;
      return { left: Math.floor(ic / 2), right: ic - Math.floor(ic / 2) };
    });
    return { maxLeft: Math.max(counts[0].left, counts[1].left), maxRight: Math.max(counts[0].right, counts[1].right) };
  }), [players]);

  // ── Zone drag/drop/click handlers applied directly on board-zone elements (no wrapper divs) ──
  const zh = (zt, si, hi, slot) => {
    const p = players[si];
    // Determine if this zone has a card (for making it draggable)
    const hasCard = (zt === 'hero' && p.heroes[hi]) || (zt === 'ability' && (p.abilityZones[hi]?.[slot]||[]).length > 0) ||
      (zt === 'support' && (p.supportZones[hi]?.[slot]||[]).length > 0) || (zt === 'surprise' && (p.surpriseZones[hi]||[]).length > 0) ||
      (zt === 'area' && areaZones[si].length > 0);
    // Get the card name for dragging
    const zoneCardName = hasCard ? (
      zt === 'hero' ? p.heroes[hi]?.name :
      zt === 'ability' ? (p.abilityZones[hi]?.[slot]||[])[0] :
      zt === 'support' ? (p.supportZones[hi]?.[slot]||[])[0] :
      zt === 'surprise' ? (p.surpriseZones[hi]||[])[0] :
      zt === 'area' ? areaZones[si][0] : null
    ) : null;
    return {
      'data-pz-zone': `${si}-${zt}-${hi}-${slot}`,
      draggable: !!hasCard && !isTouchDevice,
      onDragStart: (e) => {
        if (hasCard && zoneCardName) {
          // Override the natural HTML5 drag image with a clean card
          // ghost — without this, dragging an Area / hero / support
          // tile picks up a snapshot of the entire battlefield region
          // around the source element (the zone has no cropping bounds
          // for the browser's auto-ghost). The hand-side already routes
          // through `setDragGhost`; mirror it here so every drag source
          // gets the same 60×84 clean ghost.
          setDragGhost(e, zoneCardName);
          // Capture entity metadata for board-to-board moves
          if (zt === 'hero' && p.heroes[hi]) {
            dragEntityData.current = { type: 'hero', data: JSON.parse(JSON.stringify(p.heroes[hi])) };
          } else if (zt === 'support') {
            const key = hi + '-' + slot;
            dragEntityData.current = { type: 'support', data: {
              customHp: p._customSupportHp?.[hi]?.[slot] ?? null,
              statuses: p._creatureStatuses?.[key] ? JSON.parse(JSON.stringify(p._creatureStatuses[key])) : null,
            }};
          } else {
            dragEntityData.current = null;
          }
          onDragStart(e, zoneCardName, null, { zt, si, hi, slot });
        } else e.preventDefault();
      },
      onDragEnd,
      onDragOver: (e) => { e.preventDefault(); if (dragCardName && canDrop(dragCardName, zt, si, hi, slot)) { e.dataTransfer.dropEffect = 'move'; setDragOverZone(`${si}-${zt}-${hi}-${slot}`); } },
      onDragLeave: () => setDragOverZone(null),
      onDrop: (e) => { e.preventDefault(); setDragOverZone(null); handleDrop(zt, si, hi, slot); },
      onContextMenu: (e) => {
        if (hasCard) { e.preventDefault(); removeCard(si, zt, hi, slot); }
      },
      onClick: () => {
        // Mobile tap-to-place: if a card is selected, try placing it here
        if (mobileSelected && canDrop(mobileSelected.cardName, zt, si, hi, slot)) {
          const sel = mobileSelected;
          // Remove from source hand
          if (sel.handIdx != null) { if (sel.handSource === 'oppHand') removeFromOppHand(sel.handIdx); else removeFromHand(sel.handIdx); }
          // Place in target
          if (zt === 'hero') placeHero(sel.cardName, si, hi);
          else if (zt === 'ability') placeAbility(sel.cardName, si, hi, slot);
          else if (zt === 'support') placeSupport(sel.cardName, si, hi, slot);
          else if (zt === 'surprise') placeSurprise(sel.cardName, si, hi);
          else if (zt === 'area') placeArea(sel.cardName, si);
          else if (zt === 'permanent') placePermanent(sel.cardName, si);
          setMobileSelected(null);
          return;
        }
        if (!isTouchDevice) {
          if (zt === 'hero' && p.heroes[hi]) openStatEditor(si, zt, hi, 0);
          else if (zt === 'support' && (p.supportZones[hi]?.[slot]||[]).length) openStatEditor(si, zt, hi, slot);
        }
      },
      // Touch drag for board cards (mobile)
      onTouchStart: hasCard && zoneCardName ? (e) => touchDragStart(zoneCardName, null, null, { zt, si, hi, slot }, e) : undefined,
      onTouchMove: hasCard ? touchDragMove : undefined,
      onTouchEnd: hasCard && zoneCardName ? (e) => {
        const wasDragging = touchDragRef.current?.dragging;
        touchDragEnd(e);
        if (!wasDragging) {
          e.preventDefault();
          if (zt === 'hero' && p.heroes[hi]) openStatEditor(si, zt, hi, 0);
          else if (zt === 'support' && (p.supportZones[hi]?.[slot]||[]).length) openStatEditor(si, zt, hi, slot);
        }
      } : undefined,
    };
  };
  const hl = (zt, si, hi, slot) => {
    if (dragOverZone === `${si}-${zt}-${hi}-${slot}` && dragCardName && canDrop(dragCardName, zt, si, hi, slot)) return { boxShadow: '0 0 14px rgba(0,240,255,.5)', zIndex: 5 };
    if (mobileSelected && canDrop(mobileSelected.cardName, zt, si, hi, slot)) return { boxShadow: '0 0 10px rgba(0,240,255,.3)', borderColor: 'var(--accent)' };
    return undefined;
  };

  // ── Render one player side ──
  const renderSide = (si, isOpp) => {
    const p = players[si];

    // Hero row — all children are DIRECT elements (no wrapper divs), matching existing board
    const heroRow = (
      <div className="board-row board-hero-row">
        {[0, 1, 2].flatMap(hi => {
          const hero = p.heroes[hi];
          const isDead = hero && hero.hp <= 0;
          const { maxLeft, maxRight } = columnLayout[hi];
          const heroGroup = (
            <div key={hi} className="board-hero-group" style={hi === 2 ? { position: 'relative' } : undefined}>
              {maxLeft > 0 && Array.from({ length: maxLeft }).map((_, s) => <div key={'lp'+s} className="board-zone-spacer" />)}
              <div className="board-zone-spacer" />
              <div className={'board-zone board-zone-hero' + (isDead ? ' board-zone-dead' : '')}
                style={{ ...zs('hero'), ...hl('hero', si, hi, 0) }}
                data-hero-zone="1" data-hero-idx={hi} data-hero-owner={isOpp ? 'opp' : 'me'}
                {...zh('hero', si, hi, 0)}>
                {hero ? <>
                  <BoardCard cardName={hero.name} hp={hero.hp} maxHp={hero.maxHp} atk={hero.atk} hpPosition="hero" />
                  {hero.statuses?.frozen && <FrozenOverlay />}
                  {(hero.statuses?.stunned || hero.statuses?.webbed) && <div className="status-stunned-overlay"><div className="stun-bolt s1" /><div className="stun-bolt s2" /><div className="stun-bolt s3" /></div>}
                  {hero.statuses?.negated && <NegatedOverlay />}
                  {hero.statuses?.burned && <BurnedOverlay />}
                  {hero.statuses?.poisoned && <PoisonedOverlay stacks={hero.statuses.poisoned.stacks || 1} />}
                  {hero.statuses?.healReversed && <HealReversedOverlay />}
                  {hero.statuses?.shielded && <ImmuneIcon heroName={hero.name} statusType="shielded" />}
                  {hero.statuses?.immune && !hero.statuses?.shielded && <ImmuneIcon heroName={hero.name} statusType="immune" />}
                  {(hero.statuses?.frozen || (hero.statuses?.stunned || hero.statuses?.webbed) || hero.statuses?.burned || hero.statuses?.poisoned || hero.statuses?.negated || hero.statuses?.nulled || hero.statuses?.healReversed || hero.statuses?.untargetable || hero.statuses?.charmed || hero.statuses?.bound || hero._extraLife) &&
                    <StatusBadges statuses={{ ...(hero.statuses || {}), _extraLife: hero._extraLife }} isHero={true} />}
                  {hero.buffs && <BuffColumn buffs={hero.buffs} />}
                </> : <div className="board-zone-empty">Hero</div>}
              </div>
              <div className="board-zone board-zone-surprise"
                style={{ ...zs('surprise'), ...hl('surprise', si, hi, 0) }}
                data-surprise-zone="1" data-surprise-owner={isOpp ? 'opp' : 'me'}
                {...zh('surprise', si, hi, 0)}>
                {(p.surpriseZones[hi]||[]).length > 0 ? (() => {
                  const sName = p.surpriseZones[hi][0];
                  const usable = isSurpriseUsable(p, hi, sName);
                  // Both sides render face-up in the editor — the author
                  // is placing them, so hiding the opponent's Surprises
                  // serves no purpose. Parity with puzzle-mode play,
                  // where opp Surprises are also face-up by design.
                  // The dim style (ability-school requirements unmet)
                  // applies uniformly to both sides since the identity
                  // is now visible either way.
                  return <BoardCard cardName={sName}
                    style={!usable ? { opacity: 0.45, filter: 'grayscale(0.7)' } : undefined} />;
                })() : <div className="board-zone-empty">Surp</div>}
              </div>
              {maxRight > 0 && Array.from({ length: maxRight }).map((_, s) => <div key={'rp'+s} className="board-zone-spacer" />)}
              {/* Coolness Stack — its OWN column, positioned to the right */}
              {/* of the rightmost Surprise Zone but to the left of the */}
              {/* Permanents column. Visible whenever Wowhalla is in this */}
              {/* player's Area (even if the stack is empty, so the user */}
              {/* can drag the first card onto it). Extracted from the */}
              {/* Permanents column so it doesn't push the permanents down. */}
              {hi === 2 && (areaZones[si] || []).includes('Wowhalla, the Hall of the Cool') && (
                <div style={{ position: 'absolute', left: '100%', top: 0, marginLeft: 'calc(8px * var(--board-scale))' }}>
                  <div className="board-zone" style={{ width: 'calc(50px * var(--board-scale))', height: 'calc(70px * var(--board-scale))', borderColor: 'rgba(120,210,255,.6)', background: 'rgba(120,210,255,.08)', cursor: (p.coolnessStack || []).length > 0 ? 'pointer' : undefined, position: 'relative', ...(dragOverZone === 'coolness-' + si ? { boxShadow: '0 0 14px rgba(120,210,255,.7)' } : {}) }}
                    onClick={() => (p.coolnessStack || []).length > 0 && setViewPile({ si, key: 'coolnessStack' })}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverZone('coolness-' + si); }}
                    onDragLeave={() => setDragOverZone(null)}
                    onDrop={(e) => handlePileDrop(e, si, 'coolnessStack')}>
                    {(p.coolnessStack || []).length > 0 ? <>
                      <BoardCard cardName={p.coolnessStack[p.coolnessStack.length - 1]} />
                      <div className="board-card-label">{p.coolnessStack.length}</div>
                    </> : <div className="board-zone-empty" style={{ color: 'rgba(120,210,255,.8)', fontSize: 'calc(8px * var(--board-scale))' }}>Coolness</div>}
                  </div>
                </div>
              )}
              {/* Permanents — inside last hero group, positioned to the */}
              {/* right of the Coolness Stack column (or the surprise zone */}
              {/* if no Stack is present). */}
              {hi === 2 && (
                <div style={{ position: 'absolute', left: '100%', top: 0, marginLeft: ((areaZones[si] || []).includes('Wowhalla, the Hall of the Cool') ? 'calc((50px + 16px) * var(--board-scale))' : 'calc(8px * var(--board-scale))'), display: 'flex', flexDirection: 'column', gap: 'calc(3px * var(--board-scale))' }}>
                  {p.permanents.map((pm, i) => (
                    <div key={pm.id} title={pm.name} onContextMenu={(e) => { e.preventDefault(); removeCard(si, 'permanent', 0, i); }}>
                      <div className="board-zone" style={{ width: 'calc(50px * var(--board-scale))', height: 'calc(70px * var(--board-scale))', borderColor: 'rgba(255,215,0,.5)', background: 'rgba(255,215,0,.08)', cursor: 'pointer' }}>
                        <BoardCard cardName={pm.name} />
                      </div>
                    </div>
                  ))}
                  <div className="board-zone" style={{ width: 'calc(50px * var(--board-scale))', height: 'calc(70px * var(--board-scale))', borderStyle: 'dashed', borderColor: 'rgba(255,215,0,.3)' }}
                    onDragOver={(e) => { e.preventDefault(); if (dragCardName) setDragOverZone('perm-' + si); }}
                    onDragLeave={() => setDragOverZone(null)}
                    onDrop={(e) => { e.preventDefault(); setDragOverZone(null); if (dragCardName != null) { if (dragSource) clearZone(dragSource.zt, dragSource.si, dragSource.hi, dragSource.slot); placePermanent(dragCardName, si); if (dragHandIdx != null) { if (dragHandSource === 'oppHand') removeFromOppHand(dragHandIdx); else removeFromHand(dragHandIdx); } setDragCardName(null); setDragHandIdx(null); setDragSource(null); setDragHandSource(null); dragEntityData.current = null; } }}>
                    <div className="board-zone-empty" style={{ fontSize: 'calc(8px * var(--board-scale))' }}>Perm</div>
                  </div>
                </div>
              )}
            </div>
          );
          if (hi < 2) return [heroGroup, <div key={'sp' + hi} className="board-area-spacer" />];
          return [heroGroup];
        })}
      </div>
    );

    // Ability row — spacers match island column widths + pile zones inside groups
    const abilityRow = (
      <div className="board-row">
        {[0, 1, 2].flatMap(hi => {
          const { maxLeft, maxRight } = columnLayout[hi];
          const group = (
            <div key={hi} className="board-hero-group" style={(hi === 0 || hi === 2) ? { position: 'relative' } : undefined}>
              {maxLeft > 0 && Array.from({ length: maxLeft }).map((_, s) => <div key={'lp'+s} className="board-zone-spacer" />)}
              {[0, 1, 2].map(slot => (
                <div key={slot} className="board-zone board-zone-ability"
                  style={{ ...zs('ability'), ...hl('ability', si, hi, slot) }}
                  data-ability-zone="1" data-ability-owner={isOpp ? 'opp' : 'me'}
                  {...zh('ability', si, hi, slot)}>
                  {(p.abilityZones[hi]?.[slot]||[]).length > 0 ? <BoardCard cardName={p.abilityZones[hi][slot][0]} label={p.abilityZones[hi][slot].length > 1 ? String(p.abilityZones[hi][slot].length) : undefined} /> : <div className="board-zone-empty">Ability</div>}
                </div>
              ))}
              {maxRight > 0 && Array.from({ length: maxRight }).map((_, s) => <div key={'rp'+s} className="board-zone-spacer" />)}
              {/* Deleted pile — inside first group, positioned to its left */}
              {hi === 0 && (
                <div className="board-zone board-zone-deleted" style={{ position: 'absolute', right: '100%', top: 0, marginRight: 'calc(8px * var(--board-scale))', ...zs('delete'), cursor: p.deletedPile.length ? 'pointer' : undefined, ...(dragOverZone === 'deleted-' + si ? { boxShadow: '0 0 14px rgba(0,240,255,.5)' } : {}) }}
                  onClick={() => p.deletedPile.length > 0 && setViewPile({ si, key: 'deletedPile' })}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverZone('deleted-' + si); }}
                  onDragLeave={() => setDragOverZone(null)}
                  onDrop={(e) => handlePileDrop(e, si, 'deletedPile')}>
                  {p.deletedPile.length > 0 ? <>
                    <BoardCard cardName={p.deletedPile[p.deletedPile.length - 1]} />
                    <div className="board-card-label">{p.deletedPile.length}</div>
                  </> : <div className="board-zone-empty">Deleted</div>}
                </div>
              )}
              {/* Potion Deck — inside last group, positioned to its right */}
              {hi === 2 && (
                <div className="board-zone" style={{ position: 'absolute', left: '100%', top: 0, marginLeft: 'calc(8px * var(--board-scale))', ...zs('potion'), cursor: p.potionDeck.length ? 'pointer' : undefined, ...(dragOverZone === 'potion-' + si ? { boxShadow: '0 0 14px rgba(0,240,255,.5)' } : {}) }}
                  onClick={() => p.potionDeck.length > 0 && setViewPile({ si, key: 'potionDeck' })}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverZone('potion-' + si); }}
                  onDragLeave={() => setDragOverZone(null)}
                  onDrop={(e) => handlePileDrop(e, si, 'potionDeck')}>
                  {p.potionDeck.length > 0 ? <>
                    <img src={user?.cardback || '/cardback.png'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
                    <div className="board-card-label">{p.potionDeck.length}</div>
                  </> : <div className="board-zone-empty">Potion</div>}
                </div>
              )}
            </div>
          );
          if (hi < 2) return [group, <div key={'sp' + hi} className="board-area-spacer" />];
          return [group];
        })}
      </div>
    );

    // Support row — island zones split left/right around base zones + pile zones inside groups
    const supportRow = (
      <div className="board-row">
        {[0, 1, 2].flatMap(hi => {
          const allSlots = p.supportZones[hi] || [[], [], []];
          const islandCount = (p.islandZoneCount || [0,0,0])[hi] || 0;
          const baseCount = allSlots.length - islandCount;
          const myLeft = Math.floor(islandCount / 2);
          const myRight = islandCount - myLeft;
          const { maxLeft, maxRight } = columnLayout[hi];

          const renderOrder = [];
          for (let s = 0; s < maxLeft - myLeft; s++) renderOrder.push({ type: 'spacer' });
          for (let li = 0; li < myLeft; li++) renderOrder.push({ type: 'zone', slot: baseCount + li, isIsland: true });
          for (let bz = 0; bz < baseCount; bz++) renderOrder.push({ type: 'zone', slot: bz, isIsland: false });
          for (let ri = 0; ri < myRight; ri++) renderOrder.push({ type: 'zone', slot: baseCount + myLeft + ri, isIsland: true });
          for (let s = 0; s < maxRight - myRight; s++) renderOrder.push({ type: 'spacer' });

          const group = (
            <div key={hi} className="board-hero-group" style={(hi === 0 || hi === 2) ? { position: 'relative' } : undefined}>
              {renderOrder.map((item, idx) => {
                if (item.type === 'spacer') return <div key={'sp'+idx} className="board-zone-spacer" />;
                const slot = item.slot;
                const cards = allSlots[slot] || [];
                const c = cards.length > 0 ? getCard(cards[0]) : null;
                return (
                  <div key={slot} className={'board-zone board-zone-support' + (item.isIsland ? ' board-zone-island' : '')}
                    style={{ ...zs('support'), ...hl('support', si, hi, slot) }}
                    data-support-zone="1" data-support-owner={isOpp ? 'opp' : 'me'}
                    {...zh('support', si, hi, slot)}>
                    {cards.length > 0 ? (() => {
                      const cs = p._creatureStatuses?.[hi + '-' + slot] || {};
                      // Biomancy Tokens render their HP bar from the stored
                      // level (40/60/80) even though the underlying Potion
                      // has no HP in its card data.
                      const isBiomancyToken = c?.cardType === 'Potion' && cs.biomancyLevel;
                      const bioStats = isBiomancyToken ? { 1: 40, 2: 60, 3: 80 }[cs.biomancyLevel] : null;
                      const showHp = !!(c?.hp || isBiomancyToken);
                      const hpVal = isBiomancyToken
                        ? (p._customSupportHp?.[hi]?.[slot] ?? bioStats)
                        : (c?.hp ? (p._customSupportHp?.[hi]?.[slot] ?? c.hp) : undefined);
                      const maxHpVal = isBiomancyToken ? bioStats : c?.hp;
                      // Override the hover tooltip for Biomancy Tokens so
                      // it shows the level-scaled effect text instead of
                      // the source Potion's original text.
                      const tooltipOverride = isBiomancyToken ? {
                        ...(c || {}),
                        name: 'Biomancy Token',
                        cardType: 'Creature/Token',
                        hp: bioStats,
                        effect: `You may once per turn deal ${bioStats} damage to any target on the board.`,
                      } : undefined;
                      return <>
                        <BoardCard cardName={cards[0]} hp={showHp ? hpVal : undefined} maxHp={maxHpVal} hpPosition={showHp ? 'bottom' : undefined} tooltipCardOverride={tooltipOverride} />
                        {isBiomancyToken && (
                          <div style={{ position: 'absolute', top: 2, left: 2, background: 'rgba(20,80,30,.9)', color: '#8fe8a0', fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 3, border: '1px solid rgba(80,200,120,.6)', pointerEvents: 'none' }}>Lv{cs.biomancyLevel}</div>
                        )}
                        {cs.frozen && <FrozenOverlay />}
                        {cs.burned && <BurnedOverlay />}
                        {cs.negated && <NegatedOverlay />}
                        {cs.poisoned && <PoisonedOverlay stacks={cs.poisoned.stacks || 1} />}
                        {(cs.frozen || cs.stunned || cs.burned || cs.poisoned || cs.negated || cs._extraLife) &&
                          <StatusBadges statuses={cs} isHero={false} />}
                        {cs.buffs && <BuffColumn buffs={cs.buffs} />}
                      </>;
                    })() : <div className="board-zone-empty">{item.isIsland ? 'Island' : 'Support'}</div>}
                  </div>
                );
              })}
              {/* Discard pile — inside first group, positioned to its left */}
              {hi === 0 && (
                <div className="board-zone" style={{ position: 'absolute', right: '100%', top: 0, marginRight: 'calc(8px * var(--board-scale))', ...zs('discard'), cursor: p.discardPile.length ? 'pointer' : undefined, ...(dragOverZone === 'discard-' + si ? { boxShadow: '0 0 14px rgba(0,240,255,.5)' } : {}) }}
                  onClick={() => p.discardPile.length > 0 && setViewPile({ si, key: 'discardPile' })}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverZone('discard-' + si); }}
                  onDragLeave={() => setDragOverZone(null)}
                  onDrop={(e) => handlePileDrop(e, si, 'discardPile')}>
                  {p.discardPile.length > 0 ? <>
                    <BoardCard cardName={p.discardPile[p.discardPile.length - 1]} />
                    <div className="board-card-label">{p.discardPile.length}</div>
                  </> : <div className="board-zone-empty">Discard</div>}
                </div>
              )}
              {/* Deck — inside last group, positioned to its right */}
              {hi === 2 && (
                <div className="board-zone" style={{ position: 'absolute', left: '100%', top: 0, marginLeft: 'calc(8px * var(--board-scale))', ...zs('deck'), cursor: p.mainDeck.length ? 'pointer' : undefined, ...(dragOverZone === 'deck-' + si ? { boxShadow: '0 0 14px rgba(0,240,255,.5)' } : {}) }}
                  onClick={() => p.mainDeck.length > 0 && setViewPile({ si, key: 'mainDeck' })}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverZone('deck-' + si); }}
                  onDragLeave={() => setDragOverZone(null)}
                  onDrop={(e) => handlePileDrop(e, si, 'mainDeck')}>
                  {p.mainDeck.length > 0 ? <>
                    <img src={user?.cardback || '/cardback.png'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
                    <div className="board-card-label">{p.mainDeck.length}</div>
                  </> : <div className="board-zone-empty">Deck</div>}
                </div>
              )}
              {/* Side Deck — editor-only zone right of the Deck. The
                  in-game board has no Side Deck slot in its layout, so
                  this stays hidden during test play; cards like Divine
                  Gift of Edge access `ps.sideDeck` directly via the
                  player state the server builds from this list. */}
              {hi === 2 && (
                <div className="board-zone" style={{ position: 'absolute', left: '100%', top: 0, marginLeft: 'calc(var(--zone-w) + 16px * var(--board-scale))', ...zs('deck'), cursor: p.sideDeck?.length ? 'pointer' : undefined, ...(dragOverZone === 'side-' + si ? { boxShadow: '0 0 14px rgba(0,240,255,.5)' } : {}) }}
                  onClick={() => (p.sideDeck?.length || 0) > 0 && setViewPile({ si, key: 'sideDeck' })}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverZone('side-' + si); }}
                  onDragLeave={() => setDragOverZone(null)}
                  onDrop={(e) => handlePileDrop(e, si, 'sideDeck')}
                  title="Side Deck (editor only — not visible during play)">
                  {(p.sideDeck?.length || 0) > 0 ? <>
                    <img src={user?.cardback || '/cardback.png'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
                    <div className="board-card-label">{p.sideDeck.length}</div>
                  </> : <div className="board-zone-empty">Side Deck</div>}
                </div>
              )}
            </div>
          );
          if (hi < 2) return [group, <div key={'sp' + hi} className="board-area-spacer" />];
          return [group];
        })}
      </div>
    );

    return (
      <div className="board-player-side">
        {isOpp
          ? <>{supportRow}{abilityRow}{heroRow}</>
          : <>{heroRow}{abilityRow}{supportRow}</>}
      </div>
    );
  };

  // ── Puzzle Battle Active: render GameBoard instead of creator UI ──
  if (puzzleGameState) {
    return (
      <GameBoard
        gameState={puzzleGameState}
        lobby={{ id: puzzleGameState.roomId }}
        onLeave={onPuzzleLeave}
        decks={[]}
        sampleDecks={[]}
        selectedDeck={null}
        setSelectedDeck={() => {}}
      />
    );
  }

  return (
    <div className="screen-full" style={{ background: 'linear-gradient(180deg, #0a0a12 0%, #10101d 40%, #0a0a12 100%)' }}>
      <div className="top-bar">
        <button className="btn" style={{ padding: '4px 12px', fontSize: 10 }} onClick={() => setScreen('menu')}>← BACK</button>
        <h2 className="orbit-font" style={{ fontSize: 22, fontWeight: 800, color: 'var(--player-color)' }}>PUZZLE CREATOR</h2>
        <input className="input" value={puzzleName} onChange={(e) => { setPuzzleName(e.target.value); setValidated(false); }}
          placeholder="Puzzle name..." style={{ width: 180, padding: '4px 10px', fontSize: 11, borderColor: 'rgba(255,136,0,.4)', color: '#ff8800' }} />
        {/* Doom Clock: Startzaehler je Seite. Erscheint nur, wenn
            ueberhaupt eine Uhr in einer Area-Zone liegt (Als Vorgabe
            5.8.). Max 19 — 20 waere sofortige Niederlage und als
            AUFBAU sinnlos. */}
        {[0, 1].map((si) => (
          (areaZones[si] || []).includes('Doom Clock') ? (
            <label key={'dcin' + si} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#ff8f8f' }}>
              ☠️ {si === 0 ? 'Me' : 'Opp'}
              <input className="input" type="number" min="0" max="19"
                value={doomCounters[si] ?? 0}
                onChange={(e) => {
                  const v = Math.max(0, Math.min(19, parseInt(e.target.value, 10) || 0));
                  setDoomCounters(prev => { const n = [...prev]; n[si] = v; return n; });
                  setValidated(false);
                }}
                style={{ width: 54, padding: '4px 6px', fontSize: 11, borderColor: 'rgba(220,70,70,.5)', color: '#ff8f8f' }} />
            </label>
          ) : null
        ))}
        <div style={{ flex: 1 }} />
        <button className="btn btn-danger" onClick={handleReset} style={{ padding: '0 14px', height: 28, display: 'inline-flex', alignItems: 'center', fontSize: 10 }}>↺ RESET</button>
        <button className="btn" onClick={handleVerify} style={{ padding: '0 14px', height: 28, display: 'inline-flex', alignItems: 'center', fontSize: 10, borderColor: 'var(--success)', color: 'var(--success)' }}>⚔️ TEST PUZZLE</button>
        <button className="btn" onClick={handleExport} disabled={!validated}
          style={{ padding: '0 14px', height: 28, display: 'inline-flex', alignItems: 'center', fontSize: 10, borderColor: validated ? '#ff8800' : 'var(--bg4)', color: validated ? '#ff8800' : 'var(--text2)', opacity: validated ? 1 : 0.4 }}>↓ EXPORT</button>
        {validated && <span className="badge" style={{ background: 'rgba(51,255,136,.12)', color: 'var(--success)', fontSize: 9, padding: '2px 8px' }}>VALIDATED</span>}
        <VolumeControl />
      </div>

      <div className="pz-layout">
        {/* ── Card Search Panel ── */}
        <div className="pz-search-panel">
          {/* ── Filter sidebar (mirrors the deck builder's filter set) ── */}
          {!puzzleFiltersCollapsed && (
          <div className="pz-filter-sidebar">
            <div className="orbit-font" style={{ fontSize: 10, color: 'var(--text2)', fontWeight: 700, letterSpacing: 1 }}>
              FILTERS
            </div>
            <input className="db-filter-input" placeholder="Search name..."
              value={puzzleFilters.name}
              onChange={e => setPuzzleFilters(p => ({ ...p, name: e.target.value }))} />
            <input className="db-filter-input" placeholder="Search effect text..."
              value={puzzleFilters.effect}
              onChange={e => setPuzzleFilters(p => ({ ...p, effect: e.target.value }))} />
            <select className="db-filter-select"
              value={puzzleFilters.cardType}
              onChange={e => setPuzzleFilters(p => ({ ...p, cardType: e.target.value }))}>
              <option value="">All Types</option>
              {(window.CARD_TYPES || []).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="db-filter-select"
              value={puzzleFilters.subtype}
              onChange={e => setPuzzleFilters(p => ({ ...p, subtype: e.target.value }))}>
              <option value="">All Subtypes</option>
              {(window.SUBTYPES || []).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="db-filter-select"
              value={puzzleFilters.archetype}
              onChange={e => setPuzzleFilters(p => ({ ...p, archetype: e.target.value }))}>
              <option value="">All Archetypes</option>
              {(window.ARCHETYPES || []).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="db-filter-select"
              value={puzzleFilters.ss1}
              onChange={e => setPuzzleFilters(p => ({ ...p, ss1: e.target.value }))}>
              <option value="">Spell School 1</option>
              {(window.SPELL_SCHOOLS || []).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="db-filter-select"
              value={puzzleFilters.ss2}
              onChange={e => setPuzzleFilters(p => ({ ...p, ss2: e.target.value }))}>
              <option value="">Spell School 2</option>
              {(window.SPELL_SCHOOLS || []).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="db-filter-select"
              value={puzzleFilters.sa1}
              onChange={e => setPuzzleFilters(p => ({ ...p, sa1: e.target.value }))}>
              <option value="">Starting Ability 1</option>
              {(window.STARTING_ABILITIES || []).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="db-filter-select"
              value={puzzleFilters.sa2}
              onChange={e => setPuzzleFilters(p => ({ ...p, sa2: e.target.value }))}>
              <option value="">Starting Ability 2</option>
              {(window.STARTING_ABILITIES || []).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
              <input className="db-filter-input" type="number" placeholder="Level"
                value={puzzleFilters.level}
                onChange={e => setPuzzleFilters(p => ({ ...p, level: e.target.value }))} />
              <input className="db-filter-input" type="number" placeholder="Cost"
                value={puzzleFilters.cost}
                onChange={e => setPuzzleFilters(p => ({ ...p, cost: e.target.value }))} />
              <input className="db-filter-input" type="number" placeholder="HP"
                value={puzzleFilters.hp}
                onChange={e => setPuzzleFilters(p => ({ ...p, hp: e.target.value }))} />
              <input className="db-filter-input" type="number" placeholder="ATK"
                value={puzzleFilters.atk}
                onChange={e => setPuzzleFilters(p => ({ ...p, atk: e.target.value }))} />
            </div>
            {(() => {
              const anyActive = Object.values(puzzleFilters).some(v => v !== '');
              return (
                <button className="btn"
                  style={{ width: '100%', padding: 4, fontSize: 10, marginTop: 4 }}
                  disabled={!anyActive}
                  onClick={() => setPuzzleFilters({
                    name: '', effect: '', cardType: '', subtype: '', archetype: '',
                    sa1: '', sa2: '', ss1: '', ss2: '',
                    level: '', cost: '', hp: '', atk: '',
                  })}>
                  CLEAR FILTERS
                </button>
              );
            })()}
          </div>
          )}
          {/* ── Gallery column (scrollable card grid; name search lives in
                the sidebar's Name filter input). ── */}
          <div className="pz-gallery-column">
          {/* Collapse toggle — hides the filter sidebar so the grid widens
              from 3 to 5 cards per row (see pz-search-results inline grid). */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button className="btn" style={{ padding: '3px 10px', fontSize: 9 }}
              onClick={() => setPuzzleFiltersCollapsed(c => !c)}
              title={puzzleFiltersCollapsed ? 'Show filters' : 'Hide filters for a wider gallery'}>
              {puzzleFiltersCollapsed ? '▾ FILTERS' : '▴ FILTERS'}
            </button>
            <span className="orbit-font" style={{ fontSize: 10, color: 'var(--text2)', fontWeight: 700, letterSpacing: 1 }}>
              {searchResults.length} CARDS
            </span>
          </div>
          <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
            {/* Don't toggle overflowY during drag: hiding the native
                18px scrollbar reflows the `repeat(3, 1fr)` grid and
                visibly scales every card up for the duration of the
                drag. The gallery is already a scroll container — HTML5
                drag doesn't auto-scroll arbitrary children, only the
                window edges, so leaving overflow as `auto` is safe. */}
            <div className="pz-search-results" ref={searchResultsRef} style={{
              gridTemplateColumns: `repeat(${puzzleFiltersCollapsed ? 5 : 3}, 1fr)`,
              ...(isTouchDevice ? { scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } : {}),
            }}>
            {searchResults.map((c, i) => {
              const img = cardImageUrl(c.name);
              return (
                <div key={c.name + i} className="pz-search-card"
                  onClick={!isTouchDevice ? () => { addToHand(c); if (window.playSFX) window.playSFX('draw'); setMobileSelected(null); } : undefined}
                  onTouchStart={(e) => touchDragStart(c.name, null, null, null, e)}
                  onTouchMove={touchDragMove}
                  onTouchEnd={(e) => { const wasDragging = touchDragRef.current?.dragging; touchDragEnd(e); if (!wasDragging) { e.preventDefault(); addToHand(c); if (window.playSFX) window.playSFX('draw'); setMobileSelected(null); } }}
                  draggable={!isTouchDevice} onDragStart={(e) => { setDragGhost(e, c.name); onDragStart(e, c.name, null, null); }} onDragEnd={onDragEnd}
                  onMouseEnter={() => showTooltip(c, 'right')} onMouseLeave={hideTooltip}
                  title={c.name + ' (' + c.cardType + (c.subtype ? ' / ' + c.subtype : '') + ')'}>
                  {img ? <img src={img} className="pz-search-card-img" draggable={false} /> : (
                    <div className="pz-search-card-text">
                      <span style={{ fontSize: 10, fontWeight: 700 }}>{c.name}</span>
                      <span style={{ fontSize: 8, color: 'var(--text2)' }}>{c.cardType}</span>
                    </div>
                  )}
                </div>
              );
            })}
            {searchResults.length === 0 && Object.values(puzzleFilters).some(v => v !== '') && (
              <div style={{ color: 'var(--text2)', fontSize: 12, textAlign: 'center', padding: 20, gridColumn: '1 / -1' }}>No cards found</div>
            )}
          </div>
          {/* ── Custom touch-draggable scrollbar (mobile) ── */}
          {isTouchDevice && (
            <div ref={customScrollRef} className="pz-custom-scrollbar"
              onTouchStart={scrollTrackTouch} onTouchMove={scrollTrackTouch}>
              <div ref={scrollThumbRef} className="pz-custom-scrollbar-thumb"
                onTouchStart={scrollThumbTouchStart}
                onTouchMove={scrollThumbTouchMove}
                onTouchEnd={scrollThumbTouchEnd} />
            </div>
          )}
          </div>
          </div>
        </div>

        {/* ── Board ── */}
        {/* Don't toggle overflowY during drag — same reason as the
            gallery: hiding the native scrollbar reclaims its ~18 px
            of width into the content box, and because the battlefield
            inside is centered, that visibly shifts it to the right
            for the duration of the drag. HTML5 DnD doesn't auto-scroll
            arbitrary scroll containers, only the window, so leaving
            overflow as the default doesn't reintroduce any unwanted
            scrolling during drag. */}
        <div className="pz-board-wrap" ref={boardWrapRef}>
          {/* ── Opponent Hand (always revealed, behind tooltips) ── */}
          <div className="pz-hand pz-hand-opp" style={{ position: 'relative', zIndex: 1, marginBottom: 'calc(4px * var(--board-scale))' }}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverZone('oppHand'); }}
            onDragLeave={() => setDragOverZone(null)}
            onDrop={handleOppHandDrop}>
            <PzAmbiance variant="hand" />
            <span className="pz-hand-label orbit-font">OPP HAND ({oppHand.length})</span>
            <div className="pz-hand-cards" data-pz-hand="oppHand" style={dragOverZone === 'oppHand' || dragOverZone === 'hand:oppHand' ? { boxShadow: '0 0 14px rgba(0,240,255,.4) inset' } : undefined}>
              {oppHand.map((cardName, i) => {
                const img = cardImageUrl(cardName);
                return (
                  <div key={i} className={'pz-hand-card' + (mobileSelected?.handSource === 'oppHand' && mobileSelected?.handIdx === i ? ' pz-hand-card-selected' : '')}
                    
                    draggable={!isTouchDevice}
                    onDragStart={(e) => onDragStart(e, cardName, i, null, 'oppHand')} onDragEnd={onDragEnd}
                    onClick={!isTouchDevice ? () => {
                      if (mobileSelected?.handSource === 'oppHand' && mobileSelected?.handIdx === i) setMobileSelected(null);
                      else setMobileSelected({ cardName, handIdx: i, handSource: 'oppHand' });
                    } : undefined}
                    onTouchStart={(e) => touchDragStart(cardName, i, 'oppHand', null, e)}
                    onTouchMove={touchDragMove}
                    onTouchEnd={(e) => { const wasDragging = touchDragRef.current?.dragging; touchDragEnd(e); if (!wasDragging) { e.preventDefault(); const now = Date.now(); const lt = lastTapRef.current; if (lt.handSource === 'oppHand' && lt.handIdx === i && now - lt.time < 350) { removeFromOppHand(i); if (window.playSFX) window.playSFX('discard'); setMobileSelected(null); lastTapRef.current = { time: 0, handSource: null, handIdx: -1 }; } else { lastTapRef.current = { time: now, handSource: 'oppHand', handIdx: i }; if (mobileSelected?.handSource === 'oppHand' && mobileSelected?.handIdx === i) setMobileSelected(null); else setMobileSelected({ cardName, handIdx: i, handSource: 'oppHand' }); } } }}
                    onContextMenu={(e) => { e.preventDefault(); removeFromOppHand(i); if (window.playSFX) window.playSFX('discard'); }}
                    onMouseEnter={() => { const c = getCard(cardName); if (c) showTooltip(c, 'left'); }}
                    onMouseLeave={hideTooltip}
                    title={cardName}>
                    {img ? <img src={img} className="pz-hand-card-img" draggable={false} /> : (
                      <div className="pz-hand-card-text"><span>{cardName}</span></div>
                    )}
                  </div>
                );
              })}
              {oppHand.length === 0 && <span style={{ color: 'var(--text2)', fontSize: 11 }}>Drag cards here for the opponent's hand.</span>}
            </div>
            <div className="pz-gold-input" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginLeft: 8, flexShrink: 0, alignSelf: 'stretch', padding: '4px 10px', borderLeft: '1px solid rgba(255,215,0,.2)', background: 'rgba(255,215,0,.04)' }}>
              <span style={{ fontSize: 18, color: '#ffd700', width: 24, textAlign: 'center', flexShrink: 0 }}>💰</span>
              <input className="input" type="number" min="0" max="999" value={players[1].gold ?? 0}
                onChange={(e) => { const v = Math.min(999, Math.max(0, parseInt(e.target.value) || 0)); updatePlayer(1, p => { p.gold = v; return p; }); }}
                style={{ width: 64, padding: '6px 6px', fontSize: 16, textAlign: 'center', borderColor: 'rgba(255,215,0,.4)', color: '#ffd700', fontWeight: 700 }} />
              {/* Right spacer mirrors the bag icon's width so the field sits centered */}
              <span aria-hidden="true" style={{ width: 24, flexShrink: 0 }} />
            </div>
            <DebuffSelector
              side="opp"
              selected={oppDebuffs}
              onChange={(next) => { setOppDebuffs(next); setValidated(false); }}
              isOpen={debuffMenuOpen === 'opp'}
              onToggle={() => setDebuffMenuOpen(debuffMenuOpen === 'opp' ? null : 'opp')}
              onClose={() => setDebuffMenuOpen(null)}
            />
          </div>

          <div className="pz-side-label orbit-font">OPPONENT</div>
          {/* ── Pseudo-3D ground plane (creator variant) ──────────────
              Mirrors .board-plane from the battle board: both sides +
              the area mid-row on one tilted plane, so the creator
              previews the exact in-battle perspective. Tuning differs
              (see .pz-board-plane in style.css): the creator has no
              vertical gap to fill — labels and hand bars sit directly
              against the rows — so it uses a centered pivot and a much
              smaller zoom than the battle board. HTML5 drag-&-drop hit
              testing honours 3D transforms, so all zone onDragOver/
              onDrop handlers keep working on the projected geometry. */}
          {/* pz-plane-clip: untransformed buffer between the scroll
              container (.pz-board-wrap) and the tilted plane — caps the
              horizontal scroll range at LAYOUT width in hscroll mode
              (same phantom-range fix as .board-plane-clip on the battle
              board: the plane's transformed border box would otherwise
              extend the scrollable region far past the last zone). */}
          <div className="pz-plane-clip">
          {/* Ambient motes — FIRST child: paints behind the tilted plane. */}
          <PzAmbiance variant="board" />
          <div className="pz-board-plane">
          {renderSide(1, true)}

            {/* Mid-row → zero-height fold (battle parity): area zones
                straddle the fold line and cost NO vertical layout space.
                v21: positions are derived from STATE, not measured. The
                measured-variable approach (v16–v20) kept failing on
                timing: any pass that changed the layout frame (island
                add/remove, latch flips, scale writes) could leave the
                CSS vars one frame stale and the zones parked over other
                columns. This flow layout cannot go stale by
                construction — each spacer group replicates the hero
                row's column width exactly (maxLeft + maxRight + 3
                zone-width elements: left island pads + lead spacer +
                hero + surprise + right island pads, straight from
                columnLayout), so the area zones sit in the inter-column
                gaps for ANY island configuration, re-rendered by React
                on every state change. z-index lifts the zones above the
                sibling sides so their halves stay hoverable/droppable. */}
            <div className="board-row pz-area-fold">
              {[0, 1, 2].flatMap(hi => {
                const { maxLeft, maxRight } = columnLayout[hi];
                const group = (
                  <div key={'fg' + hi} className="board-hero-group">
                    {Array.from({ length: maxLeft + maxRight + 3 }).map((_, s) => <div key={s} className="board-zone-spacer" />)}
                  </div>
                );
                if (hi === 2) return [group];
                const si = hi; // gap 0 → your area, gap 1 → opp area
                const zone = (
                  <div key={'az' + si} className="board-zone pz-area-zone" style={{ ...(zs('area') || {}), borderColor: 'rgba(255,51,102,.5)', backgroundColor: zs('area') ? undefined : 'rgba(255,51,102,.08)', ...hl('area', si, 0, 0) }} {...zh('area', si, 0, 0)}>
                    {areaZones[si].length > 0 ? <BoardCard cardName={areaZones[si][0]} /> : <div className="board-zone-empty">{si === 0 ? 'Your Area' : 'Opp Area'}</div>}
                  </div>
                );
                return [group, zone];
              })}
            </div>

            {renderSide(0, false)}
          </div>{/* /pz-board-plane */}
          </div>{/* /pz-plane-clip */}
          <div className="pz-side-label orbit-font">YOU</div>

          {/* ── Staging Hand: kept inside the board column so it only spans
               the board width (mirroring the opponent's hand bar at the top)
               instead of the full screen — this frees the area beneath the
               gallery, which now fills the full height. ── */}
          <div className="pz-hand" style={{ position: 'relative', zIndex: 10000 }}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverZone('hand'); }}
        onDragLeave={() => setDragOverZone(null)}
        onDrop={handleHandDrop}>
        <PzAmbiance variant="hand" />
        <span className="pz-hand-label orbit-font">HAND ({hand.length})</span>
        <div className="pz-hand-cards" data-pz-hand="hand" style={dragOverZone === 'hand' || dragOverZone === 'hand:hand' ? { boxShadow: '0 0 14px rgba(0,240,255,.4) inset' } : undefined}>
          {hand.map((cardName, i) => {
            const img = cardImageUrl(cardName);
            return (
              <div key={i} className={'pz-hand-card' + (mobileSelected?.handSource === 'hand' && mobileSelected?.handIdx === i ? ' pz-hand-card-selected' : '')}
                
                draggable={!isTouchDevice}
                onDragStart={(e) => onDragStart(e, cardName, i, null, 'hand')} onDragEnd={onDragEnd}
                onClick={!isTouchDevice ? () => {
                  if (mobileSelected?.handSource === 'hand' && mobileSelected?.handIdx === i) setMobileSelected(null);
                  else setMobileSelected({ cardName, handIdx: i, handSource: 'hand' });
                } : undefined}
                onTouchStart={(e) => touchDragStart(cardName, i, 'hand', null, e)}
                onTouchMove={touchDragMove}
                onTouchEnd={(e) => { const wasDragging = touchDragRef.current?.dragging; touchDragEnd(e); if (!wasDragging) { e.preventDefault(); const now = Date.now(); const lt = lastTapRef.current; if (lt.handSource === 'hand' && lt.handIdx === i && now - lt.time < 350) { removeFromHand(i); if (window.playSFX) window.playSFX('discard'); setMobileSelected(null); lastTapRef.current = { time: 0, handSource: null, handIdx: -1 }; } else { lastTapRef.current = { time: now, handSource: 'hand', handIdx: i }; if (mobileSelected?.handSource === 'hand' && mobileSelected?.handIdx === i) setMobileSelected(null); else setMobileSelected({ cardName, handIdx: i, handSource: 'hand' }); } } }}
                onContextMenu={(e) => { e.preventDefault(); removeFromHand(i); if (window.playSFX) window.playSFX('discard'); }}
                onMouseEnter={() => { const c = getCard(cardName); if (c) showTooltip(c, 'left'); }}
                onMouseLeave={hideTooltip}
                title={cardName}>
                {img ? <img src={img} className="pz-hand-card-img" draggable={false} /> : (
                  <div className="pz-hand-card-text"><span>{cardName}</span></div>
                )}
              </div>
            );
          })}
          {hand.length === 0 && <span style={{ color: 'var(--text2)', fontSize: 11 }}>{isTouchDevice ? 'Search → tap to add. Tap card, then tap zone to place.' : 'Search → click to add or drag directly onto the board. Right-click to remove.'}</span>}
        </div>
        <div className="pz-gold-input" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginLeft: 8, flexShrink: 0, alignSelf: 'stretch', padding: '4px 10px', borderLeft: '1px solid rgba(255,215,0,.2)', background: 'rgba(255,215,0,.04)' }}>
          <span style={{ fontSize: 18, color: '#ffd700', width: 24, textAlign: 'center', flexShrink: 0 }}>💰</span>
          <input className="input" type="number" min="0" max="999" value={players[0].gold ?? 0}
            onChange={(e) => { const v = Math.min(999, Math.max(0, parseInt(e.target.value) || 0)); updatePlayer(0, p => { p.gold = v; return p; }); }}
            style={{ width: 64, padding: '6px 6px', fontSize: 16, textAlign: 'center', borderColor: 'rgba(255,215,0,.4)', color: '#ffd700', fontWeight: 700 }} />
          {/* Right spacer mirrors the bag icon's width so the field sits centered */}
          <span aria-hidden="true" style={{ width: 24, flexShrink: 0 }} />
        </div>
        <DebuffSelector
          side="me"
          selected={meDebuffs}
          onChange={(next) => { setMeDebuffs(next); setValidated(false); }}
          isOpen={debuffMenuOpen === 'me'}
          onToggle={() => setDebuffMenuOpen(debuffMenuOpen === 'me' ? null : 'me')}
          onClose={() => setDebuffMenuOpen(null)}
        />
          </div>
        </div>
      </div>

      {/* ── Card Tooltip Panel ── */}
      {tooltipCard && (
        <div className="board-tooltip" style={tooltipSide === 'right'
          ? { left: PZ_PANEL_W, right: 'auto', borderLeft: '1px solid var(--accent)', borderRight: 'none' }
          : {
              // Deckungsgleich mit der Card Gallery statt "ungefaehr
              // darueber": die Galerie beginnt exakt hinter der
              // Filterspalte (200px + 1px Rahmen) und endet mit dem
              // Suchpanel bei 580px. Fruehere Werte waren `left: 220` bei
              // fester Breite 360 aus `.board-tooltip` — der rechte Rand
              // sass damit richtig, der linke ~19px zu weit rechts, und
              // ein Streifen Galerie schaute darunter hervor.
              // Bei eingeklappten Filtern faengt die Galerie bei 0 an,
              // dann waechst der Tooltip entsprechend mit.
              left: galleryLeft,
              width: PZ_PANEL_W - galleryLeft,
              right: 'auto',
              borderRight: '1px solid var(--accent)',
              borderLeft: 'none',
              boxShadow: '4px 0 20px rgba(0,0,0,.8)',
            }
        }>
          <CardTooltipContent card={tooltipCard}>
            {tooltipCard.cardType === 'Ascended Hero' && ascensionMap[tooltipCard.name] &&
              <div style={{ fontSize: 13, color: '#ff44ff', marginTop: 6 }}>Base Hero: {ascensionMap[tooltipCard.name]}</div>}
          </CardTooltipContent>
        </div>
      )}

      {/* ── Pile Viewer Modal ── */}
      {viewPile && (() => {
        const pile = players[viewPile.si][viewPile.key] || [];
        const labels = { discardPile: 'Discard Pile', deletedPile: 'Deleted Pile', mainDeck: 'Deck', potionDeck: 'Potion Deck', sideDeck: 'Side Deck', coolnessStack: 'Coolness Stack' };
        const sideLabel = viewPile.si === 0 ? 'You' : 'Opponent';
        if (pile.length === 0) { setViewPile(null); return null; }
        return (
          <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setViewPile(null); }}>
            <div className="modal" style={{ maxWidth: 600, padding: 20, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 className="orbit-font" style={{ fontSize: 13, color: 'var(--accent)' }}>{sideLabel} — {labels[viewPile.key] || viewPile.key} ({pile.length})</h3>
                <button className="btn" style={{ padding: '4px 10px', fontSize: 10 }} onClick={() => setViewPile(null)}>✕ CLOSE</button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: 'calc(6px * var(--board-scale))', padding: 4, alignContent: 'flex-start' }}>
                {pile.map((cardName, idx) => {
                  const img = cardImageUrl(cardName);
                  return (
                    <div key={idx} className="pz-hand-card" draggable
                      style={{ width: 'calc(60px * var(--board-scale))', height: 'calc(84px * var(--board-scale))' }}
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(idx));
                        e.currentTarget.dataset.pileIdx = idx;
                      }}
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                      onDrop={(e) => {
                        e.preventDefault(); e.stopPropagation();
                        const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
                        if (!isNaN(fromIdx) && fromIdx !== idx) movePileCard(viewPile.si, viewPile.key, fromIdx, idx);
                      }}
                      onContextMenu={(e) => { e.preventDefault(); removePileCard(viewPile.si, viewPile.key, idx); }}
                      onMouseEnter={() => { const c = getCard(cardName); if (c) showTooltip(c, 'left'); }}
                      onMouseLeave={hideTooltip}
                      title={cardName + ' (right-click to remove)'}>
                      {img ? <img src={img} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 2 }} draggable={false} /> : (
                        <div className="pz-hand-card-text"><span>{cardName}</span></div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Stat Editor Modal ── */}
      {editTarget && (() => {
        // Biomancy Token edit branch — Potion-in-support tokens replace
        // the full stat editor with a minimal level picker. Everything
        // else (HP input, status/buff lists) is suppressed: the level
        // fully determines HP + damage.
        const _editP = players[editTarget.si];
        const _editCards = editTarget.zt === 'support' ? (_editP.supportZones[editTarget.hi]?.[editTarget.slot] || []) : [];
        const _editCard = _editCards.length ? getCard(_editCards[0]) : null;
        const isBiomancyTokenEdit = editTarget.zt === 'support' && _editCard?.cardType === 'Potion';
        return (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditTarget(null); }}>
          <div className="modal" style={{ maxWidth: 400, padding: 20, maxHeight: '80vh', overflowY: 'auto' }}>
            <h3 className="orbit-font" style={{ fontSize: 13, color: 'var(--accent)', marginBottom: 14 }}>
              {isBiomancyTokenEdit ? 'EDIT BIOMANCY TOKEN' : ('EDIT ' + (editTarget.zt === 'hero' ? 'HERO' : 'CREATURE') + ' STATS')}
            </h3>
            {isBiomancyTokenEdit && (
              <div style={{ marginBottom: 14 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 1 }}>Biomancy Level</span>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  {[1, 2, 3].map(lv => {
                    const stats = { 1: 40, 2: 60, 3: 80 }[lv];
                    const active = (editBiomancyLevel || 1) === lv;
                    return (
                      <button key={lv} className={'btn ' + (active ? 'btn-success' : '')}
                        style={{ flex: 1, padding: '10px 0', fontSize: 12, borderColor: active ? '#44dd66' : 'var(--bg4)' }}
                        onClick={() => setEditBiomancyLevel(lv)}>
                        Biomancy Level {lv}
                        <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>{stats} HP / {stats} dmg</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {!isBiomancyTokenEdit && editTarget.zt === 'hero' && (() => {
              const h = players[editTarget.si].heroes[editTarget.hi];
              const isDead = h && h.hp <= 0;
              return (
                <button className={'btn ' + (isDead ? 'btn-success' : 'btn-danger')}
                  style={{ width: '100%', padding: '6px 0', fontSize: 11, marginBottom: 12 }}
                  onClick={toggleHeroDead}>
                  {isDead ? '❤️ REVIVE (set HP to Max)' : '💀 DEFEAT (set HP to 0)'}
                </button>
              );
            })()}
            {/* Dream-Landers Hero attach toggle — visible only for the
                attach-eligible Creatures listed in ATTACHABLE_HERO_PAIRS.
                Toggling sets the `attachedHero` flag in
                `_creatureStatuses[hi-slot]`, which the server's puzzle
                loader picks up to invoke the Creature's `onAttachHero`
                so HP / counter bumps land identically to a live attach. */}
            {!isBiomancyTokenEdit && editTarget.zt === 'support' && _editCard && ATTACHABLE_HERO_PAIRS[_editCard.name] && (() => {
              const heroName = ATTACHABLE_HERO_PAIRS[_editCard.name];
              const attached = !!editAttachedHero;
              return (
                <button className={'btn ' + (attached ? 'btn-success' : '')}
                  style={{ width: '100%', padding: '8px 0', fontSize: 11, marginBottom: 12, borderColor: attached ? '#44dd66' : 'var(--bg4)' }}
                  onClick={() => setEditAttachedHero(attached ? null : heroName)}>
                  {attached
                    ? `✅ ${heroName} attached — click to detach`
                    : `🔗 Attach ${heroName}`}
                </button>
              );
            })()}
            {/* Anti Magic Level picker — visible only when the edit
                target is an Anti Magic Spell. Stamps `antiMagicLevel`
                into `_creatureStatuses[hi-slot]`, which the server's
                puzzle loader applies as both `inst.counters.antiMagicLevel`
                AND the host Hero's `buffs.magic_immune.level` so the
                Spell-targeting filter + buff badge tooltip read the
                authored level. */}
            {!isBiomancyTokenEdit && editTarget.zt === 'support' && _editCard?.name === 'Anti Magic' && editAntiMagicLevel != null && (
              <div style={{ marginBottom: 14 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 1 }}>
                  🛡️ Anti Magic Immunity Level
                </span>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  {[1, 2, 3].map(lv => {
                    const active = editAntiMagicLevel === lv;
                    return (
                      <button key={lv} className={'btn ' + (active ? 'btn-success' : '')}
                        style={{ flex: 1, padding: '10px 0', fontSize: 12, borderColor: active ? '#44dd66' : 'var(--bg4)' }}
                        onClick={() => setEditAntiMagicLevel(lv)}>
                        Level {lv}
                        <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>Immune to ≤ Lv{lv} Spells</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {/* Cute Hydra Head Counter editor — visible only when the
                edit target is a Cute Hydra. Stamps `headCounter` into
                `_creatureStatuses[hi-slot]`, which the server's puzzle
                loader applies as `inst.counters.headCounter` so the
                board badge + HOPT multi-target damage cap match. */}
            {!isBiomancyTokenEdit && editTarget.zt === 'support' && _editCard?.name === 'Cute Hydra' && (
              <div style={{ marginBottom: 14 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 1 }}>
                  🐲 Head Counters
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <button className="btn"
                    style={{ padding: '6px 12px', fontSize: 12, minWidth: 36 }}
                    disabled={(editHeadCounter || 0) <= 0}
                    onClick={() => setEditHeadCounter(Math.max(0, (editHeadCounter || 0) - 1))}>
                    −
                  </button>
                  <input className="input" type="number" min={0}
                    value={editHeadCounter ?? 0}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      setEditHeadCounter(Number.isFinite(n) && n >= 0 ? n : 0);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && saveStats()}
                    style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#ffd5b3' }} />
                  <button className="btn"
                    style={{ padding: '6px 12px', fontSize: 12, minWidth: 36 }}
                    onClick={() => setEditHeadCounter((editHeadCounter || 0) + 1)}>
                    +
                  </button>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text2)', opacity: 0.7, marginTop: 4 }}>
                  Caps the number of different targets Hydra's once-per-turn strike can hit.
                </div>
              </div>
            )}
            {/* Charm of Balance Balance Counter editor — visible only when
                the edit target is a Charm of Balance equip. Stamps `balance`
                into `_creatureStatuses[hi-slot]`, which the server's puzzle
                loader applies as `inst.counters.balance` so the badge AND
                the once-per-turn draw start at the authored value. */}
            {editBalanceCounter != null && (
              <div style={{ marginBottom: 14 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 1 }}>
                  ⚖️ Balance Counters
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <button className="btn"
                    style={{ padding: '6px 12px', fontSize: 12, minWidth: 36 }}
                    disabled={(editBalanceCounter || 0) <= 0}
                    onClick={() => setEditBalanceCounter(Math.max(0, (editBalanceCounter || 0) - 1))}>
                    −
                  </button>
                  <input className="input" type="number" min={0}
                    value={editBalanceCounter ?? 0}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      setEditBalanceCounter(Number.isFinite(n) && n >= 0 ? n : 0);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && saveStats()}
                    style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#f6d36b' }} />
                  <button className="btn"
                    style={{ padding: '6px 12px', fontSize: 12, minWidth: 36 }}
                    onClick={() => setEditBalanceCounter((editBalanceCounter || 0) + 1)}>
                    +
                  </button>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text2)', opacity: 0.7, marginTop: 4 }}>
                  Number of cards Charm of Balance lets the player draw on activation.
                </div>
              </div>
            )}
            {/* Waflav Evolution Counter editor — visible for the base Hero
                and all five Ascended forms. The counter is the archetype's
                whole resource: it pays for every Ascension (1 for
                Stormkissed up to 4 for Deep-Drowned) and Descending places
                more back. Saved as `hero._evolutionCounters`, which the
                shared Waflav helpers read directly. */}
            {editEvolutionCounter != null && (
              <div style={{ marginBottom: 14 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 1 }}>
                  🧬 Evolution Counters
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <button className="btn"
                    style={{ padding: '6px 12px', fontSize: 12, minWidth: 36 }}
                    disabled={(editEvolutionCounter || 0) <= 0}
                    onClick={() => setEditEvolutionCounter(Math.max(0, (editEvolutionCounter || 0) - 1))}>
                    −
                  </button>
                  <input className="input" type="number" min={0}
                    value={editEvolutionCounter ?? 0}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      setEditEvolutionCounter(Number.isFinite(n) && n >= 0 ? n : 0);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && saveStats()}
                    style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#8fffc4' }} />
                  <button className="btn"
                    style={{ padding: '6px 12px', fontSize: 12, minWidth: 36 }}
                    onClick={() => setEditEvolutionCounter((editEvolutionCounter || 0) + 1)}>
                    +
                  </button>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text2)', opacity: 0.7, marginTop: 4 }}>
                  Ascension costs: Stormkissed 1 · Flamebathed / Swampborne / Thunderstruck 2 · Deep-Drowned 4
                </div>
              </div>
            )}
            {/* Cosmic Depths Change Counter editor — visible when the
                edit target is a counter-consumer (Argos hero / Analyzer /
                Gatherer). Authors can preset the starting counter value
                so a puzzle Argos can immediately spend e.g. 3 counters
                to place a Lv3 CD Creature on turn 1. Saved as
                `hero._changeCounters` for Argos and as
                `_creatureStatuses[hi-slot].changeCounter` for the
                Creatures — both surfaces are read by the shared cosmic
                helpers without further server-side translation. */}
            {editChangeCounter != null && (
              <div style={{ marginBottom: 14 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 1 }}>
                  🌌 Change Counters
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <button className="btn"
                    style={{ padding: '6px 12px', fontSize: 12, minWidth: 36 }}
                    disabled={(editChangeCounter || 0) <= 0}
                    onClick={() => setEditChangeCounter(Math.max(0, (editChangeCounter || 0) - 1))}>
                    −
                  </button>
                  <input className="input" type="number" min={0}
                    value={editChangeCounter ?? 0}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      setEditChangeCounter(Number.isFinite(n) && n >= 0 ? n : 0);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && saveStats()}
                    style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#cf9bff' }} />
                  <button className="btn"
                    style={{ padding: '6px 12px', fontSize: 12, minWidth: 36 }}
                    onClick={() => setEditChangeCounter((editChangeCounter || 0) + 1)}>
                    +
                  </button>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text2)', opacity: 0.7, marginTop: 4 }}>
                  Cosmic Depths counters this card starts the puzzle with — spendable on turn 1.
                </div>
              </div>
            )}
            {/* Sleeping Beauty linked-hero picker — visible only when the
                edit target is a Sleeping Beauty in a support zone. The
                link is per-SLOT (left/middle/right), so a hero swapped
                into the slot mid-puzzle inherits the tether. Each slot
                button shows the current occupant (or "(Empty)"); clicking
                an active slot clears the link. */}
            {!isBiomancyTokenEdit && editTarget.zt === 'support' && _editCard?.name === 'Sleeping Beauty' && (() => {
              const heroes = players[editTarget.si]?.heroes || [];
              const SLOT_LABELS = ['Left', 'Middle', 'Right'];
              return (
                <div style={{ marginBottom: 14 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 1 }}>
                    🌹 Linked Hero Slot
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                    {[0, 1, 2].map(slotIdx => {
                      const heroName = heroes[slotIdx]?.name || null;
                      const active = editLinkedHeroSlot === slotIdx;
                      return (
                        <button key={slotIdx}
                          className={'btn ' + (active ? 'btn-success' : '')}
                          style={{ width: '100%', padding: '8px 12px', fontSize: 12, textAlign: 'left',
                            borderColor: active ? '#44dd66' : 'var(--bg4)' }}
                          onClick={() => setEditLinkedHeroSlot(active ? null : slotIdx)}>
                          {active ? '✅ ' : '○ '}
                          {`Slot ${slotIdx + 1} (${SLOT_LABELS[slotIdx]}) — ${heroName || '(Empty)'}`}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text2)', opacity: 0.7, marginTop: 4 }}>
                    Beauty borrows the linked Hero's effect (once they've used it this turn) and deals 300 damage to whoever occupies that slot when she dies. The link follows the SLOT, not the Hero — swaps inherit it. Click an active slot to clear.
                  </div>
                </div>
              );
            })()}
            {/* Sparkfly Queen gift checklist — visible only when the
                edit target is a Sparkfly Queen. Each toggle stamps the
                corresponding gift on the Queen at puzzle-start, exactly
                as if a Hive's Crown sacrifice had granted it: BuffColumn
                icon, _inheritedEffects entry, and (for Attendant) the
                generic absolute-immunity counter all match a live game. */}
            {!isBiomancyTokenEdit && editTarget.zt === 'support' && _editCard?.name === 'Sparkfly Queen' && editSparkflyGifts && (() => {
              const GIFTS = [
                { id: 'architect', icon: '📐', label: "Architect's Gift",
                  text: 'Once per turn: draw cards until your hand size matches the opponent\'s.' },
                { id: 'attendant', icon: '🪶', label: "Attendant's Gift",
                  text: "Unaffected by your opponent's cards and effects, except damage." },
                { id: 'worker', icon: '🪲', label: "Worker's Gift",
                  text: 'Once per turn: opponent picks any non-Hero card on their side of the board → your hand.' },
              ];
              return (
                <div style={{ marginBottom: 14 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 1 }}>
                    👑 Sacrifice Gifts
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                    {GIFTS.map(g => {
                      const active = !!editSparkflyGifts[g.id];
                      return (
                        <button key={g.id}
                          className={'btn ' + (active ? 'btn-success' : '')}
                          style={{ width: '100%', padding: '8px 12px', fontSize: 12, textAlign: 'left',
                            borderColor: active ? '#44dd66' : 'var(--bg4)' }}
                          onClick={() => setEditSparkflyGifts({ ...editSparkflyGifts, [g.id]: !active })}>
                          <div style={{ fontWeight: 700 }}>{(active ? '✅ ' : '○ ') + g.icon + ' ' + g.label}</div>
                          <div style={{ fontSize: 10, color: 'var(--text2)', opacity: 0.85, marginTop: 2 }}>{g.text}</div>
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text2)', opacity: 0.7, marginTop: 4 }}>
                    Pick any combination — Hive's Crown normally grants exactly one gift per Queen, but the puzzle author can stack all three.
                  </div>
                </div>
              );
            })()}
            {/* HP / Max HP / ATK row — hidden for Biomancy Tokens
                (level fully determines stats) AND for Attachments /
                Equipment Artifacts that aren't ALSO subtype Creature.
                Pollution Spewer and any other Artifact-Creature hybrid
                keeps HP because its Creature subtype means it has a
                real HP stat. Anti Magic / Overheal Shock / etc. — pure
                Attachments — have no HP to edit. */}
            {(() => {
              const sub = (_editCard?.subtype || '').toLowerCase();
              const subtypeIsCreature = sub.split('/').map(s => s.trim()).includes('creature');
              const isAttachmentEdit = editTarget.zt === 'support'
                && _editCard?.cardType === 'Spell'
                && sub === 'attachment';
              const isEquipEdit = editTarget.zt === 'support'
                && _editCard?.cardType === 'Artifact'
                && sub === 'equipment';
              const hideHp = isBiomancyTokenEdit
                || ((isAttachmentEdit || isEquipEdit) && !subtypeIsCreature);
              if (hideHp) return null;
              return (
                <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                  <label style={{ flex: 1 }}>
                    <span style={{ fontSize: 10, color: '#ff4466', fontWeight: 700 }}>HP</span>
                    <input className="input" type="number" value={editHp} onChange={(e) => setEditHp(e.target.value)}
                      style={{ width: '100%', marginTop: 4 }} onKeyDown={(e) => e.key === 'Enter' && saveStats()} autoFocus />
                  </label>
                  {editTarget.zt === 'hero' && (
                    <label style={{ flex: 1 }}>
                      <span style={{ fontSize: 10, color: '#ff8844', fontWeight: 700 }}>MAX HP</span>
                      <input className="input" type="number" value={editMaxHp} onChange={(e) => setEditMaxHp(e.target.value)}
                        style={{ width: '100%', marginTop: 4 }} onKeyDown={(e) => e.key === 'Enter' && saveStats()} />
                    </label>
                  )}
                  {editTarget.zt === 'hero' && (
                    <label style={{ flex: 1 }}>
                      <span style={{ fontSize: 10, color: '#aabbcc', fontWeight: 700 }}>ATK</span>
                      <input className="input" type="number" value={editAtk} onChange={(e) => setEditAtk(e.target.value)}
                        style={{ width: '100%', marginTop: 4 }} onKeyDown={(e) => e.key === 'Enter' && saveStats()} />
                    </label>
                  )}
                </div>
              );
            })()}
            {/* Equip-Artifact edit targets restrict the buff picker to
                the Anti-Magic-Enchantment buff and hide all Status Effects.
                Attachment-Spell edit targets hide BOTH sections entirely
                (Attachments don't carry status/buff state of their own).
                Biomancy Token edit targets hide both sections entirely. */}
            {/* ── Status Effects ── (hidden for Equip Artifacts, Attachment Spells & Biomancy Tokens) */}
            {!isBiomancyTokenEdit && !(editTarget.zt === 'support' && (() => {
              const p = players[editTarget.si];
              const cards = p.supportZones[editTarget.hi]?.[editTarget.slot] || [];
              const c = cards.length ? getCard(cards[0]) : null;
              if (!c) return false;
              const sub = (c.subtype || '').toLowerCase();
              const isEquip = c.cardType === 'Artifact' && sub === 'equipment';
              const isAttachment = c.cardType === 'Spell' && sub === 'attachment';
              return isEquip || isAttachment;
            })()) && (
            <div style={{ marginBottom: 14 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 1 }}>Status Effects</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {STATUS_LIST.map(st => {
                  const active = !!editStatuses[st.key];
                  // Cursor-anchored hover tooltip — describes what the
                  // status does in-game so the puzzle author doesn't
                  // have to remember every status key. onMouseMove
                  // re-fires the tooltip-position event so the box
                  // tracks the cursor; onMouseLeave clears.
                  const tipHandlers = st.tooltip ? {
                    onMouseEnter: (e) => window.showCursorTooltip?.(e, st.tooltip),
                    onMouseMove:  (e) => window.showCursorTooltip?.(e, st.tooltip),
                    onMouseLeave: () => window.hideGameTooltip?.(),
                  } : {};
                  return (
                    <div key={st.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button className="btn" style={{
                        padding: '3px 8px', fontSize: 10,
                        borderColor: active ? st.color : 'var(--bg4)',
                        color: active ? st.color : 'var(--text2)',
                        background: active ? st.color + '18' : 'transparent',
                      }} {...tipHandlers} onClick={() => setEditStatuses(prev => {
                        const next = { ...prev };
                        if (st.stacks) { next[st.key] = active ? undefined : { stacks: 1 }; }
                        else { next[st.key] = active ? undefined : true; }
                        if (!next[st.key]) delete next[st.key];
                        return next;
                      })}>
                        {st.label}
                      </button>
                      {st.stacks && active && (
                        <input className="input" type="number" min="1" value={editStatuses[st.key]?.stacks || 1}
                          style={{ width: 40, padding: '2px 4px', fontSize: 10, textAlign: 'center' }}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setEditStatuses(prev => ({ ...prev, [st.key]: { stacks: Math.max(1, parseInt(e.target.value) || 1) } }))} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            )}
            {/* ── Buffs ── (hidden for Biomancy Tokens & Attachment Spells) */}
            {!isBiomancyTokenEdit && !(editTarget.zt === 'support' && (() => {
              const p = players[editTarget.si];
              const cards = p.supportZones[editTarget.hi]?.[editTarget.slot] || [];
              const c = cards.length ? getCard(cards[0]) : null;
              return c && c.cardType === 'Spell' && (c.subtype || '').toLowerCase() === 'attachment';
            })()) && (
            <div style={{ marginBottom: 14 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 1 }}>Buffs</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {BUFF_LIST.filter(bf => {
                  // Determine zone type for scope filtering.
                  const isEquipEdit = editTarget.zt === 'support' && (() => {
                    const p = players[editTarget.si];
                    const cards = p.supportZones[editTarget.hi]?.[editTarget.slot] || [];
                    const c = cards.length ? getCard(cards[0]) : null;
                    return c && c.cardType === 'Artifact' && (c.subtype || '').toLowerCase() === 'equipment';
                  })();
                  // Equip Artifacts: ONLY the equip-scoped buff (AME) is offered.
                  if (isEquipEdit) return bf.scope === 'equip';
                  // Everything else: hide equip-scoped buffs and apply normal scoping.
                  if (bf.scope === 'equip') return false;
                  if (!bf.scope) return true;
                  if (bf.scope === 'oppHero') return editTarget.zt === 'hero' && editTarget.si === 1;
                  return true;
                }).map(bf => {
                  const active = !!editBuffs[bf.key];
                  // Same cursor-anchored hover tooltip as the status
                  // toggles above — explains what each buff actually
                  // does so the author doesn't have to remember.
                  const tipHandlers = bf.tooltip ? {
                    onMouseEnter: (e) => window.showCursorTooltip?.(e, bf.tooltip),
                    onMouseMove:  (e) => window.showCursorTooltip?.(e, bf.tooltip),
                    onMouseLeave: () => window.hideGameTooltip?.(),
                  } : {};
                  return (
                    <button key={bf.key} className="btn" style={{
                      padding: '3px 8px', fontSize: 10,
                      borderColor: active ? bf.color : 'var(--bg4)',
                      color: active ? bf.color : 'var(--text2)',
                      background: active ? bf.color + '18' : 'transparent',
                    }} {...tipHandlers} onClick={() => setEditBuffs(prev => {
                      const next = { ...prev };
                      if (active) delete next[bf.key]; else next[bf.key] = true;
                      return next;
                    })}>
                      {bf.label}
                    </button>
                  );
                })}
              </div>
            </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-success" style={{ flex: 1, padding: '8px 0' }} onClick={saveStats}>SAVE</button>
              <button className="btn" style={{ flex: 1, padding: '8px 0' }} onClick={() => setEditTarget(null)}>CANCEL</button>
            </div>
          </div>
        </div>
        );
      })()}
      <GameTooltip />

      {/* ── Remove card popup (fixed, above everything) ── */}
      {mobileSelected && removePopupPos && (
        <div className="pz-remove-popup" style={{
          position: 'fixed',
          left: removePopupPos.left,
          top: removePopupPos.top,
          transform: removePopupPos.isOpp ? 'translateX(-50%)' : 'translate(-50%, -100%)',
          zIndex: 999999,
        }} onClick={() => {
          if (mobileSelected.handSource === 'oppHand') removeFromOppHand(mobileSelected.handIdx);
          else removeFromHand(mobileSelected.handIdx);
          if (window.playSFX) window.playSFX('discard');
          setMobileSelected(null);
        }}>✕ Remove</div>
      )}
    </div>
  );
}

window.PuzzleCreator = PuzzleCreator;
