// ═══════════════════════════════════════════
//  PIXEL PARTIES — SCREEN COMPONENTS
//  AuthScreen, MainMenu, ProfileScreen, ShopScreen
// ═══════════════════════════════════════════
const { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, useContext } = React;
const { api, socket, AppContext, CardMini, cardImageUrl,
        typeColor, skinImageUrl, CardTooltipContent, isDeckLegal } = window;
const { ALL_CARDS, CARDS_BY_NAME, AVAILABLE_CARDS, AVAILABLE_MAP, SKINS_DB } = window;
const { useAntoniaPresent, setAntoniaPresent, tutorialStartsWithAntonia } = window;
const { GlanzBand, LotsenGlanz } = window;   // v1264: Glanzband + Lotsen-Schein

// Eye / eye-off glyphs for the password show/hide toggle.
const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

// Text input with an inline show/hide toggle. Reused by the auth screen
// and the profile password-change form.
function PasswordInput({ value, onChange, placeholder, onEnter, autoFocus, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div className="pw-field">
      <input
        className="input" type={show ? 'text' : 'password'} placeholder={placeholder}
        value={value} autoFocus={autoFocus} autoComplete={autoComplete || 'current-password'}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && onEnter) onEnter(); }}
      />
      <button type="button" className="pw-toggle" tabIndex={-1}
        aria-label={show ? 'Hide password' : 'Show password'}
        onClick={() => setShow(s => !s)}>
        {show ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}
window.PasswordInput = PasswordInput;

// Button that opens the community Discord invite in a new tab. Reused on
// the auth/title screen (compact pill) and the main menu (`block` — a
// full-width banner whose logo fills the width, so its height scales with
// it). Returned by the auth/title screen and the main menu.
function DiscordButton({ size = 22, label, block, style, className }) {
  return (
    <a href="https://discord.gg/K8PFRjr" target="_blank" rel="noopener noreferrer"
      className={'discord-btn' + (block ? ' discord-btn--block' : '') + (className ? ' ' + className : '')}
      title="Join our Discord" style={style}>
      {/* Pixel-Logo statt Vektor-Marke — passt zu den Pixel-Knoepfen. */}
      <PixelIcon name="discord" className="discord-btn-logo" style={block ? undefined : { width: size }} />
      {label && !block && <span className="discord-btn-label">{label}</span>}
    </a>
  );
}
window.DiscordButton = DiscordButton;

// Inline currency coin — used in place of a spelled-out "SC" so the coin
// icon alone signifies money. `size` in px.
const CoinIcon = ({ size = 14, style }) => (
  <img src="/data/sc.png" alt="coins" draggable={false}
    style={{ width: size, height: size, imageRendering: 'pixelated', verticalAlign: 'middle', ...style }} />
);

// ═══════════════════════════════════════════
//  TUTORIAL FLOW (shared)
//  Drives the "How to Play" tutorial system used by both the main menu's
//  HOW TO PLAY button and the VS-CPU screen's Tutorial Raccoon. The hook
//  owns the tutorial list, the live attempt board state, and the Monia-Bot
//  intro textboxes. The CALLER owns: when the browser is open, BGM, the
//  Escape key, and rendering the GameBoard while an attempt is in progress
//  (both menus already do the latter for their other game modes).
// ═══════════════════════════════════════════
function useTutorialFlow(open) {
  const { notify } = useContext(AppContext);
  const [tutorialList, setTutorialList] = useState(null);
  const [tutorialAttemptState, setTutorialAttemptState] = useState(null);
  const tutorialAttemptRoom = useRef(null);

  // Fetch the tutorial list whenever the browser opens.
  useEffect(() => {
    if (!open) return;
    socket.emit('get_tutorials');
    const onList = (list) => setTutorialList(list);
    socket.on('tutorial_list', onList);
    return () => socket.off('tutorial_list', onList);
  }, [open]);

  // Receive the board state for a running tutorial attempt.
  useEffect(() => {
    if (!open) return;
    const onGameState = (state) => {
      if (state.isPuzzle && state.isTutorial && !window._tutorialGaveUp) {
        tutorialAttemptRoom.current = state.roomId;
        setTutorialAttemptState(state);
      }
    };
    const onError = (msg) => notify('Tutorial error: ' + msg, 'error');
    socket.on('game_state', onGameState);
    socket.on('puzzle_error', onError);
    return () => { socket.off('game_state', onGameState); socket.off('puzzle_error', onError); };
  }, [open, notify]);

  // Show the Monia-Bot intro textbox when a stage's board first loads (and
  // again on a retry, which arrives under a new roomId).
  const tutorialIntroShownRef = useRef(null);
  const tutorialRoomIdRef = useRef(null);
  useEffect(() => {
    if (!tutorialAttemptState) {
      // Kein Tutorial mehr: der angezeigte Gegner faellt zurueck auf "CPU".
      tutorialRoomIdRef.current = null;
      if (window.setTutorialGegner) window.setTutorialGegner(null);
      return;
    }
    if (tutorialAttemptState.result) return;
    if (tutorialAttemptState.roomId !== tutorialRoomIdRef.current) {
      tutorialRoomIdRef.current = tutorialAttemptState.roomId;
      tutorialIntroShownRef.current = null;
      // Neuer Durchgang (auch ein Retry): Gegner ist, wer zuerst spricht.
      if (window.setTutorialGegner && window.tutorialErsterSprecher) {
        window.setTutorialGegner(window.tutorialErsterSprecher(window._currentTutorialNum));
      }
    }
    const num = window._currentTutorialNum;
    if (!num || tutorialIntroShownRef.current === num) return;
    const script = (window.TUTORIAL_SCRIPTS || {})[num];
    if (script?.intro) {
      tutorialIntroShownRef.current = num;
      setTimeout(() => {
        const introPages = Array.isArray(script.intro) ? script.intro : undefined;
        const introText = typeof script.intro === 'string' ? script.intro : undefined;
        showTextBox({
          speaker: '/MoniaBot.png',
          speakerName: 'Monia Bot',
          ...(introPages ? { pages: introPages } : { text: introText }),
          ...(script.opts || {}),
        });
      }, 600);
    }
  }, [tutorialAttemptState]);

  const startTutorialAttempt = useCallback((tutorial) => {
    window._currentTutorialNum = tutorial.num;
    window._currentTutorialRetryId = tutorial.tutorialId;
    window._tutorialGaveUp = false;
    socket.emit('start_tutorial_attempt', { tutorialId: tutorial.tutorialId });
  }, []);

  const onTutorialAttemptLeave = useCallback(() => {
    const roomId = tutorialAttemptRoom.current;
    const result = tutorialAttemptState?.result;
    if (roomId) socket.emit('leave_game', { roomId });
    setTutorialAttemptState(null);
    tutorialAttemptRoom.current = null;
    tutorialIntroShownRef.current = null;
    window._currentTutorialNum = null;
    socket.emit('get_tutorials');
    if (result) {
      const success = result.isPuzzle && result.puzzleResult === 'success';
      notify(success ? '📖 Stage cleared!' : 'Stage not cleared — try again!', success ? 'success' : 'info');
    }
  }, [tutorialAttemptState, notify]);

  return { tutorialList, tutorialAttemptState, startTutorialAttempt, onTutorialAttemptLeave };
}

