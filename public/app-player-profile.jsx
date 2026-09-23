// ═══════════════════════════════════════════════════════════════
//  PIXEL PARTIES — SPIELERPROFIL-POPUP (v1289)
//
//  Als Vorgabe 23.9.: Klick auf einen Eintrag der Top-Spieler-Liste →
//  kompaktes Profil (weniger als der halbe Bildschirm), schliessbar per
//  ✕, Escape oder Klick daneben, mit Klang bei jedem Klick.
//
//  Aufbau — alles in dieser Datei:
//    • window.openPlayerProfile(seed)       oeffnet das Popup von ueberall
//    • window.playerProfileTriggerProps(p)  macht jedes Element zum Ausloeser
//                                           (Rolle, Tastatur, Klang)
//    • <PlayerProfilePopupHost />           einmal in <App> eingehaengt
//  Daten: GET /api/players/:username/profile (player-profile.js).
//
//  KLANG: Oeffnen spielt `ui_prompt_open` (der Ausloeser traegt
//  `data-sfx="none"`, sonst klackt der globale Klick-Listener doppelt).
//  Deck-Zeilen sind <button> → globales `ui_click`; ✕ und Escape →
//  globales `ui_cancel`; Klick auf den Schleier spielt `ui_cancel` hier
//  selbst (ein <div> faengt der globale Listener nicht); Heldenkarten
//  klacken selbst.
//
//  KARTEN-TOOLTIP (v1290/v1291, Als Vorgaben 23.9.): „neben dem Menue" und
//  dann „DIESELBE Position und Groesse wie im Daily-Modus, und scrollbar,
//  wenn er hoeher ist als der Schirm". Es ist deshalb exakt der Tooltip
//  aus CardMini (`CardSideTooltip`, app-shared): rechte bildschirmhohe
//  Leiste, Mobil-Regeln aus style.css, Mausrad-Scrollen ueber den
//  App-weiten Wheel-Handler. Er haengt per Portal an `document.body` in
//  einer Huelle mit demselben Oberflaechen-Massstab wie die Bildschirme
//  (`.ppf-tip-host`) — im Popup-DOM wuerde er am Popup statt am Fenster
//  ausgerichtet (v1289-Befund).
//
//  Alle sichtbaren Texte sind Englisch (Als Regel 11.8.).
// ═══════════════════════════════════════════════════════════════
const { useState, useEffect, useRef, useCallback, useContext } = React;

const PPF_OPEN_EVENT = 'pp:player-profile-open';
const PPF_MEDAL_COLORS = { 1: '#ffd700', 2: '#d8dce6', 3: '#e0903c' };

function ppfSfx(name, opts) {
  if (window.playSFX) window.playSFX(name, opts);
}

/** Oeffnet das Profil. `seed` = was der Ausloeser schon weiss (mind. username). */
function openPlayerProfile(seed) {
  if (!seed || !seed.username) return;
  ppfSfx('ui_prompt_open', { dedupe: 150 });
  window.dispatchEvent(new CustomEvent(PPF_OPEN_EVENT, { detail: seed }));
}

/** Props fuer ein beliebiges Element, das ein Profil oeffnen soll. */
function playerProfileTriggerProps(seed) {
  const open = (e) => { e.stopPropagation(); openPlayerProfile(seed); };
  return {
    role: 'button',
    tabIndex: 0,
    'data-sfx': 'none',
    title: 'View ' + seed.username + "'s profile",
    onClick: open,
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(e); }
    },
  };
}

// ── Formatierung ───────────────────────────────────────────────
function ppfRateTone(pct) {
  if (pct == null) return 'var(--text2)';
  if (pct >= 55) return 'var(--success)';
  if (pct <= 45) return 'var(--danger)';
  return 'var(--text)';
}
function ppfMemberSince(ts) {
  if (!ts) return null;
  try { return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }); } catch { return null; }
}

