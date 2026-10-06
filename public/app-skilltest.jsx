// ═══════════════════════════════════════════
//  PIXEL PARTIES — SKILL TEST (Client)
//  Lobby (2–8 Sitze, CPU-Personas), später Vorbereitung (Basis,
//  Recycler, Ready). Server-Gegenstück: skilltest/*.js
// ═══════════════════════════════════════════
const { useState, useEffect, useRef, useCallback, useMemo, useContext } = React;
const { socket, cardImageUrl, VolumeControl, BoardCard, BoardZone, AbilityStack, CardFoil, CardTooltipContent, useCardTooltip, CARDS_BY_NAME } = window;

const ST_MAX_SEATS = 8;

// ── Lobby ──────────────────────────────────────────────────────────
// 8-Sitz-Raster wie die Cube-Lobby, aber: CPU-Sitze per Knopf (mit
// zufälliger Hero-Persona), kein Deck nötig, Start ab 2 Sitzen.
function SkillTestLobby({ lobby, user, leaveRoom, playerJoined, setPlayerJoined }) {
  const isHost = lobby.host === user.username;
  const seats = lobby.seats || [];
  const filled = seats.filter(Boolean).length;
  const canStart = filled >= 2;
  const cfg = lobby.skillTest || {};
  const mineSeated = (lobby.players || []).includes(user.username);
  const isSpectator = !mineSeated && (lobby.spectators || []).includes(user.username);

  return (
    <div className="screen-full">
      <div className="top-bar">
        <button className="btn btn-danger" onClick={leaveRoom}>{isHost ? 'CLOSE ROOM' : 'LEAVE'}</button>
        <h2 className="orbit-font" style={{ fontSize: 14, color: 'var(--accent)' }}>🎯 SKILL TEST LOBBY</h2>
        <span className="badge" style={{ background: 'rgba(0,240,255,.12)', color: 'var(--accent)' }}>2–8 PLAYERS</span>
        <VolumeControl />
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto' }} className="animate-in">
        <div className="panel" style={{ width: 760, maxWidth: '94%' }}>
          <div className="orbit-font" style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, textAlign: 'center' }}>
            {canStart
              ? (isHost ? '⚔️ Ready — start when you like.' : '⏳ Waiting for host to start...')
              : '⏳ Waiting for at least one more player or CPU...'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            {Array.from({ length: ST_MAX_SEATS }).map((_, i) => {
              const seat = seats[i] || null;
              const heroArt = seat?.persona?.hero ? cardImageUrl(seat.persona.hero) : null;
              return (
                <div key={i} className="st-seat" style={{
                  position: 'relative',
                  border: '2px ' + (seat ? 'solid ' : 'dashed ') + (seat ? (seat.isHost ? 'var(--accent)' : (seat.isBot ? 'var(--accent3)' : 'var(--accent2)')) : 'var(--bg4)'),
                  borderRadius: 8, padding: '10px 6px', textAlign: 'center',
                  background: seat ? 'rgba(0,240,255,.04)' : 'transparent',
                  opacity: seat ? 1 : .5, minHeight: 112,
                }}>
                  {seat && seat.isBot && isHost && (
                    <button className="btn" title="Remove CPU"
                      style={{ position: 'absolute', top: 2, right: 2, padding: '0 6px', fontSize: 11, lineHeight: '16px' }}
                      onClick={() => socket.emit('st_remove_cpu', { roomId: lobby.id, username: seat.username })}>✕</button>
                  )}
                  <div style={{ height: 52, marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                    {heroArt
                      ? <img src={heroArt} alt="" style={{ height: 52, imageRendering: 'pixelated', borderRadius: 4 }} />
                      : (seat ? (seat.isHost ? '👑' : '⚔️') : `${i + 1}`)}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 11, color: seat ? 'var(--text)' : 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {seat ? seat.username : 'Open Seat'}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text2)', marginTop: 2 }}>
                    {seat ? (seat.isHost ? 'HOST' : seat.isBot ? '🤖 CPU' : 'PLAYER') : ' '}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ background: 'var(--bg2)', borderRadius: 4, padding: '8px 12px', marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11, color: 'var(--text2)' }}>
            <div>🛠 Preparation timer: <strong style={{ color: 'var(--text)' }}>{cfg.prepTimerDisabled ? 'Off' : `${cfg.prepTimerSec}s`}</strong></div>
            <div>⏱ Turn timer: <strong style={{ color: 'var(--text)' }}>{cfg.turnTimerDisabled ? 'Off' : `${cfg.turnTimerSec}s`}</strong></div>
          </div>

          {(lobby.spectators || []).length > 0 && (
            <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 12, textAlign: 'center' }}>
              👁 Spectators: {lobby.spectators.join(', ')}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {isHost && (
              <button className="btn btn-accent2" disabled={filled >= ST_MAX_SEATS}
                onClick={() => socket.emit('st_add_cpu', { roomId: lobby.id })}>
                🤖 ADD CPU
              </button>
            )}
            {isHost && (
              <button className={'btn btn-success btn-big' + (canStart ? ' glow-border' : '')}
                disabled={!canStart}
                title={canStart ? '' : 'Need at least 2 seats (players or CPUs).'}
                onClick={() => socket.emit('st_start', { roomId: lobby.id })}>
                🎯 START ({filled} {filled === 1 ? 'seat' : 'seats'})
              </button>
            )}
            {!isHost && mineSeated && (
              <button className="btn" style={{ fontSize: 10 }}
                onClick={() => socket.emit('swap_to_spectator', { roomId: lobby.id })}>
                SWITCH TO SPECTATOR
              </button>
            )}
            {isSpectator && filled < ST_MAX_SEATS && (
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

// ── Einstellungen im „Create Game"-Dialog ──────────────────────────
function SkillTestCreateOptions({ opts, setOpts }) {
  const set = (k, v) => setOpts(o => ({ ...o, [k]: v }));
  return (
    <>
      <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.5, padding: '6px 8px', border: '1px solid var(--bg4)', borderRadius: 4 }}>
        2–8 players (humans and CPUs). Everyone prepares a base from 18 random cards, then
        takes turns acting with one Hero or Creature at a time. No deck needed.
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: opts.prepTimerDisabled ? 'var(--bg4)' : 'var(--text2)', marginBottom: 4 }}>Preparation time (s)</div>
          <input className="input" type="number" min={30} max={1800} value={opts.prepTimerSec}
            onChange={e => set('prepTimerSec', e.target.value)} disabled={opts.prepTimerDisabled} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: opts.turnTimerDisabled ? 'var(--bg4)' : 'var(--text2)', marginBottom: 4 }}>Time per turn (s)</div>
          <input className="input" type="number" min={15} max={600} value={opts.turnTimerSec}
            onChange={e => set('turnTimerSec', e.target.value)} disabled={opts.turnTimerDisabled} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 11, color: 'var(--text2)' }}>
          <input type="checkbox" checked={opts.prepTimerDisabled} onChange={e => set('prepTimerDisabled', e.target.checked)} />
          No preparation timer
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 11, color: 'var(--text2)' }}>
          <input type="checkbox" checked={opts.turnTimerDisabled} onChange={e => set('turnTimerDisabled', e.target.checked)} />
          No turn timer
        </label>
      </div>
    </>
  );
}


