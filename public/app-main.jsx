// ═══════════════════════════════════════════
//  PIXEL PARTIES — APP ROOT
//  PlayScreen, MusicManager, and App component
// ═══════════════════════════════════════════
const { useState, useEffect, useRef, useCallback, useContext } = React;
const { api, socket, AppContext, Notification, CardMini, loadCardDB,
        isDeckLegal, isCubeDeck, emitSocket } = window;
const { AuthScreen, MainMenu, ProfileScreen, ShopScreen, RulesScreen, PuzzleCreator, VolumeControl } = window;
const { DeckBuilder } = window;
const { GameBoard } = window;
let _pendingGameState = null;

// ═══════════════════════════════════════════
//  CUBE DRAFT — DRAFTING SCREEN
//  Renders the live drafting UI: 16-card pack centered, drafted pool
//  bottom strip with name filter and drag-reorder, hover tooltip on
//  the right, player ring + direction arrows + per-seat timer top-left,
//  pack/pick counters top-center. Pickled cards are committed to the
//  server via `cube_draft_pick`; once your pick lands the pack grays
//  out and you wait for the rest of the table.
// ═══════════════════════════════════════════
function CubeDraftScreen({ lobby, draft, leaveRoom, notify }) {
  const [hoveredCard, setHoveredCard] = useState(null);
  const [filter, setFilter] = useState('');
  const [poolOrder, setPoolOrder] = useState([]); // local custom ordering
  const [dragSrc, setDragSrc] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  // Mirror server-pushed pool into local custom-ordered list. New cards
  // append; removed cards (shouldn't happen during draft, but defensive)
  // drop out. Drag-reorder mutates this list only.
  useEffect(() => {
    const incoming = draft?.myPool || [];
    setPoolOrder(prev => {
      const prevSet = new Set(prev.map((_, i) => i));
      // Build new order by counts: each card name has N copies in
      // incoming. Walk prev and keep entries whose card+occurrence
      // still exists in incoming, then append new ones.
      const remainingCounts = {};
      for (const c of incoming) remainingCounts[c] = (remainingCounts[c] || 0) + 1;
      const next = [];
      for (const c of prev) {
        if ((remainingCounts[c] || 0) > 0) {
          next.push(c);
          remainingCounts[c]--;
        }
      }
      // Append new cards (in incoming order) that weren't in prev.
      for (const c of incoming) {
        if ((remainingCounts[c] || 0) > 0) {
          next.push(c);
          remainingCounts[c]--;
        }
      }
      return next;
    });
  }, [draft?.myPool?.length]);

  // Live-tick the displayed timer locally so the budget visibly counts
  // down between server broadcasts (which only fire on pick windows).
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!draft || draft.suspended || draft.myPicked) return;
    const t = setInterval(() => setTick(x => x + 1), 250);
    return () => clearInterval(t);
  }, [draft?.suspended, draft?.myPicked, draft?.round, draft?.pickInRound]);

  if (!draft) {
    return (
      <div className="screen-full">
        <div className="top-bar">
          <button className="btn btn-danger" style={{ padding: '4px 12px', fontSize: 10 }} onClick={leaveRoom}>LEAVE</button>
          <h2 className="orbit-font" style={{ fontSize: 14, color: 'var(--accent)' }}>🧊 CUBE DRAFT</h2>
          <VolumeControl />
        </div>
        <div className="screen-center" style={{ flexDirection: 'column', gap: 12 }}>
          <div className="orbit-font" style={{ color: 'var(--accent)', animation: 'pulse 1.5s infinite' }}>Opening packs…</div>
        </div>
      </div>
    );
  }
  if (draft.isSpectator) {
    return (
      <div className="screen-full">
        <div className="top-bar">
          <button className="btn btn-danger" style={{ padding: '4px 12px', fontSize: 10 }} onClick={leaveRoom}>LEAVE</button>
          <h2 className="orbit-font" style={{ fontSize: 14, color: 'var(--accent)' }}>🧊 CUBE DRAFT — SPECTATING</h2>
          <span className="badge" style={{ background: 'rgba(154,216,255,.14)', color: '#9ad8ff' }}>Pack {draft.round + 1}/{draft.totalRounds} · Pick {draft.pickInRound + 1}/{draft.totalPicks}</span>
          <VolumeControl />
        </div>
        <div className="screen-center" style={{ flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 48 }}>🧊</div>
          <div className="orbit-font" style={{ color: 'var(--text2)', textAlign: 'center', maxWidth: 480, lineHeight: 1.5 }}>
            Drafting in progress. Spectators don't see the cards being picked — that would leak hidden info to participants. The match will become spectatable once decks are built.
          </div>
        </div>
      </div>
    );
  }

  const canPick = !draft.myPicked && !draft.suspended && draft.myPack.length > 0;
  const totalRemainingMs = (draft.remainingMs || 0) - (draft.myPicked || draft.suspended ? 0 : (tick * 0)); // tick is just to re-render
  // Actual countdown: server gave us remainingMs at the time of last
  // broadcast. We don't have a precise client-side anchor for the window
  // start, so we just tick down from that snapshot. This drifts slightly
  // but the next server broadcast (every pick) re-syncs.
  const startedAt = useRef(Date.now());
  useEffect(() => { startedAt.current = Date.now(); }, [draft?.round, draft?.pickInRound, draft?.suspended]);
  const elapsedClient = (draft.myPicked || draft.suspended) ? 0 : (Date.now() - startedAt.current);
  const displayRemainingMs = Math.max(0, (draft.remainingMs || 0) - elapsedClient);
  const m = Math.floor(displayRemainingMs / 60000);
  const s = Math.floor((displayRemainingMs % 60000) / 1000);
  const timerStr = m + ':' + String(s).padStart(2, '0');
  const timerWarn = displayRemainingMs <= 10_000;

  // Filter pool by name search.
  const visiblePool = poolOrder
    .map((c, i) => ({ name: c, idx: i }))
    .filter(e => !filter || e.name.toLowerCase().includes(filter.toLowerCase()));

  const reorderPool = (fromIdx, toIdx) => {
    if (fromIdx === toIdx || toIdx < 0) return;
    setPoolOrder(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx > fromIdx ? toIdx - 1 : toIdx, 0, moved);
      return arr;
    });
  };

  // Player ring shown top-left. Always rooted at "me" so the local seat
  // is at index 0; subsequent entries follow the snake direction so the
  // arrow column reads naturally.
  const seatOrder = draft.seatOrder || [];
  const myRingPos = seatOrder.indexOf(draft.seatIdx);
  const ringSize = seatOrder.length;
  const ringList = [];
  if (myRingPos >= 0) {
    for (let i = 0; i < ringSize; i++) {
      const ringPos = draft.direction === 'left'
        ? (myRingPos + i) % ringSize
        : (myRingPos - i + ringSize) % ringSize;
      const seatIdx = seatOrder[ringPos];
      const player = draft.players[seatIdx];
      ringList.push({ ringPos, seatIdx, username: player?.username || `Seat ${seatIdx}`, isBot: !!player?.isBot, isMe: seatIdx === draft.seatIdx, picked: draft.seatPicked[seatIdx] });
    }
  }

  return (
    <div className="screen-full" style={{ background: 'linear-gradient(180deg, var(--bg) 0%, var(--bg2) 100%)' }}>
      {/* TOP BAR */}
      <div className="top-bar">
        <button className="btn btn-danger" style={{ padding: '4px 12px', fontSize: 10 }} onClick={leaveRoom}>LEAVE</button>
        <h2 className="orbit-font" style={{ fontSize: 14, color: 'var(--accent)' }}>🧊 CUBE DRAFT</h2>
        <div style={{ flex: 1 }} />
        <span className="badge" style={{ background: 'rgba(154,216,255,.14)', color: '#9ad8ff', fontSize: 13, padding: '5px 14px', fontWeight: 700 }}>
          Pack {draft.round + 1}/{draft.totalRounds} · Pick {draft.pickInRound + 1}/{draft.totalPicks}
        </span>
        {draft.timerDisabled ? (
          <span className="badge" style={{ background: 'rgba(0,240,255,.08)', color: 'var(--text2)', fontSize: 12, padding: '5px 14px', fontWeight: 600 }}>
            ⏱ Untimed
          </span>
        ) : (
          <span className="badge" style={{
            background: timerWarn ? 'rgba(255,80,80,.18)' : 'rgba(0,240,255,.10)',
            color: timerWarn ? '#ff6666' : 'var(--accent)',
            fontSize: 13, padding: '5px 14px', fontWeight: 700,
            animation: timerWarn ? 'pulse 1s infinite' : undefined,
          }}>
            ⏱ {timerStr}
          </span>
        )}
        <VolumeControl />
      </div>

      {/* SUSPENDED BANNER */}
      {draft.suspended && (() => {
        // Identify which seat is the candidate for kick — first online
        // human seat with no socketId, found by name absence in seatPicked
        // table is unreliable; the server names the seat in suspendReason.
        // Use seatOrder + players to find it.
        const downSeats = [];
        for (let i = 0; i < draft.players.length; i++) {
          const p = draft.players[i];
          if (!p.isBot && draft.seatPicked && !p.online && i !== draft.seatIdx) downSeats.push(i);
        }
        // Fallback: any seat that's the kick target.
        const kickTarget = draft.voteKick?.targetSeat;
        return (
          <div style={{ background: 'rgba(255,170,0,.15)', border: '1px solid #ffaa33', padding: '8px 16px', textAlign: 'center', color: '#ffcc44', fontWeight: 600 }}>
            ⏸ Draft suspended — {draft.suspendReason || 'a player has disconnected'}.
            {draft.voteKick ? (
              <>
                <span style={{ marginLeft: 12 }}>
                  Vote-kick {draft.voteKick.targetUsername}: {draft.voteKick.votes}/{draft.voteKick.needed}
                </span>
                <button className="btn btn-danger" style={{ marginLeft: 12, padding: '2px 12px', fontSize: 11 }}
                  onClick={() => socket.emit('cube_draft_vote_kick', { roomId: lobby.id, targetSeat: draft.voteKick.targetSeat })}>
                  Vote-kick
                </button>
              </>
            ) : (
              // Allow any drafter to initiate a vote against the disconnected seat.
              // The server figures out who that seat is from suspendReason, so
              // we attempt the call against any non-bot seat that isn't us — the
              // server validates which seat is actually offline.
              draft.players.map((p, i) => (
                !p.isBot && i !== draft.seatIdx ? (
                  <button key={i} className="btn" style={{ marginLeft: 6, padding: '2px 10px', fontSize: 10 }}
                    onClick={() => socket.emit('cube_draft_vote_kick', { roomId: lobby.id, targetSeat: i })}>
                    Vote-kick {p.username}
                  </button>
                ) : null
              ))
            )}
          </div>
        );
      })()}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* LEFT — player ring */}
        <div style={{ width: 200, padding: 12, borderRight: '1px solid var(--bg4)', background: 'var(--bg)', overflowY: 'auto' }}>
          <div className="orbit-font" style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 8, fontWeight: 700, letterSpacing: 1 }}>
            DRAFT RING ({draft.direction === 'left' ? '↓ pass' : '↑ pass'})
          </div>
          {ringList.map((r, i) => (
            <React.Fragment key={r.seatIdx}>
              <div style={{
                padding: '8px 10px',
                background: r.isMe ? 'rgba(0,240,255,.10)' : 'transparent',
                borderLeft: r.isMe ? '3px solid var(--accent)' : '3px solid transparent',
                marginBottom: 2,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <div style={{ fontSize: 14 }}>
                  {r.isBot ? '🤖' : (r.isMe ? '🧑' : '⚔️')}
                </div>
                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, fontWeight: r.isMe ? 700 : 500, color: r.isMe ? 'var(--accent)' : 'var(--text)' }}>
                  {r.username}
                </div>
                <div style={{ fontSize: 14 }} title={r.picked ? 'Picked' : 'Thinking…'}>
                  {r.picked ? '✓' : '⋯'}
                </div>
              </div>
              {i < ringList.length - 1 && (
                <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--text2)', padding: '0 0 1px' }}>
                  {draft.direction === 'left' ? '↓' : '↑'}
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* CENTER — pack */}
        <div style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div className="orbit-font" style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10, textAlign: 'center', fontWeight: 600 }}>
            {draft.myPicked ? 'WAITING FOR OTHER DRAFTERS…' : 'PICK A CARD FROM THIS PACK'}
          </div>
          <div style={{
            flex: 1, display: 'grid',
            gridTemplateColumns: 'repeat(8, 1fr)',
            gridAutoRows: '1fr',
            gap: 6, padding: 4,
            opacity: draft.myPicked ? 0.45 : 1,
            transition: 'opacity .25s',
            alignContent: 'center',
            maxHeight: '100%',
          }}>
            {draft.myPack.map((cardName, idx) => (
              <div key={idx} style={{
                position: 'relative', cursor: canPick ? 'pointer' : 'default',
                aspectRatio: '5 / 7', minHeight: 0,
              }}
                onClick={() => {
                  if (!canPick) return;
                  socket.emit('cube_draft_pick', { roomId: lobby.id, cardName });
                }}
                onMouseEnter={() => setHoveredCard(cardName)}
                onMouseLeave={() => setHoveredCard(null)}>
                <CardMini card={window.CARDS_BY_NAME?.[cardName]} onClick={() => {}} style={{ width: '100%', height: '100%' }} />
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — tooltip preview */}
        <div style={{ width: 240, padding: 12, borderLeft: '1px solid var(--bg4)', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
          <div className="orbit-font" style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 8, fontWeight: 700, letterSpacing: 1 }}>
            CARD PREVIEW
          </div>
          {hoveredCard && window.CARDS_BY_NAME?.[hoveredCard] ? (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <div style={{ width: '100%', aspectRatio: '5 / 7', marginBottom: 8 }}>
                <CardMini card={window.CARDS_BY_NAME[hoveredCard]} onClick={() => {}} style={{ width: '100%', height: '100%' }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.4 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent)', marginBottom: 4 }}>{hoveredCard}</div>
                <div style={{ color: 'var(--text2)', marginBottom: 6 }}>
                  {window.CARDS_BY_NAME[hoveredCard].cardType}
                  {window.CARDS_BY_NAME[hoveredCard].subtype && ` · ${window.CARDS_BY_NAME[hoveredCard].subtype}`}
                </div>
                <div style={{ whiteSpace: 'pre-wrap', fontSize: 10 }}>
                  {window.CARDS_BY_NAME[hoveredCard].effect || ''}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, color: 'var(--text2)', fontSize: 11, textAlign: 'center', padding: '20px 0', fontStyle: 'italic' }}>
              Hover any card to preview.
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM — drafted pool */}
      <div style={{ borderTop: '1px solid var(--bg4)', background: 'var(--bg2)', padding: '8px 12px', maxHeight: '32%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span className="orbit-font" style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, letterSpacing: 1 }}>
            DRAFTED ({poolOrder.length}/64)
          </span>
          <input className="input" placeholder="🔍 Filter by name..." value={filter} onChange={e => setFilter(e.target.value)}
            style={{ flex: 1, maxWidth: 280, fontSize: 11, padding: '4px 8px' }} />
          <span style={{ fontSize: 10, color: 'var(--text2)' }}>{filter ? `${visiblePool.length} match${visiblePool.length === 1 ? '' : 'es'}` : 'Drag to reorder'}</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: 4 }}>
            {visiblePool.map(({ name, idx }) => (
              <div key={idx + '-' + name}
                draggable
                onDragStart={e => { setDragSrc(idx); e.dataTransfer.effectAllowed = 'move'; }}
                onDragOver={e => { e.preventDefault(); setDragOverIdx(idx); }}
                onDrop={e => { e.preventDefault(); if (dragSrc != null) reorderPool(dragSrc, idx); setDragSrc(null); setDragOverIdx(null); }}
                onDragEnd={() => { setDragSrc(null); setDragOverIdx(null); }}
                onMouseEnter={() => setHoveredCard(name)}
                onMouseLeave={() => setHoveredCard(null)}
                style={{
                  aspectRatio: '5 / 7', cursor: 'grab',
                  border: dragOverIdx === idx ? '2px solid var(--accent)' : '2px solid transparent',
                  borderRadius: 4, transition: 'border-color .1s',
                }}>
                <CardMini card={window.CARDS_BY_NAME?.[name]} onClick={() => {}} style={{ width: '100%', height: '100%' }} />
              </div>
            ))}
            {poolOrder.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 16, color: 'var(--text2)', fontSize: 11, fontStyle: 'italic' }}>
                No cards drafted yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  CUBE DRAFT — DECK BUILDING SCREEN
//  Restricted deck builder for the post-draft phase. Right-side gallery
//  shows ONLY drafted cards (with copy counts) plus all non-Performance
//  Abilities at infinite quantity. Hero rule: deck must contain exactly
//  min(3, heroesInPool) heroes — relaxed for players with sparse hero
//  draws. Click cards to add (auto-routed to hero / main slots), click
//  to remove. Player names the deck and clicks Ready when done.
// ═══════════════════════════════════════════
function CubeDraftBuildScreen({ lobby, build, leaveRoom, notify, user }) {
  const cardDB = window.CARDS_BY_NAME || {};
  const allCards = window.AVAILABLE_CARDS || [];

  // 5-minute auto-ready timer — server starts it on the first Ready,
  // pushes the absolute end timestamp via cube_build_state. Re-render
  // every 250ms while it's active so the countdown ticks visibly.
  const [, setBuildTick] = useState(0);
  useEffect(() => {
    if (!build?.buildTimerEndsAt) return;
    const t = setInterval(() => setBuildTick(x => x + 1), 250);
    return () => clearInterval(t);
  }, [build?.buildTimerEndsAt]);
  const buildTimerMsLeft = build?.buildTimerEndsAt
    ? Math.max(0, build.buildTimerEndsAt - Date.now())
    : null;

  // Pool counts (incl. assigned hero, which the server pushed into pool).
  const poolCounts = useMemo(() => {
    const c = {};
    for (const n of (build?.pool || [])) c[n] = (c[n] || 0) + 1;
    return c;
  }, [build?.pool]);

  const heroesInPool = useMemo(() =>
    (build?.pool || []).filter(n => cardDB[n]?.cardType === 'Hero').length,
    [build?.pool, cardDB]
  );
  const requiredHeroes = Math.min(3, heroesInPool);

  // Deck state — independent of pool changes (server only pushes pool once).
  const [deckName, setDeckName] = useState('');
  const [heroes, setHeroes] = useState([null, null, null]); // each: { hero, ability1, ability2 } | null
  const [mainDeck, setMainDeck] = useState([]);
  const [filter, setFilter] = useState('');
  const [hovered, setHovered] = useState(null);

  // One-time bootstrap: seed deck name and auto-fill hero slots from
  // the drafted heroes (so the player isn't staring at empty slots).
  const bootstrappedRef = useRef(false);
  useEffect(() => {
    if (bootstrappedRef.current || !build?.pool) return;
    bootstrappedRef.current = true;
    setDeckName(`${user?.username || 'Drafter'}'s ${build.cubeName || 'Cube'} Draft`);
    const heroesFromPool = (build.pool || []).filter(n => cardDB[n]?.cardType === 'Hero');
    const slots = [null, null, null];
    for (let i = 0; i < Math.min(3, heroesFromPool.length); i++) {
      const cd = cardDB[heroesFromPool[i]];
      slots[i] = {
        hero: heroesFromPool[i],
        ability1: cd?.startingAbility1 || null,
        ability2: cd?.startingAbility2 || null,
      };
    }
    setHeroes(slots);
  }, [build?.pool]);

  // Used counts across heroes + main deck.
  const usedCounts = useMemo(() => {
    const c = {};
    for (const h of heroes) if (h?.hero) c[h.hero] = (c[h.hero] || 0) + 1;
    for (const n of mainDeck) c[n] = (c[n] || 0) + 1;
    return c;
  }, [heroes, mainDeck]);

  const isFreeAbility = (name) => cardDB[name]?.cardType === 'Ability' && name !== 'Performance';

  const remainingFor = (name) => {
    if (isFreeAbility(name)) return Infinity;
    return (poolCounts[name] || 0) - (usedCounts[name] || 0);
  };

  // Available list = pool unique names + free abilities. Sorted by type
  // then name. Filtered by name search.
  const availableList = useMemo(() => {
    const list = [];
    const seen = new Set();
    for (const name of Object.keys(poolCounts)) {
      if (seen.has(name)) continue;
      seen.add(name);
      list.push({ name, count: poolCounts[name], free: false });
    }
    for (const c of allCards) {
      if (c.cardType !== 'Ability' || c.name === 'Performance') continue;
      if (seen.has(c.name)) continue;
      seen.add(c.name);
      list.push({ name: c.name, count: Infinity, free: true });
    }
    list.sort((a, b) => {
      const ca = cardDB[a.name], cb = cardDB[b.name];
      const orderA = ca?.cardType === 'Hero' ? 0 : ca?.cardType === 'Creature' ? 1 : ca?.cardType === 'Spell' ? 2 : ca?.cardType === 'Attack' ? 3 : ca?.cardType === 'Artifact' ? 4 : ca?.cardType === 'Ability' ? 5 : ca?.cardType === 'Potion' ? 6 : 7;
      const orderB = cb?.cardType === 'Hero' ? 0 : cb?.cardType === 'Creature' ? 1 : cb?.cardType === 'Spell' ? 2 : cb?.cardType === 'Attack' ? 3 : cb?.cardType === 'Artifact' ? 4 : cb?.cardType === 'Ability' ? 5 : cb?.cardType === 'Potion' ? 6 : 7;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [poolCounts, allCards, cardDB]);

  const visibleList = filter
    ? availableList.filter(e => e.name.toLowerCase().includes(filter.toLowerCase()))
    : availableList;

  const addToHero = (name) => {
    if (cardDB[name]?.cardType !== 'Hero') return;
    if (remainingFor(name) <= 0) return;
    setHeroes(prev => {
      const slots = [...prev];
      const empty = slots.findIndex(s => !s?.hero);
      if (empty < 0) return prev;
      const cd = cardDB[name];
      slots[empty] = { hero: name, ability1: cd?.startingAbility1 || null, ability2: cd?.startingAbility2 || null };
      return slots;
    });
  };

  const addToMain = (name) => {
    if (mainDeck.length >= 60) return;
    if (remainingFor(name) <= 0) return;
    setMainDeck(prev => [...prev, name]);
  };

  const removeHero = (slotIdx) => {
    setHeroes(prev => prev.map((s, i) => i === slotIdx ? null : s));
  };

  const removeMain = (idx) => {
    setMainDeck(prev => prev.filter((_, i) => i !== idx));
  };

  const onCardClick = (name) => {
    const ct = cardDB[name]?.cardType;
    if (ct === 'Hero') {
      // Prefer hero slot if any open and not yet at requiredHeroes; else main.
      const filled = heroes.filter(h => h?.hero).length;
      if (filled < requiredHeroes) addToHero(name);
      else addToMain(name);
    } else {
      addToMain(name);
    }
  };

  const filledHeroes = heroes.filter(h => h?.hero).length;
  const heroOk = filledHeroes === requiredHeroes;
  const mainOk = mainDeck.length === 60;
  const deckLegal = heroOk && mainOk && deckName.trim().length > 0;
  const deckProblems = [];
  if (!heroOk) deckProblems.push(`Need ${requiredHeroes} hero${requiredHeroes === 1 ? '' : 'es'} (have ${filledHeroes})`);
  if (!mainOk) deckProblems.push(`Main deck must be 60 cards (have ${mainDeck.length})`);
  if (!deckName.trim()) deckProblems.push('Deck needs a name');

  const submitReady = () => {
    if (!deckLegal) { notify('Deck not ready: ' + deckProblems.join(', '), 'error'); return; }
    socket.emit('cube_draft_ready', {
      roomId: lobby.id,
      deck: {
        name: deckName.trim(),
        heroes,
        mainDeck,
        potionDeck: [],
        sideDeck: [],
      },
    });
  };

  if (!build) {
    return (
      <div className="screen-full">
        <div className="top-bar">
          <button className="btn btn-danger" style={{ padding: '4px 12px', fontSize: 10 }} onClick={leaveRoom}>LEAVE</button>
          <h2 className="orbit-font" style={{ fontSize: 14, color: 'var(--accent)' }}>🧊 BUILD YOUR DECK</h2>
          <VolumeControl />
        </div>
        <div className="screen-center"><div className="orbit-font" style={{ color: 'var(--accent)', animation: 'pulse 1.5s infinite' }}>Loading drafted pool…</div></div>
      </div>
    );
  }
  if (build.isSpectator) {
    return (
      <div className="screen-full">
        <div className="top-bar">
          <button className="btn btn-danger" style={{ padding: '4px 12px', fontSize: 10 }} onClick={leaveRoom}>LEAVE</button>
          <h2 className="orbit-font" style={{ fontSize: 14, color: 'var(--accent)' }}>🧊 DRAFT — DECK BUILDING</h2>
          <VolumeControl />
        </div>
        <div className="screen-center" style={{ flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 48 }}>🃏</div>
          <div style={{ color: 'var(--text2)', textAlign: 'center', maxWidth: 480 }}>
            Drafters are building their decks. Tournament begins once everyone is ready.
          </div>
          <div style={{ fontSize: 12, color: 'var(--accent)' }}>{build.readyCount}/{build.humanCount} ready</div>
        </div>
      </div>
    );
  }

  if (build.ready) {
    return (
      <div className="screen-full">
        <div className="top-bar">
          <button className="btn btn-danger" style={{ padding: '4px 12px', fontSize: 10 }} onClick={leaveRoom}>LEAVE</button>
          <h2 className="orbit-font" style={{ fontSize: 14, color: 'var(--accent)' }}>🧊 BUILD YOUR DECK</h2>
          <VolumeControl />
        </div>
        <div className="screen-center" style={{ flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 48 }}>✓</div>
          <div className="orbit-font" style={{ color: 'var(--success)', fontSize: 16 }}>Deck submitted!</div>
          <div style={{ color: 'var(--text2)' }}>Waiting for other drafters... ({build.readyCount}/{build.humanCount})</div>
          <div style={{ marginTop: 12 }}>
            {build.humanSeats?.filter(s => !s.isBot).map(s => (
              <span key={s.seatIdx} style={{ marginRight: 12, fontSize: 11, color: s.ready ? 'var(--success)' : 'var(--text2)' }}>
                {s.ready ? '✓' : '⋯'} {s.username}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen-full">
      <div className="top-bar">
        <button className="btn btn-danger" style={{ padding: '4px 12px', fontSize: 10 }} onClick={leaveRoom}>LEAVE</button>
        <h2 className="orbit-font" style={{ fontSize: 14, color: 'var(--accent)' }}>🧊 BUILD YOUR DECK</h2>
        <span className="badge" style={{ background: 'rgba(154,216,255,.14)', color: '#9ad8ff' }}>{build.cubeName}</span>
        <input className="input" placeholder="Deck name…" value={deckName} onChange={e => setDeckName(e.target.value)}
          style={{ width: 240, fontSize: 12, padding: '4px 8px' }} />
        <div style={{ flex: 1 }} />
        {!deckLegal && (
          <div style={{ fontSize: 10, color: 'var(--danger)', maxWidth: 360, textAlign: 'right' }}>
            {deckProblems.join(' · ')}
          </div>
        )}
        <button className="btn btn-success" disabled={!deckLegal} onClick={submitReady}
          style={{ padding: '6px 18px', fontWeight: 700 }}>
          ✓ READY
        </button>
        <VolumeControl />
      </div>

      {build.assignedHero && (
        <div style={{ background: 'rgba(255,170,0,.12)', borderBottom: '1px solid #ffaa33', padding: '6px 16px', fontSize: 11, textAlign: 'center', color: '#ffcc44' }}>
          🎲 You drafted no Heroes. The system assigned <strong>{build.assignedHero}</strong> to you.
        </div>
      )}
      {buildTimerMsLeft != null && (() => {
        const m = Math.floor(buildTimerMsLeft / 60000);
        const s = Math.floor((buildTimerMsLeft % 60000) / 1000);
        const warn = buildTimerMsLeft <= 60_000;
        return (
          <div style={{
            background: warn ? 'rgba(255,80,80,.16)' : 'rgba(0,240,255,.10)',
            borderBottom: '1px solid ' + (warn ? '#ff6666' : 'var(--accent)'),
            padding: '6px 16px', fontSize: 12, textAlign: 'center',
            color: warn ? '#ff8888' : 'var(--accent)',
            fontWeight: 700, letterSpacing: 1,
            animation: warn ? 'pulse 1s infinite' : undefined,
          }}>
            ⏱ {m}:{String(s).padStart(2, '0')} — non-ready decks will be auto-completed when this timer expires.
          </div>
        );
      })()}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* LEFT — Deck under construction */}
        <div style={{ flex: 1, padding: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="orbit-font" style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6, fontWeight: 700, letterSpacing: 1 }}>
            HEROES ({filledHeroes}/{requiredHeroes})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
            {heroes.map((h, i) => (
              <div key={i} style={{
                aspectRatio: '5 / 7',
                border: h?.hero ? '2px solid var(--accent)' : '2px dashed var(--bg4)',
                borderRadius: 4, position: 'relative',
                cursor: h?.hero ? 'pointer' : 'default',
                opacity: i >= requiredHeroes ? .35 : 1,
              }}
                onClick={() => h?.hero && removeHero(i)}
                onMouseEnter={() => h?.hero && setHovered(h.hero)}
                onMouseLeave={() => setHovered(null)}>
                {h?.hero ? (
                  <CardMini card={cardDB[h.hero]} onClick={() => {}} style={{ width: '100%', height: '100%' }} />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: 'var(--text2)', fontSize: 11 }}>
                    Hero {i + 1}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="orbit-font" style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6, fontWeight: 700, letterSpacing: 1 }}>
            MAIN DECK ({mainDeck.length}/60)
          </div>
          <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--bg4)', borderRadius: 4, padding: 4 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: 4 }}>
              {mainDeck.map((name, i) => (
                <div key={i + '-' + name}
                  style={{ aspectRatio: '5 / 7', cursor: 'pointer' }}
                  onClick={() => removeMain(i)}
                  onMouseEnter={() => setHovered(name)}
                  onMouseLeave={() => setHovered(null)}
                  title="Click to remove">
                  <CardMini card={cardDB[name]} onClick={() => {}} style={{ width: '100%', height: '100%' }} />
                </div>
              ))}
              {/* Pad to 60 with empty slots */}
              {Array.from({ length: Math.max(0, 60 - mainDeck.length) }).map((_, i) => (
                <div key={'empty-' + i} style={{
                  aspectRatio: '5 / 7',
                  border: '2px dashed var(--bg4)', borderRadius: 4,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, color: 'var(--text2)', opacity: .4,
                }}>{mainDeck.length + i + 1}</div>
              ))}
            </div>
          </div>
        </div>

        {/* MIDDLE — Tooltip preview */}
        <div style={{ width: 220, padding: 12, borderLeft: '1px solid var(--bg4)', borderRight: '1px solid var(--bg4)', background: 'var(--bg)' }}>
          <div className="orbit-font" style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 8, fontWeight: 700, letterSpacing: 1 }}>
            CARD PREVIEW
          </div>
          {hovered && cardDB[hovered] ? (
            <>
              <div style={{ width: '100%', aspectRatio: '5 / 7', marginBottom: 8 }}>
                <CardMini card={cardDB[hovered]} onClick={() => {}} style={{ width: '100%', height: '100%' }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text)' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent)', marginBottom: 4 }}>{hovered}</div>
                <div style={{ color: 'var(--text2)', marginBottom: 6 }}>
                  {cardDB[hovered].cardType}{cardDB[hovered].subtype && ` · ${cardDB[hovered].subtype}`}
                </div>
                <div style={{ whiteSpace: 'pre-wrap', fontSize: 10, lineHeight: 1.4 }}>
                  {cardDB[hovered].effect || ''}
                </div>
              </div>
            </>
          ) : (
            <div style={{ color: 'var(--text2)', fontSize: 11, textAlign: 'center', padding: '20px 0', fontStyle: 'italic' }}>
              Hover any card to preview.
            </div>
          )}
        </div>

        {/* RIGHT — Available cards (drafted pool + free abilities) */}
        <div style={{ width: 360, padding: 12, background: 'var(--bg2)', display: 'flex', flexDirection: 'column' }}>
          <div className="orbit-font" style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6, fontWeight: 700, letterSpacing: 1 }}>
            AVAILABLE CARDS
          </div>
          <input className="input" placeholder="🔍 Filter by name..." value={filter} onChange={e => setFilter(e.target.value)}
            style={{ marginBottom: 8, fontSize: 11, padding: '4px 8px' }} />
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
              {visibleList.map(({ name, count, free }) => {
                const remaining = remainingFor(name);
                const dimmed = remaining <= 0;
                return (
                  <div key={name}
                    onClick={() => !dimmed && onCardClick(name)}
                    onMouseEnter={() => setHovered(name)}
                    onMouseLeave={() => setHovered(null)}
                    style={{
                      aspectRatio: '5 / 7',
                      cursor: dimmed ? 'not-allowed' : 'pointer',
                      filter: dimmed ? 'grayscale(.8) brightness(.6)' : 'none',
                      position: 'relative',
                    }}>
                    <CardMini card={cardDB[name]} onClick={() => {}} style={{ width: '100%', height: '100%' }} />
                    <div style={{
                      position: 'absolute', bottom: 2, right: 2,
                      background: free ? 'rgba(154,216,255,.85)' : 'rgba(0,0,0,.85)',
                      color: free ? '#001a33' : '#fff',
                      borderRadius: 4, padding: '1px 5px',
                      fontSize: 10, fontWeight: 700, lineHeight: 1.2,
                      pointerEvents: 'none',
                    }}>
                      {free ? '∞' : `${remaining}/${count}`}
                    </div>
                  </div>
                );
              })}
              {visibleList.length === 0 && (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 16, color: 'var(--text2)', fontSize: 11, fontStyle: 'italic' }}>
                  No cards match.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  CUBE DRAFT — TOURNAMENT SCREEN
//  Bracket + cross-game spectator tabs + winner celebration. The
//  embedded GameBoard takes over rendering when `gameState` is non-null
//  (the player is in their match OR spectating one). Without an active
//  game, this screen shows the bracket and a row of spectator buttons.
// ═══════════════════════════════════════════
function CubeDraftTournamentScreen({ lobby, tournament, gameState, leaveRoom, notify, user }) {
  if (!tournament) {
    return (
      <div className="screen-full">
        <div className="top-bar">
          <button className="btn btn-danger" style={{ padding: '4px 12px', fontSize: 10 }} onClick={leaveRoom}>LEAVE</button>
          <h2 className="orbit-font" style={{ fontSize: 14, color: 'var(--accent)' }}>🧊 CUBE TOURNAMENT</h2>
          <VolumeControl />
        </div>
        <div className="screen-center"><div className="orbit-font" style={{ color: 'var(--accent)', animation: 'pulse 1.5s infinite' }}>Building bracket…</div></div>
      </div>
    );
  }

  // Tournament complete → final standings panel.
  if (tournament.complete && tournament.finalStandings) {
    return <CubeDraftFinalStandings lobby={lobby} tournament={tournament} leaveRoom={leaveRoom} />;
  }

  const mySeat = tournament.mySeat;
  const isPlayer = mySeat >= 0;
  const myActiveChildRoomId = tournament.myActiveChildRoomId;

  return (
    <div className="screen-full">
      <div className="top-bar">
        <button className="btn btn-danger" style={{ padding: '4px 12px', fontSize: 10 }} onClick={leaveRoom}>LEAVE</button>
        <h2 className="orbit-font" style={{ fontSize: 14, color: 'var(--accent)' }}>🧊 CUBE TOURNAMENT</h2>
        <span className="badge" style={{ background: 'rgba(154,216,255,.14)', color: '#9ad8ff' }}>{tournament.cubeName}</span>
        <span className="badge" style={{ background: 'rgba(255,255,255,.06)', color: 'var(--text)' }}>
          Round {tournament.currentRoundIdx + 1}/{Math.log2(tournament.bracketSize)}
        </span>
        <span className="badge" style={{ background: 'rgba(255,255,255,.06)', color: 'var(--text)' }}>
          Bo{tournament.currentRoundIdx === Math.log2(tournament.bracketSize) - 1 ? tournament.finaleBo : tournament.prelimsBo}
        </span>
        <div style={{ flex: 1 }} />
        <span className="badge" style={{ background: tournament.flow === 'simultaneous' ? 'rgba(0,240,255,.10)' : 'rgba(255,170,0,.10)', color: tournament.flow === 'simultaneous' ? 'var(--accent)' : '#ffaa33' }}>
          {tournament.flow === 'simultaneous' ? 'SIMULTANEOUS' : 'CONSECUTIVE'}
        </span>
        <VolumeControl />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 16 }}>
        {/* BRACKET DIAGRAM */}
        <CubeDraftBracket tournament={tournament} mySeat={mySeat} />

        {/* PLAYER STATUS / SPECTATE TABS */}
        <div style={{ marginTop: 16, padding: 12, background: 'var(--bg2)', borderRadius: 8 }}>
          {myActiveChildRoomId ? (
            <div style={{ textAlign: 'center', color: 'var(--accent)' }}>
              ⚔️ Your match is active — waiting to load…
            </div>
          ) : isPlayer ? (
            <div style={{ textAlign: 'center', color: 'var(--text2)' }}>
              {tournament.standings[mySeat] ? (
                <>You finished at placement <strong style={{ color: 'var(--accent)' }}>#{tournament.standings[mySeat]}</strong>. Watch the rest of the bracket below.</>
              ) : (
                'Waiting for next round to be set up…'
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text2)' }}>Spectating cube tournament.</div>
          )}

          {/* Active match spectator tabs */}
          {(tournament.activeChildRooms || []).length > 0 && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12, flexWrap: 'wrap' }}>
              {tournament.activeChildRooms.map(m => (
                <button key={m.childRoomId} className="btn"
                  style={{ fontSize: 11, padding: '4px 12px',
                    background: myActiveChildRoomId === m.childRoomId ? 'var(--accent)' : 'var(--bg3)',
                    color: myActiveChildRoomId === m.childRoomId ? '#000' : 'var(--text)',
                  }}
                  disabled={myActiveChildRoomId === m.childRoomId}
                  onClick={() => socket.emit('cube_spectate_match', { parentRoomId: lobby.id, childRoomId: m.childRoomId })}>
                  👁 {m.p1Username || '?'} vs {m.p2Username || '?'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CubeDraftBracket({ tournament, mySeat }) {
  // Render the bracket as a column of rounds. Each round is a vertical
  // stack of matches. Lines/connectors between rounds are simplified —
  // we just stack the matches with arrows in the column gutters.
  const totalRounds = Math.log2(tournament.bracketSize);
  return (
    <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden' }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', minWidth: 'fit-content', height: '100%' }}>
        {Array.from({ length: totalRounds }).map((_, ri) => {
          const round = tournament.rounds[ri] || [];
          const label = ri === totalRounds - 1 ? 'FINALE' : (ri === totalRounds - 2 ? 'SEMIS' : `ROUND ${ri + 1}`);
          return (
            <div key={ri} style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column' }}>
              <div className="orbit-font" style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, letterSpacing: 1, textAlign: 'center', marginBottom: 8 }}>
                {label}
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-around', gap: 8 }}>
                {round.map(m => (
                  <CubeDraftMatchCard key={m.matchIdx} match={m} mySeat={mySeat} currentRound={tournament.currentRoundIdx === ri} />
                ))}
                {round.length === 0 && (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)', fontSize: 11 }}>
                    Pending…
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CubeDraftMatchCard({ match, mySeat, currentRound }) {
  const isMine = match.p1Seat === mySeat || match.p2Seat === mySeat;
  const live = match.live;
  const winnerSlot = match.winnerSeat == null ? null : (match.winnerSeat === match.p1Seat ? 'p1' : 'p2');
  const slot = (label, seat, name, isWinner) => (
    <div style={{
      padding: '6px 10px',
      background: isWinner ? 'rgba(51,255,136,.10)' : (seat === mySeat ? 'rgba(0,240,255,.08)' : 'transparent'),
      borderLeft: '3px solid ' + (isWinner ? 'var(--success)' : (seat === mySeat ? 'var(--accent)' : 'var(--bg4)')),
      fontSize: 12,
      color: isWinner ? 'var(--success)' : (seat === mySeat ? 'var(--accent)' : 'var(--text)'),
      fontWeight: isWinner || seat === mySeat ? 700 : 500,
    }}>
      {name || (seat == null ? '— bye —' : 'TBD')}
    </div>
  );
  return (
    <div style={{
      border: '1px solid ' + (isMine ? 'var(--accent)' : (live ? 'var(--accent3)' : 'var(--bg4)')),
      borderRadius: 6,
      background: 'var(--bg2)',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {live && (
        <div style={{ position: 'absolute', top: 4, right: 6, fontSize: 9, color: 'var(--accent3)', fontWeight: 700, animation: 'pulse 1.2s infinite' }}>
          LIVE
        </div>
      )}
      {slot('p1', match.p1Seat, match.p1Username, winnerSlot === 'p1')}
      <div style={{ height: 1, background: 'var(--bg4)' }} />
      {slot('p2', match.p2Seat, match.p2Username, winnerSlot === 'p2')}
      <div style={{ fontSize: 9, color: 'var(--text2)', textAlign: 'center', padding: '2px 0', background: 'var(--bg)' }}>
        Bo{match.bo || '?'}
      </div>
    </div>
  );
}

function CubeDraftFinalStandings({ lobby, tournament, leaveRoom }) {
  const standings = tournament.finalStandings || [];
  const winner = standings.find(s => s.placement === 1);
  return (
    <div className="screen-full" style={{ background: 'radial-gradient(ellipse at center, rgba(255,215,0,.12) 0%, var(--bg) 70%)' }}>
      <div className="top-bar">
        <button className="btn" style={{ padding: '4px 12px', fontSize: 10 }} onClick={leaveRoom}>← LEAVE</button>
        <h2 className="orbit-font" style={{ fontSize: 14, color: '#ffd700' }}>🏆 TOURNAMENT COMPLETE</h2>
        <VolumeControl />
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', overflow: 'auto', padding: 32 }}>
        {winner && (
          <div style={{ textAlign: 'center', marginBottom: 32, animation: 'pulse 2s infinite' }}>
            <div style={{ fontSize: 80, marginBottom: 8 }}>🏆</div>
            <div className="orbit-font" style={{ fontSize: 28, color: '#ffd700', fontWeight: 800, marginBottom: 6 }}>
              {winner.username}
            </div>
            <div className="orbit-font" style={{ fontSize: 14, color: 'var(--text)' }}>
              CHAMPION OF {tournament.cubeName}
            </div>
          </div>
        )}
        <div className="panel" style={{ width: '100%', maxWidth: 720, padding: 20 }}>
          <div className="orbit-font" style={{ fontSize: 14, color: 'var(--accent)', marginBottom: 16, textAlign: 'center', fontWeight: 700, letterSpacing: 1 }}>
            FINAL STANDINGS
          </div>
          {standings.map((s, i) => (
            <div key={s.seat} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px',
              background: i === 0 ? 'rgba(255,215,0,.08)' : (i === 1 ? 'rgba(170,170,170,.08)' : (i === 2 ? 'rgba(205,127,50,.08)' : 'transparent')),
              borderLeft: '4px solid ' + (i === 0 ? '#ffd700' : i === 1 ? '#aaaaaa' : i === 2 ? '#cd7f32' : 'var(--bg4)'),
              marginBottom: 4, borderRadius: 4,
            }}>
              <div style={{ fontSize: 24, width: 40, textAlign: 'center', fontWeight: 800, color: i === 0 ? '#ffd700' : i === 1 ? '#cccccc' : i === 2 ? '#cd7f32' : 'var(--text2)' }}>
                #{s.placement}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{s.username}</div>
                {s.heroes.length > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>
                    Heroes: {s.heroes.join(' · ')}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PlayScreen() {
  const { user, setUser, setScreen, notify, setBgmMode } = useContext(AppContext);
  const [decks, setDecks] = useState([]);
  const [sampleDecks, setSampleDecks] = useState([]);
  const [selectedDeck, setSelectedDeck] = useState('');
  const [rooms, setRooms] = useState([]);
  const [creating, setCreating] = useState(false);
  const [gameType, setGameType] = useState('unranked');
  const [gameFormat, setGameFormat] = useState(1);
  // Cube Draft mode — entire form swaps when this is 'draft'. Cube
  // selection, per-pack and per-card timers, separate Prelims / Finale
  // Bo lengths, and a simultaneous-vs-consecutive game-flow toggle live
  // alongside the standard Ranked/Unranked split.
  const [gameMode, setGameMode] = useState('constructed'); // 'constructed' | 'draft'
  const [draftCubeId, setDraftCubeId] = useState('');
  const [draftPackTimerSec, setDraftPackTimerSec] = useState(60);
  const [draftPickTimerSec, setDraftPickTimerSec] = useState(5);
  const [draftTimerDisabled, setDraftTimerDisabled] = useState(false);
  const [draftPrelimsBo, setDraftPrelimsBo] = useState(1);
  const [draftFinaleBo, setDraftFinaleBo] = useState(3);
  const [draftFlow, setDraftFlow] = useState('simultaneous'); // 'simultaneous' | 'consecutive'
  const [playerPw, setPlayerPw] = useState('');
  const [specPw, setSpecPw] = useState('');
  const [joinPw, setJoinPw] = useState('');
  const [joinTarget, setJoinTarget] = useState(null);
  const [lobby, setLobby] = useState(null);
  const [playerJoined, setPlayerJoined] = useState(null);
  // Cube Draft live state — populated by `cube_draft_state` socket
  // events (one per pick window). Cleared when the user leaves the
  // room or the draft completes (phase → 'building'). Exists alongside
  // `lobby` since the room shell stays the same; only the inner phase
  // changes.
  const [cubeDraftState, setCubeDraftState] = useState(null);
  // Build-phase per-player state (drafted pool, assigned hero, ready
  // count). Server emits `cube_build_state` on phase transition and on
  // every Ready submission.
  const [cubeBuildState, setCubeBuildState] = useState(null);
  // Tournament-phase state (bracket, current round, active matches).
  const [cubeTournamentStateLocal, setCubeTournamentStateLocal] = useState(null);
  // Active cube tournament match — `{ parentRoomId, childRoomId, opponent, bo }`.
  // Set when the server's `cube_match_assigned` event fires; cleared
  // when the match ends. Drives the "Surrender Match" button in the
  // GameBoard.
  const [cubeMatchInfo, setCubeMatchInfo] = useState(null);
  // Top-10 ranked players, fetched once on mount and refreshed every 60s.
  // The endpoint filters out players with 0 ranked games so the list
  // reflects actual competition rather than 1000-ELO defaults.
  const [leaderboard, setLeaderboard] = useState([]);
  const [gameState, setGameState] = useState(() => {
    // Check for buffered reconnection state
    const pending = _pendingGameState;
    _pendingGameState = null;
    return pending;
  });

  // Sync battle music state. Puzzle / tutorial games use bgm_puzzle.
  useEffect(() => {
    if (!gameState) setBgmMode('menu');
    else if (gameState.isPuzzle || gameState.isTutorial) setBgmMode('puzzle');
    // Gegnerspezifisches Thema, wenn der Server eines gemeldet hat
    // (nur CPU-Kämpfe; PvP behält das generische Kampfthema).
    else {
      // Diagnose: einmal je Kampf melden, was im Zustand ankommt. Fehlt
      // `cpuBgm` ganz, liegt es an der Server-Seite (oder an einem alten
      // Serverprozess); ist es gesetzt und die Musik stimmt trotzdem
      // nicht, liegt es am Musik-Manager darunter.
      const mode = gameState.cpuBgm ? 'battle:' + gameState.cpuBgm : 'battle';
      if (window.__ppBgmLast !== mode) {
        window.__ppBgmLast = mode;
        console.log('[bgm] Zustand: isCpuBattle =', gameState.isCpuBattle,
          '| cpuBgm =', JSON.stringify(gameState.cpuBgm), '→ Modus', mode);
      }
      setBgmMode(mode);
    }
    return () => setBgmMode('menu');
  }, [gameState, setBgmMode]);

  // Load decks + sample decks. Bootstrap `selectedDeck` from the user's
  // saved default — prefer a custom deck flagged is_default, fall back to
  // the pinned sample/structure deck (user.defaultSampleDeckId), then to
  // the first legal option of either list.
  useEffect(() => {
    (async () => {
      let personal = [];
      let samples = [];
      try {
        const data = await api('/decks');
        personal = data?.decks || [];
        setDecks(personal);
      } catch {}
      try {
        const sd = await api('/sample-decks/owned');
        samples = sd?.decks || [];
        setSampleDecks(samples);
      } catch {}
      const customDefault = personal.find(d => d.isDefault);
      const pinnedSampleId = user?.defaultSampleDeckId || null;
      const pinnedSample = pinnedSampleId ? samples.find(s => s.id === pinnedSampleId) : null;
      if (customDefault) setSelectedDeck(customDefault.id);
      else if (pinnedSample) setSelectedDeck(pinnedSample.id);
      else if (personal.length) setSelectedDeck(personal[0].id);
      else {
        const firstLegalSample = samples.find(s => isDeckLegal(s).legal);
        if (firstLegalSample) setSelectedDeck(firstLegalSample.id);
      }
    })();
  }, []);

  // Leaderboard refresh — initial fetch on mount, then every 60s. Pulled
  // separately from the room poll so a slow leaderboard query (DB scan)
  // doesn't gate the room list refresh cadence.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await api('/leaderboard');
        if (!cancelled) setLeaderboard(data?.players || []);
      } catch {
        if (!cancelled) setLeaderboard([]);
      }
    };
    load();
    const intv = setInterval(load, 60000);
    // Server broadcasts `leaderboard_updated` whenever a ranked set
    // finishes and ELOs change. React immediately so the lobby's
    // standings reflect the new ELOs without waiting up to 60s for
    // the poll. Fires for every client (in-lobby, in-room, spectating)
    // — anyone with the leaderboard panel rendered gets a fresh view.
    const onLeaderboardUpdated = () => load();
    socket.on('leaderboard_updated', onLeaderboardUpdated);
    return () => {
      cancelled = true;
      clearInterval(intv);
      socket.off('leaderboard_updated', onLeaderboardUpdated);
    };
  }, []);

  // Socket events
  useEffect(() => {
    socket.emit('get_rooms');

    const onRooms = (r) => setRooms(r);
    const onRoomJoined = (r) => setLobby(r);
    const onRoomUpdate = (r) => setLobby(prev => prev ? r : null);
    const onRoomClosed = () => { setLobby(null); setGameState(null); setCubeDraftState(null); notify('Room was closed by host', 'error'); };
    const onJoinError = (msg) => notify(msg, 'error');
    const onPlayerJoined = (data) => setPlayerJoined(data.username);
    const onGameStarted = (r) => { setLobby(r); if (window.playSFX) window.playSFX('match_found'); };
    const onGameState = (state) => { setGameState(state); };
    const onCubeDraftState = (state) => { setCubeDraftState(state); };
    const onCubeBuildState = (state) => { setCubeBuildState(state); };
    const onCubeTournamentState = (state) => { setCubeTournamentStateLocal(state); };
    const onCubeMatchAssigned = (data) => {
      // Match started for this player. Server has already joined them
      // to the child room socket-wise; the next `game_state` event will
      // populate the GameBoard. We don't change `lobby` (it stays as
      // the parent), so on match-end the bracket UI is one step away.
      setCubeMatchInfo(data);
      if (window.playSFX) window.playSFX('match_found');
    };
    const onCubeMatchEnded = () => {
      // Child room torn down. Clear the game-state so the tournament
      // bracket re-renders. The next cube_tournament_state broadcast
      // (already inflight from cubeMatchEnd) will refresh placements.
      setGameState(null);
      setCubeMatchInfo(null);
    };
    const onCubeSpectateLeft = () => {
      // Spectator stopped watching a child match. Clear gameState so
      // we fall back to the bracket view.
      setGameState(null);
    };

    socket.on('rooms', onRooms);
    socket.on('room_joined', onRoomJoined);
    socket.on('room_update', onRoomUpdate);
    socket.on('room_closed', onRoomClosed);
    socket.on('join_error', onJoinError);
    socket.on('player_joined', onPlayerJoined);
    socket.on('game_started', onGameStarted);
    socket.on('game_state', onGameState);
    socket.on('cube_draft_state', onCubeDraftState);
    socket.on('cube_build_state', onCubeBuildState);
    socket.on('cube_tournament_state', onCubeTournamentState);
    socket.on('cube_match_assigned', onCubeMatchAssigned);
    socket.on('cube_match_ended', onCubeMatchEnded);
    socket.on('cube_spectate_left', onCubeSpectateLeft);

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
      socket.off('cube_draft_state', onCubeDraftState);
      socket.off('cube_build_state', onCubeBuildState);
      socket.off('cube_tournament_state', onCubeTournamentState);
      socket.off('cube_match_assigned', onCubeMatchAssigned);
      socket.off('cube_match_ended', onCubeMatchEnded);
      socket.off('cube_spectate_left', onCubeSpectateLeft);
      clearInterval(poll);
    };
  }, []);

  const currentDeckObj = decks.find(d => d.id === selectedDeck) || sampleDecks.find(d => d.id === selectedDeck);

  // Legal Cubes the host owns (mode === 'cube' and exactly CUBE_SIZE cards).
  // Used by the Cube Draft creator UI; see also the join flow which only
  // requires the HOST to have a legal cube — joiners draft from the host's.
  const legalCubes = decks.filter(d => isCubeDeck(d) && isDeckLegal(d).legal);

  // Bootstrap the cube dropdown when the modal opens — pick the first
  // legal cube so an empty selection isn't silently submitted. Cleared
  // when the dialog closes.
  useEffect(() => {
    if (creating && gameMode === 'draft' && !draftCubeId && legalCubes.length > 0) {
      setDraftCubeId(legalCubes[0].id);
    }
  }, [creating, gameMode, legalCubes, draftCubeId]);

  const createGame = () => {
    if (gameMode === 'draft') {
      if (legalCubes.length === 0) { notify('You need a legal Cube (512 cards) to host a Cube Draft.', 'error'); return; }
      if (!draftCubeId) { notify('Pick a Cube to draft from.', 'error'); return; }
      const cube = legalCubes.find(c => c.id === draftCubeId);
      if (!cube) { notify('Selected Cube is not available.', 'error'); return; }
      const packT = Math.max(15, Math.min(600, parseInt(draftPackTimerSec, 10) || 60));
      const pickT = Math.max(0, Math.min(60, parseInt(draftPickTimerSec, 10) || 5));
      socket.emit('create_room', {
        type: gameType, format: 1, // format unused for draft itself; per-match Bo lives in cubeDraft.*
        playerPw: playerPw || null, specPw: specPw || null,
        cubeDraft: {
          cubeId: draftCubeId,
          packTimerSec: packT,
          pickTimerSec: pickT,
          timerDisabled: !!draftTimerDisabled,
          prelimsBo: draftPrelimsBo,
          finaleBo: draftFinaleBo,
          flow: draftFlow,
        },
      });
      setCreating(false);
      setPlayerPw(''); setSpecPw('');
      return;
    }
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
    setCubeDraftState(null);
    setCubeBuildState(null);
    setCubeTournamentStateLocal(null);
    setCubeMatchInfo(null);
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
    return <GameBoard gameState={gameState} lobby={lobby} onLeave={leaveRoom} decks={decks} sampleDecks={sampleDecks} selectedDeck={selectedDeck} setSelectedDeck={setSelectedDeck} cubeMatchInfo={cubeMatchInfo} />;
  }

  // === CUBE DRAFT — DRAFTING PHASE ===
  if (lobby && lobby.cubeDraft && lobby.cubeDraft.phase === 'drafting') {
    return <CubeDraftScreen lobby={lobby} draft={cubeDraftState} leaveRoom={leaveRoom} notify={notify} />;
  }

  // === CUBE DRAFT — DECK BUILDING PHASE ===
  if (lobby && lobby.cubeDraft && lobby.cubeDraft.phase === 'building') {
    return <CubeDraftBuildScreen lobby={lobby} build={cubeBuildState} leaveRoom={leaveRoom} notify={notify} user={user} />;
  }

  // === CUBE DRAFT — TOURNAMENT PHASE ===
  if (lobby && lobby.cubeDraft && lobby.cubeDraft.phase === 'tournament') {
    return <CubeDraftTournamentScreen lobby={lobby} tournament={cubeTournamentStateLocal} gameState={gameState} leaveRoom={leaveRoom} notify={notify} user={user} />;
  }

  // === CUBE DRAFT LOBBY VIEW ===
  // 8-seat layout, distinct from the 2-player lobby below. Shown for any
  // room whose `cubeDraft` config is non-null AND whose phase is 'lobby'.
  // Once the host starts the draft (phase → 'drafting') the room renders
  // the drafting UI instead — see the cube-draft phase branches below.
  if (lobby && lobby.cubeDraft && lobby.cubeDraft.phase === 'lobby') {
    const isHost = lobby.host === user.username;
    const seats = lobby.seats || [];
    const filledSeats = seats.filter(s => s).length;
    const canStart = filledSeats >= 2;
    return (
      <div className="screen-full">
        <div className="top-bar">
          <button className="btn btn-danger" style={{ padding: '4px 12px', fontSize: 10 }} onClick={leaveRoom}>
            {isHost ? 'CLOSE ROOM' : 'LEAVE'}
          </button>
          <h2 className="orbit-font" style={{ fontSize: 14, color: 'var(--accent)' }}>🧊 CUBE DRAFT LOBBY</h2>
          <span className="badge" style={{ background: 'rgba(154,216,255,.14)', color: '#9ad8ff' }}>
            {lobby.cubeDraft.cubeName}
          </span>
          <span className="badge" style={{ background: lobby.type === 'ranked' ? 'rgba(255,170,0,.12)' : 'rgba(0,240,255,.12)', color: lobby.type === 'ranked' ? 'var(--accent4)' : 'var(--accent)' }}>
            {lobby.type.toUpperCase()}
          </span>
          <VolumeControl />
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto' }} className="animate-in">
          <div className="panel" style={{ width: 720, maxWidth: '92%' }}>
            <div className="orbit-font" style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, textAlign: 'center' }}>
              {canStart ? (isHost ? '⚔️ Ready to draft — start when you like.' : '⏳ Waiting for host to start...') : '⏳ Waiting for at least one challenger...'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
              {Array.from({ length: 8 }).map((_, i) => {
                const seat = seats[i] || null;
                const occupied = !!seat;
                return (
                  <div key={i} style={{
                    border: '2px solid ' + (occupied ? (seat.isHost ? 'var(--accent)' : 'var(--accent2)') : 'var(--bg4)'),
                    borderStyle: occupied ? 'solid' : 'dashed',
                    borderRadius: 8,
                    padding: '12px 8px',
                    background: occupied ? 'rgba(0,240,255,.04)' : 'transparent',
                    textAlign: 'center',
                    opacity: occupied ? 1 : .5,
                  }}>
                    <div style={{ fontSize: 22, marginBottom: 6 }}>
                      {occupied ? (seat.isHost ? '👑' : (seat.isBot ? '🤖' : '⚔️')) : `${i + 1}`}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 12, color: occupied ? (seat.isHost ? 'var(--accent)' : 'var(--accent2)') : 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {occupied ? seat.username : 'Open Seat'}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text2)', marginTop: 2 }}>
                      {occupied ? (seat.isHost ? 'HOST' : seat.isBot ? 'BOT' : 'PLAYER') : ' '}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ background: 'var(--bg2)', borderRadius: 4, padding: '8px 12px', marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11, color: 'var(--text2)' }}>
              {lobby.cubeDraft.timerDisabled ? (
                <div style={{ gridColumn: '1/3' }}>⏱ Draft timer: <strong style={{ color: 'var(--accent)' }}>Disabled</strong> — drafters take as long as they want.</div>
              ) : (
                <>
                  <div>⏱ Time per Pack: <strong style={{ color: 'var(--text)' }}>{lobby.cubeDraft.packTimerSec}s</strong></div>
                  <div>➕ Bonus per Pick: <strong style={{ color: 'var(--text)' }}>{lobby.cubeDraft.pickTimerSec}s</strong></div>
                </>
              )}
              <div>🎮 Prelims: <strong style={{ color: 'var(--text)' }}>Bo{lobby.cubeDraft.prelimsBo}</strong></div>
              <div>🏆 Finale: <strong style={{ color: 'var(--text)' }}>Bo{lobby.cubeDraft.finaleBo}</strong></div>
              <div style={{ gridColumn: '1/3' }}>🔁 Match flow: <strong style={{ color: 'var(--text)' }}>{lobby.cubeDraft.flow === 'consecutive' ? 'Consecutive (one game at a time)' : 'Simultaneous (parallel games)'}</strong></div>
            </div>

            {(lobby.spectators || []).length > 0 && (
              <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 12, textAlign: 'center' }}>
                👁 Spectators: {lobby.spectators.join(', ')}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              {isHost && (
                <button className={'btn btn-success btn-big' + (canStart ? ' glow-border' : '')}
                  disabled={!canStart}
                  title={canStart ? '' : 'Need at least one challenger to start.'}
                  onClick={() => socket.emit('start_cube_draft', { roomId: lobby.id })}>
                  🎮 START DRAFT ({filledSeats}/8 — {Math.max(0, 8 - filledSeats)} bots will fill)
                </button>
              )}
              {!isHost && lobby.players.includes(user.username) && (
                <button className="btn" style={{ fontSize: 10 }}
                  onClick={() => socket.emit('swap_to_spectator', { roomId: lobby.id })}>
                  SWITCH TO SPECTATOR
                </button>
              )}
              {!isHost && !lobby.players.includes(user.username) && (lobby.spectators || []).includes(user.username) && filledSeats < 8 && (
                <button className="btn btn-accent2" style={{ fontSize: 10 }}
                  onClick={() => socket.emit('swap_to_player', { roomId: lobby.id, deckId: null })}>
                  ⚔ JOIN SEAT
                </button>
              )}
            </div>
          </div>
        </div>
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
          <h2 className="orbit-font" style={{ fontSize: 22, fontWeight: 800, color: 'var(--player-color)' }}>GAME LOBBY</h2>
          <span className="badge" style={{ background: lobby.type === 'ranked' ? 'rgba(255,170,0,.12)' : 'rgba(0,240,255,.12)', color: lobby.type === 'ranked' ? 'var(--accent4)' : 'var(--accent)' }}>
            {lobby.type.toUpperCase()}
          </span>
          <VolumeControl />
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
  // Open = still seating players. Cube Draft rooms use maxPlayers=8;
  // standard 1v1 rooms use 2. Lobby phase for a Cube Draft is ALWAYS
  // "still seating" until the host hits Start, so the maxPlayers gate
  // is the right cut-off — it stays in the open list until that moment.
  const openRooms = rooms.filter(r => r.status === 'waiting' && r.playerCount < (r.maxPlayers || 2));
  const activeRooms = rooms.filter(r => r.status === 'playing' || r.playerCount >= (r.maxPlayers || 2));

  return (
    <div className="screen-full">
      <div className="top-bar">
        <button className="btn" style={{ padding: '4px 12px', fontSize: 10 }} onClick={() => setScreen('menu')}>← BACK</button>
        <h2 className="orbit-font" style={{ fontSize: 22, fontWeight: 800, color: 'var(--player-color)' }}>ONLINE LOBBY</h2>
        <div style={{ flex: 1 }} />
        <label style={{ fontSize: 12, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
          🃏 Deck:
          <select className="select" value={selectedDeck} onChange={async e => {
              const id = e.target.value;
              setSelectedDeck(id);
              // Auto-save as default deck. Custom decks use the per-deck
              // endpoint; starter / structure decks use the sample-default
              // pin endpoint. Local state mirrors what the server does
              // (sample pin clears any custom default; custom default
              // clears the sample pin).
              try {
                if (decks.some(d => d.id === id)) {
                  await api('/decks/' + id + '/set-default', { method: 'POST' });
                  setDecks(prev => prev.map(d => ({ ...d, isDefault: d.id === id })));
                  setUser(u => u ? { ...u, defaultSampleDeckId: null } : u);
                } else if (sampleDecks.some(d => d.id === id)) {
                  await api('/decks/set-default-sample', { method: 'POST', body: JSON.stringify({ sampleDeckId: id }) });
                  setDecks(prev => prev.map(d => ({ ...d, isDefault: false })));
                  setUser(u => u ? { ...u, defaultSampleDeckId: id } : u);
                }
              } catch {}
            }} style={{ fontSize: 12, minWidth: 180, padding: '4px 8px', borderColor: 'var(--accent)', color: 'var(--text)' }}>
            {decks.filter(d => !isCubeDeck(d) && d.mode !== 'drafted').map(d => <option key={d.id} value={d.id}>{d.name} {isDeckLegal(d).legal ? '✓' : '✗'}{d.isDefault ? ' ★' : ''}</option>)}
            {sampleDecks.filter(d => isDeckLegal(d).legal).length > 0 && <option disabled>── Sample Decks ──</option>}
            {sampleDecks.filter(d => isDeckLegal(d).legal).map(d => <option key={d.id} value={d.id}>📋 {d.name}{user?.defaultSampleDeckId === d.id ? ' ★' : ''}</option>)}
          </select>
        </label>
        <button className="btn" onClick={() => setCreating(true)} style={{ borderColor: 'var(--player-color)', color: 'var(--player-color)', background: 'color-mix(in srgb, var(--player-color) 8%, transparent)' }}>+ CREATE GAME</button>
        <VolumeControl />
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }} className="lobby-content animate-in">
        {/* Open Games */}
        <div style={{ flex: 1, borderRight: '1px solid var(--bg4)', display: 'flex', flexDirection: 'column' }}>
          <div className="orbit-font" style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: 'var(--accent)', borderBottom: '1px solid var(--bg4)' }}>
            OPEN GAMES ({openRooms.length})
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
            {openRooms.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text2)', fontSize: 11, padding: 20 }}>No open games. Create one!</div>}
            {openRooms.map(r => {
              const cap = r.maxPlayers || 2;
              const isDraft = !!r.cubeDraft;
              return (
                <div key={r.id} className="room-card" onClick={() => joinRoom(r, false)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700 }}>
                      {isDraft && <span style={{ color: '#9ad8ff', marginRight: 4 }}>🧊</span>}
                      {r.host}
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {isDraft && <span className="badge" style={{ background: 'rgba(154,216,255,.14)', color: '#9ad8ff', fontSize: 11, fontWeight: 800, padding: '3px 10px', border: '1px solid rgba(154,216,255,.3)', letterSpacing: 1 }}>CUBE DRAFT</span>}
                      {!isDraft && r.format > 1 && <span className="badge" style={{ background: 'rgba(255,255,255,.1)', color: '#fff', fontSize: 12, fontWeight: 800, padding: '3px 10px', border: '1px solid rgba(255,255,255,.2)', letterSpacing: 1 }}>Bo{r.format}</span>}
                      <span className="badge" style={{ background: r.type === 'ranked' ? 'rgba(255,170,0,.18)' : 'rgba(0,240,255,.15)', color: r.type === 'ranked' ? '#ffbb33' : '#00f0ff', fontSize: 11, fontWeight: 800, padding: '3px 10px', border: r.type === 'ranked' ? '1px solid rgba(255,170,0,.35)' : '1px solid rgba(0,240,255,.3)', textTransform: 'uppercase', letterSpacing: 1 }}>
                        {r.type}
                      </span>
                      {!isDraft && r.format <= 1 && <span className="badge" style={{ background: 'rgba(255,255,255,.06)', color: 'var(--text2)', fontSize: 11, padding: '3px 10px' }}>Bo1</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 2 }}>
                    {r.hasPlayerPw ? '🔒 Password' : '🔓 Open'} · {r.playerCount}/{cap} players
                    {isDraft && r.cubeDraft && <span style={{ marginLeft: 8 }}>· Cube: <span style={{ color: '#9ad8ff' }}>{r.cubeDraft.cubeName}</span> · Bo{r.cubeDraft.prelimsBo} prelims / Bo{r.cubeDraft.finaleBo} finale</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* In Progress */}
        <div style={{ flex: 1, borderRight: '1px solid var(--bg4)', display: 'flex', flexDirection: 'column' }}>
          <div className="orbit-font" style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: 'var(--player-color)', borderBottom: '1px solid var(--bg4)' }}>
            IN PROGRESS ({activeRooms.length})
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
            {activeRooms.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text2)', fontSize: 11, padding: 20 }}>No active games</div>}
            {activeRooms.map(r => (
              <div key={r.id} className="room-card" onClick={() => joinRoom(r, true)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700 }}>{r.players.join(' vs ')}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {r.format > 1 && <span className="badge" style={{ background: 'rgba(255,255,255,.1)', color: '#fff', fontSize: 12, fontWeight: 800, padding: '3px 10px', border: '1px solid rgba(255,255,255,.2)', letterSpacing: 1 }}>Bo{r.format}</span>}
                    {r.format <= 1 && <span className="badge" style={{ background: 'rgba(255,255,255,.06)', color: 'var(--text2)', fontSize: 11, padding: '3px 10px' }}>Bo1</span>}
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

        {/* Leaderboard — top 10 ranked players. Empty until at least one
            player has finished a ranked set (server filters out anyone
            with ranked_games = 0 so default-1000 accounts don't pollute
            the list). 1st = gold crown + gold name, 2nd = smaller silver
            crown + silver name, 3rd = bronze name, 4–10 use each
            player's own profile color. */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="orbit-font" style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: 'var(--accent4)', borderBottom: '1px solid var(--bg4)' }}>
            LEADERBOARD ({leaderboard.length})
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
            {leaderboard.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text2)', fontSize: 11, padding: 20 }}>
                No ranked players yet — be the first!
              </div>
            )}
            {leaderboard.map(p => {
              // Tier styling. Tier 1 / 2 / 3 override the player's
              // profile color with gold / silver / bronze; ranks 4+
              // render their selected color so the line still feels
              // personal even outside the medal tier.
              const tier = p.rank === 1 ? 'gold' : p.rank === 2 ? 'silver' : p.rank === 3 ? 'bronze' : null;
              const nameColor =
                tier === 'gold'   ? '#ffd24a' :
                tier === 'silver' ? '#d8d8e6' :
                tier === 'bronze' ? '#cd7f32' :
                p.color || '#00f0ff';
              const crown = tier === 'gold' ? '👑' : tier === 'silver' ? '🥈' : tier === 'bronze' ? '🥉' : null;
              return (
                <div key={p.username} className={'leaderboard-row leaderboard-row-' + (tier || 'normal')}>
                  <span className="leaderboard-rank">#{p.rank}</span>
                  {crown && (
                    <span className={'leaderboard-crown leaderboard-crown-' + tier}>{crown}</span>
                  )}
                  <span className="leaderboard-name" style={{ color: nameColor }}>
                    {p.username}
                  </span>
                  <span className="leaderboard-elo">{p.elo}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Create Game Modal */}
      {creating && (
        <div className="modal-overlay" onClick={() => setCreating(false)}>
          {/* Fixed width + min-height locked to the wider Draft layout so
              the modal doesn't reflow / hop when the user toggles between
              Constructed and Draft. Constructed mode just leaves extra
              blank space at the bottom rather than collapsing upward. */}
          <div className="modal animate-in" onClick={e => e.stopPropagation()}
            style={{ width: 460, minWidth: 460, maxWidth: 460, minHeight: 640 }}>
            <h3 className="orbit-font" style={{ marginBottom: 16, color: 'var(--accent)' }}>CREATE GAME</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Game Mode</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className={'btn' + (gameMode === 'constructed' ? ' glow-border' : '')} onClick={() => setGameMode('constructed')} style={{ flex: 1 }}>CONSTRUCTED</button>
                  <button className={'btn' + (gameMode === 'draft' ? ' glow-border' : '')} onClick={() => setGameMode('draft')} style={{ flex: 1 }}
                    title={legalCubes.length === 0 ? 'You need a legal Cube (512 cards) to host a Cube Draft.' : 'Cube Draft tournament'}>
                    🧊 DRAFT
                  </button>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Game Type</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className={'btn' + (gameType === 'unranked' ? ' glow-border' : '')} onClick={() => setGameType('unranked')} style={{ flex: 1 }}>UNRANKED</button>
                  <button className={'btn btn-accent2' + (gameType === 'ranked' ? ' glow-border' : '')} onClick={() => setGameType('ranked')} style={{ flex: 1 }}>RANKED</button>
                </div>
              </div>
              {gameMode === 'constructed' && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Format</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className={'btn' + (gameFormat === 1 ? ' btn-format-active' : '')} onClick={() => setGameFormat(1)} style={{ flex: 1 }}>Bo1</button>
                    <button className={'btn' + (gameFormat === 3 ? ' btn-format-active' : '')} onClick={() => setGameFormat(3)} style={{ flex: 1 }}>Bo3</button>
                    <button className={'btn' + (gameFormat === 5 ? ' btn-format-active' : '')} onClick={() => setGameFormat(5)} style={{ flex: 1 }}>Bo5</button>
                  </div>
                </div>
              )}
              {gameMode === 'draft' && (
                <>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Cube</div>
                    {legalCubes.length === 0 ? (
                      <div style={{ fontSize: 11, color: 'var(--danger)', padding: '6px 8px', border: '1px solid var(--danger)', borderRadius: 4, background: 'rgba(255,80,80,.06)' }}>
                        You have no legal Cube (exactly 512 cards). Build one in the Deck Editor before hosting a draft.
                      </div>
                    ) : (
                      <select className="input" value={draftCubeId} onChange={e => setDraftCubeId(e.target.value)} style={{ width: '100%' }}>
                        {legalCubes.map(c => <option key={c.id} value={c.id}>🧊 {c.name}</option>)}
                      </select>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: draftTimerDisabled ? 'var(--bg4)' : 'var(--text2)', marginBottom: 4 }}>Time per Pack (s)</div>
                      <input className="input" type="number" min={15} max={600} value={draftPackTimerSec}
                        onChange={e => setDraftPackTimerSec(e.target.value)} disabled={draftTimerDisabled}
                        title="Per-pack time bank — picks pull from this." />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: draftTimerDisabled ? 'var(--bg4)' : 'var(--text2)', marginBottom: 4 }}>Bonus Time per Pick (s)</div>
                      <input className="input" type="number" min={0} max={60} value={draftPickTimerSec}
                        onChange={e => setDraftPickTimerSec(e.target.value)} disabled={draftTimerDisabled}
                        title="Extra seconds added to the pack budget for each pick." />
                    </div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 11, color: 'var(--text2)' }}
                    title="Drafters take as long as they want; no auto-pick on timeout.">
                    <input type="checkbox" checked={draftTimerDisabled} onChange={e => setDraftTimerDisabled(e.target.checked)} />
                    Disable draft timer entirely
                  </label>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Prelims length</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className={'btn' + (draftPrelimsBo === 1 ? ' btn-format-active' : '')} onClick={() => setDraftPrelimsBo(1)} style={{ flex: 1 }}>Bo1</button>
                      <button className={'btn' + (draftPrelimsBo === 3 ? ' btn-format-active' : '')} onClick={() => setDraftPrelimsBo(3)} style={{ flex: 1 }}>Bo3</button>
                      <button className={'btn' + (draftPrelimsBo === 5 ? ' btn-format-active' : '')} onClick={() => setDraftPrelimsBo(5)} style={{ flex: 1 }}>Bo5</button>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Finale length</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className={'btn' + (draftFinaleBo === 1 ? ' btn-format-active' : '')} onClick={() => setDraftFinaleBo(1)} style={{ flex: 1 }}>Bo1</button>
                      <button className={'btn' + (draftFinaleBo === 3 ? ' btn-format-active' : '')} onClick={() => setDraftFinaleBo(3)} style={{ flex: 1 }}>Bo3</button>
                      <button className={'btn' + (draftFinaleBo === 5 ? ' btn-format-active' : '')} onClick={() => setDraftFinaleBo(5)} style={{ flex: 1 }}>Bo5</button>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Match flow</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className={'btn' + (draftFlow === 'simultaneous' ? ' glow-border' : '')} onClick={() => setDraftFlow('simultaneous')} style={{ flex: 1 }}
                        title="All round-X games run in parallel. Players can tab between active games to spectate.">
                        SIMULTANEOUS
                      </button>
                      <button className={'btn' + (draftFlow === 'consecutive' ? ' glow-border' : '')} onClick={() => setDraftFlow('consecutive')} style={{ flex: 1 }}
                        title="Round-X games play one after another. Idle players spectate the live game.">
                        CONSECUTIVE
                      </button>
                    </div>
                  </div>
                </>
              )}
              <div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Player Password (optional)</div>
                <input className="input" type="text" autoComplete="off" data-1p-ignore placeholder="Leave empty for open game" value={playerPw} onChange={e => setPlayerPw(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Spectator Password (optional)</div>
                <input className="input" type="text" autoComplete="off" data-1p-ignore placeholder="Leave empty for open spectating" value={specPw} onChange={e => setSpecPw(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" style={{ flex: 1 }} onClick={() => setCreating(false)}>CANCEL</button>
                <button className="btn btn-success" style={{ flex: 1 }} onClick={createGame}
                  disabled={gameMode === 'draft' && legalCubes.length === 0}>CREATE</button>
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
            <input className="input" type="text" autoComplete="off" data-1p-ignore placeholder="Enter password..." value={joinPw}
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

// ── DATEIZUORDNUNG DER FESTEN TRACKS ───────────────────────────────
// An EINER Stelle, damit ein Umkodieren (z.B. wav → ogg) eine Zeile
// bleibt. Die Endungen sind bewusst unterschiedlich — die Dateien
// liegen so im Ordner.
//
// HINWEIS (1.8.): `bgm_menu.mp3` und `bgm_shop.mp3` gab es GAR NICHT
// im Ordner; Menü- und Shop-Musik liefen also seit jeher still ins
// Leere (404). Jetzt zeigen sie auf die tatsächlich vorhandenen
// Dateien.
const BGM_FILES = {
  login:  '/music/bgm_login.wav',
  menu:   '/music/bgm_menu.wav',
  battle: '/music/bgm_battle.mp3',
  puzzle: '/music/bgm_puzzle.mp3',
  shop:   '/music/bgm_shop.ogg',
};
const _mkBgm = (url) => (typeof Audio !== 'undefined' ? new Audio(url) : null);
const _bgmLogin = _mkBgm(BGM_FILES.login);
const _bgmMenu = _mkBgm(BGM_FILES.menu);
const _bgmBattle = _mkBgm(BGM_FILES.battle);
const _bgmPuzzle = _mkBgm(BGM_FILES.puzzle);
const _bgmShop = _mkBgm(BGM_FILES.shop);
const _bgmTracks = { login: _bgmLogin, menu: _bgmMenu, battle: _bgmBattle, puzzle: _bgmPuzzle, shop: _bgmShop };
for (const t of [_bgmLogin, _bgmMenu, _bgmBattle, _bgmPuzzle, _bgmShop]) {
  if (t) {
    t.loop = true;
    // Start from the player's persisted volume (0 if they muted last session)
    // so audio never blips at the default before <VolumeControl> mounts.
    t.volume = window._ppPersistedVolume ? window._ppPersistedVolume() : 0.4;
    t.preload = 'auto';
  }
}

// Volume control bridge — VolumeControl sets this
window._ppSetMusicVolume = (vol) => {
  let cur = null;
  for (const t of Object.values(_bgmTracks)) {
    if (!t) continue;
    t._targetVol = vol;
    if (t.paused === false) cur = t;
  }
  if (cur) cur.volume = vol;
};

// Temporary ducking for big one-shots (victory / defeat fanfares). Called
// from the sound manager. The fanfare must play uninterrupted, so this
// FULLY pauses the current BGM (after a brief fade-out) instead of just
// dropping its volume — the previous fade-only approach left the track
// running silently, which a subsequent `switchTrack` (e.g. the result
// overlay closing while the fanfare is still playing) would have
// crossfaded back in over the fanfare. While ducked, `switchTrack`
// records the requested target and applies it only after the fanfare
// ends. Multiple start/end pairs collapse cleanly via `_bgmDuckTrack`
// and the interval guard.
let _bgmDuckIntv = null;
let _bgmDuckTrack = null; // The Audio element paused for the duration of a fanfare
window._isBgmDucked = () => _bgmDuckTrack != null;
window._ppDuckBgm = (phase) => {
  if (_bgmDuckIntv) { clearInterval(_bgmDuckIntv); _bgmDuckIntv = null; }

  if (phase === 'start') {
    // Already ducked (e.g. an overlapping second fanfare) → keep the
    // existing pause; nothing to do. The first fanfare's `clear` will
    // call us with 'end' once it finishes; if the overlap actually
    // outlives that, the next track switch will pick the right BGM.
    if (_bgmDuckTrack) return;
    const cur = Object.values(_bgmTracks).find(t => t && !t.paused) || null;
    if (!cur) return;
    _bgmDuckTrack = cur;

    // Fast fade-out (~240 ms) so the BGM gets out of the way quickly,
    // then a hard pause so absolutely no sound from the BGM bleeds
    // into the fanfare.
    const origVol = cur.volume;
    let step = 0;
    const total = 8;
    _bgmDuckIntv = setInterval(() => {
      step++;
      cur.volume = Math.max(0, origVol * (1 - step / total));
      if (step >= total) {
        clearInterval(_bgmDuckIntv);
        _bgmDuckIntv = null;
        cur.pause(); // currentTime is preserved — resume picks up cleanly.
      }
    }, 30);
  } else {
    const cur = _bgmDuckTrack;
    _bgmDuckTrack = null;
    if (!cur) return;

    // Honour any track switch requested DURING the duck — see
    // switchTrack's pending-target buffer. If a different track is
    // pending, hand off to the music manager hook instead of resuming
    // the paused one. Otherwise resume the paused track in place.
    const targetVol = window._ppGetVolume ? window._ppGetVolume()
      : (window._ppPersistedVolume ? window._ppPersistedVolume() : 0.4);
    const pending = window._ppPendingBgmTarget;
    if (pending && window._ppApplyPendingBgm) {
      window._ppPendingBgmTarget = null;
      window._ppApplyPendingBgm(pending);
      return;
    }
    cur.volume = 0;
    cur.play().catch(() => {});
    let step = 0;
    const total = 16;
    _bgmDuckIntv = setInterval(() => {
      step++;
      cur.volume = Math.min(targetVol, targetVol * (step / total));
      if (step >= total) { clearInterval(_bgmDuckIntv); _bgmDuckIntv = null; }
    }, 40);
  }
};

// ── GEGNERSPEZIFISCHE BATTLE-THEMES (1.8.) ─────────────────────────
// Ziel-Bezeichner der Form `battle:<slug>` verweisen auf
// /music/bgm_<slug>.ogg — den Slug bestimmt der SERVER (er kennt Deck
// und Dateisystem) und liefert ihn als `gameState.cpuBgm`.
//
// WICHTIG: es wird KEIN neues Audio-Element erzeugt, sondern die `src`
// des BESTEHENDEN Kampf-Elements umgeschaltet. Grund (erster Versuch
// scheiterte genau daran): Chromium/Opera entsperren Audio JE ELEMENT
// über eine Nutzergeste — der Unlock-Durchlauf beim ersten Klick fasst
// nur die vier statischen Tracks an. Ein später erzeugtes Element ist
// nicht entsperrt, `play()` wird abgelehnt, und das sah aus wie eine
// fehlende Datei. Das Kampf-Element ist bereits entsperrt und bleibt es
// auch über einen `src`-Wechsel hinweg.
const BGM_BATTLE_DEFAULT = BGM_FILES.battle;
function _bgmBattleSrc(url) {
  const el = _bgmTracks.battle;
  if (!el) return null;
  if (el.src && el.src.endsWith(url)) return el;
  el.onerror = null;
  el.src = url;
  // Fehlt die Datei wirklich (404/Decode), zurück auf das generische
  // Kampfthema — DAS ist der Fall, für den ein Fallback gedacht ist,
  // nicht eine abgelehnte Wiedergabe.
  if (url !== BGM_BATTLE_DEFAULT) {
    el.onerror = () => {
      el.onerror = null;
      el.src = BGM_BATTLE_DEFAULT;
      try { el.load(); el.play().catch(() => {}); } catch {}
    };
  }
  try { el.load(); } catch {}
  return el;
}
function _bgmResolveTrack(target) {
  if (target === 'battle') return _bgmBattleSrc(BGM_BATTLE_DEFAULT);
  if (_bgmTracks[target]) return _bgmTracks[target];
  const m = /^battle:([a-z0-9]+)$/.exec(String(target || ''));
  if (!m) return null;
  return _bgmBattleSrc('/music/bgm_' + m[1] + '.ogg');
}

// ═══════════════════════════════════════════
//  FEHLERGRENZE (1.8.)
// ═══════════════════════════════════════════
// Vorher gab es KEIN componentDidCatch im ganzen Client. Ein Fehler im
// Render- oder Effekt-Pfad des Spielfelds ließ React den Teilbaum
// abbrechen — sichtbar wurde daraus ein stilles EINFRIEREN: das Board
// blieb auf dem letzten gezeichneten Stand stehen, während Socket und
// Modals weiterliefen. Genau dieses Bild hatte Al mehrfach ("das Spiel
// hängt"), und es kostete jedes Mal eine Runde Rätselraten.
//
// Ab hier wird daraus eine Meldung MIT Stack, Kopierknopf und
// Neuladen-Schaltfläche. Der Fehler geht zusätzlich als
// `[client-error]` in die Konsole, damit er auch dann auffindbar ist,
// wenn jemand die Seite reflexartig neu lädt.
class GameErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null, info: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) {
    this.setState({ info });
    try {
      console.error('[client-error]', err, info?.componentStack);
      window.__ppLastClientError = {
        message: String(err?.message || err),
        stack: String(err?.stack || ''),
        componentStack: String(info?.componentStack || ''),
        at: new Date().toISOString(),
      };
    } catch {}
  }
  render() {
    if (!this.state.err) return this.props.children;
    const e = this.state.err;
    const text = `${e?.message || e}\n\n${e?.stack || ''}\n\nKomponenten-Stack:${this.state.info?.componentStack || ''}`;
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(10,10,16,.96)',
        color: '#ffd7d7', padding: '24px', overflow: 'auto', fontFamily: 'monospace', fontSize: 13 }}>
        <div style={{ fontSize: 18, marginBottom: 10, color: '#ff8080' }}>
          Das Spielfeld ist auf einen Fehler gelaufen.
        </div>
        <div style={{ marginBottom: 14, color: '#ccc', fontFamily: 'inherit' }}>
          Die Partie läuft auf dem Server weiter — Neuladen bringt dich zurück hinein.
          Bitte den Text unten mitschicken.
        </div>
        <div style={{ marginBottom: 14 }}>
          <button onClick={() => window.location.reload()}
            style={{ marginRight: 8, padding: '6px 14px' }}>Neu laden</button>
          <button onClick={() => { try { navigator.clipboard.writeText(text); } catch {} }}
            style={{ padding: '6px 14px' }}>Fehlertext kopieren</button>
        </div>
        <pre style={{ whiteSpace: 'pre-wrap', background: '#000', padding: 12, borderRadius: 6 }}>{text}</pre>
      </div>
    );
  }
}

function MusicManager({ bgmMode }) {
  const unlocked = useRef(false);
  const currentTrack = useRef(null); // 'menu' | 'battle' | 'battle:<slug>' | 'puzzle'

  const getTargetVol = useCallback(() => {
    if (window._ppGetVolume) return window._ppGetVolume();
    return window._ppPersistedVolume ? window._ppPersistedVolume() : 0.4;
  }, []);

  const switchTrack = useCallback((target) => {
    if (currentTrack.current === target) return;
    // `battle:<slug>` wird bei Bedarf erzeugt; fehlt die Datei, greift
    // weiter unten der Fallback auf das generische Kampfthema.
    const fadeIn = _bgmResolveTrack(target);
    if (!fadeIn) return;
    if (String(target).startsWith('battle')) {
      console.log('[bgm] switchTrack', JSON.stringify(currentTrack.current), '→',
        JSON.stringify(target), '| src =', fadeIn.src || '(keine)');
    }
    // While a fanfare is ducking the BGM (victory / defeat), don't
    // start ANY background music — the fanfare must play uninterrupted
    // by definition. Buffer the requested target on a global slot;
    // `_ppDuckBgm('end')` reads it after the fanfare finishes and
    // hands back control to apply the deferred switch (see
    // `_ppApplyPendingBgm` registered below).
    if (window._isBgmDucked && window._isBgmDucked()) {
      window._ppPendingBgmTarget = target;
      currentTrack.current = target; // record intent so a later same-target call still no-ops cleanly
      return;
    }
    // Fade out whichever track is currently playing.
    const fadeOut = Object.entries(_bgmTracks)
      .find(([, t]) => t && t !== fadeIn && !t.paused)?.[1] || null;

    const targetVol = getTargetVol();

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
      const fadeInterval = setInterval(() => {
        step++;
        fadeIn.volume = Math.min(targetVol, targetVol * (step / 8));
        if (step >= 8) clearInterval(fadeInterval);
      }, 40);
    }).catch(() => {
      // Autoplay still blocked — retry on next user interaction
      const retry = () => {
        fadeIn.volume = 0;
        fadeIn.play().then(() => {
          let step = 0;
          const fadeInterval = setInterval(() => {
            step++;
            fadeIn.volume = Math.min(targetVol, targetVol * (step / 8));
            if (step >= 8) clearInterval(fadeInterval);
          }, 40);
        }).catch(() => {});
        window.removeEventListener('click', retry);
      };
      window.addEventListener('click', retry, { once: true });
    });

    currentTrack.current = target;
  }, [getTargetVol]);

  // Unlock audio on first user interaction
  // Chromium/Opera require a direct user gesture to unlock each Audio element.
  // We "touch" every track (play → immediate pause) to unlock them, then start the real track.
  useEffect(() => {
    if (unlocked.current) return;
    const unlock = () => {
      if (unlocked.current) return;
      unlocked.current = true;
      const touchAndUnlock = async () => {
        for (const audio of Object.values(_bgmTracks)) {
          if (!audio) continue;
          try {
            audio.volume = 0;
            await audio.play();
            audio.pause();
            audio.currentTime = 0;
          } catch {}
        }
        switchTrack(bgmMode || 'menu');
      };
      touchAndUnlock();
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('click', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchstart', unlock);
    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, [bgmMode]);

  // Switch tracks when bgmMode changes
  useEffect(() => {
    if (!unlocked.current) return;
    switchTrack(bgmMode || 'menu');
  }, [bgmMode, switchTrack]);

  // Bridge for `_ppDuckBgm('end')` to apply a track switch that was
  // deferred while the fanfare was playing. Has to be registered
  // here — `switchTrack` is a hook callback and isn't reachable from
  // the module-level duck function otherwise. Reset on unmount so a
  // stale closure can't fire after the manager is gone.
  useEffect(() => {
    window._ppApplyPendingBgm = (target) => {
      // Force the track to actually swap by clearing the
      // currentTrack ref — switchTrack early-returns when the
      // requested target equals the recorded current, and the
      // deferred-switch path stamped that ref before the duck
      // started.
      currentTrack.current = null;
      switchTrack(target || 'menu');
    };
    return () => {
      if (window._ppApplyPendingBgm) window._ppApplyPendingBgm = null;
    };
  }, [switchTrack]);

  return null; // No visual output
}

// ═══════════════════════════════════════════
//  OPPONENT UNLOCK POPUP
//  Global, always-mounted overlay. Listens for the server's
//  `opponents_unlocked` socket event (emitted at the end of a CPU battle
//  when a win milestone is hit) and shows a big ornate celebration for
//  each newly-unlocked opponent in turn. Queues multiple unlocks so they
//  display one after another.
// ═══════════════════════════════════════════
function OpponentUnlockPopup() {
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    const onUnlocked = (data) => {
      const list = (data && data.opponents) || [];
      if (list.length) setQueue(q => [...q, ...list]);
    };
    socket.on('opponents_unlocked', onUnlocked);
    return () => socket.off('opponents_unlocked', onUnlocked);
  }, []);

  const current = queue.length ? queue[0] : null;
  const dismiss = useCallback(() => setQueue(q => q.slice(1)), []);

  // Celebratory sting + Enter-to-continue, refreshed for each unlock.
  useEffect(() => {
    if (!current) return;
    if (window.playSFX) window.playSFX('ascension');
    const onKey = (e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); dismiss(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [current ? current.id : null, dismiss]);

  if (!current) return null;
  const heroArt = typeof HeroArtCrop === 'function';

  return (
    <div
      onClick={dismiss}
      style={{
        position: 'fixed', inset: 0, zIndex: 100000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(circle at 50% 45%, rgba(40,28,5,.55), rgba(5,3,12,.9))',
        backdropFilter: 'blur(3px)',
        animation: 'ppUnlockFade .3s ease both',
      }}
    >
      <style>{`
        @keyframes ppUnlockFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ppUnlockPop {
          0% { transform: scale(.7) translateY(20px); opacity: 0; }
          60% { transform: scale(1.04); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes ppUnlockSpin { to { transform: rotate(360deg); } }
        @keyframes ppUnlockGlow {
          0%,100% { box-shadow: 0 0 28px rgba(255,200,60,.55), 0 0 70px rgba(255,160,20,.35), inset 0 0 24px rgba(255,200,60,.18); }
          50% { box-shadow: 0 0 44px rgba(255,225,120,.85), 0 0 110px rgba(255,170,30,.55), inset 0 0 34px rgba(255,210,90,.3); }
        }
        @keyframes ppUnlockTitle {
          0%,100% { text-shadow: 0 0 10px rgba(255,210,90,.8), 0 0 22px rgba(255,160,20,.5); }
          50% { text-shadow: 0 0 18px rgba(255,235,150,1), 0 0 40px rgba(255,180,40,.8); }
        }
      `}</style>

      {/* Rotating shimmer ring behind the card */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
           onClick={e => e.stopPropagation()}>
        <div style={{
          position: 'absolute', width: 620, height: 620, borderRadius: '50%',
          background: 'conic-gradient(from 0deg, rgba(255,200,60,0) 0deg, rgba(255,210,90,.32) 60deg, rgba(255,200,60,0) 120deg, rgba(255,210,90,.32) 180deg, rgba(255,200,60,0) 240deg, rgba(255,210,90,.32) 300deg, rgba(255,200,60,0) 360deg)',
          filter: 'blur(6px)', animation: 'ppUnlockSpin 14s linear infinite', pointerEvents: 'none',
        }} />

        {/* Ornate frame */}
        <div style={{
          position: 'relative',
          width: 'min(90vw, 460px)',
          padding: '34px 36px 30px',
          textAlign: 'center',
          borderRadius: 18,
          border: '3px solid #ffcf52',
          outline: '1px solid rgba(255,225,140,.6)',
          outlineOffset: 6,
          background: 'linear-gradient(160deg, #241a36 0%, #15101f 55%, #1d1330 100%)',
          animation: 'ppUnlockPop .5s cubic-bezier(.18,.9,.3,1.2) both, ppUnlockGlow 2.6s ease-in-out infinite',
        }}>
          {/* Ornamental corner flourishes */}
          {[['top','left'],['top','right'],['bottom','left'],['bottom','right']].map(([v,h]) => (
            <div key={v+h} style={{
              position: 'absolute', [v]: 6, [h]: 10, color: '#ffd76a',
              fontSize: 20, lineHeight: 1, textShadow: '0 0 8px rgba(255,180,40,.8)', pointerEvents: 'none',
            }}>✦</div>
          ))}

          <div className="orbit-font" style={{
            fontSize: 15, fontWeight: 800, letterSpacing: 3, color: '#ffd76a',
            marginBottom: 18, animation: 'ppUnlockTitle 2.2s ease-in-out infinite',
          }}>✦ NEW OPPONENT UNLOCKED ✦</div>

          {/* Hero portrait in a gold frame */}
          <div style={{
            display: 'inline-block', padding: 4, borderRadius: 10,
            border: '2px solid #ffcf52', background: '#0a0a12',
            boxShadow: '0 0 18px rgba(255,190,50,.5)', marginBottom: 18,
          }}>
            {heroArt
              ? <HeroArtCrop heroName={current.middleHero} width={300} />
              : <div style={{ width: 300, height: 200, background: '#1a1a28' }} />}
          </div>

          <div style={{ fontSize: 16, color: 'var(--text)', lineHeight: 1.5, marginBottom: 22 }}>
            You unlocked{' '}
            <span className="orbit-font" style={{
              color: '#ffe08a', fontWeight: 800, fontSize: 20,
              textShadow: '0 0 12px rgba(255,190,50,.7)',
            }}>{current.middleHero || current.name}</span>{' '}
            as a new opponent!
          </div>

          <button
            onClick={dismiss}
            className="orbit-font"
            style={{
              padding: '10px 34px', fontSize: 14, fontWeight: 800, letterSpacing: 2,
              color: '#3a2600', cursor: 'pointer', borderRadius: 8, border: 'none',
              background: 'linear-gradient(180deg, #ffe27a 0%, #ffc23a 60%, #f0a51c 100%)',
              boxShadow: '0 0 16px rgba(255,190,50,.7), 0 3px 0 #b9791a',
              transition: 'transform .12s ease, box-shadow .12s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 0 26px rgba(255,210,90,.9), 0 5px 0 #b9791a'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 0 16px rgba(255,190,50,.7), 0 3px 0 #b9791a'; }}
          >CONTINUE</button>
        </div>
      </div>
    </div>
  );
}

// ── Player-coloured hover cursor ──────────────────────────────────────
// The default arrow is a static white PNG, but the hover/clickable cursor
// should be a light, shining tone of the player's OWN colour. A PNG can't be
// tinted via CSS variables, so we recolour the white arrow's fill in a canvas
// at runtime and inject it as a <style> that overrides the static cyan rule
// in style.css. Falls back silently to that cyan cursor on any error.
let _cursorImg = null;
let _cursorColor = [120, 245, 255];
function _lightenHex(hex, amt) {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex || '');
  let r = 0, g = 240, b = 255;
  if (m) { const n = parseInt(m[1], 16); r = (n >> 16) & 255; g = (n >> 8) & 255; b = n & 255; }
  // Mix toward white for a bright, shining tone while keeping the hue.
  return [Math.round(r + (255 - r) * amt), Math.round(g + (255 - g) * amt), Math.round(b + (255 - b) * amt)];
}
function _drawHoverCursor() {
  const img = _cursorImg;
  if (!img || !img.complete || !img.naturalWidth) return;
  try {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height);
    const p = d.data;
    for (let i = 0; i < p.length; i += 4) {
      if (p[i + 3] === 0) continue;                       // transparent → skip
      if (p[i] > 180 && p[i + 1] > 180 && p[i + 2] > 180) { // white fill → player tone
        p[i] = _cursorColor[0]; p[i + 1] = _cursorColor[1]; p[i + 2] = _cursorColor[2];
      }                                                    // black outline left as-is
    }
    ctx.putImageData(d, 0, 0);
    const url = c.toDataURL('image/png');
    let s = document.getElementById('pp-hover-cursor');
    if (!s) { s = document.createElement('style'); s.id = 'pp-hover-cursor'; document.head.appendChild(s); }
    s.textContent = '.btn:not(:disabled):not([disabled]), button:not(:disabled):not([disabled]), '
      + 'a[href], select, summary, .board-zone-clickable, .ctx-menu-item:not(.disabled), '
      + '[class*="clickable"], [style*="cursor: pointer"], [style*="cursor:pointer"], .pp-hover-pointer '
      + '{ cursor: url("' + url + '") 2 2, pointer !important; }';
  } catch {}
}
function applyPixelHoverCursor(hex) {
  _cursorColor = _lightenHex(hex, 0.42);
  if (!_cursorImg) {
    _cursorImg = new Image();
    _cursorImg.onload = _drawHoverCursor;
    _cursorImg.src = '/cursor-arrow.png?v=4';
  }
  // A cached image often won't fire `onload`, so draw immediately when it's
  // already available; otherwise the onload above handles the first paint.
  if (_cursorImg.complete && _cursorImg.naturalWidth) _drawHoverCursor();
}

function App() {
  const [user, setUser] = useState(null);
  const [screen, setScreen] = useState('menu');
  const [loading, setLoading] = useState(true);
  const [notif, setNotif] = useState(null);
  // bgmMode: 'menu' | 'battle' | 'puzzle' | 'shop'. setInBattle is
  // kept as a compatibility wrapper so existing callers continue to
  // work.
  const [bgmMode, setBgmMode] = useState('menu');
  const inBattle = bgmMode !== 'menu';
  const setInBattle = useCallback((v) => setBgmMode(v ? 'battle' : 'menu'), []);

  // Expose the player's chosen colour as a global CSS variable so every
  // screen/submenu (titles, etc.) can theme off it via var(--player-color).
  useEffect(() => {
    const col = (user && user.color) || '#00f0ff';
    document.documentElement.style.setProperty('--player-color', col);
    // Recolour the hover/clickable cursor to a shining tone of this colour.
    applyPixelHoverCursor(col);
  }, [user && user.color]);

  // Catch-all pixel hover cursor: any element whose cursor still COMPUTES to
  // the native `pointer` (a clickable the static selector list didn't cover —
  // avatars, links, tabs, gallery tiles, …) gets tagged with `.pp-hover-pointer`
  // on hover, which the hover-cursor rules target. This ends the whack-a-mole
  // of listing every clickable class and future-proofs new ones. Elements our
  // rules already handle compute to `url(...)`, so they never match here.
  useEffect(() => {
    const tag = (e) => {
      const el = e.target;
      if (!el || el.nodeType !== 1 || !el.classList || el.classList.contains('pp-hover-pointer')) return;
      let c;
      try { c = getComputedStyle(el).cursor; } catch { return; }
      if (c === 'pointer') el.classList.add('pp-hover-pointer');
    };
    const untag = (e) => { const el = e.target; if (el && el.classList) el.classList.remove('pp-hover-pointer'); };
    document.addEventListener('mouseover', tag, true);
    document.addEventListener('mouseout', untag, true);
    return () => {
      document.removeEventListener('mouseover', tag, true);
      document.removeEventListener('mouseout', untag, true);
    };
  }, []);

  const notify = useCallback((message, type) => {
    setNotif({ message, type, id: Date.now() });
    // Only play a sound for errors — success/info notifications usually
    // follow a user click that already fired ui_click via the delegated
    // listener, so playing it again here is a superfluous double-tap.
    if (type === 'error' && window.playSFX) window.playSFX('ui_error');
  }, []);

  // Auto-login + load card DB
  useEffect(() => {
    (async () => {
      try {
        await loadCardDB();
        const data = await api('/auth/me');
        if (data.user) {
          setUser(data.user);
          window.AUTH_TOKEN = data.token || null;
          if (window.AUTH_TOKEN) socket.emit('auth', window.AUTH_TOKEN);
        }
      } catch {}
      setLoading(false);
    })();

    // Listen for game reconnection
    const onReconnectGame = (state) => {
      if (state.reconnected) {
        // Puzzle games are ephemeral — don't reconnect, just clean up
        if (state.isPuzzle) {
          socket.emit('leave_game', { roomId: state.roomId });
          return;
        }
        // CPU-Kämpfe rendert der SINGLEPLAYER-Bildschirm, nicht PlayScreen
        // (der bedient den Mehrspieler-Weg). Bisher landete der
        // Wiedereinstieg pauschal auf 'play' — nach F5 sah Al deshalb das
        // Hauptmenü, obwohl der Server die Partie noch hielt. Der Zustand
        // wird zwischengelegt, weil der SP-Bildschirm seinen eigenen
        // game_state-Listener erst beim Einhängen registriert und das
        // Ereignis sonst ins Leere liefe.
        if (state.isCpuBattle) {
          window.__ppPendingCpuBattleState = state;
          setScreen('singleplayer');
          return;
        }
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

  // ── App-wide tooltip wheel-scroll redirect ──
  // Card tooltips (battle `.board-tooltip`, deck-editor / shop / deck-
  // builder `.tooltip.card-tooltip`, and the inner scrollable
  // `.card-tooltip-info`) all set `pointer-events: none` so they don't
  // block hover-out detection on the source card. Side effect: wheel
  // events never reach those elements, so their `overflow: auto` /
  // `overflow-y: auto` styling is dead. We listen at window level,
  // find any visible tooltip element with overflow, and proxy the
  // wheel delta to its `scrollTop`. When no tooltip is overflowing,
  // the wheel falls through to normal page scroll. Always-on so it
  // covers every screen — battle, puzzle, deck builder, shop, etc.
  useEffect(() => {
    const onWheel = (e) => {
      // Candidate scrollable targets, in priority order. The inner
      // `.card-tooltip-info` is the actual scroll viewport for the
      // CardMini-style local tooltips (the outer `.tooltip` wrapper
      // is `overflow: hidden`); for board tooltips the outer
      // `.board-tooltip` IS the scrollable element.
      const selectors = [
        '.card-tooltip-info',
        '.board-tooltip',
        '.tooltip.card-tooltip',
      ];
      for (const sel of selectors) {
        const els = document.querySelectorAll(sel);
        for (let i = els.length - 1; i >= 0; i--) {
          const el = els[i];
          if (!el.isConnected) continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (el.scrollHeight - el.clientHeight <= 1) continue;
          // Found something to scroll.
          e.preventDefault();
          const step = e.deltaMode === 1 ? e.deltaY * 16
                     : e.deltaMode === 2 ? e.deltaY * el.clientHeight
                     : e.deltaY;
          el.scrollTop += step;
          return;
        }
      }
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, []);

  // Escape key → return to main menu from any sub-screen (except play — handled by PlayScreen/GameBoard)
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && !e.defaultPrevented && user && screen !== 'menu' && screen !== 'play' && screen !== 'deckbuilder') {
        setScreen('menu');
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [screen, user]);

  // Show welcome text box for brand-new accounts only
  const welcomeShownRef = useRef(false);
  useEffect(() => {
    if (user && !welcomeShownRef.current && window._isNewAccount) {
      welcomeShownRef.current = true;
      window._isNewAccount = false;
      setTimeout(() => {
        showTextBox({
          speaker: '/MoniaBot.png',
          speakerName: 'Monia Bot',
          text: 'Heya! Welcome to Pixel Parties, beep-boop!\nI am your friendly neighborhood Monia Bot, the coolest bot there is, here to guide you through the game.\nIf you want my help to learn the ropes, follow me to the tutorial under How to Play!',
        });
      }, 400);
    }
  }, [user]);

  if (loading) {
    return (
      <div className="screen-center">
        <div className="pixel-font" style={{ color: 'var(--accent)', animation: 'pulse 1.5s infinite', fontSize: 14 }}>LOADING...</div>
      </div>
    );
  }

  const ctx = { user, setUser, screen, setScreen, notify, inBattle, setInBattle, bgmMode, setBgmMode };

  return (
    <AppContext.Provider value={ctx}>
      {/* Global portrait rotation lock — all screens need landscape */}
      <div className="rotate-device-overlay" id="rotate-overlay">
        <div className="rotate-icon">📱</div>
        <div className="rotate-text">Please rotate your device</div>
        <div className="rotate-sub">Pixel Parties requires landscape orientation for the best experience</div>
      </div>
      <MusicManager bgmMode={user ? bgmMode : 'login'} />
      <TextBox />
      <OpponentUnlockPopup />
      {notif && <Notification key={notif.id} message={notif.message} type={notif.type} onClose={() => setNotif(null)} />}
      <GameErrorBoundary>
        {!user ? <AuthScreen /> :
          user.isGuest ? <SingleplayerScreen /> :
          screen === 'menu' ? <MainMenu /> :
          screen === 'play' ? <PlayScreen /> :
          screen === 'singleplayer' ? <SingleplayerScreen /> :
          screen === 'deckbuilder' ? <DeckBuilder /> :
          screen === 'shop' ? <ShopScreen /> :
          screen === 'profile' ? <ProfileScreen /> :
          screen === 'rules' ? <RulesScreen /> :
          screen === 'puzzle-create' ? <PuzzleCreator /> :
          <MainMenu />}
      </GameErrorBoundary>
    </AppContext.Provider>
  );
}

// Mount once the pixel UI font is actually loaded. <input> fields don't
// repaint when a web font finishes loading lazily, so if we render before
// 'Pixel Intv' is ready the login fields get stuck on a fallback font until
// they're focused. The boot splash (Segoe UI) covers this brief wait; a
// timeout guarantees we mount even if the font load stalls or fails.
(function mountApp() {
  const mount = () => ReactDOM.createRoot(document.getElementById('root')).render(<App />);
  try {
    if (document.fonts && document.fonts.load) {
      let done = false;
      const go = () => { if (!done) { done = true; mount(); } };
      document.fonts.load('16px "Pixel Intv"').then(go, go);
      setTimeout(go, 1500);
    } else {
      mount();
    }
  } catch (e) {
    mount();
  }
})();