// ── Host ───────────────────────────────────────────────────────
function PlayerProfilePopupHost() {
  const { screen } = useContext(window.AppContext);
  const [seed, setSeed] = useState(null);

  useEffect(() => {
    const onOpen = (e) => setSeed({ ...e.detail });
    window.addEventListener(PPF_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(PPF_OPEN_EVENT, onOpen);
  }, []);

  // Bildschirmwechsel oder Partiebeginn (Lobby → Brett) schliessen still.
  useEffect(() => { setSeed(null); }, [screen]);
  useEffect(() => {
    if (!seed || !window.socket) return;
    const onGame = () => setSeed(null);
    window.socket.on('game_state', onGame);
    return () => window.socket.off('game_state', onGame);
  }, [!!seed]);

  const close = useCallback(() => setSeed(null), []);
  if (!seed) return null;
  return <PlayerProfilePopup key={seed.username} seed={seed} onClose={close} />;
}

// ── Popup ──────────────────────────────────────────────────────
function PlayerProfilePopup({ seed, onClose }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);
  const [deckIdx, setDeckIdx] = useState(0);
  const [tip, setTip] = useState(null);   // { card, imageUrl } der gehoverten Heldenkarte
  const closeBtnRef = useRef(null);

  useEffect(() => {
    let alive = true;
    window.api('/players/' + encodeURIComponent(seed.username) + '/profile')
      .then(d => { if (alive) setProfile(d.profile); })
      .catch(e => { if (alive) setError(e.message || 'Request failed'); });
    return () => { alive = false; };
  }, [seed.username]);

  // Escape schliesst — Capture an `window`, damit keine Bildschirm-
  // Behandlung (Lobby verlassen, Menue zurueck) dasselbe Escape bekommt.
  // Den Klang spielt der zentrale Escape-Listener in app-shared.
  useEffect(() => {
    const h = (e) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      e.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [onClose]);

  // Tastaturfokus ins Popup, damit Tab/Enter dort weitergehen.
  useEffect(() => { closeBtnRef.current && closeBtnRef.current.focus({ preventScroll: true }); }, []);

  const p = profile || {};
  const color = p.color || seed.color || '#00f0ff';
  const rank = p.rank != null ? p.rank : seed.rank;
  const decks = p.topDecks || [];
  const deck = decks[Math.min(deckIdx, Math.max(0, decks.length - 1))] || null;

  return (
    <div className="ppf-veil"
      onMouseDown={(e) => { if (e.target === e.currentTarget) { ppfSfx('ui_cancel', { dedupe: 250, volume: 0.4 }); onClose(); } }}>
      <div className="ppf-panel menu-popup-dither pp-eckzier" role="dialog" aria-modal="true"
        aria-label={(p.username || seed.username) + ' profile'}
        style={{ '--ppf-color': color }}>
        <button ref={closeBtnRef} className="btn ppf-close" onClick={onClose} aria-label="Close">✕</button>
        <div className="ppf-scroll">

        <PpfHeader seed={seed} p={p} color={color} rank={rank} loaded={!!profile} />

        {error ? (
          <div className="ppf-empty">Couldn't load this profile. Close it and try again.</div>
        ) : !profile ? (
          <div className="ppf-empty ppf-loading">Loading…</div>
        ) : (
          <>
            <PpfStats p={p} />
            <PpfDecks decks={decks} selected={deckIdx} onSelect={setDeckIdx} />
            {deck && <PpfHeroes deck={deck} onTip={setTip} />}
            <PpfFacts p={p} />
          </>
        )}
        </div>
      </div>
      {tip && <PpfCardTip tip={tip} />}
    </div>
  );
}

// ── Kopf: Avatar mit Motto-Sprechblase, Rang, Name ─────────────
function PpfHeader({ seed, p, color, rank, loaded }) {
  const name = p.username || seed.username;
  const avatar = loaded ? p.avatar : seed.avatar;
  const medal = PPF_MEDAL_COLORS[rank];
  const Typewriter = window.TypewriterText;
  return (
    <div className="ppf-head">
      <div className="ppf-avatar" style={{ borderColor: color, boxShadow: '0 0 18px ' + color + '66' }}>
        {avatar
          ? <img src={avatar} alt="" draggable="false" />
          : <span className="ppf-avatar-fallback">👤</span>}
        {rank === 1 && <span className="ppf-crown" aria-hidden="true">👑</span>}
      </div>
      <div className="ppf-head-main">
        {/* Das Motto ist der Victory-Spruch — dieselbe Zeile, die der
            Spieler nach einem Sieg als Sprechblase ueber dem Avatar hat. */}
        {loaded && p.motto ? (
          <div className="ppf-motto" title="Victory line">
            {Typewriter ? <Typewriter text={p.motto} speed={30} /> : p.motto}
          </div>
        ) : loaded ? (
          <div className="ppf-motto ppf-motto--leer">No victory line set.</div>
        ) : null}
        <div className="ppf-name-row">
          {rank != null && (
            <span className="ppf-rank" style={{ color: medal || 'var(--text2)', borderColor: medal || 'var(--bg4)' }}>#{rank}</span>
          )}
          <span className="orbit-font title-outline ppf-name" style={{ color }}>{name}</span>
          {p.inGame && <span className="ppf-live"><span className="menu-live-dot" />In a game</span>}
        </div>
        {p.bio ? <div className="ppf-bio">{p.bio}</div> : null}
      </div>
    </div>
  );
}

// ── Plaketten: Win Rate, Elo, SC ───────────────────────────────
function PpfStats({ p }) {
  const Glitzer = window.ScGlitzer;
  return (
    <div className="ppf-stats">
      <div className="badge menu-stat-badge pp-eckzier ppf-badge" style={{ color: ppfRateTone(p.winRate) }}
        title={p.wins + ' wins, ' + p.losses + ' losses (online games)'}>
        <span className="menu-stat-label">WIN RATE</span>
        <span className="menu-stat-value">{p.winRate == null ? '–' : p.winRate + '%'}</span>
      </div>
      <div className="badge menu-stat-badge pp-eckzier ppf-badge" style={{ color: 'var(--ppf-color)' }}>
        <span className="menu-stat-label">⚔ ELO</span>
        <span className="menu-stat-value">{p.elo}</span>
      </div>
      <div className="badge menu-stat-badge menu-stat-badge--sc pp-eckzier ppf-badge" style={{ color: '#ffd700' }}>
        <span className="menu-stat-coin-wrap">
          <img src="/data/sc.png" className="menu-stat-coin ppf-coin" alt="" />
          {Glitzer && <Glitzer />}
        </span>
        <span className="menu-stat-label">SC</span>
        <span className="menu-stat-value">{p.sc}</span>
      </div>
    </div>
  );
}

// ── Top-Decks (Rangfolge aus Winrate und Spielrate) ────────────
function PpfDecks({ decks, selected, onSelect }) {
  if (!decks.length) {
    return (
      <div className="ppf-section">
        <h4 className="ppf-section-title">Top decks</h4>
        <div className="ppf-empty">No online games recorded yet.</div>
      </div>
    );
  }
  return (
    <div className="ppf-section">
      <h4 className="ppf-section-title">Top decks</h4>
      <ol className="ppf-decks">
        {decks.map((d, i) => (
          <li key={i}>
            <button className={'ppf-deck' + (i === selected ? ' is-selected' : '')}
              aria-pressed={i === selected}
              onClick={() => onSelect(i)}
              title={d.wins + ' wins, ' + d.losses + ' losses'}>
              <span className="ppf-deck-place">{i + 1}</span>
              <span className="ppf-deck-name">{d.name}</span>
              {d.prebuilt && <span className="ppf-deck-tag">Prebuilt</span>}
              <span className="ppf-deck-games">{d.games} {d.games === 1 ? 'game' : 'games'}</span>
              <span className="ppf-deck-rate" style={{ color: ppfRateTone(d.winRate) }}>{d.winRate}%</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── Helden des gewaehlten Decks als Kartenbilder ───────────────
function PpfHeroes({ deck, onTip }) {
  const cards = window.CARDS_BY_NAME || {};
  const heroes = deck.heroes || [];
  // Deckwechsel: ein offener Tooltip gehoert zur alten Karte.
  useEffect(() => () => onTip(null), [deck]);
  if (!heroes.length) return null;
  return (
    // `key` am Namen: bei Deckwechsel werden die Karten neu „ausgeteilt".
    <div className="ppf-heroes" key={deck.name + heroes.join('|')} data-count={heroes.length}>
      {heroes.map((name, i) => (
        <div key={name + i} className="ppf-hero" style={{ '--ppf-i': i, '--ppf-n': heroes.length }}>
          {cards[name]
            ? <PpfHeroCard card={cards[name]} skins={deck.skins} onTip={onTip} />
            : <div className="ppf-hero-missing">{name}</div>}
        </div>
      ))}
    </div>
  );
}

/** Eine Heldenkarte — Bild + Foil wie CardMini, aber mit eigenem Tooltip. */
function PpfHeroCard({ card, skins, onTip }) {
  const imageUrl = window.cardImageUrl ? window.cardImageUrl(card.name, skins) : null;
  const CardFoil = window.CardFoil;
  const foilClass = card.foil === 'diamond_rare' ? ' foil-diamond-rare' : card.foil === 'secret_rare' ? ' foil-secret-rare' : '';
  const zeigen = () => onTip({ card, imageUrl });
  const touch = () => !!window._isTouchDevice;

  // Beruehrung: Tippen schaltet den Tooltip, Tippen anderswo schliesst ihn.
  const ref = useRef(null);
  useEffect(() => {
    if (!touch()) return;
    // Der Tooltip selbst zaehlt nicht als „anderswo" — am Telefon muss man
    // in ihm scrollen koennen, um den ganzen Kartentext zu lesen.
    const weg = (e) => {
      if (ref.current && ref.current.contains(e.target)) return;
      if (e.target && e.target.closest && e.target.closest('.card-tooltip')) return;
      onTip(t => (t && t.card === card ? null : t));
    };
    document.addEventListener('pointerdown', weg, true);
    return () => document.removeEventListener('pointerdown', weg, true);
  }, [card, onTip]);

  return (
    <div ref={ref} className={'card-mini ppf-card' + foilClass}
      onMouseEnter={() => { if (!touch()) zeigen(); }}
      onMouseLeave={() => { if (!touch()) onTip(null); }}
      onClick={() => {
        ppfSfx('ui_click', { dedupe: 60 });
        if (touch()) onTip(t => (t && t.card === card ? null : { card, imageUrl }));
      }}>
      {CardFoil && <CardFoil card={card} />}
      {imageUrl
        ? <img src={imageUrl} alt={card.name} draggable={false} />
        : <div className="ppf-card-name">{card.name}</div>}
    </div>
  );
}

/**
 * Derselbe Tooltip wie in Daily & Co. (`CardSideTooltip`), per Portal
 * ausserhalb des Popups. Die Huelle traegt den Oberflaechen-Massstab der
 * Bildschirme, damit Groesse und Lage exakt gleich sind.
 */
function PpfCardTip({ tip }) {
  const CardSideTooltip = window.CardSideTooltip;
  if (!CardSideTooltip) return null;
  return ReactDOM.createPortal(
    <div className="ppf-tip-host">
      <CardSideTooltip card={tip.card} imgUrl={tip.imageUrl} />
    </div>,
    document.body
  );
}

// ── Fakten fuer andere Spieler: Form, Bilanz gegen dich, Konto ──
function PpfFacts({ p }) {
  const form = p.form || { results: [], streak: null };
  const streak = form.streak && form.streak.count >= 2
    ? form.streak.count + (form.streak.kind === 'W' ? ' wins' : ' losses') + ' in a row'
    : null;
  const h2h = p.headToHead;
  const since = ppfMemberSince(p.memberSince);
  return (
    <div className="ppf-section ppf-facts">
      {form.results.length > 0 && (
        <div className="ppf-fact">
          <span className="ppf-fact-label">Last {form.results.length}</span>
          <span className="ppf-form" aria-label={form.results.join(' ')}>
            {form.results.map((r, i) => (
              <span key={i} className={'ppf-pip ' + (r === 'W' ? 'is-win' : 'is-loss')} title={r === 'W' ? 'Win' : 'Loss'} />
            ))}
          </span>
          {streak && <span className="ppf-streak" style={{ color: form.streak.kind === 'W' ? 'var(--success)' : 'var(--danger)' }}>{streak}</span>}
        </div>
      )}
      {h2h && (
        <div className="ppf-fact">
          <span className="ppf-fact-label">You vs {p.username}</span>
          {h2h.games > 0 ? (
            <span className="ppf-h2h">
              <b style={{ color: 'var(--success)' }}>{h2h.wins}</b>
              <span className="ppf-h2h-sep">–</span>
              <b style={{ color: 'var(--danger)' }}>{h2h.losses}</b>
            </span>
          ) : (
            <span className="ppf-fact-muted">You haven't played each other yet.</span>
          )}
        </div>
      )}
      <div className="ppf-fact ppf-fact--small">
        <span>{p.wins}W / {p.losses}L</span>
        <span>{p.rankedSets} ranked {p.rankedSets === 1 ? 'set' : 'sets'}</span>
        {since && <span>Joined {since}</span>}
      </div>
    </div>
  );
}

window.openPlayerProfile = openPlayerProfile;
window.playerProfileTriggerProps = playerProfileTriggerProps;
window.PlayerProfilePopupHost = PlayerProfilePopupHost;