// Modal listing the tutorial missions (with progression locks) plus an
// always-available rules entry. Presentational — the caller owns open state
// and supplies onViewRules (the menu navigates to the Rules screen; the
// VS-CPU screen, reachable by guests who can't change screens, shows Rules
// in place).
function TutorialBrowserModal({ onClose, tutorialList, onStart, onViewRules }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="menu-popup-dither pp-fenster" style={{ background: 'var(--bg2)', width: 420, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div className="pp-fenster-kopf" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', position: 'relative' }}>
          <h3 className="orbit-font title-outline" style={{ fontSize: 22, fontWeight: 800, color: 'var(--player-color)', margin: 0, whiteSpace: 'nowrap', position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>HOW TO PLAY</h3>
          <button className="btn" onClick={onClose} style={{ padding: '2px 10px', fontSize: 10 }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 20px 20px' }}>
          {tutorialList === null ? (
            <div style={{ color: 'var(--text2)', textAlign: 'center', padding: 30, fontSize: 13 }}>Loading tutorials...</div>
          ) : tutorialList.length === 0 ? (
            <div style={{ color: 'var(--text2)', textAlign: 'center', padding: 30, fontSize: 13 }}>No tutorials available yet.</div>
          ) : (
            tutorialList.map((t) => (
              <button key={t.tutorialId} className="btn" disabled={t.locked}
                onClick={() => { if (!t.locked) onStart(t); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', fontSize: 13, marginBottom: 4, borderColor: 'rgba(255,68,204,.25)', color: t.locked ? 'var(--text2)' : 'var(--text1)', textAlign: 'left', justifyContent: 'flex-start', opacity: t.locked ? 0.55 : 1, cursor: t.locked ? 'not-allowed' : 'pointer' }}>
                <span style={{ color: t.locked ? 'var(--text2)' : (t.completed ? '#33ff88' : 'var(--bg4)'), fontSize: 16, width: 20, textAlign: 'center' }}>
                  {t.locked ? '🔒' : (t.completed ? '✓' : '○')}
                </span>
                <span style={{ color: t.locked ? 'var(--text2)' : '#ff44cc', fontSize: 11, width: 24, flexShrink: 0 }}>{t.num}.</span>
                <span style={{ flex: 1 }}>{t.name}</span>
                {t.locked
                  ? <span style={{ fontSize: 9, color: 'var(--text2)' }}>LOCKED</span>
                  : (t.completed && <span style={{ fontSize: 9, color: 'var(--text2)' }}>CLEARED</span>)}
              </button>
            ))
          )}
          {/* Always-available rules entry — bottom-most, never locked. */}
          <button className="btn" onClick={onViewRules}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', fontSize: 13, marginTop: 10, borderColor: 'rgba(255,68,204,.45)', color: 'var(--text1)', textAlign: 'left', justifyContent: 'flex-start', cursor: 'pointer' }}>
            <span style={{ color: '#ff44cc', fontSize: 16, width: 20, textAlign: 'center' }}>📜</span>
            <span style={{ flex: 1, fontWeight: 700 }}>View Rules</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  ANIMATED TITLE BACKDROP (auth / sign-up screen)
//  A layered, looping battle scene that replaces the still title.png:
//  a laser-clash centrepiece (two tethered shooters + a scaling burst),
//  idle-floating characters, rising embers, a pulsing bloom, impact flash
//  and vignette. Full spec in data/animated_screen/README.md; keyframes +
//  layer styling live in style.css (`.anim-*` / `@keyframes ab-*`). Art is
//  served from /data/animated_screen/layers2/. Purely cosmetic; sits behind
//  the auth panel and is pointer-events:none.
// ═══════════════════════════════════════════
const ANIM_LAYERS_DIR = '/data/animated_screen/layers2/';

// ── ZUSCHNITT DER KULISSEN-EBENEN (v1265, Al 22.9.: „der Login-Screen
// ruckelt") ─────────────────────────────────────────────────────────────
// Jede Figur liegt als eigenes 1920×1080-Bild vor, fast ganz transparent,
// und wurde bisher als VOLLBILD-Ebene (`inset: 0`) animiert. Zehn davon
// plus die Explosion bewegen sich staendig — der Compositor musste also
// in jedem Frame elf volle Bildschirmflaechen verrechnen, von denen je
// nur 1–38 % etwas zeigen. Ohne Grafikbeschleunigung (Als Opera zeigte
// im August „Software only") ist genau das der Hauptposten.
//
// Jetzt ist jede Ebene nur so gross wie ihr sichtbarer Inhalt (Rahmen
// unten, in Buehnenpixeln). Bild, Lage und Drehpunkt werden so
// umgerechnet, dass das Ergebnis PIXELGLEICH bleibt: `background-size`
// streckt das ganze Bild wieder auf Buehnengroesse, `background-position`
// schiebt den Ausschnitt an seinen Platz, `transform-origin` wird von
// Buehnen- in Rahmenprozent uebersetzt. Die Verzerrung auf Fenstern, die
// nicht 16:9 sind (`100% 100%`), bleibt ebenfalls erhalten.
//
// ★ Wer ein Ebenenbild austauscht, traegt hier den neuen Rahmen ein
// (Alpha-Huellkasten, z.B. `PIL.Image.open(f).split()[-1].getbbox()`).
// Fehlt ein Eintrag, faellt die Ebene auf das alte Vollbild zurueck —
// richtig, nur teurer.
const ANIM_BUEHNE_B = 1920, ANIM_BUEHNE_H = 1080;
const ANIM_SPRITE_RAHMEN = {
  'angel.png':      [0, 0, 788, 603],
  'blonde.png':     [92, 283, 689, 1080],
  'cat_bottom.png': [0, 428, 172, 536],
  'cat_mid.png':    [582, 215, 832, 373],
  'cat_top.png':    [353, 0, 544, 96],
  'explosion.png':  [609, 18, 1484, 806],
  'golem.png':      [1138, 74, 1920, 1080],
  'hammer.png':     [1135, 0, 1920, 577],
  'horned.png':     [1157, 390, 1920, 1080],
  'ninja.png':      [0, 303, 828, 1033],
  'rabbit.png':     [403, 479, 752, 803],
};
/**
 * Stil einer Kulissen-Ebene: auf den sichtbaren Rahmen zugeschnitten,
 * sonst identisch zur alten Vollbild-Ebene. `extra` wie bisher (Animation,
 * Bewegungsvariablen, `transformOrigin` in BUEHNEN-Prozent); `versatzX`
 * verschiebt die ganze Ebene waagerecht (vorher per `inset`).
 */
function animEbene(file, extra = {}, { versatzX } = {}) {
  const url = "url('" + ANIM_LAYERS_DIR + file + "')";
  const r = ANIM_SPRITE_RAHMEN[file];
  const { transformOrigin, ...rest } = extra;
  if (!r) {
    return { position: 'absolute', inset: 0, willChange: 'transform',
      background: url + ' center / 100% 100% no-repeat',
      ...(transformOrigin ? { transformOrigin } : {}), ...rest,
      ...(versatzX ? { left: versatzX, right: `calc(-1 * ${versatzX})` } : {}) };
  }
  const RAND = 2;   // Buehnenpixel Luft um den Alpha-Kasten (Kantenglaettung)
  const x0 = Math.max(0, r[0] - RAND), y0 = Math.max(0, r[1] - RAND);
  const x1 = Math.min(ANIM_BUEHNE_B, r[2] + RAND), y1 = Math.min(ANIM_BUEHNE_H, r[3] + RAND);
  const l = x0 / ANIM_BUEHNE_B, t = y0 / ANIM_BUEHNE_H;
  const w = (x1 - x0) / ANIM_BUEHNE_B, h = (y1 - y0) / ANIM_BUEHNE_H;
  const pct = (v) => (v * 100).toFixed(4) + '%';
  const [ox, oy] = (transformOrigin || '50% 50%').split(/\s+/).map(v => parseFloat(v) / 100);
  return {
    position: 'absolute',
    left: versatzX ? `calc(${pct(l)} + ${versatzX})` : pct(l),
    top: pct(t), width: pct(w), height: pct(h),
    willChange: 'transform',
    backgroundImage: url,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${pct(1 / w)} ${pct(1 / h)}`,
    // Prozent-Position: Punkt p des Bildes liegt auf Punkt p des Kastens —
    // fuer den Versatz −l·Buehne gilt p = l / (1 − w).
    backgroundPosition: `${w < 1 ? pct(l / (1 - w)) : '0%'} ${h < 1 ? pct(t / (1 - h)) : '0%'}`,
    transformOrigin: `${pct((ox - l) / w)} ${pct((oy - t) / h)}`,
    ...rest,
  };
}
function AnimatedTitleBackdrop() {
  // 46 randomized rising embers, generated once (see README §7).
  const embers = useMemo(() => {
    const colors = ['#ffd36b', '#ff8a3d', '#ff5a4d', '#ffe9a8', '#ffffff'];
    return Array.from({ length: 46 }, () => {
      const size = 2 + Math.random() * 5;
      return {
        size,
        dur: 7 + Math.random() * 9,
        delay: -Math.random() * 16,
        left: Math.random() * 100,
        // Horizontal drift as a % of screen width (±50px on the 1920 stage).
        drift: +((Math.random() * 2 - 1) * 2.604).toFixed(3),
        color: colors[Math.floor(Math.random() * colors.length)],
      };
    });
  }, []);
  // Ebenen: `animEbene` (oben) — zugeschnitten, sonst wie die alten
  // Vollbild-Ebenen (Streckung `100% 100%`, auf Nicht-16:9-Fenstern
  // gestaucht statt beschnitten).
  const layer = animEbene;
  return (
    <div className="anim-backdrop" aria-hidden="true">
      <div className="anim-shake">
        {/* 0 — background plate (overscanned so shake never reveals edges) */}
        <div style={{ position: 'absolute', inset: '-2%', background: "url('" + ANIM_LAYERS_DIR + "background.png') center / 100% 100% no-repeat" }} />
        {/* Impact flash + lightning FLASHES render BELOW the characters
            (screen-blended onto the background plate only) so they never light the
            laser beams baked into golem/rabbit. That keeps both beams at their
            constant baked colour — matching the central burst, which lives in the
            panel and gets no flash either — so the whole laser reads as one uniform
            piece. (The jagged bolts render ABOVE the characters — see below.) */}
        <div className="anim-lightning">
          <div className="anim-lflash anim-lflash-impact" />
          <div className="anim-lflash anim-lflash-ambient" />
        </div>
        <div className="anim-flash" />
        {/* Vignette also renders BELOW the characters, for the same reason as the
            flash: it's a full-screen dark radial, and golem is pinned to the right
            edge where the vignette is darkest — so above the characters it would
            dim golem's beam while the central burst (in the panel, above the
            vignette) stays bright, breaking the seam. Below the characters it
            frames only the background and leaves every sprite at its true colour. */}
        <div className="anim-vignette" />
        {/* 1 — hammer girl */}
        <div style={layer('hammer.png', { transformOrigin: '72% 28%', '--mx': '0.469vw', '--my': '-1.389vh', '--mr': '2deg', animation: 'ab-floaty 4.2s ease-in-out -0.6s infinite' })} />
        {/* 2 — Explosionskern. ★ v1266 (Al 22.9.: „das Login-Menue ist
            nicht schoen"): wieder HIER, in der Kulisse, statt im Kasten ueber
            dessen Flaeche. Dort lag der gelb-rote Kern direkt hinter den
            Eingabefeldern und zwang jeden Text in Pixel-Umrisse. Jetzt liegt
            der Kasten davor; sichtbar bleibt der Kern im Kunstfenster oben
            (hinter dem Logo) und seitlich um den Kasten herum. Ebene,
            Drehpunkt und Takt wie zuvor. */}
        <div className="anim-explosion" style={layer('explosion.png', { transformOrigin: '52% 42%', animation: 'ab-coreTether 4.8s ease-in-out infinite' })} />
        {/* 3 — central bloom */}
        <div className="anim-bloom" />
        {/* 4 — Broghan (right shooter), nudged flush to the right edge */}
        <div style={{ position: 'absolute', inset: 0, transform: 'translate(5.781vw, 0.278vh)' }}>
          <div style={layer('golem.png', { animation: 'ab-broghanTether 4.8s ease-in-out infinite' })} />
        </div>
        {/* 5 — Kyli (tree girl), shifted down */}
        <div style={{ position: 'absolute', inset: 0, transform: 'translateY(14.907vh)' }}>
          <div style={layer('horned.png', { transformOrigin: '80% 100%', '--mx': '-0.573vw', '--my': '-1.389vh', '--mr': '2.6deg', animation: 'ab-floaty 6s ease-in-out -2s infinite' })} />
        </div>
        {/* 6 — angel girl */}
        <div style={layer('angel.png', { transformOrigin: '20% 30%', '--mx': '0vw', '--my': '-1.111vh', '--mr': '-1.4deg', animation: 'ab-floaty 5s ease-in-out infinite' })} />
        {/* 7 — blonde girl */}
        <div style={layer('blonde.png', { transformOrigin: '20% 50%', '--mx': '0.208vw', '--my': '-0.833vh', '--mr': '1deg', animation: 'ab-floaty 6.5s ease-in-out -1.5s infinite' })} />
        {/* 8 — Jiggles (left shooter) */}
        <div style={layer('rabbit.png', { animation: 'ab-jiggleTether 4.8s ease-in-out infinite' })} />
        {/* 9 — Champion (swordsman), shifted down */}
        <div style={{ position: 'absolute', inset: 0, transform: 'translateY(19.907vh)' }}>
          <div style={layer('ninja.png', { transformOrigin: '16% 80%', '--mx': '0.417vw', '--my': '-1.296vh', '--mr': '-2deg', animation: 'ab-floaty 5.5s ease-in-out -2.5s infinite' })} />
        </div>
        {/* 10-12 — flying cats live in <AnimatedTitleCatsOverlay/> instead, so
            they render ABOVE the login panel (can't rise above it from inside
            this z-index:0 stacking context). */}
        {/* Lightning bolts render ABOVE the characters (in front of the cast) —
            they're thin jagged strikes, so unlike the full-screen flashes they
            don't wash the lasers. Kept inside the shake group, after every
            character, so they jolt in sync with the scene. */}
        <div className="anim-lightning">
          <svg className="anim-bolt anim-bolt-a" viewBox="0 0 100 400" preserveAspectRatio="none" aria-hidden="true">
            <polyline points="52,0 40,70 62,80 38,150 60,165 34,240 58,255 30,340 50,360 42,400" />
          </svg>
          <svg className="anim-bolt anim-bolt-b" viewBox="0 0 100 400" preserveAspectRatio="none" aria-hidden="true">
            <polyline points="48,0 62,75 38,88 60,160 36,175 58,250 34,265 56,345 40,375 50,400" />
          </svg>
          <svg className="anim-bolt anim-bolt-c" viewBox="0 0 100 400" preserveAspectRatio="none" aria-hidden="true">
            <polyline points="50,0 58,80 40,92 60,175 38,190 56,270 36,285 52,370 46,400" />
          </svg>
        </div>
        {/* 13 — embers */}
        <div className="anim-embers" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          {embers.map((e, i) => (
            <span key={i} style={{
              position: 'absolute', bottom: '-1.296vh', left: e.left.toFixed(2) + '%',
              width: e.size.toFixed(1) + 'px', height: e.size.toFixed(1) + 'px', borderRadius: '50%',
              background: e.color, boxShadow: '0 0 ' + (e.size * 2.4).toFixed(1) + 'px ' + e.color,
              opacity: 0, animation: 'ab-emberrise ' + e.dur.toFixed(1) + 's linear ' + e.delay.toFixed(1) + 's infinite',
              '--drift': e.drift + 'vw',
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// The flying cats, pulled OUT of the backdrop so they render ABOVE the login
// panel (they can't rise above it from inside the backdrop's z-index:0
// stacking context). Same independent floats + screen-shake as the main scene
// — in sync because both mount together. pointer-events:none so clicks still
// reach the form beneath.
// Wie weit `cat_mid` nach links rueckt, damit sie den Login-Kasten
// freigibt. 8vw sind bei 1900px Breite gut 150px — der Kasten ist mit
// dem v466-Zoom rund 460px breit und beginnt damit bei etwa 38 %.
const KATZE_LINKS = '8vw';

function AnimatedTitleCatsOverlay() {
  const layer = animEbene;   // v1265: zugeschnittene Ebenen, siehe oben
  return (
    <div className="anim-cats-front" aria-hidden="true">
      <div className="anim-shake">
        <div style={layer('cat_top.png', { transformOrigin: '23% 5%', '--mx': '0.729vw', '--my': '-0.833vh', '--mr': '3deg', animation: 'ab-floaty 3.4s ease-in-out -0.5s infinite' })} />
        {/* cat_mid sass mit ihrem Bildmittelpunkt bei 37 % genau auf der
            linken Kante des Login-Kastens und lag als Vordergrundebene
            darueber — seit dem groesseren Zoom (v466) zu dominant.
            Al: „muss weiter links platziert werden."

            (v1265: jetzt `versatzX` in `animEbene` — ueber `left`.)
            Verschoben ueber `inset` statt ueber `transform`: die Ebene
            traegt eine laufende `ab-floaty`-Animation, und die
            ueberschreibt jedes inline gesetzte `transform`. `inset` ist
            davon unberuehrt. Links und rechts um denselben Betrag
            versetzt, damit die Ebene GENAUSO BREIT bleibt — sonst
            zieht das `100% 100%`-Hintergrundbild die Katze in die
            Laenge.

            KATZE_LINKS ist die einzige Stellschraube: groesser =
            weiter weg vom Kasten. */}
        <div style={layer('cat_mid.png', { transformOrigin: '37% 30%', '--mx': '-0.573vw', '--my': '0.833vh', '--mr': '-3deg', animation: 'ab-floaty 2.9s ease-in-out -0.8s infinite' }, { versatzX: `-${KATZE_LINKS}` })} />
        <div style={layer('cat_bottom.png', { transformOrigin: '5% 48%', '--mx': '0.833vw', '--my': '-1.111vh', '--mr': '4deg', animation: 'ab-floaty 3.0s ease-in-out -1.7s infinite' })} />
      </div>
    </div>
  );
}

function AuthScreen() {
  const { setUser } = useContext(AppContext);
  // mode: 'login' | 'signup' | 'verify' | 'forgot' | 'reset'
  // A guest clicking "Register now!" sets window._pendingAuthMode so we open
  // straight on the sign-up tab after their session is torn down.
  const [mode, setModeRaw] = useState(() => {
    const m = window._pendingAuthMode; window._pendingAuthMode = null;
    return (m === 'signup' || m === 'login') ? m : 'login';
  });
  const [identifier, setIdentifier] = useState(''); // login: username OR email
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pendingEmail, setPendingEmail] = useState(''); // email a code was sent to
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0); // resend throttle (seconds)
  const googleBtnRef = useRef(null);   // container Google renders its button into
  const googleInited = useRef(false);  // GIS initialize() is one-shot per page
  const googleRenderedIn = useRef(null); // in welchen Knoten schon gezeichnet wurde
  // Inside the Electron desktop shell the GIS popup can't postMessage its
  // credential back (the popup is ejected to the system browser), so the
  // desktop build uses a native OAuth flow exposed by the preload bridge.
  const isDesktop = !!(window.pixelPartiesDesktop && window.pixelPartiesDesktop.isDesktop);

  const setMode = (m) => { setModeRaw(m); setError(''); setInfo(''); };

  // Tick down the resend cooldown.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);
  const startCooldown = () => setCooldown(30);

  const run = async (fn) => {
    setLoading(true); setError('');
    try { await fn(); } catch (e) { setError(e.message || 'Something went wrong'); }
    setLoading(false);
  };

  const finishAuth = (data, isNew) => {
    window.AUTH_TOKEN = data.token;
    socket.emit('auth', data.token);
    if (isNew) window._isNewAccount = true;
    setUser(data.user);
  };

  // ── SCHNELLANMELDUNG UEBER DIE MERK-MARKE ─────────────────────────
  // Al: „wenn ich mich danach ausloge, soll der Button mich trotzdem
  //  sofort wieder in das alte Profil reinladen."
  //
  // Genau daran sind die Anlaeufe v459-v462 gescheitert, und zwar nicht
  // an Technik, sondern an meiner Annahme: ich hatte „Sitzung" und
  // „gemerktes Geraet" gleichgesetzt. Das Abmelden beendet eine
  // Sitzung — es soll aber nicht das Geraet vergessen. Deshalb gibt es
  // jetzt ZWEI Marken: `pp_token` (Sitzung, faellt beim Abmelden) und
  // `pp_remember` (Geraet, bleibt). Der Knopf tauscht die zweite gegen
  // eine frische Sitzung.
  const [merkKonto, setMerkKonto] = useState(null);    // username | null
  const [merkGeprueft, setMerkGeprueft] = useState(false);

  useEffect(() => {
    let abgebrochen = false;
    (async () => {
      const vorher = window.AUTH_TOKEN;
      window.AUTH_TOKEN = null;             // das Cookie soll antworten
      try {
        const data = await api('/auth/remember');
        if (!abgebrochen && data?.username) setMerkKonto(data.username);
      } catch (_) {
        /* Kein gemerktes Geraet — Normalfall beim ersten Besuch. */
      } finally {
        window.AUTH_TOKEN = vorher;
        if (!abgebrochen) setMerkGeprueft(true);
      }
    })();
    return () => { abgebrochen = true; };
  }, []);

  const schnellAnmelden = () => run(async () => {
    if (!merkKonto) return;
    const vorher = window.AUTH_TOKEN;
    window.AUTH_TOKEN = null;
    try {
      const data = await api('/auth/remember', { method: 'POST' });
      finishAuth(data, false);
    } catch (err) {
      window.AUTH_TOKEN = vorher;
      setMerkKonto(null);
      setError(`Quick sign-in failed: ${err?.message || 'unknown error'}`);
    }
  });

  const geraetVergessen = () => run(async () => {
    try { await api('/auth/remember', { method: 'DELETE' }); } catch (_) {}
    setMerkKonto(null);
  });

  const submitLogin = () => run(async () => {
    if (!identifier.trim() || !password) { setError('Fill in all fields'); return; }
    const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ identifier: identifier.trim(), password }) });
    finishAuth(data, false);
  });

  const submitSignup = () => run(async () => {
    if (!username.trim() || !email.trim() || !password) { setError('Fill in all fields'); return; }
    const data = await api('/auth/signup', { method: 'POST', body: JSON.stringify({ username: username.trim(), email: email.trim(), password }) });
    setPendingEmail(data.email); setCode(''); startCooldown(); setMode('verify');
  });

  const submitVerify = () => run(async () => {
    if (!code.trim()) { setError('Enter the code from your email'); return; }
    const data = await api('/auth/verify-email', { method: 'POST', body: JSON.stringify({ email: pendingEmail, code: code.trim() }) });
    finishAuth(data, !!data.isNewAccount);
  });

  const resendSignup = () => run(async () => {
    await api('/auth/resend', { method: 'POST', body: JSON.stringify({ email: pendingEmail }) });
    setInfo('A new code has been sent.'); startCooldown();
  });

  const submitForgot = () => run(async () => {
    if (!email.trim()) { setError('Enter your email'); return; }
    await api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: email.trim() }) });
    setPendingEmail(email.trim()); setCode(''); setNewPassword(''); startCooldown();
    setMode('reset'); setInfo('If that email is registered, a reset code is on its way.');
  });

  const resendForgot = () => run(async () => {
    await api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: pendingEmail }) });
    setInfo('If that email is registered, a new code is on its way.'); startCooldown();
  });

  const submitReset = () => run(async () => {
    if (!code.trim() || !newPassword) { setError('Enter the code and a new password'); return; }
    await api('/auth/reset-password', { method: 'POST', body: JSON.stringify({ email: pendingEmail, code: code.trim(), newPassword }) });
    setIdentifier(pendingEmail); setPassword(''); setMode('login'); setInfo('Password updated — you can log in now.');
  });

  // Start a throwaway guest session — straight into starter-decks-vs-CPU.
  const submitGuest = () => run(async () => {
    const data = await api('/auth/guest', { method: 'POST' });
    finishAuth(data, false);
  });

  // Exchange a Google ID token for a session (sign-in or sign-up).
  const submitGoogle = (credential) => run(async () => {
    if (!credential) { setError('Google sign-in was cancelled.'); return; }
    const data = await api('/auth/google', { method: 'POST', body: JSON.stringify({ credential }) });
    finishAuth(data, !!data.isNewAccount);
  });

  // Desktop build: run the native OAuth (PKCE) flow via the preload bridge and
  // hand its id_token to the same /auth/google endpoint the browser uses.
  const submitGoogleDesktop = () => run(async () => {
    const credential = await window.pixelPartiesDesktop.googleSignIn();
    if (!credential) { setError('Google sign-in was cancelled.'); return; }
    const data = await api('/auth/google', { method: 'POST', body: JSON.stringify({ credential }) });
    finishAuth(data, !!data.isNewAccount);
  });

  // Load Google Identity Services and render its button (login/signup tabs only).
  // ── GOOGLE-KNOPF: FESTE SPRACHE, FESTE BESCHRIFTUNG, KEIN NEUBAU ──
  // Al 17.8., zwei Befunde in einem:
  //
  //  1) „Einer hat das Label ‚Ueber Google anmelden', der andere ‚Mit
  //     Google anmelden'. Beide sollen Englisch sein."
  //     Den Text zeichnet GOOGLE selbst und uebersetzt ihn nach der
  //     Browsersprache — daher Deutsch, und zwei Varianten, weil wir je
  //     nach Reiter `signup_with` oder `signin_with` anforderten.
  //     Jetzt `locale: 'en'` (feste Sprache) und in BEIDEN Reitern
  //     `signin_with`. ANMERKUNG: Google gibt die Formulierung vor;
  //     „Sign in with Google" ist die englische Fassung, ein woertliches
  //     „Log in with Google" bietet die Schnittstelle nicht an.
  //
  //  2) „Wenn ich zwischen Login und Signup hin und her springe,
  //     verzerrt sich die Hoehe der kompletten Menue-Box."
  //     Genau richtig beobachtet: der Effekt lief bei JEDEM Reiterwechsel,
  //     leerte den Container (`innerHTML = ''`) und liess Google neu
  //     zeichnen. Fuer einen Moment war die Stelle nur `minHeight: 44`
  //     hoch, danach wieder so hoch wie der personalisierte Knopf mit
  //     Als Konto — das ist der Sprung.
  //     Da der Text jetzt in beiden Reitern gleich ist, gibt es keinen
  //     Grund mehr, neu zu zeichnen. Neu gezeichnet wird nur noch, wenn
  //     der Container wirklich ein anderer ist (nach 'forgot' o.ae. kommt
  //     ein frischer Knoten aus dem Wiederaufbau).
  //
  // Im Desktop-Gehaeuse uebersprungen: dort steht der eigene Knopf.
  useEffect(() => {
    if (isDesktop) return;
    if (!window.GOOGLE_CLIENT_ID) return;
    if (mode !== 'login' && mode !== 'signup') return;
    let cancelled = false;
    const render = () => {
      const gid = window.google && window.google.accounts && window.google.accounts.id;
      if (cancelled || !gid || !googleBtnRef.current) return;
      if (!googleInited.current) {
        gid.initialize({
          client_id: window.GOOGLE_CLIENT_ID,
          callback: (resp) => submitGoogle(resp && resp.credential),
        });
        googleInited.current = true;
      }
      // Schon in DIESEM Knoten gezeichnet? Dann stehen lassen — jedes
      // Neuzeichnen kostet einen Hoehensprung.
      if (googleRenderedIn.current === googleBtnRef.current
        && googleBtnRef.current.childElementCount > 0) return;
      googleBtnRef.current.innerHTML = '';
      // Breite des Google-Knopfs: 280 auf dem Desktop; im Telefon-Layout
      // (zweispaltig, siehe `TELEFON QUER` in style.css) ist die rechte
      // Spalte schmaler, dort 250. Dieselbe Schwelle wie die Media Query.
      const kompakt = !!(window.matchMedia && window.matchMedia('(max-height: 600px)').matches);
      gid.renderButton(googleBtnRef.current, {
        theme: 'filled_black', size: 'large', shape: 'rectangular', width: kompakt ? 250 : 280,
        locale: 'en',
        text: 'signin_with',
      });
      googleRenderedIn.current = googleBtnRef.current;
    };
    if (window.google && window.google.accounts && window.google.accounts.id) { render(); return () => { cancelled = true; }; }
    let s = document.getElementById('gis-script');
    if (!s) {
      s = document.createElement('script');
      s.id = 'gis-script'; s.src = 'https://accounts.google.com/gsi/client';
      s.async = true; s.defer = true;
      document.head.appendChild(s);
    }
    s.addEventListener('load', render);
    return () => { cancelled = true; s.removeEventListener('load', render); };
  }, [mode]);

  // ── AUFBAU DES FORMULARS (v835, Mobile-Layout) ──────────────────────
  // Alles Sichtbare traegt jetzt eine Klasse und KEINE Layout-Inline-Styles
  // mehr: `auth-header` (Logo + Untertitel), `auth-form` mit den beiden
  // Spalten `auth-form-main` (Reiter, Eingaben, Hauptknopf) und
  // `auth-form-alt` (Google, Gast). Auf dem Desktop legt style.css beides
  // untereinander — pixelgleich mit vorher. Auf flachen Bildschirmen
  // (Telefon quer, `@media (max-height: 600px)`) stellt style.css die
  // beiden Spalten NEBENEINANDER; das ist der ganze Trick, damit das
  // Formular ohne Scrollen in 360-390 Pixel Hoehe passt. Layout gehoert
  // in die CSS-Datei, nicht hierher — sonst ist es per Media Query nicht
  // erreichbar.
  const Header = (
    <div className="auth-header">
      {/* Same wordmark logo as the main menu (data/logo.png), tinted + haloed
          with drifting particles. Scoped .auth-logo just fits it to the panel
          width (the menu sizes it for a full-width header). */}
      <div className="pp-logo-stack auth-logo">
        <LogoParticles />
        <img src="/data/logo.png" alt="Pixel Parties" className="pp-logo-img" />
        <div className="pp-logo-tint" aria-hidden="true"></div>
        <div className="pp-logo-licht" aria-hidden="true"></div>
        <div className="pp-logo-umriss" aria-hidden="true"></div>
      </div>
      <div className="orbit-font auth-subtitle">
        TRADING CARD GAME
      </div>
    </div>
  );

  const Msgs = (
    <>
      {error && <div className="auth-msg auth-err">{error}</div>}
      {info && <div className="auth-msg auth-ok">{info}</div>}
    </>
  );

  const codeField = (
    <input className="input auth-code" inputMode="numeric" autoComplete="one-time-code"
      placeholder="6-digit code" maxLength={6} value={code} autoFocus
      onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
      onKeyDown={e => e.key === 'Enter' && (mode === 'verify' ? submitVerify() : submitReset())} />
  );

  let body;
  if (mode === 'login' || mode === 'signup') {
    body = (
      <>
        {/* ★★ v1264 (Al 22.9.): „Der ‚Try as Guest'-Button sollte
            hochwandern und deutlich prominenter sein, um potentielle neue
            Spieler direkt dorthin zu fuehren." Er steht jetzt als ERSTES
            unter dem Logo, ueber die volle Breite, mit Lotsen-Schein und
            Foil-Glanz (`pp-lotse` + `LotsenGlanz`, dieselbe Hervorhebung
            wie der Tutorial Raccoon danach im Gastmodus — der Weg ist
            durchgehend markiert). Anmelden/Registrieren folgt darunter. */}
        <div className="auth-gast">
          <button className="btn btn-big pp-lotse auth-gast-btn" onClick={submitGuest} disabled={loading}>
            <LotsenGlanz />
            <span className="auth-gast-titel">▶ TRY AS GUEST · vs CPU</span>
          </button>
          <div className="auth-fine auth-gast-hinweis">No account needed — you play with a starter deck.</div>
        </div>
        <div className="auth-or auth-or--konto">or</div>
        {/* Reiterbalken VOR dem Formular ueber die volle Kastenbreite
            (v836, Als Rueckmeldung: im Telefon-Layout sass er in der linken
            Spalte und damit nicht mehr mittig unter dem Logo). marginBottom
            20 wie urspruenglich, in style.css. */}
        <div className="tab-bar auth-tabs">
          <div className={'tab' + (mode === 'login' ? ' active' : '')} onClick={() => setMode('login')}>LOG IN</div>
          <div className={'tab' + (mode === 'signup' ? ' active' : '')} onClick={() => setMode('signup')}>SIGN UP</div>
        </div>
      <div className="auth-form">
        <div className="auth-form-main">
          {mode === 'login' ? (
            <>
              <input className="input" placeholder="Username or Email" value={identifier} autoComplete="username"
                onChange={e => setIdentifier(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitLogin()} />
            </>
          ) : (
            <>
              <input className="input" placeholder="Username" value={username} autoComplete="username" maxLength={10}
                onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitSignup()} />
              {/* v1266: der Hinweis auf den Bestaetigungscode steht im
                  Platzhalter (vorher eine eigene, zweizeilige Fusszeile);
                  der naechste Schritt sagt ohnehin, wohin der Code ging. */}
              <input className="input" type="email" placeholder="Email — we'll send you a code" value={email} autoComplete="email"
                onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitSignup()} />
            </>
          )}
          <PasswordInput value={password} onChange={setPassword} placeholder="Password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            onEnter={mode === 'login' ? submitLogin : submitSignup} />
          {/* ★ v1266: GLEICHE HOEHE DURCH BAUART. Anmelden hat ein Feld
              weniger als Registrieren; die fehlende Zeile belegt jetzt der
              Passwort-Link, rechtsbuendig unter dem Passwort — dort, wo man
              ihn sucht. Die Zeile ist so hoch wie ein Eingabefeld, weil
              darin ein unsichtbares steht (Begruendung vom 17.8.: keine
              feste Pixelzahl, `.input` ergibt sich aus Schrift und
              Innenabstand). Damit entfallen der Hoehenausgleich am
              Kastenende und die Fusszeile — beide Reiter sind gleich hoch,
              ohne leere Flaeche. */}
          {mode === 'login' && (
            <div className="auth-zeile-hilfe">
              <input className="input" aria-hidden="true" tabIndex={-1} readOnly value="" onChange={() => {}} />
              <span className="auth-link" onClick={() => { setEmail(identifier.includes('@') ? identifier : ''); setMode('forgot'); }}>
                Forgot your password?
              </span>
            </div>
          )}
          {Msgs}
          <button className="btn btn-big" onClick={mode === 'login' ? submitLogin : submitSignup} disabled={loading}>
            {loading ? '...' : mode === 'login' ? 'LOG IN' : 'SIGN UP'}
          </button>
        </div>
        <div className="auth-form-alt">
          {window.GOOGLE_CLIENT_ID && (
            <>
              <div className="auth-or">or</div>
              {isDesktop ? (
                <div style={{ display: 'flex', justifyContent: 'center', minHeight: 44 }}>
                  <button
                    type="button"
                    className="google-btn google-btn--prominent"
                    onClick={submitGoogleDesktop}
                    disabled={loading}
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>
                      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/>
                      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.05l3.01-2.33z"/>
                      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
                    </svg>
                    {/* Wortgleich mit dem Knopf, den Google zeichnet — sonst
                        stehen im Desktop-Gehaeuse und im Browser zwei
                        verschiedene Beschriftungen. */}
                    Sign in with Google
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'center', minHeight: 44 }}>
                  {/* Google zeichnet seinen Knopf in einen iframe — dessen
                      Inneres laesst sich nicht gestalten. Eckig (shape
                      'rectangular') und in einen Pixelrahmen gefasst passt
                      er trotzdem zu den anderen Knoepfen. */}
                  <div ref={googleBtnRef} className="google-pixelrahmen" />
                </div>
              )}
            </>
          )}
        </div>
      </div>
      </>
    );
  } else if (mode === 'verify') {
    body = (
      <div className="auth-form auth-form--single">
        <div className="auth-step-title">Check your email</div>
        <div className="auth-fine">We sent a 6-digit code to <b>{pendingEmail}</b>. Enter it below to finish creating your account.</div>
        {codeField}
        {Msgs}
        <button className="btn btn-big" onClick={submitVerify} disabled={loading}>{loading ? '...' : 'VERIFY'}</button>
        <div className="auth-row">
          <span className="auth-link" onClick={() => setMode('signup')}>← Back</span>
          <span className={'auth-link' + (cooldown > 0 || loading ? ' disabled' : '')}
            onClick={() => cooldown <= 0 && !loading && resendSignup()}>
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
          </span>
        </div>
      </div>
    );
  } else if (mode === 'forgot') {
    body = (
      <div className="auth-form auth-form--single">
        <div className="auth-step-title">Reset your password</div>
        <div className="auth-fine">Enter your account email and we'll send you a reset code.</div>
        <input className="input" type="email" placeholder="Email" value={email} autoFocus autoComplete="email"
          onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitForgot()} />
        {Msgs}
        <button className="btn btn-big" onClick={submitForgot} disabled={loading}>{loading ? '...' : 'SEND CODE'}</button>
        <div className="auth-row">
          <span className="auth-link" onClick={() => setMode('login')}>← Back to log in</span>
        </div>
      </div>
    );
  } else if (mode === 'reset') {
    body = (
      <div className="auth-form auth-form--single">
        <div className="auth-step-title">Enter your reset code</div>
        <div className="auth-fine">If <b>{pendingEmail}</b> is registered, a code is on its way. Enter it with your new password.</div>
        {codeField}
        <PasswordInput value={newPassword} onChange={setNewPassword} placeholder="New password"
          autoComplete="new-password" onEnter={submitReset} />
        {Msgs}
        <button className="btn btn-big" onClick={submitReset} disabled={loading}>{loading ? '...' : 'SET NEW PASSWORD'}</button>
        <div className="auth-row">
          <span className="auth-link" onClick={() => setMode('login')}>← Back to log in</span>
          <span className={'auth-link' + (cooldown > 0 || loading ? ' disabled' : '')}
            onClick={() => cooldown <= 0 && !loading && resendForgot()}>
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="screen-center auth-screen">
      <AnimatedTitleBackdrop />
      {/* ── ABLAGE OBEN RECHTS, nach dem Vorbild des Hauptmenues ──────
          Gleiche Bauform wie dort: eine Spalte, `alignItems: stretch`,
          gleicher Abstand, Discord ganz unten. Reihenfolge nach Als
          Vorgabe (17.8.): Login, darunter Lautstaerke, darunter
          Discord. Vorher stand der Regler allein oben links — falsch
          platziert, weil das Hauptmenue alles rechts sammelt. */}
      <div className="auth-corner">
        {/* EINE ZEILE aus Knopf + Regler — exakt die Zeile, die im
            Hauptmenue LOGOUT und den Regler traegt (gleiche Flex-Werte,
            gleicher Abstand, gleiche Knopfmasse). Darunter Discord als
            `block`, wie dort. Die Masse stehen seit v835 in style.css
            (`.auth-corner`), damit das Telefon-Layout sie umstellen kann. */}
        <div className="auth-corner-row">
          <button
            className="btn menu-logout-btn"
            style={{ padding: '7px 22px', fontSize: 13, opacity: merkKonto ? 1 : 0.45 }}
            onClick={schnellAnmelden}
            disabled={!merkKonto || !merkGeprueft || loading}
            title={merkKonto
              ? `Sign back in as ${merkKonto} (right-click to forget this device)`
              : 'No remembered account on this device'}
            onContextMenu={(e) => { e.preventDefault(); if (merkKonto) geraetVergessen(); }}
          >
            {merkKonto ? `LOGIN · ${merkKonto}` : 'LOGIN'}
          </button>
          <VolumeControl />
        </div>
        <DiscordButton block />
      </div>
      {/* Shake wrapper: jolts the panel in sync with the backdrop's ab-shake
          (same 10s clock). Kept separate from the panel so its .animate-in
          entrance transform isn't clobbered by the shake transform. */}
      <div className="auth-panel-shake" style={{ position: 'relative', zIndex: 2 }}>
        {/* ★ v1266: der Kasten als KARTE — oben ein Kunstfenster (Logo vor
            dem Explosionskern der Kulisse, `.auth-header`), darunter ein
            deckender Textkasten mit dem Formular (`.auth-rumpf`). Rahmen
            und Eck-Zier wie die Menuekaesten (`pp-eckzier`). */}
        <div className="panel animate-in auth-panel pp-eckzier">
          <div className="auth-panel-content">
            {Header}
            <div className="auth-rumpf">
              {body}
            </div>
          </div>
        </div>
      </div>
      {/* Flying cats — rendered last so they float ABOVE the login panel. */}
      <AnimatedTitleCatsOverlay />
    </div>
  );
}

// ═══════════════════════════════════════════
//  MENU CARD BACKGROUND
//  A slow, seamlessly-looping wall of random card art that scrolls
//  bottom→top behind the main menu. 10 cards per row fill the width;
//  no two identical cards ever sit adjacent (incl. diagonally, and
//  across the loop seam). Purely cosmetic — pointer-events disabled
//  and layered beneath the menu content.
// ═══════════════════════════════════════════
const MENU_BG_COLS = 10;
const MENU_BG_CARD_ASPECT = 1050 / 750; // card art is 750×1050

// Pick a random url not in `forbidden` (a Set). With ~700 cards and a
// forbidden set of ≤8 neighbours, rejection sampling converges instantly.
function menuBgPick(urls, forbidden) {
  let u, tries = 0;
  do { u = urls[(Math.random() * urls.length) | 0]; tries++; }
  while (forbidden.has(u) && tries < 60);
  return u;
}

// Build a `rows × MENU_BG_COLS` grid of image urls where no cell equals
// any of its 8 neighbours. Row 0 is also checked against the last row so
// the tile can be stacked on itself for a seamless vertical loop.
function buildMenuBgGrid(urls, rows) {
  const cols = MENU_BG_COLS;
  const grid = [];
  for (let r = 0; r < rows; r++) {
    grid[r] = [];
    for (let c = 0; c < cols; c++) {
      const forbidden = new Set();
      if (c > 0) forbidden.add(grid[r][c - 1]);               // left
      if (r > 0) {                                            // row above
        forbidden.add(grid[r - 1][c]);
        if (c > 0) forbidden.add(grid[r - 1][c - 1]);
        if (c < cols - 1) forbidden.add(grid[r - 1][c + 1]);
      }
      grid[r][c] = menuBgPick(urls, forbidden);
    }
  }
  // Seam fix-up: make row 0 valid against the last row (which becomes its
  // upper neighbour when the tile repeats), plus its own settled neighbours.
  if (rows >= 2) {
    const last = grid[rows - 1];
    for (let c = 0; c < cols; c++) {
      const forbidden = new Set();
      if (c > 0) forbidden.add(grid[0][c - 1]);
      if (c < cols - 1) forbidden.add(grid[0][c + 1]);
      forbidden.add(grid[1][c]);
      if (c > 0) forbidden.add(grid[1][c - 1]);
      if (c < cols - 1) forbidden.add(grid[1][c + 1]);
      forbidden.add(last[c]);
      if (c > 0) forbidden.add(last[c - 1]);
      if (c < cols - 1) forbidden.add(last[c + 1]);
      if (forbidden.has(grid[0][c])) grid[0][c] = menuBgPick(urls, forbidden);
    }
  }
  return grid;
}

// AVAILABLE_MAP values are bare filenames (e.g. "Archer.png"); turn them
// into the served image urls under /cards/.
function menuBgUrls() {
  return Object.values(window.AVAILABLE_MAP || {})
    .map(f => '/cards/' + encodeURIComponent(f));
}

function MenuCardBackground() {
  const rootRef = useRef(null);
  const [urls, setUrls] = useState(menuBgUrls);
  const [rows, setRows] = useState(0);

  // Card images load asynchronously; if AVAILABLE_MAP isn't populated yet,
  // poll briefly until it is.
  useEffect(() => {
    if (urls.length) return;
    let alive = true;
    const t = setInterval(() => {
      const v = menuBgUrls();
      if (v.length && alive) { setUrls(v); clearInterval(t); }
    }, 250);
    return () => { alive = false; clearInterval(t); };
  }, [urls.length]);

  // Decide how many rows one tile needs so a single copy always covers the
  // viewport (the scroller stacks two copies for a seamless loop). Recompute
  // on resize, but only grow — never reshuffle the wall on minor changes.
  useEffect(() => {
    const compute = () => {
      const w = (rootRef.current && rootRef.current.clientWidth) || window.innerWidth;
      const h = (rootRef.current && rootRef.current.clientHeight) || window.innerHeight;
      const cellH = (w / MENU_BG_COLS) * MENU_BG_CARD_ASPECT;
      const needed = Math.max(5, Math.ceil(h / cellH) + 2);
      setRows(prev => (needed > prev ? needed : prev));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  const grid = useMemo(
    () => (urls.length && rows ? buildMenuBgGrid(urls, rows) : null),
    [urls, rows]
  );

  if (!grid) return <div ref={rootRef} className="menu-card-bg" aria-hidden="true" />;

  // Constant scroll speed: ~5s per row regardless of tile height.
  const duration = rows * 5;
  const tile = (
    <div className="menu-card-bg-tile">
      {grid.map((row, r) =>
        row.map((src, c) => (
          <div className="menu-card-bg-cell" key={r + '-' + c}>
            <img src={src} alt="" draggable="false" decoding="async" />
          </div>
        ))
      )}
    </div>
  );

  return (
    <div ref={rootRef} className="menu-card-bg" aria-hidden="true">
      <div className="menu-card-bg-scroller" style={{ animationDuration: duration + 's' }}>
        {tile}
        {tile}
      </div>
      <div className="menu-card-bg-veil" />
    </div>
  );
}

// ═══════════════════════════════════════════
//  MENU HUB SIDE PANELS
//  Frosted panels flanking the menu on wide screens: a live leaderboard
//  on the left, the player's snapshot (record / top heroes / active deck)
//  on the right. Hidden below 1100px so they never crowd the menu.
// ═══════════════════════════════════════════

// Small standalone card thumbnail (no tooltip/drag machinery — just art).
function MenuCardThumb({ name, skin, w = 42, onClick }) {
  const url = name && cardImageUrl(name, skin ? { [name]: skin } : null);
  const style = {
    width: w, height: Math.round(w * MENU_BG_CARD_ASPECT), borderRadius: 5,
    objectFit: 'cover', display: 'block', flexShrink: 0,
    border: '1px solid rgba(255,255,255,.12)',
    cursor: onClick ? 'pointer' : 'default',
  };
  if (!url) {
    return (
      <div style={{ ...style, background: 'rgba(255,255,255,.05)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontSize: 8, color: 'var(--text2)',
        textAlign: 'center', padding: 2 }} onClick={onClick}>{name || '?'}</div>
    );
  }
  return <img src={url} alt="" draggable="false" style={style} onClick={onClick} title={name} />;
}

// ── Left: live leaderboard ──
function MenuLeaderboardPanel({ top, height }) {
  const { user } = useContext(AppContext);
  const [players, setPlayers] = useState(null);
  const [live, setLive] = useState(null);

  useEffect(() => {
    let alive = true;
    api('/leaderboard').then(d => { if (alive) setPlayers(d.players || []); }).catch(() => { if (alive) setPlayers([]); });
    const pollLive = () => api('/stats/live').then(d => { if (alive) setLive(d); }).catch(() => {});
    pollLive();
    const t = setInterval(pollLive, 20000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const style = {};
  if (top != null) style.top = top;
  if (height != null) style.height = height;

  return (
    <aside className="menu-side menu-side-left" style={style}>
      <div className="menu-side-panel ornate-frame">
        <div className="menu-side-live">
          <span className="menu-live-dot" />
          {live
            ? <span>{live.playersOnline} online · {live.gamesLive} game{live.gamesLive === 1 ? '' : 's'} live</span>
            : <span style={{ color: 'var(--text2)' }}>connecting…</span>}
        </div>
        <h3 className="menu-side-title"><PixelIcon name="pokal" className="menu-side-title-icon" />TOP PLAYERS</h3>
        <div className="menu-side-scroll">
          {players === null ? (
            <div className="menu-side-empty">Loading…</div>
          ) : players.length === 0 ? (
            <div className="menu-side-empty">No ranked players yet.</div>
          ) : (
            <ol className="menu-lb-list">
              {players.map(p => (
                // v1289: Klick/Enter oeffnet das Spielerprofil (app-player-profile.jsx).
                <li key={p.rank} {...playerProfileTriggerProps(p)}
                    className={'menu-lb-row ppf-trigger'
                    + (p.rank <= 3 ? ' menu-lb-medal rank-' + p.rank : '')
                    + (p.username === user.username ? ' is-me' : '')}>
                  <span className={'menu-lb-rank' + (p.rank <= 3 ? ' top' : '')}>{p.rank}</span>
                  <span className="menu-lb-name" style={{ color: p.color || 'var(--accent)', '--pp-umriss': ppUmrissFarbe(p.color || '#00f0ff') }}>{p.username}</span>
                  <span className="menu-lb-elo">{p.elo}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </aside>
  );
}

// ── Right: the player's own snapshot ──
function MenuPlayerPanel({ top, height }) {
  const { user, setScreen, setUser, notify } = useContext(AppContext);
  const [decks, setDecks] = useState(null); // null=loading, []=none  (self-made)
  const [samples, setSamples] = useState([]); // prebuilt (starter / owned structure) decks
  const [settingId, setSettingId] = useState(null); // deck id currently being set

  useEffect(() => {
    let alive = true;
    api('/profile/deck-stats').then(d => { if (alive) setDecks(d.decks || []); }).catch(() => { if (alive) setDecks([]); });
    api('/sample-decks/owned').then(d => { if (alive) setSamples(d.decks || []); }).catch(() => { if (alive) setSamples([]); });
    return () => { alive = false; };
  }, []);

  // Prebuilt (sample) decks are surfaced and selected exactly like self-made
  // ones. Their rep card comes from the cover (or a hero), legality from the
  // shared checker, and "active" from the user's pinned sample-deck id.
  const sampleRep = (d) => d.coverCard || (d.heroes || []).find(h => h && h.hero)?.hero || (d.mainDeck || [])[0] || null;
  const pinnedSampleId = user?.defaultSampleDeckId || null;
  const personalList = (decks || []).map(d => ({
    id: d.id, name: d.name, legal: d.legal, repCard: d.repCard, repSkin: d.repSkin,
    isSample: false, isActive: !!d.isDefault,
  }));
  const sampleList = samples.map(d => ({
    id: d.id, name: d.name, legal: isDeckLegal(d).legal, repCard: sampleRep(d), repSkin: null,
    isSample: true, isActive: d.id === pinnedSampleId,
  }));
  const allDecks = decks === null ? null : [...personalList, ...sampleList];
  // Active deck is derived from the combined list, so it updates the moment
  // the player picks a different one below.
  const activeDeck = allDecks ? allDecks.find(d => d.isActive) : undefined;

  // Click a deck → make it the current (default) deck. Illegal decks can never
  // be set active. Self-made and prebuilt decks pin via their own endpoints,
  // but the server keeps the two "default" kinds mutually exclusive.
  const selectDeck = async (deck) => {
    if (deck.isActive || settingId) return;
    if (!deck.legal) {
      notify && notify('"' + deck.name + '" is incomplete — finish it in the deck builder before setting it active', 'error');
      return;
    }
    setSettingId(deck.id);
    try {
      if (deck.isSample) {
        await api('/decks/set-default-sample', { method: 'POST', body: JSON.stringify({ sampleDeckId: deck.id }) });
        setDecks(list => (list || []).map(d => ({ ...d, isDefault: false })));
        setUser(u => u ? { ...u, defaultSampleDeckId: deck.id } : u);
      } else {
        await api('/decks/' + deck.id + '/set-default', { method: 'POST' });
        setDecks(list => (list || []).map(d => ({ ...d, isDefault: d.id === deck.id })));
        setUser(u => u ? { ...u, defaultSampleDeckId: null } : u);
      }
      notify && notify(deck.name + ' is now your active deck', 'success');
    } catch (e) {
      notify && notify(e.message || 'Failed to set active deck', 'error');
    }
    setSettingId(null);
  };

  const wins = user.wins || 0, losses = user.losses || 0;
  const total = wins + losses;
  const winRate = total ? Math.round((wins / total) * 100) : 0;

  const style = {};
  if (top != null) style.top = top;
  if (height != null) style.height = height;

  return (
    <aside className="menu-side menu-side-right" style={style}>
      <div className="menu-side-panel ornate-frame">
        <h3 className="menu-side-title"><PixelIcon name="schwerter" className="menu-side-title-icon" />YOUR RECORD</h3>
        <div className="menu-record">
          <div className="menu-record-cell is-win"><b style={{ color: 'var(--success)' }}>{wins}</b><span>WINS</span></div>
          <div className="menu-record-cell is-loss"><b style={{ color: 'var(--danger)' }}>{losses}</b><span>LOSSES</span></div>
          <div className="menu-record-cell is-rate"><b style={{ color: 'var(--player-color, var(--accent))' }}>{winRate}%</b><span>WIN RATE</span></div>
        </div>

        <h3 className="menu-side-title"><PixelIcon name="stern" className="menu-side-title-icon" />ACTIVE DECK</h3>
        {allDecks === null ? (
          <div className="menu-side-empty">Loading…</div>
        ) : !activeDeck ? (
          <button className="menu-side-empty menu-side-link" onClick={() => setScreen('deckbuilder')}>
            No active deck — pick one below or build one →
          </button>
        ) : (
          <button className="menu-deck-card is-active is-editable" onClick={() => setScreen('deckbuilder')}
            title={activeDeck.isSample ? 'Prebuilt deck — open the deck builder' : 'Edit in deck builder'}>
            <MenuCardThumb name={activeDeck.repCard} skin={activeDeck.repSkin} w={56} />
            <span className="menu-deck-meta">
              <span className="menu-deck-name">{activeDeck.isSample ? '📋 ' : ''}{activeDeck.name}</span>
              <span className={'menu-deck-status ' + (activeDeck.legal ? 'ok' : 'bad')}>
                {activeDeck.legal ? '✓ Tournament legal' : '✗ Incomplete'}
              </span>
            </span>
            <span className="menu-deck-flag">{activeDeck.isSample ? 'PREBUILT' : 'EDIT →'}</span>
          </button>
        )}

        <h3 className="menu-side-title"><PixelIcon name="karten" className="menu-side-title-icon" />YOUR DECKS</h3>
        <div className="menu-side-scroll">
          {allDecks === null ? (
            <div className="menu-side-empty">Loading…</div>
          ) : allDecks.length === 0 ? (
            <button className="menu-side-empty menu-side-link" onClick={() => setScreen('deckbuilder')}>
              No decks yet — build one →
            </button>
          ) : (
            <div className="menu-deck-list">
              {allDecks.map(d => (
                <button
                  key={d.id}
                  className={'menu-deck-card'
                    + (d.isActive ? ' is-active' : '')
                    + (!d.isActive && !d.legal ? ' is-illegal' : '')
                    + (settingId === d.id ? ' is-busy' : '')}
                  onClick={() => selectDeck(d)}
                  title={d.isActive ? 'Active deck' : (d.legal ? 'Set as active deck' : 'Incomplete — finish it in the deck builder')}
                >
                  <MenuCardThumb name={d.repCard} skin={d.repSkin} w={56} />
                  <span className="menu-deck-meta">
                    <span className="menu-deck-name">{d.isSample ? '📋 ' : ''}{d.name}</span>
                    <span className={'menu-deck-status ' + (d.legal ? 'ok' : 'bad')}>
                      {d.legal ? '✓ Legal' : '✗ Incomplete'}
                    </span>
                  </span>
                  <span className="menu-deck-flag">
                    {d.isActive ? '● ACTIVE' : (settingId === d.id ? '…' : '')}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

// ── PIXEL-PARTIKEL (verallgemeinert v808) ────────────────────────────
// Rein dekorativ — `aria-hidden`, `pointer-events: none`. Lage, Dauer
// und Farbe werden EINMAL ausgewuerfelt (`useMemo`), damit sie bei jedem
// Render an derselben Stelle bleiben; jedes Teilchen liest seine Werte
// aus CSS-Variablen, die `pp-particle-float` in style.css auswertet.
//
// Der Baustein hiess bis v808 `LogoParticles` und konnte nur eines. Al
// wollte Partikel „ueberall im Hintergrund, aber um den Schriftzug
// herum mehr" — statt eines zweiten, fast gleichen Bausteins bekommt
// dieser hier Parameter. Der Schriftzug und der Menuehintergrund
// unterscheiden sich damit nur noch in Anzahl, Groesse und Reichweite.
function PixelParticles({
  anzahl = 64,
  klasse = 'pp-logo-particles',
  teilchenKlasse = 'pp-logo-particle',
  minGroesse = 2,
  maxGroesse = 8,
  driftX = 30,
  driftY = 40,
  dauerMin = 1.8,
  dauerSpanne = 3.4,
  // ★ v1264 (SC-Glitzer): `radial` — Start nahe der MITTE der Schicht,
  // Flugrichtung rundum statt nach oben (eine Quelle, die Funken
  // „ausstoesst"). `farben` — eigene Palette statt Spielerfarbe/Weiss.
  // Ohne beide Angaben verhaelt sich die Komponente exakt wie bisher.
  radial = false,
  farben = null,
}) {
  const particles = useMemo(() => {
    const arr = [];
    for (let i = 0; i < anzahl; i++) {
      const dur = dauerMin + Math.random() * dauerSpanne;
      let top, left, dx, dy;
      if (radial) {
        const winkel = Math.random() * Math.PI * 2;
        const weite = 0.45 + Math.random() * 0.55;
        top = 50 + (Math.random() * 2 - 1) * 12;
        left = 50 + (Math.random() * 2 - 1) * 12;
        dx = Math.cos(winkel) * driftX * weite;
        dy = Math.sin(winkel) * driftY * weite;
      } else {
        top = Math.random() * 100;
        left = Math.random() * 100;
        dx = (Math.random() * 2 - 1) * driftX;
        dy = -(14 + Math.random() * driftY);
      }
      arr.push({
        top, left,
        size:  minGroesse + Math.floor(Math.random() * (maxGroesse - minGroesse)),
        dur,
        delay: -Math.random() * dur,                     // negativ → mitten im Zyklus starten
        dx, dy,
        max:   0.7 + Math.random() * 0.3,
        // Ueberwiegend Spielerfarbe, ein Drittel weiss fuer den Funkeleffekt.
        color: farben
          ? farben[Math.floor(Math.random() * farben.length)]
          : (Math.random() < 0.34 ? '#ffffff' : 'var(--player-color, #00f0ff)'),
      });
    }
    return arr;
    // Absichtlich einmalig: die Streuung soll sich beim Rendern nicht
    // neu wuerfeln. Die Parameter aendern sich zur Laufzeit nicht.
  }, []);
  return (
    <div className={klasse} aria-hidden="true">
      {particles.map((p, i) => (
        <span key={i} className={teilchenKlasse} style={{
          top: p.top + '%', left: p.left + '%',
          '--p-size': p.size + 'px',
          '--p-color': p.color,
          '--p-dur': p.dur + 's',
          '--p-delay': p.delay + 's',
          '--p-dx': p.dx + 'px',
          '--p-dy': p.dy + 'px',
          '--p-max': p.max,
        }} />
      ))}
    </div>
  );
}

// ── Anzahlen an EINER Stelle (v811) ──────────────────────────────────
// Al, 5.9.: „erhoehe noch die Anzahl, noch sind sie zu subtil."
// Die beiden Zahlen sind die Stellschrauben; alles andere haengt daran.
const PARTIKEL_LOGO = 150;        // um den Schriftzug, dichter Bereich
const PARTIKEL_HINTERGRUND = 160; // ganzer Bildschirm, weiter gestreut

/** Um den Schriftzug: dicht gedraengt, kleine Teilchen, kurze Wege. */
function LogoParticles() {
  return <PixelParticles anzahl={PARTIKEL_LOGO} />;
}

/**
 * ★ v1264 (Al 22.9.): „das SC-Icon sollte Glitzer-Particles ausstossen."
 * Dieselbe Partikel-Mechanik wie um den Schriftzug, aber als Quelle:
 * die Funken starten auf der Muenze und fliegen rundum davon. Gold- und
 * Weisstoene statt Spielerfarbe — es ist Geld, kein Spielerabzeichen.
 * Die Form (Pixel-Kreuz) und der Takt stehen in style.css
 * (`.pp-sc-glitzer-teil`).
 */
const SC_GLITZER_FARBEN = ['#fff6b0', '#ffd700', '#ffe766', '#ffffff'];
// v1289: auch die SC-Plakette im Spielerprofil-Popup glitzert.
window.ScGlitzer = ScGlitzer;
function ScGlitzer() {
  return <PixelParticles
    anzahl={22}
    klasse="pp-sc-glitzer"
    teilchenKlasse="pp-sc-glitzer-teil"
    radial
    farben={SC_GLITZER_FARBEN}
    minGroesse={4}
    maxGroesse={10}
    driftX={36}
    driftY={30}
    dauerMin={1.1}
    dauerSpanne={1.2}
  />;
}

/**
 * Hinter dem gesamten Menue: weiter gestreut, groessere Teilchen,
 * laengere Wege — sonst wirkt dieselbe Dichte auf Bildschirmgroesse wie
 * Rauschen. Die Schicht liegt fest im Fenster und wird abgeschaltet,
 * sobald ein Kampffeld im Baum haengt (siehe style.css).
 */
function MenuBackgroundParticles({ klasse = 'pp-bg-particles' }) {
  return <PixelParticles
    anzahl={PARTIKEL_HINTERGRUND}
    klasse={klasse}
    teilchenKlasse="pp-bg-particle"
    minGroesse={2}
    maxGroesse={7}
    driftX={70}
    driftY={110}
    dauerMin={5}
    dauerSpanne={9}
  />;
}

/**
 * v1265: Zoomfaktor eines Elements — gezeichnete Breite durch Layout-
 * Breite. Unter `zoom` (--ui-scale) sind Rechtecke gezeichnete Pixel,
 * Stilwerte Layout-Pixel; wer misst und dann setzt, teilt durch diesen
 * Faktor. Am Element selbst gemessen, damit auch verschachtelte Zooms
 * stimmen.
 */
function menuZoomFaktor(el, rect) {
  const r = rect || el.getBoundingClientRect();
  return (el.offsetWidth > 0 && r.width > 0) ? r.width / el.offsetWidth : 1;
}

// ═══════════════════════════════════════════
//  MAIN MENU
// ═══════════════════════════════════════════
function MainMenu() {
  const { user, setScreen, setUser, notify, setBgmMode } = useContext(AppContext);
  // ── Cheatcode (Als Auftrag): 1-2-3-4-5 nacheinander im Hauptmenü
  // schaltet sofort alle CPU-Gegner + alle Structure Decks frei
  // (Daten-Sammel-Modus). Puffer hält die letzten 5 Ziffern-Tasten;
  // jede Nicht-Ziffer setzt zurück. Bewusst ohne UI-Hinweis — es ist
  // ein Cheatcode. Der Listener lebt nur in dieser Komponente, der
  // Code wirkt also ausschließlich im Hauptmenü.
  const cheatBufRef = useRef('');
  useEffect(() => {
    const onKey = async (e) => {
      // Eingabefelder (Chat etc.) nicht abgreifen.
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') { cheatBufRef.current = ''; return; }
      if (!/^[0-9]$/.test(e.key)) { cheatBufRef.current = ''; return; }
      cheatBufRef.current = (cheatBufRef.current + e.key).slice(-5);
      // ── Kampagne (Story-Modus): dreimal die 1 ──
      // Noch nicht oeffentlich, deshalb wie der Freischalt-Cheat ueber
      // denselben Ziffernpuffer. Wird VOR dem 5er-Code geprueft, sonst
      // schluckt '11111' beide.
      if (cheatBufRef.current.slice(-3) === '111') {
        cheatBufRef.current = '';
        if (window.playSFX) window.playSFX('ui_click');
        setScreen('campaign');
        return;
      }
      if (cheatBufRef.current !== '12345') return;
      cheatBufRef.current = '';
      try {
        const data = await api('/cheat/unlock-all', { method: 'POST' });
        notify(`🔓 Cheat activated: +${data.newOpponents} opponents, +${data.newStructures} Structure Decks unlocked!`, 'success');
      } catch (err) {
        notify(err.message || 'Cheat failed', 'error');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // ── Menu top-anchor ──
  // Out of the box, .screen-center vertically centers the whole menu
  // (title + buttons + user-info), so when the Puzzle submenu opens
  // the menu grows in BOTH directions and the top creeps upward. We
  // measure the collapsed-state top of the menu's first natural child
  // once on mount, then switch the layout from `justify-content: center`
  // to `flex-start` with a captured `padding-top` that visually
  // matches that position. After this anchor is locked in, opening the
  // submenu only extends the menu DOWNWARD — the title and the rest
  // of the page sit exactly where they did when the menu was collapsed.
  const screenRef = useRef(null);
  const menuBodyRef = useRef(null);
  const [menuTopPad, setMenuTopPad] = useState(null);
  // Top offset + height (px) of the menu-body strip — used to align the
  // flanking hub panels with the button strip and match its height.
  const [panelTop, setPanelTop] = useState(null);
  const [panelHeight, setPanelHeight] = useState(null);
  useLayoutEffect(() => {
    if (menuTopPad !== null || !screenRef.current) return;
    const screenEl = screenRef.current;
    // Find the first non-absolutely-positioned child — skipping the
    // logout/volume tray that floats over the corner. That child is
    // the menu's natural visual top (the title <h1>).
    const firstFlowChild = Array.from(screenEl.children).find(c => {
      const cs = getComputedStyle(c);
      // `display: contents` (die Huelle `.menu-topleft`, v836) hat keinen
      // eigenen Kasten — ihr Rect waere 0/0 und der Anker saesse falsch.
      if (cs.display === 'contents') return false;
      return cs.position !== 'absolute' && cs.position !== 'fixed';
    });
    if (!firstFlowChild) return;
    const screenRect = screenEl.getBoundingClientRect();
    const childRect = firstFlowChild.getBoundingClientRect();
    // Drop the strip (and the side panels that align to it) below its
    // natural centered position, so there's a generous gap under the top
    // row; the slack is taken from the bottom margin.
    const MENU_VERTICAL_DROP = 40;
    // ★★ v1265: EINHEITEN UNTER `zoom` (dieselbe Falle wie der
    // Editor-Scaler, siehe CARD_API). `.screen-center` traegt
    // `zoom: var(--ui-scale)`; Rechtecke liefern GEZEICHNETE Pixel, das
    // Polster hier ist aber ein CSS-Wert in LAYOUT-Pixeln. Ungeteilt lag
    // die Oberkante der Kaesten bei gleichem Layout je nach Fenster bei
    // 84 (1366×768), 150 (1600×900) oder 240 px (1920×1080) — bei
    // kleinen Fenstern ragte die Kopfzeile in die Kaesten.
    const z = menuZoomFaktor(screenEl, screenRect);
    setMenuTopPad(Math.max(0, (childRect.top - screenRect.top) / z) + MENU_VERTICAL_DROP);
  }, [menuTopPad]);
  // Once the menu's vertical anchor is locked in, measure where the
  // button strip (menu-body) begins and how tall it is, so the side
  // panels line up with its top and match its height. Re-runs on the
  // anchor recompute (mount + resize) and when the puzzle submenu
  // toggles (which changes the strip's height).
  useLayoutEffect(() => {
    if (menuTopPad === null || !screenRef.current || !menuBodyRef.current) return;
    const screenRect = screenRef.current.getBoundingClientRect();
    const bodyRect = menuBodyRef.current.getBoundingClientRect();
    // v1265: in Layout-Pixel umrechnen — `top`/`height` der Seitenkaesten
    // und der Logo-Huelle sind CSS-Werte (siehe oben).
    const z = menuZoomFaktor(screenRef.current, screenRect);
    setPanelTop(Math.max(0, (bodyRect.top - screenRect.top) / z));
    setPanelHeight(Math.round(bodyRect.height / z));
    // ★★ v1281 (Als Befund 22.9.: „im Vollbildmodus ist der Avatar falsch
    // platziert, das Layout laesst keinen Platz dafuer"). Die Breiten der
    // Seitenkaesten und der linken Gasse mischten `%` (vom GEZOOMTEN
    // Menue) mit `vw` (vom UNGEZOOMTEN Fenster). Unter Zoom laufen beide
    // auseinander: bei 1920x1080 (Zoom 1.2) wurde der Kasten 564 statt
    // 470 px breit, die Gasse schrumpfte auf 89 px — und der 192 px
    // breite Avatar ragte links heraus. `--menu-vw` ist 1 vw in
    // LAYOUT-Pixeln; alle Menuebreiten rechnen seit v1281 damit.
    screenRef.current.style.setProperty('--menu-vw', (window.innerWidth / z / 100) + 'px');
  }, [menuTopPad]);
  // Reset the anchor on viewport resize so a window-size change still
  // looks centered when collapsed. The next layout effect re-measures
  // against the new viewport.
  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setMenuTopPad(null));
    };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); cancelAnimationFrame(raf); };
  }, []);
  const [puzzleBrowserOpen, setPuzzleBrowserOpen] = useState(false);
  const [puzzleList, setPuzzleList] = useState(null); // null = not loaded, [] = empty
  const [puzzleAttemptState, setPuzzleAttemptState] = useState(null);
  const puzzleAttemptRoom = useRef(null);
  const [scFloat, setScFloat] = useState(null); // { amount, id }

  // ── Daily challenge ──
  // null = not loaded; otherwise the /api/daily payload.
  const [daily, setDaily] = useState(null);
  const [dailyOpen, setDailyOpen] = useState(false);
  const [dailyStarting, setDailyStarting] = useState(false);
  const [dailyTick, setDailyTick] = useState(0); // forces re-render of the countdown

  const loadDaily = useCallback(() => {
    api('/daily').then(setDaily).catch(() => {});
  }, []);

  useEffect(() => { loadDaily(); }, [loadDaily]);

  // Re-poll once the next 12:00 CET reset is reached so the button
  // re-highlights without requiring a page refresh.
  useEffect(() => {
    if (!daily?.nextResetTs) return;
    const nowMs = Date.now();
    const fireAt = (daily.nextResetTs * 1000) - (daily.nowTs * 1000 - nowMs);
    const ms = Math.max(0, fireAt - nowMs) + 1500;
    // Cap at a 24h timer so an absurdly off clock doesn't disable polling.
    const t = setTimeout(loadDaily, Math.min(ms, 24 * 60 * 60 * 1000));
    return () => clearTimeout(t);
  }, [daily?.nextResetTs, daily?.nowTs, loadDaily]);

  // Tick the countdown inside the modal once per second.
  useEffect(() => {
    if (!dailyOpen || !daily?.active) return;
    const t = setInterval(() => setDailyTick(x => x + 1), 1000);
    return () => clearInterval(t);
  }, [dailyOpen, daily?.active]);

  const openDaily = async () => {
    setDailyOpen(true);
    if (daily?.available && !dailyStarting) {
      setDailyStarting(true);
      try {
        const data = await api('/daily/start', { method: 'POST' });
        setDaily(data);
      } catch (e) {
        notify(e.message || 'Failed to start daily challenge', 'error');
        // Refresh in case the server now disagrees about availability.
        loadDaily();
      }
      setDailyStarting(false);
    }
  };

  const closeDaily = () => setDailyOpen(false);

  // Build a fresh, empty deck with the three Daily Heroes pre-slotted, then
  // jump straight into the deck editor on it.
  const [creatingDailyDeck, setCreatingDailyDeck] = useState(false);
  const createDailyDeck = async () => {
    if (creatingDailyDeck || !(daily?.heroes?.length === 3)) return;
    setCreatingDailyDeck(true);
    try {
      const heroes = daily.heroes.map((name) => {
        const c = CARDS_BY_NAME[name];
        return { hero: name, ability1: c?.startingAbility1 || null, ability2: c?.startingAbility2 || null };
      });
      const created = await api('/decks', { method: 'POST', body: JSON.stringify({ name: 'Daily Deck' }) });
      const id = created.deck.id;
      await api('/decks/' + id, { method: 'PUT', body: JSON.stringify({
        name: 'Daily Deck', mainDeck: [], heroes, potionDeck: [], sideDeck: [], isDefault: false,
      }) });
      // Tell the deck editor which deck to open on mount.
      window._deckBuilderOpenDeckId = id;
      setDailyOpen(false);
      setScreen('deckbuilder');
    } catch (e) {
      notify(e.message || 'Failed to create Daily Deck', 'error');
    }
    setCreatingDailyDeck(false);
  };

  // Escape to close the daily modal.
  useEffect(() => {
    if (!dailyOpen) return;
    const h = (e) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        setDailyOpen(false);
      }
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [dailyOpen]);

  // Tutorial state — the flow itself lives in the shared useTutorialFlow hook.
  const [tutorialBrowserOpen, setTutorialBrowserOpen] = useState(false);
  const { tutorialList, tutorialAttemptState, startTutorialAttempt, onTutorialAttemptLeave } = useTutorialFlow(tutorialBrowserOpen);

  // Singleplayer lives in its own screen now (see SingleplayerScreen).
  // MainMenu just routes to it via setScreen('singleplayer').

  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const logout = async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch {}
    window.AUTH_TOKEN = null;
    setUser(null);
  };

  // ── ESCAPE IM HAUPTMENUE FRAGT NACH DEM AUSLOGGEN (Als Vorgabe 17.8.) ─
  // „Im Hauptmenue Escape zu druecken, sollte das ‚Really log out?'-
  //  Submenue aufrufen, als haette man Logout geklickt."
  //
  // Nur, wenn sonst NICHTS offen ist: sonst wuerde Escape gleichzeitig
  // das Tagesfenster schliessen UND die Abmeldefrage aufmachen. Die
  // anderen Fenster registrieren ihre eigenen Escape-Behandlungen in der
  // Capture-Phase und rufen `stopImmediatePropagation()` — dieser
  // Listener haengt deshalb bewusst in der BUBBLE-Phase und kommt gar
  // nicht erst dran, solange eines von ihnen offen ist.
  useEffect(() => {
    if (logoutConfirm) return;
    const onKey = (e) => {
      if (e.key !== 'Escape' || e.repeat) return;
      if (e.target?.closest?.('input, textarea, [contenteditable="true"]')) return;
      setLogoutConfirm(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [logoutConfirm]);

  // Close the logout confirmation on Escape or an outside click.
  useEffect(() => {
    if (!logoutConfirm) return;
    const onDown = (e) => { if (!e.target.closest('.menu-logout-confirm-wrap')) setLogoutConfirm(false); };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); setLogoutConfirm(false); } };
    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('mousedown', onDown, true); window.removeEventListener('keydown', onKey, true); };
  }, [logoutConfirm]);

  // ── KEIN FOKUSRAHMEN NACH ESCAPE ────────────────────────────────────
  // Der geklickte Menueknopf behielt beim Oeffnen eines Unterfensters
  // (Daily, Puzzle-Bibliothek, How to Play, Abmeldefrage) den Fokus.
  // Schliesst man das Fenster dann per Escape, gilt die letzte Eingabe als
  // Tastatur — der Browser wertet den Fokus als `:focus-visible` und
  // zeichnet den (gestrichelten) Fokusrahmen um den Knopf. Deshalb gibt
  // der Knopf den Fokus ab, sobald eines der Fenster aufgeht.
  useEffect(() => {
    if (!(dailyOpen || puzzleBrowserOpen || tutorialBrowserOpen || logoutConfirm)) return;
    const el = document.activeElement;
    if (el && el.tagName === 'BUTTON' && screenRef.current?.contains(el)
        && !el.closest('.menu-logout-frage')) el.blur();
  }, [dailyOpen, puzzleBrowserOpen, tutorialBrowserOpen, logoutConfirm]);

  // Fetch puzzle list when browser opens
  useEffect(() => {
    if (!puzzleBrowserOpen) return;
    socket.emit('get_puzzles');
    const onList = (list) => setPuzzleList(list);
    socket.on('puzzle_list', onList);
    return () => socket.off('puzzle_list', onList);
  }, [puzzleBrowserOpen]);

  // Listen for puzzle game state during attempts
  useEffect(() => {
    if (!puzzleBrowserOpen) return;
    const onGameState = (state) => {
      if (state.isPuzzle && !state.isTutorial) {
        puzzleAttemptRoom.current = state.roomId;
        setPuzzleAttemptState(state);
      }
    };
    const onPuzzleError = (msg) => notify('Puzzle error: ' + msg, 'error');
    socket.on('game_state', onGameState);
    socket.on('puzzle_error', onPuzzleError);
    return () => { socket.off('game_state', onGameState); socket.off('puzzle_error', onPuzzleError); };
  }, [puzzleBrowserOpen, notify]);

  // Escape key: close browser or leave attempt
  useEffect(() => {
    if (!puzzleBrowserOpen) return;
    const h = (e) => {
      if (e.key === 'Escape') {
        if (puzzleAttemptState) return; // GameBoard handles its own Escape
        setPuzzleBrowserOpen(false);
        e.stopImmediatePropagation();
      }
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [puzzleBrowserOpen, puzzleAttemptState]);

  const startPuzzleAttempt = (puzzle) => {
    window._currentPuzzleAttempt = { puzzleId: puzzle.puzzleId, difficulty: puzzle.difficulty };
    socket.emit('start_puzzle_attempt', { puzzleId: puzzle.puzzleId, difficulty: puzzle.difficulty });
  };

  const onPuzzleAttemptLeave = useCallback(() => {
    const gs = puzzleAttemptState;
    const roomId = puzzleAttemptRoom.current;
    const result = gs?.result;
    if (roomId) socket.emit('leave_game', { roomId });
    setPuzzleAttemptState(null);
    puzzleAttemptRoom.current = null;
    // Refresh puzzle list to show updated checkmarks
    socket.emit('get_puzzles');
    if (result) {
      const success = result.isPuzzle && result.puzzleResult === 'success';
      if (success && result.scAwarded > 0) {
        setScFloat({ amount: result.scAwarded, id: Date.now() });
        // Optimistically refresh the local SC counter — the server
        // already incremented `users.sc` in the DB during
        // `puzzleEndGame`, but `setUser` isn't called there and
        // there's no auth refresh until the next `/auth/me` poll.
        // Without this update the menu's SC display lags (still
        // shows the pre-puzzle balance) until the user navigates
        // away and back or reloads.
        setUser(u => u ? { ...u, sc: (u.sc || 0) + result.scAwarded } : u);
        notify(`🧩 Puzzle cleared! +${result.scAwarded} 🪙`, 'success');
      } else if (success) {
        notify('🧩 Puzzle cleared!', 'success');
      } else {
        notify('Puzzle not cleared — try again!', 'info');
      }
    }
  }, [puzzleAttemptState, notify, setUser]);

  // ── Tutorial system — list fetch, attempt board state and intro textboxes
  // all live in the shared useTutorialFlow hook (called above). The Escape
  // handler stays here because it's tied to this screen's modal. ──
  useEffect(() => {
    if (!tutorialBrowserOpen) return;
    const h = (e) => {
      if (e.key === 'Escape') {
        if (tutorialAttemptState) return;
        setTutorialBrowserOpen(false);
        e.stopImmediatePropagation();
      }
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [tutorialBrowserOpen, tutorialAttemptState]);

  // Puzzle-Versuche laufen auf `bgm_puzzle_probieren`, Tutorials weiter
  // auf dem alten `bgm_puzzle` — Al hat die beiden neuen Stuecke
  // ausdruecklich fuer Puzzles bestellt, nicht fuers Tutorial.
  // Der Rumpf deckt alle Faelle ab; das Aufraeumen laeuft NUR beim
  // Verlassen des Menues. Ein `return () => setBgmMode('menu')` an einem
  // Effekt mit Deps feuert bei JEDEM Dep-Wechsel vor dem Rumpf — im
  // Creator hat genau das die Probieren-Musik ueberschrieben.
  // Antonias Auftritt/Abgang schaltet das Tutorial-Thema um. `antoniaHere`
  // steht in den Deps, damit ein Wechsel MITTEN im Tutorial greift.
  const antoniaHere = useAntoniaPresent();
  useEffect(() => {
    if (!setBgmMode) return;
    // Puzzle-Ergebnis: Sieg- bzw. Niederlage-Thema, solange der
    // Ergebnis-Screen steht. Tutorials sind hier BEWUSST nicht dabei —
    // bei ihnen laeuft das Tutorial-Thema noch durch den Outro-Dialog,
    // und GameBoard schaltet erst mit der Fanfare um (v184).
    const _pr = puzzleAttemptState?.result;
    const _tr = tutorialAttemptState?.result;
    if (_pr && typeof _pr.winnerIdx === 'number') {
      setBgmMode(_pr.winnerIdx === puzzleAttemptState.myIndex ? 'win' : 'defeat');
    }
    else if (puzzleAttemptState) setBgmMode('puzzleAttempt');
    // Tutorial-NIEDERLAGE: sofort aufs Niederlage-Thema.
    //
    // Warum nur die Niederlage: bei einem SIEG laeuft danach der
    // Outro-Dialog, und v184 haelt dafuer bewusst das Tutorial-Thema —
    // GameBoard schaltet dort erst mit der Fanfare auf `win`. Weil der
    // Effekt in GameBoard (Kind) VOR diesem hier (Elternteil) laeuft,
    // ueberschrieb dieser Effekt beim Ergebniswechsel das gerade
    // gesetzte `defeat` wieder mit dem Tutorial-Thema. Beim Sieg fiel es
    // nicht auf, weil die Fanfare dort erst SPAETER feuert (nach dem
    // Outro) und dieser Effekt bis dahin nicht erneut laeuft.
    else if (_tr && typeof _tr.winnerIdx === 'number'
             && _tr.winnerIdx !== tutorialAttemptState.myIndex) setBgmMode('defeat');
    // BEWUSST ohne `!result`: zwischen dem Sieg und der Fanfare laeuft
    // noch der Outro-Dialog, und dabei soll das Tutorial-Thema WEITER
    // spielen. Den Wechsel aufs Menue-Thema stoesst GameBoard an, wenn
    // die Fanfare feuert — der Fanfaren-Duck haelt ihn zurueck und wendet
    // ihn direkt danach an, also nahtlos.
    else if (tutorialAttemptState) setBgmMode(antoniaHere ? 'tutorialAntonia' : 'tutorial');
    else setBgmMode('menu');
  }, [puzzleAttemptState, tutorialAttemptState, antoniaHere, setBgmMode]);

  // Startzustand je Tutorial-Durchgang aus dem SKRIPT lesen, nicht
  // pauschal auf "abwesend" setzen: in Tutorial 6 und 7 ist Antonia die
  // linke Dauer-Sprecherin und damit von der ersten Sekunde an da — noch
  // bevor die erste Textbox aufgeht. Beim Ende wieder loeschen, damit
  // ein neuer Lauf nichts erbt.
  useEffect(() => {
    if (!setAntoniaPresent) return;
    if (!tutorialAttemptState) { setAntoniaPresent(false); return; }
    if (tutorialStartsWithAntonia && tutorialStartsWithAntonia(window._currentTutorialNum)) {
      setAntoniaPresent(true);
    }
  }, [tutorialAttemptState]);

  const menuBgmRef = useRef(setBgmMode);
  menuBgmRef.current = setBgmMode;
  useEffect(() => () => { if (menuBgmRef.current) menuBgmRef.current('menu'); }, []);

  // Render GameBoard during tutorial attempt
  if (tutorialAttemptState) {
    const GameBoard = window.GameBoard;
    return (
      <GameBoard
        gameState={tutorialAttemptState}
        lobby={{ id: tutorialAttemptState.roomId }}
        onLeave={onTutorialAttemptLeave}
        decks={[]}
        sampleDecks={[]}
        selectedDeck={null}
        setSelectedDeck={() => {}}
      />
    );
  }

  // Render GameBoard during puzzle attempt
  if (puzzleAttemptState) {
    const GameBoard = window.GameBoard;
    return (
      <GameBoard
        gameState={puzzleAttemptState}
        lobby={{ id: puzzleAttemptState.roomId }}
        onLeave={onPuzzleAttemptLeave}
        decks={[]}
        sampleDecks={[]}
        selectedDeck={null}
        setSelectedDeck={() => {}}
      />
    );
  }

  return (
    <div ref={screenRef}
         className="screen-center main-menu-screen"
         style={{
           flexDirection: 'column',
           gap: 20,
           position: 'relative',
           // The player's own colour, exposed as a custom property so the
           // ornate frames on the menu strip + side panels can all pick it
           // up via inheritance.
           '--player-color': user.color || '#00f0ff',
           // Konturfarbe fuer Spielername und Logo-Aussenkante: schwarz,
           // bei sehr dunkler Spielerfarbe weiss (ppUmrissFarbe).
           '--pp-umriss': ppUmrissFarbe(user.color || '#00f0ff'),
           // Once the collapsed-state top is captured, anchor it via
           // `padding-top` + `flex-start` so submenu toggles only
           // grow the menu downward.
           ...(menuTopPad !== null && { justifyContent: 'flex-start', paddingTop: menuTopPad }),
         }}>
      <MenuCardBackground />
      {/* Partikel im Hauptmenue (v810): HIER und nicht ueber die feste
          Schicht in App. Die Kartenwand darueber ist ein DECKENDER
          Vollbildkasten (`.menu-card-bg`, `background: var(--bg1)`) —
          alles dahinter ist unsichtbar, und genau deshalb waren die
          Partikel im Login zu sehen, im Hauptmenue aber nicht.
          Diese Schicht liegt direkt NACH der Wand und damit ueber ihr,
          aber vor dem Menueinhalt: beide stehen auf z-Ebene 0, ueber die
          Reihenfolge im Baum entschieden. */}
      <MenuBackgroundParticles klasse="pp-menu-particles" />
      <MenuLeaderboardPanel top={panelTop} height={panelHeight} />
      <MenuPlayerPanel top={panelTop} height={panelHeight} />
      {/* Brand logo (data/logo.png) — decoupled from the top row and centered
          vertically in the gap between the top of the screen and the menu boxes
          (the wrapper spans top:0 → panelTop, which is the top of .menu-body).
          The pp-logo-tint/-licht overlays paint the player colour onto it. */}
      <div className="pp-logo-wrap" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: panelTop != null ? panelTop : 160, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5, pointerEvents: 'none' }}>
        <div className="pp-logo-stack">
          <LogoParticles />
          <img src="/data/logo.png" alt="Pixel Parties" className="pp-logo-img" />
          <div className="pp-logo-tint" aria-hidden="true"></div>
          <div className="pp-logo-licht" aria-hidden="true"></div>
          <div className="pp-logo-umriss" aria-hidden="true"></div>
          {/* ★ v1264 (Al 22.9.): wandernder Foil-Glanz ueber dem
              Schriftzug, auf die Buchstaben maskiert (style.css,
              `.pp-glanz--logo`). */}
          <GlanzBand klasse="pp-glanz--logo" />
        </div>
      </div>
      {/* ── OBEN LINKS (v836): Statistik-Plaketten und Name/Avatar in EINER
          Huelle. Auf dem Desktop ist die Huelle `display: contents` — die
          beiden Bloecke liegen genau wie vorher (Plaketten oben links,
          Name+Avatar in der Rinne neben dem Bestenlisten-Kasten). Im
          Telefon-Layout wird die Huelle zu einer Zeile oben links:
          Avatar, Name, ELO, SC nebeneinander — die Rinne gibt es dort nicht
          mehr (Als Befund 8.9.: „Avatar und Spielername zu weit links und
          halb aus dem Bild"). Alle Layout-Masse stehen in style.css unter
          `.menu-stats` / `.menu-profile-gutter` / `.menu-corner`; Inline
          bleibt nur, was vom Spieler abhaengt (Farbe, Bild, Messwerte). */}
      <div className="menu-topleft">
      <div className="menu-stats">
        <div className="menu-stats-row">
          {/* ELO + SC stats (the name now lives above the avatar below). */}
          {/* v1263 (Al 21.9.): Elo/SC „aufgehuebscht" — Plakettenform mit
              Beschriftung, Glanz und Schlagschatten (CSS .menu-stat-badge). */}
          {/* v1264 (Al 22.9.): dieselben inneren Pixel-Ecken wie die grossen
              Menuekaesten (`pp-eckzier`, eine Definition fuer beide). */}
          <span className="badge menu-stat-badge pp-eckzier" style={{ background: 'color-mix(in srgb, var(--player-color, #00f0ff) 14%, var(--menu-surface))', color: 'var(--player-color, #00f0ff)' }}>
            <span className="menu-stat-label">⚔ ELO</span><span className="menu-stat-value">{user.elo}</span>
          </span>
          <span className="badge menu-stat-badge menu-stat-badge--sc pp-eckzier" style={{ background: 'color-mix(in srgb, #ffd700 12%, var(--menu-surface))', color: '#ffd700' }}>
            <span className="menu-stat-coin-wrap"><img src="/data/sc.png" className="menu-stat-coin" /><ScGlitzer /></span><span className="menu-stat-label">SC</span><span className="menu-stat-value">{user.sc || 0}</span>
          </span>
        </div>
      </div>
      {/* Player name stacked directly above the avatar, both horizontally
          centered in the gutter between the screen edge and the Top Players
          panel (equal gaps on both sides). Clicking either opens the profile. */}
      <div className="menu-profile-gutter" style={panelTop != null ? { top: panelTop } : undefined}>
        <span className="orbit-font menu-player-name" onClick={() => setScreen('profile')} title="View Profile"
          style={{ color: user.color || 'var(--accent)' }}>{user.username}</span>
        <div className="menu-profile-avatar" onClick={() => setScreen('profile')} title="View Profile"
          style={{
            color: user.color || 'var(--accent)',
            borderColor: user.color || 'var(--accent)',
            boxShadow: '0 0 18px ' + (user.color || 'var(--accent)') + '55',
          }}>
          {user.avatar
            ? <img src={user.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover', imageRendering: 'pixelated' }} />
            : <span className="menu-profile-avatar-fallback">👤</span>}
        </div>
      </div>
      </div>
      <div className="menu-corner">
        <div className="menu-corner-row">
          <div className="menu-logout-confirm-wrap" style={{ position: 'relative' }}>
            {/* v1263 (Al 21.9.): so hoch wie Elo/SC-Plakette (46 px), Breite skaliert mit — Masse in .menu-logout-btn--gross */}
            <button className="btn menu-logout-btn menu-logout-btn--gross" onClick={() => setLogoutConfirm(v => !v)}>LOGOUT</button>
            {logoutConfirm && (
              /* Eine Nummer groesser (Als Vorgabe 17.8.). Die Position
                 bleibt — das Feld haengt unter dem LOGOUT-Knopf und
                 rechtsbuendig, sonst wanderte es aus der Ablage heraus.
                 Aussehen (Pixelfenster, Knoepfe im Kartenstil) in
                 style.css unter `.menu-logout-frage`. */
              <div className="menu-logout-frage" role="dialog" aria-label="Log out">
                <div className="menu-logout-frage-text">Really log out?</div>
                <div className="menu-logout-frage-knoepfe">
                  <button className="btn menu-logout-ja" onClick={logout}>YES</button>
                  <button className="btn menu-logout-nein" onClick={() => setLogoutConfirm(false)}>NO</button>
                </div>
              </div>
            )}
          </div>
          <VolumeControl />
        </div>
        <DiscordButton block />
      </div>
      <div ref={menuBodyRef} className="menu-body ornate-frame" style={{ position: 'relative', zIndex: 1 }}>
        <div className="animate-in menu-buttons">
          {/* Bewusst OHNE Icons: Beschriftung mittig, ein Pfeil rechts, der
              beim Ueberfahren hineingleitet (style.css,
              „HAUPTMENUE-AUFHUEBSCHUNG"). PLAY ONLINE ist der
              Hauptknopf: gefuellt in der Spielerfarbe, mit Glanzband. */}
          <button className="btn btn-big menu-nav-btn menu-nav-btn--primary" onClick={() => setScreen('play')}>
            <span className="menu-nav-label">PLAY ONLINE</span>
            <PixelIcon name="pfeil" className="menu-nav-pfeil" />
            <GlanzBand klasse="pp-glanz--knopf" />
          </button>
          <button className="btn btn-big menu-nav-btn" onClick={() => setScreen('singleplayer')}>
            <span className="menu-nav-label">VS CPU</span>
            <PixelIcon name="pfeil" className="menu-nav-pfeil" /></button>
          <button className="btn btn-big menu-nav-btn" onClick={openDaily} title="Daily Challenge">
            <span className="menu-nav-label">DAILY{daily?.active && daily?.claimedBig ? ' ✓' : ''}</span>
            <PixelIcon name="pfeil" className="menu-nav-pfeil" />
            {/* Heute noch nicht gestartet → kleines NEW-Schild an der Ecke. */}
            {daily?.available && <span className="menu-nav-badge">NEW</span>}
          </button>
          {/* Puzzle pair: two half-width buttons sharing one row. */}
          <div className="menu-nav-row">
            <button className="btn btn-big menu-nav-btn menu-nav-btn--half" onClick={() => setScreen('puzzle-create')}>
              <span className="menu-nav-label">CREATE PUZZLE</span></button>
            <button className="btn btn-big menu-nav-btn menu-nav-btn--half" onClick={() => setPuzzleBrowserOpen(true)}>
              <span className="menu-nav-label">ATTEMPT PUZZLE</span></button>
          </div>
          <button className="btn btn-big menu-nav-btn" onClick={() => setScreen('deckbuilder')}>
            <span className="menu-nav-label">DECK EDITOR</span>
            <PixelIcon name="pfeil" className="menu-nav-pfeil" /></button>
          <button className="btn btn-big menu-nav-btn" onClick={() => setScreen('shop')}>
            <span className="menu-nav-label">SHOP</span>
            <PixelIcon name="pfeil" className="menu-nav-pfeil" /></button>
          <button className="btn btn-big menu-nav-btn" onClick={() => setScreen('profile')}>
            <span className="menu-nav-label">PROFILE</span>
            <PixelIcon name="pfeil" className="menu-nav-pfeil" /></button>
          {/* How to Play replaces the old Tutorial + Rules buttons; it opens
              the tutorial browser, which now always offers View Rules. */}
          <button className="btn btn-big menu-nav-btn" onClick={() => setTutorialBrowserOpen(true)}>
            <span className="menu-nav-label">HOW TO PLAY</span>
            <PixelIcon name="pfeil" className="menu-nav-pfeil" /></button>
        </div>
      </div>

      {/* ── Daily Challenge Modal ── */}
      {dailyOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={(e) => { if (e.target === e.currentTarget) closeDaily(); }}>
          <div className="menu-popup-dither pp-fenster" style={{ background: 'var(--bg2)', width: 700, maxWidth: '92vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <div className="pp-fenster-kopf" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', position: 'relative' }}>
              <h3 className="orbit-font title-outline" style={{ fontSize: 22, fontWeight: 800, color: 'var(--player-color)', margin: 0, whiteSpace: 'nowrap', position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>DAILY CHALLENGE</h3>
              <button className="btn" onClick={closeDaily} style={{ padding: '2px 10px', fontSize: 10 }}>✕</button>
            </div>
            <div style={{ padding: '18px 22px 22px', overflow: 'hidden auto' }}>
              {(dailyStarting || daily === null) ? (
                <div style={{ color: 'var(--text2)', textAlign: 'center', padding: 30, fontSize: 13 }}>Loading…</div>
              ) : (daily.active && daily.heroes?.length === 3) ? (
                <>
                  <div style={{ color: 'var(--text1)', fontSize: 13, lineHeight: 1.55, marginBottom: 14, textAlign: 'center' }}>
                    Win a game today with <b style={{ color: 'var(--player-color)' }}>2 of these Heroes</b> in your deck to earn{' '}
                    <b style={{ color: 'var(--player-color)' }}>{daily?.betraege?.zweiHelden ?? 50} bonus <CoinIcon size={14} /></b>,<br />
                    or <b style={{ color: 'var(--player-color)' }}>all 3 for {daily?.betraege?.dreiHelden ?? 100} bonus <CoinIcon size={14} /></b>!
                  </div>
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
                    {daily.heroes.map((name) => {
                      const card = CARDS_BY_NAME[name];
                      return (
                        <div key={name} style={{ width: 150, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                          {card ? (
                            <CardMini card={card} onClick={() => {}}
                              style={{ width: 150, height: 210, cursor: 'default', borderColor: 'var(--player-color)', boxShadow: '0 0 12px color-mix(in srgb, var(--player-color) 30%, transparent)' }} />
                          ) : (
                            <div style={{ width: 150, height: 210, borderRadius: 6, border: '1px solid var(--player-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)', fontSize: 11, textAlign: 'center', padding: 8 }}>{name}</div>
                          )}
                          <div style={{ fontSize: 11, color: 'var(--text2)', textAlign: 'center' }}>{name}</div>
                        </div>
                      );
                    })}
                  </div>
                  {/* One-click: spin up a fresh deck with all 3 Daily Heroes
                      pre-slotted and drop the player into the deck editor. */}
                  <button className="btn" onClick={createDailyDeck} disabled={creatingDailyDeck}
                    style={{ display: 'block', width: '100%', marginBottom: 14, padding: '11px', fontSize: 13, borderColor: 'var(--player-color)', color: 'var(--player-color)', background: 'color-mix(in srgb, var(--player-color) 12%, transparent)', fontWeight: 700, letterSpacing: 1 }}>
                    {creatingDailyDeck ? 'CREATING…' : 'CREATE DAILY DECK'}
                  </button>
                  {(() => {
                    const _ = dailyTick; // re-render hook for the live countdown
                    const nowMs = Date.now();
                    // Time remaining in seconds, measured against the wallclock
                    // delta since the /api/daily fetch (handles any client/server
                    // clock skew).
                    const remainSec = Math.max(0, Math.floor((daily.expiresTs - daily.nowTs) - (nowMs - daily.nowTs * 1000) / 1000));
                    const h = Math.floor(remainSec / 3600);
                    const m = Math.floor((remainSec % 3600) / 60);
                    const s = remainSec % 60;
                    const tStr = (h > 0 ? `${h}h ` : '') + `${m}m ${String(s).padStart(2, '0')}s`;
                    // Player colour normally; red once under an hour remains.
                    const timerColor = remainSec < 3600 ? '#ff4444' : 'var(--player-color)';
                    return (
                      <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text2)' }}>
                        {daily.claimedBig ? (
                          <div style={{ color: '#33ff88', marginBottom: 6 }}>
                            ✓ Big bonus claimed (+{daily.claimedBig} <CoinIcon size={12} />) — extra wins with 2+ Heroes now give <b>+{daily?.betraege?.wiederholung ?? 5} <CoinIcon size={12} /></b> each.
                          </div>
                        ) : (
                          <div style={{ marginBottom: 6 }}>Big bonus still available.</div>
                        )}
                        <div>Time remaining: <span style={{ color: timerColor, fontWeight: 700 }}>{tStr}</span></div>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <div style={{ color: 'var(--text2)', textAlign: 'center', padding: 20, fontSize: 13 }}>
                  No active daily challenge. Close and re-open to roll a new one.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Puzzle Browser Modal ── */}
      {puzzleBrowserOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={(e) => { if (e.target === e.currentTarget) setPuzzleBrowserOpen(false); }}>
          <div className="menu-popup-dither pp-fenster" style={{ background: 'var(--bg2)', width: 420, maxHeight: '80vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <div className="pp-fenster-kopf" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', position: 'relative' }}>
              <h3 className="orbit-font title-outline" style={{ fontSize: 22, fontWeight: 800, color: 'var(--player-color)', margin: 0, whiteSpace: 'nowrap', position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>PUZZLE LIBRARY</h3>
              <button className="btn" onClick={() => setPuzzleBrowserOpen(false)} style={{ padding: '2px 10px', fontSize: 10 }}>✕</button>
            </div>
            {scFloat && (
              <div key={scFloat.id} className="sc-float-reward" onAnimationEnd={() => setScFloat(null)}>
                <span>+{scFloat.amount}</span>
                <img src="/sc.png" alt="SC" style={{ width: 22, height: 22 }} draggable={false} />
              </div>
            )}
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px 20px 20px' }}>
              {puzzleList === null ? (
                <div style={{ color: 'var(--text2)', textAlign: 'center', padding: 30, fontSize: 13 }}>Loading puzzles...</div>
              ) : puzzleList.length === 0 ? (
                <div style={{ color: 'var(--text2)', textAlign: 'center', padding: 30, fontSize: 13 }}>No puzzles available yet.</div>
              ) : (
                ['easy', 'medium', 'hard'].map(diff => {
                  const puzzles = puzzleList.filter(p => p.difficulty === diff);
                  if (puzzles.length === 0) return null;
                  const diffColors = { easy: '#33ff88', medium: '#ffaa00', hard: '#ff4444' };
                  // v1402: Betrag kommt vom Server (Anzeige = Auszahlung).
                  const scReward = { [diff]: puzzles[0]?.scBetrag ?? 0 };
                  return (
                    <div key={diff} style={{ marginBottom: 16 }}>
                      <div className="orbit-font" style={{ fontSize: 14, fontWeight: 800, color: diffColors[diff], letterSpacing: 2, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {diff.toUpperCase()}
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', letterSpacing: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}>({scReward[diff]} <CoinIcon size={15} />)</span>
                      </div>
                      {puzzles.map(p => (
                        <button key={p.puzzleId} className="btn" onClick={() => startPuzzleAttempt(p)}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', fontSize: 13, marginBottom: 4, borderColor: diffColors[diff] + '44', color: 'var(--text1)', textAlign: 'left', justifyContent: 'flex-start' }}>
                          <span style={{ color: p.completed ? '#33ff88' : 'var(--bg4)', fontSize: 16, width: 20, textAlign: 'center' }}>{p.completed ? '✓' : '○'}</span>
                          <span style={{ flex: 1 }}>{p.name}</span>
                          {p.completed && <span style={{ fontSize: 9, color: 'var(--text2)' }}>CLEARED</span>}
                        </button>
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Tutorial Browser (How to Play) ── */}
      {tutorialBrowserOpen && (
        <TutorialBrowserModal
          tutorialList={tutorialList}
          onClose={() => setTutorialBrowserOpen(false)}
          onStart={startTutorialAttempt}
          onViewRules={() => { setTutorialBrowserOpen(false); setScreen('rules'); }}
        />
      )}
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
  const [victoryMsg, setVictoryMsg] = useState(user.victoryMsg || '');
  const [defeatMsg, setDefeatMsg] = useState(user.defeatMsg || '');
  const [saving, setSaving] = useState(false);

  // Name editor — inline rename with live availability feedback.
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user.username);
  // null = idle, 'checking', or { available: bool, reason: string }
  const [nameStatus, setNameStatus] = useState(null);
  const [savingName, setSavingName] = useState(false);

  // Password change
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  // Email & recovery
  const [emailInput, setEmailInput] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [emailStage, setEmailStage] = useState('idle'); // 'idle' | 'code'
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailEditing, setEmailEditing] = useState(false);

  const requestEmailCode = async () => {
    if (!emailInput.trim()) { notify('Enter an email address', 'error'); return; }
    setEmailBusy(true);
    try {
      const data = await api('/profile/email/request', { method: 'POST', body: JSON.stringify({ email: emailInput.trim() }) });
      setEmailInput(data.email); setEmailStage('code'); setEmailCode('');
      notify('Verification code sent — check your inbox.', 'success');
    } catch (e) { notify(e.message, 'error'); }
    setEmailBusy(false);
  };
  const confirmEmailCode = async () => {
    if (!emailCode.trim()) { notify('Enter the code from your email', 'error'); return; }
    setEmailBusy(true);
    try {
      const data = await api('/profile/email/confirm', { method: 'POST', body: JSON.stringify({ email: emailInput.trim(), code: emailCode.trim() }) });
      setUser(data.user);
      setEmailStage('idle'); setEmailEditing(false); setEmailCode(''); setEmailInput('');
      notify('Email verified!', 'success');
    } catch (e) { notify(e.message, 'error'); }
    setEmailBusy(false);
  };

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

  // Play Animations toggle. The flag is stored as 0/1 on the user
  // record, with `null`/missing treated as enabled. The battle client
  // reads this on game start and gates every animation + transition
  // when off.
  const [playAnimations, setPlayAnimations] = useState(user.play_animations == null ? true : !!user.play_animations);

  // Dirty tracking — compare against original user values
  const isDirty = color !== (user.color || '#00f0ff')
    || avatar !== user.avatar
    || cardback !== user.cardback
    || victoryMsg !== (user.victoryMsg || '')
    || defeatMsg !== (user.defeatMsg || '');

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
          headers: { 'Content-Type': 'application/json', ...(window.AUTH_TOKEN ? { 'x-auth-token': window.AUTH_TOKEN } : {}) }
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
            headers: { 'Content-Type': 'application/json', ...(window.AUTH_TOKEN ? { 'x-auth-token': window.AUTH_TOKEN } : {}) }
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

  // Debounced live availability check while the name editor is open. The
  // server is authoritative; we short-circuit the obvious cases (unchanged /
  // too short / too long) locally to avoid needless requests.
  useEffect(() => {
    if (!editingName) return;
    const trimmed = nameInput.trim();
    if (trimmed === user.username) { setNameStatus({ available: false, reason: 'This is your current name', unchanged: true }); return; }
    if (trimmed.length < 3) { setNameStatus({ available: false, reason: 'Too short (3+ characters)' }); return; }
    if (trimmed.length > 10) { setNameStatus({ available: false, reason: 'Too long (max 10 characters)' }); return; }
    setNameStatus('checking');
    const t = setTimeout(async () => {
      try {
        const data = await api('/profile/check-username?name=' + encodeURIComponent(trimmed));
        setNameStatus(data);
      } catch (e) { setNameStatus({ available: false, reason: 'Could not check name' }); }
    }, 350);
    return () => clearTimeout(t);
  }, [nameInput, editingName, user.username]);

  // Saveable only once the server confirms the (changed) name is free.
  const canSaveName = !savingName && nameStatus && nameStatus !== 'checking' && nameStatus.available === true;

  const startNameEdit = () => { setNameInput(user.username); setNameStatus(null); setEditingName(true); };
  const cancelNameEdit = () => { setEditingName(false); setNameInput(user.username); setNameStatus(null); };
  const saveName = async () => {
    if (!canSaveName) return;
    setSavingName(true);
    try {
      const data = await api('/profile', { method: 'PUT', body: JSON.stringify({ username: nameInput.trim() }) });
      setUser(data.user);
      setEditingName(false);
      // Refresh the live socket's cached identity so lobby/chat/new games
      // pick up the new name immediately (no relog needed).
      if (typeof socket !== 'undefined' && socket) socket.emit('refresh_identity');
      notify('Name updated!', 'success');
    } catch (e) { notify(e.message, 'error'); setNameStatus({ available: false, reason: e.message }); }
    setSavingName(false);
  };

  const save = async () => {
    // Client-side profanity guard mirrors the server's reject — just gives
    // faster feedback. The server stays the authoritative gate.
    const cp = window.containsProfanity;
    if (cp && cp(victoryMsg)) { notify('Victory Message: please remove inappropriate language.', 'error'); return; }
    if (cp && cp(defeatMsg)) { notify('Defeat Message: please remove inappropriate language.', 'error'); return; }
    setSaving(true);
    try {
      const data = await api('/profile', { method: 'PUT', body: JSON.stringify({ color, avatar, cardback, victoryMsg, defeatMsg }) });
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

  const togglePlayAnimations = async () => {
    const newVal = !playAnimations;
    setPlayAnimations(newVal);
    try {
      const data = await api('/profile/play-animations', { method: 'PUT', body: JSON.stringify({ play_animations: newVal }) });
      setUser(data.user);
    } catch (e) { notify(e.message, 'error'); setPlayAnimations(!newVal); }
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
        <button className="btn" onClick={() => setScreen('menu')}>← BACK</button>
        <h2 className="orbit-font" style={{ fontSize: 22, fontWeight: 800, color: 'var(--player-color)' }}>PLAYER PROFILE</h2>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 10, color: 'var(--text2)' }}>Member since {memberSince}</div>
        <VolumeControl />
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
                    ? <img src={avatar} style={{ width: '100%', height: '100%', objectFit: 'cover', imageRendering: 'pixelated' }} />
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

            {/* Username (inline editable, with live availability feedback) */}
            {!editingName ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 10 }}>
                <div className="orbit-font" style={{ fontSize: 30, fontWeight: 800, color, letterSpacing: 1, textShadow: `0 0 25px ${color}44`, textAlign: 'center' }}>
                  {user.username}
                </div>
                <button className="btn" title="Edit name" onClick={startNameEdit} style={{ padding: '3px 9px', fontSize: 13, lineHeight: 1 }}>✎</button>
              </div>
            ) : (() => {
              const checking = nameStatus === 'checking';
              const obj = (nameStatus && nameStatus !== 'checking') ? nameStatus : null;
              // Green when free, red when taken/invalid, neutral while checking
              // or when it's still the current (unchanged) name.
              const tone = (checking || !obj || obj.unchanged) ? 'var(--text2)'
                : obj.available ? 'var(--success)' : 'var(--danger)';
              return (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
                  <input className="input" value={nameInput} maxLength={10} autoFocus
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveName(); else if (e.key === 'Escape') cancelNameEdit(); }}
                    style={{ textAlign: 'center', fontSize: 22, fontWeight: 800, width: 260, color, borderColor: tone, boxShadow: `0 0 10px ${tone}33` }} />
                  <div style={{ fontSize: 12, fontWeight: 700, color: tone, minHeight: 15, letterSpacing: .5 }}>
                    {checking ? 'Checking…' : (obj ? obj.reason : '')}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-success" onClick={saveName} disabled={!canSaveName}
                      style={{ padding: '5px 16px', fontSize: 12, opacity: canSaveName ? 1 : .45 }}>
                      {savingName ? '…' : 'SAVE NAME'}
                    </button>
                    <button className="btn" onClick={cancelNameEdit} style={{ padding: '5px 16px', fontSize: 12 }}>CANCEL</button>
                  </div>
                </div>
              );
            })()}

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

            {/* In-game speech-bubble messages. Shown above your avatar to
                both players when a match ends — your Victory line if you win,
                your Defeat line if you lose. Capped at ~10 words; a basic
                profanity filter runs on save. */}
            <div>
              <div className="profile-section-label">VICTORY MESSAGE</div>
              <textarea
                className="profile-bio-input"
                value={victoryMsg}
                onChange={e => setVictoryMsg(e.target.value.slice(0, 80))}
                placeholder="Shown above your avatar when you win…"
                rows={2}
                maxLength={80}
              />
              <div style={{ textAlign: 'right', fontSize: 9, color: 'var(--text2)', marginTop: 2 }}>{victoryMsg.length}/80</div>
            </div>
            <div style={{ marginTop: 12 }}>
              <div className="profile-section-label">DEFEAT MESSAGE</div>
              <textarea
                className="profile-bio-input"
                value={defeatMsg}
                onChange={e => setDefeatMsg(e.target.value.slice(0, 80))}
                placeholder="Shown above your avatar when you lose…"
                rows={2}
                maxLength={80}
              />
              <div style={{ textAlign: 'right', fontSize: 9, color: 'var(--text2)', marginTop: 2 }}>{defeatMsg.length}/80</div>
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
              <div className="profile-heroes-col" style={{ borderLeft: '1px solid var(--bg4)', paddingLeft: 24, display: 'flex', flexDirection: 'column', flex: 1, minWidth: 140 }}>
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
                            <div className="profile-top-hero-wr-overlay" style={{ color: h.winRate >= 50 ? 'var(--success)' : 'var(--danger)' }}>
                              {h.winRate}%
                            </div>
                          </div>
                          <div className="profile-top-hero-details" style={{ flex: 1, minWidth: 0 }}>
                            <div className="profile-top-hero-name" title={h.name}>{h.name}</div>
                            <div className="profile-top-hero-stats" style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
                              <span className="orbit-font" style={{ fontSize: 14, fontWeight: 700, color: h.winRate >= 50 ? 'var(--success)' : 'var(--danger)' }}>
                                {h.winRate}%
                              </span>
                              <span className="profile-top-hero-wl" style={{ fontSize: 9, color: 'var(--text2)' }}>
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
                <div style={{ overflow: 'hidden auto', flex: 1 }}>
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

          {/* Settings */}
          <div className="profile-section profile-section-wide">
            <div className="profile-section-label">SETTINGS</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 12, color: 'var(--text)' }}>
                <div
                  onClick={togglePlayAnimations}
                  style={{
                    width: 40, height: 22, borderRadius: 11, background: playAnimations ? 'var(--accent)' : 'var(--bg4)',
                    position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0
                  }}
                >
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', background: '#fff',
                    position: 'absolute', top: 2, left: playAnimations ? 20 : 2,
                    transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,.4)'
                  }} />
                </div>
                <span onClick={togglePlayAnimations}>Play Animations</span>
              </label>
              <span style={{ fontSize: 9, color: 'var(--text2)' }}>Disable to skip battle animations — faster gameplay on low-power devices</span>
            </div>
          </div>

          {/* Email & recovery */}
          <div className="profile-section profile-section-wide">
            <div className="profile-section-label">EMAIL &amp; RECOVERY</div>
            {user.email && !emailEditing ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: 'var(--text)' }}>{user.email}</span>
                <span style={{ fontSize: 10, color: 'var(--success)', border: '1px solid var(--success)', borderRadius: 4, padding: '1px 6px' }}>VERIFIED</span>
                <button className="btn" style={{ padding: '6px 14px', fontSize: 10, marginLeft: 'auto' }}
                  onClick={() => { setEmailEditing(true); setEmailStage('idle'); setEmailInput(''); setEmailCode(''); }}>
                  CHANGE
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {!user.email && (
                  <span style={{ fontSize: 11, color: 'var(--text2)' }}>
                    Add a verified email so you can recover your account if you forget your password.
                  </span>
                )}
                {emailStage === 'idle' ? (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <input className="input" type="email" placeholder="your@email.com" value={emailInput}
                      onChange={e => setEmailInput(e.target.value)} style={{ flex: 1 }}
                      onKeyDown={e => e.key === 'Enter' && requestEmailCode()} />
                    <button className="btn" style={{ padding: '8px 18px', fontSize: 11, whiteSpace: 'nowrap' }}
                      onClick={requestEmailCode} disabled={emailBusy}>{emailBusy ? '...' : 'SEND CODE'}</button>
                    {user.email && emailEditing && (
                      <button className="btn" style={{ padding: '8px 14px', fontSize: 11 }}
                        onClick={() => { setEmailEditing(false); setEmailStage('idle'); }}>CANCEL</button>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--text2)', whiteSpace: 'nowrap' }}>Code sent to <b style={{ color: 'var(--text)' }}>{emailInput}</b></span>
                    <input className="input auth-code" inputMode="numeric" placeholder="000000" maxLength={6} value={emailCode}
                      onChange={e => setEmailCode(e.target.value.replace(/\D/g, ''))} style={{ flex: 1, fontSize: 16, letterSpacing: 6 }}
                      onKeyDown={e => e.key === 'Enter' && confirmEmailCode()} />
                    <button className="btn btn-success" style={{ padding: '8px 18px', fontSize: 11, whiteSpace: 'nowrap' }}
                      onClick={confirmEmailCode} disabled={emailBusy}>{emailBusy ? '...' : 'CONFIRM'}</button>
                    <button className="btn" style={{ padding: '8px 14px', fontSize: 11 }}
                      onClick={() => setEmailStage('idle')}>BACK</button>
                  </div>
                )}
              </div>
            )}
          </div>

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
  const { user, setUser, setScreen, notify, setBgmMode } = useContext(AppContext);

  // Switch to bgm_shop.mp3 while the shop is mounted; restore the
  // menu track on unmount. Mirror of PlayScreen's gameState-driven
  // bgmMode effect — keeping the policy local to each screen avoids
  // a screen-name → mode map in App that has to stay in sync as
  // screens are added.
  useEffect(() => {
    if (!setBgmMode) return;
    setBgmMode('shop');
    return () => setBgmMode('menu');
  }, [setBgmMode]);

  const [catalog, setCatalog] = useState(null);
  const [owned, setOwned] = useState({ avatar: [], sleeve: [], board: [], skin: [] });
  const [structureCatalog, setStructureCatalog] = useState(null); // { decks, price, randomPrice, defaultDeckId }
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [tab, setTab] = useState('skins');
  const [skinFilter, setSkinFilter] = useState('');
  const [selected, setSelected] = useState(null); // { type, id }
  const [celebration, setCelebration] = useState(null); // { cx, cy } or null
  const [randomReveal, setRandomReveal] = useState(null); // { imgUrl, label, subtitle } or null
  const [hoverDeckCard, setHoverDeckCard] = useState(null); // cover card name being previewed
  const [hoverSkin, setHoverSkin] = useState(null); // { skinName, heroName } being previewed
  // Skin ids currently flipped to show the original Hero art instead of the
  // skin art (toggled per-card via the Hero/Skin button under each tile).
  const [skinShowHero, setSkinShowHero] = useState(() => new Set());
  const toggleSkinHero = (id) => setSkinShowHero(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  // Tutorial 5 is where Antonia reveals her name in-story — until that
  // tutorial is cleared we call the shopkeep "Raccoon Shopkeep" instead.
  const [tutorial5Cleared, setTutorial5Cleared] = useState(false);
  // Speech bubble state. `key` forces the DOM node to remount on each
  // bubble so the bubble animation replays from 0. `text` is the message;
  // `chatter` flags long-form idle chatter so the bubble can wrap and
  // hang around longer than the quick "Khekhekhe!" purchase pop.
  const [bubble, setBubble] = useState({ visible: false, key: 0, text: 'Khekhekhe!', chatter: false });
  const bubbleTimerRef = useRef(null);
  // Timestamp of last purchase; gates idle chatter so Antonia pipes down
  // right after a sale instead of talking over the "Khekhekhe!" pop.
  const lastPurchaseAtRef = useRef(0);

  useEffect(() => {
    (async () => {
      try {
        const [catData, ownData, structData] = await Promise.all([
          api('/shop/catalog'),
          api('/shop/owned'),
          api('/shop/structure-decks'),
        ]);
        setCatalog(catData);
        setOwned(ownData.owned);
        setStructureCatalog(structData);
      } catch (e) { notify(e.message, 'error'); }
      setLoading(false);
    })();
  }, []);

  // Fetch tutorial completion list to gate the shopkeep's displayed name.
  // Piggy-backs on the existing `get_tutorials` socket endpoint — no new
  // server wiring needed.
  useEffect(() => {
    const onList = (list) => {
      const t5 = (list || []).find(t => t.num === 5);
      setTutorial5Cleared(!!t5?.completed);
    };
    socket.on('tutorial_list', onList);
    socket.emit('get_tutorials');
    return () => socket.off('tutorial_list', onList);
  }, []);

  // Fires the "Khekhekhe!" speech bubble + celebration + SFX trio that
  // every purchase path shares. Centralized so adding a new buy handler
  // automatically gets the shopkeep reaction.
  const triggerPurchaseFanfare = useCallback((pos) => {
    setCelebration(pos);
    if (window.playSFX) window.playSFX('shop_purchase');
    lastPurchaseAtRef.current = Date.now();
    setBubble(prev => ({ visible: true, key: prev.key + 1, text: 'Khekhekhe!', chatter: false }));
    if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    bubbleTimerRef.current = setTimeout(() => {
      setBubble(prev => ({ ...prev, visible: false }));
    }, 1400);
  }, []);
  useEffect(() => () => { if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current); }, []);

  // Idle chatter. Every 4-10s (random), if it's been >10s since a purchase
  // AND no bubble is already on screen, Antonia pipes up with a random
  // line. Post-tutorial-5 she has two extra lines that name-drop the
  // player directly.
  useEffect(() => {
    const BASE_LINES = [
      "Oi, ya gotta gimme some of dose coins or what?",
      "Look-see here, I got da nicest stuffs for ya!",
      "Ya brought me some pretty Smug Coins? Gimme gimme gimme!",
      "Hurry up already, will ya?!",
    ];
    const REVEALED_LINES = [
      "Oh, it's you! C'mon, minion, gimme your Coins already!",
      "Khekhe - looks like the investment'll pay off now, eh?",
    ];
    let cancelled = false;
    let idleTimer = null;
    const scheduleNext = () => {
      if (cancelled) return;
      const delay = 4000 + Math.random() * 6000;
      idleTimer = setTimeout(() => {
        if (cancelled) return;
        const quietEnough = Date.now() - lastPurchaseAtRef.current > 10000;
        if (quietEnough) {
          const pool = tutorial5Cleared ? [...BASE_LINES, ...REVEALED_LINES] : BASE_LINES;
          const text = pool[Math.floor(Math.random() * pool.length)];
          setBubble(prev => {
            // Don't stomp on a currently-visible bubble (purchase pop or
            // prior chatter still fading out).
            if (prev.visible) return prev;
            return { visible: true, key: prev.key + 1, text, chatter: true };
          });
          if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
          bubbleTimerRef.current = setTimeout(() => {
            setBubble(prev => ({ ...prev, visible: false }));
          }, 3600);
        }
        scheduleNext();
      }, delay);
    };
    scheduleNext();
    return () => { cancelled = true; if (idleTimer) clearTimeout(idleTimer); };
  }, [tutorial5Cleared]);

  const refreshStructures = async () => {
    try { const sd = await api('/shop/structure-decks'); setStructureCatalog(sd); } catch {}
  };

  const buyStructureDeck = async (structureId, e) => {
    if (e) e.stopPropagation();
    if (buying || !structureCatalog) return;
    if (!((user.sc || 0) >= structureCatalog.price)) { notify('Not enough 🪙!', 'error'); return; }
    const pos = e ? getItemCenter(e) : { cx: window.innerWidth / 2, cy: window.innerHeight / 2 };
    setBuying(true);
    try {
      const data = await api('/shop/buy-structure-deck', { method: 'POST', body: JSON.stringify({ structureId }) });
      setUser(u => ({ ...u, sc: data.sc }));
      triggerPurchaseFanfare(pos);
      await refreshStructures();
    } catch (e2) { notify(e2.message, 'error'); }
    setBuying(false);
  };

  const buyRandomStructureDeck = async (e) => {
    if (buying || !structureCatalog) return;
    if (!((user.sc || 0) >= structureCatalog.randomPrice)) { notify('Not enough 🪙!', 'error'); return; }
    const pos = e ? getItemCenter(e) : { cx: window.innerWidth / 2, cy: window.innerHeight / 2 };
    setBuying(true);
    try {
      const data = await api('/shop/buy-random-structure-deck', { method: 'POST' });
      setUser(u => ({ ...u, sc: data.sc }));
      triggerPurchaseFanfare(pos);
      setRandomReveal({
        imgUrl: (data.coverCard && window.cardImageUrl) ? (window.cardImageUrl(data.coverCard) || '/cardback.png') : '/cardback.png',
        label: data.name,
        subtitle: 'New Structure Deck!',
      });
      await refreshStructures();
    } catch (e2) { notify(e2.message, 'error'); }
    setBuying(false);
  };

  const pickStructureAsDefault = async (sampleDeckId) => {
    try {
      await api('/decks/set-default-sample', { method: 'POST', body: JSON.stringify({ sampleDeckId }) });
      setUser(u => ({ ...u, defaultSampleDeckId: sampleDeckId }));
      await refreshStructures();
      if (window.playSFX) window.playSFX('ui_click');
      notify('Set as default deck!', 'success');
    } catch (e) { notify(e.message, 'error'); }
  };

  // Equip an owned avatar / sleeve / board straight from the shop, so the
  // user doesn't have to detour through the profile screen. Mirrors the
  // quickSave* helpers in ProfileScreen but uses the ShopScreen's user
  // context. Board is stored as a plain id; avatar/sleeve as the asset URL.
  const equipItem = async (type, id) => {
    let avatar = user.avatar;
    let cardback = user.cardback;
    let board = user.board || null;
    if (type === 'avatar') avatar = '/data/shop/avatars/' + id + '.png';
    else if (type === 'sleeve') cardback = '/data/shop/sleeves/' + id + '.png';
    else if (type === 'board') board = id;
    else return;
    try {
      const data = await api('/profile', { method: 'PUT', body: JSON.stringify({
        color: user.color || '#00f0ff', avatar, cardback, bio: user.bio || '', board,
      })});
      setUser(data.user);
      if (window.playSFX) window.playSFX('ui_click');
    } catch (e) { notify(e.message, 'error'); }
  };

  // What is currently equipped? Used to label / highlight the active item.
  const isEquipped = (type, id) => {
    if (type === 'avatar') return user.avatar === '/data/shop/avatars/' + id + '.png';
    if (type === 'sleeve') return user.cardback === '/data/shop/sleeves/' + id + '.png';
    if (type === 'board')  return user.board === id;
    return false;
  };

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
    if (!((user.sc || 0) >= price)) { notify('Not enough 🪙!', 'error'); return; }
    const pos = e ? getItemCenter(e) : { cx: window.innerWidth / 2, cy: window.innerHeight / 2 };
    setBuying(true);
    try {
      const data = await api('/shop/buy', { method: 'POST', body: JSON.stringify({ itemType, itemId }) });
      setOwned(prev => ({ ...prev, [itemType]: [...prev[itemType], itemId] }));
      setUser(u => ({ ...u, sc: data.sc }));
      triggerPurchaseFanfare(pos);
    } catch (e) { notify(e.message, 'error'); }
    setBuying(false);
  };

  const buyRandomSkin = async (e) => {
    if (buying) return;
    const rp = catalog?.randomPrices?.skin;
    if (!((user.sc || 0) >= rp)) { notify('Not enough 🪙!', 'error'); return; }
    const pos = e ? getItemCenter(e) : { cx: window.innerWidth / 2, cy: window.innerHeight / 2 };
    setBuying(true);
    try {
      const data = await api('/shop/buy-random-skin', { method: 'POST' });
      setOwned(prev => ({ ...prev, skin: [...prev.skin, data.skinName] }));
      setUser(u => ({ ...u, sc: data.sc }));
      triggerPurchaseFanfare(pos);
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
    const rp = catalog?.randomPrices?.[itemType];
    if (!((user.sc || 0) >= rp)) { notify('Not enough 🪙!', 'error'); return; }
    const pos = e ? getItemCenter(e) : { cx: window.innerWidth / 2, cy: window.innerHeight / 2 };
    setBuying(true);
    try {
      const data = await api('/shop/buy-random', { method: 'POST', body: JSON.stringify({ itemType }) });
      setOwned(prev => ({ ...prev, [itemType]: [...prev[itemType], data.itemId] }));
      setUser(u => ({ ...u, sc: data.sc }));
      triggerPurchaseFanfare(pos);
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

  // Preise kommen AUSSCHLIESSLICH vom Server (SHOP_PRICES / RANDOM_PRICES
  // in server.js). Bis v1383 standen hier Rueckfallwerte, die bei jeder
  // Preisaenderung mitgezogen werden mussten. Fehlt ein Preis, ist der
  // Knopf gesperrt (`!(sc >= undefined)` ist wahr).
  const prices = catalog.prices || {};
  const randomPrices = catalog.randomPrices || {};
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
            <button className="btn shop-random-btn" disabled={buying || unownedCount === 0 || !((user.sc || 0) >= randomPrices[type])}
              onClick={(e) => buyRandom(type, e)}>
              🎲 Random {type === 'avatar' ? 'Avatar' : 'Sleeve'} — <img src="/data/sc.png" className="shop-sc-icon" /> {randomPrices[type] ?? '?'}
            </button>
            <span className="shop-random-hint">{unownedCount > 0 ? unownedCount + ' left to collect' : 'All collected!'}</span>
          </div>
        )}
        <div className="shop-grid">
          {items.map(item => {
            const isOwned = ownedSet[type].has(item.id);
            const equipped = isOwned && isEquipped(type, item.id);
            const sel = !isOwned && isSelected(type, item.id);
            return (
              <div key={item.id} className={'shop-item' + (type === 'avatar' ? ' shop-avatar-item' : '') + (isOwned ? ' shop-owned' : '') + (equipped ? ' shop-equipped' : '') + (sel ? ' shop-selected' : '')}
                onClick={() => isOwned ? (!equipped && equipItem(type, item.id)) : toggleSelect(type, item.id)}>
                <div className="shop-item-img-wrap">
                  <img src={imgBase + encodeURIComponent(item.file)} draggable={false} />
                  {equipped ? <div className="shop-owned-badge shop-equipped-badge">EQUIPPED</div>
                    : isOwned ? <div className="shop-owned-badge">OWNED</div> : null}
                </div>
                {!isOwned && (
                  <button className="btn shop-buy-btn" disabled={buying || !((user.sc || 0) >= prices[type])}
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
          <button className="btn shop-random-btn" disabled={buying || unownedCount === 0 || !((user.sc || 0) >= randomPrices.skin)}
            onClick={(e) => buyRandomSkin(e)}>
            🎲 Random Skin — <img src="/data/sc.png" className="shop-sc-icon" /> {randomPrices.skin ?? '?'}
          </button>
          <span className="shop-random-hint">{unownedCount > 0 ? unownedCount + ' skin' + (unownedCount !== 1 ? 's' : '') + ' left to collect' : 'All collected!'}</span>
        </div>
        <div className="shop-grid shop-grid-skins">
          {filteredSkins.map(skin => {
            const isOwned = ownedSet.skin.has(skin.id);
            const sel = isSelected('skin', skin.id);
            const showHero = skinShowHero.has(skin.id);
            const imgSrc = showHero
              ? (cardImageUrl(skin.heroName) || '/cardback.png')
              : '/cards/skins/' + encodeURIComponent(skin.skinName) + '.png';
            return (
              <div key={skin.id} className={'shop-item shop-skin-item' + (isOwned ? ' shop-owned' : ' shop-unowned-skin') + (sel ? ' shop-selected' : '')}
                onMouseEnter={() => setHoverSkin({ skinName: skin.skinName, heroName: skin.heroName })}
                onMouseLeave={() => setHoverSkin(null)}
                onClick={() => toggleSelect('skin', skin.id)}>
                <div className="shop-item-img-wrap">
                  <img src={imgSrc} draggable={false}
                    className={!isOwned ? 'shop-skin-locked' : ''} />
                  {isOwned && <div className="shop-owned-badge">OWNED</div>}
                  {!isOwned && (
                    <div className="shop-lock-overlay">
                      <span className="shop-lock-badge" aria-label="Locked">🔒</span>
                    </div>
                  )}
                </div>
                {/* Flip between the skin art and the original Hero art so the
                    player can tell which Hero a skin belongs to (names removed
                    because most skin names overflowed the tile). */}
                <button className="btn shop-skin-toggle"
                  onClick={(e) => { e.stopPropagation(); toggleSkinHero(skin.id); if (window.playSFX) window.playSFX('ui_click'); }}>
                  {showHero ? 'Show Skin' : 'Show Hero'}
                </button>
                {!isOwned && (
                  <button className="btn shop-buy-btn" disabled={buying || !((user.sc || 0) >= prices.skin)}
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

  const renderStructureDecks = () => {
    const decks = structureCatalog?.decks || [];
    const price = structureCatalog?.price;              // nur Serverwerte (s. oben)
    const randomPrice = structureCatalog?.randomPrice;
    const unownedCount = decks.filter(d => !d.owned).length;
    const allOwned = decks.length > 0 && unownedCount === 0;
    return (
      <>
        {/* Random Structure Deck Button — matches the Skin / Avatar / Sleeve
            random-button layout so the shop feels consistent. */}
        <div className="shop-random-wrap">
          <button className="btn shop-random-btn" disabled={buying || allOwned || !((user.sc || 0) >= randomPrice)}
            onClick={buyRandomStructureDeck}>
            🎲 Random Structure Deck — <img src="/data/sc.png" className="shop-sc-icon" /> {randomPrice ?? '?'}
          </button>
          <span className="shop-random-hint">{unownedCount > 0 ? unownedCount + ' left to collect' : 'All collected!'}</span>
        </div>
        <div className="shop-grid">
          {decks.map(d => {
            const coverUrl = (d.coverCard && window.cardImageUrl) ? (window.cardImageUrl(d.coverCard) || '/cardback.png') : '/cardback.png';
            const isCurrentDefault = !!d.isDefault;
            const canAfford = (user.sc || 0) >= price;
            // Golden border always; green overlay on top if it's the active
            // default deck; semi-transparent if still locked.
            // Owned & not-yet-default → gold frame (handled by .shop-owned).
            // Owned & currently default → green frame (inline below).
            // Not owned → default shop-item (dim) frame so it clearly reads
            // as unpurchased, mirroring avatar/sleeve/board tiles.
            const frameStyle = {
              cursor: 'default',
              position: 'relative',
            };
            if (isCurrentDefault) {
              frameStyle.borderColor = '#33ff88';
              frameStyle.boxShadow = '0 0 16px rgba(51,255,136,.7), 0 0 28px rgba(51,255,136,.35)';
            }
            // shop-owned class adds the golden pulse + particle animations.
            // When the deck is the active default, the green border should
            // dominate, so we skip shop-owned and use a plain inline glow.
            const classes = 'shop-item structure-deck-item'
              + (d.owned && !isCurrentDefault ? ' shop-owned' : '')
              + (isCurrentDefault ? ' structure-deck-default' : '');
            return (
              <div key={d.structureId} className={classes}
                style={frameStyle}
                onMouseEnter={() => d.coverCard && setHoverDeckCard(d.coverCard)}
                onMouseLeave={() => setHoverDeckCard(null)}>
                <img src={coverUrl} alt={d.name} draggable={false}
                  style={{ width: '100%', height: 148, objectFit: 'cover', objectPosition: 'center top', borderRadius: 4, opacity: d.owned ? 1 : 0.5 }} />
                <div style={{ fontSize: 11, textAlign: 'center', padding: '6px 4px 2px', color: isCurrentDefault ? '#33ff88' : (d.owned ? '#ffd700' : 'var(--text2)'), fontWeight: 600 }}>
                  {d.name}
                </div>
                {d.owned ? (
                  isCurrentDefault ? (
                    <div className="shop-price" style={{ borderColor: '#33ff88', color: '#33ff88' }}>DEFAULT</div>
                  ) : (
                    <button className="btn" onClick={(e) => { e.stopPropagation(); pickStructureAsDefault(d.id); }}
                      style={{ padding: '4px 10px', fontSize: 11, marginTop: 4, borderColor: '#ffd700', color: '#ffd700' }}>
                      SELECT
                    </button>
                  )
                ) : (
                  <button className="btn" disabled={buying || !canAfford}
                    onClick={(e) => buyStructureDeck(d.structureId, e)}
                    style={{ padding: '4px 10px', fontSize: 11, marginTop: 4, borderColor: '#ffd700', color: canAfford ? '#ffd700' : 'var(--text2)' }}>
                    🔒 {price ?? '?'} <CoinIcon size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {decks.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text2)', padding: 40, fontSize: 13 }}>
            No Structure Decks available yet.
          </div>
        )}
      </>
    );
  };

  const tabs = [
    { id: 'skins', label: '🎨 Skins', count: (catalog.skins || []).length },
    { id: 'avatars', label: '👤 Avatars', count: (catalog.avatars || []).length },
    { id: 'sleeves', label: '🃏 Sleeves', count: (catalog.sleeves || []).length },
    { id: 'boards', label: '🎮 Boards', count: (catalog.boards || []).length },
    { id: 'structures', label: '📜 Structure Decks', count: (structureCatalog?.decks || []).length },
  ];

  return (
    <div className="screen-full shop-screen" style={{ background: 'linear-gradient(180deg, #0a0a12 0%, #12101f 40%, #0a0a12 100%)' }}>
      {/* Shopkeep — pinned to the top-left corner at the same vertical
          level as the "Random X" buttons inside each sub-tab. The sprite
          bobs via a slow CSS float animation (see .shop-antonia-float);
          the name label below stays stationary. Her displayed name gates
          on tutorial 5 completion: pre-reveal she's "Raccoon Shopkeep",
          post-reveal she's "Antonia" (same beat as the tutorial 5 scene
          where she introduces herself). Pointer-events disabled so she
          never intercepts clicks. */}
      <div className="shop-antonia" aria-hidden="true">
        <div className="shop-antonia-float">
          {bubble.visible && (
            <div className={'shop-antonia-bubble' + (bubble.chatter ? ' shop-antonia-bubble-chatter' : '')} key={bubble.key}>{bubble.text}</div>
          )}
          <img src="/Antonia.png" className="shop-antonia-img" alt="" draggable={false} />
        </div>
        <span className="shop-antonia-name">
          {tutorial5Cleared ? 'Antonia' : 'Raccoon Shopkeep'}
        </span>
      </div>
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
        <button className="btn" onClick={() => setScreen('menu')}>← BACK</button>
        <h2 className="orbit-font" style={{ fontSize: 22, fontWeight: 800, color: 'var(--player-color)' }}>SHOP</h2>
        <div style={{ flex: 1 }} />
        <div className="badge" style={{ background: 'rgba(255,215,0,.12)', color: '#ffd700', display: 'flex', alignItems: 'center', gap: 6, fontSize: 18, padding: '6px 14px' }}>
          <img src="/data/sc.png" style={{ width: 22, height: 22, imageRendering: 'pixelated' }} /> {user.sc || 0}
        </div>
        <VolumeControl />
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
        {tab === 'structures' && renderStructureDecks()}
      </div>
      {/* Shared hover-preview tooltip for shop items that have an associated
          card (structure deck covers, skins). Uses the same
          `.tooltip.card-tooltip` chrome + dimensions as the in-game / deck
          builder hover preview. Skin previews force the skin asset while
          still listing the underlying hero's stats/effect. */}
      {(() => {
        if (!CardTooltipContent) return null;
        let card = null, imageUrl = null;
        if (hoverSkin && CARDS_BY_NAME?.[hoverSkin.heroName]) {
          // Override displayName so the big title shows the skin name
          // rather than the hero's canonical name.
          card = { ...CARDS_BY_NAME[hoverSkin.heroName], displayName: hoverSkin.skinName };
          imageUrl = '/cards/skins/' + encodeURIComponent(hoverSkin.skinName) + '.png';
        } else if (hoverDeckCard && CARDS_BY_NAME?.[hoverDeckCard]) {
          card = CARDS_BY_NAME[hoverDeckCard];
        }
        if (!card) return null;
        return (
          <div className="tooltip card-tooltip" style={{
            right: 0, top: 41, width: 400,
            height: 'calc(100vh - 41px)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            zIndex: 80000,
          }}>
            <CardTooltipContent card={card} imageUrl={imageUrl} />
          </div>
        );
      })()}
    </div>
  );
}


// ═══════════════════════════════════════════
//  DECK BUILDER
// ═══════════════════════════════════════════
//  RULES SCREEN
// ═══════════════════════════════════════════

const RULES_SECTIONS = [
  { id: 'overview',      label: 'How to Play' },
  { id: 'heroes',        label: 'Heroes' },
  { id: 'abilities',     label: 'Abilities' },
  { id: 'attacks-spells', label: 'Attacks, Spells & Creatures' },
  { id: 'spell-schools', label: 'Spell Schools' },
  { id: 'artifacts',     label: 'Artifacts' },
  { id: 'potions',       label: 'Potions' },
  { id: 'ascended',      label: 'Ascended Heroes' },
  { id: 'actions',       label: 'Actions' },
  { id: 'board',         label: 'The Game Board' },
  { id: 'first-turn',    label: 'First Turn Restrictions' },
  { id: 'turn',          label: 'Course of a Turn' },
  { id: 'status',        label: 'Status Effects' },
  { id: 'deckbuilding',  label: 'Deck Construction' },
];

function RulesScreen({ onBack }) {
  const { setScreen } = useContext(AppContext);
  // Guests can't switch screens (the app pins them to the VS-CPU screen), so
  // callers can pass onBack to dismiss an in-place Rules overlay instead.
  const goBack = onBack || (() => setScreen('menu'));
  const contentRef = useRef(null);
  const [activeSection, setActiveSection] = useState('overview');

  const scrollTo = (id) => {
    const el = document.getElementById('rules-' + id);
    if (el && contentRef.current) {
      contentRef.current.scrollTo({ top: el.offsetTop - contentRef.current.offsetTop - 16, behavior: 'smooth' });
    }
  };

  // Track active section on scroll
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    const onScroll = () => {
      const scrollTop = container.scrollTop + container.offsetTop + 40;
      let current = RULES_SECTIONS[0].id;
      for (const s of RULES_SECTIONS) {
        const el = document.getElementById('rules-' + s.id);
        if (el && el.offsetTop <= scrollTop) current = s.id;
      }
      setActiveSection(current);
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, []);

  // Escape → back to menu
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); goBack(); }
    };
    window.addEventListener('keydown', handleEsc, true);
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, []);

  const Img = ({ src, alt, className, style }) => (
    <img src={'/rules/' + src} alt={alt || ''} className={'rules-img ' + (className || '')} style={style} draggable={false} />
  );

  const SectionTitle = ({ id, children }) => (
    <h2 id={'rules-' + id} className="rules-section-title orbit-font">{children}</h2>
  );

  const SubTitle = ({ children }) => (
    <h3 className="rules-sub-title orbit-font">{children}</h3>
  );

  const IconRow = ({ icons }) => (
    <div className="rules-icon-row">
      {icons.map(ic => (
        <div key={ic.src} className="rules-icon-item">
          <img src={'/rules/' + ic.src} alt={ic.label} className="rules-icon-img" draggable={false} />
          <span className="rules-icon-label">{ic.label}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="screen-full" style={{ background: 'linear-gradient(180deg, #0a0a12 0%, #10101d 40%, #0a0a12 100%)' }}>
      <div className="top-bar">
        <button className="btn" onClick={goBack}>← BACK</button>
        <h2 className="orbit-font" style={{ fontSize: 22, fontWeight: 800, color: 'var(--player-color)' }}>RULES</h2>
        <div style={{ flex: 1 }} />
        <VolumeControl />
      </div>

      <div className="rules-layout animate-in">
        {/* ═══ SIDEBAR NAV ═══ */}
        <nav className="rules-sidebar">
          {RULES_SECTIONS.map(s => (
            <button
              key={s.id}
              className={'rules-nav-item' + (activeSection === s.id ? ' active' : '')}
              onClick={() => scrollTo(s.id)}
            >
              {s.label}
            </button>
          ))}
        </nav>

        {/* ═══ CONTENT ═══ */}
        <div className="rules-content" ref={contentRef}>

          {/* ── HOW TO PLAY ── */}
          <SectionTitle id="overview">How to Play</SectionTitle>
          <div className="rules-card-row">
            <Img src="monia.png" alt="Monia" className="rules-card-img rules-card-img-sm" />
            <div className="rules-text-block" style={{ flex: 1 }}>
              <p>In Pixel Parties, players assemble <strong>Parties of three Heroes</strong> each and try to make them the greatest Heroes in the world — by beating up the opponent's Party and asserting dominance!</p>
              <p><strong>Whoever defeats all enemy Heroes first wins!</strong></p>
              <p>You'll build up your Heroes over the course of the game by giving them Abilities, hurl Attacks and Spells to take out enemy Heroes one by one, and summon Creatures to do the dirty work. You'll also get to utilize a variety of helpful Artifacts and volatile Potions to support your strategy and be the last Party standing.</p>
              <p className="rules-flavor" style={{ color: 'var(--accent)' }}>Do you have what it takes to form the strongest Party ever?!</p>
            </div>
          </div>

          <div className="rules-divider" />

          {/* ── HEROES ── */}
          <SectionTitle id="heroes"><span style={{ color: '#aa44ff' }}>Heroes</span></SectionTitle>
          <div className="rules-card-row">
            <Img src="hero.png" alt="Hero card example" className="rules-card-img" />
            <div className="rules-text-block">
              <p>Heroes are the backbone of your strategy! You start the game with three different ones and have to defeat all enemy Heroes to win.</p>
              <p>Your deck may contain Hero cards, but you can never play new Heroes from your hand to bolster your party!</p>
              <p>Each Hero brings a unique effect, two Starting Abilities, and its own stats to the table, so there's a lot to consider when choosing your perfect Party!</p>
              <h3 className="rules-sub-title orbit-font" style={{ color: '#4488ff' }}>Starting Abilities</h3>
              <p>The two Ability cards specified here are attached to that Hero before the start of the game. They do not come from or count as part of your main deck.</p>
              <h3 className="rules-sub-title orbit-font" style={{ color: '#ff3366' }}>HP</h3>
              <p>If a Hero's HP drops to 0, it is defeated and grayed out on the board. Its Abilities stay attached to it, and there are ways to revive it, so it is not removed from the board.</p>
              <h3 className="rules-sub-title orbit-font" style={{ color: '#c0c0c0' }}>Attack</h3>
              <p>A Hero's Attack stat is used to determine the damage it deals with Attack cards. Heroes do <strong>NOT</strong> have the inherent ability to attack targets — an Attack card is always necessary!</p>
            </div>
          </div>

          <div className="rules-divider" />

          {/* ── ABILITIES ── */}
          <SectionTitle id="abilities"><span style={{ color: '#4488ff' }}>Abilities</span></SectionTitle>
          <div className="rules-card-row">
            <Img src="ability.png" alt="Ability card example" className="rules-card-img" />
            <div className="rules-text-block">
              <p>Abilities are attached to Heroes to empower them. They can grant Heroes new actions, provide passive bonuses, or give you powerful effects to activate once per turn.</p>
              <p>Each Hero has <strong>three Ability Zones</strong> and can thus have up to three different Abilities attached to it. Additionally, copies of the same Ability on the same Hero are stacked on top of each other in the same Ability Zone, leveling that Ability up. All in all, a Hero can have up to <strong>9 Ability cards</strong> attached to it!</p>
              <p>A player can only attach <strong>one Ability to each of their Heroes every turn</strong>, and Abilities can be used the turn they are attached.</p>
              <p>When a Hero is defeated, its Abilities stay attached to it. They remain on the board, but are <strong>negated</strong> and cannot be activated in any way until that Hero is revived.</p>
              <h3 className="rules-sub-title orbit-font" style={{ color: '#4488ff' }}>Effects per Level</h3>
              <p>What effect an Ability provides depends on its level, meaning the number of copies attached to that Hero. At one copy (level 1), the top effect applies. At two copies (level 2), it's the middle effect, and at three copies (level 3), it's the bottom.</p>
              <p>If an Ability has a once per turn effect that you can choose to activate during your turn, you can only activate that effect <strong>once during that turn</strong>, even if multiple Heroes have it!</p>
              <p className="rules-callout">You can not choose to use an Ability at a lower level than it has!</p>
            </div>
          </div>

          <div className="rules-divider" />

          {/* ── ATTACKS & SPELLS ── */}
          <SectionTitle id="attacks-spells"><span style={{ color: '#ff3366' }}>Attacks, Spells and Creatures</span></SectionTitle>
          <div className="rules-card-row">
            <Img src="spell.png" alt="Spell card example" className="rules-card-img" />
            <div className="rules-text-block">
              <p>Attacks, Spells and Creatures are the main way you will advance the board state. Dealing damage, applying negative status effects, summoning Creatures, but also healing HP, removing status effects or drawing cards — anything can be done by the right Attacks, Spells and Creatures!</p>
              <p>You can only play an Attack, Spell or Creature as long as you control a Hero that is able to perform it. Attacks, Spells and Creatures have a <strong>Level</strong> and an <strong>Ability</strong> associated with them. This is called its Spell School.</p>
              <p>For a Hero to be able to use an Attack/Spell/Creature, it must have the associated Ability at the card's Level or higher.</p>
              <p>When played, an Attack, Spell or Creature's effect is resolved immediately, unless stated otherwise.</p>
            </div>
          </div>

          <h3 className="rules-sub-title orbit-font" style={{ color: '#ff3366' }}>Sub-Types</h3>
          <p style={{ marginBottom: 12, fontSize: 17, lineHeight: 1.7 }}>There are 5 total Sub-Types of Attacks, Spells and Creatures. If a card has no icon at the bottom left, it is a "Normal" type — resolved when played and sent to the discard pile.</p>

          <div className="rules-subtype-grid">
            <div className="rules-subtype-entry">
              <div className="rules-school-header" style={{ color: '#ff3366' }}><img src="/rules/icon-attach.png" className="rules-school-icon" /> <span>Attachments</span></div>
              <p>Attachments are not sent to the discard pile after use, instead getting attached to a target. Unless stated otherwise, an Attachment can be attached to any Hero, but some specify they can only go to one of your Heroes, an opponent's Hero, or just the user itself. When a Hero is defeated, any Attachments on it are sent to the discard pile.</p>
            </div>
            <div className="rules-subtype-entry">
              <div className="rules-school-header" style={{ color: '#ff3366' }}><img src="/rules/icon-instant.png" className="rules-school-icon" /> <span>Reactions</span></div>
              <p>Like Normal cards, Reactions go to the discard pile after resolving. The difference is that they can only be used in reaction to specific triggers. Reactions will always specify when they can be used — they are the <strong>only sub-type that can be played from your hand during an opponent's turn</strong>.</p>
            </div>
            <div className="rules-subtype-entry">
              <div className="rules-school-header" style={{ color: '#ff3366' }}><img src="/rules/icon-trap.png" className="rules-school-icon" /> <span>Surprises</span></div>
              <p>Surprises are prepared face-down on your side of the board during your turn and then activated once a specific condition is met by flipping them face-up.</p>
              <p>To prepare a Surprise, place it face-down into a Hero's Surprise Zone during your turn. Once prepared, you can activate it at any time — during either player's turn — as long as its condition is met and the preparing Hero is able to activate it.</p>
              <p>To activate a Surprise, the preparing Hero must have the Abilities necessary to activate it and cannot be defeated or otherwise unable to perform an Action (for example by being Stunned). On the other hand, you <strong>can</strong> prepare Surprises with a Hero, even if it does not have the Abilities necessary to activate them.</p>
              <p>After activation, a Surprise resolves and is then sent to the discard pile.</p>
            </div>
            <div className="rules-subtype-entry">
              <div className="rules-school-header" style={{ color: '#ff3366' }}><img src="/rules/icon-area.png" className="rules-school-icon" /> <span>Areas</span></div>
              <p>Areas provide global effects that either affect both players or that both players can activate. Each player has one Zone for an Area. The Area Zone is not directly associated with a Hero — you may play an Area with any of your Heroes (but you still need at least one Hero able to use it).</p>
              <p>Areas remain in play until they are removed by an effect. You cannot play an Area while you already control an Area.</p>
            </div>
          </div>

          <div className="rules-divider" />

          {/* ── SPELL SCHOOLS ── */}
          <SectionTitle id="spell-schools">Types of Attacks/Spells</SectionTitle>

          <div className="rules-schools-grid">
            <div className="rules-school-entry">
              <div className="rules-school-header" style={{ color: '#c0c0c0' }}><img src="/rules/icon-sword.png" className="rules-school-icon" /> <span>Attacks (Fighting)</span></div>
              <p>Attacks are the only type that isn't a Spell School. They specialize in dealing scaling damage, being the only card type that uses a Hero's Attack stat to determine its damage. As such, Attack-based strategies will excel in picking off individual targets.</p>
              <p>Attacks can also have a wide variety of secondary utility effects. The distinction between Attacks, Spells and Creatures is important, because many effects interact with specifically one or the other.</p>
            </div>
            <div className="rules-school-entry">
              <div className="rules-school-header" style={{ color: '#ff3366' }}><img src="/rules/icon-destruction.png" className="rules-school-icon" /> <span>Destruction Spells</span></div>
              <p>Destruction Spells deal a ton of damage. They often have downsides, such as dealing recoil damage to your own Heroes, giving your opponent ways to counteract the damage, or having conditions a target must fulfill before it takes damage. Where Attacks excel at quickly taking out individual targets, Destruction Spells have by far the best <strong>spread damage</strong> options in the game.</p>
            </div>
            <div className="rules-school-entry">
              <div className="rules-school-header" style={{ color: '#aa44ff' }}><img src="/rules/icon-decay.png" className="rules-school-icon" /> <span>Decay Spells</span></div>
              <p>Decay Spells make life harder for your opponent. Denying resources, applying debuffs, or inflicting status effects. Decks revolving around them will often rely on Poison and Burn to slowly melt away the opponent's HP over time. Decay Magic also has the best <strong>negation Spells</strong> in the game. It's a slower, more control-focused playstyle.</p>
            </div>
            <div className="rules-school-entry">
              <div className="rules-school-header" style={{ color: '#ffdd44' }}><img src="/rules/icon-support.png" className="rules-school-icon" /> <span>Support Spells</span></div>
              <p>Support Spells excel in healing and buffing your own Heroes. They keep your Heroes alive, make them stronger, generate resources, and may hinder your opponent. Support Spells are particularly good at doing a lot of things in one turn, facilitating a more <strong>combo-oriented</strong> playstyle.</p>
            </div>
            <div className="rules-school-entry">
              <div className="rules-school-header" style={{ color: '#4488ff' }}><img src="/rules/icon-arts.png" className="rules-school-icon" /> <span>Magic Arts Spells</span></div>
              <p>Magic Arts Spells focus on "changing the rules." Applying buffs or debuffs that affect players themselves, searching cards from the deck, generating resources, extending turns, and situational negation. Unlike other Spell Schools, Magic Arts is not meant to be played by itself — it's an <strong>auxiliary</strong> Spell School.</p>
            </div>
            <div className="rules-school-entry rules-school-entry-wide">
              <div className="rules-school-header" style={{ color: '#44cc44' }}><img src="/rules/icon-summoning.png" className="rules-school-icon" /> <span>Summoning Spells and Creatures</span></div>
              <div className="rules-card-row" style={{ marginTop: 10 }}>
                <Img src="creature.png" alt="Creature card example" className="rules-card-img rules-card-img-sm" />
                <div>
                  <p>Summoning Spells are all about bringing out, using, and protecting Creatures, a separate card type aside from Attacks and Spells.</p>
                  <p>Creatures, once summoned, go into a Support Zone of the Hero that summoned them and remain there until they are defeated. A Creature is defeated when its HP is reduced to 0. Even if a Hero is defeated, its Creatures survive by themselves! Creatures also don't care if their corresponding Hero is Frozen, Stunned or otherwise incapacitated.</p>
                  <p>Creatures have effects that can either be active or passive. Passive effects are always in effect. Active effects can be triggered manually on your turn. They usually start with "Once per turn" (or "Up to X times per turn").</p>
                  <p className="rules-callout">A Creature cannot activate its active effect the turn it's summoned.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rules-divider" />

          {/* ── ARTIFACTS ── */}
          <SectionTitle id="artifacts"><span style={{ color: '#ffd700' }}>Artifacts</span></SectionTitle>
          <div className="rules-card-row">
            <Img src="artifact.png" alt="Artifact card example" className="rules-card-img" />
            <div className="rules-text-block">
              <p>Artifacts, unlike Abilities or Attacks/Spells/Creatures, do not necessarily revolve around a Hero and don't need a Hero to be played. These are your general utility cards that extend your options each turn, but can also be very specific and require certain strategies to be used.</p>
              <p>They can have the same sub-types as Attacks, Spells and Creatures (except that Attachment Artifacts are called <strong>Equipments</strong> and you equip Artifacts rather than attach them), and they have a <strong>Cost</strong>.</p>
              <p>At the start of each turn, the turn player generates <strong>Gold</strong>. This Gold is used to pay for the use of Artifacts, meaning you can't play an infinite amount of them.</p>
            </div>
          </div>

          <div className="rules-divider" />

          {/* ── POTIONS ── */}
          <SectionTitle id="potions"><span style={{ color: '#a0724a' }}>Potions</span></SectionTitle>
          <div className="rules-card-row">
            <Img src="potion.png" alt="Potion card example" className="rules-card-img" />
            <div className="rules-text-block">
              <p>Potions function a lot like Artifacts, except that they have <strong>no Gold Cost</strong>. You just play them from your hand to get their effect!</p>
              <p>However, they have two key differences. First, they are <strong>deleted</strong> (removed from the game) after resolving instead of going to the discard pile. Thus, they can never be reused.</p>
              <p>Second, they start the game in a separate deck, the dedicated <strong>Potion Deck</strong>, and you can only draw them through card effects. This makes them a lot harder to access than other cards, but they are also on average a lot more powerful!</p>
            </div>
          </div>

          <div className="rules-divider" />

          {/* ── ASCENDED HEROES ── */}
          <SectionTitle id="ascended"><span style={{ color: '#aa44ff' }}>Ascended Heroes</span></SectionTitle>
          <div className="rules-card-row">
            <Img src="ascended.png" alt="Ascended Hero card example" className="rules-card-img" />
            <div className="rules-text-block">
              <p>Ascended Heroes are special, more powerful versions of Heroes. You play them in your deck and place them on top of a Hero to Ascend it once a certain condition has been fulfilled.</p>
              <p className="rules-callout">Ascending a Hero immediately ends your turn!</p>
              <p>When a Hero Ascends, it gains new stats, but keeps any damage it already had as well as status effects and any other effects that affected it.</p>
              <h3 className="rules-sub-title orbit-font" style={{ color: '#aa44ff' }}>Ascension Bonus</h3>
              <p>When a Hero Ascends, its Ascension Bonus is applied. If the bonus specifies Abilities, you may attach them from your hand, deck, or discard pile to the Ascended Hero immediately. You may choose to attach fewer copies than specified. Other Ascension Bonuses apply a different effect instead.</p>
            </div>
          </div>

          <div className="rules-divider" />

          {/* ── ACTIONS ── */}
          <SectionTitle id="actions"><span style={{ color: '#ff3366' }}>Actions</span></SectionTitle>
          <div className="rules-text-block">
            <p>Besides Gold, which you passively generate every turn and spend on Artifacts, <strong>Actions</strong> are the other important resource in Pixel Parties. You get a <strong>single Action</strong> every turn, and Attacks, Spells and Creatures cost an Action to use.</p>
            <p style={{ color: '#ff3366', fontWeight: 700, fontStyle: 'italic' }}>Wait, so you can only use a single Attack/Spell/Creature per turn to advance the game?</p>
            <p>Not exactly. <strong>Reactions</strong> and <strong>Surprises</strong> do not cost Actions to use. Additionally, there are Attacks, Spells and Creatures that can count as <strong>additional Actions</strong>, either inherently or if you fulfill specific conditions. Additional Actions do not consume your Action per turn.</p>
            <p>On the other hand, there are also effects on Abilities, Artifacts, and other cards that can cost an Action to activate. If you choose to spend your Action on such an effect, that means you cannot use an Attack/Spell/Creature that turn, unless it's an additional Action, a Reaction, or a Surprise.</p>
            <p>When a Creature is "placed" into a Support Zone, that always means that it is summoned without costing an Action and without requiring a Hero to actually be able to summon it.</p>
          </div>

          <div className="rules-divider" />

          {/* ── THE GAME BOARD ── */}
          <SectionTitle id="board">The Game Board</SectionTitle>
          <div className="rules-text-block">
            <p>Pixel Parties has a very rigid game board. Both players have 3 Heroes, which each have 3 Zones for Abilities (Ability Zones) and 3 Zones for Equipments, Attachments and Creatures (Support Zones). A Hero can only summon Creatures into its own Support Zones, so the amount of Creatures a Hero can control at a time is limited to 3!</p>
          </div>
          <Img src="board.png" alt="The game board" className="rules-board-img" />
          <div className="rules-board-legend">
            <div className="rules-legend-item"><span className="rules-legend-num">1</span> <strong>Hero Zones.</strong> Each player has 3 and starts with a Hero in each. Defeated Heroes remain on the board grayed-out and can be revived later.</div>
            <div className="rules-legend-item"><span className="rules-legend-num">2</span> <strong>Ability Zones.</strong> Each Hero has 3 — so Heroes can have up to 3 different Abilities, each levelable up to 3.</div>
            <div className="rules-legend-item"><span className="rules-legend-num">3</span> <strong>Support Zones.</strong> Equipment/Attachment cards and Creatures go here. If all Support Zones of a Hero are full, no more Equipments, Attachments, or Creatures can be added to that Hero.</div>
            <div className="rules-legend-item"><span className="rules-legend-num">4</span> <strong>Surprise Zones.</strong> Each Hero has only 1 — it can only have 1 Surprise prepared at a time. Surprises cannot be moved between Heroes once placed. You must either activate it or remove it with an effect to free the Zone.</div>
            <div className="rules-legend-item"><span className="rules-legend-num">5</span> <strong>Deck Zone.</strong> Your deck goes here.</div>
            <div className="rules-legend-item"><span className="rules-legend-num">6</span> <strong>Potion Deck Zone.</strong> Your Potion Deck goes here (if you have one).</div>
            <div className="rules-legend-item"><span className="rules-legend-num">7</span> <strong>Discard Pile.</strong> Your discard pile.</div>
            <div className="rules-legend-item"><span className="rules-legend-num">8</span> <strong>Delete Zone.</strong> The zone for your deleted (expelled/removed) cards.</div>
            <div className="rules-legend-item"><span className="rules-legend-num">9</span> <strong>Area Zones.</strong> Zones for your and your opponent's Areas. Each player can only use 1 of those 2 zones.</div>
          </div>

          <div className="rules-divider" />

          {/* ── FIRST TURN RESTRICTIONS ── */}
          <SectionTitle id="first-turn">First Turn Restrictions</SectionTitle>
          <div className="rules-text-block">
            <p>Player 1 has several restrictions on their first turn. They cannot:</p>
            <div className="rules-restriction-list">
              <div className="rules-restriction-item">Deal damage to enemy targets</div>
              <div className="rules-restriction-item">Inflict status effects to enemy targets</div>
              <div className="rules-restriction-item">Activate effects that would defeat enemy targets</div>
              <div className="rules-restriction-item">Take control of enemy targets</div>
              <div className="rules-restriction-item">Force their opponent to discard, delete, or shuffle away cards from their hand</div>
              <div className="rules-restriction-item">Look at their opponent's hand</div>
              <div className="rules-restriction-item">Send cards from the opponent's deck to the discard pile or delete them</div>
              <div className="rules-restriction-item">Equip or attach cards to an opponent's Hero</div>
              <div className="rules-restriction-item">Give your opponent cards to their hand, deck or any other area</div>
              <div className="rules-restriction-item">Choose any target your opponent controls with any card or effect</div>
            </div>
          </div>

          <div className="rules-divider" />

          {/* ── COURSE OF A TURN ── */}
          <SectionTitle id="turn">The Course of a Turn</SectionTitle>
          <div className="rules-text-block">
            <p>A player's turn is divided into the following Phases:</p>
          </div>

          <div className="rules-phases">
            <div className="rules-phase">
              <div className="rules-phase-header">
                <span className="rules-phase-num">1</span>
                <span className="rules-phase-name orbit-font">Start Phase</span>
              </div>
              <p>The turn begins. Effects that last "until the beginning of the turn" end and effects that trigger "at the beginning of the turn" activate.</p>
            </div>

            <div className="rules-phase">
              <div className="rules-phase-header">
                <span className="rules-phase-num">2</span>
                <span className="rules-phase-name orbit-font">Resource Phase</span>
              </div>
              <p>The turn player draws <strong>1 card</strong> and gains <strong>4 Gold</strong>. Some effects will increase this Gold gain.</p>
            </div>

            <div className="rules-phase">
              <div className="rules-phase-header">
                <span className="rules-phase-num">3</span>
                <span className="rules-phase-name orbit-font">Main Phase 1</span>
              </div>
              <p>The main part of the turn. The turn player may, in any order:</p>
              <div className="rules-restriction-list">
                <div className="rules-restriction-item rules-phase-action">Attach up to 1 Ability from their hand to each of their Heroes.</div>
                <div className="rules-restriction-item rules-phase-action">Play any number of Artifacts from their hand, as long as they can pay their Costs.</div>
                <div className="rules-restriction-item rules-phase-action">Play any number of Potions from their hand.</div>
                <div className="rules-restriction-item rules-phase-action">Activate the active effects of any number of cards they control (Heroes, Abilities, Creatures, Equipments, Attachments, Areas).</div>
                <div className="rules-restriction-item rules-phase-action">Play Attacks/Spells/Creatures that "count as an additional Action", including Reactions that are not limited to react to specific actions.</div>
                <div className="rules-restriction-item rules-phase-action">Set as many Surprises as they have free Zones to do so.</div>
              </div>
            </div>

            <div className="rules-phase">
              <div className="rules-phase-header">
                <span className="rules-phase-num">4</span>
                <span className="rules-phase-name orbit-font">Action Phase</span>
              </div>
              <p>The turn player may perform a <strong>single Action</strong>. This is usually done by playing an Attack, Spell, or Creature, but there are also effects that require an Action as a cost. After performing a single Action, the Action Phase immediately ends.</p>
            </div>

            <div className="rules-phase">
              <div className="rules-phase-header">
                <span className="rules-phase-num">5</span>
                <span className="rules-phase-name orbit-font">Main Phase 2</span>
              </div>
              <p>You may do the same things as in Main Phase 1. If you already attached an Ability to a Hero during Main Phase 1, you cannot attach another one to the same Hero during Main Phase 2.</p>
              <p className="rules-callout" style={{ marginTop: 8 }}>You can only enter Main Phase 2 by performing an Action.</p>
            </div>

            <div className="rules-phase">
              <div className="rules-phase-header">
                <span className="rules-phase-num">6</span>
                <span className="rules-phase-name orbit-font">End Phase</span>
              </div>
              <p>The turn ends. Effects that last "until the end of the turn" end and effects that trigger "at the end of the turn" trigger.</p>
              <p>At the very end of the End Phase, if the turn player has more than <strong>7 cards</strong> in their hand, they must discard cards from their hand until they have 7 cards left.</p>
            </div>
          </div>

          <div className="rules-divider" />

          {/* ── STATUS EFFECTS ── */}
          <SectionTitle id="status">Status Effects</SectionTitle>
          <div className="rules-text-block">
            <p>A target can be affected by any number of status effects at a time. Some cards inflict unique special conditions that "count as status effects", while others inflict the following "standard" status effects:</p>
          </div>

          <div className="rules-status-grid">
            <div className="rules-status-entry rules-status-stunned">
              <div className="rules-status-name">Stunned</div>
              <p>The target cannot perform Actions. Its effects and Abilities (if it is a Hero) are negated.</p>
            </div>
            <div className="rules-status-entry rules-status-frozen">
              <div className="rules-status-name">Frozen</div>
              <p>The target cannot perform Actions. Its effects and Abilities (if it is a Hero) are negated. Additionally, it cannot be equipped with Artifacts.</p>
            </div>
            <div className="rules-status-entry rules-status-blinded">
              <div className="rules-status-name">Blinded</div>
              <p>The target cannot choose anything the opponent controls as a target for Attacks, Spells, or effects.</p>
            </div>
            <div className="rules-status-entry rules-status-poisoned">
              <div className="rules-status-name">Poisoned</div>
              <p>The target takes 30 damage during each of its owner's Start Phases. Poisoning effects usually revolve around stacking multiple instances, increasing its damage.</p>
            </div>
            <div className="rules-status-entry rules-status-burned">
              <div className="rules-status-name">Burned</div>
              <p>The target takes 60 damage during each of its owner's Start Phases.</p>
            </div>
            <div className="rules-status-entry rules-status-bleeding">
              <div className="rules-status-name">Bleeding</div>
              <p>The target takes 50 damage whenever it performs an Action, activates its active effect or activates the active effect of one of its Abilities.</p>
            </div>
          </div>

          <div className="rules-callout" style={{ marginTop: 16 }}>
            After recovering from a Freeze, Stun, Blind or any other status effect that includes negating a target's effect or preventing it from performing Actions, that target becomes completely <strong>immune</strong> to the opponent's incapacitating effects for 1 turn (until the beginning of its owner's next turn)!
          </div>

          <div className="rules-divider" />

          {/* ── DECK CONSTRUCTION ── */}
          <SectionTitle id="deckbuilding">Deck Construction</SectionTitle>
          <div className="rules-text-block">
            <p>Decks consist of <strong>60 cards</strong>, not including your 3 Heroes and their Starting Abilities, so you bring <strong>69 cards total</strong>.</p>
            <p>If you play a Potion Deck, that has to contain <strong>5–15 cards</strong>.</p>
            <p>Your Hero lineup has to consist of 3 <strong>DIFFERENT</strong> Heroes. Alternate versions of a Hero with the same name (such as "Cool Rescuer Monia" and "Cool Birthday Girl Monia") still count as the same Hero for this!</p>

            <div className="rules-deck-limits">
              <div className="rules-deck-limit">
                <div className="rules-deck-limit-label">Main Deck</div>
                <div className="rules-deck-limit-desc">Any number of copies of Abilities. Up to <strong>4 copies</strong> of Heroes, Artifacts, Attacks, Spells and Ascended Heroes.</div>
              </div>
              <div className="rules-deck-limit">
                <div className="rules-deck-limit-label">Potion Deck</div>
                <div className="rules-deck-limit-desc">Up to <strong>2 copies</strong> of each Potion.</div>
              </div>
            </div>
          </div>

          <div style={{ height: 60 }} />
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════
//  SINGLEPLAYER — opponent gallery + active battle
// ═══════════════════════════════════════════

// Renders a hero's card cropped to just the artwork region. Every hero
// card shares a fixed frame layout — art occupies (78, 175)..(672, 573)
// in native-pixel coordinates, a 594x398 block. We scale the raw image
// with CSS transform so a tile can be sized arbitrarily without
// distorting the aspect ratio. Image source routes through cardImageUrl
// so we get the hero's default card file (/cards/<filename>) rather than
// a non-existent /cards/skins/<name>.png.
// ═══════════════════════════════════════════════════════════════
//  ★ v1404 (Al 25.9.): KACHELN DER CPU-AUSWAHL — ein Baustein
//  Rahmen mit Doppelkante, Eckwinkeln, Bildrahmen mit Vignette und
//  gelegentlichem Glanzband; Farbe per `--kachel-farbe`. Die Zufalls-
//  Kachel nutzt denselben Baustein mit Goldton und einem Bild, das wie
//  ein Spielautomat durch die freigeschalteten Gegner laeuft.
// ═══════════════════════════════════════════════════════════════
function VsCpuKachel({ farbe, zufall, disabled, onClick, bild, name, fuss }) {
  const [hover, setHover] = useState(false);
  // Jede Kachel glaenzt zu ihrer eigenen Zeit, nicht alle im Gleichschritt.
  const verzug = useMemo(() => (0.4 + Math.random() * 5).toFixed(2) + 's', []);
  return (
    <button className={'vscpu-kachel' + (zufall ? ' vscpu-kachel--zufall' : '')}
      disabled={disabled} onClick={onClick}
      style={{ '--kachel-farbe': farbe }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <span className="vscpu-ecken" aria-hidden="true"><i /><i /><i /><i /></span>
      <div className="vscpu-bild" style={{ '--glanz-verzug': verzug }}>
        {bild(hover && !disabled)}
        <span className="vscpu-bild-vignette" aria-hidden="true" />
        <GlanzBand klasse="vscpu-glanz" />
      </div>
      <div className="vscpu-name orbit-font">{name}</div>
      <div className="vscpu-fuss">{fuss}</div>
    </button>
  );
}

// ★ v1408 (Al 25.9.): ein ECHTER Würfel — 3D-Würfel aus sechs Seiten mit
// Augen. Beim Hover wird immer wieder geworfen: Er hüpft hoch, über-
// schlägt sich mehrfach und landet auf einer zufälligen Zahl, liegt kurz
// still und wird erneut geworfen. Ohne Hover ruht er schräg auf seiner
// letzten Zahl.
const WUERFEL_AUGEN = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
// Seite → Drehung des Würfels, die sie nach vorn bringt (Grad, x/y).
const WUERFEL_LAGE = { 1: [0, 0], 6: [0, 180], 3: [0, -90], 4: [0, 90], 5: [-90, 0], 2: [90, 0] };
const WUERFEL_SEITEN = [
  ['vorn', 1], ['hinten', 6], ['rechts', 3], ['links', 4], ['oben', 5], ['unten', 2],
];
function RollenderWuerfel({ rollt }) {
  const ruhig = typeof window !== 'undefined' && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [wurf, setWurf] = useState({ x: 0, y: 0, n: 0, zahl: 5 });
  useEffect(() => {
    if (!rollt || ruhig) return;
    const werfen = () => setWurf(w => {
      let zahl = 1 + Math.floor(Math.random() * 6);
      if (zahl === w.zahl) zahl = (zahl % 6) + 1;      // jedes Mal eine andere Zahl
      const [zx, zy] = WUERFEL_LAGE[zahl];
      // Immer vorwärts drehen: zur nächsten vollen Umdrehung aufrunden,
      // ein bis zwei Extra-Überschläge je Achse, dann die Ziellage.
      const weiter = (alt, ziel, extra) => Math.ceil(alt / 360) * 360 + extra * 360 + ziel;
      return {
        x: weiter(w.x, zx, 1 + Math.floor(Math.random() * 2)),
        y: weiter(w.y, zy, 1 + Math.floor(Math.random() * 2)),
        n: w.n + 1, zahl,
      };
    });
    werfen();
    // v1409 (Al 25.9.): drastisch schneller — ein Wurf alle 0,4 s; Flug-
    // und Sprungdauer in style.css (.vscpu-wuerfel / vscpuSprung) passen dazu.
    const iv = setInterval(werfen, 400);
    return () => clearInterval(iv);
  }, [rollt, ruhig]);
  return (
    <span className="vscpu-wuerfel-buehne" aria-hidden="true">
      <span key={wurf.n} className={'vscpu-wuerfel-sprung' + (wurf.n > 0 ? ' vscpu-wuerfel-sprung--an' : '')}>
        <span className="vscpu-wuerfel" style={{ transform: `rotateX(${wurf.x}deg) rotateY(${wurf.y}deg)` }}>
          {WUERFEL_SEITEN.map(([seite, zahl]) => (
            <span key={seite} className={'vscpu-wuerfel-seite vscpu-wuerfel-' + seite}>
              {Array.from({ length: 9 }, (_, i) => (
                <i key={i} className={WUERFEL_AUGEN[zahl].includes(i) ? 'an' : ''} />
              ))}
            </span>
          ))}
        </span>
      </span>
    </span>
  );
}

/** Zufalls-Kachel: laeuft durch die Gegner-Portraits, schneller bei Hover. */
function ZufallsGegnerBild({ gegner, schnell, width = 240 }) {
  const liste = Array.isArray(gegner) ? gegner.filter(g => g?.middleHero) : [];
  const [idx, setIdx] = useState(() => (liste.length ? Math.floor(Math.random() * liste.length) : 0));
  const ruhig = typeof window !== 'undefined' && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => {
    if (ruhig || liste.length < 2) return;
    const iv = setInterval(() => setIdx(i => (i + 1 + Math.floor(Math.random() * (liste.length - 1))) % liste.length),
      schnell ? 120 : 900);
    return () => clearInterval(iv);
  }, [schnell, liste.length, ruhig]);
  const aktuell = liste[idx % Math.max(1, liste.length)];
  return (
    <div className={'vscpu-zufall' + (schnell ? ' vscpu-zufall--schnell' : '')} style={{ width, height: width * (398 / 594) }}>
      <div key={idx} className="vscpu-zufall-portrait">
        {aktuell && <HeroArtCrop heroName={aktuell.middleHero} width={width} />}
      </div>
      <span className="vscpu-zufall-frage pixel-font" aria-hidden="true">?</span>
      <RollenderWuerfel rollt={schnell} />
    </div>
  );
}

function HeroArtCrop({ heroName, width = 160 }) {
  const src = heroName ? cardImageUrl(heroName) : null;
  if (!src) {
    return (
      <div style={{
        width, height: width * (398 / 594),
        background: '#1a1a28', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        color: 'var(--text2)', fontSize: 10, letterSpacing: 2,
      }}>NO ART</div>
    );
  }
  const scale = width / 594;
  const height = 398 * scale;
  return (
    <div style={{
      width, height,
      overflow: 'hidden',
      position: 'relative',
      background: '#0a0a12',
    }}>
      <img src={src} draggable={false}
        style={{
          position: 'absolute',
          left: -78 * scale,
          top: -175 * scale,
          transform: 'scale(' + scale + ')',
          transformOrigin: 'top left',
          imageRendering: 'pixelated',
        }}
      />
    </div>
  );
}

// In-place registration modal for guests (opened from the VS CPU screen).
// Signs up + verifies without leaving the screen; on success it logs in as the
// new (non-guest) account, which routes the app to the main menu. `starterDeckId`
// carries the guest's currently-selected deck so the new account keeps it.
function GuestRegisterModal({ onClose, starterDeckId }) {
  const { setUser } = useContext(AppContext);
  const [step, setStep] = useState('form'); // 'form' | 'verify'
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const run = async (fn) => {
    setLoading(true); setError('');
    try { await fn(); } catch (e) { setError(e.message || 'Something went wrong'); }
    setLoading(false);
  };

  const submitSignup = () => run(async () => {
    if (!username.trim() || !email.trim() || !password) { setError('Fill in all fields'); return; }
    const data = await api('/auth/signup', { method: 'POST', body: JSON.stringify({ username: username.trim(), email: email.trim(), password }) });
    setPendingEmail(data.email); setCode(''); setInfo('We emailed you a 6-digit code.'); setStep('verify');
  });

  const submitVerify = () => run(async () => {
    if (!code.trim()) { setError('Enter the code from your email'); return; }
    const data = await api('/auth/verify-email', { method: 'POST', body: JSON.stringify({ email: pendingEmail, code: code.trim(), starterDeckId: starterDeckId || undefined }) });
    // Log in as the new (non-guest) account → App routes to the main menu.
    window.AUTH_TOKEN = data.token;
    socket.emit('auth', data.token);
    if (data.isNewAccount) window._isNewAccount = true;
    setUser(data.user);
  });

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#12101f', border: '1px solid var(--accent)', borderRadius: 10, padding: '24px 26px', width: 340, maxWidth: '90vw', boxShadow: '0 0 30px rgba(0,0,0,.6)', position: 'relative' }}>
        <button onClick={onClose} title="Close" style={{ position: 'absolute', top: 8, right: 10, background: 'none', border: 'none', color: 'var(--text2)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
        <h2 className="pixel-font" style={{ fontSize: 15, color: 'var(--accent)', marginBottom: 4, textShadow: '0 0 16px var(--accent)' }}>CREATE ACCOUNT</h2>
        <div className="orbit-font" style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 16, letterSpacing: 1 }}>Keep your deck &amp; unlock everything</div>
        {step === 'form' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input className="input" placeholder="Username" value={username} autoComplete="username" maxLength={10} onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitSignup()} />
            <input className="input" type="email" placeholder="Email" value={email} autoComplete="email" onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitSignup()} />
            <input className="input" type="password" placeholder="Password" value={password} autoComplete="new-password" onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitSignup()} />
            {error && <div className="auth-msg auth-err">{error}</div>}
            <button className="btn btn-big" onClick={submitSignup} disabled={loading}>{loading ? '...' : 'SIGN UP'}</button>
            <div className="auth-fine">We'll email you a 6-digit code to confirm your address.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="auth-fine">We sent a 6-digit code to <b>{pendingEmail}</b>.</div>
            <input className="input auth-code" inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" maxLength={6} value={code} autoFocus onChange={e => setCode(e.target.value.replace(/\D/g, ''))} onKeyDown={e => e.key === 'Enter' && submitVerify()} />
            {error && <div className="auth-msg auth-err">{error}</div>}
            {info && <div className="auth-msg auth-ok">{info}</div>}
            <button className="btn btn-big" onClick={submitVerify} disabled={loading}>{loading ? '...' : 'VERIFY & PLAY'}</button>
            <div className="auth-link" onClick={() => { setStep('form'); setError(''); }}>← Back</div>
          </div>
        )}
      </div>
    </div>
  );
}

function SingleplayerScreen() {
  // Antonia-Praesenz auch hier, fuer den Tutorial-Zweig weiter unten.
  const antoniaHere2 = useAntoniaPresent();
  const { user, setUser, setScreen, notify, setBgmMode } = useContext(AppContext);
  const [opponents, setOpponents] = useState(null);          // null = loading
  const [personalDecks, setPersonalDecks] = useState([]);
  const [sampleDecks, setSampleDecks] = useState([]);
  const [selectedDeck, setSelectedDeck] = useState('');
  const [cpuBattleState, setCpuBattleState] = useState(null);
  const [starting, setStarting] = useState(false);
  const [search, setSearch] = useState('');
  const [showRegister, setShowRegister] = useState(false); // guest registration modal
  const [tutorialBrowserOpen, setTutorialBrowserOpen] = useState(false); // Tutorial Raccoon
  const [showRules, setShowRules] = useState(false); // in-place Rules overlay (guests)
  const cpuBattleRoom = useRef(null);
  const { tutorialList, tutorialAttemptState, startTutorialAttempt, onTutorialAttemptLeave } = useTutorialFlow(tutorialBrowserOpen);

  // Load gallery + caller's own decks (needed to resolve the player deck
  // for the match — we auto-pick their default, same as the old dropdown).
  const refreshGallery = useCallback(async () => {
    try {
      const gal = await api('/sample-decks/gallery');
      setOpponents(gal?.opponents || []);
    } catch (err) {
      notify(err.message || 'Load failed', 'error');
      setOpponents([]);
    }
  }, [notify]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [gal, mine, samples] = await Promise.all([
          api('/sample-decks/gallery'),
          api('/decks'),
          api('/sample-decks/owned'),
        ]);
        if (cancelled) return;
        const personal = mine?.decks || [];
        const sampleList = samples?.decks || [];
        setOpponents(gal?.opponents || []);
        setPersonalDecks(personal);
        setSampleDecks(sampleList);
        // Bootstrap the dropdown from the user's saved default (custom
        // deck, then pinned starter / structure deck, then first legal).
        const customDefault = personal.find(d => d.isDefault);
        const pinnedSampleId = user?.defaultSampleDeckId || null;
        const pinnedSample = pinnedSampleId ? sampleList.find(s => s.id === pinnedSampleId) : null;
        if (customDefault) setSelectedDeck(customDefault.id);
        else if (pinnedSample) setSelectedDeck(pinnedSample.id);
        else if (personal.length) setSelectedDeck(personal[0].id);
        else {
          const firstLegalSample = sampleList.find(s => isDeckLegal(s).legal);
          if (firstLegalSample) setSelectedDeck(firstLegalSample.id);
        }
      } catch (err) {
        if (!cancelled) { notify(err.message || 'Load failed', 'error'); setOpponents([]); }
      }
    })();
    return () => { cancelled = true; };
  }, [notify]);

  // Wiedereinstieg nach einem Neuladen: app-main legt den vom Server
  // gesendeten Zustand hier ab, weil unser eigener game_state-Listener
  // erst unten beim Einhängen registriert wird und das Ereignis sonst
  // verloren ginge. Einmal aufnehmen und den Zwischenspeicher leeren.
  useEffect(() => {
    const pending = window.__ppPendingCpuBattleState;
    if (!pending) return;
    window.__ppPendingCpuBattleState = null;
    cpuBattleRoom.current = pending.roomId;
    setCpuBattleState(pending);
  }, []);

  // CPU battle socket listeners
  useEffect(() => {
    const onGameState = (state) => {
      console.log('[SP game_state recv]', {
        roomId: state?.roomId,
        isCpuBattle: state?.isCpuBattle,
        turn: state?.turn,
        hasResult: !!state?.result,
      });
      if (state.isCpuBattle) {
        cpuBattleRoom.current = state.roomId;
        setCpuBattleState(state);
      }
    };
    const onError = (msg) => {
      console.error('[SP cpu_battle_error]', msg);
      notify('CPU battle error: ' + msg, 'error');
    };
    socket.on('game_state', onGameState);
    socket.on('cpu_battle_error', onError);
    return () => { socket.off('game_state', onGameState); socket.off('cpu_battle_error', onError); };
  }, [notify]);

  // Keep the gallery in sync when a battle unlocks a new opponent (the
  // ornate popup is handled globally; this just makes the new tile appear).
  useEffect(() => {
    const onUnlocked = () => refreshGallery();
    socket.on('opponents_unlocked', onUnlocked);
    return () => socket.off('opponents_unlocked', onUnlocked);
  }, [refreshGallery]);

  // BGM
  useEffect(() => {
    if (!setBgmMode) return;
    if (cpuBattleState && !cpuBattleState.result) {
      // Gegnerspezifisches Battle-Theme (1.8.). Der Server bestimmt den
      // Slug aus dem mittleren Helden des CPU-Decks und liefert ihn als
      // `cpuBgm`; fehlt er (kein Theme im Ordner), bleibt es beim
      // generischen Kampfthema.
      //
      // HIER ist die Stelle für Singleplayer — der gleichnamige Effekt
      // in app-main.jsx (PlayScreen) bedient nur den MEHRSPIELER-Weg.
      // Beim ersten Anlauf hatte ich nur diesen gepatcht, weshalb im
      // CPU-Kampf weiter `battle` gesetzt wurde.
      const mode = cpuBattleState.cpuBgm ? 'battle:' + cpuBattleState.cpuBgm : 'battle';
      if (window.__ppBgmLast !== mode) {
        window.__ppBgmLast = mode;
        console.log('[bgm] SP-Zustand: cpuBgm =',
          JSON.stringify(cpuBattleState.cpuBgm), '→ Modus', mode);
      }
      setBgmMode(mode);
    }
    // Ergebnis-Thema: solange der End-of-Battle-Screen eines CPU-Kampfes
    // steht, laeuft `win` bzw. `defeat` in Schleife. Erst wenn der
    // Zustand ganz verschwindet, geht es zurueck ins Menue-Thema.
    else if (cpuBattleState?.result && typeof cpuBattleState.result.winnerIdx === 'number') {
      setBgmMode(cpuBattleState.result.winnerIdx === cpuBattleState.myIndex ? 'win' : 'defeat');
    }
    // Tutorial-NIEDERLAGE: sofort aufs Niederlage-Thema.
    //
    // Warum nur die Niederlage: bei einem SIEG laeuft danach der
    // Outro-Dialog, und v184 haelt dafuer bewusst das Tutorial-Thema —
    // GameBoard schaltet dort erst mit der Fanfare auf `win`. Weil der
    // Effekt in GameBoard (Kind) VOR diesem hier (Elternteil) laeuft,
    // ueberschrieb dieser Effekt beim Ergebniswechsel das gerade
    // gesetzte `defeat` wieder mit dem Tutorial-Thema. Beim Sieg fiel es
    // nicht auf, weil die Fanfare dort erst SPAETER feuert (nach dem
    // Outro) und dieser Effekt bis dahin nicht erneut laeuft.
    else if (tutorialAttemptState?.result
             && typeof tutorialAttemptState.result.winnerIdx === 'number'
             && tutorialAttemptState.result.winnerIdx !== tutorialAttemptState.myIndex) setBgmMode('defeat');
    // Laufendes Tutorial ODER Sieg mit noch laufendem Outro: Tutorial-Thema.
    else if (tutorialAttemptState) setBgmMode(antoniaHere2 ? 'tutorialAntonia' : 'tutorial');
    else setBgmMode('menu');
    return () => { if (setBgmMode) setBgmMode('menu'); };
  }, [cpuBattleState, tutorialAttemptState, antoniaHere2, setBgmMode]);

  // Esc → back to menu (battle's own Esc handling takes priority). Guests have
  // no menu, so Esc ends their session and returns to the login screen — same
  // as the Back button.
  useEffect(() => {
    const h = (e) => {
      // The active board (CPU duel or tutorial mission) and the in-place Rules
      // overlay handle their own Escape, so don't also leave the screen here.
      if (e.key === 'Escape' && !cpuBattleState && !tutorialAttemptState && !showRules) {
        // The tutorial browser and guest-register modals trap Esc to close
        // themselves before it falls through to "leave the screen".
        if (tutorialBrowserOpen) { e.stopImmediatePropagation(); setTutorialBrowserOpen(false); return; }
        e.stopImmediatePropagation();
        if (showRegister) { setShowRegister(false); return; }
        if (user?.isGuest) {
          api('/auth/logout', { method: 'POST' }).catch(() => {}).finally(() => {
            window.AUTH_TOKEN = null;
            setUser(null);
          });
        } else {
          setScreen('menu');
        }
      }
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [cpuBattleState, tutorialAttemptState, showRules, tutorialBrowserOpen, setScreen, setUser, user, showRegister]);

  const startBattle = useCallback((opponentId) => {
    if (starting) return;
    // Resolve the deck the player picked in the dropdown first, with
    // fallbacks to any legal deck in case the selection is stale.
    const legalPersonal = personalDecks.filter(d => isDeckLegal(d).legal);
    const legalSample = sampleDecks.filter(d => isDeckLegal(d).legal);
    const selected = personalDecks.find(d => d.id === selectedDeck)
                  || sampleDecks.find(d => d.id === selectedDeck);
    const legalSelected = selected && isDeckLegal(selected).legal ? selected : null;
    const playerDeck = legalSelected
                    || legalPersonal.find(d => d.isDefault)
                    || legalPersonal[0]
                    || legalSample[0]
                    || null;
    if (!playerDeck) { notify('You need a legal deck to play', 'error'); return; }
    setStarting(true);
    socket.emit('start_cpu_battle', { playerDeckId: playerDeck.id, cpuDeckId: opponentId });
    if (window.playSFX) window.playSFX('match_found');
    // Safety reset in case no game_state arrives
    setTimeout(() => setStarting(false), 3000);
  }, [personalDecks, sampleDecks, selectedDeck, starting, notify]);

  const onBattleLeave = useCallback(() => {
    const roomId = cpuBattleRoom.current;
    if (roomId) socket.emit('leave_game', { roomId });
    setCpuBattleState(null);
    cpuBattleRoom.current = null;
    setStarting(false);
    // Refresh so the gallery W/L reflects the outcome
    refreshGallery();
  }, [refreshGallery]);

  // Active tutorial mission — hand the whole screen to the board (same as a
  // CPU duel). The tutorial uses its own fixed decks, so no deck props apply.
  if (tutorialAttemptState) {
    const GameBoard = window.GameBoard;
    return (
      <GameBoard
        gameState={tutorialAttemptState}
        lobby={{ id: tutorialAttemptState.roomId }}
        onLeave={onTutorialAttemptLeave}
        decks={[]}
        sampleDecks={[]}
        selectedDeck={null}
        setSelectedDeck={() => {}}
      />
    );
  }

  // Rules overlay — guests can't navigate to the standalone Rules screen, so
  // render it in place with a Back that returns to the opponent picker.
  if (showRules) {
    return <RulesScreen onBack={() => setShowRules(false)} />;
  }

  // Active CPU battle — render the board and nothing else
  if (cpuBattleState) {
    const GameBoard = window.GameBoard;
    return (
      <GameBoard
        gameState={cpuBattleState}
        lobby={{ id: cpuBattleState.roomId }}
        onLeave={onBattleLeave}
        decks={personalDecks}
        sampleDecks={sampleDecks}
        selectedDeck={selectedDeck}
        setSelectedDeck={setSelectedDeck}
      />
    );
  }

  const hasAnyLegal = personalDecks.some(d => isDeckLegal(d).legal)
                   || sampleDecks.some(d => isDeckLegal(d).legal);

  // Filter the gallery by the search box (matches the visible hero name and
  // the deck name, case-insensitive). Ordering from the server is preserved.
  const q = search.trim().toLowerCase();
  const visibleOpponents = !q || opponents === null
    ? opponents
    : opponents.filter(op =>
        (op.middleHero || '').toLowerCase().includes(q)
        || (op.name || '').toLowerCase().includes(q));

  // Guests have no main menu — Back ends their throwaway session and returns
  // to the login screen. Everyone else goes back to the menu.
  const onBack = async () => {
    if (user?.isGuest) {
      try { await api('/auth/logout', { method: 'POST' }); } catch {}
      window.AUTH_TOKEN = null;
      setUser(null);
      return;
    }
    setScreen('menu');
  };

  return (
    <div className="screen-full" style={{ background: 'linear-gradient(180deg, #0a0a12 0%, #12101f 40%, #0a0a12 100%)', overflow: 'hidden' }}>
      {showRegister && <GuestRegisterModal starterDeckId={selectedDeck} onClose={() => setShowRegister(false)} />}
      {tutorialBrowserOpen && (
        <TutorialBrowserModal
          tutorialList={tutorialList}
          onClose={() => setTutorialBrowserOpen(false)}
          onStart={startTutorialAttempt}
          onViewRules={() => { setTutorialBrowserOpen(false); setShowRules(true); }}
        />
      )}
      {/* Kopfzeile ANGEPINNT (Als Vorgabe 17.8.): Deckauswahl, Gegnersuche
          und Titel bleiben beim Scrollen stehen. Inline statt in `.top-bar`,
          weil die Klasse von jedem Screen benutzt wird — hier scrollt der
          Inhalt im `screen-full`-Container, anderswo nicht.
          `position: relative` steht in der Klasse und ankert den zentrierten
          Titel; `sticky` uebernimmt diese Ankerrolle mit, der Titel bleibt
          also mittig. Der eigene Hintergrund (`--bg2`) ist schon gesetzt,
          sodass Inhalt sauber darunter durchlaeuft. */}
      <div className="top-bar" style={{ position: 'sticky', top: 0, zIndex: 30 }}>
        <button className="btn" onClick={onBack}>← BACK</button>
        {user?.isGuest && (
          // v1265 (Al 22.9.): so hoch wie BACK — die Inline-Verkleinerung
          // (5/16 px) ist raus, beide nehmen das `.btn`-Grundmass (v1260).
          <button className="btn" onClick={() => setShowRegister(true)}>★ REGISTER NOW!</button>
        )}
        <h2 className="orbit-font" style={{ fontSize: 22, fontWeight: 800, color: 'var(--player-color)' }}>CHOOSE OPPONENT!</h2>
        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            className="select"
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Search opponents..."
            style={{ fontSize: 12, width: 200, padding: '4px 8px', paddingRight: search ? 24 : 8, borderColor: 'var(--player-color)', color: 'var(--text)' }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              title="Clear"
              style={{ position: 'absolute', right: 4, background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 2 }}
            >×</button>
          )}
        </div>
        <label style={{ fontSize: 12, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
          🃏 Deck:
          <select className="select" value={selectedDeck} onChange={async e => {
              const id = e.target.value;
              setSelectedDeck(id);
              // Mirror the Find Player dropdown: save the picked deck as
              // the user's default. Custom decks go through /decks/:id/
              // set-default; starter / structure decks go through /decks/
              // set-default-sample (which enforces structure-deck
              // ownership server-side).
              try {
                if (personalDecks.some(d => d.id === id)) {
                  await api('/decks/' + id + '/set-default', { method: 'POST' });
                  setPersonalDecks(prev => prev.map(d => ({ ...d, isDefault: d.id === id })));
                  setUser(u => u ? { ...u, defaultSampleDeckId: null } : u);
                } else if (sampleDecks.some(d => d.id === id)) {
                  await api('/decks/set-default-sample', { method: 'POST', body: JSON.stringify({ sampleDeckId: id }) });
                  setPersonalDecks(prev => prev.map(d => ({ ...d, isDefault: false })));
                  setUser(u => u ? { ...u, defaultSampleDeckId: id } : u);
                }
              } catch {}
            }} style={{ fontSize: 12, minWidth: 180, padding: '4px 8px', borderColor: 'var(--player-color)', color: 'var(--text)' }}>
            {personalDecks.map(d => <option key={d.id} value={d.id}>{d.name} {isDeckLegal(d).legal ? '✓' : '✗'}{d.isDefault ? ' ★' : ''}</option>)}
            {sampleDecks.filter(d => isDeckLegal(d).legal).length > 0 && <option disabled>── Sample Decks ──</option>}
            {sampleDecks.filter(d => isDeckLegal(d).legal).map(d => <option key={d.id} value={d.id}>📋 {d.name}{user?.defaultSampleDeckId === d.id ? ' ★' : ''}</option>)}
          </select>
        </label>
        <VolumeControl />
      </div>
      {/* Gerahmter Kasten wie im Hauptmenue (`ornate-frame pp-menuekasten`).
          Er fuellt den Platz unter der Kopfzeile mit Abstand ringsum und
          scrollt INNEN (`.vscpu-content`) — vorher scrollte die ganze
          Seite und der Kasten lief ohne Abschluss unten aus dem Bild. */}
      <div className="vscpu-rahmen ornate-frame pp-menuekasten">
      <div className="vscpu-content" style={{ padding: '22px 22px 30px', boxSizing: 'border-box', width: '100%' }}>
        {!hasAnyLegal && (
          <div style={{ color: '#ff7777', textAlign: 'center', padding: '12px 16px', marginBottom: 20, border: '1px solid #ff7777', borderRadius: 4, background: 'rgba(255,119,119,.08)', fontSize: 12 }}>
            You need at least one legal deck to play. Edit a deck or pick a starter deck first.
          </div>
        )}
        {(() => {
          // The Tutorial Raccoon is the first "opponent" for guests only:
          // clicking her opens the How-to-Play tutorial browser instead of
          // starting a duel. She borrows Smug Mastermind Antonia's hero art
          // (cropped like the real tiles) and is themed pink to set her apart
          // from actual foes. Registered players don't see her.
          const showRaccoon = !!user?.isGuest && (!q || 'tutorial raccoon how to play smug mastermind antonia'.includes(q));
          const oppTiles = (opponents && visibleOpponents) ? visibleOpponents : [];
          const racColor = '#ff44cc';
          return (
          <>
          <div style={{
            display: 'grid',
            // Kachel 232 px (Bild 208): im breiten Rahmen passen 6 je Zeile.
            gridTemplateColumns: 'repeat(auto-fill, 232px)',
            justifyContent: 'center',
            gap: 14,
          }}>
            {showRaccoon && (
              <button
                key="__tutorial_raccoon"
                // ★ v1264 (Al 22.9.): im Gastmodus genauso hervorgehoben
                // wie der Gast-Knopf im Login — Schein + Foil-Glanz, damit
                // der neue Spieler vom ersten Klick an derselben Spur folgt.
                // Die Kachel ist ohnehin nur fuer Gaeste sichtbar.
                className="pp-lotse vscpu-raccoon"
                disabled={starting}
                onClick={() => setTutorialBrowserOpen(true)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: 6, padding: 8,
                  // Opaque (tint mixed into --bg2) so the dithered content
                  // behind the tile doesn't show through it.
                  background: 'color-mix(in srgb, ' + racColor + ' 8%, var(--bg2))',
                  border: '2px solid ' + racColor,
                  borderRadius: 6,
                  boxShadow: '0 0 10px ' + racColor + '44',
                  cursor: starting ? 'not-allowed' : 'pointer',
                  opacity: starting ? 0.55 : 1,
                  transition: 'transform .15s ease, box-shadow .15s ease',
                  fontFamily: 'inherit', color: 'inherit',
                }}
                onMouseEnter={e => { if (!starting) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 0 18px ' + racColor + '88'; } }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 0 10px ' + racColor + '44'; }}
              >
                <LotsenGlanz />
                <HeroArtCrop heroName="Smug Mastermind Antonia" width={208} />
                <div className="orbit-font" style={{ fontSize: 16, color: racColor, textAlign: 'center', fontWeight: 700, lineHeight: 1.2, minHeight: '2.4em', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  Tutorial Raccoon
                </div>
                <div style={{ display: 'flex', gap: 6, fontSize: 13, marginTop: 'auto', color: racColor, fontWeight: 700 }}>
                  ★ Learn to Play
                </div>
              </button>
            )}
            {/* ★ v1370 (Als Wunsch): ZUFALLS-GEGNER als erste Kachel (oben
                links). Zieht aus ALLEN freigeschalteten Gegnern — die Galerie
                liefert nur freigeschaltete, und die Suche filtert hier bewusst
                nicht mit. Nicht im Gastmodus (dort steht der Tutorial Raccoon
                an erster Stelle). */}
            {!user?.isGuest && Array.isArray(opponents) && opponents.length > 0 && (() => {
              const aktiv = hasAnyLegal && !starting;
              return (
                <VsCpuKachel key="__random_opponent" farbe="#ffcc33" zufall
                  disabled={!aktiv}
                  onClick={() => {
                    const op = opponents[Math.floor(Math.random() * opponents.length)];
                    if (op) startBattle(op.id);
                  }}
                  bild={(schnell) => <ZufallsGegnerBild gegner={opponents} schnell={schnell} width={208} />}
                  name="Random Opponent"
                  fuss={<span className="vscpu-chip">{opponents.length} unlocked</span>}
                />
              );
            })()}
            {oppTiles.map(op => {
              const total = (op.wins || 0) + (op.losses || 0);
              return (
                <VsCpuKachel key={op.id} farbe="#ff4444"
                  disabled={!hasAnyLegal || starting}
                  onClick={() => startBattle(op.id)}
                  bild={() => <HeroArtCrop heroName={op.middleHero} width={208} />}
                  name={op.middleHero || op.name}
                  fuss={total > 0 ? (
                    <>
                      <span className="vscpu-chip">W {op.wins || 0}</span>
                      <span className="vscpu-chip">L {op.losses || 0}</span>
                    </>
                  ) : (
                    <span className="vscpu-chip vscpu-chip--leise">No matches yet</span>
                  )}
                />
              );
            })}
          </div>
          {opponents === null && (
            <div style={{ textAlign: 'center', color: 'var(--text2)', padding: 40, fontSize: 13 }}>Loading opponents...</div>
          )}
          {opponents !== null && opponents.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text2)', padding: 40, fontSize: 13 }}>No opponents available yet.</div>
          )}
          {opponents !== null && opponents.length > 0 && visibleOpponents.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text2)', padding: 40, fontSize: 13 }}>No opponents match “{search.trim()}”.</div>
          )}
          </>
          );
        })()}
      </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════

// Context menu sub-component

// ===== CROSS-FILE EXPORTS =====
window.AuthScreen = AuthScreen;
window.MainMenu = MainMenu;
window.getRank = getRank;
window.ProfileScreen = ProfileScreen;
window.PurchaseCelebration = PurchaseCelebration;
window.ShopScreen = ShopScreen;
window.SingleplayerScreen = SingleplayerScreen;
window.HeroArtCrop = HeroArtCrop;
window.RulesScreen = RulesScreen;
// v809: Die Bundles reichen ihre Bausteine AUSDRUECKLICH ueber `window`
// weiter — wer hier fehlt, ist in den anderen Dateien schlicht nicht da.
// Genau daran hing v808: die Hintergrund-Partikel wurden nie gezeichnet,
// weil `MenuBackgroundParticles` in app-main.jsx ein unbekannter Name war.
window.MenuBackgroundParticles = MenuBackgroundParticles;
