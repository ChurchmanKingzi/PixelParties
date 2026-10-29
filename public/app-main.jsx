// ═══════════════════════════════════════════
//  PIXEL PARTIES — APP ROOT
//  PlayScreen, MusicManager, and App component
// ═══════════════════════════════════════════
const { useState, useEffect, useRef, useCallback, useContext, useMemo } = React;
const { api, socket, AppContext, Notification, CardMini, loadCardDB,
        isDeckLegal, isCubeDeck, emitSocket } = window;
const { AuthScreen, MainMenu, ProfileScreen, ShopScreen, RulesScreen, PuzzleCreator, VolumeControl,
  MenuBackgroundParticles } = window;
const { DeckBuilder } = window;
const { GameBoard } = window;
const { SkillTestLobby, SkillTestCreateOptions, SkillTestPrepScreen, SkillTestBattlePending } = window;
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
/** Laufende Nummer des Picks im ganzen Draft (1…totalPicks). `pickInRound` zaehlt nur innerhalb des Packs (0…15). */
function cubeDraftOverallPick(draft) {
  const perRound = draft.totalPicks / Math.max(1, draft.totalRounds);
  return draft.round * perRound + draft.pickInRound + 1;
}

function CubeDraftScreen({ lobby, draft, leaveRoom, notify }) {
  // Eigene Draft-Musik, solange der Screen steht (Deck-Bau danach bekommt wieder die Menümusik).
  const { setBgmMode } = useContext(AppContext);
  useEffect(() => {
    if (!setBgmMode) return;
    setBgmMode('draft');
    return () => setBgmMode('menu');
  }, [setBgmMode]);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [filter, setFilter] = useState('');
  // Lokale Sammlung: { id, name, gray } — frei umsortierbar, einzeln abgrauen.
  const [poolOrder, setPoolOrder] = useState([]);
  const poolIdRef = useRef(1);
  const newPoolEntry = (name) => ({ id: poolIdRef.current++, name, gray: false });
  // Pointer-Drag der gedrafteten Karten (wie Handkarten): Klick = Abgrauen toggeln,
  // Ziehen = verschieben, Einfuegemarke zeigt die Zielposition.
  const [dragSrc, setDragSrc] = useState(null);       // Index der gezogenen Karte
  const [dragInsert, setDragInsert] = useState(null); // Einfuegeposition 0..n
  const [dragPos, setDragPos] = useState(null);       // {x, y} fuer das Geisterbild
  const dragRef = useRef(null);                       // { idx, startX, startY, active, insert }
  // Sofort-Pick: die geklickte Karte verschwindet aus dem Pack, noch bevor der Server antwortet.
  const [optimisticPick, setOptimisticPick] = useState(null);
  useEffect(() => { setOptimisticPick(null); }, [draft?.round, draft?.pickInRound]);
  // Mirror server-pushed pool into local custom-ordered list. New cards
  // append; removed cards (shouldn't happen during draft, but defensive)
  // drop out. Drag-reorder mutates this list only.
  useEffect(() => {
    // Sofort-Anzeige: die gewaehlte Karte landet unten, ohne das Rundenende abzuwarten.
    const incoming = [...(draft?.myPool || []), ...(draft?.myPendingPick ? [draft.myPendingPick] : [])];
    setPoolOrder(prev => {
      // Build new order by counts: each card name has N copies in
      // incoming. Walk prev and keep entries whose card+occurrence
      // still exists in incoming, then append new ones.
      const remainingCounts = {};
      for (const c of incoming) remainingCounts[c] = (remainingCounts[c] || 0) + 1;
      const next = [];
      for (const e of prev) {
        if ((remainingCounts[e.name] || 0) > 0) {
          next.push(e);
          remainingCounts[e.name]--;
        }
      }
      // Append new cards (in incoming order) that weren't in prev.
      for (const c of incoming) {
        if ((remainingCounts[c] || 0) > 0) {
          next.push(newPoolEntry(c));
          remainingCounts[c]--;
        }
      }
      return next;
    });
  }, [draft?.myPool?.length, draft?.myPendingPick, draft?.myPicked]);

  // Globale Pointer-Listener fuer das Ziehen (einmal montiert; alle Zustandsaenderungen
  // laufen ueber funktionale Updates bzw. Refs, daher keine veralteten Closures).
  useEffect(() => {
    const insertFromPoint = (x, y) => {
      const el = document.elementFromPoint(x, y)?.closest?.('[data-pool-idx]');
      if (!el) return null;
      const idx = parseInt(el.getAttribute('data-pool-idx'), 10);
      const r = el.getBoundingClientRect();
      return x > r.left + r.width / 2 ? idx + 1 : idx;
    };
    const move = (e) => {
      const d = dragRef.current;
      if (!d) return;
      if (!d.active) {
        if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 6) return;
        d.active = true;
        // Waehrend des Ziehens zeigen die Karten unter dem Zeiger KEINEN Tooltip (CardMini.show prueft das, wie im
        // Deck-Editor) — sonst bliebe nach dem Umsortieren der Tooltip einer Nachbarkarte haengen.
        window.deckDragState = { section: 'draftPool', fromIdx: d.idx };
        setDragSrc(d.idx);
      }
      d.insert = insertFromPoint(e.clientX, e.clientY);
      setDragInsert(d.insert);
      setDragPos({ x: e.clientX, y: e.clientY });
    };
    const up = () => {
      const d = dragRef.current;
      dragRef.current = null;
      window.deckDragState = null;
      if (!d) return;
      if (d.active) {
        const from = d.idx, ins = d.insert;
        if (ins != null) {
          if (window.playSFX) window.playSFX('placement', { dedupe: 80 });
          setPoolOrder(prev => {
            const arr = [...prev];
            const [moved] = arr.splice(from, 1);
            arr.splice(ins > from ? ins - 1 : ins, 0, moved);
            return arr;
          });
        }
      } else {
        // Einfacher Klick: Abgrauen toggeln (relevant / weniger relevant).
        setPoolOrder(prev => prev.map((e, i) => i === d.idx ? { ...e, gray: !e.gray } : e));
      }
      setDragSrc(null); setDragInsert(null); setDragPos(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.deckDragState = null;
    };
  }, []);

  // Live-tick the displayed timer locally so the budget visibly counts
  // down between server broadcasts (which only fire on pick windows).
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!draft || draft.suspended || draft.myPicked) return;
    const t = setInterval(() => setTick(x => x + 1), 250);
    return () => clearInterval(t);
  }, [draft?.suspended, draft?.myPicked, draft?.round, draft?.pickInRound]);

  // Hooks muessen VOR den fruehen Returns stehen (sonst React #311402, sobald
  // `draft` von null auf gesetzt wechselt).
  const startedAt = useRef(Date.now());
  useEffect(() => { startedAt.current = Date.now(); }, [draft?.round, draft?.pickInRound, draft?.suspended]);

  // Pack-Flaeche vermessen: Kartengroesse so waehlen, dass ALLE Karten
  // (8 pro Reihe) ohne Scrollen in Breite UND Hoehe passen.
  const packBoxRef = useRef(null);
  const [packBox, setPackBox] = useState({ w: 0, h: 0 });
  const packVisible = !!draft && !draft.isSpectator;
  // Klang, sobald ein neues Pack vor einem liegt (Draftbeginn und jede Runde).
  useEffect(() => {
    if (!packVisible || draft.suspended) return;
    if (window.playSFX) window.playSFX('shuffle', { dedupe: 300 });
  }, [packVisible, draft?.round, draft?.pickInRound]);
  useEffect(() => {
    const el = packBoxRef.current;
    if (!el) return;
    const measure = () => setPackBox(prev => (prev.w === el.clientWidth && prev.h === el.clientHeight) ? prev : { w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [packVisible]);

  if (!draft) {
    return (
      <div className="screen-full">
        <div className="top-bar">
          {/* v1260 (Als Vorgabe 20.9.): Kopfzeilen-Knoepfe (LEAVE/BACK/CLOSE ROOM)
              im Basismass von `.btn` — gleiche Hoehe wie „+ CREATE GAME"; die
              alte Verkleinerung (4/12 px, Schrift 10) ist in allen Menues raus. */}
          <button className="btn btn-danger" onClick={leaveRoom}>LEAVE</button>
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
          <button className="btn btn-danger" onClick={leaveRoom}>LEAVE</button>
          <h2 className="orbit-font" style={{ fontSize: 14, color: 'var(--accent)' }}>🧊 CUBE DRAFT — SPECTATING</h2>
          <span className="badge" style={{ background: 'rgba(179,216,249,.14)', color: '#b3d8f9' }}>Pack {draft.round + 1}/{draft.totalRounds} · Pick {cubeDraftOverallPick(draft)}/{draft.totalPicks}</span>
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

  const canPick = !draft.myPicked && !optimisticPick && !draft.suspended && draft.myPack.length > 0;
  // Angezeigtes Pack = Server-Pack ohne die bereits gewaehlte Karte (eine Kopie).
  const shownPack = (() => {
    const picked = draft.myPendingPick || optimisticPick;
    if (!picked) return draft.myPack;
    const i = draft.myPack.indexOf(picked);
    return i < 0 ? draft.myPack : draft.myPack.filter((_, k) => k !== i);
  })();
  const totalRemainingMs = (draft.remainingMs || 0) - (draft.myPicked || draft.suspended ? 0 : (tick * 0)); // tick is just to re-render
  // Actual countdown: server gave us remainingMs at the time of last
  // broadcast. We don't have a precise client-side anchor for the window
  // start, so we just tick down from that snapshot. This drifts slightly
  // but the next server broadcast (every pick) re-syncs.
  const elapsedClient = (draft.myPicked || draft.suspended) ? 0 : (Date.now() - startedAt.current);
  const displayRemainingMs = Math.max(0, (draft.remainingMs || 0) - elapsedClient);
  const m = Math.floor(displayRemainingMs / 60000);
  const s = Math.floor((displayRemainingMs % 60000) / 1000);
  const timerStr = m + ':' + String(s).padStart(2, '0');
  const timerWarn = displayRemainingMs <= 10_000;

  // Filter pool by name search.
  const visiblePool = poolOrder
    .map((e, i) => ({ name: e.name, gray: e.gray, id: e.id, idx: i }))
    .filter(e => !filter || window.namePasst(e.name, filter));

  // Player ring shown top-left. Always rooted at "me" so the local seat
  // is at index 0; subsequent entries follow the snake direction so the
  // arrow column reads naturally.
  const seatOrder = draft.seatOrder || [];
  const myRingPos = seatOrder.indexOf(draft.seatIdx);
  const ringSize = seatOrder.length;
  const ringList = [];
  if (myRingPos >= 0) {
    for (let i = 0; i < ringSize; i++) {
      // Feste Ring-Reihenfolge ab mir — sie bleibt ueber alle Packs gleich. Nur die Pfeile drehen sich:
      // 'left' = Packs gehen an den NAECHSTEN Ringplatz (die Zeile darunter, ↓), 'right' = an den
      // vorherigen (die Zeile darueber, ↑). Wuerde zusaetzlich die Liste umsortiert, kaemen beide
      // Umkehrungen zusammen und das Bild zeigte in jedem Pack dieselbe Reihenfolge.
      const ringPos = (myRingPos + i) % ringSize;
      const seatIdx = seatOrder[ringPos];
      const player = draft.players[seatIdx];
      ringList.push({ ringPos, seatIdx, username: player?.username || `Seat ${seatIdx}`, isBot: !!player?.isBot, isMe: seatIdx === draft.seatIdx, picked: draft.seatPicked[seatIdx] });
    }
  }

  return (
    <div className="screen-full" style={{ background: 'linear-gradient(180deg, var(--bg) 0%, var(--bg2) 100%)' }}>
      {/* TOP BAR */}
      <div className="top-bar">
        <button className="btn btn-danger" onClick={leaveRoom}>LEAVE</button>
        <h2 className="orbit-font" style={{ fontSize: 14, color: 'var(--accent)' }}>🧊 CUBE DRAFT</h2>
        <div style={{ flex: 1 }} />
        <span className="badge" style={{ background: 'rgba(179,216,249,.14)', color: '#b3d8f9', fontSize: 13, padding: '5px 14px', fontWeight: 700 }}>
          Pack {draft.round + 1}/{draft.totalRounds} · Pick {cubeDraftOverallPick(draft)}/{draft.totalPicks}
        </span>
        {draft.timerDisabled ? (
          <span className="badge" style={{ background: 'rgba(102,182,255,.08)', color: 'var(--text2)', fontSize: 12, padding: '5px 14px', fontWeight: 600 }}>
            ⏱ Untimed
          </span>
        ) : (
          <span className="badge" style={{
            background: timerWarn ? 'rgba(254,81,84,.18)' : 'rgba(102,182,255,.10)',
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
          <div style={{ background: 'rgba(249,172,32,.15)', border: '1px solid #f9ac20', padding: '8px 16px', textAlign: 'center', color: '#fad54a', fontWeight: 600 }}>
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
                background: r.isMe ? 'rgba(102,182,255,.10)' : 'transparent',
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
        <div style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
          <div className="orbit-font" style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10, textAlign: 'center', fontWeight: 600 }}>
            {draft.myPicked ? 'WAITING FOR OTHER DRAFTERS…' : 'PICK A CARD FROM THIS PACK'}
          </div>
          <div ref={packBoxRef} style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {(() => {
            const GAP = 6, COLS = 8;
            const rows = Math.max(1, Math.ceil(shownPack.length / COLS));
            const wByWidth = (packBox.w - GAP * (COLS - 1)) / COLS;
            const wByHeight = ((packBox.h - GAP * (rows - 1)) / rows) * 5 / 7;
            const cardW = Math.max(40, Math.floor(Math.min(wByWidth, wByHeight)));
            return (
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${COLS}, ${cardW}px)`,
            gridAutoRows: `${Math.round(cardW * 7 / 5)}px`,
            gap: GAP,
            visibility: packBox.w ? 'visible' : 'hidden',
          }}>
            {shownPack.map((cardName, idx) => (
              <div key={idx} style={{
                position: 'relative', cursor: canPick ? 'pointer' : 'default',
                aspectRatio: '5 / 7', minHeight: 0,
              }}
                onClick={() => {
                  if (!canPick) return;
                  // Optimistisch: Karte sofort in die eigene Sammlung (Server bestaetigt per State).
                  setPoolOrder(prev => [...prev, newPoolEntry(cardName)]);
                  setOptimisticPick(cardName);
                  if (window.playSFX) window.playSFX('draw', { dedupe: 150 });
                  socket.emit('cube_draft_pick', { roomId: lobby.id, cardName });
                }}
                onMouseEnter={() => setHoveredCard(cardName)}
                onMouseLeave={() => setHoveredCard(null)}>
                {/* Abdunkeln an der Karte selbst, NICHT am Raster: `opacity` < 1 an einem Vorfahren macht einen eigenen
                    Stapelkontext auf, und der fixe Tooltip (z-index 9999) landete dann UNTER dem Vorschau-Beschriftungsfeld
                    der rechten Spalte ("CARD PREVIEW — hover a card"). */}
                <CardMini card={window.CARDS_BY_NAME?.[cardName]} onClick={() => {}}
                  style={{ width: '100%', height: '100%', opacity: draft.myPicked ? 0.45 : 1, transition: 'opacity .25s' }} />
              </div>
            ))}
          </div>
            );
          })()}
          </div>
        </div>

        {/* RIGHT — freigehaltene Spalte in Breite des grossen Karten-Tooltips
            (rechte Leiste, siehe CardSideTooltip), damit er keine Karten ueberdeckt. */}
        <div className="cube-draft-tt-gutter" style={{ flexShrink: 0 }} />
      </div>

      {/* BOTTOM — drafted pool */}
      <div className="cube-draft-pool-bar" style={{ borderTop: '1px solid var(--bg4)', background: 'var(--bg2)', padding: '8px 12px', maxHeight: '32%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span className="orbit-font" style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, letterSpacing: 1 }}>
            DRAFTED ({poolOrder.length}/64)
          </span>
          <input className="input" placeholder="🔍 Filter by name..." value={filter} onChange={e => setFilter(e.target.value)}
            style={{ flex: 1, maxWidth: 280, fontSize: 11, padding: '4px 8px' }} />
          <span style={{ fontSize: 10, color: 'var(--text2)' }}>{filter ? `${visiblePool.length} match${visiblePool.length === 1 ? '' : 'es'}` : 'Click: gray out · Drag: reorder'}</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: 4 }}>
            {visiblePool.map(({ name, gray, id, idx }) => (
              <div key={id}
                data-pool-idx={idx}
                onPointerDown={e => { if (e.button !== 0) return; dragRef.current = { idx, startX: e.clientX, startY: e.clientY, active: false, insert: null }; }}
                onDragStart={e => e.preventDefault()}
                style={{
                  aspectRatio: '5 / 7', cursor: dragSrc != null ? 'grabbing' : 'grab',
                  userSelect: 'none', touchAction: 'none', position: 'relative',
                  boxShadow: dragInsert === idx ? '-3px 0 0 0 var(--accent)'
                    : (dragInsert === poolOrder.length && idx === poolOrder.length - 1 ? '3px 0 0 0 var(--accent)' : 'none'),
                  borderRadius: 4,
                }}>
                {/* Filter an der Karte selbst, nicht an einem Vorfahren (sonst haengt der fixe Tooltip im gefilterten Kasten). */}
                <CardMini card={window.CARDS_BY_NAME?.[name]} onClick={() => {}}
                  style={{ width: '100%', height: '100%', filter: gray ? 'grayscale(1) brightness(.5)' : 'none', opacity: dragSrc === idx ? .35 : (gray ? .6 : 1), transition: 'filter .15s, opacity .15s' }} />
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
      {dragSrc != null && dragPos && poolOrder[dragSrc] && (
        <div style={{ position: 'fixed', left: dragPos.x - 32, top: dragPos.y - 45, width: 64, height: 90, pointerEvents: 'none', zIndex: 10000, opacity: .9, transform: 'rotate(3deg)' }}>
          <CardMini noTooltip card={window.CARDS_BY_NAME?.[poolOrder[dragSrc].name]} onClick={() => {}} style={{ width: '100%', height: '100%' }} />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
//  CUBE DRAFT — DECK BUILDING SCREEN
//  Restricted deck builder for the post-draft phase. Right-side gallery
//  shows ONLY drafted cards (with copy counts) plus all non-Performance
//  Abilities at infinite quantity. Hero rule: 3 Starting Heroes (2 with
//  Zhigao), capped by what the pool offers — relaxed for players with
//  sparse hero draws. Heroes that "cannot be one of your Starting Heroes"
//  (Quetzahuitl) and any surplus Hero go into the Main Deck. All other
//  deck-building rules (Nicolas, Secret Spices, Potion Deck clauses,
//  Sacred Mirror, …) come from the normal deck editor (canAddCard /
//  isDeckLegal); only the copy limits are replaced by the drafted pool.
//  Click cards to add (auto-routed to hero / main slots), click
//  to remove. Player names the deck and clicks Ready when done.
// ═══════════════════════════════════════════
function CubeDraftBuildScreen({ lobby, build, leaveRoom, notify, user }) {
  // Eigene, gehetzte Musik fuer den Deckbau im Draft (Timer laeuft); danach wieder Menue/Kampfmusik.
  const { setBgmMode } = useContext(AppContext);
  useEffect(() => {
    if (!setBgmMode) return;
    setBgmMode('draftBuild');
    return () => setBgmMode('menu');
  }, [setBgmMode]);
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
  const basisCounts = useMemo(() => {
    const c = {};
    for (const n of (build?.pool || [])) c[n] = (c[n] || 0) + 1;
    return c;
  }, [build?.pool]);

  // Starthelden-Kandidaten: „This cannot be one of your Starting Heroes“ (Quetzahuitl) gehoert ins Main Deck.
  // Das Team fasst je Vorname nur einen Helden (Peter Röll beliebig oft) — mehr gibt der Pool nicht her.
  const isNonStartingHero = (n) => !!(window.isNonStartingHero && window.isNonStartingHero(n));
  const isStarter = (n) => cardDB[n]?.cardType === 'Hero' && !isNonStartingHero(n);
  const starterCapacity = useMemo(() => {
    const firstNames = new Set();
    let multi = 0;
    for (const n of (build?.pool || [])) {
      if (!isStarter(n)) continue;
      if (window.MULTI_TEAM_HEROES && window.MULTI_TEAM_HEROES.has(n)) multi++;
      else firstNames.add(String(n).split(',')[0].trim());
    }
    return firstNames.size + multi;
  }, [build?.pool, cardDB]);

  // Deck state — independent of pool changes (server only pushes pool once).
  const [deckName, setDeckName] = useState('');
  const [heroes, setHeroes] = useState([null, null, null]); // each: { hero, ability1, ability2 } | null
  const [mainDeck, setMainDeck] = useState([]);
  const [potionDeck, setPotionDeck] = useState([]);
  const [sideDeck, setSideDeck] = useState([]);
  const [filter, setFilter] = useState('');

  // ★ W77 — Cuberto, Supreme Lord of Edges: als Starthelden darf er bis zu 5 gedraftete Karten gegen beliebige andere tauschen (verschiedene Namen). `swaps` = [{ from, to }];
  // `swapHeroes` (Server, aus dem Skript-Kennzeichen `cubeDraftSwap`) nennt die tauschfähigen Helden im Pool mit ihrer Höchstzahl. Der EFFEKTIVE Pool = Pool − from + to.
  const [swaps, setSwaps] = useState([]);
  const [swapOffen, setSwapOffen] = useState(false);
  const [swapVon, setSwapVon] = useState(null);
  const [swapFilter, setSwapFilter] = useState('');
  const swapHeroes = build?.swapHeroes || {};
  const tauschMax = heroes.reduce((m, h) => Math.max(m, (h?.hero && swapHeroes[h.hero]) || 0), 0);
  const poolCounts = useMemo(() => {
    const c = { ...basisCounts };
    for (const sw of swaps) { c[sw.from] = (c[sw.from] || 0) - 1; c[sw.to] = (c[sw.to] || 0) + 1; }
    return c;
  }, [basisCounts, swaps]);
  // Eingetauschte Karten im Deck wieder zu ihren Ursprungskarten machen (je Tausch die erste Kopie).
  const tauschRueckgaengig = (liste) => {
    const ersetze = (arr) => { const out = [...arr]; for (const sw of liste) { const i = out.indexOf(sw.to); if (i >= 0) out[i] = sw.from; } return out; };
    setMainDeck(ersetze); setPotionDeck(ersetze); setSideDeck(ersetze);
  };
  // Cuberto ist kein Starthelden mehr: alle Tausche verfallen, die eingetauschten Karten werden wieder zu ihren Ursprungskarten.
  useEffect(() => {
    if (tauschMax > 0 || swaps.length === 0) return;
    tauschRueckgaengig(swaps);
    setSwaps([]); setSwapOffen(false); setSwapVon(null);
  }, [tauschMax]);

  // One-time bootstrap: seed deck name and auto-fill hero slots from
  // the drafted heroes (so the player isn't staring at empty slots).
  const bootstrappedRef = useRef(false);
  useEffect(() => {
    if (bootstrappedRef.current || !build?.pool) return;
    bootstrappedRef.current = true;
    setDeckName(`${user?.username || 'Drafter'}'s ${build.cubeName || 'Cube'} Draft`);
    // Vorbelegung des Teams: erst die regulaer baubaren Helden, jeweils nur wenn `canAddCard` sie zulaesst
    // (kein Quetzahuitl, kein zweiter Held gleichen Vornamens, Zhigao nur mit einem weiteren, …).
    const slots = [null, null, null];
    const probe = { heroes: slots, mainDeck: [], potionDeck: [], sideDeck: [] };
    const heroesFromPool = (build.pool || []).filter(n => cardDB[n]?.cardType === 'Hero');
    const withoutZhigao = heroesFromPool.filter(n => window.requiredHeroCount({ heroes: [{ hero: n }] }) !== 2);
    // Zhigao nur als Notnagel: hat der Pool drei andere Helden, bleibt er in Reserve.
    const ordered = withoutZhigao.length >= 3 ? withoutZhigao : [...heroesFromPool.filter(n => !withoutZhigao.includes(n)), ...withoutZhigao];
    for (const name of ordered) {
      const empty = slots.findIndex(x => !x);
      if (empty < 0) break;
      if (!window.canAddCard(probe, name, 'hero', { ignoreCopyLimit: true })) continue;
      const cd = cardDB[name];
      slots[empty] = { hero: name, ability1: cd?.startingAbility1 || null, ability2: cd?.startingAbility2 || null };
    }
    setHeroes(slots);
  }, [build?.pool]);

  // Used counts across heroes + main deck.
  const usedCounts = useMemo(() => {
    const c = {};
    for (const h of heroes) if (h?.hero) c[h.hero] = (c[h.hero] || 0) + 1;
    for (const n of mainDeck) c[n] = (c[n] || 0) + 1;
    for (const n of potionDeck) c[n] = (c[n] || 0) + 1;
    for (const n of sideDeck) c[n] = (c[n] || 0) + 1;
    return c;
  }, [heroes, mainDeck, potionDeck, sideDeck]);

  // Das Deck fuer die Deckbauregeln (dieselben wie im normalen Deck-Editor: window.canAddCard / isDeckLegal).
  const deckForRules = { heroes, mainDeck, potionDeck, sideDeck };
  // Starthelden: 3 (mit Zhigao 2), aber nie mehr, als der Pool hergibt.
  const requiredHeroes = Math.min(window.requiredHeroCount(deckForRules), starterCapacity);
  // Kopiengrenzen entfallen im Draft — der gedraftete Pool ist die Grenze (`remainingFor`).
  const RULES_OPTS = { ignoreCopyLimit: true };

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
      if (seen.has(name) || (poolCounts[name] || 0) <= 0) continue;
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
    ? availableList.filter(e => window.namePasst(e.name, filter))
    : availableList;

  // Klaenge wie im normalen Deckbauer: Hinzufuegen = draw, Entfernen = discard.
  const sfx = (n) => { if (window.playSFX) window.playSFX(n, { dedupe: 40 }); };
  const POTION_MAX = 15, SIDE_MAX = 15;

  // Alle Hinzufuegen-Wege fragen dieselbe Regelfunktion wie der normale Deck-Editor (canAddCard):
  // Nicolas / Gewuerze fuer Potions im Main Deck, Potion-Deck-Klauseln (Chaos-Diamond, Pinta, Kerthwack),
  // Zhigao-Team, Sacred Mirror (80 Karten), „cannot be one of your Starting Heroes“ (Quetzahuitl) …
  // Dazu kommt nur die Pool-Grenze (`remainingFor`).
  const addToHero = (name) => {
    if (remainingFor(name) <= 0) return false;
    if (!window.canAddCard(deckForRules, name, 'hero', RULES_OPTS)) return false;
    sfx('draw');
    setHeroes(prev => {
      const slots = [...prev];
      const empty = slots.findIndex(s => !s?.hero);
      if (empty < 0) return prev;
      const cd = cardDB[name];
      slots[empty] = { hero: name, ability1: cd?.startingAbility1 || null, ability2: cd?.startingAbility2 || null };
      return slots;
    });
    return true;
  };

  const addToMain = (name) => {
    if (remainingFor(name) <= 0) return false;
    if (!window.canAddCard(deckForRules, name, 'main', RULES_OPTS)) return false;
    sfx('draw');
    setMainDeck(prev => [...prev, name]);
    return true;
  };

  const addToPotion = (name) => {
    if (remainingFor(name) <= 0) return false;
    if (!window.canAddCard(deckForRules, name, 'potion', RULES_OPTS)) return false;
    setPotionDeck(prev => [...prev, name]);
    sfx('draw');
    return true;
  };
  const addToSide = (name) => {
    if (remainingFor(name) <= 0) return false;
    if (!window.canAddCard(deckForRules, name, 'side', RULES_OPTS)) return false;
    setSideDeck(prev => [...prev, name]);
    sfx('draw');
    return true;
  };
  const removePotion = (idx) => { sfx('discard'); setPotionDeck(prev => prev.filter((_, i) => i !== idx)); };
  const removeSide = (idx) => { sfx('discard'); setSideDeck(prev => prev.filter((_, i) => i !== idx)); };

  const removeHero = (slotIdx) => {
    sfx('discard');
    setHeroes(prev => prev.map((s, i) => i === slotIdx ? null : s));
  };

  const removeMain = (idx) => {
    sfx('discard');
    setMainDeck(prev => prev.filter((_, i) => i !== idx));
  };

  const onCardClick = (name, forceMain) => {
    const ct = cardDB[name]?.cardType;
    let ok;
    if (ct === 'Hero') {
      // Erst in ein freies Team-Feld, solange die Starthelden noch nicht komplett sind; sonst (oder mit Strg/Cmd+Klick,
      // oder wenn der Held kein Starthelden sein darf — Quetzahuitl) ins Main Deck.
      const filled = heroes.filter(h => h?.hero).length;
      ok = (!forceMain && filled < requiredHeroes && addToHero(name)) || addToMain(name);
    } else if (ct === 'Potion') {
      // Potions gehoeren ins Potion Deck; ist es voll, geht es (mit Nicolas / Gewuerz) ins Main Deck.
      ok = addToPotion(name) || addToMain(name);
    } else {
      ok = addToMain(name);
    }
    if (!ok) notify(cannotAddReason(name), 'error');
  };
  // Warum ging die Karte nirgends hinein? (Kurzfassung der haeufigsten Gruende)
  const cannotAddReason = (name) => {
    const ct = cardDB[name]?.cardType;
    if (mainDeck.length >= window.mainDeckMax(deckForRules)) return 'Main Deck is full';
    if (ct === 'Potion') return 'Potions need Nicolas (or a matching Secret Spice) for the Main Deck — or room in the Potion Deck';
    return 'Cannot add card';
  };
  // Shift+Klick → Potion Deck, Strg/Cmd+Klick → Main Deck (auch Helden), Rechtsklick → Side Deck, Klick → automatisch.
  const onCardPointer = (e, name) => {
    if (e.shiftKey) { if (!addToPotion(name)) notify('Cannot add to Potion Deck', 'error'); return; }
    if (e.ctrlKey || e.metaKey) { if (!addToMain(name)) notify(cannotAddReason(name), 'error'); return; }
    onCardClick(name);
  };

  const filledHeroes = heroes.filter(h => h?.hero).length;
  // Potion-Deck-Klausel eines Starthelden (Chaos-Diamond, Pinta, …): genaue Kartenzahl statt 0 oder 5–15.
  const potionKlauseln = window.potionClauses ? window.potionClauses({ heroes }) : [];
  const hasChaos = potionKlauseln.length > 0;
  const potionSoll = hasChaos ? window.PotionDeckClauses.requiredSize(potionKlauseln) : null;
  const potionOk = hasChaos ? potionDeck.length === potionSoll : (potionDeck.length === 0 || (potionDeck.length >= 5 && potionDeck.length <= 15));
  // Legalitaet wie im normalen Deck-Editor (isDeckLegal: Main-Deck-Groesse inkl. Sacred Mirror, Potion-Deck-Klauseln,
  // Potions im Main Deck nur mit Nicolas/Gewuerz, 15er-Potiongrenze, …) — nur die Heldenzahl richtet sich nach dem Pool.
  const legality = window.isDeckLegal(deckForRules, { heroCount: requiredHeroes });
  const deckProblems = [...legality.reasons];
  if (!deckName.trim()) deckProblems.push('Deck needs a name');
  const deckLegal = deckProblems.length === 0;

  const submitReady = () => {
    if (!deckLegal) { notify('Deck not ready: ' + deckProblems.join(', '), 'error'); return; }
    socket.emit('cube_draft_ready', {
      roomId: lobby.id,
      deck: {
        name: deckName.trim(),
        heroes,
        mainDeck,
        potionDeck,
        sideDeck,
        ...(tauschMax > 0 && swaps.length > 0 ? { cubertoSwaps: swaps } : {}),
      },
    });
  };

  if (!build) {
    return (
      <div className="screen-full">
        <div className="top-bar">
          <button className="btn btn-danger" onClick={leaveRoom}>LEAVE</button>
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
          <button className="btn btn-danger" onClick={leaveRoom}>LEAVE</button>
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
          <button className="btn btn-danger" onClick={leaveRoom}>LEAVE</button>
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
        <button className="btn btn-danger" onClick={leaveRoom}>LEAVE</button>
        <h2 className="orbit-font" style={{ fontSize: 14, color: 'var(--accent)' }}>🧊 BUILD YOUR DECK</h2>
        <span className="badge" style={{ background: 'rgba(179,216,249,.14)', color: '#b3d8f9' }}>{build.cubeName}</span>
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
        <div style={{ background: 'rgba(249,172,32,.12)', borderBottom: '1px solid #f9ac20', padding: '6px 16px', fontSize: 11, textAlign: 'center', color: '#fad54a' }}>
          🎲 You drafted no Heroes. The system assigned <strong>{build.assignedHero}</strong> to you.
        </div>
      )}
      {buildTimerMsLeft == null && build.buildTimerTotalMs === 0 && (
        <div style={{ background: 'rgba(102,182,255,.06)', borderBottom: '1px solid var(--bg4)', padding: '4px 16px', fontSize: 11, textAlign: 'center', color: 'var(--text2)' }}>
          ⏱ Deck building timer is off — the tournament starts once everyone is ready.
        </div>
      )}
      {buildTimerMsLeft != null && (() => {
        const m = Math.floor(buildTimerMsLeft / 60000);
        const s = Math.floor((buildTimerMsLeft % 60000) / 1000);
        const warn = buildTimerMsLeft <= 60_000;
        return (
          <div style={{
            background: warn ? 'rgba(254,81,84,.16)' : 'rgba(102,182,255,.10)',
            borderBottom: '1px solid ' + (warn ? '#ff6666' : 'var(--accent)'),
            padding: '6px 16px', fontSize: 12, textAlign: 'center',
            color: warn ? '#ec7f79' : 'var(--accent)',
            fontWeight: 700, letterSpacing: 1,
            animation: warn ? 'pulse 1s infinite' : undefined,
          }}>
            ⏱ {m}:{String(s).padStart(2, '0')} — non-ready decks will be auto-completed when this timer expires.
          </div>
        );
      })()}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* LEFT — Deck under construction */}
        <div style={{ flex: 1, minWidth: 0, padding: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: 10 }}>
          {/* Heroes + Potion Deck + Side Deck nebeneinander, kompakt */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexShrink: 0 }}>
            <div style={{ flexShrink: 0 }}>
              <div className="orbit-font" style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6, fontWeight: 700, letterSpacing: 1 }}>
                HEROES ({filledHeroes}/{requiredHeroes})
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 84px)', gap: 6 }}>
                {heroes.map((h, i) => (
                  <div key={i} style={{
                    aspectRatio: '5 / 7',
                    border: h?.hero ? '2px solid var(--accent)' : '2px dashed var(--bg4)',
                    borderRadius: 4, position: 'relative',
                    cursor: h?.hero ? 'pointer' : 'default',
                    opacity: i >= requiredHeroes ? .35 : 1,
                  }}
                    onClick={() => h?.hero && removeHero(i)}>
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
            </div>
          </div>

          <div className="orbit-font" style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, letterSpacing: 1 }}>
            MAIN DECK ({mainDeck.length}/60)
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', border: '1px solid var(--bg4)', borderRadius: 4, padding: 4 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: 4 }}>
              {mainDeck.map((name, i) => (
                <div key={i + '-' + name}
                  style={{ aspectRatio: '5 / 7', cursor: 'pointer' }}
                  onClick={() => removeMain(i)}
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

          {/* Potion Deck + Side Deck UNTER dem Main Deck */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexShrink: 0 }}>
            {[
              { key: 'potion', title: hasChaos ? 'POTION DECK (15 Spells)' : 'POTION DECK (0 or 5–15)', cards: potionDeck, max: POTION_MAX, remove: removePotion, ok: potionOk },
              { key: 'side', title: 'SIDE DECK', cards: sideDeck, max: SIDE_MAX, remove: removeSide, ok: true },
            ].map(sec => (
              <div key={sec.key} style={{ flex: 1, minWidth: 0 }}>
                <div className="orbit-font" style={{ fontSize: 11, color: sec.ok ? 'var(--text2)' : 'var(--danger)', marginBottom: 6, fontWeight: 700, letterSpacing: 1 }}>
                  {sec.title} ({sec.cards.length}/{sec.max})
                </div>
                <div style={{ height: 132, overflowY: 'auto', border: '1px solid var(--bg4)', borderRadius: 4, padding: 4 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(50px, 1fr))', gap: 4 }}>
                    {sec.cards.map((name, i) => (
                      <div key={i + '-' + name} style={{ aspectRatio: '5 / 7', cursor: 'pointer' }}
                        onClick={() => sec.remove(i)} title="Click to remove">
                        <CardMini card={cardDB[name]} onClick={() => {}} style={{ width: '100%', height: '100%' }} />
                      </div>
                    ))}
                    {sec.cards.length === 0 && (
                      <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 10, color: 'var(--text2)', fontSize: 10, fontStyle: 'italic' }}>
                        {sec.key === 'potion' ? 'Shift+click a card to add' : 'Right-click a card to add'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — Available cards (drafted pool + free abilities) */}
        <div style={{ width: 360, padding: 12, background: 'var(--bg2)', display: 'flex', flexDirection: 'column' }}>
          <div className="orbit-font" style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6, fontWeight: 700, letterSpacing: 1 }}>
            AVAILABLE CARDS
          </div>
          <div style={{ fontSize: 9, color: 'var(--text2)', marginBottom: 6 }}>Click: add · Shift+click: Potion Deck · Ctrl+click: Main Deck (Heroes too) · Right-click: Side Deck</div>
          <input className="input" placeholder="🔍 Filter by name..." value={filter} onChange={e => setFilter(e.target.value)}
            style={{ marginBottom: 8, fontSize: 11, padding: '4px 8px' }} />
          {Object.keys(swapHeroes).length > 0 && (
            <div style={{ border: '1px solid ' + (tauschMax > 0 ? '#b3d8f9' : 'var(--bg4)'), borderRadius: 4, padding: 6, marginBottom: 8, background: 'rgba(179,216,249,.07)' }}>
              <div className="orbit-font" style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: tauschMax > 0 ? '#b3d8f9' : 'var(--text2)', marginBottom: 4 }}>
                🧊 {Object.keys(swapHeroes)[0].split(',')[0].toUpperCase()} — SWAP {swaps.length}/{tauschMax || Math.max(...Object.values(swapHeroes))}
              </div>
              {tauschMax === 0 ? (
                <div style={{ fontSize: 10, color: 'var(--text2)' }}>Make {Object.keys(swapHeroes)[0]} one of your Starting Heroes to swap up to {Math.max(...Object.values(swapHeroes))} drafted cards for any other cards (different names).</div>
              ) : (
                <>
                  {swaps.map((sw, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, marginBottom: 2 }}>
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sw.from} → <strong>{sw.to}</strong></span>
                      <button className="btn btn-danger" style={{ padding: '0 6px', fontSize: 10 }} title="Undo this swap"
                        onClick={() => { tauschRueckgaengig([sw]); setSwaps(prev => prev.filter((_, k) => k !== i)); }}>✕</button>
                    </div>
                  ))}
                  <button className="btn" disabled={swaps.length >= tauschMax} style={{ width: '100%', fontSize: 10, padding: '3px 6px' }}
                    onClick={() => { setSwapOffen(true); setSwapVon(null); setSwapFilter(''); }}>
                    ＋ Swap a drafted card{swaps.length >= tauschMax ? ' (limit reached)' : ''}
                  </button>
                </>
              )}
            </div>
          )}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
              {visibleList.map(({ name, count, free }) => {
                const remaining = remainingFor(name);
                const dimmed = remaining <= 0;
                return (
                  <div key={name}
                    onClick={(e) => !dimmed && onCardPointer(e, name)}
                    onContextMenu={(e) => { e.preventDefault(); if (!dimmed && !addToSide(name)) notify('Side Deck is full', 'error'); }}
                    style={{
                      aspectRatio: '5 / 7',
                      cursor: dimmed ? 'not-allowed' : 'pointer',
                      position: 'relative',
                    }}>
                    {/* `filter` NICHT am Wrapper: ein Vorfahre mit `filter` wird zum Bezugsrahmen fuer `position: fixed` und
                        liess den Tooltip riesig im Kasten statt in der rechten Leiste erscheinen. Der Filter sitzt an der Karte. */}
                    <CardMini card={cardDB[name]} onClick={() => {}} style={{ width: '100%', height: '100%', filter: dimmed ? 'grayscale(.8) brightness(.6)' : 'none' }} />
                    {isNonStartingHero(name) && (
                      <div style={{
                        position: 'absolute', top: 2, left: 2, background: 'rgba(249,172,32,.9)', color: '#27180c',
                        borderRadius: 4, padding: '1px 5px', fontSize: 8, fontWeight: 800, lineHeight: 1.2, pointerEvents: 'none',
                      }} title="Cannot be a Starting Hero — play it in the Main Deck">MAIN ONLY</div>
                    )}
                    <div style={{
                      position: 'absolute', bottom: 2, right: 2,
                      background: free ? 'rgba(179,216,249,.85)' : 'rgba(0,0,0,.85)',
                      color: free ? '#00213f' : '#fff',
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

        {/* Platz fuer den grossen Karten-Tooltip (rechte Leiste), damit er keine Karten ueberdeckt */}
        <div className="cube-draft-tt-gutter" style={{ flexShrink: 0 }} />
      </div>

      {swapOffen && (() => {
        const eingetauscht = new Set(swaps.map(x => x.to));
        const istFrei = (n) => cardDB[n]?.cardType === 'Ability' && n !== 'Performance';
        // 1) Karte aus dem Pool, die wegkommt: eine UNGENUTZTE Kopie, kein Held, keine freie Ability, keine eingetauschte Karte
        const vonListe = Object.keys(poolCounts).filter(n => cardDB[n] && cardDB[n].cardType !== 'Hero' && !istFrei(n) && !eingetauscht.has(n) && remainingFor(n) > 0)
          .sort((a, b) => a.localeCompare(b));
        // 2) neue Karte: beliebig, aber kein Held/Token/freie Ability, nicht dieselbe, und die eingetauschten Karten haben verschiedene Namen
        const q = swapFilter.trim().toLowerCase();
        const zuListe = swapVon ? allCards.filter(c => c && c.name && c.name !== swapVon && c.cardType !== 'Hero' && c.cardType !== 'Token' && !istFrei(c.name) && !eingetauscht.has(c.name)
          && (!q || window.namePasst(c.name, q))).slice(0, 60) : [];
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: '#08060c', display: 'flex', flexDirection: 'column', padding: 16, gap: 10 }} data-pp-px="aus">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h3 className="orbit-font" style={{ fontSize: 14, color: '#b3d8f9', margin: 0 }}>🧊 SWAP A DRAFTED CARD</h3>
              <span style={{ fontSize: 11, color: 'var(--text2)' }}>{swapVon ? `Replace "${swapVon}" with…` : '1. Choose the drafted card that goes away'}</span>
              <div style={{ flex: 1 }} />
              {swapVon && <button className="btn" onClick={() => setSwapVon(null)}>← Back</button>}
              <button className="btn btn-danger" onClick={() => setSwapOffen(false)}>Cancel</button>
            </div>
            {swapVon && (
              <input className="input" autoFocus placeholder="🔍 Search any card by name…" value={swapFilter} onChange={e => setSwapFilter(e.target.value)} style={{ fontSize: 12, padding: '4px 8px' }} />
            )}
            <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 6, alignContent: 'start' }}>
              {!swapVon && vonListe.map(n => (
                <div key={n} style={{ aspectRatio: '5 / 7', cursor: 'pointer' }} onClick={() => { setSwapVon(n); setSwapFilter(''); }} title={n}>
                  <CardMini card={cardDB[n]} onClick={() => {}} style={{ width: '100%', height: '100%' }} />
                </div>
              ))}
              {swapVon && zuListe.map(c => (
                <div key={c.name} style={{ aspectRatio: '5 / 7', cursor: 'pointer' }} title={c.name}
                  onClick={() => { setSwaps(prev => [...prev, { from: swapVon, to: c.name }]); setSwapOffen(false); setSwapVon(null); sfx('draw'); }}>
                  <CardMini card={cardDB[c.name]} onClick={() => {}} style={{ width: '100%', height: '100%' }} />
                </div>
              ))}
              {!swapVon && vonListe.length === 0 && <div style={{ gridColumn: '1/-1', color: 'var(--text2)', fontSize: 12, fontStyle: 'italic' }}>No unused drafted cards to swap — take cards out of your deck first.</div>}
              {swapVon && zuListe.length === 0 && <div style={{ gridColumn: '1/-1', color: 'var(--text2)', fontSize: 12, fontStyle: 'italic' }}>No cards match.</div>}
            </div>
          </div>
        );
      })()}
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
          <button className="btn btn-danger" onClick={leaveRoom}>LEAVE</button>
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
        <button className="btn btn-danger" onClick={leaveRoom}>LEAVE</button>
        <h2 className="orbit-font" style={{ fontSize: 14, color: 'var(--accent)' }}>🧊 CUBE TOURNAMENT</h2>
        <span className="badge" style={{ background: 'rgba(179,216,249,.14)', color: '#b3d8f9' }}>{tournament.cubeName}</span>
        <span className="badge" style={{ background: 'rgba(255,255,255,.06)', color: 'var(--text)' }}>
          Round {tournament.currentRoundIdx + 1}/{Math.log2(tournament.bracketSize)}
        </span>
        <span className="badge" style={{ background: 'rgba(255,255,255,.06)', color: 'var(--text)' }}>
          Bo{tournament.currentRoundIdx === Math.log2(tournament.bracketSize) - 1 ? tournament.finaleBo : tournament.prelimsBo}
        </span>
        <div style={{ flex: 1 }} />
        <span className="badge" style={{ background: tournament.flow === 'simultaneous' ? 'rgba(102,182,255,.10)' : 'rgba(249,172,32,.10)', color: tournament.flow === 'simultaneous' ? 'var(--accent)' : '#f9ac20' }}>
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
      background: isWinner ? 'rgba(76,235,112,.10)' : (seat === mySeat ? 'rgba(102,182,255,.08)' : 'transparent'),
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
      {match.thirdPlace && (
        <div className="orbit-font" style={{ padding: '3px 10px', fontSize: 9, fontWeight: 700, letterSpacing: 1, color: '#ca874e', background: 'rgba(202,135,78,.12)' }}>🥉 3RD PLACE</div>
      )}
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
  const mySeat = tournament.mySeat;
  // Siegerehrung: Podest mit den ersten drei Plaetzen (bei geteiltem Platz 3 der erste Eintrag).
  const podium = [1, 2, 3].map(pl => standings.find(s => s.placement === pl) || null);
  const [stage, setStage] = useState(0);   // 0 leer · 1 Platz 3 · 2 Platz 2 · 3 Sieger · 4 Konfetti + Tabelle
  const confetti = useMemo(() => Array.from({ length: 46 }, (_, i) => ({
    left: Math.round(Math.random() * 100),
    delay: (Math.random() * 3).toFixed(2),
    dur: (3.2 + Math.random() * 2.6).toFixed(2),
    size: 6 + Math.round(Math.random() * 7),
    color: ['#fad54a', '#fe6794', '#1aedff', '#66ff71', '#c98aff', '#ffffff'][i % 6],
    rot: Math.round(Math.random() * 360),
  })), []);
  useEffect(() => {
    const play = (n, o) => { if (window.playSFX) window.playSFX(n, o); };
    const t = [
      setTimeout(() => { setStage(1); play('placement'); }, 500),
      setTimeout(() => { setStage(2); play('placement'); }, 1500),
      setTimeout(() => { setStage(3); play('victory'); }, 2700),
      setTimeout(() => setStage(4), 3600),
    ];
    return () => t.forEach(clearTimeout);
  }, []);
  const step = (place, label, height, color, medal) => {
    const e = podium[place - 1];
    const shown = stage >= (place === 3 ? 1 : place === 2 ? 2 : 3);
    if (!e) return <div key={place} style={{ width: 150 }} />;
    const me = e.seat === mySeat;
    return (
      <div key={place} className={'podium-col' + (shown ? ' podium-shown' : '')} style={{ width: 150 }}>
        <div className="podium-name" style={{ opacity: shown ? 1 : 0 }}>
          <div className={place === 1 ? 'podium-trophy' : ''} style={{ fontSize: place === 1 ? 54 : 34, lineHeight: 1.1 }}>{medal}</div>
          <div className="orbit-font" style={{ fontSize: place === 1 ? 17 : 13, fontWeight: 800, color, wordBreak: 'break-word' }}>{e.username}</div>
          {me && <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700 }}>★ YOU</div>}
        </div>
        <div className="podium-block" style={{ height, background: `linear-gradient(180deg, ${color}55, ${color}18)`, borderTop: `3px solid ${color}`, boxShadow: shown ? `0 0 22px ${color}66` : 'none' }}>
          <div className="orbit-font" style={{ fontSize: 26, fontWeight: 800, color }}>{label}</div>
        </div>
      </div>
    );
  };
  return (
    <div className="screen-full" style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(250,213,74,.16) 0%, var(--bg) 70%)', position: 'relative', overflow: 'hidden' }}>
      <div className="top-bar">
        <button className="btn" onClick={leaveRoom}>← LEAVE</button>
        <h2 className="orbit-font" style={{ fontSize: 14, color: '#fad54a' }}>🏆 TOURNAMENT COMPLETE</h2>
        <VolumeControl />
      </div>
      {stage >= 4 && (
        <div className="podium-confetti" aria-hidden="true">
          {confetti.map((c, i) => (
            <span key={i} style={{ left: c.left + '%', width: c.size, height: Math.round(c.size * 1.6), background: c.color,
              animationDelay: c.delay + 's', animationDuration: c.dur + 's', transform: `rotate(${c.rot}deg)` }} />
          ))}
        </div>
      )}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', overflow: 'auto', padding: 24 }}>
        {winner && (
          <div className="orbit-font" style={{ fontSize: 13, color: 'var(--text)', letterSpacing: 2, marginBottom: 14, opacity: stage >= 3 ? 1 : .35, transition: 'opacity .6s' }}>
            CHAMPION OF {tournament.cubeName}
          </div>
        )}
        <div className="podium-stage">
          {step(2, '2', 104, '#d2d2db', '🥈')}
          {step(1, '1', 148, '#fad54a', '🥇')}
          {step(3, '3', 72, '#be680e', '🥉')}
        </div>
        <div className="panel" style={{ width: '100%', maxWidth: 720, padding: 20, marginTop: 22, opacity: stage >= 4 ? 1 : 0, transform: stage >= 4 ? 'none' : 'translateY(16px)', transition: 'opacity .6s, transform .6s' }}>
          <div className="orbit-font" style={{ fontSize: 14, color: 'var(--accent)', marginBottom: 16, textAlign: 'center', fontWeight: 700, letterSpacing: 1 }}>
            FINAL STANDINGS
          </div>
          {standings.map((s, i) => (
            <div key={s.seat} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px',
              background: i === 0 ? 'rgba(250,213,74,.08)' : (i === 1 ? 'rgba(168,168,168,.08)' : (i === 2 ? 'rgba(190,104,14,.08)' : 'transparent')),
              borderLeft: '4px solid ' + (i === 0 ? '#fad54a' : i === 1 ? '#a8a8a8' : i === 2 ? '#be680e' : 'var(--bg4)'),
              marginBottom: 4, borderRadius: 4,
            }}>
              <div style={{ fontSize: 24, width: 40, textAlign: 'center', fontWeight: 800, color: i === 0 ? '#fad54a' : i === 1 ? '#d2d2db' : i === 2 ? '#be680e' : 'var(--text2)' }}>
                #{s.placement}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{s.username}{s.seat === mySeat ? '  ★' : ''}</div>
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
  const [gameMode, setGameMode] = useState('constructed'); // 'constructed' | 'draft' | 'skilltest'
  // Skill Test: 2–8 Sitze (Menschen + CPUs), Timer wahlweise aus.
  const [skillTestOpts, setSkillTestOpts] = useState({ prepTimerSec: 300, turnTimerSec: 90 });
  const [draftCubeId, setDraftCubeId] = useState('');
  const [draftPackTimerSec, setDraftPackTimerSec] = useState(60);
  const [draftPickTimerSec, setDraftPickTimerSec] = useState(5);
  const [draftTimerDisabled, setDraftTimerDisabled] = useState(false);
  const [draftBuildTimerSec, setDraftBuildTimerSec] = useState(300);   // Deckbau-Timer; 0 = AUS
  const [promoteName, setPromoteName] = useState(null);   // Draft-Lobby: Spieler, dessen Befoerderungs-Knopf der Host gerade offen hat
  const [draftPrelimsBo, setDraftPrelimsBo] = useState(1);
  const [draftFinaleBo, setDraftFinaleBo] = useState(3);
  const [draftFlow, setDraftFlow] = useState('simultaneous'); // 'simultaneous' | 'consecutive'
  const [draftThirdPlace, setDraftThirdPlace] = useState(false); // Spiel um Platz 3
  const [playerPw, setPlayerPw] = useState('');
  const [specPw, setSpecPw] = useState('');
  const [joinPw, setJoinPw] = useState('');
  const [joinTarget, setJoinTarget] = useState(null);
  const [lobby, setLobby] = useState(null);
  const [playerJoined, setPlayerJoined] = useState(null);
  const roomMemberCountRef = useRef({ id: null, n: 0 });
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
    // Ergebnis zuerst: sobald es steht, laeuft das Sieg- bzw.
    // Niederlage-Thema, egal welcher Spielmodus dahintersteckt.
    else if (gameState.result && typeof gameState.result.winnerIdx === 'number') {
      setBgmMode(gameState.result.winnerIdx === gameState.myIndex ? 'win' : 'defeat');
    }
    else if (gameState.isPuzzle) setBgmMode('puzzleAttempt');
    else if (gameState.isTutorial) setBgmMode('tutorial');
    // Gegnerspezifisches Thema, wenn der Server eines gemeldet hat
    // (nur CPU-Kämpfe; PvP behält das generische Kampfthema).
    else {
      // Diagnose: einmal je Kampf melden, was im Zustand ankommt. Fehlt
      // `cpuBgm` ganz, liegt es an der Server-Seite (oder an einem alten
      // Serverprozess); ist es gesetzt und die Musik stimmt trotzdem
      // nicht, liegt es am Musik-Manager darunter.
      // CPU-Kampf: Thema der CPU. PvP: der gewählte Track des Gegners
      // (`oppBgm`, Profil → Battle Music). Sonst der Standard.
      // Skill Test (`bgmSet`): zufaellig eine von mehreren Kampfmusiken, je Partie stabil (BGM_SETS).
      const bgmSlug = bgmSetPick(gameState.bgmSet, (gameState.roomId || '') + ':' + ((gameState.setScore || [0, 0]).reduce((a, b) => a + b, 0)))
        || gameState.cpuBgm || gameState.oppBgm;
      const mode = bgmSlug ? 'battle:' + bgmSlug : 'battle';
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
    const onRoomJoined = (r) => { roomMemberCountRef.current = { id: r?.id, n: (r?.players?.length || 0) + (r?.spectators?.length || 0) }; setLobby(r); };
    const onRoomUpdate = (r) => {
      // Akustisches Feedback, wenn jemand einem Draft-Raum beitritt (Spieler oder Zuschauer).
      const n = (r?.players?.length || 0) + (r?.spectators?.length || 0);
      if (r?.cubeDraft && roomMemberCountRef.current.id === r.id && n > roomMemberCountRef.current.n && window.playSFX) {
        window.playSFX('ping', { dedupe: 300 });
      }
      roomMemberCountRef.current = { id: r?.id, n };
      setLobby(prev => prev ? r : null);
    };
    const onRoomClosed = () => { setLobby(null); setGameState(null); setCubeDraftState(null); notify('Room was closed by host', 'error'); };
    const onJoinError = (msg) => notify(msg, 'error');
    const onPlayerJoined = (data) => setPlayerJoined(data.username);
    // Ein Cube-Match (Kindraum) darf den Turnierraum nicht als `lobby` ablösen — sonst fällt
    // der Spieler nach dem Match in eine tote Lobby statt zurück ins Bracket.
    const onGameStarted = (r) => { setLobby(prev => (prev?.cubeDraft && prev.id !== r?.id) ? prev : r); if (window.playSFX) window.playSFX('match_found'); };
    const onGameState = (state) => { if (window.ppZustandVeraltet?.(state)) return; setGameState(state); };
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
    if (gameMode === 'skilltest') {
      socket.emit('create_room', {
        type: gameType, format: 1,
        playerPw: playerPw || null, specPw: specPw || null,
        skillTest: { ...skillTestOpts },
      });
      setCreating(false);
      setPlayerPw(''); setSpecPw('');
      return;
    }
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
          buildTimerSec: Math.max(0, Math.min(3600, Number.isFinite(parseInt(draftBuildTimerSec, 10)) ? parseInt(draftBuildTimerSec, 10) : 300)),
          prelimsBo: draftPrelimsBo,
          finaleBo: draftFinaleBo,
          flow: draftFlow,
          thirdPlace: draftThirdPlace,
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
    // Skill Test und Cube Draft brauchen kein eigenes Deck (der Server ignoriert `deckId` dort).
    if (!asSpectator && !room.skillTest && !room.cubeDraft) {
      if (!currentDeckObj) { notify('Select a deck first', 'error'); return; }
      const v = isDeckLegal(currentDeckObj);
      if (!v.legal) { notify('Deck not legal: ' + v.reasons.join(', '), 'error'); return; }
    }
    if (!asSpectator && room.hasPlayerPw && !pw) { setJoinTarget({ room, asSpectator: false }); return; }
    if (asSpectator && room.hasSpecPw && !pw) { setJoinTarget({ room, asSpectator: true }); return; }
    socket.emit('join_room', { roomId: room.id, password: pw || '', asSpectator, deckId: selectedDeck });
    setJoinTarget(null); setJoinPw('');
  };

  // ── Raum-Einladung angenommen (JOIN im Einladungsfenster des Hauptmenüs, app-social.jsx) ──
  // Das Fenster erscheint nur im Hauptmenü und wechselt hierher; es hinterlässt `window._ppPendingInvite`.
  // Das Raum-Passwort ersetzt die Einladung serverseitig. Ein normales Spiel braucht ein bekanntes Deck:
  // ist die Deckliste noch nicht geladen, läuft der Effekt nach ihrem Eintreffen erneut.
  useEffect(() => {
    const inv = window._ppPendingInvite;
    if (!inv) return;
    if (inv.kind === 'game' && !currentDeckObj) return;
    window._ppPendingInvite = null;
    joinRoom({ id: inv.roomId, hasPlayerPw: false, skillTest: inv.kind === 'skilltest' ? {} : null, cubeDraft: inv.kind === 'draft' ? {} : null }, false);
  }, [currentDeckObj]);

  // ── Zuschauen aus der Who's-Online-Liste (Hauptmenü): `window._ppPendingSpectate` = { roomId, hasSpecPw, name } ──
  // Das Hauptmenü wechselt hierher und hinterlässt die Angabe; der Beitritt als Zuschauer läuft wie über die Raumliste
  // (Zuschauer-Passwort wird bei Bedarf abgefragt).
  useEffect(() => {
    const sp = window._ppPendingSpectate;
    if (!sp) return;
    window._ppPendingSpectate = null;
    joinRoom({ id: sp.roomId, hasSpecPw: sp.hasSpecPw }, true);
  }, []);
  const spectateFromList = (info) => joinRoom({ id: info.roomId, hasSpecPw: info.hasSpecPw }, true);

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
  // ★ v1263 (Als Befund 21.9., Rematch im Online-PvP: „can't access
  // property deckSkins, opp is undefined"): Beim Rematch kommt fuer einen
  // Moment ein Spielzustand mit nur EINEM Spieler an (der Raum wird neu
  // aufgesetzt, die zweite Seite haengt noch nicht drin). GameBoard
  // greift in seinen Hooks fest auf beide Spieler zu — es darf erst
  // rendern, wenn beide da sind; solange bleibt die Lobby stehen.
  const spielbereit = !!(gameState && Array.isArray(gameState.players)
    && gameState.players.length >= 2 && gameState.players[0] && gameState.players[1]);
  if (gameState && spielbereit) {
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

  // === SKILL TEST LOBBY ===
  if (lobby && lobby.skillTest && lobby.skillTest.phase === 'lobby') {
    return <SkillTestLobby lobby={lobby} user={user} leaveRoom={leaveRoom} playerJoined={playerJoined} setPlayerJoined={setPlayerJoined} />;
  }

  // === SKILL TEST — VORBEREITUNG (Basis, Recycler, Ready) ===
  if (lobby && lobby.skillTest && lobby.skillTest.phase === 'prep') {
    return <SkillTestPrepScreen lobby={lobby} user={user} leaveRoom={leaveRoom} notify={notify} />;
  }

  if (lobby && lobby.skillTest && lobby.skillTest.phase === 'battle') {
    return <SkillTestBattlePending lobby={lobby} leaveRoom={leaveRoom} />;
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
    // Vom Host beförderte Spieler (Co-Hosts) duerfen ebenfalls Leute einladen.
    const isCohost = !isHost && seats.some(s => s && s.username === user.username && s.isCohost);
    return (
      <div className="screen-full">
        <div className="top-bar">
          <button className="btn btn-danger" onClick={leaveRoom}>
            {isHost ? 'CLOSE ROOM' : 'LEAVE'}
          </button>
          <h2 className="orbit-font" style={{ fontSize: 14, color: 'var(--accent)' }}>🧊 CUBE DRAFT LOBBY</h2>
          <span className="badge" style={{ background: 'rgba(179,216,249,.14)', color: '#b3d8f9' }}>
            {lobby.cubeDraft.cubeName}
          </span>
          <span className="badge" style={{ background: lobby.type === 'ranked' ? 'rgba(249,172,32,.12)' : 'rgba(102,182,255,.12)', color: lobby.type === 'ranked' ? 'var(--accent4)' : 'var(--accent)' }}>
            {lobby.type.toUpperCase()}
          </span>
          <VolumeControl />
        </div>
        <div className="lobby-raum lobby-content animate-in" style={{ '--lobby-w': '720px' }}>
          {/* Wer ist online? Der Raumbesitzer lädt hier per Klick → Invite ein (app-social.jsx) */}
          {user && !user.isGuest && <SocialSidePanel meId={user.id} room={lobby} isHost={isHost || isCohost} />}
          <div className="lobby-raum-mitte">
          <div className="panel" style={{ width: 720, maxWidth: '92%' }}>
            <div className="orbit-font" style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, textAlign: 'center' }}>
              {canStart ? (isHost ? '⚔️ Ready to draft — start when you like.' : '⏳ Waiting for host to start...') : '⏳ Waiting for at least one challenger...'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
              {Array.from({ length: 8 }).map((_, i) => {
                const seat = seats[i] || null;
                const occupied = !!seat;
                // Der Host kann Mitspieler per Klick befördern (Co-Host: darf ebenfalls einladen) bzw. wieder abstufen.
                const promotable = isHost && occupied && !seat.isHost && !seat.isBot;
                const promoteOpen = promotable && promoteName === seat.username;
                return (
                  <div key={i}
                    onClick={promotable ? () => setPromoteName(promoteOpen ? null : seat.username) : undefined}
                    title={promotable ? 'Click to promote — promoted players can invite others' : undefined}
                    style={{
                    border: '2px solid ' + (occupied ? (seat.isHost ? 'var(--accent)' : (seat.isCohost ? 'var(--accent4)' : 'var(--accent2)')) : 'var(--bg4)'),
                    borderStyle: occupied ? 'solid' : 'dashed',
                    borderRadius: 8,
                    padding: '12px 8px',
                    background: occupied ? 'rgba(102,182,255,.04)' : 'transparent',
                    textAlign: 'center',
                    opacity: occupied ? 1 : .5,
                    cursor: promotable ? 'pointer' : 'default',
                  }}>
                    <div style={{ fontSize: 22, marginBottom: 6 }}>
                      {occupied ? (seat.isHost ? '👑' : (seat.isCohost ? '⭐' : (seat.isBot ? '🤖' : '⚔️'))) : `${i + 1}`}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 12, color: occupied ? (seat.isHost ? 'var(--accent)' : 'var(--accent2)') : 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {occupied ? seat.username : 'Open Seat'}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text2)', marginTop: 2 }}>
                      {occupied ? (seat.isHost ? 'HOST' : seat.isBot ? 'BOT' : seat.isCohost ? 'CO-HOST' : 'PLAYER') : ' '}
                    </div>
                    {promoteOpen && (
                      <button className="btn" style={{ fontSize: 10, padding: '3px 8px', marginTop: 8 }}
                        onClick={(e) => { e.stopPropagation(); socket.emit('cube_promote_player', { roomId: lobby.id, username: seat.username, promote: !seat.isCohost }); setPromoteName(null); }}>
                        {seat.isCohost ? '⬇ DEMOTE' : '⭐ PROMOTE'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {isHost && filledSeats > 1 && (
              <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 12, textAlign: 'center' }}>
                Click a player to promote them to ⭐ co-host — promoted players can invite others too.
              </div>
            )}

            <div style={{ background: 'var(--bg2)', borderRadius: 4, padding: '8px 12px', marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11, color: 'var(--text2)' }}>
              {lobby.cubeDraft.timerDisabled ? (
                <div style={{ gridColumn: '1/3' }}>⏱ Draft timer: <strong style={{ color: 'var(--accent)' }}>Disabled</strong> — drafters take as long as they want.</div>
              ) : (
                <>
                  <div>⏱ Time per Pack: <strong style={{ color: 'var(--text)' }}>{lobby.cubeDraft.packTimerSec}s</strong></div>
                  <div>➕ Bonus per Pick: <strong style={{ color: 'var(--text)' }}>{lobby.cubeDraft.pickTimerSec}s</strong></div>
                </>
              )}
              <div style={{ gridColumn: '1/3' }}>🛠 Deck building timer: <strong style={{ color: lobby.cubeDraft.buildTimerSec === 0 ? 'var(--accent)' : 'var(--text)' }}>{lobby.cubeDraft.buildTimerSec === 0 ? 'Off' : (Math.floor(lobby.cubeDraft.buildTimerSec / 60) + ':' + String(lobby.cubeDraft.buildTimerSec % 60).padStart(2, '0'))}</strong>{lobby.cubeDraft.buildTimerSec === 0 ? ' — no limit.' : ' after the first drafter is ready.'}</div>
              <div>🎮 Prelims: <strong style={{ color: 'var(--text)' }}>Bo{lobby.cubeDraft.prelimsBo}</strong></div>
              <div>🏆 Finale: <strong style={{ color: 'var(--text)' }}>Bo{lobby.cubeDraft.finaleBo}</strong></div>
              <div>🥉 Third-place match: <strong style={{ color: 'var(--text)' }}>{lobby.cubeDraft.thirdPlace ? 'Yes' : 'No'}</strong></div>
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
          <button className="btn btn-danger" onClick={leaveRoom}>
            {isHost ? 'CLOSE ROOM' : 'LEAVE'}
          </button>
          <h2 className="orbit-font" style={{ fontSize: 22, fontWeight: 800, color: 'var(--player-color)' }}>GAME LOBBY</h2>
          <span className="badge" style={{ background: lobby.type === 'ranked' ? 'rgba(249,172,32,.12)' : 'rgba(102,182,255,.12)', color: lobby.type === 'ranked' ? 'var(--accent4)' : 'var(--accent)' }}>
            {lobby.type.toUpperCase()}
          </span>
          <VolumeControl />
        </div>
        <div className="lobby-raum lobby-content animate-in" style={{ '--lobby-w': '420px' }}>
          {user && !user.isGuest && <SocialSidePanel meId={user.id} room={lobby} isHost={isHost} />}
          <div className="lobby-raum-mitte">
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
        <button className="btn" onClick={() => setScreen('menu')}>← BACK</button>
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
              } catch (err) { notify('Could not save your default deck: ' + (err?.message || 'unknown error'), 'error'); }
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
        {/* Who's Online + Chats + Herausforderungen — dasselbe Interface wie im Hauptmenü (app-social.jsx) */}
        {user && !user.isGuest && <SocialSidePanel meId={user.id} onSpectate={spectateFromList} />}

        {/* Open Games */}
        <div className="lobby-spalte ornate-frame pp-menuekasten" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="orbit-font lobby-spalten-titel" style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
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
                      {isDraft && <span style={{ color: '#b3d8f9', marginRight: 4 }}>🧊</span>}
                      {r.host}
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {isDraft && <span className="badge" style={{ background: 'rgba(179,216,249,.14)', color: '#b3d8f9', fontSize: 11, fontWeight: 800, padding: '3px 10px', border: '1px solid rgba(179,216,249,.3)', letterSpacing: 1 }}>CUBE DRAFT</span>}
                      {r.skillTest && <span className="badge" style={{ background: 'rgba(255,208,102,.14)', color: '#ffd066', fontSize: 11, fontWeight: 800, padding: '3px 10px', border: '1px solid rgba(255,208,102,.3)', letterSpacing: 1 }}>🎯 SKILL TEST</span>}
                      {!isDraft && !r.skillTest && r.format > 1 && <span className="badge" style={{ background: 'rgba(255,255,255,.1)', color: '#fff', fontSize: 12, fontWeight: 800, padding: '3px 10px', border: '1px solid rgba(255,255,255,.2)', letterSpacing: 1 }}>Bo{r.format}</span>}
                      <span className="badge" style={{ background: r.type === 'ranked' ? 'rgba(249,172,32,.18)' : 'rgba(102,182,255,.15)', color: r.type === 'ranked' ? '#ffb91a' : '#1aedff', fontSize: 11, fontWeight: 800, padding: '3px 10px', border: r.type === 'ranked' ? '1px solid rgba(249,172,32,.35)' : '1px solid rgba(102,182,255,.3)', textTransform: 'uppercase', letterSpacing: 1 }}>
                        {r.type}
                      </span>
                      {!isDraft && !r.skillTest && r.format <= 1 && <span className="badge" style={{ background: 'rgba(255,255,255,.06)', color: 'var(--text2)', fontSize: 11, padding: '3px 10px' }}>Bo1</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 2 }}>
                    {r.hasPlayerPw ? '🔒 Password' : '🔓 Open'} · {r.playerCount}/{cap} players
                    {isDraft && r.cubeDraft && <span style={{ marginLeft: 8 }}>· Cube: <span style={{ color: '#b3d8f9' }}>{r.cubeDraft.cubeName}</span> · Bo{r.cubeDraft.prelimsBo} prelims / Bo{r.cubeDraft.finaleBo} finale</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* In Progress */}
        <div className="lobby-spalte ornate-frame pp-menuekasten" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="orbit-font lobby-spalten-titel" style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: 'var(--player-color)' }}>
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
                    <span className="badge" style={{ background: 'rgba(251,30,169,.12)', color: 'var(--accent2)' }}>LIVE</span>
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
        <div className="lobby-spalte ornate-frame pp-menuekasten" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="orbit-font lobby-spalten-titel" style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: 'var(--accent4)' }}>
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
                tier === 'gold'   ? '#fad54a' :
                tier === 'silver' ? '#d2d2db' :
                tier === 'bronze' ? '#be680e' :
                p.color || '#66b6ff';
              const crown = tier === 'gold' ? '👑' : tier === 'silver' ? '🥈' : tier === 'bronze' ? '🥉' : null;
              return (
                // v1289: Klick/Enter oeffnet das Spielerprofil (app-player-profile.jsx).
                <div key={p.username} {...playerProfileTriggerProps(p)}
                  className={'leaderboard-row ppf-trigger leaderboard-row-' + (tier || 'normal')}>
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
                  <button className={'btn' + (gameMode === 'skilltest' ? ' glow-border' : '')} onClick={() => setGameMode('skilltest')} style={{ flex: 1 }}
                    title="2–8 players: build a base from random cards, then act turn by turn">
                    🎯 SKILL TEST
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
              {gameMode === 'skilltest' && <SkillTestCreateOptions opts={skillTestOpts} setOpts={setSkillTestOpts} ranked={gameType === 'ranked'} />}
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
                      <div style={{ fontSize: 11, color: 'var(--danger)', padding: '6px 8px', border: '1px solid var(--danger)', borderRadius: 4, background: 'rgba(254,81,84,.06)' }}>
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
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4, whiteSpace: 'nowrap' }}>Deck Build (s) · 0 = OFF</div>
                      <input className="input" type="number" min={0} max={3600} value={draftBuildTimerSec}
                        onChange={e => setDraftBuildTimerSec(e.target.value)}
                        title="Deck building time limit, starting when the first drafter clicks Ready. Undone decks are auto-completed when it runs out. 0 = no limit." />
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
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Third-place match</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className={'btn' + (!draftThirdPlace ? ' btn-format-active' : '')} onClick={() => setDraftThirdPlace(false)} style={{ flex: 1 }}>NO</button>
                      <button className={'btn' + (draftThirdPlace ? ' btn-format-active' : '')} onClick={() => setDraftThirdPlace(true)} style={{ flex: 1 }}
                        title="The two semifinal losers play a match for 3rd place alongside the final.">YES</button>
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
//
// HINWEIS (11.8.): `bgm_login` und `bgm_menu` lagen als UNKOMPRIMIERTE
// WAVs vor (8,1 und 7,5 MB) — ausgerechnet die beiden Stücke, die jeder
// Besucher als Erstes lädt. Als OGG sind es 1,0 und 1,1 MB. Der Rest
// des Soundtracks war längst OGG.
const BGM_FILES = {
  login:  '/music/bgm_login.ogg',
  menu:   '/music/bgm_menu.ogg',
  battle: '/music/bgm_battle.mp3',
  // `puzzle` ist seit 3.8. UNBENUTZT: Puzzles haben zwei eigene Stuecke
  // (Editor / Durchspielen) und das Tutorial sein eigenes. Der Eintrag
  // bleibt als Rueckfallebene stehen, falls irgendwo noch 'puzzle'
  // gesetzt wird — dann klingt es wenigstens nach etwas.
  puzzle: '/music/bgm_puzzle.mp3',
  tutorial: '/music/bgm_tutorial.ogg',
  // Dunklere Fassung des Tutorial-Themes; laeuft, solange Antonia auf
  // der Tutorial-Buehne steht.
  tutorialAntonia: '/music/bgm_tutorial_antonia.ogg',
  puzzleCreate:  '/music/bgm_puzzle_erstellen.ogg',
  puzzleAttempt: '/music/bgm_puzzle_probieren.ogg',
  // Ergebnis-Themen: laufen loopend im End-of-Battle-Screen, solange das
  // Ergebnis steht. `win` dient bei Puzzle-/Tutorial-Siegen zugleich als
  // Fanfare — dort ersetzt es den kurzen victory-SFX, statt zusaetzlich
  // zu ihm zu spielen.
  win:    '/music/bgm_win.ogg',
  defeat: '/music/bgm_defeat.ogg',
  shop:   '/music/bgm_shop.ogg',
  // Kampagne: eigenes Element, dessen `src` die Story umschaltet
  // (Ziel-Bezeichner `campaign:<slug>` -> /music/bgm_<slug>.ogg).
  // Es MUSS hier stehen und nicht spaeter erzeugt werden, damit der
  // Entsperr-Durchlauf beim ersten Klick es mit erfasst — sonst lehnt
  // Chromium die Wiedergabe ab.
  campaign: '/music/bgm_menu.ogg',
  // Deck-Editor (v843): laeuft, solange der DeckBuilder eingehaengt ist
  // (Effekt dort, nach dem Muster des Shops). Die Endung der bereit-
  // gelegten Datei war beim Einbau nicht bekannt — deshalb eine LISTE
  // von Kandidaten: der erste wird geladen, bei Ladefehler (404/Decode)
  // rueckt der naechste nach (siehe `_bgmEndungsKaskade`). Sobald die
  // Endung feststeht, kann die Liste auf einen String schrumpfen.
  deckEditor: ['/music/bgm_deckeditor.ogg', '/music/bgm_deckeditor.mp3', '/music/bgm_deckeditor.wav'],
  // Draft-Modus: laeuft, solange das Cube-Draften laeuft (CubeDraftScreen). Ein melodischer
  // Hintergrund-Track (~3,5 Min) um ein zentrales Thema — siehe scripts/music/draft.py.
  draft: '/music/bgm_draft.ogg',
  // Deckbau im Draft (5-Minuten-Timer): erinnert an den normalen Deck-Editor, aber gehetzt —
  // siehe scripts/music/draftbuild.py.
  draftBuild: '/music/bgm_draftbuild.ogg',
};
// Endungs-Kaskade: probiert die restlichen Kandidaten der Reihe nach
// durch, bis einer laedt. Nach dem letzten wird der Handler geloescht,
// damit ein spaeterer Decode-Fehler nicht in eine Endlosschleife laeuft.
// Der `src`-Tausch am BESTEHENDEN Element ist bewusst — ein neues
// Element waere nach der Entsperr-Geste nicht mehr entsperrt (siehe
// Battle-Themes unten).
function _bgmEndungsKaskade(el, rest) {
  if (!rest.length) { el.onerror = null; return; }
  el.onerror = () => {
    const next = rest.shift();
    _bgmEndungsKaskade(el, rest);
    el.src = next;
    try { el.load(); } catch {}
  };
}
// ═══ GAPLESS-LOOPER (v1257, Als Befund 19.9.) ═══════════════════════
// „Die Musik loopt nicht richtig — bei jedem Loop ist eine merkliche
// kleine Pause." Ursache ist die Abspieltechnik, nicht die Dateien:
// HTMLAudioElement mit `loop = true` loopt in Browsern grundsaetzlich
// NICHT luecken­los (bei MP3 kommt Encoder-Padding dazu), auf Mobile
// noch auffaelliger. Sample-genau loopt nur Web Audio: der Track wird
// als AudioBuffer dekodiert und von einem AudioBufferSourceNode mit
// `loop = true` gespielt — der Uebergang Ende→Anfang ist dann exakt
// ein Sample lang.
//
// BAUFORM: eine FASSADE, die die Teilmenge der Element-API nachbildet,
// die MusicManager, Ducking, Lautstaerkeregler, Battle-Theme-Resolver
// und Endungs-Kaskade tatsaechlich benutzen (play/pause/paused/volume/
// currentTime/src/load/onerror/loop/preload). Dadurch bleibt der GANZE
// bestehende Abspielcode unangetastet — nur `_mkBgm` liefert statt
// eines <audio>-Elements diese Klasse. Ohne AudioContext (uralte
// Browser) faellt `_mkBgm` aufs Element zurueck, Verhalten wie bisher.
//
// NEBENGEWINNE:
//   • Lautstaerke laeuft ueber einen GainNode — funktioniert damit auch
//     auf iOS (Safari ignoriert `audio.volume`; offener Punkt vom 9.9.).
//   • KEIN `preload='auto'` mehr: vorher luden 13 Audio-Elemente beim
//     Seitenaufruf; jetzt wird ein Track erst bei seinem ersten play()
//     geholt und dekodiert (Bandbreite! Render-Limit!). Die ~0,2-0,8 s
//     bis zum ersten Ton verdeckt die ohnehin laufende Einblendung.
//
// SPEICHER: dekodiertes PCM ist gross (~350 kB je Sekunde Stereo).
// Deshalb behaelt jede Instanz nur IHREN aktuellen Buffer, und beim
// Start eines Tracks werden die Buffer aller PAUSIERTEN Geschwister
// freigegeben (die URL bleibt; ein spaeterer play() holt die Datei aus
// dem HTTP-Cache und dekodiert neu). Es leben also hoechstens die zwei,
// drei Buffer einer laufenden Ueberblendung gleichzeitig.
let _bgmEigenerCtx = null;
function _bgmCtxHolen() {
  // Bevorzugt den SFX-Kontext aus app-shared (window-API, dort
  // freigegeben) — Browser deckeln die Zahl der AudioContexte je Seite.
  try {
    if (typeof window._ppSfxCtxHolen === 'function') {
      const c = window._ppSfxCtxHolen();
      if (c) return c;
    }
  } catch {}
  if (_bgmEigenerCtx) return _bgmEigenerCtx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try { _bgmEigenerCtx = new AC(); } catch { return null; }
  return _bgmEigenerCtx;
}
class GaplessBgm {
  constructor(url) {
    this._url = url || '';
    this.loop = true;
    this.preload = 'none';   // rein dekorativ — geladen wird bei play()/load()
    this.onerror = null;
    this._vol = 0.4;
    this._gain = null;
    this._buf = null;        // dekodierter AudioBuffer der AKTUELLEN src
    this._bufUrl = null;     // fuer welche URL _buf/_loadP gelten
    this._loadP = null;      // laufender Fetch+Decode
    this._node = null;       // spielender AudioBufferSourceNode
    this._nodeBuf = null;    // welcher Buffer gerade im Node liegt
    this._paused = true;
    this._offset = 0;        // Abspielposition in Sekunden (bei Pause eingefroren)
    this._startedAt = 0;     // ctx.currentTime des letzten Starts
    this._seq = 0;           // Ueberhol-Riegel fuer play()/pause()-Ketten
    GaplessBgm._alle.push(this);
  }
  get src() { return this._url; }
  set src(u) {
    if (u === this._url) return;
    this._url = u;
    // Wie beim Element: src-Wechsel stoppt die Wiedergabe; der Aufrufer
    // ruft danach load()/play() (Battle-Resolver, Endungs-Kaskade).
    this._seq++;
    this._stopNode();
    this._buf = null; this._bufUrl = null; this._loadP = null;
    this._offset = 0;
    this._paused = true;
  }
  get paused() { return this._paused; }
  get volume() { return this._vol; }
  set volume(v) {
    this._vol = Math.max(0, Math.min(1, Number(v) || 0));
    if (this._gain) this._gain.gain.value = this._vol;
  }
  get currentTime() {
    if (this._paused || !this._node) return this._offset;
    const c = _bgmCtxHolen();
    if (!c || !this._nodeBuf) return this._offset;
    let t = this._offset + (c.currentTime - this._startedAt);
    const d = this._nodeBuf.duration;
    if (this.loop && d > 0) t = t % d;
    return t;
  }
  set currentTime(t) {
    this._offset = Math.max(0, Number(t) || 0);
    if (!this._paused && this._buf) this._startNode(this._buf);
  }
  // EIN ctx.resume() entsperrt Web Audio komplett — der Entsperr-
  // Durchlauf des MusicManagers ruft das statt play()+pause() je
  // Element (das wuerde 13 Fetch+Decodes anstossen).
  unlock() {
    const c = _bgmCtxHolen();
    if (c && c.state === 'suspended') { try { c.resume(); } catch {} }
  }
  load() {
    const url = this._url;
    this._ensureBuffer().then((buf) => {
      // Traegt eine Abspiel-Absicht (play() lief schon, Datei kam erst
      // jetzt — z.B. nach einem Kaskaden-src-Wechsel), dann jetzt starten.
      if (!this._paused && this._bufUrl === url && buf) this._startNode(buf);
    }).catch(() => {});
  }
  play() {
    this._paused = false;
    const seq = ++this._seq;
    const c = _bgmCtxHolen();
    if (!c) return Promise.reject(new Error('AudioContext fehlt'));
    let resume = null;
    if (c.state === 'suspended') { try { resume = c.resume(); } catch {} }
    return Promise.resolve(resume).then(() => this._ensureBuffer()).then((buf) => {
      if (seq !== this._seq || this._paused || !buf) return;
      this._startNode(buf);
    });
  }
  pause() {
    if (!this._paused) this._offset = this.currentTime;
    this._paused = true;
    this._seq++;
    this._stopNode();
  }
  _ensureBuffer() {
    const url = this._url;
    if (this._bufUrl === url) {
      if (this._buf) return Promise.resolve(this._buf);
      if (this._loadP) return this._loadP;
    }
    this._bufUrl = url;
    this._buf = null;
    const p = fetch(url)
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
      .then((ab) => {
        const c = _bgmCtxHolen();
        if (!c) throw new Error('AudioContext fehlt');
        // Callback-Form fuer alte WebKit-Signaturen mit abgedeckt.
        return new Promise((res, rej) => {
          const d = c.decodeAudioData(ab, res, rej);
          if (d && d.then) d.then(res, rej);
        });
      })
      .then((buf) => {
        if (this._bufUrl !== url) return null;   // src hat gewechselt
        this._buf = buf; this._loadP = null;
        return buf;
      })
      .catch((err) => {
        if (this._bufUrl === url) {
          this._loadP = null;
          // Asynchron wie beim Element — die Aufrufer (Endungs-Kaskade,
          // Battle-Fallback) haengen daran ihren naechsten Kandidaten.
          const h = this.onerror;
          if (h) setTimeout(() => { try { h(); } catch {} }, 0);
        }
        throw err;
      });
    this._loadP = p;
    return p;
  }
  _startNode(buf) {
    const c = _bgmCtxHolen();
    if (!c) return;
    // Laeuft dieser Buffer schon? Dann nicht neu anwerfen (play() und
    // load() koennen sich ueberschneiden) — ausser der Aufrufer hat per
    // currentTime-Setter neu positioniert, dann kam er ueber _stopNode.
    if (this._node && this._nodeBuf === buf) return;
    this._stopNode();
    if (!this._gain) { this._gain = c.createGain(); this._gain.connect(c.destination); }
    this._gain.gain.value = this._vol;
    const s = c.createBufferSource();
    s.buffer = buf;
    s.loop = !!this.loop;
    s.connect(this._gain);
    const off = buf.duration > 0 ? (this._offset % buf.duration) : 0;
    try { s.start(0, off); } catch { return; }
    this._offset = off;
    this._startedAt = c.currentTime;
    this._node = s;
    this._nodeBuf = buf;
    if (!s.loop) {
      s.onended = () => {
        if (this._node === s) { this._node = null; this._nodeBuf = null; this._paused = true; this._offset = 0; }
      };
    }
    // Speicherdeckel: pausierten Geschwistern den dekodierten Buffer
    // nehmen — die URL bleibt, der naechste play() laedt neu (HTTP-Cache).
    for (const g of GaplessBgm._alle) {
      if (g !== this && g._paused && g._buf) { g._buf = null; g._loadP = null; }
    }
  }
  _stopNode() {
    const s = this._node;
    this._node = null; this._nodeBuf = null;
    if (s) {
      try { s.onended = null; } catch {}
      try { s.stop(); } catch {}
      try { s.disconnect(); } catch {}
    }
  }
}
GaplessBgm._alle = [];

const _mkBgm = (url) => {
  if (typeof Audio === 'undefined' && !(window.AudioContext || window.webkitAudioContext)) return null;
  const kandidaten = Array.isArray(url) ? url.slice() : [url];
  // ★ v1257: Web Audio, wenn verfuegbar — sample-genauer Loop (s.o.).
  // Fallback bleibt das alte <audio>-Element mit identischem Verhalten.
  const el = (window.AudioContext || window.webkitAudioContext)
    ? new GaplessBgm(kandidaten.shift())
    : new Audio(kandidaten.shift());
  if (kandidaten.length) _bgmEndungsKaskade(el, kandidaten);
  return el;
};
const _bgmLogin = _mkBgm(BGM_FILES.login);
const _bgmMenu = _mkBgm(BGM_FILES.menu);
const _bgmBattle = _mkBgm(BGM_FILES.battle);
const _bgmPuzzle = _mkBgm(BGM_FILES.puzzle);
const _bgmTutorial = _mkBgm(BGM_FILES.tutorial);
const _bgmTutorialAntonia = _mkBgm(BGM_FILES.tutorialAntonia);
const _bgmPuzzleCreate = _mkBgm(BGM_FILES.puzzleCreate);
const _bgmPuzzleAttempt = _mkBgm(BGM_FILES.puzzleAttempt);
const _bgmWin = _mkBgm(BGM_FILES.win);
const _bgmDefeat = _mkBgm(BGM_FILES.defeat);
const _bgmShop = _mkBgm(BGM_FILES.shop);
const _bgmCampaign = _mkBgm(BGM_FILES.campaign);
const _bgmDeckEditor = _mkBgm(BGM_FILES.deckEditor);
const _bgmDraft = _mkBgm(BGM_FILES.draft);
const _bgmDraftBuild = _mkBgm(BGM_FILES.draftBuild);
// Jedes Element, das hier steht, wird beim ersten Klick mitentsperrt.
// Ein Ziel-Bezeichner in `setBgmMode(...)` muss ein Schluessel dieser
// Tabelle sein (oder `battle:<slug>` / `campaign:<slug>`).
const _bgmTracks = {
  login: _bgmLogin, menu: _bgmMenu, battle: _bgmBattle, puzzle: _bgmPuzzle, tutorial: _bgmTutorial, tutorialAntonia: _bgmTutorialAntonia,
  puzzleCreate: _bgmPuzzleCreate, puzzleAttempt: _bgmPuzzleAttempt,
  win: _bgmWin, defeat: _bgmDefeat, shop: _bgmShop, campaign: _bgmCampaign,
  deckEditor: _bgmDeckEditor, draft: _bgmDraft, draftBuild: _bgmDraftBuild,
};
// Grundeinstellung ueber die Tabelle selbst — vorher stand hier eine
// zweite, von Hand gepflegte Liste derselben Elemente, die bei jedem
// neuen Track haette nachgezogen werden muessen.
for (const t of Object.values(_bgmTracks)) {
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
// Musik-SAETZE: mehrere gleichwertige Kampfmusiken, aus denen je Partie eine zufaellig gewaehlt wird
// (Dateien /music/bgm_<satz><n>.ogg, n = 1…Anzahl). Skill Test: bis zu 8 Spieler, zufaellige Layouts → fuenf Tracks.
const BGM_SETS = { skilltest: 5 };
// Die Wahl haengt nur an `seed` (Raum + Satzstand): alle Spieler der Partie hoeren denselben Track, und er
// bleibt ueber jedes erneute Rendern gleich. Eine Revanche (anderer Satzstand) wuerfelt neu.
function bgmSetPick(setName, seed) {
  const count = setName ? BGM_SETS[setName] : 0;
  if (!count) return null;
  let h = 2166136261;
  const s = String(setName) + '|' + String(seed);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return setName + (1 + (h % count));
}
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
  // Kampagnenmusik: wie beim Kampf wird die `src` des BESTEHENDEN
  // Elements umgeschaltet (entsperrt bleibt entsperrt). Fehlt die
  // Datei, faellt es auf das Menuethema zurueck.
  const c = /^campaign:([a-z0-9_-]+)$/i.exec(String(target || ''));
  if (c) {
    const el = _bgmTracks.campaign;
    if (!el) return null;
    const url = '/music/bgm_' + c[1] + '.ogg';
    if (!el.src || !el.src.endsWith(url)) {
      el.onerror = () => {
        el.onerror = null;
        el.src = BGM_FILES.menu;
        try { el.load(); el.play().catch(() => {}); } catch {}
      };
      el.src = url;
      try { el.load(); } catch {}
    }
    return el;
  }
  const m = /^battle:([a-z0-9_]+)$/.exec(String(target || ''));
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
/**
 * ═══ OBERFLAECHEN-MASSSTAB (v803) ═══════════════════════════════════
 * Setzt `--ui-scale` aus der Fenstergroesse. style.css legt den Wert per
 * `zoom` auf die Bildschirme (siehe dort, „OBERFLAECHEN-MASSSTAB").
 *
 * Gerechnet wird wie beim Kampffeld — Einpassen auf eine Bezugsgroesse
 * —, aber auf BEIDEN Achsen. Genau das fehlte dem Brett-Regler und ist
 * der Grund, warum beim Reinzoomen Dinge nach oben und unten aus dem
 * Bild fielen: die Hoehe kam in seiner Rechnung gar nicht vor.
 *
 * BEZUG und GRENZEN sind die beiden Zahlen zum Nachjustieren:
 *   • BEZUG_B/H — bei dieser Fenstergroesse ist der Massstab genau 1.
 *   • MIN/MAX  — wie weit er ueberhaupt ausschlagen darf.
 * Bei 1920x1080 ergibt der aktuelle Bezug 1.20, bei 1600x900 genau 1.0,
 * bei 1280x720 dann 0.80.
 */
function UiScaler() {
  // ★★ v1265: `useLayoutEffect` statt `useEffect`. UiScaler haengt erst
  // nach dem Laden im Baum — im SELBEN Commit wie das Hauptmenue. Mit
  // `useEffect` lief das Setzen von `--ui-scale` NACH dem
  // `useLayoutEffect` des Menues, das seine Lage deshalb ohne Zoom mass:
  // die Oberkante der Menuekaesten lag bei gleichem Layout je nach Fenster
  // bei 84 (1366×768), 150 (1600×900) oder 240 px (1920×1080), bei kleinen
  // Fenstern ragte die Kopfzeile hinein. Layout-Effekte laufen in
  // Baumreihenfolge, UiScaler steht vor den Bildschirmen — so ist der Zoom
  // gesetzt, bevor irgendein Bildschirm misst.
  React.useLayoutEffect(() => {
    const BEZUG_B = 1600, BEZUG_H = 900;
    const MIN = 0.70, MAX = 1.60;
    const setzen = () => {
      const b = window.innerWidth || BEZUG_B;
      const h = window.innerHeight || BEZUG_H;
      const roh = Math.min(b / BEZUG_B, h / BEZUG_H);
      const wert = Math.max(MIN, Math.min(MAX, roh));
      document.documentElement.style.setProperty('--ui-scale', wert.toFixed(3));
    };
    setzen();
    window.addEventListener('resize', setzen);
    return () => {
      window.removeEventListener('resize', setzen);
      document.documentElement.style.removeProperty('--ui-scale');
    };
  }, []);
  return null;
}

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
      <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(8,6,12,.96)',
        color: '#fae5eb', padding: '24px', overflow: 'auto', fontFamily: 'monospace', fontSize: 13 }}>
        <div style={{ fontSize: 18, marginBottom: 10, color: '#fe7476' }}>
          Das Spielfeld ist auf einen Fehler gelaufen.
        </div>
        <div style={{ marginBottom: 14, color: '#d2d2db', fontFamily: 'inherit' }}>
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
    // Fade out EVERY other audible track, nicht nur den ersten Treffer.
    //
    // Hier stand `.find(...)` — also genau EIN Ausblenden pro Wechsel.
    // Ein Ausblendvorgang laeuft 8 x 40 ms; wechselt der Modus in dieser
    // Zeit erneut (und beim Puzzle-Test tun das gleich mehrere
    // useEffects nacheinander), ist der vorige Track noch NICHT pausiert.
    // Der naechste Wechsel greift sich dann irgendeinen davon und laesst
    // die uebrigen dauerhaft weiterlaufen — so klangen bgm_puzzle und
    // bgm_puzzle_probieren gleichzeitig.
    const fadeOuts = Object.values(_bgmTracks).filter(t => t && t !== fadeIn && !t.paused);

    const targetVol = getTargetVol();

    // Quick crossfade — je Element mit eigenem Timer-Riegel, damit zwei
    // Ausblendungen desselben Tracks sich nicht gegenseitig die
    // Lautstaerke verstellen.
    for (const fo of fadeOuts) {
      if (fo._ppFadeTimer) { clearInterval(fo._ppFadeTimer); fo._ppFadeTimer = null; }
      const origVol = fo._ppBaseVol != null ? fo._ppBaseVol : fo.volume;
      fo._ppBaseVol = origVol;
      let step = 0;
      fo._ppFadeTimer = setInterval(() => {
        step++;
        fo.volume = Math.max(0, origVol * (1 - step / 8));
        if (step >= 8) {
          clearInterval(fo._ppFadeTimer); fo._ppFadeTimer = null;
          fo.pause(); fo.volume = origVol; fo.currentTime = 0;
          delete fo._ppBaseVol;
        }
      }, 40);
    }

    // Der eintretende Track koennte selbst gerade ausblenden — Timer
    // abraeumen, sonst dreht die alte Schleife ihn wieder herunter.
    if (fadeIn._ppFadeTimer) { clearInterval(fadeIn._ppFadeTimer); fadeIn._ppFadeTimer = null; }
    delete fadeIn._ppBaseVol;
    fadeIn.volume = 0;

    // ── EINBLENDUNG MIT DEMSELBEN RIEGEL WIE DIE AUSBLENDUNG ──────────
    // ★ Als Befund 17.8.: „Try as Guest → sofort per Escape wieder raus →
    // der Sound ruckelt und rauscht ekelhaft. Aber NUR, wenn man sofort
    // bei Screen-Transition wieder escaped."
    //
    // Ursache: der EINblend-Timer lag in einer lokalen Variablen und war
    // von aussen nicht erreichbar. Wechselt der Modus innerhalb der
    // Blendzeit (8 × 40 ms = 320 ms) erneut, landet der Track in
    // `fadeOuts` und bekommt einen AUSblend-Timer — waehrend sein alter
    // EINblend-Timer weiterlaeuft und ihn gegenlaeufig wieder hochdreht.
    // Zwei Timer im 40-ms-Takt gegeneinander auf derselben
    // `volume`-Eigenschaft: das ist das Rauschen.
    //
    // Die Ausblendung hatte diesen Riegel laengst (`fo._ppFadeTimer`),
    // die Einblendung nie. Jetzt teilen sich beide Richtungen DENSELBEN
    // Platz — ein Element blendet immer nur in eine Richtung, und jeder
    // neue Wechsel raeumt den alten Timer ab, egal woher er stammt.
    const starteEinblendung = () => {
      // Ein neuerer Wechsel hat uns ueberholt, waehrend `play()` lief:
      // dann gehoert dieser Track nicht mehr auf die Buehne. Ohne diese
      // Pruefung bliebe er hoerbar, obwohl ihn niemand mehr ausblendet
      // (beim Aufsammeln von `fadeOuts` war er noch pausiert).
      if (currentTrack.current !== target) {
        fadeIn.pause(); fadeIn.currentTime = 0; fadeIn.volume = targetVol;
        return;
      }
      if (fadeIn._ppFadeTimer) { clearInterval(fadeIn._ppFadeTimer); fadeIn._ppFadeTimer = null; }
      let step = 0;
      fadeIn._ppFadeTimer = setInterval(() => {
        step++;
        fadeIn.volume = Math.min(targetVol, targetVol * (step / 8));
        if (step >= 8) { clearInterval(fadeIn._ppFadeTimer); fadeIn._ppFadeTimer = null; }
      }, 40);
    };

    // VOR dem Abspielen setzen: `starteEinblendung` vergleicht dagegen,
    // und `play()` kann bereits im selben Tick aufloesen.
    currentTrack.current = target;

    fadeIn.play().then(starteEinblendung).catch(() => {
      // Autoplay still blocked — retry on next user interaction
      const retry = () => {
        fadeIn.volume = 0;
        fadeIn.play().then(starteEinblendung).catch(() => {});
        window.removeEventListener('click', retry);
      };
      window.addEventListener('click', retry, { once: true });
    });
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
          // ★ v1257: Der Web-Audio-Looper braucht keinen Play/Pause-
          // Tastendruck je Element — EIN ctx.resume() entsperrt den
          // Kontext fuer alle. (audio.play() wuerde hier ausserdem
          // 13 Fetch+Decodes anstossen — genau das soll die
          // Lazy-Ladung ja vermeiden.)
          if (typeof audio.unlock === 'function') { audio.unlock(); continue; }
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
    // Skin-Game gewonnen: derselbe Popup-Rahmen, nur mit Skin-Bild und -Text.
    const onSkinUnlocked = (data) => {
      if (data && data.skinName) setQueue(q => [...q, { kind: 'skin', id: 'skin:' + data.skinName, skinName: data.skinName, heroName: data.heroName }]);
    };
    socket.on('opponents_unlocked', onUnlocked);
    socket.on('skin_unlocked', onSkinUnlocked);
    return () => { socket.off('opponents_unlocked', onUnlocked); socket.off('skin_unlocked', onSkinUnlocked); };
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
        background: 'radial-gradient(circle at 50% 45%, rgba(39,24,12,.55), rgba(8,6,12,.9))',
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
          0%,100% { box-shadow: 0 0 28px rgba(255,198,28,.55), 0 0 70px rgba(255,154,26,.35), inset 0 0 24px rgba(255,198,28,.18); }
          50% { box-shadow: 0 0 44px rgba(251,225,129,.85), 0 0 110px rgba(249,172,32,.55), inset 0 0 34px rgba(255,217,102,.3); }
        }
        @keyframes ppUnlockTitle {
          0%,100% { text-shadow: 0 0 10px rgba(255,217,102,.8), 0 0 22px rgba(255,154,26,.5); }
          50% { text-shadow: 0 0 18px rgba(255,241,150,1), 0 0 40px rgba(249,172,32,.8); }
        }
      `}</style>

      {/* Rotating shimmer ring behind the card */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
           onClick={e => e.stopPropagation()}>
        <div style={{
          position: 'absolute', width: 620, height: 620, borderRadius: '50%',
          background: 'conic-gradient(from 0deg, rgba(255,198,28,0) 0deg, rgba(255,217,102,.32) 60deg, rgba(255,198,28,0) 120deg, rgba(255,217,102,.32) 180deg, rgba(255,198,28,0) 240deg, rgba(255,217,102,.32) 300deg, rgba(255,198,28,0) 360deg)',
          filter: 'blur(6px)', animation: 'ppUnlockSpin 14s linear infinite', pointerEvents: 'none',
        }} />

        {/* Ornate frame */}
        <div style={{
          position: 'relative',
          width: 'min(90vw, 460px)',
          padding: '34px 36px 30px',
          textAlign: 'center',
          borderRadius: 18,
          border: '3px solid #fad54a',
          outline: '1px solid rgba(251,225,129,.6)',
          outlineOffset: 6,
          background: 'linear-gradient(160deg, #291f3d 0%, #12101f 55%, #170b28 100%)',
          animation: 'ppUnlockPop .5s cubic-bezier(.18,.9,.3,1.2) both, ppUnlockGlow 2.6s ease-in-out infinite',
        }}>
          {/* Ornamental corner flourishes */}
          {[['top','left'],['top','right'],['bottom','left'],['bottom','right']].map(([v,h]) => (
            <div key={v+h} style={{
              position: 'absolute', [v]: 6, [h]: 10, color: '#ffd966',
              fontSize: 20, lineHeight: 1, textShadow: '0 0 8px rgba(249,172,32,.8)', pointerEvents: 'none',
            }}>✦</div>
          ))}

          <div className="orbit-font" style={{
            fontSize: 15, fontWeight: 800, letterSpacing: 3, color: '#ffd966',
            marginBottom: 18, animation: 'ppUnlockTitle 2.2s ease-in-out infinite',
          }}>{current.kind === 'skin' ? '✦ NEW SKIN UNLOCKED ✦' : '✦ NEW OPPONENT UNLOCKED ✦'}</div>

          {/* Hero portrait in a gold frame */}
          <div style={{
            display: 'inline-block', padding: 4, borderRadius: 10,
            border: '2px solid #fad54a', background: '#08060c',
            boxShadow: '0 0 18px rgba(255,185,26,.5)', marginBottom: 18,
          }}>
            {heroArt
              ? <HeroArtCrop heroName={current.kind === 'skin' ? current.heroName : current.middleHero} skinName={current.kind === 'skin' ? current.skinName : null} width={300} />
              : <div style={{ width: 300, height: 200, background: '#1a1a2e' }} />}
          </div>

          <div style={{ fontSize: 16, color: 'var(--text)', lineHeight: 1.5, marginBottom: 22 }}>
            You unlocked{' '}
            <span className="orbit-font" style={{
              color: '#fbe181', fontWeight: 800, fontSize: 20,
              textShadow: '0 0 12px rgba(255,185,26,.7)',
            }}>{current.kind === 'skin' ? current.skinName : (current.middleHero || current.name)}</span>{' '}
            {current.kind === 'skin' ? <>as a new skin for <b>{current.heroName}</b>!</> : 'as a new opponent!'}
          </div>

          <button
            onClick={dismiss}
            className="orbit-font"
            style={{
              padding: '10px 34px', fontSize: 14, fontWeight: 800, letterSpacing: 2,
              color: '#332300', cursor: 'pointer', borderRadius: 8, border: 'none',
              background: 'linear-gradient(180deg, #fbe181 0%, #ffb91a 60%, #f9ac20 100%)',
              boxShadow: '0 0 16px rgba(255,185,26,.7), 0 3px 0 #c68206',
              transition: 'transform .12s ease, box-shadow .12s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 0 26px rgba(255,217,102,.9), 0 5px 0 #c68206'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 0 16px rgba(255,185,26,.7), 0 3px 0 #c68206'; }}
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

// Hochkant-Sperre: das Spiel laeuft nur quer. Wer ueber einen Social-Link (TikTok/Instagram/Shorts) aufs Handy kommt, sieht
// zuerst diesen Bildschirm — deshalb mit Titelbild, Logo, einem Handy-Sprite, das sich quer legt, und einem Hinweis zum
// Weitergeben des Links (am PC/Tablet spielen). Sichtbar nur im Hochformat (CSS `.rotate-device-overlay`).
function RotateOverlay() {
  const [copied, setCopied] = useState(false);
  // Standard (Android/Chrome u. a.): ein Antippen irgendwo startet Vollbild + Querformat-Sperre, das Geraet dreht sich von
  // selbst — der Bildschirm sagt nur „Tap to play". Wo das nicht geht (iPhone-Safari, Sperre verweigert): die Dreh-Anweisung.
  const [failed, setFailed] = useState(false);
  const auto = !!(window._ppFullscreenSupported && window._ppLandscapeLockSupported) && !failed;
  const enter = () => { if (!auto) return; window._ppRequestFullscreen(true).then(r => { if (!r.locked) setFailed(true); }); };
  const copyLink = () => {
    const url = window.location.origin;
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 2200); };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(url).then(done, done); return; }
    } catch (e) { /* weiter mit dem Notweg */ }
    try {
      const ta = document.createElement('textarea'); ta.value = url; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    } catch (e) { /* nichts zu tun */ }
    done();
  };
  return (
    <div className="rotate-device-overlay" id="rotate-overlay" onClick={enter}>
      <div className="rotate-art" aria-hidden="true"></div>
      <div className="rotate-dither" aria-hidden="true"></div>
      <div className="rotate-content">
        <div className="pp-logo-stack rotate-logo">
          <img src="/data/logo.png" alt="Pixel Parties" className="pp-logo-img" />
          <div className="pp-logo-tint" aria-hidden="true"></div>
          <div className="pp-logo-licht" aria-hidden="true"></div>
          <div className="pp-logo-umriss" aria-hidden="true"></div>
        </div>
        {auto ? (
          <div className="rotate-play" aria-hidden="true">
            <svg viewBox="0 0 14 14" shapeRendering="crispEdges">
              <rect x="0" y="0" width="14" height="14" className="pl-edge" />
              <rect x="1" y="1" width="12" height="12" className="pl-body" />
              <rect x="4" y="3" width="2" height="8" className="pl-tri" />
              <rect x="6" y="4" width="2" height="6" className="pl-tri" />
              <rect x="8" y="5" width="2" height="4" className="pl-tri" />
              <rect x="10" y="6" width="1" height="2" className="pl-tri" />
            </svg>
          </div>
        ) : (
          <div className="rotate-phone" aria-hidden="true">
            <svg className="rot-phone-p" viewBox="0 0 14 22" shapeRendering="crispEdges">
              <rect x="0" y="0" width="14" height="22" className="ph-edge" />
              <rect x="1" y="1" width="12" height="20" className="ph-body" />
              <rect x="2" y="3" width="10" height="15" className="ph-screen" />
              <rect x="5" y="1" width="4" height="1" className="ph-edge" />
              <rect x="6" y="19" width="2" height="1" className="ph-edge" />
              <rect x="4" y="6" width="2" height="2" className="ph-spark" />
              <rect x="8" y="11" width="2" height="2" className="ph-spark" />
              <rect x="5" y="14" width="1" height="1" className="ph-spark" />
            </svg>
            <svg className="rot-phone-l" viewBox="0 0 22 14" shapeRendering="crispEdges">
              <rect x="0" y="0" width="22" height="14" className="ph-edge" />
              <rect x="1" y="1" width="20" height="12" className="ph-body" />
              <rect x="3" y="2" width="15" height="10" className="ph-screen" />
              <rect x="20" y="5" width="1" height="4" className="ph-edge" />
              <rect x="1" y="6" width="1" height="2" className="ph-edge" />
              <rect x="6" y="4" width="2" height="2" className="ph-spark" />
              <rect x="11" y="8" width="2" height="2" className="ph-spark" />
              <rect x="14" y="5" width="1" height="1" className="ph-spark" />
            </svg>
          </div>
        )}
        {auto ? (
          <div className="rotate-panel rotate-panel-tap">
            <div className="rotate-text rotate-tap-text">TAP TO PLAY</div>
            <div className="rotate-sub">Tap anywhere to start the battle.</div>
          </div>
        ) : (
          <div className="rotate-panel">
            <div className="rotate-text">Turn your phone sideways!</div>
            <div className="rotate-sub">Pixel Parties is played in landscape. Rotate your device and the battle begins.</div>
            {window._ppFsLast && window._ppFsLast.err && <div className="rotate-diag">Auto-rotate failed: {String(window._ppFsLast.err)}</div>}
          </div>
        )}
        <div className="rotate-panel rotate-panel-pc" onClick={(e) => e.stopPropagation()}>
          <div className="rotate-sub">Rather play on a PC or tablet? It is free in your browser:</div>
          <div className="rotate-url">pixelpartiestcg.com</div>
          <div className="rotate-actions">
            <button type="button" className="rotate-copy" onClick={(e) => { e.stopPropagation(); copyLink(); }}>{copied ? 'COPIED!' : 'COPY LINK'}</button>
            <DiscordButton size={22} label="Discord" />
          </div>
        </div>
      </div>
    </div>
  );
}

// iPhone/iPad-Safari kennen kein Vollbild fuer Webseiten (keine Fullscreen-API) — die Browserleiste bleibt. Einziger Weg:
// „Zum Home-Bildschirm" (manifest.json: display fullscreen, orientation landscape). Ein einmaliger, wegklickbarer Hinweis.
function IosFullscreenHint() {
  const KEY = 'pp_ios_fs_hint';
  const [hidden, setHidden] = useState(() => { try { return !!localStorage.getItem(KEY); } catch { return false; } });
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.navigator.standalone === true || (window.matchMedia && (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches));
  const hide = () => { setHidden(true); try { localStorage.setItem(KEY, '1'); } catch {} };
  useEffect(() => { if (!ios || standalone || hidden) return; const t = setTimeout(hide, 20000); return () => clearTimeout(t); }, [ios, standalone, hidden]);
  if (!ios || standalone || hidden) return null;
  return (
    <div className="ios-fs-hint" role="status">
      <div className="ios-fs-text">Want true fullscreen? Tap Share, then Add to Home Screen.</div>
      <button type="button" className="rotate-copy" onClick={hide}>OK</button>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [screen, setScreen] = useState('menu');
  // Der Kartenbild-Shim (card-image-shim.js) merkt sich je Bildschirm, welche Karten zuerst gezeigt wurden, und waermt sie im
  // Hauptmenue vor. Die Eltern rendern vor den Kindern, also steht der Name schon da, wenn deren <img> ihre Quelle setzen.
  window.__ppScreen = screen;
  const [loading, setLoading] = useState(true);
  const [notif, setNotif] = useState(null);
  // bgmMode: ein Schluessel von _bgmTracks ('menu', 'battle', 'shop',
  // 'deckEditor', ...) oder 'battle:<slug>' / 'campaign:<slug>'. setInBattle is
  // kept as a compatibility wrapper so existing callers continue to
  // work.
  const [bgmMode, setBgmMode] = useState('menu');
  const inBattle = bgmMode !== 'menu';
  const setInBattle = useCallback((v) => setBgmMode(v ? 'battle' : 'menu'), []);

  // Expose the player's chosen colour as a global CSS variable so every
  // screen/submenu (titles, etc.) can theme off it via var(--player-color).
  useEffect(() => {
    const col = (user && user.color) || '#66b6ff';
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
      // `challengeStart`: eine angenommene Herausforderung (social.js) schickt beide Spieler aus dem Menü ins Spiel.
      if (state.reconnected || state.challengeStart) {
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
    document.documentElement.style.setProperty('--accent', user && user.color ? user.color : '#66b6ff');
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
          const step = e.deltaMode === 1 ? e.deltaY * 16
                     : e.deltaMode === 2 ? e.deltaY * el.clientHeight
                     : e.deltaY;
          // v844 (Al): steht der Tooltip in Radrichtung schon am
          // Anschlag (ganz oben beim Hochrollen, ganz unten beim
          // Runterrollen), geht das Rad an den Bildschirm — KEIN
          // preventDefault, und auch kein Weiterreichen an den
          // naechsten Kandidaten (der waere nur eine Huelle desselben
          // Tooltips). Die 1-px-Toleranz faengt Subpixel-Reste ab.
          const obenAmAnschlag = el.scrollTop <= 0;
          const untenAmAnschlag = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
          if ((step < 0 && obenAmAnschlag) || (step > 0 && untenAmAnschlag)) return;
          // Found something to scroll.
          e.preventDefault();
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
      // Die Kampagne faengt Escape selbst ab (Menue / Untermenues
      // schliessen). Ohne diese Ausnahme wuerde ein Escape mitten in
      // einer Szene den ganzen Story-Modus verlassen.
      if (e.key === 'Escape' && !e.defaultPrevented && user && screen !== 'menu' && screen !== 'play' && screen !== 'deckbuilder' && screen !== 'campaign') {
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
      <RotateOverlay />
      <IosFullscreenHint />
      <MusicManager bgmMode={user ? bgmMode : 'login'} />
      <TextBox />
      <OpponentUnlockPopup />
      {/* Who's Online / private Chats / Herausforderungen (app-social.jsx) */}
      <SocialHost user={user} bgmMode={bgmMode} screen={screen} onOpenPlay={() => setScreen('play')} />
      {/* v1289: Spielerprofil-Popup (Top-Spieler-Listen), app-player-profile.jsx */}
      <PlayerProfilePopupHost />
      {notif && <Notification key={notif.id} message={notif.message} type={notif.type} onClose={() => setNotif(null)} />}
      <UiScaler />
      {/* Pixel-Partikel hinter dem gesamten Menue (v808). Liegt fest im
          Fenster, hinter allen Bildschirminhalten; die Bildschirme sind
          dafuer durchsichtig und der Verlauf ist auf `body` gewandert.
          Sobald ein Kampffeld im Baum haengt, blendet CSS die Schicht
          aus — dort deckt das Brett sie ohnehin ab, und laufende
          Animationen waehrend einer Partie kosten nur Bildrate. */}
      <MenuBackgroundParticles />
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
          screen === 'campaign' ? <CampaignScreen /> :
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

