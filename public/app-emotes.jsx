// ═══════════════════════════════════════════════════════════════════════════
//  EMOTES & TITEL (Client): Pixel-Emotes im Duell, Titel am Namen, Auswahl im Profil
//
//    window.ppEmData            geladene Daten { emotes, titles, defaults, eById, tById } (data/shop/emotes/emotes.json, data/titles.json)
//    window.PpEmote             <PpEmote id box> – Emote mit ganzzahligem Faktor (image-rendering: pixelated)
//    window.PpTitle / PpTitled  Titel in goldener, verzierter Schrift; <PpTitled name title> setzt ihn je nach Sprache/Grammatik DAVOR oder DAHINTER
//    window.PpEmoteLayer  (einmal im App-Wurzelknoten) im Duell: Tasten 1–3, mittlere Maustaste (gedrückt halten → Auswahl, loslassen/klicken), Anzeige empfangener Emotes
//    window.PpProfileCosmetics  Profil: 3 Emote-Plätze (Tasten 1–3) tauschen, Titel wählen
//
//  Server: emotes-titles.js (Besitz, Ausrüstung, Socket 'emote'). Grafik: Pixelart; Bewegung in ganzen Pixeln/Stufen, keine Weichzeichner.
//  Alle Namen tragen das Präfix `pp`/`Pp` (alle Bundles teilen einen globalen Gültigkeitsbereich).
// ═══════════════════════════════════════════════════════════════════════════

const PP_EM_DIR = '/data/shop/emotes/';
const ppEmData = { emotes: [], titles: [], defaults: [], eById: {}, tById: {}, ready: false, subs: new Set() };
window.ppEmData = ppEmData;
(function ppEmLoad() {
  Promise.all([fetch(PP_EM_DIR + 'emotes.json').then(r => r.json()), fetch('/data/titles.json').then(r => r.json())]).then(([e, t]) => {
    ppEmData.emotes = e.emotes || []; ppEmData.defaults = e.defaults || []; ppEmData.titles = t.titles || [];
    ppEmData.eById = {}; ppEmData.tById = {};
    ppEmData.emotes.forEach(x => { ppEmData.eById[x.id] = x; });
    ppEmData.titles.forEach(x => { ppEmData.tById[x.id] = x; });
    ppEmData.ready = true;
    ppEmData.subs.forEach(f => { try { f(); } catch (err) { /* ohne */ } });
  }).catch(() => { /* ohne: Emotes/Titel bleiben unsichtbar */ });
})();
function usePpEmData() {
  const [, force] = useState(0);
  useEffect(() => { const cb = () => force(x => x + 1); ppEmData.subs.add(cb); return () => { ppEmData.subs.delete(cb); }; }, []);
  return ppEmData;
}
const ppEmLang = () => (document.documentElement.lang === 'de' ? 'de' : 'en');
const ppEmName = (e) => (e ? (ppEmLang() === 'de' ? (e.de || e.en) : e.en) : '');
const ppEmUrl = (id) => PP_EM_DIR + encodeURIComponent(id) + '.png';
const ppEmT = (s) => (window.ppT ? window.ppT(s) : s);

// ── Emote-Bild, genormt: jedes Emote steht in einem quadratischen Feld `box` (CSS-Pixel); der ganzzahlige Faktor wird so gewählt, dass die lange Seite
//    der Feldgröße möglichst nahe kommt (die Vorlagen haben 6 bis 56 Pixel Kantenlänge – ohne Normung wären sie sehr verschieden groß) ───────────────
function ppEmScale(e, box) {
  const m = Math.max(e.w, e.h);
  let k = Math.max(1, Math.round(box / m));
  if (k > 1 && k * m > box * 1.12) k--;
  return k;
}
function PpEmote({ id, box, className, title }) {
  usePpEmData();
  const e = ppEmData.eById[id], B = box || 64;
  if (!e) return <span className={'pp-emote-box pp-emote-missing ' + (className || '')} style={{ width: B, height: B }} />;
  const k = ppEmScale(e, B);
  return (
    <span className={'pp-emote-box ' + (className || '')} style={{ width: B, height: B }}>
      <img className="pp-emote" src={ppEmUrl(id)} alt={ppEmName(e)} title={title === undefined ? ppEmName(e) : title} draggable={false} data-pp-px="aus" style={{ width: e.w * k, height: e.h * k }} />
    </span>
  );
}
window.PpEmote = PpEmote; window.ppEmName = ppEmName; window.ppEmUrl = ppEmUrl;

