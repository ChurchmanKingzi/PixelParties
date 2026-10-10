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
// ── Anonyme CPU-Sitze: schwarze Kachel mit Pixelart-Fragezeichen ────
// Bis zum Kampfbeginn haben CPU-Sitze weder Namen noch Gesicht (erst im Spiel: Name und Bild ihres mittleren Heroes).
const ST_UNKNOWN_GLYPH = [
  '..XXXXXX..',
  '.XXXXXXXX.',
  'XXX....XXX',
  'XX......XX',
  '........XX',
  '.......XXX',
  '.....XXXX.',
  '....XXXX..',
  '....XX....',
  '..........',
  '....XX....',
  '....XX....',
];
function StUnknownTile() {
  const rects = [];
  ST_UNKNOWN_GLYPH.forEach((row, y) => [...row].forEach((c, x) => { if (c === 'X') rects.push([x, y]); }));
  // Viewbox 14×16: Fragezeichen (10×12) mittig, 1 Pixel Schlagschatten nach rechts unten.
  return (
    <span className="st-unknown" aria-label="Unknown CPU" title="CPU — shows its middle hero once the battle starts">
      <svg viewBox="0 0 14 16" shapeRendering="crispEdges" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <rect x="0" y="0" width="14" height="16" fill="#050507" />
        {rects.map(([x, y]) => <rect key={'s' + x + ',' + y} x={x + 2} y={y + 2} width="1" height="1" fill="#2b2650" />)}
        {rects.map(([x, y]) => <rect key={'f' + x + ',' + y} x={x + 1} y={y + 1} width="1" height="1" fill={y < 6 ? '#9d90f2' : '#7d70d6'} />)}
      </svg>
    </span>
  );
}

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
        <span className="badge" style={{ background: lobby.type === 'ranked' ? 'rgba(255,170,0,.12)' : 'rgba(0,240,255,.12)', color: lobby.type === 'ranked' ? 'var(--accent4)' : 'var(--accent)' }}>
          {(lobby.type || 'unranked').toUpperCase()}
        </span>
        <a className="btn" href="/skilltest-learning.html" target="_blank" rel="noopener" style={{ textDecoration: 'none', fontSize: 12 }}
          title="What the CPUs have learned: card values and test games against untrained CPUs">📊 BOT LEARNING</a>
        <VolumeControl />
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto' }} className="animate-in">
        <div className="panel" style={{ width: 760, maxWidth: '94%' }}>
          <div className="orbit-font" style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, textAlign: 'center' }}>
            {canStart
              ? (isHost ? '⚔️ Ready — start when you like.' : '⏳ Waiting for host to start...')
              : '⏳ Waiting for at least one more player or CPU...'}
          </div>

          <div className="st-lobby-grid">
            {Array.from({ length: ST_MAX_SEATS }).map((_, i) => {
              const seat = seats[i] || null;
              const kind = !seat ? 'is-empty' : seat.isHost ? 'is-host' : seat.isBot ? 'is-cpu' : 'is-player';
              return (
                <div key={i} className={'st-seat ' + kind}>
                  {seat && seat.isBot && isHost && (
                    <button className="btn st-seat-remove" title="Remove CPU"
                      onClick={() => socket.emit('st_remove_cpu', { roomId: lobby.id, username: seat.username })}>✕</button>
                  )}
                  <div className="st-seat-art">
                    {seat && seat.isBot
                      ? <StUnknownTile />
                      : <span>{seat ? (seat.isHost ? '👑' : '⚔️') : `${i + 1}`}</span>}
                  </div>
                  <div className="st-seat-name" title={seat ? seat.username : undefined}>{seat ? seat.username : 'Open Seat'}</div>
                  <div className="st-seat-role">{seat ? (seat.isHost ? 'HOST' : seat.isBot ? '🤖 CPU' : 'PLAYER') : ' '}</div>
                </div>
              );
            })}
          </div>

          <div style={{ background: 'var(--bg2)', borderRadius: 4, padding: '8px 12px', marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11, color: 'var(--text2)' }}>
            <div>🛠 Preparation timer: <strong style={{ color: 'var(--text)' }}>{cfg.prepTimerDisabled ? 'Off' : `${cfg.prepTimerSec}s`}</strong></div>
            <div>⏱ Turn timer: <strong style={{ color: 'var(--text)' }}>{cfg.turnTimerDisabled ? 'Off' : `${cfg.turnTimerSec}s`}</strong></div>
            {lobby.type === 'ranked' && (
              <div style={{ gridColumn: '1 / -1', color: '#ffbb33' }}>
                🏆 Ranked — placement among the human players changes your Ranked Elo (needs at least 2 humans; CPUs don't count).
              </div>
            )}
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
function SkillTestCreateOptions({ opts, setOpts, ranked }) {
  const set = (k, v) => setOpts(o => ({ ...o, [k]: v }));
  return (
    <>
      <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.5, padding: '6px 8px', border: '1px solid var(--bg4)', borderRadius: 4 }}>
        2–8 players (humans and CPUs). Everyone prepares a base from 18 random cards, then
        takes turns acting with one Hero or Creature at a time. No deck needed.
      </div>
      {ranked && (
        <div style={{ fontSize: 11, color: '#ffbb33', lineHeight: 1.5, padding: '6px 8px', border: '1px solid rgba(255,170,0,.35)', borderRadius: 4, background: 'rgba(255,170,0,.06)' }}>
          Ranked: your placement among the human players changes your normal Ranked Elo
          (1st +24 … last −24). CPUs don't count, and without at least 2 human players
          nothing is rated. Dropping out of a running game and not coming back costs −24.
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        {[['prepTimerSec', 'Preparation time (s)', 30, 1800], ['turnTimerSec', 'Time per turn (s)', 15, 600]].map(([key, label, lo, hi]) => {
          const off = Number(opts[key]) === 0;
          return (
            <div key={key} style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>{label}</div>
              <input className="input" type="number" min={0} max={hi} step={5} value={opts[key]}
                title={`0 = timer off, otherwise ${lo}–${hi} seconds`}
                onChange={e => set(key, e.target.value === '' ? '' : Math.max(0, Math.min(hi, parseInt(e.target.value, 10) || 0)))} />
              <div style={{ fontSize: 10, marginTop: 3, color: off ? '#ffc850' : 'var(--text2)' }}>{off ? 'Timer off' : `0 = timer off (min. ${lo})`}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}


// ═══════════════════════════════════════════
//  PIXEL-ART-BAUSTEINE
//  Gemalt wird in public/skilltest-art.js (kleine Leinwände, feste Paletten,
//  Verläufe nur über Dithering); hier stehen die React-Hüllen.
// ═══════════════════════════════════════════

/** Kerkerwand hinter der Vorbereitung: eine Pixel-Leinwand, hart hochskaliert. */
function StWall() {
  const ref = useRef(null);
  useEffect(() => {
    const A = window.SkillTestArt, cv = ref.current;
    if (!A || !cv) return undefined;
    let raf = 0;
    const paint = () => { raf = 0; const P = 4; A.paintWall(cv, Math.ceil(window.innerWidth / P), Math.ceil(window.innerHeight / P), 11); };
    const onResize = () => { if (!raf) raf = requestAnimationFrame(paint); };
    paint();
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); if (raf) cancelAnimationFrame(raf); };
  }, []);
  return <canvas ref={ref} className="st-wall" aria-hidden="true" />;
}

/** Hintergrund der Heimbasis (Dielen, Steinrahmen, Fackellicht) — füllt seinen Elternknoten, neu gemalt bei Größenänderung. */
function StBoardBackdrop() {
  const ref = useRef(null);
  useEffect(() => {
    const A = window.SkillTestArt, cv = ref.current;
    if (!A || !cv || !cv.parentElement) return undefined;
    const host = cv.parentElement;
    let raf = 0, last = '';
    const paint = () => {
      raf = 0;
      const sc = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--board-scale')) || 1;
      const P = Math.max(2, Math.round(3 * sc));
      const w = Math.max(60, Math.round(host.clientWidth / P)), h = Math.max(40, Math.round(host.clientHeight / P));
      if (w + 'x' + h === last) return;
      last = w + 'x' + h;
      A.paintBoard(cv, w, h, [{ x: 13, y: 3 }, { x: w - 13, y: 3 }], 5);
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(paint); };
    paint();
    const ro = new ResizeObserver(kick); ro.observe(host);
    return () => { ro.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, []);
  return <canvas ref={ref} className="st-board-backdrop" aria-hidden="true" />;
}

/** Wandfackel: Halterung, animierte Pixelflamme (6 Frames) und gedithertes Licht. */
function StTorch({ side }) {
  const A = window.SkillTestArt;
  if (!A) return null;
  const fl = A.torchFlame(), ho = A.torchHolder(), gl = A.torchGlow();
  return (
    <div className={'st-torch st-torch-' + side} aria-hidden="true">
      <div className="st-torch-glow" style={{ backgroundImage: `url(${gl.url})` }} />
      <div className="st-torch-flame" style={{ backgroundImage: `url(${fl.url})` }} />
      <div className="st-torch-holder" style={{ backgroundImage: `url(${ho.url})` }} />
    </div>
  );
}

function StCoin({ className }) {
  const A = window.SkillTestArt;
  return <span className={'st-coin' + (className ? ' ' + className : '')} style={A ? { backgroundImage: `url(${A.coin()})` } : undefined} aria-hidden="true" />;
}

// Recycler: der Deckel ist sein Mund. `lid` 0 (zu) … 4 (weit offen); `chew` lässt den Korpus beim Kauen wackeln.
function RecyclerContainer({ count, lid, chew, nextAt, artRef }) {
  const A = window.SkillTestArt;
  useEffect(() => {          // alle Deckelstellungen vorab dekodieren, damit der Wechsel nie aufblitzt
    if (!A) return;
    for (let i = 0; i < A.LID_FRAMES; i++) { const im = new Image(); im.src = A.recycler(i); if (im.decode) im.decode().catch(() => {}); }
  }, []);
  return (
    <div className={'st-recycler' + (chew ? ' is-chewing' : '') + (lid > 0 ? ' is-open' : '')} data-st-ziel="recycler" data-st-recycler="1">
      <div className="st-recycler-art-wrap">
        <div className="st-recycler-art" ref={artRef} style={A ? { backgroundImage: `url(${A.recycler(lid)})` } : undefined} />
        <div className="st-recycler-plate" title="Cards recycled so far">
          <span className="st-recycler-count">{count}</span>
        </div>
      </div>
      <div className="st-recycler-label orbit-font">RECYCLER</div>
      <div className="st-recycler-hint">{nextAt === 1 ? 'next card ejects a new one!' : `${nextAt} more → new card`}</div>
    </div>
  );
}

// ── Eigenes Ziehbild ──
// Das native Ziehbild eines Hand-Elements nimmt bei gefächerten, einander überdeckenden Karten Teile der Nachbarn mit.
// Deshalb (wie im Puzzle-Editor) bekommt der Browser nur ein unsichtbares 1×1-Bild; die Karte folgt dem Zeiger als gewöhnliches DOM-Element.
function stDragGhost(e, cardName) {
  const dt = e.dataTransfer;
  if (!dt || !dt.setDragImage) return;
  const q = e.currentTarget;
  const sicht = (q && q.querySelector && q.querySelector('.pz-hand-card-inner')) || q;
  const gb = sicht && sicht.offsetWidth > 0 ? Math.round(sicht.offsetWidth * 0.75) : 60;
  const gh = sicht && sicht.offsetHeight > 0 ? Math.round(sicht.offsetHeight * 0.75) : 84;
  const hx = gb / 2, hy = gh / 2;
  const old = document.getElementById('st-drag-ghost'); if (old) old.remove();
  const ghost = document.createElement('div');
  ghost.id = 'st-drag-ghost'; ghost.className = 'st-drag-ghost';
  ghost.style.width = gb + 'px'; ghost.style.height = gh + 'px';
  ghost.style.transform = `translate(${Math.round(e.clientX - hx)}px,${Math.round(e.clientY - hy)}px)`;
  const url = cardImageUrl(cardName);
  if (url) { const img = document.createElement('img'); img.src = url; img.draggable = false; img.alt = ''; ghost.appendChild(img); }
  else ghost.textContent = cardName;
  document.body.appendChild(ghost);
  const leer = document.createElement('div');
  leer.style.cssText = 'position:absolute;top:-1000px;left:-1000px;width:1px;height:1px;opacity:0;';
  document.body.appendChild(leer);
  dt.setDragImage(leer, 0, 0);
  setTimeout(() => { try { leer.remove(); } catch { /* weg */ } }, 0);
  let raf = 0, x = 0, y = 0;
  const setze = () => { raf = 0; ghost.style.transform = `translate(${x}px,${y}px)`; };
  const folge = (ev) => {
    if (!ev.clientX && !ev.clientY) return;                  // Firefox meldet bei `drag` 0/0
    x = Math.round(ev.clientX - hx); y = Math.round(ev.clientY - hy);
    if (!raf) raf = requestAnimationFrame(setze);
  };
  const ende = () => {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    document.removeEventListener('dragover', folge, true);
    document.removeEventListener('drag', folge, true);
    document.removeEventListener('dragend', ende, true);
    document.removeEventListener('drop', ende, true);
    ghost.remove();
  };
  document.addEventListener('dragover', folge, true);
  document.addEventListener('drag', folge, true);
  document.addEventListener('dragend', ende, true);
  document.addEventListener('drop', ende, true);
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

// Startschätzung der Maße (bei --board-scale 1): Brett, Seitenspalten (links Spielerliste, rechts Recycler); die Feinabstimmung misst das DOM
const ST_BOARD_W = 960, ST_SIDE_W = 230, ST_BOARD_H = 450;

// ── Klänge des Aufbaus ──
// Klang einer Aufbau-Handlung (Dateien aus public/sounds; Lautstärke regelt der Effektregler). `dedupe: 0`: jeder Aufruf spielt.
const stSfx = (name, o) => { if (window.playSFX) window.playSFX(name, { dedupe: 0, category: null, ...(o || {}) }); };

// Abstand (ms), in dem der Recycler die mitgebrachten Karten eines ausgespuckten Heroes nacheinander hinterherschießt
const ST_EXTRA_GAP = 380;

// Der Recycler in Zeitlupe vertont (passt zu den Zeiten in `playRecycle`): Karte saust in den Mund (0), Deckel schnappt zu (300–330),
// er kaut (420, 560), das Gold klimpert (700); bei einem Auswurf öffnet sich der Mund (780), die neue Karte schießt heraus (800)
// und landet nach ihrem Flug in der Hand (1580).
function stRecycleSounds(ev) {
  stSfx('shuffle', { rate: 0.9, volume: 0.8 });
  stSfx('discard', { delay: 300, volume: 1 });
  stSfx('placement', { delay: 330, rate: 0.55, volume: 0.9 });
  stSfx('heavy_impact', { delay: 420, rate: 1.7, volume: 0.3 });
  stSfx('heavy_impact', { delay: 560, rate: 1.5, volume: 0.28 });
  stSfx('gold_gain', { delay: 700, volume: 0.9 });
  if (ev && ev.ejected) {
    stSfx('summon', { delay: 780, rate: 1.4, volume: 0.8 });
    stSfx('ping', { delay: 800, rate: 1.3, volume: 0.9 });
    stSfx('draw', { delay: 1580, volume: 1 });
    // Bringt der Hero weitere Karten mit (Partner …), spuckt der Recycler sie nacheinander hinterher aus
    (ev.extras || []).forEach((_, i) => {
      const t = (i + 1) * ST_EXTRA_GAP;
      stSfx('ping', { delay: 800 + t, rate: 1.3 + 0.08 * (i + 1), volume: 0.8 });
      stSfx('draw', { delay: 1580 + t, volume: 0.9 });
    });
  }
}

function SkillTestPrepScreen({ lobby, user, leaveRoom, notify }) {
  const R = window.SkillTestRules;
  const [view, setView] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [drag, setDrag] = useState(null);           // { name, src }
  const [startMenu, setStartMenu] = useState(null); // { hi, slot, x, y }
  const [lid, setLid] = useState(0);                // Deckelstellung des Recyclers (0 zu … 4 weit offen)
  const [chew, setChew] = useState(false);
  const [hidden, setHidden] = useState(() => new Map());   // Karten (Name → Anzahl), die noch aus dem Recycler zur Hand fliegen
  const [popped, setPopped] = useState(null);                // gerade gelandete Karte (kurzes Aufploppen)
  const offsetRef = useRef(0);
  const mainRef = useRef(null);
  const dragRef = useRef(null);
  const flyRef = useRef(null);
  const recArtRef = useRef(null);
  const dropRef = useRef(null);                     // wo die zuletzt in den Recycler geworfene Karte losgelassen wurde
  const fxTimers = useRef([]);
  const lidTimers = useRef([]);
  const dragOverRecycler = useRef(false);
  const { tooltipCard, showTooltip, hideTooltip } = useCardTooltip({ defaultSide: 'left' });
  const heldenAnzeigen = user && user.display_heroes != null ? !!user.display_heroes : true;

  const later = (list, ms, fn) => { const id = setTimeout(fn, ms); list.current.push(id); return id; };
  const clearList = (list) => { list.current.forEach(clearTimeout); list.current = []; };

  // ── Flug einer Karte (Fixed-Ebene über allem), per Web Animations ──
  // a/b: { x, y } Mittelpunkte im Fenster; a.w/a.h = Kartenmaß am Start
  const flyCard = (name, a, b, o) => {
    const opt = { ms: 600, s0: 1, s1: 1, r0: 0, r1: 0, lift: 0, ease: 'cubic-bezier(.35,.6,.3,1)', fade: false, onDone: null, ...(o || {}) };
    const layer = flyRef.current;
    if (!layer || !layer.animate) { if (opt.onDone) opt.onDone(); return; }
    const w = a.w || 60, h = a.h || 84;
    const el = document.createElement('div');
    el.className = 'st-fly-card';
    el.style.width = w + 'px'; el.style.height = h + 'px';
    const url = cardImageUrl(name);
    if (url) { const img = document.createElement('img'); img.src = url; img.draggable = false; img.alt = ''; el.appendChild(img); }
    else el.textContent = name;
    layer.appendChild(el);
    const tr = (p, s, r) => `translate(${Math.round(p.x - w / 2)}px,${Math.round(p.y - h / 2)}px) rotate(${r}deg) scale(${s})`;
    const mid = { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - opt.lift };
    const frames = [{ transform: tr(a, opt.s0, opt.r0), opacity: 1 }];
    if (opt.lift) frames.push({ transform: tr(mid, (opt.s0 + opt.s1) / 2 + 0.12, (opt.r0 + opt.r1) / 2), opacity: 1, offset: 0.5 });
    frames.push({ transform: tr(b, opt.s1, opt.r1), opacity: opt.fade ? 0.2 : 1 });
    const anim = el.animate(frames, { duration: opt.ms, easing: opt.ease, fill: 'forwards' });
    const done = () => { el.remove(); if (opt.onDone) opt.onDone(); };
    anim.onfinish = done;
    anim.oncancel = done;
  };

  // Deckel nach Drehbuch bewegen: [[ms, stellung], …]
  const runLid = (script) => {
    clearList(lidTimers);
    script.forEach(([ms, frame]) => { if (ms <= 0) setLid(frame); else later(lidTimers, ms, () => setLid(frame)); });
  };

  // ── Recycler: frisst die Karte (Deckel kaut), bei Auswurf spuckt er die neue aus und sie fliegt zur Hand ──
  const playRecycle = (ev, st) => {
    const art = recArtRef.current, ar = art && art.getBoundingClientRect();
    const mouth = ar ? { x: ar.left + ar.width * 0.5, y: ar.top + ar.height * 0.42 } : { x: window.innerWidth - 150, y: window.innerHeight / 2 };
    const drop = dropRef.current; dropRef.current = null;
    const from = drop || { x: window.innerWidth / 2, y: window.innerHeight - 140, w: 64, h: 90 };
    // 1) die gefressene Karte fliegt in den Mund, schrumpfend und kippend
    const eaten = ev.card || (drop && drop.name);
    if (eaten) flyCard(eaten, from, mouth, { ms: 360, s0: 1, s1: 0.18, r0: 0, r1: 24, ease: 'cubic-bezier(.5,0,.9,.6)', fade: true });
    const script = [[0, 4], [330, 1], [400, 3], [470, 0]];
    later(fxTimers, 300, () => setChew(true));
    later(fxTimers, 760, () => setChew(false));
    if (ev.ejected) {
      // 2) Auswurf: Mund auf, Karte schießt heraus, fliegt im Bogen zur Hand — die mitgebrachten Karten (Partner …) folgen nacheinander
      const names = [ev.ejected, ...(ev.extras || [])];
      const pending = {};                                   // Name → Exemplare, die noch nicht abgeflogen sind
      names.forEach(n => { pending[n] = (pending[n] || 0) + 1; });
      setHidden(h => { const m = new Map(h); names.forEach(n => m.set(n, (m.get(n) || 0) + 1)); return m; });
      const lastLaunch = 820 + (names.length - 1) * ST_EXTRA_GAP;
      script.push([760, 4], [lastLaunch + 410, 2], [lastLaunch + 510, 0]);
      names.forEach((name, k) => {
        later(fxTimers, 820 + k * ST_EXTRA_GAP, () => {
          const unhide = () => {
            setHidden(h => { const m = new Map(h); const c = (m.get(name) || 0) - 1; if (c > 0) m.set(name, c); else m.delete(name); return m; });
            setPopped(name); later(fxTimers, 360, () => setPopped(p => (p === name ? null : p)));
          };
          // bei gleichnamigen Karten in der Hand: die ausgespuckten sind die letzten Exemplare — das nächste noch nicht gelandete nehmen
          const all = document.querySelectorAll('.st-hand .pz-hand-card[data-st-card="' + name.replace(/"/g, '\\"') + '"]');
          const target = all[Math.max(0, all.length - pending[name])];
          pending[name]--;
          if (!target) { unhide(); return; }
          const tr = target.getBoundingClientRect();
          const cw = (target.querySelector('.pz-hand-card-inner') || target).offsetWidth || 64;
          const ch = (target.querySelector('.pz-hand-card-inner') || target).offsetHeight || 90;
          const arH = ar ? ar.height : 200;
          flyCard(name, { x: mouth.x, y: mouth.y - arH * 0.1, w: cw, h: ch },
            { x: tr.left + tr.width / 2, y: tr.top + tr.height / 2 },
            { ms: 760, s0: 0.35, s1: 1, r0: -14 + 5 * k, r1: 0, lift: Math.max(120, arH * 0.7) + 24 * k, ease: 'cubic-bezier(.3,.4,.35,1)', onDone: unhide });
        });
      });
    }
    runLid(script);
  };

  // ── Verbindung ──
  useEffect(() => {
    const onState = (st) => {
      if (st.roomId !== lobby.id) return;
      offsetRef.current = st.serverNow - Date.now();
      setView(prev => ({ ...(prev || {}), ...st }));
      if (st.event && st.event.type === 'recycle') {
        playRecycle(st.event, st);
        stRecycleSounds(st.event);
      }
    };
    const onErr = (e) => { notify && notify(e.reason || 'Not allowed', 'error'); if (window.playSFX) window.playSFX('ui_cancel', { volume: 1.0 }); };
    socket.on('st_prep_state', onState);
    socket.on('st_prep_error', onErr);
    socket.emit('st_prep_sync', { roomId: lobby.id });
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => {
      socket.off('st_prep_state', onState); socket.off('st_prep_error', onErr); clearInterval(tick);
      clearList(fxTimers); clearList(lidTimers);
    };
  }, [lobby.id]);

  // ── Brett-Skalierung (wie der Puzzle-Editor: globale --board-scale) ──
  // Die Zonengröße hängt zusätzlich an Fensterbreiten-Stufen des Stylesheets; deshalb wird nicht gerechnet, sondern gemessen:
  // Maßstab setzen, das Brett messen, nachziehen, bis es samt Seitenspalten in den Hauptbereich passt.
  useEffect(() => {
    const el = mainRef.current; if (!el) return undefined;
    const root = document.documentElement;
    const apply = () => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const clampSc = (v) => Math.max(0.5, Math.min(1.35, v));
      let sc = clampSc(Math.min((r.width - 36) / (ST_BOARD_W + 2 * ST_SIDE_W), r.height / ST_BOARD_H));
      for (let k = 0; k < 5; k++) {
        root.style.setProperty('--board-scale', sc.toFixed(3));
        const base = el.querySelector('.st-base');
        if (!base || !base.offsetWidth) break;
        const f = Math.min((r.width - 36 - 2 * ST_SIDE_W * sc) / base.offsetWidth, (r.height - 2) / base.offsetHeight);
        if (Math.abs(f - 1) < 0.02 && f <= 1.0001) break;
        sc = clampSc(sc * (1 + (f - 1) * 0.92));
      }
      // Handkarten: auf niedrigen Fenstern etwas kleiner, damit das Brett Platz behält
      const hs = Math.max(0.9, Math.min(1.3, window.innerHeight / 700));
      el.parentElement.style.setProperty('--hand-card-scale', hs.toFixed(2));
    };
    apply();
    const ro = new ResizeObserver(apply); ro.observe(el);
    window.addEventListener('resize', apply);
    return () => { ro.disconnect(); window.removeEventListener('resize', apply); root.style.setProperty('--board-scale', '1'); };
  }, [!!view]);

  const ps = view && view.me;

  // Was der Server angenommen hat, macht ein Geräusch (Platzieren, Zurücklegen, Heldentausch, erschienene Karten, Bereit …) —
  // nicht schon das Loslassen: abgelehnte Züge bleiben still (dort kommt der Fehlerton). Recycler-Züge vertont `stRecycleSounds`.
  const prevPsRef = useRef(null);
  useEffect(() => {
    if (!ps) return;
    const prev = prevPsRef.current;
    prevPsRef.current = ps;
    if (!R || !R.prepSounds) return;
    for (const [name, o] of R.prepSounds(prev, ps)) stSfx(name, o);
  }, [ps]);
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
    stDragGhost(e, name);
    stSfx('draw', { volume: 0.4, rate: 1.5, dedupe: 60 });          // Karte aufgenommen
    dragRef.current = { name, src };
    if (window.setHandDragFlag) window.setHandDragFlag(true);
    setTimeout(() => setDrag({ name, src }), 0);
  };
  const endDrag = () => {
    dragRef.current = null; setDrag(null);
    if (window.setHandDragFlag) window.setHandDragFlag(false);
    clearTargetMark();
    if (dragOverRecycler.current) { dragOverRecycler.current = false; if (!lidTimers.current.length) setLid(0); }
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
    if (hit) dispatchDrop(d, hit.t, e);
    endDrag();
  };
  const dispatchDrop = (d, t, e) => {
    if (t.kind === 'recycler') {
      const g = document.getElementById('st-drag-ghost');
      const gr = g && g.getBoundingClientRect();
      dropRef.current = { name: d.name, x: e ? e.clientX : window.innerWidth / 2, y: e ? e.clientY : window.innerHeight / 2, w: gr ? gr.width : 64, h: gr ? gr.height : 90 };
      send({ type: 'recycle', from: d.src });
    }
    else if (t.kind === 'hand') send({ type: 'unplace', from: d.src });
    else send({ type: 'place', from: d.src, to: t });
  };
  // Hand & Recycler sind eigene Ziele (außerhalb des Brett-Wrappers)
  const dropOn = (kind) => ({
    onDragOver: (e) => {
      if (dragRef.current && acceptsAt({ kind })) {
        e.preventDefault(); e.dataTransfer.dropEffect = 'move'; e.currentTarget.setAttribute('data-st-target', '1');
        if (kind === 'recycler' && !dragOverRecycler.current) { dragOverRecycler.current = true; clearList(lidTimers); setLid(3); stSfx('shuffle', { rate: 0.55, volume: 0.7, dedupe: 150 }); }   // Mund auf, sobald eine Karte darüber schwebt
      }
    },
    onDragLeave: (e) => {
      e.currentTarget.removeAttribute('data-st-target');
      if (kind === 'recycler' && dragOverRecycler.current) { dragOverRecycler.current = false; clearList(lidTimers); setLid(0); stSfx('placement', { rate: 0.6, volume: 0.35, dedupe: 150 }); }
    },
    onDrop: (e) => {
      const d = dragRef.current; if (!d) return;
      e.preventDefault(); e.currentTarget.removeAttribute('data-st-target');
      dragOverRecycler.current = false;
      if (acceptsAt({ kind })) dispatchDrop(d, { kind }, e);
      else if (kind === 'recycler') setLid(0);
      endDrag();
    },
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
      <div className="screen-full ui-noscale st-prep st-loading">
        <StWall />
        <div className="top-bar"><button className="btn btn-danger" onClick={leaveRoom}>LEAVE</button><h2 className="orbit-font" style={{ fontSize: 14, color: 'var(--accent)' }}>🎯 SKILL TEST — PREPARATION</h2></div>
        <div className="st-chips" style={{ margin: 'auto', flexWrap: 'wrap', justifyContent: 'center', maxWidth: 700 }}>
          {view.players.map(p => (
            <span key={p.idx} className={'st-chip' + (p.ready ? ' is-ready' : '')}>
              {p.isBot ? <StUnknownTile /> : <b>♟</b>}
              <span>{p.username}</span><i>{p.ready ? '✓' : '…'}</i>
            </span>
          ))}
        </div>
      </div>
    );
  }
  if (!view || !ps) {
    return (
      <div className="screen-full ui-noscale st-prep st-loading"><StWall /><div className="orbit-font" style={{ margin: 'auto', fontSize: 16 }}>Preparing your base…</div></div>
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
            <div className={'board-zone board-zone-hero' + (heroName ? ' zone-has-card' : '')} style={boardSkin('hero')}
              {...zoneProps({ kind: 'hero', hi }, heroName, { kind: 'hero', hi })}
              onMouseEnter={() => c && showTooltip(c, 'left')} onMouseLeave={hideTooltip}>
              {heroName
                ? <BoardCard cardName={heroName} hp={c ? c.hp : undefined} maxHp={c ? c.hp : undefined} atk={c ? c.atk : undefined} hpPosition="hero" />
                : <div className="board-zone-empty">Hero</div>}
              {/* Animierter Held, der auf der Karte steht — dieselbe Figur wie im laufenden Spiel */}
              {heroName && heldenAnzeigen && window.HeroIdleSprite && <window.HeroIdleSprite cardName={heroName} />}
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
              const spawned = !!(top && R.isSpawned(ps, hi, slot));   // aus dem Nichts erschienen (Idej Lord): nur löschen, nie aufnehmen/recyceln
              return (
                <div key={slot} className={'board-zone board-zone-support' + (spawned ? ' st-spawned' : '')} style={boardSkin('support')}
                  title={spawned ? 'Aus dem Nichts erschienen — Rechtsklick löscht die Karte (kein Recyceln)' : undefined}
                  {...zoneProps({ kind: 'support', hi, slot }, top, spawned ? null : { kind: 'support', hi, slot },
                    spawned ? () => send({ type: 'deleteSpawned', hi, slot }) : undefined)}
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

  // ── Hand (rechts daneben: Gold, wie im Puzzle-Editor) ──
  const hand = ps.hand;
  // noch fliegende Karten: von hinten je Name so viele Exemplare ausblenden, wie unterwegs sind
  const hiddenIdx = new Set();
  hidden.forEach((cnt, name) => { let c = cnt; for (let i = hand.length - 1; i >= 0 && c > 0; i--) if (hand[i] === name && !hiddenIdx.has(i)) { hiddenIdx.add(i); c--; } });
  const handEl = (
    <div className="pz-hand st-hand" {...dropOn('hand')} data-st-ziel="hand">
      <span className="pz-hand-label orbit-font">HAND ({hand.length})</span>
      <div className="pz-hand-cards" style={{ '--hand-max-lift': window.handFanMaxLift ? window.handFanMaxLift(hand.length) : 0 }}>
        {hand.map((cardName, i) => {
          const img = cardImageUrl(cardName);
          const verborgen = hiddenIdx.has(i);
          const gezogen = drag && drag.src.kind === 'hand' && drag.src.idx === i;
          const fan = window.handFanStyle ? window.handFanStyle(i, hand.length, { seite: 'me' }) : {};
          return (
            <div key={cardName + ':' + i}
              data-st-card={cardName}
              className={'pz-hand-card' + (gezogen ? ' pz-hand-card-dragging' : '') + (popped === cardName ? ' st-hand-pop' : '')}
              style={verborgen ? { ...fan, visibility: 'hidden' } : fan}
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
      <div className="pz-hand-extras st-hand-extras" title={`Gold you take into the battle (${view.recycleGold} per recycled card)`}>
        <div className="st-gold"><StCoin /><span className="st-gold-num">{view.gold}</span></div>
        <div className="st-gold-lbl orbit-font">GOLD</div>
      </div>
    </div>
  );

  return (
    <div className="screen-full ui-noscale st-prep" onDragOver={(e) => { if (dragRef.current) e.preventDefault(); }} onDrop={() => { if (dragRef.current) endDrag(); }}>
      <StWall />
      <div className="top-bar st-topbar">
        <button className="btn btn-danger" onClick={leaveRoom}>LEAVE</button>
        <h2 className="orbit-font" style={{ fontSize: 14, color: 'var(--accent)' }}>🎯 SKILL TEST — PREPARATION</h2>
        {remaining != null && <span className={'badge st-timer' + (remaining < 30000 ? ' st-timer-low' : '')}>⏱ {fmtTime(remaining)}</span>}
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
      </div>

      <div className="st-main" ref={mainRef}>
        <aside className="st-players">
          <div className="st-players-title orbit-font">PLAYERS · {readyCount}/{view.players.length}</div>
          {view.players.map(p => (
            <div key={p.idx} className={'st-player' + (p.ready ? ' is-ready' : '') + (p.idx === view.you ? ' is-me' : '')} title={p.ready ? 'Ready' : 'Preparing…'}>
              <span className="st-player-ava">{p.isBot ? <StUnknownTile /> : <b>{(p.username || '?').slice(0, 1).toUpperCase()}</b>}</span>
              <span className="st-player-name">{p.username}</span>
              <i className="st-player-state">{p.ready ? '✓' : '…'}</i>
            </div>
          ))}
        </aside>

        <div className="st-base-wrap" onDragOver={onWrapDragOver} onDrop={onWrapDrop}>
          <div className="st-base">
            <StBoardBackdrop />
            <StTorch side="left" />
            <StTorch side="right" />
            <div className="st-base-banner orbit-font">{user.username}'s Home Base</div>
            <div className="board-plane-clip st-plane-clip">
              <div className="board-plane st-plane">
                <div className="board-player-side st-side">
                  {heroRow}{abilityRow}{supportRow}
                </div>
              </div>
              <window.HeroSpriteEbene />
            </div>
          </div>
        </div>

        <div className="st-side-col">
          <div {...dropOn('recycler')}>
            <RecyclerContainer count={ps.recycled} lid={lid} chew={chew} nextAt={nextAt} artRef={recArtRef} />
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

      <div className="st-fly-layer" ref={flyRef} aria-hidden="true" />
      <div className="board-tooltip">{tooltipCard && <CardTooltipContent card={tooltipCard} />}</div>
    </div>
  );
}

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
    <div className="screen-full ui-noscale st-prep st-loading">
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
  // Server-Uhr: beim Eintreffen eines neuen Zustands (neues `serverNow`) einmal merken, wie die Client-Uhr dazu steht, und von dort weiterzählen.
  // (Früher wurde `Date.now()` bei JEDEM Neuzeichnen neu abgezogen — die Differenz blieb dadurch bei ~90 s stehen und sprang nur um den 500-ms-Takt.)
  const clockRef = useRef({ serverNow: null, at: 0 });
  if (clockRef.current.serverNow !== st.serverNow) clockRef.current = { serverNow: st.serverNow, at: Date.now() };
  const serverNowEst = st.serverNow + (Math.max(now, Date.now()) - clockRef.current.at);
  const left = st.turnDeadline ? Math.max(0, st.turnDeadline - serverNowEst) : null;
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