// ═══════════════════════════════════════════
//  PIXEL-ART: RECYCLING-CONTAINER
//  Programmatisch gemalt (kein Bild-Asset): kleine Pixel-Leinwand,
//  hart hochskaliert. Zwei Zustände: Deckel zu / Deckel offen.
// ═══════════════════════════════════════════
const _stArtCache = {};
function stPixelArt(key, w, h, paint) {
  if (_stArtCache[key]) return _stArtCache[key];
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  const px = (x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
  const rect = (x, y, rw, rh, c) => { g.fillStyle = c; g.fillRect(x, y, rw, rh); };
  paint({ px, rect, w, h });
  return (_stArtCache[key] = cv.toDataURL('image/png'));
}

function stRecyclerArt(open) {
  return stPixelArt('recycler:' + (open ? 'open' : 'closed'), 56, 64, ({ px, rect }) => {
    const OUT = '#0f2a1b', BODY = '#2f9e57', HI = '#52c97b', SH = '#1f6e3d', DK = '#16482a';
    const LID = '#287a47', LIDHI = '#4cc27a', METAL = '#8a97a6', METALDK = '#5b6672', BLK = '#171b20', RUB = '#2b3138';
    // Bodenschatten
    for (let x = 6; x < 50; x++) { px(x, 60, 'rgba(0,0,0,.35)'); if (x > 9 && x < 47) px(x, 61, 'rgba(0,0,0,.25)'); }
    // Korpus: leicht nach oben verbreitert
    for (let y = 24; y < 56; y++) {
      const inset = Math.floor((y - 24) / 10);        // 0..3
      const x0 = 7 + inset, x1 = 48 - inset;
      rect(x0, y, x1 - x0 + 1, 1, BODY);
      px(x0, y, OUT); px(x1, y, OUT);
      px(x0 + 1, y, HI); px(x0 + 2, y, HI);           // Licht links
      px(x1 - 1, y, SH); px(x1 - 2, y, SH);           // Schatten rechts
    }
    rect(10, 55, 36, 1, OUT);                          // Unterkante
    // senkrechte Rippen
    for (const rx of [17, 24, 31, 38]) for (let y = 31; y < 54; y++) { px(rx, y, SH); px(rx + 1, y, HI); }
    // Frontplatte mit Recycling-Zeichen
    rect(15, 32, 26, 18, DK); rect(16, 33, 24, 16, '#e9f6ee'); rect(16, 33, 24, 1, '#ffffff');
    rect(15, 32, 26, 1, OUT); rect(15, 49, 26, 1, OUT); rect(15, 32, 1, 18, OUT); rect(40, 32, 1, 18, OUT);
    // Kreispfeile (Refresh-Symbol) mittig auf der Platte
    const cx = 28, cy = 41;
    for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) {
      const d = Math.sqrt(x * x + y * y), a = Math.atan2(y, x);
      const ring = d > 3.2 && d < 5.4;
      const gap1 = Math.abs(a - (-2.2)) < 0.42, gap2 = Math.abs(a - 0.94) < 0.42;
      if (ring && !gap1 && !gap2) px(cx + x, cy + y, '#1f9f52');
    }
    // zwei Pfeilspitzen
    [[22, 36, [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [0, 2]]], [32, 46, [[2, 0], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]]]].forEach(([ax, ay, pts]) => pts.forEach(([dx, dy]) => px(ax + dx, ay + dy, '#127a3a')));
    // Räder
    for (const wx of [13, 38]) { rect(wx, 54, 6, 6, BLK); rect(wx + 1, 55, 4, 4, RUB); px(wx + 2, 56, METAL); px(wx + 3, 57, METALDK); }
    // Einwurfschlitz (zeigt, wo Karten verschwinden)
    rect(14, 25, 28, 3, OUT); rect(15, 26, 26, 1, '#050b08');
    if (!open) {
      // Deckel geschlossen
      for (let y = 17; y < 25; y++) { const inset = y < 19 ? 2 : 0; rect(5 + inset, y, 46 - 2 * inset, 1, LID); px(5 + inset, y, OUT); px(50 - inset, y, OUT); }
      rect(7, 17, 42, 1, OUT); rect(6, 19, 44, 1, LIDHI); rect(5, 24, 46, 1, OUT);
      rect(22, 20, 12, 2, METAL); rect(22, 22, 12, 1, METALDK);   // Griff
    } else {
      // Deckel hochgeklappt (Scharnier hinten)
      for (let i = 0; i < 9; i++) { rect(10 - i + 2, 14 - i, 36, 1, i % 2 ? LID : LIDHI); px(10 - i + 2, 14 - i, OUT); px(10 - i + 37, 14 - i, OUT); }
      rect(11, 15, 34, 1, OUT);
      rect(8, 22, 40, 2, OUT);                                       // Deckelkante vorn offen
      rect(14, 18, 28, 4, '#07110c');                               // dunkle Öffnung
    }
    // Statuslämpchen
    px(46, 28, open ? '#ffd84a' : '#4cff7c'); px(46, 29, open ? '#c99a14' : '#1d9c43');
  });
}