// ── Titel: goldene, verzierte Schrift (Ornamente links/rechts), vor oder hinter dem Namen ────────────────────
function ppTitleInfo(id) {
  const t = id ? ppEmData.tById[id] : null;
  if (!t) return null;
  const l = ppEmLang() === 'de' ? t.de : t.en;
  return { text: l.t, pos: l.pos };
}
function PpTitle({ id, className }) {
  usePpEmData();
  const i = ppTitleInfo(id);
  if (!i) return null;
  return <span className={'pp-title ' + (className || '')} data-i18n-skip="1"><i className="pp-orn" aria-hidden="true" />{i.text}<i className="pp-orn pp-orn-r" aria-hidden="true" /></span>;
}
/** Name mit Titel: Englisch/Deutsch bestimmen je Titel, ob er davor („Archmage Anna“) oder dahinter („Anna the Smug“) steht. */
function PpTitled({ name, title }) {
  usePpEmData();
  const i = ppTitleInfo(title);
  if (!i) return <React.Fragment>{name}</React.Fragment>;
  // Nachgestellte Titel ohne Artikel/„of“ („Trainer of Heroes“, „Control Menace“) hängen mit Komma am Namen: „Anna, Control Menace“ – „Anna the Smug“ bleibt ohne
  const comma = i.pos === 'after' && !/^(the|of|der|die|das|des|von|vom|zur|zum)\s/i.test(i.text);
  return i.pos === 'before'
    ? <React.Fragment><PpTitle id={title} /> {name}</React.Fragment>
    : <React.Fragment>{name}{comma ? ',' : ''} <PpTitle id={title} /></React.Fragment>;
}
window.PpTitle = PpTitle; window.PpTitled = PpTitled; window.ppTitleInfo = ppTitleInfo;

// ═══════════════════════════════════════════════════════════════════════════
//  Duell: Emotes senden und anzeigen
// ═══════════════════════════════════════════════════════════════════════════
const PP_EM_COOLDOWN = 1200;       // dasselbe Emote erneut
const PP_EM_SWITCH = 150;          // anderes Emote überschreibt das aktive sofort
const PP_EM_SHOW_MS = 2700;
const ppEmEditable = (t) => !!(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable));
const ppEmMuted = () => { try { return localStorage.getItem('ppMuteEmotes') === '1'; } catch (e) { return false; } };

/** Läuft gerade ein Duell auf dem Bildschirm? (beide Portraits sichtbar) */
const ppEmBoardUp = () => document.querySelectorAll('.pp-portraet').length >= 2;

/** Portrait-Mitte der eigenen (unten) bzw. gegnerischen (oben) Seite; ohne Portraits: feste Ecken. */
function ppEmAnchor(mine) {
  const els = [...document.querySelectorAll('.pp-portraet')].map(el => el.getBoundingClientRect()).filter(r => r.width > 0);
  if (els.length >= 2) {
    els.sort((a, b) => a.top - b.top);
    const r = mine ? els[els.length - 1] : els[0];
    return mine ? { x: r.left + r.width / 2, y: r.top - 76 } : { x: r.left + r.width / 2, y: r.bottom + 76 };   // über dem eigenen / unter dem gegnerischen Portrait (nicht auf dem Namen)
  }
  return mine ? { x: 120, y: window.innerHeight - 260 } : { x: window.innerWidth - 260, y: 210 };
}

