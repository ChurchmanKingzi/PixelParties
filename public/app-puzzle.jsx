// ═══════════════════════════════════════════
//  PIXEL PARTIES — PUZZLE CREATOR (SANDBOX)
//  Reuses existing board layout classes and
//  game-engine-compatible data structures.
// ═══════════════════════════════════════════
const { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, useContext } = React;
const { AppContext, cardImageUrl, VolumeControl, CARDS_BY_NAME, CardTooltipContent, useCardTooltip, StatusBadges, BuffColumn, GameTooltip, socket } = window;
const { FrozenOverlay, NegatedOverlay, BurnedOverlay, PoisonedOverlay, HealReversedOverlay, ImmuneIcon } = window;
const { GameBoard } = window;

const emptyPlayer = () => ({
  heroes: [null, null, null],
  abilityZones: [[[], [], []], [[], [], []], [[], [], []]],
  supportZones: [[[], [], []], [[], [], []], [[], [], []]],
  surpriseZones: [[], [], []],
  hand: [], gold: 0, permanents: [], islandZoneCount: [0, 0, 0],
  mainDeck: [], potionDeck: [], discardPile: [], deletedPile: [],
});

function PuzzleCreator() {
  const { user, setScreen, notify, setInBattle } = useContext(AppContext);

  // ── Load saved state from localStorage ──
  const loadSaved = () => {
    try {
      const raw = localStorage.getItem('pz-creator-state');
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return null;
  };
  const saved = useMemo(loadSaved, []);

  const [players, setPlayers] = useState(saved?.players || [emptyPlayer(), emptyPlayer()]);
  const [areaZones, setAreaZones] = useState(saved?.areaZones || [[], []]);
  const [hand, setHand] = useState(saved?.hand || []);
  const [oppHand, setOppHand] = useState(saved?.oppHand || []);
  const [puzzleName, setPuzzleName] = useState(saved?.puzzleName || '');
  const [search, setSearch] = useState('');
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
    }
  }, [canDrop, clearZone, removeFromHand, removeFromOppHand, placeHero, placeAbility, placeSupport, placeSurprise, placeArea, placePermanent, addToHand, addToOppHand]);

  // ── Puzzle Battle State ──
  const [puzzleGameState, setPuzzleGameState] = useState(null);
  const puzzleRoomRef = useRef(null); // stores roomId during puzzle battle

  // ── Auto-save state to localStorage on every change ──
  useEffect(() => {
    try { localStorage.setItem('pz-creator-state', JSON.stringify({ players, areaZones, hand, oppHand, puzzleName })); } catch (_) {}
  }, [players, areaZones, hand, oppHand, puzzleName]);

  const puzzleIgnoreRef = useRef(false); // true after leaving — blocks inflight game_state updates

  // ── Puzzle Battle: socket listeners ──
  useEffect(() => {
    const onGameState = (state) => {
      if (!state.isPuzzle || puzzleIgnoreRef.current) return;
      puzzleRoomRef.current = state.roomId;
      setPuzzleGameState(state);
      setInBattle(true);
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
  }, [notify, setInBattle]);

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
    setInBattle(false);
    if (result) {
      setValidated(success);
      notify(success ? '🧩 Puzzle validated! Export is now available.' : 'Puzzle not cleared — adjust and try again.', success ? 'success' : 'info');
    }
  }, [puzzleGameState, notify, setInBattle]);

  const handleReset = useCallback(() => {
    setPlayers([emptyPlayer(), emptyPlayer()]);
    setAreaZones([[], []]);
    setHand([]);
    setOppHand([]);
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
  useEffect(() => {
    const container = boardWrapRef.current;
    if (!container) return;
    const IDEAL_WIDTH = 1000;
    const MIN_SCALE = 0.5;
    const updateScale = () => {
      const available = container.clientWidth;
      const scale = Math.max(MIN_SCALE, Math.min(1.1, available / IDEAL_WIDTH));
      document.documentElement.style.setProperty('--board-scale', scale.toFixed(4));
    };
    const ro = new ResizeObserver(updateScale);
    ro.observe(container);
    updateScale();
    return () => { ro.disconnect(); document.documentElement.style.setProperty('--board-scale', '1'); };
  }, []);

  const searchResults = useMemo(() => {
    const all = window.AVAILABLE_CARDS || [];
    if (!search.trim()) return all;
    const q = search.toLowerCase();
    return all.filter(c => c.name.toLowerCase().includes(q));
  }, [search]);

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
    setAreaZones(prev => { const next = [...prev]; next[idx] = fn([...prev[idx]]); return next; });
    invalidate();
  }, [invalidate]);

  const addToHand = useCallback((card) => { setHand(prev => [...prev, card.name]); invalidate(); }, [invalidate]);
  const removeFromHand = useCallback((idx) => { setHand(prev => prev.filter((_, i) => i !== idx)); invalidate(); }, [invalidate]);
  const addToOppHand = useCallback((card) => { setOppHand(prev => [...prev, card.name]); invalidate(); }, [invalidate]);
  const removeFromOppHand = useCallback((idx) => { setOppHand(prev => prev.filter((_, i) => i !== idx)); invalidate(); }, [invalidate]);

  // ── Placement ──
  const placeHero = useCallback((cardName, si, hi) => {
    const c = getCard(cardName); if (!c || (c.cardType !== 'Hero' && c.cardType !== 'Ascended Hero')) return;
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
    if (players[si].surpriseZones[hi].length > 0) setHand(prev => [...prev, ...players[si].surpriseZones[hi]]);
    updatePlayer(si, (p) => { p.surpriseZones[hi] = [cardName]; return p; });
  }, [players, updatePlayer, notify]);

  const placeArea = useCallback((cardName, si) => {
    if (areaZones[si].length > 0) setHand(prev => [...prev, ...areaZones[si]]);
    updateArea(si, () => [cardName]);
  }, [areaZones, updateArea]);

  const placePermanent = useCallback((cardName, si) => {
    updatePlayer(si, (p) => { p.permanents.push({ name: cardName, id: 'p' + Date.now() + Math.random() }); return p; });
  }, [updatePlayer]);

  const removeCard = useCallback((si, zt, hi, slot) => {
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
    if (dragSource) clearZone(dragSource.zt, dragSource.si, dragSource.hi, dragSource.slot);
    // From oppHand → remove from there and add here
    if (dragHandSource === 'oppHand' && dragHandIdx != null) { removeFromOppHand(dragHandIdx); setHand(prev => [...prev, dragCardName]); }
    // From board or gallery → add to hand
    else if (dragHandIdx == null) setHand(prev => [...prev, dragCardName]);
    // From own hand → no-op (reorder not needed)
    setDragCardName(null); setDragHandIdx(null); setDragSource(null); setDragHandSource(null); setDragOverZone(null); dragEntityData.current = null;
  }, [dragCardName, dragHandIdx, dragHandSource, dragSource, clearZone, removeFromOppHand]);

  // Drop onto opponent hand zone
  const handleOppHandDrop = useCallback((e) => {
    e.preventDefault();
    if (dragCardName == null) return;
    if (dragSource) clearZone(dragSource.zt, dragSource.si, dragSource.hi, dragSource.slot);
    // From player hand → remove from there and add here
    if (dragHandSource === 'hand' && dragHandIdx != null) { removeFromHand(dragHandIdx); setOppHand(prev => [...prev, dragCardName]); }
    // From board or gallery → add to opp hand
    else if (dragHandIdx == null) setOppHand(prev => [...prev, dragCardName]);
    // From own oppHand → no-op (reorder not needed)
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
  const openStatEditor = useCallback((si, zt, hi, slot) => {
    const p = players[si];
    if (zt === 'hero') {
      const h = p.heroes[hi]; if (!h) return;
      setEditTarget({ si, zt, hi, slot });
      setEditHp(String(h.hp)); setEditMaxHp(String(h.maxHp)); setEditAtk(String(h.atk));
      setEditStatuses({ ...(h.statuses || {}) });
      setEditBuffs({ ...(h.buffs || {}) });
    } else if (zt === 'support') {
      const cards = p.supportZones[hi][slot]; if (!cards.length) return;
      const c = getCard(cards[0]);
      setEditTarget({ si, zt, hi, slot });
      setEditHp(String(c?.hp ? (p._customSupportHp?.[hi]?.[slot] ?? c.hp) : '')); setEditMaxHp(''); setEditAtk('');
      const cs = p._creatureStatuses?.[hi + '-' + slot] || {};
      setEditStatuses({ ...cs }); delete editStatuses.buffs;
      setEditBuffs({ ...(cs.buffs || {}) });
      // Biomancy Token: Potion in a support zone — carries a `biomancyLevel`
      // in creatureStatuses. Hydrate the level picker so the dedicated
      // editor branch shows and the generic stat/status inputs are hidden.
      setEditBiomancyLevel(c?.cardType === 'Potion' ? (cs.biomancyLevel || 1) : null);
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
          p.heroes[hi].statuses = { ...editStatuses };
          p.heroes[hi].buffs = Object.keys(editBuffs).length > 0 ? { ...editBuffs } : undefined;
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
        if (Object.keys(editBuffs).length > 0) merged.buffs = { ...editBuffs };
      }
      p._creatureStatuses[hi + '-' + slot] = merged;
      return p;
    });
    setEditTarget(null);
  }, [editTarget, editHp, editMaxHp, editAtk, editStatuses, editBuffs, editBiomancyLevel, updatePlayer, getCard]);

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
    socket.emit('start_puzzle', { players, areaZones, hand, oppHand });
  }, [players, areaZones, hand, oppHand, notify]);

  const handleExport = useCallback(() => {
    if (!validated) return;
    const data = { players, areaZones, hand, oppHand, version: 1 };
    socket.emit('export_puzzle', data);
  }, [validated, players, areaZones, hand, oppHand]);

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
    const h = (e) => { if (e.key === 'Escape') { if (puzzleGameState) return; if (editTarget) setEditTarget(null); else setScreen('menu'); e.stopImmediatePropagation(); } };
    window.addEventListener('keydown', h, true); return () => window.removeEventListener('keydown', h, true);
  }, [editTarget, puzzleGameState]);

  // ── Surprise eligibility: check if hero has abilities matching the surprise's spell schools ──
  const isSurpriseUsable = useCallback((p, hi, cardName) => {
    const hero = p.heroes[hi];
    if (!hero) return false;
    const c = getCard(cardName);
    if (!c) return false;
    const schools = [c.spellSchool1, c.spellSchool2].filter(Boolean);
    if (schools.length === 0) return true; // no school requirement
    // Collect hero's ability names across all 3 slots
    const heroAbilities = (p.abilityZones[hi] || []).flat();
    return schools.some(s => heroAbilities.includes(s));
  }, [getCard]);

  // ── Status effect and buff constants ──
  const STATUS_LIST = [
    { key: 'frozen', label: '❄️ Frozen', color: '#66ccff' },
    { key: 'stunned', label: '⚡ Stunned', color: '#ffdd44' },
    { key: 'burned', label: '🔥 Burned', color: '#ff6633' },
    { key: 'poisoned', label: '☠️ Poisoned', color: '#aa44ff', stacks: true },
    { key: 'negated', label: '🚫 Negated', color: '#888' },
    { key: 'shielded', label: '🛡️ Shielded', color: '#44ddff' },
    { key: 'immune', label: '✨ Immune', color: '#ffdd88' },
    { key: 'healReversed', label: '💔 Heal Reversed', color: '#ff4488' },
    { key: 'untargetable', label: '👻 Untargetable', color: '#aaaacc' },
  ];
  const BUFF_LIST = [
    { key: 'cloudy', label: '☁️ Cloudy', color: '#88bbdd' },
    { key: 'freeze_immune', label: '🔥 Freeze Immune', color: '#ff8844' },
    { key: 'submerged', label: '🌊 Submerged', color: '#4488ff', scope: 'oppHero' },
    { key: 'negative_status_immune', label: '😎 Status Immune', color: '#44ff88' },
    // Equip-Artifact-only buff: Anti Magic Enchantment. The scope tag below
    // flips rendering so this buff ONLY shows up when editing an Equipment
    // Artifact, and for that zone type ONLY this buff is offered (all
    // creature/hero statuses + buffs are hidden).
    { key: 'anti_magic_enchanted', label: '🛡️ Anti Magic Enchantment', color: '#ffaa33', scope: 'equip' },
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
                  {hero.statuses?.stunned && <div className="status-stunned-overlay"><div className="stun-bolt s1" /><div className="stun-bolt s2" /><div className="stun-bolt s3" /></div>}
                  {hero.statuses?.negated && <NegatedOverlay />}
                  {hero.statuses?.burned && <BurnedOverlay />}
                  {hero.statuses?.poisoned && <PoisonedOverlay stacks={hero.statuses.poisoned.stacks || 1} />}
                  {hero.statuses?.healReversed && <HealReversedOverlay />}
                  {hero.statuses?.shielded && <ImmuneIcon heroName={hero.name} statusType="shielded" />}
                  {hero.statuses?.immune && !hero.statuses?.shielded && <ImmuneIcon heroName={hero.name} statusType="immune" />}
                  {(hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.burned || hero.statuses?.poisoned || hero.statuses?.negated || hero.statuses?.nulled || hero.statuses?.healReversed || hero.statuses?.untargetable || hero.statuses?.charmed) &&
                    <StatusBadges statuses={hero.statuses} isHero={true} />}
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
                  return <BoardCard cardName={sName} faceDown={isOpp}
                    style={!usable && !isOpp ? { opacity: 0.45, filter: 'grayscale(0.7)' } : undefined} />;
                })() : <div className="board-zone-empty">Surp</div>}
              </div>
              {maxRight > 0 && Array.from({ length: maxRight }).map((_, s) => <div key={'rp'+s} className="board-zone-spacer" />)}
              {/* Permanents — inside last hero group, positioned after it so they track island width changes */}
              {hi === 2 && (
                <div style={{ position: 'absolute', left: '100%', top: 0, marginLeft: 'calc(8px * var(--board-scale))', display: 'flex', flexDirection: 'column', gap: 'calc(3px * var(--board-scale))' }}>
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
                        {(cs.frozen || cs.stunned || cs.burned || cs.poisoned || cs.negated) &&
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
        <h2 className="orbit-font" style={{ fontSize: 14, color: '#ff8800' }}>🔧 PUZZLE CREATOR</h2>
        <input className="input" value={puzzleName} onChange={(e) => { setPuzzleName(e.target.value); setValidated(false); }}
          placeholder="Puzzle name..." style={{ width: 180, padding: '4px 10px', fontSize: 11, borderColor: 'rgba(255,136,0,.4)', color: '#ff8800' }} />
        <div style={{ flex: 1 }} />
        <button className="btn btn-danger" onClick={handleReset} style={{ padding: '4px 14px', fontSize: 10 }}>↺ RESET</button>
        <button className="btn" onClick={handleVerify} style={{ padding: '4px 14px', fontSize: 10, borderColor: 'var(--success)', color: 'var(--success)' }}>⚔️ TEST PUZZLE</button>
        <button className="btn" onClick={handleExport} disabled={!validated}
          style={{ padding: '4px 14px', fontSize: 10, borderColor: validated ? '#ff8800' : 'var(--bg4)', color: validated ? '#ff8800' : 'var(--text2)', opacity: validated ? 1 : 0.4 }}>↓ EXPORT</button>
        {validated && <span className="badge" style={{ background: 'rgba(51,255,136,.12)', color: 'var(--success)', fontSize: 9, padding: '2px 8px' }}>VALIDATED</span>}
        <VolumeControl />
      </div>

      <div className="pz-layout">
        {/* ── Card Search Panel ── */}
        <div className="pz-search-panel">
          <input className="input" style={{ width: '100%', fontSize: 13, padding: '8px 12px' }}
            placeholder="Search cards..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
            <div className="pz-search-results" ref={searchResultsRef} style={{
              ...(dragCardName ? { overflowY: 'hidden' } : {}),
              ...(isTouchDevice ? { scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } : {}),
            }}>
            {searchResults.map((c, i) => {
              const img = cardImageUrl(c.name);
              return (
                <div key={c.name + i} className="pz-search-card"
                  onClick={!isTouchDevice ? () => { addToHand(c); setMobileSelected(null); } : undefined}
                  onTouchStart={(e) => touchDragStart(c.name, null, null, null, e)}
                  onTouchMove={touchDragMove}
                  onTouchEnd={(e) => { const wasDragging = touchDragRef.current?.dragging; touchDragEnd(e); if (!wasDragging) { e.preventDefault(); addToHand(c); setMobileSelected(null); } }}
                  draggable={!isTouchDevice} onDragStart={(e) => onDragStart(e, c.name, null, null)} onDragEnd={onDragEnd}
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
            {search.trim() && searchResults.length === 0 && (
              <div style={{ color: 'var(--text2)', fontSize: 12, textAlign: 'center', padding: 20 }}>No cards found</div>
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

        {/* ── Board ── */}
        <div className="pz-board-wrap" ref={boardWrapRef} style={{ overflowY: dragCardName ? 'hidden' : undefined }}>
          {/* ── Opponent Hand (always revealed, behind tooltips) ── */}
          <div className="pz-hand pz-hand-opp" style={{ position: 'relative', zIndex: 1, marginBottom: 'calc(4px * var(--board-scale))' }}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverZone('oppHand'); }}
            onDragLeave={() => setDragOverZone(null)}
            onDrop={handleOppHandDrop}>
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
                    onTouchEnd={(e) => { const wasDragging = touchDragRef.current?.dragging; touchDragEnd(e); if (!wasDragging) { e.preventDefault(); const now = Date.now(); const lt = lastTapRef.current; if (lt.handSource === 'oppHand' && lt.handIdx === i && now - lt.time < 350) { removeFromOppHand(i); setMobileSelected(null); lastTapRef.current = { time: 0, handSource: null, handIdx: -1 }; } else { lastTapRef.current = { time: now, handSource: 'oppHand', handIdx: i }; if (mobileSelected?.handSource === 'oppHand' && mobileSelected?.handIdx === i) setMobileSelected(null); else setMobileSelected({ cardName, handIdx: i, handSource: 'oppHand' }); } } }}
                    onContextMenu={(e) => { e.preventDefault(); removeFromOppHand(i); }}
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
              <span style={{ fontSize: 18, color: '#ffd700' }}>💰</span>
              <input className="input" type="number" min="0" value={players[1].gold ?? 0}
                onChange={(e) => { const v = Math.max(0, parseInt(e.target.value) || 0); updatePlayer(1, p => { p.gold = v; return p; }); }}
                style={{ width: 52, padding: '6px 4px', fontSize: 16, textAlign: 'center', borderColor: 'rgba(255,215,0,.4)', color: '#ffd700', fontWeight: 700 }} />
            </div>
          </div>

          <div className="pz-side-label orbit-font">OPPONENT</div>
          {renderSide(1, true)}

            {/* Mid-row: 2 area zones positioned to match spacer positions between hero groups */}
            <div className="board-row" style={{ padding: 'calc(12px * var(--board-scale)) 0' }}>
              <div className="board-hero-group"><div className="board-zone-spacer" /><div className="board-zone-spacer" /><div className="board-zone-spacer" /></div>
              <div className="board-zone" style={{ ...(zs('area') || {}), borderColor: 'rgba(255,51,102,.5)', backgroundColor: zs('area') ? undefined : 'rgba(255,51,102,.08)', ...hl('area', 0, 0, 0) }} {...zh('area', 0, 0, 0)}>
                {areaZones[0].length > 0 ? <BoardCard cardName={areaZones[0][0]} /> : <div className="board-zone-empty">Your Area</div>}
              </div>
              <div className="board-hero-group"><div className="board-zone-spacer" /><div className="board-zone-spacer" /><div className="board-zone-spacer" /></div>
              <div className="board-zone" style={{ ...(zs('area') || {}), borderColor: 'rgba(255,51,102,.5)', backgroundColor: zs('area') ? undefined : 'rgba(255,51,102,.08)', ...hl('area', 1, 0, 0) }} {...zh('area', 1, 0, 0)}>
                {areaZones[1].length > 0 ? <BoardCard cardName={areaZones[1][0]} /> : <div className="board-zone-empty">Opp Area</div>}
              </div>
              <div className="board-hero-group"><div className="board-zone-spacer" /><div className="board-zone-spacer" /><div className="board-zone-spacer" /></div>
            </div>

            {renderSide(0, false)}
          <div className="pz-side-label orbit-font">YOU</div>
        </div>
      </div>

      {/* ── Staging Hand (z-index above tooltip) ── */}
      <div className="pz-hand" style={{ position: 'relative', zIndex: 10000 }}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverZone('hand'); }}
        onDragLeave={() => setDragOverZone(null)}
        onDrop={handleHandDrop}>
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
                onTouchEnd={(e) => { const wasDragging = touchDragRef.current?.dragging; touchDragEnd(e); if (!wasDragging) { e.preventDefault(); const now = Date.now(); const lt = lastTapRef.current; if (lt.handSource === 'hand' && lt.handIdx === i && now - lt.time < 350) { removeFromHand(i); setMobileSelected(null); lastTapRef.current = { time: 0, handSource: null, handIdx: -1 }; } else { lastTapRef.current = { time: now, handSource: 'hand', handIdx: i }; if (mobileSelected?.handSource === 'hand' && mobileSelected?.handIdx === i) setMobileSelected(null); else setMobileSelected({ cardName, handIdx: i, handSource: 'hand' }); } } }}
                onContextMenu={(e) => { e.preventDefault(); removeFromHand(i); }}
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
          <span style={{ fontSize: 18, color: '#ffd700' }}>💰</span>
          <input className="input" type="number" min="0" value={players[0].gold ?? 0}
            onChange={(e) => { const v = Math.max(0, parseInt(e.target.value) || 0); updatePlayer(0, p => { p.gold = v; return p; }); }}
            style={{ width: 52, padding: '6px 4px', fontSize: 16, textAlign: 'center', borderColor: 'rgba(255,215,0,.4)', color: '#ffd700', fontWeight: 700 }} />
        </div>
      </div>

      {/* ── Card Tooltip Panel ── */}
      {tooltipCard && (
        <div className="board-tooltip" style={tooltipSide === 'right'
          ? { left: 580, right: 'auto', borderLeft: '1px solid var(--accent)', borderRight: 'none' }
          : { left: 220, right: 'auto', borderRight: '1px solid var(--accent)', borderLeft: 'none', boxShadow: '4px 0 20px rgba(0,0,0,.8)' }
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
        const labels = { discardPile: 'Discard Pile', deletedPile: 'Deleted Pile', mainDeck: 'Deck', potionDeck: 'Potion Deck' };
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
            {!isBiomancyTokenEdit && (
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
            )}
            {/* Equip-Artifact edit targets restrict the buff picker to
                the Anti-Magic-Enchantment buff and hide all Status Effects.
                Biomancy Token edit targets hide both sections entirely. */}
            {/* ── Status Effects ── (hidden for Equip Artifacts & Biomancy Tokens) */}
            {!isBiomancyTokenEdit && !(editTarget.zt === 'support' && (() => {
              const p = players[editTarget.si];
              const cards = p.supportZones[editTarget.hi]?.[editTarget.slot] || [];
              const c = cards.length ? getCard(cards[0]) : null;
              return c && c.cardType === 'Artifact' && (c.subtype || '').toLowerCase() === 'equipment';
            })()) && (
            <div style={{ marginBottom: 14 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 1 }}>Status Effects</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {STATUS_LIST.map(st => {
                  const active = !!editStatuses[st.key];
                  return (
                    <div key={st.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button className="btn" style={{
                        padding: '3px 8px', fontSize: 10,
                        borderColor: active ? st.color : 'var(--bg4)',
                        color: active ? st.color : 'var(--text2)',
                        background: active ? st.color + '18' : 'transparent',
                      }} onClick={() => setEditStatuses(prev => {
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
            {/* ── Buffs ── (hidden for Biomancy Tokens) */}
            {!isBiomancyTokenEdit && (
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
                  return (
                    <button key={bf.key} className="btn" style={{
                      padding: '3px 8px', fontSize: 10,
                      borderColor: active ? bf.color : 'var(--bg4)',
                      color: active ? bf.color : 'var(--text2)',
                      background: active ? bf.color + '18' : 'transparent',
                    }} onClick={() => setEditBuffs(prev => {
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
          setMobileSelected(null);
        }}>✕ Remove</div>
      )}
    </div>
  );
}

window.PuzzleCreator = PuzzleCreator;