function RecyclerContainer({ count, open, nextAt, children }) {
  return (
    <div className={'st-recycler' + (open ? ' is-open' : '')} data-st-ziel="recycler" data-st-recycler="1">
      <div className="st-recycler-art-wrap">
        <div className="st-recycler-art" style={{ backgroundImage: `url(${stRecyclerArt(open)})` }} />
        <div className="st-recycler-plate" title="Cards recycled so far">
          <span className="st-recycler-count">{count}</span>
        </div>
      </div>
      <div className="st-recycler-label orbit-font">RECYCLER</div>
      <div className="st-recycler-hint">{nextAt === 1 ? 'next card ejects a new one!' : `${nextAt} more → new card`}</div>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════
//  VORBEREITUNG — HEIMBASIS
// ═══════════════════════════════════════════
function stEnv() {
  return { cards: window.CARDS_BY_NAME || {}, areaLimitOf: (n) => (window.CARD_AREA_LIMITS || {})[n] };
}
const stCard = (n) => (window.CARDS_BY_NAME || {})[n];
const fmtTime = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

// Zielbeschreibung <-> data-Attribut
const zoneKey = (t) => [t.kind, t.hi ?? '', t.slot ?? ''].join(':');
const parseZoneKey = (k) => { const [kind, hi, slot] = k.split(':'); return { kind, hi: hi === '' ? undefined : +hi, slot: slot === '' ? undefined : +slot }; };

function SkillTestPrepScreen({ lobby, user, leaveRoom, notify }) {
  const R = window.SkillTestRules;
  const [view, setView] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [drag, setDrag] = useState(null);           // { name, src }
  const [startMenu, setStartMenu] = useState(null); // { hi, slot, x, y }
  const [fx, setFx] = useState(null);               // Recycler-Animation
  const [binOpen, setBinOpen] = useState(false);
  const offsetRef = useRef(0);
  const wrapRef = useRef(null);
  const dragRef = useRef(null);
  const { tooltipCard, showTooltip, hideTooltip } = useCardTooltip({ defaultSide: 'left' });

  // ── Verbindung ──
  useEffect(() => {
    const onState = (st) => {
      if (st.roomId !== lobby.id) return;
      offsetRef.current = st.serverNow - Date.now();
      setView(prev => ({ ...(prev || {}), ...st }));
      if (st.event && st.event.type === 'recycle') {
        setFx({ ...st.event, t: Date.now() });
        setBinOpen(true);
        setTimeout(() => setBinOpen(false), 520);
        setTimeout(() => setFx(f => (f && Date.now() - f.t >= 1500 ? null : f)), 1600);
        if (window.playSFX) window.playSFX(st.event.ejected ? 'ping' : 'discard', { dedupe: 80 });
      }
    };
    const onErr = (e) => { notify && notify(e.reason || 'Not allowed', 'error'); if (window.playSFX) window.playSFX('ui_cancel', { volume: 1.0 }); };
    socket.on('st_prep_state', onState);
    socket.on('st_prep_error', onErr);
    socket.emit('st_prep_sync', { roomId: lobby.id });
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => { socket.off('st_prep_state', onState); socket.off('st_prep_error', onErr); clearInterval(tick); };
  }, [lobby.id]);

  // ── Brett-Skalierung (wie der Puzzle-Editor: globale --board-scale) ──
  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const apply = () => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const byW = r.width / 1180, byH = r.height / 520;
      const sc = Math.max(0.55, Math.min(1.35, Math.min(byW, byH)));
      document.documentElement.style.setProperty('--board-scale', sc.toFixed(3));
    };
    apply();
    const ro = new ResizeObserver(apply); ro.observe(el);
    window.addEventListener('resize', apply);
    return () => { ro.disconnect(); window.removeEventListener('resize', apply); document.documentElement.style.setProperty('--board-scale', '1'); };
  }, [!!view]);

  const ps = view && view.me;
  const env = useMemo(stEnv, []);
  const boardSkin = useCallback((zoneType) => {
    const boardId = user && user.board;
    if (!boardId) return undefined;
    const num = String(boardId).replace(/\D/g, '');
    return { backgroundImage: 'url(/data/shop/boards/' + encodeURIComponent(zoneType + num) + '.png)', backgroundSize: 'cover', backgroundPosition: 'center' };
  }, [user && user.board]);

  const send = (move) => socket.emit('st_prep_move', { roomId: lobby.id, move });

  // ── Drag & Drop (HTML5, magnetisches Ziel wie im Puzzle-Editor) ──
  const startDrag = (e, name, src) => {
    hideTooltip();
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', name); } catch { /* ältere Browser */ }
    dragRef.current = { name, src };
    if (window.setHandDragFlag) window.setHandDragFlag(true);
    setTimeout(() => setDrag({ name, src }), 0);
  };
  const endDrag = () => {
    dragRef.current = null; setDrag(null);
    if (window.setHandDragFlag) window.setHandDragFlag(false);
    clearTargetMark();
  };
  const clearTargetMark = () => {
    document.querySelectorAll('[data-st-target]').forEach(n => n.removeAttribute('data-st-target'));
  };
  const acceptsAt = (target) => {
    const d = dragRef.current; if (!d || !ps) return false;
    if (target.kind === 'recycler') {
      const c = stCard(d.name);
      if (c && c.cardType === 'Hero') return d.src.kind === 'hand' && R.boardFull(ps);
      return !(d.src.kind === 'ability' && !(ps.abilityZones[d.src.hi][d.src.slot] || {}).c);
    }
    if (target.kind === 'hand') return d.src.kind !== 'hand';
    if (d.src.kind === 'hero' && target.kind === 'hero') return d.src.hi !== target.hi;
    if (d.src.kind === 'hero') return false;
    return R.canDrop(env, ps, d.name, target);
  };
  const findTarget = (x, y) => {
    const els = document.elementsFromPoint(x, y);
    for (const el of els) {
      const zEl = el.closest && el.closest('[data-st-zone]');
      if (zEl) { const t = parseZoneKey(zEl.getAttribute('data-st-zone')); if (acceptsAt(t)) return { t, el: zEl }; }
      const rEl = el.closest && el.closest('[data-st-ziel]');
      if (rEl) { const t = { kind: rEl.getAttribute('data-st-ziel') }; if (acceptsAt(t)) return { t, el: rEl }; }
    }
    // Magnet: nächstliegende passende Zone innerhalb von 75 % ihrer größeren Seite.
    let best = null;
    document.querySelectorAll('[data-st-zone]').forEach(zEl => {
      const t = parseZoneKey(zEl.getAttribute('data-st-zone'));
      if (!acceptsAt(t)) return;
      const r = zEl.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dist = Math.hypot(x - cx, y - cy);
      if (dist <= 0.75 * Math.max(r.width, r.height) && (!best || dist < best.dist)) best = { t, el: zEl, dist };
    });
    return best;
  };
  const onWrapDragOver = (e) => {
    if (!dragRef.current) return;
    const hit = findTarget(e.clientX, e.clientY);
    clearTargetMark();
    if (hit) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; hit.el.setAttribute('data-st-target', '1'); }
  };
  const onWrapDrop = (e) => {
    const d = dragRef.current; if (!d) return;
    e.preventDefault();
    const hit = findTarget(e.clientX, e.clientY);
    clearTargetMark();
    if (hit) dispatchDrop(d, hit.t);
    endDrag();
  };
  const dispatchDrop = (d, t) => {
    if (t.kind === 'recycler') send({ type: 'recycle', from: d.src });
    else if (t.kind === 'hand') send({ type: 'unplace', from: d.src });
    else { send({ type: 'place', from: d.src, to: t }); if (window.playSFX) window.playSFX('placement'); }
  };
  // Hand & Recycler sind eigene Ziele (außerhalb des Brett-Wrappers)
  const dropOn = (kind) => ({
    onDragOver: (e) => { if (dragRef.current && acceptsAt({ kind })) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; e.currentTarget.setAttribute('data-st-target', '1'); } },
    onDragLeave: (e) => { e.currentTarget.removeAttribute('data-st-target'); },
    onDrop: (e) => { const d = dragRef.current; if (!d) return; e.preventDefault(); e.currentTarget.removeAttribute('data-st-target'); if (acceptsAt({ kind })) dispatchDrop(d, { kind }); endDrag(); },
  });

  // Glühen: alle passenden Zonen während des Ziehens
  const okSet = useMemo(() => {
    if (!drag || !ps) return null;
    dragRef.current = dragRef.current || drag;
    const set = new Set();
    const kinds = ['hero', 'ability', 'support', 'surprise', 'area'];
    for (const kind of kinds) {
      if (kind === 'area') { const t = { kind }; if (acceptsAt(t)) set.add(zoneKey(t)); continue; }
      for (let hi = 0; hi < 3; hi++) {
        if (kind === 'hero' || kind === 'surprise') { const t = { kind, hi }; if (acceptsAt(t)) set.add(zoneKey(t)); continue; }
        for (let slot = 0; slot < 3; slot++) { const t = { kind, hi, slot }; if (acceptsAt(t)) set.add(zoneKey(t)); }
      }
    }
    return set;
  }, [drag, ps]);

  const zoneProps = (t, cardName, src, removable) => {
    const k = zoneKey(t);
    const canDragFrom = !!cardName && !!src && !(ps && ps.ready);
    return {
      'data-st-zone': k,
      'data-st-ok': okSet && okSet.has(k) ? '1' : undefined,
      draggable: canDragFrom,
      onDragStart: canDragFrom ? (e) => startDrag(e, cardName, src) : undefined,
      onDragEnd: canDragFrom ? endDrag : undefined,
      onContextMenu: (e) => { e.preventDefault(); if (!cardName || (ps && ps.ready)) return; removable ? removable() : (src && send({ type: 'unplace', from: src })); },
    };
  };

  if (view && view.spectator) {
    return (
      <div className="screen-full st-prep st-loading">
        <div className="top-bar"><button className="btn btn-danger" onClick={leaveRoom}>LEAVE</button><h2 className="orbit-font" style={{ fontSize: 14, color: 'var(--accent)' }}>🎯 SKILL TEST — PREPARATION</h2></div>
        <div className="st-chips" style={{ margin: 'auto', flexWrap: 'wrap', justifyContent: 'center', maxWidth: 700 }}>
          {view.players.map(p => (
            <span key={p.idx} className={'st-chip' + (p.ready ? ' is-ready' : '')}>
              {p.persona ? <img src={cardImageUrl(p.persona.hero)} alt="" /> : <b>{p.isBot ? '🤖' : '⚔'}</b>}
              <span>{p.username}</span><i>{p.ready ? '✓' : '…'}</i>
            </span>
          ))}
        </div>
      </div>
    );
  }
  if (!view || !ps) {
    return (
      <div className="screen-full st-prep st-loading"><div className="orbit-font" style={{ margin: 'auto', fontSize: 16 }}>Preparing your base…</div></div>
    );
  }

  const nowSrv = now + offsetRef.current;
  const remaining = view.deadlineAt ? view.deadlineAt - nowSrv : null;
  const readyCount = view.players.filter(p => p.ready).length;
  const nextAt = view.recycleEvery - (ps.recycled % view.recycleEvery);

  // ── Hero-Reihe ──
  const heroRow = (
    <div className="board-row board-hero-row">
      {[0, 1, 2].flatMap(hi => {
        const heroName = ps.heroes[hi];
        const c = heroName && stCard(heroName);
        const group = (
          <div key={hi} className="board-hero-group">
            <div className="board-zone-spacer" />
            <div className="board-zone board-zone-hero" style={boardSkin('hero')}
              {...zoneProps({ kind: 'hero', hi }, heroName, { kind: 'hero', hi })}
              onMouseEnter={() => c && showTooltip(c, 'left')} onMouseLeave={hideTooltip}>
              {heroName
                ? <BoardCard cardName={heroName} hp={c ? c.hp : undefined} maxHp={c ? c.hp : undefined} atk={c ? c.atk : undefined} hpPosition="hero" />
                : <div className="board-zone-empty">Hero</div>}
            </div>
            <div className="board-zone board-zone-surprise" style={boardSkin('surprise')}
              {...zoneProps({ kind: 'surprise', hi }, ps.surpriseZones[hi], { kind: 'surprise', hi })}>
              {ps.surpriseZones[hi] ? <BoardCard cardName={ps.surpriseZones[hi]} /> : <div className="board-zone-empty">Surp</div>}
            </div>
          </div>
        );
        // Zwischen Hero 0 und 1 liegt die Area Zone (wie auf dem Spielbrett)
        if (hi === 0) {
          return [group,
            <div key="areaSpacer" className="board-area-spacer st-area-spacer">
              <div className="board-zone board-zone-area st-area-zone" style={boardSkin('area')}
                {...zoneProps({ kind: 'area' }, ps.areaZone[ps.areaZone.length - 1], { kind: 'area', idx: ps.areaZone.length - 1 })}
                onMouseEnter={() => ps.areaZone.length && showTooltip(stCard(ps.areaZone[ps.areaZone.length - 1]), 'left')} onMouseLeave={hideTooltip}>
                {ps.areaZone.length
                  ? <><BoardCard cardName={ps.areaZone[ps.areaZone.length - 1]} />{ps.areaZone.length > 1 && <div className="board-card-label">{ps.areaZone.length}</div>}</>
                  : <div className="board-zone-empty">Area</div>}
              </div>
            </div>];
        }
        if (hi === 1) return [group, <div key="sp1" className="board-area-spacer" />];
        return [group];
      })}
    </div>
  );

  // ── Ability-Reihe ──
  const abilityRow = (
    <div className="board-row">
      {[0, 1, 2].flatMap(hi => {
        const group = (
          <div key={hi} className="board-hero-group">
            {[0, 1, 2].map(slot => {
              const z = ps.abilityZones[hi][slot];
              const stack = z ? Array(R.abilityLevel(z)).fill(z.n) : [];
              const hasCard = !!(z && z.c);
              const src = hasCard ? { kind: 'ability', hi, slot } : null;
              return (
                <div key={slot} className={'board-zone board-zone-ability' + (z && z.s ? ' st-start-ability' : '')} style={boardSkin('ability')}
                  {...zoneProps({ kind: 'ability', hi, slot }, z && z.n, src, () => {
                    if (z && z.s && !z.c) send({ type: 'removeStart', hi, slot });
                    else if (hasCard) send({ type: 'unplace', from: { kind: 'ability', hi, slot } });
                  })}
                  onClick={(e) => { if (z && z.s && !ps.ready) { const r = e.currentTarget.getBoundingClientRect(); setStartMenu({ hi, slot, x: r.left + r.width / 2, y: r.bottom }); } }}
                  onMouseEnter={() => z && showTooltip(stCard(z.n), 'left')} onMouseLeave={hideTooltip}>
                  {stack.length ? <AbilityStack cards={stack} /> : <div className="board-zone-empty">Ability</div>}
                  {z && z.s > 0 && <span className="st-start-tag" title="Starting ability — fixed to this Hero (click to remove)">START</span>}
                </div>
              );
            })}
          </div>
        );
        return hi < 2 ? [group, <div key={'sp' + hi} className="board-area-spacer" />] : [group];
      })}
    </div>
  );

  // ── Support-Reihe ──
  const supportRow = (
    <div className="board-row">
      {[0, 1, 2].flatMap(hi => {
        const group = (
          <div key={hi} className="board-hero-group">
            {[0, 1, 2].map(slot => {
              const cards = ps.supportZones[hi][slot] || [];
              const top = cards[0];
              const c = top && stCard(top);
              const isAb = c && c.cardType === 'Ability';
              return (
                <div key={slot} className="board-zone board-zone-support" style={boardSkin('support')}
                  {...zoneProps({ kind: 'support', hi, slot }, top, { kind: 'support', hi, slot })}
                  onMouseEnter={() => c && showTooltip(c, 'left')} onMouseLeave={hideTooltip}>
                  {cards.length
                    ? (isAb ? <AbilityStack cards={cards} /> : <BoardCard cardName={top} hp={c && c.hp ? c.hp : undefined} maxHp={c && c.hp ? c.hp : undefined} hpPosition={c && c.hp ? 'creature' : undefined} />)
                    : <div className="board-zone-empty">Support</div>}
                </div>
              );
            })}
          </div>
        );
        return hi < 2 ? [group, <div key={'sp' + hi} className="board-area-spacer" />] : [group];
      })}
    </div>
  );

  // ── Hand ──
  const hand = ps.hand;
  const handEl = (
    <div className="pz-hand st-hand" {...dropOn('hand')} data-st-ziel="hand">
      <span className="pz-hand-label orbit-font">HAND ({hand.length})</span>
      <div className="pz-hand-cards" style={{ '--hand-max-lift': window.handFanMaxLift ? window.handFanMaxLift(hand.length) : 0 }}>
        {hand.map((cardName, i) => {
          const img = cardImageUrl(cardName);
          const gezogen = drag && drag.src.kind === 'hand' && drag.src.idx === i;
          return (
            <div key={cardName + ':' + i}
              data-st-card={cardName}
              className={'pz-hand-card' + (gezogen ? ' pz-hand-card-dragging' : '')}
              style={window.handFanStyle ? window.handFanStyle(i, hand.length, { seite: 'me' }) : undefined}
              draggable={!ps.ready}
              onDragStart={(e) => startDrag(e, cardName, { kind: 'hand', idx: i })}
              onDragEnd={endDrag}
              onContextMenu={(e) => { e.preventDefault(); }}
              onMouseEnter={() => { const c = stCard(cardName); if (c) showTooltip(c, 'left'); }}
              onMouseLeave={hideTooltip}>
              <div className="pz-hand-card-inner">
                {img ? <img src={img} className="pz-hand-card-img" draggable={false} alt="" /> : <div className="pz-hand-card-text"><span>{cardName}</span></div>}
                {CardFoil && <CardFoil card={stCard(cardName)} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="screen-full st-prep" onDragOver={(e) => { if (dragRef.current) e.preventDefault(); }} onDrop={() => { if (dragRef.current) endDrag(); }}>
      <div className="top-bar st-topbar">
        <button className="btn btn-danger" onClick={leaveRoom}>LEAVE</button>
        <h2 className="orbit-font" style={{ fontSize: 14, color: 'var(--accent)' }}>🎯 SKILL TEST — PREPARATION</h2>
        {remaining != null && <span className={'badge st-timer' + (remaining < 30000 ? ' st-timer-low' : '')}>⏱ {fmtTime(remaining)}</span>}
        <span className="badge" style={{ background: 'rgba(255,200,80,.14)', color: '#ffc850' }}>🪙 {view.gold} gold</span>
        <div style={{ flex: 1 }} />
        <VolumeControl />
      </div>

      {/* Zentraler Ready-Button (dort, wo im Duell der Gegner sitzt) */}
      <div className="st-ready-zone">
        <button className={'st-ready-btn' + (ps.ready ? ' is-ready' : '') + (view.readyProblem && !ps.ready ? ' is-blocked' : '')}
          onClick={() => socket.emit('st_prep_ready', { roomId: lobby.id, ready: !ps.ready })}
          title={ps.ready ? 'Click to change something again' : (view.readyProblem || 'Lock in your base')}>
          {ps.ready ? 'READY ✓' : 'READY!'}
        </button>
        <div className="st-ready-sub orbit-font">
          {ps.ready ? `Waiting for the others… (${readyCount}/${view.players.length})` : (view.readyProblem || `${readyCount}/${view.players.length} ready`)}
        </div>
        <div className="st-chips st-chips-row">
          {view.players.map(p => (
            <span key={p.idx} className={'st-chip' + (p.ready ? ' is-ready' : '') + (p.idx === view.you ? ' is-me' : '')} title={p.ready ? 'Ready' : 'Preparing…'}>
              {p.persona ? <img src={cardImageUrl(p.persona.hero)} alt="" /> : <b>{p.isBot ? '🤖' : '⚔'}</b>}
              <span>{p.username}</span><i>{p.ready ? '✓' : '…'}</i>
            </span>
          ))}
        </div>
      </div>

      <div className="st-main">
        <div className="st-base-wrap" ref={wrapRef} onDragOver={onWrapDragOver} onDrop={onWrapDrop}>
          <div className="st-base">
            <div className="st-base-banner orbit-font">🏠 {user.username}'s Home Base</div>
            <div className="board-player-side st-side">
              {heroRow}{abilityRow}{supportRow}
            </div>
          </div>
        </div>
        <div className="st-side-col">
          <div {...dropOn('recycler')}>
            <RecyclerContainer count={ps.recycled} open={binOpen || (!!drag && !!acceptsAtSafe(acceptsAt, 'recycler'))} nextAt={nextAt}>
              {fx && fx.ejected && <div className="st-eject" key={fx.t}><BoardCard cardName={fx.ejected} noTooltip /></div>}
            </RecyclerContainer>
          </div>
        </div>
      </div>

      {handEl}

      {startMenu && (
        <div className="st-menu-backdrop" onClick={() => setStartMenu(null)} onContextMenu={(e) => { e.preventDefault(); setStartMenu(null); }}>
          <div className="st-menu" style={{ left: startMenu.x, top: startMenu.y }} onClick={e => e.stopPropagation()}>
            <button className="btn btn-danger" onClick={() => { send({ type: 'removeStart', hi: startMenu.hi, slot: startMenu.slot }); setStartMenu(null); }}>Remove</button>
          </div>
        </div>
      )}

      <div className="board-tooltip">{tooltipCard && <CardTooltipContent card={tooltipCard} />}</div>
    </div>
  );
}
function acceptsAtSafe(fn, kind) { try { return fn({ kind }); } catch { return false; } }

// Übergang Vorbereitung → Kampf (kurze Ansage, bis der erste Spielzustand eintrifft).
function SkillTestBattlePending({ lobby, leaveRoom }) {
  const [info, setInfo] = useState(null);
  useEffect(() => {
    const on = (d) => setInfo(d);
    socket.on('st_battle_pending', on);
    return () => socket.off('st_battle_pending', on);
  }, []);
  const starter = info && lobby.players[info.starter];
  return (
    <div className="screen-full st-prep st-loading">
      <div className="top-bar"><button className="btn btn-danger" onClick={leaveRoom}>LEAVE</button></div>
      <div className="orbit-font" style={{ margin: 'auto', textAlign: 'center', fontSize: 18, lineHeight: 1.8 }}>
        ⚔️ The battle begins!
        {starter && <div style={{ fontSize: 13, color: 'var(--accent)' }}>{starter} starts (most cards recycled)</div>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  KAMPF — Turn-Panel und Hero-Menü (hängen im GameBoard)
// ═══════════════════════════════════════════
function StTurnPanel({ gameState, myIdx, isSpectator, focusSeat, onFocus }) {
  const st = gameState.skillTest;
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  const players = gameState.players;
  const active = gameState.activePlayer;
  const myTurn = !isSpectator && active === myIdx && !gameState.result;
  const left = st.turnDeadline ? Math.max(0, st.turnDeadline - (now + (st.serverNow - Date.now()))) : null;
  const order = st.order && st.order.length ? st.order : players.map((_, i) => i);
  const readyHeroes = (seat) => (players[seat].heroes || []).filter((h, hi) => h && h.name && h.hp > 0 && !(st.exhaustedHeroes || {})[seat + ':' + hi]).length;
  return (
    <div className={'st-turn-panel' + (myTurn ? ' is-my-turn' : '')}>
      <div className="st-turn-round orbit-font">ROUND {st.round}</div>
      <div className="st-turn-list">
        {order.map(seat => {
          const p = players[seat];
          const out = (st.eliminated || []).includes(seat);
          return (
            <div key={seat} className={'st-turn-row' + (seat === active ? ' is-active' : '') + (out ? ' is-out' : '') + (seat === myIdx ? ' is-me' : '') + (seat === focusSeat ? ' is-focus' : '')}
              onClick={onFocus && seat !== myIdx ? () => onFocus(seat) : undefined}
              title={onFocus && seat !== myIdx ? 'Show this player\'s board' : undefined}>
              <span className="st-turn-name">{seat === active ? '▶ ' : ''}{(st.botSeats || []).includes(seat) ? '🤖 ' : ''}{p.username}</span>
              <span className="st-turn-actors" title="Heroes that can still act this round">{out ? '✖' : '⚔'.repeat(Math.min(3, readyHeroes(seat))) || '–'}</span>
              {(st.passed || {})[seat] && <span className="st-turn-passed" title="Ended their round">⏹</span>}
            </div>
          );
        })}
      </div>
      {!isSpectator && (st.eliminated || []).includes(myIdx) && !gameState.result && (
        <div className="st-turn-out orbit-font">ELIMINATED — watching</div>
      )}
      {myTurn && <div className="st-turn-yours orbit-font">YOUR TURN{left != null ? ` · ${Math.ceil(left / 1000)}s` : ''}</div>}
      {myTurn && (
        <button className="btn btn-danger st-pass-btn" disabled={!!st.busy}
          title="Give up your remaining actors for this round"
          onClick={() => socket.emit('st_pass_round', { roomId: gameState.roomId })}>
          END MY ROUND ⏹
        </button>
      )}
    </div>
  );
}

// Menü nach Klick auf einen eigenen Hero mit aktivem Effekt: Effekt oder einfacher Angriff.
function StHeroMenu({ menu, gameState, onClose }) {
  const hero = gameState.players[gameState.myIndex].heroes[menu.heroIdx];
  const effect = menu.effect || {};
  const label = effect.effectName || effect.label || 'Use hero effect';
  return (
    <div className="st-menu-backdrop" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }}>
      <div className="st-menu st-hero-menu" style={{ left: menu.x, top: menu.y + 6 }} onClick={e => e.stopPropagation()}>
        <div className="st-menu-title orbit-font">{hero && hero.name}</div>
        <button className="btn btn-accent2" onClick={() => { socket.emit('activate_hero_effect', { roomId: gameState.roomId, heroIdx: menu.heroIdx, charmedOwner: effect.charmedOwner }); onClose(); }}>
          ✨ {label}
        </button>
        <button className="btn" onClick={() => { socket.emit('st_attack', { roomId: gameState.roomId, heroIdx: menu.heroIdx }); onClose(); }}>
          ⚔ Attack
        </button>
      </div>
    </div>
  );
}

window.StTurnPanel = StTurnPanel;
window.StHeroMenu = StHeroMenu;
window.SkillTestLobby = SkillTestLobby;
window.SkillTestBattlePending = SkillTestBattlePending;
window.SkillTestCreateOptions = SkillTestCreateOptions;
window.SkillTestPrepScreen = SkillTestPrepScreen;