function PpEmoteLayer() {
  const { user } = useContext(AppContext);
  const data = usePpEmData();
  const [picker, setPicker] = useState(null);        // { x, y } während die mittlere Maustaste gehalten wird
  const [shown, setShown] = useState([]);            // [{ key, id, mine, x, y }]
  const [cool, setCool] = useState(false);
  // Spielzustand beobachten: Raum und eigener Platz (aus jedem Duell – Online, CPU, Kampagne …); Emotes gibt es nur, solange ein Brett auf dem Bildschirm ist
  const [gs, setGs] = useState(null);
  useEffect(() => {
    const on = (s) => { if (s && s.roomId) setGs({ roomId: s.roomId, myIndex: s.myIndex }); };
    socket.on('game_state', on);
    return () => { socket.off('game_state', on); };
  }, []);
  const roomId = gs && gs.roomId;
  const me = gs && gs.myIndex;
  const slots = useMemo(() => {
    const own = user && Array.isArray(user.emoteSlots) ? user.emoteSlots : data.defaults;
    return (own || []).filter(id => data.eById[id]).slice(0, 3);
  }, [user && user.emoteSlots, data.ready]);   // eslint-disable-line
  const lastRef = useRef(0), lastIdRef = useRef(null), hoverRef = useRef(-1), slotsRef = useRef(slots), roomRef = useRef(roomId);
  slotsRef.current = slots; roomRef.current = roomId;

  const send = useCallback((id) => {
    if (!id || !roomRef.current || !ppEmBoardUp()) return;   // nur mit Brett auf dem Bildschirm
    const now = Date.now();
    if (now - lastRef.current < (id === lastIdRef.current ? PP_EM_COOLDOWN : PP_EM_SWITCH)) return;
    lastRef.current = now; lastIdRef.current = id; setCool(true); setTimeout(() => setCool(false), PP_EM_COOLDOWN);
    try { socket.emit('emote', { roomId: roomRef.current, id }); } catch (e) { /* ohne */ }
  }, []);

  // Tasten 1–3 und mittlere Maustaste
  useEffect(() => {
    const onKey = (e) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || ppEmEditable(e.target)) return;
      if (e.key === 'Escape') { setPicker(null); return; }
      if (e.key >= '1' && e.key <= '3') { const id = slotsRef.current[+e.key - 1]; if (id) send(id); }
    };
    const onDown = (e) => {
      if (e.button !== 1 || ppEmEditable(e.target) || !ppEmBoardUp()) return;
      e.preventDefault();                       // kein Auto-Scroll-Kreis
      hoverRef.current = -1;
      setPicker({ x: e.clientX, y: e.clientY });
    };
    const onUp = (e) => {
      if (e.button !== 1) return;
      const i = hoverRef.current; hoverRef.current = -1;
      setPicker(p => { if (p && i >= 0) send(slotsRef.current[i]); return null; });
    };
    const noAux = (e) => { if (e.button === 1) e.preventDefault(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('mouseup', onUp, true);
    window.addEventListener('auxclick', noAux, true);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('mousedown', onDown, true); window.removeEventListener('mouseup', onUp, true); window.removeEventListener('auxclick', noAux, true); };
  }, [send]);

  // Empfangen
  useEffect(() => {
    const on = (m) => {
      if (!m || !data.eById[m.id]) return;
      const mine = m.seat === me;
      if (!mine && ppEmMuted()) return;
      const a = ppEmAnchor(mine), key = Date.now() + Math.random();
      setShown(list => list.filter(s => s.mine !== mine).concat({ key, id: m.id, mine, x: a.x, y: a.y }));   // je Seite nur ein Emote gleichzeitig
      try { if (window.playSFX) window.playSFX('ping', { volume: 0.35, dedupe: 120 }); } catch (e) { /* stumm */ }
      setTimeout(() => setShown(list => list.filter(s => s.key !== key)), PP_EM_SHOW_MS);
    };
    socket.on('emote', on);
    return () => { socket.off('emote', on); };
  }, [me, data.ready]);   // eslint-disable-line

  return (
    <div className="pp-emlayer" data-pp-px="aus">
      {shown.map(s => (
        <div key={s.key} className={'pp-emote-pop' + (s.mine ? ' pp-emote-mine' : ' pp-emote-opp')} style={{ left: s.x, top: s.y }}>
          <PpEmote id={s.id} box={96} title="" />
        </div>
      ))}
      {picker && (
        <div className="pp-empicker" style={{ left: Math.max(8, Math.min(window.innerWidth - 8 - 3 * 92, picker.x - 138)), top: Math.max(8, picker.y - 120) }} onContextMenu={(e) => e.preventDefault()}>
          {slots.map((id, i) => (
            <button key={id} className="pp-empick" onMouseEnter={() => { hoverRef.current = i; }} onMouseLeave={() => { if (hoverRef.current === i) hoverRef.current = -1; }}
                    onClick={() => { send(id); setPicker(null); }}>
              <span className="pp-empick-key">{i + 1}</span><PpEmote id={id} box={64} title="" />
            </button>
          ))}
          {!slots.length && <span className="pp-empick-none">{ppEmT('No emotes selected. Set them in your profile.')}</span>}
        </div>
      )}
      {cool && null}
    </div>
  );
}
window.PpEmoteLayer = PpEmoteLayer;

