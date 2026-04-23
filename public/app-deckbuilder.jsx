// ═══════════════════════════════════════════
//  PIXEL PARTIES — DECK BUILDER
//  DeckBuilder component and helpers
// ═══════════════════════════════════════════
const { useState, useEffect, useRef, useCallback, useMemo, useContext, useLayoutEffect } = React;
const { api, socket, AppContext, CardMini, FoilOverlay, useFoilBands, cardImageUrl, skinImageUrl,
        isDeckLegal, countInDeck, hasNicolasHero, canAddCard, trimOverLimitCopies, typeColor, typeClass,
        sortDeckCards, shuffleArray } = window;
const { ALL_CARDS, CARDS_BY_NAME, AVAILABLE_CARDS, AVAILABLE_MAP, CARD_TYPES, SUBTYPES,
        SPELL_SCHOOLS, STARTING_ABILITIES, ARCHETYPES, SKINS_DB } = window;
let _persistedUnsaved = {};
let _persistedSectionHist = {};

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
window.deckDragState = null;

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
  const [showSamples, setShowSamples] = useState(true); // legacy — kept so rename is minimal
  const [showStructures, setShowStructures] = useState(true);
  const [showStarters, setShowStarters] = useState(true);
  const [sampleActive, setSampleActive] = useState(-1);
  const isSampleMode = sampleActive >= 0;
  const [filters, setFilters] = useState({ name:'',effect:'',cardType:'',subtype:'',archetype:'',sa1:'',sa2:'',ss1:'',ss2:'',level:'',cost:'',hp:'',atk:'' });
  const [cardPage, setCardPage] = useState(0);
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState('');
  const [ctxMenu, setCtxMenu] = useState(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
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
      try { const sd = await api('/sample-decks/owned'); setSampleDecks(sd.decks || []); } catch (e) { /* ignore */ }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    const close = () => setCtxMenu(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, []);

  // Ref to track latest state for Escape handler (avoids stale closures)
  const escStateRef = useRef({});

  // Escape closes context menu / skin gallery, or checks unsaved before navigating away
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key !== 'Escape') return;
      const s = escStateRef.current;
      if (s.showLeaveConfirm) { e.preventDefault(); e.stopImmediatePropagation(); setShowLeaveConfirm(false); setScreen('menu'); return; }
      if (s.skinGallery) { e.preventDefault(); e.stopImmediatePropagation(); setSkinGallery(null); return; }
      if (s.ctxMenu) { e.preventDefault(); e.stopImmediatePropagation(); setCtxMenu(null); return; }
      if (s.hasUnsaved && !s.isSampleMode) { e.preventDefault(); e.stopImmediatePropagation(); setShowLeaveConfirm(true); return; }
      setScreen('menu');
    };
    window.addEventListener('keydown', handleEsc, true);
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, []);

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
    const addOk = () => { if (window.playSFX) window.playSFX('draw'); };
    if (section === 'main') {
      if (!canAddCard(currentDeck, cardName, 'main')) return false;
      updateSections({ main: [...(currentDeck.mainDeck || []), cardName] });
      addOk();
      return true;
    }
    if (section === 'potion') {
      if (!canAddCard(currentDeck, cardName, 'potion')) return false;
      updateSections({ potion: [...(currentDeck.potionDeck || []), cardName] });
      addOk();
      return true;
    }
    if (section === 'side') {
      if (!canAddCard(currentDeck, cardName, 'side')) return false;
      updateSections({ side: [...(currentDeck.sideDeck || []), cardName] });
      addOk();
      return true;
    }
    if (section === 'hero') {
      if (!canAddCard(currentDeck, cardName, 'hero')) return false;
      const heroes = [...(currentDeck.heroes || [{ hero:null,ability1:null,ability2:null },{ hero:null,ability1:null,ability2:null },{ hero:null,ability1:null,ability2:null }])];
      const slot = heroes.findIndex(h => !h || !h.hero);
      if (slot < 0) return false;
      heroes[slot] = { hero: cardName, ability1: card.startingAbility1 || null, ability2: card.startingAbility2 || null };
      updateSections({ heroes });
      addOk();
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
    if (!key) return addCardTo(cardName, section); // Delegated call plays its own SFX.
    const arr = [...(currentDeck[key] || [])];
    arr.splice(Math.min(idx, arr.length), 0, cardName);
    updateSections({ [section]: arr });
    if (window.playSFX) window.playSFX('draw');
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
    if (window.playSFX) window.playSFX('draw');
    return true;
  }, [currentDeck, unsaved, decks, activeIdx]);

  const removeFrom = useCallback((cardName, section, index) => {
    if (!currentDeck) return;
    if (window.playSFX) window.playSFX('discard');
    const removeOne = (arr, idx) => { const n = [...arr]; if (idx != null) n.splice(idx, 1); else { const i = n.indexOf(cardName); if (i >= 0) n.splice(i, 1); } return n; };
    // "The Sacred Jewel" clause: removing this card may drop the deck's
    // Sacred Jewel count below the 4-copy threshold that grants every
    // Artifact a 5-copy allowance. When that happens, any Artifact
    // currently at 5 copies must be auto-trimmed back to 4. We assemble
    // the prospective post-remove deck, then run trimOverLimitCopies.
    const maybeAutoTrim = (draftDeck) => {
      if (cardName !== 'The Sacred Jewel') return draftDeck;
      return trimOverLimitCopies(draftDeck);
    };
    if (section === 'main') {
      const next = maybeAutoTrim({ ...currentDeck, mainDeck: removeOne(currentDeck.mainDeck || [], index) });
      updateSections({ main: next.mainDeck, potion: next.potionDeck, side: next.sideDeck });
    } else if (section === 'potion') {
      const next = maybeAutoTrim({ ...currentDeck, potionDeck: removeOne(currentDeck.potionDeck || [], index) });
      updateSections({ main: next.mainDeck, potion: next.potionDeck, side: next.sideDeck });
    } else if (section === 'side') {
      const next = maybeAutoTrim({ ...currentDeck, sideDeck: removeOne(currentDeck.sideDeck || [], index) });
      updateSections({ main: next.mainDeck, potion: next.potionDeck, side: next.sideDeck });
    } else if (section === 'hero') {
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
  const showCoverMenu = useCallback((cardName, e, section, origIdx) => {
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
    // Remove from deck option
    if (section) {
      items.push({ label: 'Remove from deck', icon: '🗑', color: 'var(--danger)', action: () => removeFrom(cardName, section, origIdx) });
    }
    setCtxMenu({ x: e.clientX, y: e.clientY, items });
  }, [currentDeck, setCoverCard, removeFrom]);

  // Left-click DB card → context menu
  const showAddMenu = useCallback((cardName, e) => {
    const card = CARDS_BY_NAME[cardName];
    if (!card || !currentDeck) return;
    const items = [];
    if (card.cardType === 'Hero') {
      items.push({ label: 'Add to Heroes', icon: '👑', color: '#ffd700', disabled: !canAddCard(currentDeck, cardName, 'hero'), action: () => addCardTo(cardName, 'hero') });
    } else if (card.cardType === 'Potion') {
      items.push({ label: 'Add to Potion Deck', icon: '🧪', color: '#44ffaa', disabled: !canAddCard(currentDeck, cardName, 'potion'), action: () => addCardTo(cardName, 'potion') });
      if (hasNicolasHero(currentDeck)) {
        items.push({ label: 'Add to Main Deck', icon: '📋', color: '#44aaff', disabled: !canAddCard(currentDeck, cardName, 'main'), action: () => addCardTo(cardName, 'main') });
      }
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
    if (f.sa1) result = result.filter(c => c.startingAbility1 === f.sa1 || c.startingAbility2 === f.sa1);
    if (f.sa2) result = result.filter(c => c.startingAbility1 === f.sa2 || c.startingAbility2 === f.sa2);
    if (f.ss1) result = result.filter(c => c.spellSchool1 === f.ss1 || c.spellSchool2 === f.ss1);
    if (f.ss2) result = result.filter(c => c.spellSchool1 === f.ss2 || c.spellSchool2 === f.ss2);
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
  escStateRef.current = { showLeaveConfirm, skinGallery, ctxMenu, hasUnsaved, isSampleMode };
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
    if (e.type === 'mousedown' && e.button !== 0) return;
    if (e.cancelable) e.preventDefault();
    const _startPt = window.getPointerXY(e);
    const startX = _startPt.x, startY = _startPt.y;
    let dragging = false;

    window.addDragListeners(
      (mx, my) => {
        if (!dragging) {
          if (Math.abs(mx - startX) + Math.abs(my - startY) < 5) return;
          dragging = true;
          clearTimeout(window._longPressTimer);
          window.deckDragState = { section, fromIdx, cardName };
        }
        setDeckDrag({ section, fromIdx, cardName, card: CARDS_BY_NAME[cardName], mouseX: mx, mouseY: my });
      },
      (mx, my) => {
        if (!dragging) {
          setDeckDrag(null); window.deckDragState = null;
          // On touch, preventDefault on touchstart suppresses the browser click.
          // Emulate it so CardMini onClick (cover menu, etc.) still works.
          if (window._isTouchDevice) {
            const el = document.elementFromPoint(mx, my);
            if (el) el.click();
          }
          return;
        }

        // Find which section body the pointer is over
        const dropTarget = findDropTarget(mx, my, section, fromIdx);
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
            handleDrop(dropTarget.section, { cardName, fromSection: section, fromIndex: fromIdx }, mx, my);
          }
        } else {
          // Dropped outside any section — remove from deck
          removeFrom(cardName, section, fromIdx);
        }
        setDeckDrag(null);
        window.deckDragState = null;
      }
    );
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
        const allSlots = secEl.querySelectorAll('.deck-drag-slot');
        // Build list of visible (non-dragging) slots for hit detection,
        // tracking their original indices so the returned idx matches the
        // deck array with the drag source removed (same as original behavior).
        const slots = [];
        for (let i = 0; i < allSlots.length; i++) {
          if (allSlots[i].classList.contains('deck-dragging')) continue;
          slots.push(allSlots[i]);
        }
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

    // Source section — keep dragged card in DOM (for touch tracking) but insert gap at cursor
    if (deckDrag.section === section) {
      const dropTarget = findDropTarget(deckDrag.mouseX, deckDrag.mouseY, deckDrag.section, deckDrag.fromIdx);
      const filled = [];
      for (let i = 0; i < cards.length; i++) {
        filled.push({ card: cards[i], origIdx: i, isGap: false, isEmpty: false });
      }
      if (dropTarget && dropTarget.section === section) {
        // findDropTarget returns indices that skip the drag source, but filled
        // still contains it — adjust insertion point past the drag source
        let insertAt = dropTarget.idx;
        if (insertAt >= deckDrag.fromIdx) insertAt++;
        insertAt = Math.min(insertAt, filled.length);
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
    const lines = ['=== PIXEL PARTIES DECK ===', 'Name: ' + (currentDeck.name || 'Unnamed')];
    // Persist the chosen cover card so structure decks can display it in
    // the shop catalog and anywhere else a deck thumbnail is shown.
    if (currentDeck.coverCard) lines.push('Cover: ' + currentDeck.coverCard);
    lines.push('');

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
        <button className="btn" style={{ padding: '4px 10px', fontSize: 9 }} onClick={() => hasUnsaved && !isSampleMode ? setShowLeaveConfirm(true) : setScreen('menu')}>← MENU</button>
        <h2 className="orbit-font" style={{ fontSize: 14, color: 'var(--accent)', margin: '0 8px' }}>DECK BUILDER</h2>
        <div style={{ flex: 1 }} />
        <button className="btn" style={{ padding: '4px 10px', fontSize: 9 }}
          disabled={!hasUnsaved || isSampleMode}
          onClick={() => { if (!currentDeck) return; const id = currentDeck.id; setUnsaved(prev => { const n = { ...prev }; delete n[id]; return n; }); delete shRef.current[id]; setHistoryTick(t => t + 1); }}>
          ↩ RESET</button>
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
        <VolumeControl />
      </div>

      <div className="db-content" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* ── LEFT: DECK LIST ── */}
        <div className="db-panel-left" style={{ width: 170, background: 'var(--bg2)', borderRight: '1px solid var(--bg4)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div className="orbit-font" style={{ padding: 8, fontSize: 10, color: 'var(--text2)', fontWeight: 700 }}>YOUR DECKS</div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {decks.map((d, i) => {
              const v = isDeckLegal(d); const hasChanges = unsaved[d.id];
              return (
                <div key={d.id} role="button" className={'deck-list-item' + (i === activeIdx && !isSampleMode ? ' active' : '')} onClick={() => { setActiveIdx(i); setSampleActive(-1); }}>
                  {d.isDefault && <span style={{ color: '#ffd700', fontSize: 10 }}>★</span>}
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}{hasChanges ? ' *' : ''}</span>
                  <span style={{ fontSize: 8, color: v.legal ? 'var(--success)' : 'var(--danger)' }}>{v.legal ? '✓' : '✗'}</span>
                </div>
              );
            })}
            {sampleDecks.length > 0 && (() => {
              // Split sample decks into Structure (owned shop decks) and
              // Starter (always-free) categories. Each section gets its
              // own collapsible header. sampleActive still indexes the
              // original sampleDecks array so persistent state / selection
              // remains stable across renders.
              const structureDecks = sampleDecks
                .map((d, i) => ({ d, i }))
                .filter(e => e.d.isStructure);
              const starterDecks = sampleDecks
                .map((d, i) => ({ d, i }))
                .filter(e => !e.d.isStructure);
              const renderSampleRow = ({ d, i }) => {
                const v = isDeckLegal(d); const hasChanges = unsaved[d.id];
                return (
                  <div key={d.id} role="button" className={'deck-list-item deck-list-sample' + (isSampleMode && sampleActive === i ? ' active' : '')}
                    onClick={() => setSampleActive(i)}>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}{hasChanges ? ' *' : ''}</span>
                    <span style={{ fontSize: 8, color: v.legal ? 'var(--success)' : 'var(--danger)' }}>{v.legal ? '✓' : '✗'}</span>
                  </div>
                );
              };
              return (
                <>
                  {structureDecks.length > 0 && (
                    <>
                      <div style={{ padding: '6px 8px 4px', display: 'flex', alignItems: 'center', gap: 6, borderTop: '1px solid var(--bg4)', marginTop: 4 }}>
                        <span style={{ fontSize: 9, color: 'var(--text2)', fontWeight: 700, flex: 1 }}>STRUCTURE DECKS</span>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 9, color: 'var(--accent)', padding: 0 }}
                          onClick={() => setShowStructures(v => !v)}>{showStructures ? 'Hide' : 'Show'}</button>
                      </div>
                      {showStructures && structureDecks.map(renderSampleRow)}
                    </>
                  )}
                  {starterDecks.length > 0 && (
                    <>
                      <div style={{ padding: '6px 8px 4px', display: 'flex', alignItems: 'center', gap: 6, borderTop: '1px solid var(--bg4)', marginTop: 4 }}>
                        <span style={{ fontSize: 9, color: 'var(--text2)', fontWeight: 700, flex: 1 }}>STARTER DECKS</span>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 9, color: 'var(--accent)', padding: 0 }}
                          onClick={() => setShowStarters(v => !v)}>{showStarters ? 'Hide' : 'Show'}</button>
                      </div>
                      {showStarters && starterDecks.map(renderSampleRow)}
                    </>
                  )}
                </>
              );
            })()}
          </div>
          <button className="btn" style={{ margin: 8, padding: 6, fontSize: 10 }} onClick={async () => {
            try { const data = await api('/decks', { method: 'POST', body: JSON.stringify({ name: 'Deck ' + (decks.length + 1) }) }); setDecks([...decks, data.deck]); setActiveIdx(decks.length); } catch (e) { notify(e.message, 'error'); }
          }}>+ NEW DECK</button>
        </div>

        {/* ── CENTER: ALL DECK SECTIONS ── */}
        <div className="db-panel-center" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
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
              <div className="db-hero-row" data-deck-section="hero">
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
                    <div data-hero-slot={i} className={'db-hero-slot' + (isDropTarget ? ' drop-target' : '')}>
                      {/* Hero card — scales with the row width via .db-hero-card (aspect 5:7) */}
                      {h && h.hero && CARDS_BY_NAME[h.hero] ? (
                        <div className="db-hero-card" data-touch-drag="1"
                          onMouseDown={(e) => onDeckCardMouseDown(e, 'hero', i, h.hero)}
                          onTouchStart={(e) => onDeckCardMouseDown(e, 'hero', i, h.hero)}
                          onContextMenu={(e) => { e.preventDefault(); removeFrom(h.hero, 'hero'); }}>
                          <CardMini card={CARDS_BY_NAME[h.hero]}
                            onClick={(e) => showCoverMenu(h.hero, e, 'hero')}
                            isCover={h.hero === currentDeck?.coverCard} skins={currentDeck?.skins} />
                          <button style={{ position: 'absolute', top: -5, right: -5, background: 'var(--danger)', color: '#fff',
                            border: 'none', width: 18, height: 18, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                            onClick={() => removeFrom(h.hero, 'hero')}>✕</button>
                        </div>
                      ) : (
                        <div className="db-hero-card">
                          <div className="card-slot"><span>Hero {i + 1}</span></div>
                        </div>
                      )}
                      {/* Starting Abilities: two cards stacked, each at aspect 5:7 — see .db-hero-abilities */}
                      <div className="db-hero-abilities">
                        {[h?.ability1, h?.ability2].map((ab, ai) => {
                          const abCard = ab ? CARDS_BY_NAME[ab] : null;
                          if (abCard) return <CardMini key={ai} card={abCard} onClick={() => {}} />;
                          return (
                            <div key={ai} className="ability-slot" style={{ padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                  return <div key={'m-'+item.origIdx} className={'deck-drag-slot' + (isDragging ? ' deck-dragging' : '')} data-touch-drag="1"
                    onMouseDown={(e) => onDeckCardMouseDown(e, 'main', item.origIdx, item.card)}
                    onTouchStart={(e) => onDeckCardMouseDown(e, 'main', item.origIdx, item.card)}
                    onContextMenu={(e) => { e.preventDefault(); removeFrom(item.card, 'main', item.origIdx); }}>
                    <CardMini card={card} onClick={(e) => showCoverMenu(item.card, e, 'main', item.origIdx)} isCover={item.card === currentDeck?.coverCard} skins={currentDeck?.skins} />
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
                  return <div key={'p-'+item.origIdx} className={'deck-drag-slot' + (isDragging ? ' deck-dragging' : '')} data-touch-drag="1"
                    onMouseDown={(e) => onDeckCardMouseDown(e, 'potion', item.origIdx, item.card)}
                    onTouchStart={(e) => onDeckCardMouseDown(e, 'potion', item.origIdx, item.card)}
                    onContextMenu={(e) => { e.preventDefault(); removeFrom(item.card, 'potion', item.origIdx); }}>
                    <CardMini card={card} onClick={(e) => showCoverMenu(item.card, e, 'potion', item.origIdx)} isCover={item.card === currentDeck?.coverCard} skins={currentDeck?.skins} />
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
                  return <div key={'s-'+item.origIdx} className={'deck-drag-slot' + (isDragging ? ' deck-dragging' : '')} data-touch-drag="1"
                    onMouseDown={(e) => onDeckCardMouseDown(e, 'side', item.origIdx, item.card)}
                    onTouchStart={(e) => onDeckCardMouseDown(e, 'side', item.origIdx, item.card)}
                    onContextMenu={(e) => { e.preventDefault(); removeFrom(item.card, 'side', item.origIdx); }}>
                    <CardMini card={card} onClick={(e) => showCoverMenu(item.card, e, 'side', item.origIdx)} isCover={item.card === currentDeck?.coverCard} skins={currentDeck?.skins} />
                  </div>;
                })}
              </div>
            </DropSection>

          </div>
        </div>

        {/* ── RIGHT: CARD DATABASE ── */}
        <div className="db-panel-right" style={{ width: 400, background: 'var(--bg2)', borderLeft: '1px solid var(--bg4)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
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
            <div className="db-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
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

      {/* Unsaved changes confirmation */}
      {showLeaveConfirm && (
        <div className="modal-overlay" style={{ background: 'rgba(0,0,0,.7)', zIndex: 10001 }}>
          <div className="animate-in" style={{
            background: 'var(--bg2)', border: '2px solid var(--danger)', borderRadius: 12,
            padding: '24px 32px', textAlign: 'center', maxWidth: 320,
          }}>
            <div className="orbit-font" style={{ fontSize: 15, color: 'var(--danger)', marginBottom: 12 }}>
              You have unsaved changes!
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn btn-success" style={{ padding: '8px 24px', fontSize: 12 }}
                onClick={async () => { await saveCurrent(); setShowLeaveConfirm(false); setScreen('menu'); }}>
                💾 Save
              </button>
              <button className="btn btn-danger" style={{ padding: '8px 24px', fontSize: 12 }}
                onClick={() => { setShowLeaveConfirm(false); setScreen('menu'); }}>
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

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


// ===== CROSS-FILE EXPORTS =====
window.DeckBuilder = DeckBuilder;