// ═══════════════════════════════════════════════════════════════════════════
//  Profil: Emote-Plätze (Tasten 1–3) und Titel
// ═══════════════════════════════════════════════════════════════════════════
function PpProfileCosmetics() {
  const { user, setUser, notify } = useContext(AppContext);
  const data = usePpEmData();
  const [st, setSt] = useState(null);               // Antwort von /api/profile/cosmetics
  const [pick, setPick] = useState(null);           // 'emote:<Platz>' | 'title'
  const [mute, setMute] = useState(ppEmMuted());
  useEffect(() => { let live = true; api('/profile/cosmetics').then(d => { if (live) setSt(d); }).catch(() => {}); return () => { live = false; }; }, []);   // eslint-disable-line
  if (!st || !data.ready) return null;
  const owned = new Set(st.emotes.owned), slots = st.emotes.slots.slice(), max = st.emotes.max;
  const saveSlots = async (next) => {
    try {
      const r = await api('/profile/emote-slots', { method: 'POST', body: JSON.stringify({ slots: next }) });
      setSt(s => ({ ...s, emotes: { ...s.emotes, slots: r.slots } })); setUser(u => ({ ...u, emoteSlots: r.slots }));
    } catch (e) { notify(e.message, 'error'); }
  };
  const chooseEmote = (slot, id) => {
    const next = slots.slice();
    while (next.length < max) next.push(null);
    const at = next.indexOf(id);
    if (at >= 0 && at !== slot) { next[at] = next[slot]; }           // schon auf einem anderen Platz: tauschen
    next[slot] = id;
    saveSlots(next.filter(Boolean));
    setPick(null);
  };
  const clearSlot = (slot) => { const next = slots.slice(); next.splice(slot, 1); saveSlots(next); setPick(null); };
  const chooseTitle = async (id) => {
    try {
      const r = await api('/profile/title', { method: 'POST', body: JSON.stringify({ id }) });
      setSt(s => ({ ...s, titles: { ...s.titles, equipped: r.title } })); setUser(u => ({ ...u, title: r.title }));
    } catch (e) { notify(e.message, 'error'); }
    setPick(null);
  };
  const setMuteSave = (v) => { setMute(v); try { localStorage.setItem('ppMuteEmotes', v ? '1' : '0'); } catch (e) { /* ohne */ } };
  const slotIdx = pick && pick.startsWith('emote:') ? +pick.slice(6) : -1;
  return (
    <div className="pp-cosm">
      <div className="profile-section-label">EMOTES</div>
      <div className="pp-cosm-hint">Press 1–3 in a duel, or hold the middle mouse button.</div>
      <div className="pp-cosm-slots">
        {Array.from({ length: max }).map((_, i) => (
          <button key={i} className="pp-cosm-slot" onClick={() => setPick('emote:' + i)} title={ppEmT('Change emote')}>
            <span className="pp-cosm-key">{i + 1}</span>
            {slots[i] ? <PpEmote id={slots[i]} box={64} title="" /> : <span className="pp-cosm-plus">+</span>}
          </button>
        ))}
      </div>
      <div className="pp-cosm-count">{ppEmT('Owned: {0}/{1}').replace('{0}', owned.size).replace('{1}', data.emotes.length)}</div>
      <label className="pp-cosm-mute"><input type="checkbox" checked={mute} onChange={e => setMuteSave(e.target.checked)} /> {ppEmT('Hide opponent emotes')}</label>

      <div className="profile-section-label" style={{ marginTop: 14 }}>TITLE</div>
      <div className="pp-cosm-title">
        <span className="pp-cosm-name"><PpTitled name={user.username} title={st.titles.equipped} /></span>
        <button className="btn" style={{ padding: '4px 12px', fontSize: 11 }} onClick={() => setPick('title')}>CHANGE TITLE</button>
      </div>
      <div className="pp-cosm-count">{ppEmT('Owned: {0}/{1}').replace('{0}', st.titles.owned.length).replace('{1}', data.titles.length)}</div>

      {slotIdx >= 0 && (
        <div className="pp-cosm-modal" onClick={() => setPick(null)}>
          <div className="pp-cosm-box" onClick={e => e.stopPropagation()}>
            <h3>{ppEmT('Choose an emote for key {0}').replace('{0}', slotIdx + 1)}</h3>
            <div className="pp-cosm-grid">
              {data.emotes.map(e => {
                const has = owned.has(e.id), here = slots[slotIdx] === e.id, other = slots.includes(e.id) && !here;
                return (
                  <button key={e.id} className={'pp-cosm-cell' + (has ? '' : ' pp-cosm-off') + (here ? ' pp-cosm-here' : '')} disabled={!has} onClick={() => chooseEmote(slotIdx, e.id)}
                          title={has ? ppEmName(e) : ppEmT('Win it on the Wheel')}>
                    <PpEmote id={e.id} box={64} title="" />
                    <span>{ppEmName(e)}</span>
                    {other && <b className="pp-cosm-badge">{slots.indexOf(e.id) + 1}</b>}
                  </button>
                );
              })}
            </div>
            <div className="pp-cosm-foot">
              {slots[slotIdx] && <button className="btn" onClick={() => clearSlot(slotIdx)}>EMPTY SLOT</button>}
              <button className="btn" onClick={() => setPick(null)}>CLOSE</button>
            </div>
          </div>
        </div>
      )}
      {pick === 'title' && (
        <div className="pp-cosm-modal" onClick={() => setPick(null)}>
          <div className="pp-cosm-box" onClick={e => e.stopPropagation()}>
            <h3>Choose a title</h3>
            <div className="pp-cosm-titles">
              <button className={'pp-cosm-trow' + (!st.titles.equipped ? ' pp-cosm-here' : '')} onClick={() => chooseTitle(null)}>{user.username}</button>
              {data.titles.filter(t => st.titles.owned.includes(t.id)).map(t => (
                <button key={t.id} className={'pp-cosm-trow' + (st.titles.equipped === t.id ? ' pp-cosm-here' : '')} onClick={() => chooseTitle(t.id)}>
                  <PpTitled name={user.username} title={t.id} />
                </button>
              ))}
              {!st.titles.owned.length && <div className="pp-cosm-hint">{ppEmT('You own no titles yet. Win them on the Wheel in the Shop.')}</div>}
            </div>
            <div className="pp-cosm-foot"><button className="btn" onClick={() => setPick(null)}>CLOSE</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
window.PpProfileCosmetics = PpProfileCosmetics;
