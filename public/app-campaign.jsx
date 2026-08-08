// ═══════════════════════════════════════════════════════════════════
//  PIXEL PARTIES — KAMPAGNE (Story-Modus)
// ═══════════════════════════════════════════════════════════════════
//  Drei Betriebsarten in einem Bildschirm:
//    ERKUNDUNG  Ort mit Hintergrund, anklickbaren Figuren/Objekten und
//               einer Ortsliste; die Uhr läuft beim Wechseln weiter.
//    CUTSCENE   Abgespielte Szene: Bühne + Dialogbox + Auswahlen.
//    DUELL      Die normale Battle-Engine, aber mit Kampagnen-Deck,
//               Kampagnen-Gegner und Story-Folgen statt SC-Belohnung.
//
//  ALLES, was Al zum Schreiben braucht, liegt in public/campaign/:
//    scenes/*.js    Welt- und Szenendateien (werden hier ausgewertet)
//    backgrounds/   320x180-Hintergründe
//    sprites/       Ganzkörperfiguren
//    avatars/       Portraits für die Dialogbox
//    decks/         Decks im normalen Deck-Textformat
//  Eine neue Datei im scenes-Ordner ist sofort aktiv — der Server
//  liefert das Verzeichnis, hier wird jede Datei einzeln ausgewertet.
//  F9 lädt die Dateien im laufenden Spiel neu, F10 öffnet die
//  Entwicklerhilfen.
//
//  KOORDINATEN sind IMMER relativ: x/y in Prozent des 320x180-Felds,
//  Größen in Feld-Pixeln. Nichts hier rechnet mit Bildschirmpixeln,
//  damit jede Auflösung dasselbe Bild ergibt.
// ═══════════════════════════════════════════════════════════════════

const { useState, useEffect, useRef, useCallback, useMemo, useContext, useLayoutEffect } = React;

// Maße des Bildfelds. Alle Hintergründe sind 320x180; daraus leitet
// sich die Pixelgröße der ganzen Bühne ab.
const CMP_W = 320;
const CMP_H = 180;

// ═══════════════════════════════════════════
//  ZEIT
// ═══════════════════════════════════════════
// Die Uhr zählt Minuten seit Mitternacht plus einen Tageszähler. Es
// gibt bewusst KEINEN Echtzeit-Ticker: Zeit vergeht nur durch
// Handlungen (Wege, Szenen, ausdrückliche Zeitschritte).

/** '08:30' | 510 | undefined -> Minuten seit Mitternacht. */
function cmpTime(v, fallback) {
  if (v == null) return fallback || 0;
  if (typeof v === 'number') return Math.max(0, Math.round(v));
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(v).trim());
  if (!m) return fallback || 0;
  return (parseInt(m[1], 10) % 24) * 60 + parseInt(m[2], 10);
}

function cmpFmtTime(min) {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}

/** Tageszeit-Schublade — Szenen können darauf bedingen. */
function cmpDaypart(min) {
  const m = ((min % 1440) + 1440) % 1440;
  if (m < 5 * 60) return 'night';
  if (m < 11 * 60) return 'morning';
  if (m < 14 * 60) return 'noon';
  if (m < 18 * 60) return 'afternoon';
  if (m < 22 * 60) return 'evening';
  return 'night';
}

// ═══════════════════════════════════════════
//  KLÄNGE
// ═══════════════════════════════════════════
// Jede Handlung im Story-Modus soll hörbar sein — Anklicken einer
// Figur, ein Ortswechsel, gefundene Gegenstände, Münzen, eine
// getroffene Entscheidung. Alles läuft über diesen einen Aufruf,
// damit die Zuordnung an EINER Stelle steht und sich später zentral
// austauschen lässt.
const CMP_SFX = {
  npc:       'ui_prompt_open',   // Figur angeklickt
  hotspot:   'ui_click',         // Gegenstand/Klickfläche angeklickt
  travel:    'turn_start',       // Ortswechsel
  advance:   'ui_click',         // Textzeile weiter
  reveal:    'ping',             // Zeile sofort ausschreiben
  choiceIn:  'ui_prompt_open',   // Auswahl erscheint
  choicePick:'ui_click',         // Auswahl getroffen
  open:      'ui_prompt_open',   // Fenster auf
  close:     'ui_cancel',        // Fenster zu
  item:      'reveal',           // Gegenstand erhalten
  itemLoss:  'ui_cancel',        // Gegenstand abgegeben
  coins:     'gold_gain',        // Münzen erhalten
  spend:     'shop_purchase',    // Münzen ausgegeben
  learn:     'ping',             // neuer Ort bekannt
  deckAdd:   'placement',        // Karte ins Deck
  deckDrop:  'discard',          // Karte aus dem Deck
  deckHero:  'summon',           // Held gesetzt
  deckSave:  'shop_purchase',    // Deck gespeichert
  shake:     'heavy_impact',
  flash:     'laser',
  gameOver:  'defeat',
  card:      'victory',
  duelStart: 'match_start',
  blocked:   'ui_error',
  anteOpen:  'ui_prompt_open',   // Ante-Auswahl erscheint
  anteWin:   'ascension',        // du nimmst eine Karte
  anteLose:  'hero_death',       // dir wird eine genommen
};

// Wartezeiten der Dialogsteuerung (siehe `advance` weiter unten).
// Deutlich knapper als beim ersten Anlauf: die Sperren mussten damals
// eine ECHTE Lücke im Renderzyklus zudecken (siehe useLayoutEffect
// weiter unten). Seit die geschlossen ist, sind sie nur noch ein
// Riegel gegen Doppelklicks — und dürfen entsprechend kurz sein.
const CMP_MIN_VISIBLE = 120;   // ms, bevor eine Zeile überhaupt reagiert
const CMP_AFTER_DONE  = 160;   // ms Grundsperre nach dem Fertigtippen
const CMP_HOLD_PER_CH = 2;     // ms je Zeichen obendrauf
const CMP_HOLD_MAX    = 360;   // ms Obergrenze dieser Sperre
const CMP_CHOICE_LOCK = 260;   // ms, bevor eine Auswahl anklickbar wird

/** Wie lange muss eine FERTIG getippte Zeile mindestens stehen? Lange
 *  Zeilen brauchen mehr, weil man sie nach dem Ausschreiben erst noch
 *  liest — eine feste Sperre reicht dort nicht. */
function cmpHoldTime(len) {
  return Math.min(CMP_HOLD_MAX, CMP_AFTER_DONE + CMP_HOLD_PER_CH * (len || 0));
}

/** Was macht ein Klick/Tastendruck gerade? Bewusst als reine Funktion,
 *  damit sich die Sperren ohne Browser durchrechnen lassen.
 *    'ignore'   — zu früh, Eingabe verfällt
 *    'complete' — Zeile sofort ausschreiben
 *    'advance'  — weiterblättern
 *  `doneAt === 0` heißt "tippt noch". */
function cmpAdvanceDecision(now, shownAt, doneAt, len) {
  if (now - shownAt < CMP_MIN_VISIBLE) return 'ignore';
  if (!doneAt) return 'complete';
  if (now - doneAt < cmpHoldTime(len)) return 'ignore';
  return 'advance';
}

function cmpSfx(key, opts) {
  const name = CMP_SFX[key] || key;
  if (name && window.playSFX) window.playSFX(name, opts || {});
}

// ═══════════════════════════════════════════
//  BILDER
// ═══════════════════════════════════════════
// Natürliche Maße werden einmal gemessen und gemerkt: daraus ergibt
// sich, wie groß eine Figur im Feld ist (Dateiauflösung geteilt durch
// `spriteUnit`), und damit die pixelgenaue Darstellung.
const cmpImgSizes = new Map();

function cmpMeasureImage(url) {
  if (cmpImgSizes.has(url)) return Promise.resolve(cmpImgSizes.get(url));
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const size = { w: img.naturalWidth || 1, h: img.naturalHeight || 1 };
      cmpImgSizes.set(url, size);
      resolve(size);
    };
    img.onerror = () => { const size = { w: 16, h: 24, missing: true }; cmpImgSizes.set(url, size); resolve(size); };
    img.src = url;
  });
}

function cmpBgUrl(name) {
  if (!name) return null;
  if (String(name).startsWith('/')) return name;
  return '/campaign/backgrounds/' + encodeURIComponent(String(name).replace(/\.png$/i, '')) + '.png';
}
function cmpSpriteUrl(name) {
  if (!name) return null;
  if (String(name).startsWith('/')) return name;
  return '/campaign/sprites/' + encodeURIComponent(String(name).replace(/\.png$/i, '')) + '.png';
}
function cmpAvatarUrl(name) {
  if (!name) return null;
  if (String(name).startsWith('/')) return name;
  return '/campaign/avatars/' + encodeURIComponent(String(name).replace(/\.png$/i, '')) + '.png';
}

// ═══════════════════════════════════════════
//  STORY LADEN
// ═══════════════════════════════════════════
// Jede Datei unter public/campaign/scenes/ wird als Funktionskörper
// ausgewertet und bekommt zwei Bausteine gereicht:
//    world({...})        einmal — Orte, Start, Ereignisse
//    scene('id', {...})  beliebig oft
// Zusätzlich `helpers` mit kleinen Hilfsfunktionen für Bedingungen.
//
// Bewusst `new Function` statt <script>: so lässt sich die Story im
// laufenden Spiel neu laden (F9), ohne die Seite neu aufzubauen, und
// Fehler in einer Datei reißen nicht die ganze Kampagne mit.

async function cmpLoadStory() {
  const manifest = await api('/campaign/manifest');
  const story = {
    world: null,
    scenes: {},
    errors: [],
    assets: {
      backgrounds: new Set((manifest.backgrounds || []).map(f => f.replace(/\.[a-z]+$/i, ''))),
      sprites: new Set((manifest.sprites || []).map(f => f.replace(/\.[a-z]+$/i, ''))),
      avatars: new Set((manifest.avatars || []).map(f => f.replace(/\.[a-z]+$/i, ''))),
      decks: new Set(manifest.decks || []),
    },
  };

  // Orte, Figuren und Ereignisse aus MEHREREN Dateien werden
  // zusammengelegt — die Welt muss also nicht in einer Datei stehen.
  // Wichtig: erst die alten Werte sichern, dann mischen. (Object.assign
  // allein würde die Ereignisliste der neuen Datei übernehmen UND
  // danach nochmal anhängen.)
  const defineWorld = (def) => {
    const prev = story.world || {};
    const d = def || {};
    const merged = Object.assign({}, prev, d);
    merged.locations = Object.assign({}, prev.locations || {}, d.locations || {});
    merged.cast = Object.assign({}, prev.cast || {}, d.cast || {});
    merged.events = (prev.events || []).concat(d.events || []);
    story.world = merged;
  };
  const defineScene = (id, def) => {
    if (!id || !def) return;
    if (story.scenes[id]) story.errors.push('Scene "' + id + '" is defined twice.');
    story.scenes[id] = Object.assign({ id }, def);
  };

  const helpers = {
    time: cmpTime,
    fmtTime: cmpFmtTime,
    daypart: cmpDaypart,
    flag: (name) => (s) => !!s.flags[name],
    noFlag: (name) => (s) => !s.flags[name],
    between: (a, b) => (s) => s.minutes >= cmpTime(a) && s.minutes < cmpTime(b),
    day: (n) => (s) => s.day === n,
    item: (name, n) => (s) => (s.items[name] || 0) >= (n || 1),
  };

  for (const file of (manifest.scenes || [])) {
    let code = '';
    try {
      const res = await fetch('/campaign/scenes/' + encodeURIComponent(file) + '?t=' + Date.now());
      if (!res.ok) throw new Error('HTTP ' + res.status);
      code = await res.text();
    } catch (err) {
      story.errors.push(file + ': could not be loaded (' + err.message + ')');
      continue;
    }
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function('world', 'scene', 'helpers', '"use strict";\n' + code + '\n//# sourceURL=campaign/' + file);
      fn(defineWorld, defineScene, helpers);
    } catch (err) {
      story.errors.push(file + ': ' + (err && err.message ? err.message : String(err)));
      console.error('[Kampagne] Fehler in', file, err);
    }
  }

  if (!story.world) story.errors.push('No world file — one file in scenes/ must call world({...}).');
  else {
    story.world.locations = story.world.locations || {};
    story.world.events = story.world.events || [];
    story.world.cast = story.world.cast || {};
    story.world.assets = Object.assign({ spriteUnit: 10, avatarUnit: 10 }, story.world.assets || {});
    // Verweise prüfen — lieber eine klare Meldung als ein leeres Bild.
    for (const [id, loc] of Object.entries(story.world.locations)) {
      if (loc.background && !story.assets.backgrounds.has(String(loc.background).replace(/\.png$/i, ''))) {
        story.errors.push('Place "' + id + '": background "' + loc.background + '" is missing from backgrounds/.');
      }
    }
    for (const [id, sc] of Object.entries(story.scenes)) {
      for (const st of (sc.steps || [])) {
        if (st && st.bg && !story.assets.backgrounds.has(String(st.bg).replace(/\.png$/i, ''))) {
          story.errors.push('Scene "' + id + '": background "' + st.bg + '" is missing.');
        }
        if (st && st.duel && st.opponent && !story.assets.decks.has(st.opponent)) {
          story.errors.push('Scene "' + id + '": campaign deck "' + st.opponent + '" is missing from decks/.');
        }
      }
    }
  }
  return story;
}

// ═══════════════════════════════════════════
//  SPEICHERSTAND
// ═══════════════════════════════════════════

function cmpNewState(world) {
  const start = (world && world.start) || {};
  const known = [];
  for (const [id, loc] of Object.entries((world && world.locations) || {})) {
    if (loc.known) known.push(id);
  }
  if (start.location && known.indexOf(start.location) < 0) known.push(start.location);
  return {
    v: 1,
    day: start.day || 1,
    minutes: cmpTime(start.time, 8 * 60),
    location: start.location || known[0] || null,
    flags: {},
    vars: {},
    items: {},
    coins: start.coins || 0,
    known,
    locked: {},          // Ort -> true, wenn ausdrücklich gesperrt
    visited: {},
    scenesDone: {},
    eventsDone: {},
    duels: {},           // duelId -> 'won' | 'lost'
    collection: {},      // Kartenname -> Anzahl im Besitz
    deck: null,          // { heroes, mainDeck, potionDeck, sideDeck }
  };
}

/** Fingerabdruck eines Decks (Helden + Karten, reihenfolgeunabhängig).
 *  Steht im Speicherstand, damit auffällt, wenn die Startdeck-DATEI
 *  sich geändert hat — der Slug allein verrät das nicht. */
function cmpDeckSignature(deck) {
  if (!deck) return '';
  const parts = [];
  for (const h of (deck.heroes || [])) parts.push([h && h.hero, h && h.ability1, h && h.ability2].join('|'));
  parts.push([...(deck.mainDeck || [])].sort().join(','));
  parts.push([...(deck.potionDeck || [])].sort().join(','));
  const str = parts.join('#');
  let hash = 5381;
  for (let i = 0; i < str.length; i++) hash = ((hash * 33) ^ str.charCodeAt(i)) >>> 0;
  return hash.toString(16);
}

/** Gleicht Kampagnen-Deck und Sammlung mit public/campaign/decks/<slug>.txt ab.
 *
 *  Beim ERSTEN Start wird beides daraus aufgebaut. Danach passiert
 *  normalerweise nichts — bis die Datei sich ändert: dann stimmt der
 *  Fingerabdruck nicht mehr und Deck sowie Sammlung werden neu
 *  aufgesetzt. Ohne diese Prüfung behält ein bestehender Speicherstand
 *  für immer das Deck, das beim allerersten Start geladen wurde
 *  (genau der Fall "ich habe immer noch Heal Burn").
 *
 *  ACHTUNG: Der Neuaufbau verwirft erspielte Karten und einen selbst
 *  gebauten Deckaufbau. Das ist in der Entwicklung gewollt; wenn die
 *  Kampagne fertig ist, ändert sich die Startdeck-Datei nicht mehr. */
async function cmpSyncStartDeck(state, world, onRebuild) {
  const slug = (world.start && world.start.deck) || null;
  if (!slug) return state;
  let deck = null;
  try {
    deck = (await api('/campaign/deck/' + encodeURIComponent(slug))).deck;
  } catch (err) {
    console.error('[Kampagne] Startdeck konnte nicht geladen werden:', err.message);
    return state;
  }
  const sig = cmpDeckSignature(deck);
  if (state.deck && state.startDeckSig === sig) return state;
  const wasRebuild = !!state.deck;
  state.deck = {
    heroes: deck.heroes || [],
    mainDeck: deck.mainDeck || [],
    potionDeck: deck.potionDeck || [],
    sideDeck: [],
  };
  const coll = {};
  for (const n of (deck.mainDeck || [])) coll[n] = (coll[n] || 0) + 1;
  for (const n of (deck.potionDeck || [])) coll[n] = (coll[n] || 0) + 1;
  for (const h of (deck.heroes || [])) if (h && h.hero) coll[h.hero] = (coll[h.hero] || 0) + 1;
  state.collection = coll;
  state.startDeckSig = sig;
  if (wasRebuild && onRebuild) onRebuild(deck.name || slug);
  return state;
}

let cmpSaveTimer = null;
function cmpSave(state) {
  clearTimeout(cmpSaveTimer);
  cmpSaveTimer = setTimeout(() => {
    api('/campaign/state', { method: 'PUT', body: JSON.stringify({ state }) })
      .catch(err => console.error('[Kampagne] Speichern fehlgeschlagen:', err.message));
  }, 250);
}

/** Farbe eines Kartennamens nach Typ. Bewusst über `window.typeColor`
 *  aus app-shared.jsx — das ist die Palette, die auch Tooltips, Deck
 *  Builder und Kampffeld benutzen (Hero lila, Ascended Hero dunkler,
 *  Ability blau, Attack/Spell rot, Creature grün, Potion braun,
 *  Artifact gold). Wird sie dort je nachgestellt, zieht die Kampagne
 *  automatisch mit. Einzige Sonderbehandlung: der Mischtyp
 *  "Creature/Token" kennt dort keinen Eintrag und liefe sonst auf Grau. */
function cmpTypeColor(name) {
  const c = (window.CARDS_BY_NAME || {})[name];
  if (!c || !window.typeColor) return undefined;
  return window.typeColor(c.cardType === 'Creature/Token' ? 'Creature' : c.cardType);
}

/** Ante verrechnen. Sieg: die Karte wandert in die Sammlung.
 *  Niederlage: sie verschwindet DAUERHAFT — aus der Sammlung und aus
 *  dem Deck, das damit unvollständig ist und vor dem nächsten Duell
 *  neu gebaut werden muss. Bewusst eine reine Funktion, damit sich die
 *  Wirkung ohne Browser prüfen lässt. */
function cmpApplyAnte(s, card, youWon) {
  if (!card) return s;
  if (youWon) {
    s.collection[card] = (s.collection[card] || 0) + 1;
    return s;
  }
  if (s.collection[card]) {
    s.collection[card] -= 1;
    if (s.collection[card] <= 0) delete s.collection[card];
  }
  const d = s.deck || {};
  for (const list of ['mainDeck', 'potionDeck', 'sideDeck']) {
    const i = (d[list] || []).indexOf(card);
    if (i >= 0) { d[list].splice(i, 1); break; }
  }
  return s;
}

// ═══════════════════════════════════════════
//  BEDINGUNGEN
// ═══════════════════════════════════════════
// `when` darf sein:
//   Funktion    (s) => boolean
//   Objekt      { flag:'x', notFlag:'y', item:'z', day:2,
//                 from:'08:00', to:'12:00', daypart:'evening',
//                 duelWon:'ethan_1', visited:'dock', var:{name:wert} }
//   Array       alle Bedingungen müssen zutreffen
function cmpCond(state, when) {
  if (when == null) return true;
  if (typeof when === 'function') { try { return !!when(state); } catch (e) { console.error('[Kampagne] Bedingung warf:', e); return false; } }
  if (Array.isArray(when)) return when.every(w => cmpCond(state, w));
  if (typeof when !== 'object') return !!when;
  if (when.flag && !state.flags[when.flag]) return false;
  if (when.notFlag && state.flags[when.notFlag]) return false;
  if (when.item && (state.items[when.item] || 0) < 1) return false;
  if (when.notItem && (state.items[when.notItem] || 0) > 0) return false;
  if (when.day != null && state.day !== when.day) return false;
  if (when.dayMin != null && state.day < when.dayMin) return false;
  if (when.from != null && state.minutes < cmpTime(when.from)) return false;
  if (when.to != null && state.minutes >= cmpTime(when.to)) return false;
  if (when.daypart && cmpDaypart(state.minutes) !== when.daypart) return false;
  if (when.duelWon && state.duels[when.duelWon] !== 'won') return false;
  if (when.duelLost && state.duels[when.duelLost] !== 'lost') return false;
  if (when.sceneDone && !state.scenesDone[when.sceneDone]) return false;
  if (when.notSceneDone && state.scenesDone[when.notSceneDone]) return false;
  if (when.visited && !state.visited[when.visited]) return false;
  if (when.coinsMin != null && (state.coins || 0) < when.coinsMin) return false;
  if (when.var) {
    for (const [k, v] of Object.entries(when.var)) if (state.vars[k] !== v) return false;
  }
  return true;
}

// ═══════════════════════════════════════════
//  BÜHNE — Skalierung
// ═══════════════════════════════════════════
// Pixelart verträgt nur GANZZAHLIGE Vergrößerung: bei 4,27-facher
// Skalierung wären manche Quellpixel 4 und andere 5 Bildschirmpixel
// breit, und genau die gleichmäßige Pixelgröße ist das, was den Stil
// trägt. Deshalb wird auf die nächste ganze Stufe AUFGERUNDET (das
// Bild füllt den Schirm und wird am Rand beschnitten) und die Bühne
// UNTEN verankert — beschnitten wird also oben, wo Himmel/Decke steht,
// nie unten, wo die Figuren stehen. Nur wenn das Aufrunden mehr als
// ein Drittel des Bildes kosten würde, wird abgerundet und der Rest
// dunkel gerahmt.
function cmpComputeScale(vw, vh) {
  const fit = Math.min(vw / CMP_W, vh / CMP_H);
  const up = Math.max(1, Math.ceil(fit - 0.002));
  const down = Math.max(1, Math.floor(fit + 0.002));
  const cropX = 1 - Math.min(1, vw / (CMP_W * up));
  const cropY = 1 - Math.min(1, vh / (CMP_H * up));
  const scale = (Math.max(cropX, cropY) > 0.34 && down < up) ? down : up;
  return scale;
}

function useCmpStageMetrics() {
  const [m, setM] = useState(() => ({ scale: 1, w: CMP_W, h: CMP_H }));
  useLayoutEffect(() => {
    const update = () => {
      const vw = window.innerWidth || CMP_W;
      const vh = window.innerHeight || CMP_H;
      const scale = cmpComputeScale(vw, vh);
      setM(prev => (prev.scale === scale ? prev : { scale, w: CMP_W * scale, h: CMP_H * scale }));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return m;
}

// ═══════════════════════════════════════════
//  BÜHNE — Darstellung
// ═══════════════════════════════════════════
// `stage` ist reine Anzeige-Information:
//   { bg, actors: [{key, sprite, x, y, h, flip, dim, entering, exiting, label, clickable}] }
// x = waagerechte MITTE in % der Feldbreite
// y = FUSSPUNKT in % der Feldhöhe (100 = untere Bildkante)
// h = Höhe in Feld-Pixeln (Standard: Dateihöhe / spriteUnit)
function CampaignStage({ stage, metrics, hotspots, onHotspot, showHotspots, fx }) {
  const { scale, w, h } = metrics;
  const bgUrl = cmpBgUrl(stage.bg);
  const [prevBg, setPrevBg] = useState(null);
  const lastBg = useRef(bgUrl);

  // Weicher Wechsel: das alte Bild bleibt kurz darunter liegen und
  // blendet aus, während das neue darüber einblendet.
  useEffect(() => {
    if (lastBg.current !== bgUrl) {
      const old = lastBg.current;
      lastBg.current = bgUrl;
      setPrevBg(old);
      const t = setTimeout(() => setPrevBg(null), 450);
      return () => clearTimeout(t);
    }
  }, [bgUrl]);

  return (
    <div className={'cmp-stage-clip' + (fx ? ' cmp-fx-' + fx : '')}>
      <div className="cmp-stage" style={{ width: w, height: h }}>
        {prevBg && <img className="cmp-bg cmp-bg-old" src={prevBg} alt="" draggable={false} />}
        {bgUrl && <img className="cmp-bg" key={bgUrl} src={bgUrl} alt="" draggable={false} />}

        {/* Figuren */}
        {(stage.actors || []).map(a => {
          const url = cmpSpriteUrl(a.sprite);
          const size = cmpImgSizes.get(url) || { w: 16, h: 24 };
          const hWorld = a.h || Math.max(1, Math.round(size.h / (a.unit || 10)));
          const wWorld = Math.max(1, Math.round(hWorld * (size.w / size.h)));
          const px = wWorld * scale, py = hWorld * scale;
          return (
            <div
              key={a.key}
              className={'cmp-actor'
                + (a.entering ? ' cmp-actor-in' : '')
                + (a.exiting ? ' cmp-actor-out' : '')
                + (a.dim ? ' cmp-actor-dim' : '')
                + (a.clickable ? ' cmp-actor-click' : '')}
              style={{
                left: 'calc(' + (a.x != null ? a.x : 50) + '% - ' + (px / 2) + 'px)',
                top: 'calc(' + (a.y != null ? a.y : 100) + '% - ' + py + 'px)',
                width: px, height: py,
                transition: a.ms ? ('left ' + a.ms + 'ms linear') : undefined,
                zIndex: 10 + Math.round(a.y != null ? a.y : 100),
              }}
              onClick={a.clickable && onHotspot ? (e) => { e.stopPropagation(); onHotspot(a.hotspot); } : undefined}
            >
              <img src={url} alt={a.label || ''} draggable={false}
                style={{ width: '100%', height: '100%', transform: a.flip ? 'scaleX(-1)' : undefined }} />
              {a.clickable && a.label && <span className="cmp-actor-label">{a.label}</span>}
            </div>
          );
        })}

        {/* Anklickbare Flächen ohne eigenes Bild (Türen, Truhen, …) */}
        {(hotspots || []).map(hs => (
          <button
            key={hs.id}
            className={'cmp-hotspot' + (showHotspots ? ' cmp-hotspot-show' : '')}
            style={{ left: hs.x + '%', top: hs.y + '%', width: (hs.w || 10) + '%', height: (hs.h || 10) + '%' }}
            onClick={(e) => { e.stopPropagation(); onHotspot && onHotspot(hs); }}
            title={hs.label || ''}
          >
            {hs.label && <span className="cmp-hotspot-label">{hs.label}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  UHR
// ═══════════════════════════════════════════
function CampaignClock({ day, minutes, bump }) {
  return (
    <div className={'cmp-clock' + (bump ? ' cmp-clock-bump' : '')}>
      <div className="cmp-clock-day">DAY {day}</div>
      <div className="cmp-clock-time">{cmpFmtTime(minutes)}</div>
      <div className="cmp-clock-part">{({
        morning: 'Morning', noon: 'Noon', afternoon: 'Afternoon', evening: 'Evening', night: 'Night',
      })[cmpDaypart(minutes)]}</div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  DIALOGBOX
// ═══════════════════════════════════════════
// Ausbau der vorhandenen Textbox: gleiche Bildsprache und derselbe
// Inline-Auszeichnungs-Parser (**fett**, *kursiv*, {purple:…}), aber
// mit Portrait links ODER rechts, Erzählerzeilen ohne Sprecher,
// Auswahlen, Verlauf und Zeilenweiser Steuerung durch den Szenen-
// Interpreter statt einer festen Seitenliste.
function CampaignDialogue({ line, onAdvance, metrics, unit, onLog }) {
  const [chars, setChars] = useState(0);
  const [pSize, setPSize] = useState(null);
  const [done, setDone] = useState(false);
  const parsedRef = useRef({ segments: [], plainText: '' });
  const timerRef = useRef(null);
  const heldRef = useRef(false);      // Leertaste gerade gedrückt gehalten?
  const shownAtRef = useRef(0);       // seit wann steht diese Zeile?
  const doneAtRef = useRef(0);        // wann war die Zeile fertig getippt? (0 = tippt noch)
  const advancedRef = useRef(null);   // welche Zeile wurde bereits weitergeblättert?

  const parse = window.parseInlineMarkdown;
  const render = window.renderMarkdownSlice;

  // Portraits pixelgenau: die Datei ist eine `unit`-fach vergrößerte
  // Pixelart. Wir rechnen auf die native Größe zurück und wählen den
  // größten GANZZAHLIGEN Faktor, der noch in die Box passt — sonst
  // wären manche Pixel breiter als andere.
  useEffect(() => {
    if (!line || !line.portrait) { setPSize(null); return; }
    let alive = true;
    cmpMeasureImage(cmpAvatarUrl(line.portrait)).then(sz => { if (alive) setPSize(sz); });
    return () => { alive = false; };
  }, [line && line.portrait]);

  // ── WARUM useLayoutEffect UND NICHT useEffect ──
  // Hier lag der Grund, warum einzelne Textboxen "sofort geskippt"
  // wurden, und zwar reproduzierbar an derselben Stelle:
  // `useEffect` läuft ERST NACH dem Zeichnen, der neue Klick-Handler
  // hängt aber schon ab dem Commit am DOM. In genau diesem Fenster
  // zeigte die Box bereits die NEUE Zeile, während `done`,
  // `shownAtRef` und `doneAtRef` noch von der VORIGEN stammten — alle
  // Sperren waren also längst abgelaufen, und der nächste Klick
  // blätterte die frisch erschienene Zeile ungelesen weg.
  // `useLayoutEffect` läuft noch im Commit, vor dem Zeichnen: zwischen
  // "Handler hängt" und "Zähler zurückgesetzt" kann kein Klick mehr
  // dazwischenrutschen. Nebenbei verschwindet damit auch das kurze
  // Aufblitzen des alten Textes im ersten Bild.
  useLayoutEffect(() => {
    clearInterval(timerRef.current);
    doneAtRef.current = 0;            // 0 = "tippt noch"
    advancedRef.current = null;
    if (!line) { setChars(0); setDone(false); return; }
    const parsed = parse ? parse(line.text || '') : { segments: [{ text: line.text || '' }], plainText: line.text || '' };
    parsedRef.current = parsed;
    setChars(0); setDone(false);
    shownAtRef.current = performance.now();
    const speed = line.speed || 22;
    let i = 0;
    const len = parsed.plainText.length;
    if (!len) { setDone(true); doneAtRef.current = performance.now(); return; }
    timerRef.current = setInterval(() => {
      i++;
      if (i >= len) { setChars(len); setDone(true); doneAtRef.current = performance.now(); clearInterval(timerRef.current); }
      else setChars(i);
    }, speed);
    return () => clearInterval(timerRef.current);
  }, [line, parse]);

  // ── SPERREN GEGEN VERSEHENTLICHES ÜBERSPRINGEN ──
  // Drei Riegel, alle für Klick UND Taste:
  //   1. Ein kurzer Moment, in dem eine frisch erschienene Zeile gar
  //      nicht reagiert — fängt den Klick ab, der eine Zeile zu spät
  //      landet.
  //   2. Nach dem Fertigtippen eine längenabhängige Sperre
  //      (cmpHoldTime): kurze Zeilen ~0,17 s, lange bis 0,36 s.
  //   3. Ein Riegel je Zeilenobjekt, damit dieselbe Zeile nie zweimal
  //      weitergeblättert werden kann.
  const advance = useCallback(() => {
    if (!line) return;
    // JEDE Zeile darf höchstens EINMAL weitergeblättert werden. Der
    // Riegel hängt am Zeilenobjekt selbst, greift also auch dann, wenn
    // ein Klick mit einem veralteten Handler ankommt.
    if (advancedRef.current === line) return;
    // Der Zustand `done` wird hier bewusst NICHT gelesen: er hinkt einen
    // Renderdurchlauf hinterher. Maßgeblich sind die Refs, die der
    // Layout-Effekt beim Zeilenwechsel zurücksetzt.
    const len = parsedRef.current.plainText.length;
    switch (cmpAdvanceDecision(performance.now(), shownAtRef.current, doneAtRef.current, len)) {
      case 'ignore':
        return;
      case 'complete':
        clearInterval(timerRef.current);
        setChars(len);
        setDone(true);
        doneAtRef.current = performance.now();
        cmpSfx('reveal', { volume: 0.35, dedupe: 60 });
        return;
      default:
        advancedRef.current = line;
        cmpSfx('advance', { dedupe: 80, volume: 0.4 });
        onAdvance && onAdvance();
    }
  }, [line, onAdvance]);

  // ── LEERTASTE GEHALTEN ──
  // Vorher feuerte die Tastenwiederholung des Systems im 30-ms-Takt,
  // und ein etwas zu langer Druck übersprang mehrere Textboxen. Jetzt
  // zählt ein Druck genau einmal: Auto-Wiederholung wird verworfen und
  // die Taste muss zwischendurch losgelassen werden. Der keyup-Horcher
  // hängt bewusst OHNE Abhängigkeiten am Fenster — sonst ginge das
  // Loslassen verloren, wenn zwischendurch keine Zeile sichtbar ist.
  useEffect(() => {
    const onUp = (e) => { if (e.key === ' ' || e.key === 'Enter') heldRef.current = false; };
    window.addEventListener('keyup', onUp, true);
    return () => window.removeEventListener('keyup', onUp, true);
  }, []);

  useEffect(() => {
    if (!line) return;
    const onKey = (e) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      if (e.repeat || heldRef.current) return;
      heldRef.current = true;
      advance();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [line, advance]);

  if (!line) return null;

  const portrait = line.portrait ? cmpAvatarUrl(line.portrait) : null;
  const side = line.side === 'right' ? 'right' : 'left';
  let portraitStyle;
  if (pSize) {
    const u = unit || 10;
    const nh = Math.max(1, Math.round(pSize.h / u));
    const nw = Math.max(1, Math.round(pSize.w / u));
    const maxH = Math.min((window.innerHeight || 800) * 0.30, 260);
    const k = Math.max(1, Math.floor(maxH / nh));
    portraitStyle = { height: nh * k + 'px', width: nw * k + 'px' };
  }
  const isNarration = !line.speaker && !line.portrait;

  return (
    <div className={'cmp-dialogue' + (isNarration ? ' cmp-dialogue-narration' : '')} onClick={advance}>
      {portrait && side === 'left' && (
        <div className="cmp-portrait cmp-portrait-left">
          <img src={portrait} alt={line.speaker || ''} draggable={false} style={portraitStyle} />
        </div>
      )}
      <div className="cmp-dialogue-box">
        {line.speaker && (
          <div className="cmp-speaker" style={line.color ? { color: line.color, borderColor: line.color } : undefined}>
            {line.speaker}
          </div>
        )}
        <div className={'cmp-dialogue-text' + (line.think ? ' cmp-think' : '')}>
          {render ? render(parsedRef.current.segments, chars) : (parsedRef.current.plainText || '').slice(0, chars)}
          {done && <span className="cmp-advance">▼</span>}
        </div>
        <button className="cmp-log-btn" onClick={(e) => { e.stopPropagation(); onLog && onLog(); }} title="History">☰</button>
      </div>
      {portrait && side === 'right' && (
        <div className="cmp-portrait cmp-portrait-right">
          <img src={portrait} alt={line.speaker || ''} draggable={false} style={portraitStyle} />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
//  AUSWAHL
// ═══════════════════════════════════════════
function CampaignChoice({ choice, onPick }) {
  // Dieselbe Sorge wie bei der Dialogbox: die Auswahl erscheint genau
  // dort, wo eben noch weitergeklickt wurde. Ohne kurze Sperre wählt
  // ein nachlaufender Klick die erste Möglichkeit aus, ohne dass man
  // sie gelesen hat.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    setArmed(false);
    if (!choice) return;
    cmpSfx('choiceIn', { volume: 0.6 });
    const t = setTimeout(() => setArmed(true), CMP_CHOICE_LOCK);
    return () => clearTimeout(t);
  }, [choice]);
  if (!choice) return null;
  return (
    <div className="cmp-choice-overlay">
      {choice.prompt && <div className="cmp-choice-prompt">{choice.prompt}</div>}
      <div className="cmp-choice-list">
        {choice.options.map((o, i) => (
          <button key={i} className={'cmp-choice' + (armed ? '' : ' cmp-choice-locked')} disabled={!armed}
            onClick={() => { if (!armed) return; cmpSfx('choicePick'); onPick(i); }}>
            {o.text}
            {o.hint && <span className="cmp-choice-hint">{o.hint}</span>}
            {o.time ? <span className="cmp-choice-time">{o.time} min</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  ÜBERGANG INS DUELL
// ═══════════════════════════════════════════
// Ohne Übergang schnitt das Kampffeld hart in die Szene. Hier fahren
// zwei Blenden zu, ein Blitz überstrahlt den Schnitt, Gegnerportrait
// und Name stehen kurz still — und wenn die Blenden wieder aufgehen,
// steht das Spielfeld schon. Der Duellstart wird bewusst um 800 ms
// verzögert, damit genau das passiert.
function CampaignDuelIntro({ intro, unit }) {
  const [size, setSize] = useState(null);
  useEffect(() => {
    if (!intro || !intro.portrait) { setSize(null); return; }
    let alive = true;
    cmpMeasureImage(cmpAvatarUrl(intro.portrait)).then(s => { if (alive) setSize(s); });
    return () => { alive = false; };
  }, [intro && intro.portrait]);
  if (!intro) return null;
  let style;
  if (size) {
    const u = unit || 10;
    const nh = Math.max(1, Math.round(size.h / u));
    const nw = Math.max(1, Math.round(size.w / u));
    const k = Math.max(1, Math.floor(Math.min((window.innerHeight || 800) * 0.26, 230) / nh));
    style = { width: nw * k + 'px', height: nh * k + 'px' };
  }
  return (
    <div className="cmp-duel-intro" key={intro.key}>
      <div className="cmp-duel-shutter cmp-duel-shutter-top" />
      <div className="cmp-duel-shutter cmp-duel-shutter-bottom" />
      <div className="cmp-duel-flash" />
      <div className="cmp-duel-core">
        {intro.portrait && <img src={cmpAvatarUrl(intro.portrait)} alt="" style={style} draggable={false} />}
        <div className={'cmp-duel-word' + (intro.ante ? ' cmp-duel-word-ante' : '')}>
          {intro.ante ? 'ANTE DUEL' : 'DUEL'}
        </div>
        <div className="cmp-duel-name">{intro.name}</div>
        {intro.ante && <div className="cmp-duel-stake">The winner takes a card. For keeps.</div>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  ANTE (Kartensatz)
// ═══════════════════════════════════════════
// Zwei Zustände in einer Anzeige, beide ÜBER dem Sieg-/Niederlage-
// Fenster des Spielfelds:
//   'pick'   — du hast gewonnen und wählst aus dem Bestand des
//              Gegners. Kopien stehen nur einmal drin.
//   'result' — die Karte steht groß in der Mitte; bei einer Niederlage
//              ist sie weg, bei einem Sieg gehört sie dir.
// Solange die Anzeige steht, kommt man nicht an "CONTINUE" — das Ante
// muss abgeschlossen werden, bevor die Story weiterläuft.
function CampaignAnte({ ante, onPick, onClose }) {
  const [sel, setSel] = useState(null);
  const [hover, setHover] = useState(null);
  useEffect(() => {
    if (!ante) { setSel(null); setHover(null); return; }
    if (ante.phase === 'pick') cmpSfx('anteOpen');
    else cmpSfx(ante.youWon ? 'anteWin' : 'anteLose', { volume: 0.9 });
  }, [ante && ante.phase, ante && ante.card]);
  if (!ante) return null;

  const BoardCard = window.BoardCard;
  const card = (name, big) => (BoardCard
    ? <BoardCard cardName={name} noTooltip style={big ? { width: 300, height: 420 } : { width: 132, height: 185 }} />
    : <img src={window.cardImageUrl ? window.cardImageUrl(name) : ''} alt={name} style={{ width: big ? 300 : 132 }} />);

  if (ante.phase === 'pick') {
    // Die Vorschau zeigt, worüber gerade der Zeiger steht — und sonst
    // die bereits gewählte Karte, damit die Spalte nach dem Klick
    // nicht leer zurückfällt.
    const preview = hover || sel;
    const previewCard = preview && (window.CARDS_BY_NAME || {})[preview];
    const Tooltip = window.CardTooltipContent;
    return (
      <div className="cmp-ante">
        <div className="cmp-ante-head">
          <div className="cmp-ante-title">ANTE — CLAIM YOUR PRIZE</div>
          <div className="cmp-ante-sub">
            {ante.fromDeck
              ? 'Nothing reached the field, so their whole deck is open to you.'
              : 'Everything they played, discarded or lost.'}
          </div>
        </div>
        <div className="cmp-ante-body">
          <div className="cmp-ante-grid" onMouseLeave={() => setHover(null)}>
            {ante.pool.map(name => (
              <button key={name}
                className={'cmp-ante-card' + (sel === name ? ' is-sel' : '')}
                onMouseEnter={() => setHover(name)}
                onFocus={() => setHover(name)}
                onClick={() => { cmpSfx('hotspot'); setSel(name); }}>
                {card(name, false)}
                <span className="cmp-ante-name" style={{ color: cmpTypeColor(name) }}>{name}</span>
              </button>
            ))}
          </div>
          {/* Feste Spalte rechts: der Platz ist IMMER reserviert, damit
              das Raster beim Überfahren nicht springt. */}
          <aside className="cmp-ante-side">
            {previewCard && Tooltip
              ? <Tooltip card={previewCard} />
              : <div className="cmp-ante-side-empty">Hover a card<br />to inspect it</div>}
          </aside>
        </div>
        <div className="cmp-ante-foot">
          <button className="btn btn-success" disabled={!sel} onClick={() => onPick(sel)}>
            {sel ? 'TAKE ' + sel.toUpperCase() : 'CHOOSE A CARD'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={'cmp-ante-result' + (ante.youWon ? ' is-win' : ' is-loss')} onClick={onClose}>
      <div className="cmp-ante-result-inner">
        <div className="cmp-ante-result-title">{ante.youWon ? 'ANTE CLAIMED' : 'ANTE LOST'}</div>
        <div className="cmp-ante-result-card">{card(ante.card, true)}</div>
        <div className="cmp-ante-result-name" style={{ color: cmpTypeColor(ante.card) }}>{ante.card}</div>
        <div className="cmp-ante-result-note">
          {ante.youWon
            ? 'Added to your collection.'
            : 'Taken from your deck for good — rebuild it at your desk before your next duel.'}
        </div>
        <div className="cmp-ante-result-hint">Click to continue</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  KARTEN-AUFTRITT
// ═══════════════════════════════════════════
// Eine gewonnene Karte ist ein Ereignis, kein Nebensatz: Siegesfanfare,
// Karte groß in der Mitte, Klick überspringt. Mehrere Karten laufen
// nacheinander durch dieselbe Anzeige.
function CampaignCardReveal({ reveal, onAdvance }) {
  if (!reveal) return null;
  const name = reveal.names[reveal.idx];
  const BoardCard = window.BoardCard;
  return (
    <div className="cmp-card-reveal" onClick={onAdvance}>
      <div className="cmp-card-reveal-inner" key={reveal.idx}>
        <div className="cmp-card-reveal-title">CARD ACQUIRED</div>
        <div className="cmp-card-reveal-card">
          {BoardCard
            ? <BoardCard cardName={name} noTooltip style={{ width: 300, height: 420 }} />
            : <img src={window.cardImageUrl ? window.cardImageUrl(name) : ''} alt={name} style={{ width: 300 }} />}
        </div>
        <div className="cmp-card-reveal-name" style={{ color: cmpTypeColor(name) }}>{name}</div>
        {reveal.names.length > 1 && (
          <div className="cmp-card-reveal-count">{reveal.idx + 1} / {reveal.names.length}</div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  ORTSLISTE
// ═══════════════════════════════════════════
// Zeigt jeden Ort, den der Spieler KENNT. Wo er gerade nicht hin kann
// (gesperrt oder Bedingung nicht erfüllt), steht der Grund statt der
// Wegzeit — das ist als Hinweis nützlicher als ein verstecktes Ziel.
function CampaignPlaces({ open, onToggle, world, state, onTravel }) {
  const here = state.location;
  const entries = (state.known || [])
    .map(id => ({ id, loc: world.locations[id] }))
    .filter(e => !!e.loc);

  const travelCost = (id) => cmpTravelCost(world, state, id);

  return (
    <div className={'cmp-places' + (open ? ' is-open' : '')}>
      <button className="cmp-places-toggle" onClick={onToggle}>
        {open ? '✕' : '🗺'} <span>PLACES</span>
      </button>
      {open && (
        <div className="cmp-places-list">
          {entries.length === 0 && <div className="cmp-places-empty">You haven't learned about any places yet.</div>}
          {entries.map(({ id, loc }) => {
            const isHere = id === here;
            const locked = !!state.locked[id];
            const okWhen = cmpCond(state, loc.when);
            const disabled = isHere || locked || !okWhen;
            const reason = locked ? (loc.lockedText || 'Locked')
              : (!okWhen ? (loc.closedText || 'Not available right now') : null);
            return (
              <button key={id} className={'cmp-place' + (isHere ? ' is-here' : '') + (disabled ? ' is-disabled' : '')}
                disabled={disabled}
                onClick={() => onTravel(id)}>
                <span className="cmp-place-name">{loc.name || id}</span>
                <span className="cmp-place-meta">
                  {isHere ? "You're here" : (reason || ('+' + travelCost(id) + ' min'))}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Wegzeit zu einem Ort: Feinstes gewinnt — travelFrom[Herkunft],
 *  sonst travel des Ziels, sonst world.defaultTravel, sonst 10. */
function cmpTravelCost(world, state, targetId) {
  const loc = world.locations[targetId] || {};
  if (loc.travelFrom && loc.travelFrom[state.location] != null) return loc.travelFrom[state.location];
  if (loc.travel != null) return loc.travel;
  if (world.defaultTravel != null) return world.defaultTravel;
  return 10;
}

window.CampaignStage = CampaignStage;
window.CampaignClock = CampaignClock;
window.CampaignDialogue = CampaignDialogue;
window.CampaignChoice = CampaignChoice;
window.CampaignPlaces = CampaignPlaces;
window.cmpLoadStory = cmpLoadStory;
window.cmpNewState = cmpNewState;
window.cmpCond = cmpCond;
window.cmpTime = cmpTime;
window.cmpFmtTime = cmpFmtTime;

// ═══════════════════════════════════════════════════════════════════
//  SZENEN-INTERPRETER
// ═══════════════════════════════════════════════════════════════════
//  Eine Szene ist eine flache Liste von Schritten. Der Interpreter geht
//  sie der Reihe nach durch; Schritte, deren `when` nicht zutrifft,
//  werden übersprungen. Verzweigt wird über Sprungmarken:
//      { label: 'x' }   Marke
//      { jump: 'x' }    dorthin springen
//      { choice: [ { text, goto:'x' } ] }
//  Ein Schritt darf mehrere Felder tragen (z.B. `say` + `enter`), die
//  Reihenfolge unten ist dann die Abarbeitungsreihenfolge.
//
//  Der Interpreter ist absichtlich `async`: jede Zeile wartet auf einen
//  Klick, jede Auswahl auf eine Entscheidung, jedes Duell auf sein
//  Ergebnis. Dadurch liest sich eine Szene im Code wie im Drehbuch.
// ═══════════════════════════════════════════════════════════════════

function cmpFindLabel(steps, label) {
  for (let i = 0; i < steps.length; i++) if (steps[i] && steps[i].label === label) return i;
  return -1;
}

/** Baut den Interpreter. `io` bündelt alles, was der Interpreter an der
 *  Oberfläche anfassen darf — damit bleibt er selbst frei von React. */
function cmpMakeRunner(io) {
  const SIG_END = { end: true };

  async function runSteps(steps) {
    if (!Array.isArray(steps)) return null;
    let i = 0;
    let guard = 0;
    while (i < steps.length) {
      if (++guard > 20000) { console.error('[Kampagne] Endlosschleife in einer Szene abgebrochen.'); break; }
      const step = steps[i];
      if (!step) { i++; continue; }
      if (step.when != null && !cmpCond(io.state(), step.when)) { i++; continue; }
      const res = await runStep(step);
      if (res === SIG_END) return SIG_END;
      if (res && res.jump) {
        const target = cmpFindLabel(steps, res.jump);
        if (target < 0) { console.error('[Kampagne] Sprungmarke "' + res.jump + '" fehlt.'); return null; }
        i = target + 1;
        continue;
      }
      i++;
    }
    return null;
  }

  async function runStep(step) {
    // ── Bühne ──
    if (step.bg !== undefined) io.setBg(step.bg);
    if (step.enter) io.enter(step.enter, step);
    if (step.exit) io.exit(step.exit, step);
    if (step.move) { io.move(step.move, step); await io.sleep(step.ms || 600); }
    if (step.face) io.face(step.face, step);
    if (step.dim) io.dim(step.dim, step);
    if (step.clear) io.clearActors();

    // ── Klang ──
    if (step.music !== undefined) io.music(step.music);
    if (step.sfx && window.playSFX) window.playSFX(step.sfx);
    if (step.fx) await io.fx(step.fx, step.ms || 500);

    // ── Zustand ──
    if (step.flag) io.mutate(s => { s.flags[step.flag] = true; });
    if (step.unflag) io.mutate(s => { delete s.flags[step.unflag]; });
    if (step.set) io.mutate(s => { Object.assign(s.vars, step.set); });
    if (step.add) io.mutate(s => { for (const [k, v] of Object.entries(step.add)) s.vars[k] = (s.vars[k] || 0) + v; });
    if (step.item) {
      const n = step.n != null ? step.n : 1;
      io.mutate(s => {
        s.items[step.item] = Math.max(0, (s.items[step.item] || 0) + n);
        if (!s.items[step.item]) delete s.items[step.item];
      });
      cmpSfx(n >= 0 ? 'item' : 'itemLoss');
    }
    if (step.coins) { io.mutate(s => { s.coins = Math.max(0, (s.coins || 0) + step.coins); }); cmpSfx(step.coins > 0 ? 'coins' : 'spend'); }
    if (step.card) {
      const n = step.n != null ? step.n : 1;
      io.mutate(s => {
        s.collection[step.card] = Math.max(0, (s.collection[step.card] || 0) + n);
        if (!s.collection[step.card]) delete s.collection[step.card];
      });
      // Nur beim Gewinnen zeigen, nicht beim Wegnehmen (n < 0).
      if (n > 0 && io.revealCards) await io.revealCards([[step.card, n]]);
    }
    if (step.learn) io.mutate(s => {
      if (s.known.indexOf(step.learn) < 0) { s.known.push(step.learn); cmpSfx('learn', { dedupe: 120, volume: 0.5 }); }
    });
    if (step.lock) io.mutate(s => { s.locked[step.lock] = true; });
    if (step.unlock) { io.mutate(s => { delete s.locked[step.unlock]; }); cmpSfx('learn', { dedupe: 120, volume: 0.5 }); }
    // `run` bekommt den Zustand als Entwurf: alles, wofür es keinen
    // eigenen Schritt gibt, lässt sich hier direkt schreiben.
    if (step.run) io.mutate(s => { try { step.run(s, io); } catch (e) { console.error('[Kampagne] run() warf:', e); } });

    // ── Zeit ──
    if (step.time) io.addTime(step.time);

    // ── Ausgabe ──
    if (step.text || step.say || step.think) {
      await io.say({
        speaker: step.say, text: step.text || step.think || '',
        think: !!step.think, side: step.side, speed: step.speed,
        portrait: step.portrait, color: step.color, name: step.name,
      });
    }
    if (step.wait) await io.sleep(step.wait);

    // ── Auswahl ──
    if (step.choice) {
      const opts = step.choice.filter(o => o && cmpCond(io.state(), o.when));
      if (opts.length) {
        const pick = await io.choose({ prompt: step.prompt, options: opts });
        const chosen = opts[pick];
        if (chosen) {
          if (chosen.time) io.addTime(chosen.time);
          if (chosen.flag) io.mutate(s => { s.flags[chosen.flag] = true; });
          if (chosen.steps) { const r = await runSteps(chosen.steps); if (r === SIG_END) return SIG_END; }
          if (chosen.goto) return { jump: chosen.goto };
        }
      }
    }

    // ── Duell ──
    if (step.duel) {
      const won = await io.duel(step);
      io.mutate(s => { s.duels[step.duel] = won ? 'won' : 'lost'; });
      const branch = won ? step.onWin : step.onLose;
      const reward = won ? (step.reward || step.rewardWin) : step.rewardLose;
      if (reward) await io.applyReward(reward);
      if (!won && step.mustWin) { await io.gameOver(step.loseText); return SIG_END; }
      if (branch) { const r = await runSteps(branch); if (r === SIG_END) return SIG_END; }
      if (won && step.gotoWin) return { jump: step.gotoWin };
      if (!won && step.gotoLose) return { jump: step.gotoLose };
    }

    // ── Sonstiges ──
    if (step.deckEdit) await io.deckEdit();
    if (step.scene) { const r = await io.playScene(step.scene, true); if (r === SIG_END) return SIG_END; }
    if (step.goto) await io.goTo(step.goto, step.travel != null ? step.travel : 0);
    if (step.gameOver) { await io.gameOver(step.gameOver); return SIG_END; }
    if (step.jump) return { jump: step.jump };
    if (step.end) return SIG_END;
    return null;
  }

  return { runSteps, SIG_END };
}

// ═══════════════════════════════════════════
//  DECK-EDITOR (nur im eigenen Zimmer)
// ═══════════════════════════════════════════
// Bewusst schlicht: links die Sammlung, rechts das Deck, oben die drei
// Heldenplätze. Es darf nur eingebaut werden, was auch besessen wird —
// die Prüfung läuft zusätzlich serverseitig beim Duellstart.
/** Wie viele Tränke sind erlaubt? 0 oder 5-15, und zusammen mit den
 *  Tränken im Hauptdeck nie mehr als 15 (siehe isDeckLegal). */
function cmpPotionCountOk(deck) {
  const db = window.CARDS_BY_NAME || {};
  const inMain = (deck.mainDeck || []).filter(n => db[n] && db[n].cardType === 'Potion').length;
  const pc = (deck.potionDeck || []).length;
  if (pc !== 0 && (pc < 5 || pc > 15)) return false;
  if (inMain + pc > 15) return false;
  return true;
}

function CampaignDeckEditor({ state, onSave, onClose }) {
  const [deck, setDeck] = useState(() => JSON.parse(JSON.stringify(state.deck || { heroes: [], mainDeck: [], potionDeck: [], sideDeck: [] })));
  const [filter, setFilter] = useState('');
  const [fType, setFType] = useState('');       // Kartentyp
  const [fSub, setFSub] = useState('');         // Untertyp
  const [fArch, setFArch] = useState('');       // Archetyp
  const [sortBy, setSortBy] = useState('name'); // name | cost | level | atk | hp
  const [sortDesc, setSortDesc] = useState(true);
  const [hover, setHover] = useState(null);
  const [flights, setFlights] = useState([]);
  const db = window.CARDS_BY_NAME || {};
  const collRef = useRef(null);
  const deckRef = useRef(null);
  const heroesRef = useRef(null);
  const heroRefs = useRef([]);

  const used = useMemo(() => {
    const u = {};
    for (const n of (deck.mainDeck || [])) u[n] = (u[n] || 0) + 1;
    for (const n of (deck.potionDeck || [])) u[n] = (u[n] || 0) + 1;
    for (const h of (deck.heroes || [])) if (h && h.hero) u[h.hero] = (u[h.hero] || 0) + 1;
    return u;
  }, [deck]);

  // Die Auswahllisten entstehen aus dem, was tatsächlich in der Truhe
  // liegt — nicht aus der ganzen Kartendatenbank. Sonst stünden dort
  // Dutzende Einträge, die zu null Treffern führen.
  const facets = useMemo(() => {
    const types = new Set(), subs = new Set(), archs = new Set();
    for (const name of Object.keys(state.collection || {})) {
      const c = db[name];
      if (!c) continue;
      if (c.cardType) types.add(c.cardType);
      if (c.subtype) subs.add(c.subtype);
      if (c.archetype) archs.add(c.archetype);
    }
    const srt = (set) => [...set].sort((a, b) => a.localeCompare(b));
    return { types: srt(types), subs: srt(subs), archs: srt(archs) };
  }, [state.collection, db]);

  // Fehlende Zahlenwerte (ein Zauber hat keine HP) sortieren IMMER ans
  // Ende, egal in welche Richtung — sonst füllt sich der Anfang der
  // Liste mit Karten, die das Kriterium gar nicht kennen.
  const sortValue = (name) => {
    const c = db[name] || {};
    const v = sortBy === 'cost' ? c.cost : sortBy === 'level' ? c.level
            : sortBy === 'atk' ? c.atk : sortBy === 'hp' ? c.hp : null;
    return (v == null || v === '') ? null : Number(v);
  };

  const owned = useMemo(() => {
    const q = filter.trim().toLowerCase();
    let list = Object.entries(state.collection || {}).filter(([name]) => {
      const c = db[name] || {};
      if (q && name.toLowerCase().indexOf(q) < 0) return false;
      if (fType && c.cardType !== fType) return false;
      if (fSub && c.subtype !== fSub) return false;
      if (fArch && c.archetype !== fArch) return false;
      return true;
    });
    if (sortBy === 'name') {
      list.sort((a, b) => a[0].localeCompare(b[0]));
    } else {
      list.sort((a, b) => {
        const va = sortValue(a[0]), vb = sortValue(b[0]);
        if (va == null && vb == null) return a[0].localeCompare(b[0]);
        if (va == null) return 1;
        if (vb == null) return -1;
        if (va !== vb) return sortDesc ? vb - va : va - vb;
        return a[0].localeCompare(b[0]);
      });
    }
    return list;
  }, [state.collection, db, filter, fType, fSub, fArch, sortBy, sortDesc]);

  const filtersActive = !!(filter || fType || fSub || fArch);
  // Zwei Zahlen: wie viele VERSCHIEDENE Karten die Liste gerade zeigt
  // und wie viele Exemplare das zusammen sind. Beide folgen dem Filter,
  // damit sie zueinander passen.
  const ownedTotal = useMemo(() => owned.reduce((sum, [, n]) => sum + n, 0), [owned]);

  const free = (name) => (state.collection[name] || 0) - (used[name] || 0);

  // ── FLIEGENDE KARTE ──
  // Eine Karte, die die Seite wechselt, soll das auch SEHEN lassen: eine
  // Miniatur startet an der angeklickten Zeile und fliegt zur Zielspalte,
  // wo sie ausblendet. Rein dekorativ (pointerEvents: none), der
  // Deckinhalt ändert sich davon unabhängig sofort.
  const fly = (name, fromEl, toEl) => {
    try {
      const a = fromEl && fromEl.getBoundingClientRect();
      const b = toEl && toEl.getBoundingClientRect();
      if (!a || !b) return;
      const id = Date.now() + Math.random();
      setFlights(f => f.concat([{
        id, name,
        x0: a.left + a.width / 2, y0: a.top + a.height / 2,
        dx: (b.left + b.width / 2) - (a.left + a.width / 2),
        dy: (b.top + b.height / 2) - (a.top + a.height / 2),
      }]));
      setTimeout(() => setFlights(f => f.filter(x => x.id !== id)), 700);
    } catch { /* Animation ist Beiwerk — nie den Editor daran aufhängen */ }
  };

  const addCard = (name, ev) => {
    const card = db[name];
    if (free(name) <= 0) { cmpSfx('blocked', { volume: 0.4 }); return; }
    const isHero = !!(card && card.cardType === 'Hero');
    // Ziel des Fluges ist, WO die Karte landet. Ein Held landet in
    // einem Heldenplatz oben, nicht in der Deckliste — vorher flog er
    // sichtbar an die falsche Stelle.
    const heroSlot = isHero ? (deck.heroes || []).findIndex(h => !h || !h.hero) : -1;
    if (isHero && heroSlot < 0) { cmpSfx('blocked', { volume: 0.4 }); return; }
    cmpSfx(isHero ? 'deckHero' : 'deckAdd', { volume: 0.6, dedupe: 40 });
    fly(name, ev && ev.currentTarget,
      isHero ? (heroRefs.current[heroSlot] || heroesRef.current) : deckRef.current);
    setDeck(d => {
      const nd = JSON.parse(JSON.stringify(d));
      if (card && card.cardType === 'Hero') {
        const slot = nd.heroes.findIndex(h => !h || !h.hero);
        if (slot < 0) return d;
        nd.heroes[slot] = { hero: name, ability1: card.startingAbility1 || null, ability2: card.startingAbility2 || null };
      } else if (card && card.cardType === 'Potion') {
        nd.potionDeck.push(name);
      } else {
        nd.mainDeck.push(name);
      }
      return nd;
    });
  };

  const removeFrom = (list, idx, name, ev) => {
    cmpSfx('deckDrop', { volume: 0.6, dedupe: 40 });
    if (name) fly(name, ev && ev.currentTarget, collRef.current);
    setDeck(d => {
      const nd = JSON.parse(JSON.stringify(d));
      if (list === 'heroes') nd.heroes[idx] = { hero: null, ability1: null, ability2: null };
      else nd[list].splice(idx, 1);
      return nd;
    });
  };

  const grouped = useMemo(() => {
    const g = {};
    for (const n of (deck.mainDeck || [])) g[n] = (g[n] || 0) + 1;
    return Object.entries(g).sort((a, b) => a[0].localeCompare(b[0]));
  }, [deck]);

  const legal = (typeof isDeckLegal === 'function') ? isDeckLegal(deck) : { legal: true, reasons: [] };
  const mainCount = (deck.mainDeck || []).length;
  const potionCount = (deck.potionDeck || []).length;
  const mainOk = mainCount === 60;
  const potionOk = cmpPotionCountOk(deck);

  const hoverCard = hover && db[hover];
  const Tooltip = window.CardTooltipContent;

  return (
    <div className="cmp-modal-overlay">
      <div className="cmp-modal cmp-deck-editor">
        <div className="cmp-modal-head">
          <span>EDIT DECK</span>
          <span className={'cmp-legal ' + (legal.legal ? 'ok' : 'bad')}>
            {legal.legal ? '✓ Ready to play' : '✗ ' + legal.reasons.join(' · ')}
          </span>
        </div>

        <div className="cmp-heroes" ref={heroesRef}>
          {[0, 1, 2].map(i => {
            const h = (deck.heroes || [])[i];
            return (
              <div key={i} ref={el => { heroRefs.current[i] = el; }}
                className={'cmp-hero-slot' + (h && h.hero ? ' filled' : '')}
                onMouseEnter={() => h && h.hero && setHover(h.hero)}
                onClick={(e) => h && h.hero && removeFrom('heroes', i, h.hero, e)}>
                {h && h.hero
                  ? <><img src={window.cardImageUrl ? window.cardImageUrl(h.hero) : ''} alt={h.hero} /><span style={{ color: cmpTypeColor(h.hero) }}>{h.hero}</span></>
                  : <span className="cmp-hero-empty">Hero slot {i + 1}</span>}
              </div>
            );
          })}
        </div>

        <div className="cmp-deck-cols">
          <div className="cmp-deck-col">
            <div className="cmp-col-head">
              COLLECTION
              <span className="cmp-count cmp-count-wide" title="Different cards | total copies">
                {owned.length} | {ownedTotal}
              </span>
              <input className="cmp-search" placeholder="search…" value={filter} onChange={e => setFilter(e.target.value)} />
            </div>
            <div className="cmp-filters">
              <select className="cmp-filter" value={fType} onChange={e => setFType(e.target.value)}>
                <option value="">All types</option>
                {facets.types.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select className="cmp-filter" value={fSub} onChange={e => setFSub(e.target.value)}>
                <option value="">All subtypes</option>
                {facets.subs.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select className="cmp-filter" value={fArch} onChange={e => setFArch(e.target.value)}>
                <option value="">All archetypes</option>
                {facets.archs.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select className="cmp-filter" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                <option value="name">Sort: Name</option>
                <option value="cost">Sort: Cost</option>
                <option value="level">Sort: Level</option>
                <option value="atk">Sort: ATK</option>
                <option value="hp">Sort: HP</option>
              </select>
              <button className="cmp-filter cmp-sort-dir" disabled={sortBy === 'name'}
                title={sortDesc ? 'Highest first' : 'Lowest first'}
                onClick={() => { cmpSfx('hotspot', { volume: 0.4 }); setSortDesc(v => !v); }}>
                {sortBy === 'name' ? 'A→Z' : (sortDesc ? '▼ high' : '▲ low')}
              </button>
              {filtersActive && (
                <button className="cmp-filter cmp-filter-clear"
                  onClick={() => { cmpSfx('close', { volume: 0.4 }); setFilter(''); setFType(''); setFSub(''); setFArch(''); }}>
                  ✕ clear
                </button>
              )}
            </div>
            <div className="cmp-card-list" ref={collRef} onMouseLeave={() => setHover(null)}>
              {owned.map(([name, count]) => (
                /* NICHT `disabled`: ein deaktivierter Knopf feuert in
                   Chromium keine Mausereignisse, und genau dann bliebe
                   der Tooltip für "0/x"-Zeilen aus. Der Klick wird
                   stattdessen in addCard abgefangen. */
                <button key={name} className={'cmp-card-row' + (free(name) <= 0 ? ' is-out' : '')}
                  onMouseEnter={() => setHover(name)}
                  onClick={(e) => addCard(name, e)}>
                  <span className="cmp-card-name" title={name} style={{ color: cmpTypeColor(name) }}>{name}</span>
                  {/* Wonach gerade sortiert wird, steht auch an der Zeile —
                      sonst wirkt die Reihenfolge willkürlich. */}
                  {sortBy !== 'name' && (
                    <span className="cmp-card-sortval">
                      {sortValue(name) == null ? '–' : sortValue(name)}
                    </span>
                  )}
                  <span className="cmp-card-count">{free(name)}/{count}</span>
                </button>
              ))}
              {owned.length === 0 && (
                <div className="cmp-empty">
                  {filtersActive ? 'No cards match these filters.' : 'Your collection is empty.'}
                </div>
              )}
            </div>
          </div>

          <div className="cmp-deck-col">
            <div className="cmp-col-head">
              DECK <span className={'cmp-count' + (mainOk ? '' : ' is-bad')}>{mainCount}/60</span>
            </div>
            <div className="cmp-card-list" ref={deckRef} onMouseLeave={() => setHover(null)}>
              {grouped.map(([name, n]) => (
                <button key={name} className="cmp-card-row"
                  onMouseEnter={() => setHover(name)}
                  onClick={(e) => removeFrom('mainDeck', deck.mainDeck.indexOf(name), name, e)}>
                  <span className="cmp-card-name" title={name} style={{ color: cmpTypeColor(name) }}>{name}</span>
                  <span className="cmp-card-count">{n}x</span>
                </button>
              ))}
              {potionCount > 0 && (
                <div className="cmp-col-sub">
                  POTIONS <span className={'cmp-count' + (potionOk ? '' : ' is-bad')}>{potionCount}</span>
                  <span className="cmp-col-sub-hint"> (0 or 5–15)</span>
                </div>
              )}
              {(deck.potionDeck || []).map((name, i) => (
                <button key={'p' + i} className="cmp-card-row"
                  onMouseEnter={() => setHover(name)}
                  onClick={(e) => removeFrom('potionDeck', i, name, e)}>
                  <span className="cmp-card-name" title={name} style={{ color: cmpTypeColor(name) }}>{name}</span>
                  <span className="cmp-card-count">−</span>
                </button>
              ))}
            </div>
          </div>

          {/* Feste Vorschauspalte — wie beim Ante ist der Platz IMMER
              reserviert, damit die Listen beim Überfahren nicht springen. */}
          <aside className="cmp-deck-side">
            {hoverCard && Tooltip
              ? <Tooltip card={hoverCard} />
              : <div className="cmp-ante-side-empty">Hover a card<br />to inspect it</div>}
          </aside>
        </div>

        <div className="cmp-modal-foot">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-success" disabled={!legal.legal} onClick={() => onSave(deck)}>Save</button>
        </div>
      </div>

      {flights.map(f => (
        <div key={f.id} className="cmp-flight"
          style={{ left: f.x0, top: f.y0, '--fx': f.dx + 'px', '--fy': f.dy + 'px' }}>
          <img src={window.cardImageUrl ? window.cardImageUrl(f.name) : ''} alt="" />
        </div>
      ))}
    </div>
  );
}


// ═══════════════════════════════════════════
//  ENTWICKLERHILFEN (F10)
// ═══════════════════════════════════════════
function CampaignDevPanel({ story, state, onJump, onScene, onTime, onFlag, onClearFlags, onClearHistory, onResetDeck, onReload, onReset, onClose, onToggleHotspots, showHotspots }) {
  const [sceneId, setSceneId] = useState('');
  const [t, setT] = useState(cmpFmtTime(state.minutes));
  const [flag, setFlag] = useState('');
  return (
    <div className="cmp-dev">
      <div className="cmp-dev-head">DEV TOOLS <button onClick={onClose}>✕</button></div>
      {story.errors.length > 0 && (
        <div className="cmp-dev-errors">
          {story.errors.map((e, i) => <div key={i}>⚠ {e}</div>)}
        </div>
      )}
      <div className="cmp-dev-row">
        <label>Place</label>
        <select value={state.location || ''} onChange={e => onJump(e.target.value)}>
          {Object.entries(story.world.locations).map(([id, l]) => <option key={id} value={id}>{l.name || id}</option>)}
        </select>
      </div>
      <div className="cmp-dev-row">
        <label>Scene</label>
        <select value={sceneId} onChange={e => setSceneId(e.target.value)}>
          <option value="">—</option>
          {Object.keys(story.scenes).sort().map(id => <option key={id} value={id}>{id}</option>)}
        </select>
        <button onClick={() => sceneId && onScene(sceneId)}>▶</button>
      </div>
      <div className="cmp-dev-row">
        <label>Time</label>
        <input value={t} onChange={e => setT(e.target.value)} style={{ width: 70 }} />
        <button onClick={() => onTime(cmpTime(t, state.minutes))}>set</button>
      </div>
      <div className="cmp-dev-row">
        <label>Flag</label>
        <input value={flag} onChange={e => setFlag(e.target.value)} style={{ width: 110 }} />
        <button onClick={() => flag && onFlag(flag)}>toggle</button>
      </div>
      <div className="cmp-dev-flags">
        {Object.keys(state.flags).length === 0 ? <i>no flags</i> :
          Object.keys(state.flags).map(f => <span key={f} onClick={() => onFlag(f)}>{f}</span>)}
      </div>
      <div className="cmp-dev-row">
        <button onClick={onToggleHotspots}>{showHotspots ? 'Hide hotspots' : 'Show hotspots'}</button>
      </div>
      <div className="cmp-dev-row">
        {/* Zwei getrennte Hebel: Flags steuern Auftritte, die an einem
            Merker hängen; der Szenenverlauf steuert alles mit `once`
            und die einmaligen Ereignisse. Für "nochmal von vorne
            testen" braucht man je nach Szene das eine oder beides. */}
        <button onClick={onClearFlags}>Clear flags (1-1-1)</button>
        <button onClick={onClearHistory}>Clear scene history</button>
      </div>
      <div className="cmp-dev-row">
        <button onClick={onResetDeck}>Reload starting deck</button>
      </div>
      <div className="cmp-dev-row">
        <button onClick={onReload}>Reload story (F9)</button>
        <button className="cmp-dev-danger" onClick={onReset}>Reset campaign</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  KAMPAGNEN-BILDSCHIRM
// ═══════════════════════════════════════════════════════════════════
function CampaignScreen() {
  const { setScreen, notify, setBgmMode } = useContext(AppContext);

  const [story, setStory] = useState(null);
  const [state, setState] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const stateRef = useRef(null);
  const checkpointRef = useRef(null);
  // Wurde in dieser Szene auf den Rücksetzpunkt zurückgesprungen?
  // Dann gilt alles, was die Szene getan hat, als nicht geschehen —
  // insbesondere darf sie nicht als "erledigt" markiert werden.
  const rolledBackRef = useRef(false);

  // Anzeige-Zustand der Bühne
  const [stage, setStage] = useState({ bg: null, actors: [] });
  const stageRef = useRef(stage);
  const [line, setLine] = useState(null);
  const [choice, setChoice] = useState(null);
  const [fx, setFx] = useState(null);
  const [busy, setBusy] = useState(false);        // Szene läuft -> keine Erkundung
  const [placesOpen, setPlacesOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [deckOpen, setDeckOpen] = useState(false);
  const [devOpen, setDevOpen] = useState(false);
  const [showHotspots, setShowHotspots] = useState(false);
  const [clockBump, setClockBump] = useState(false);
  const [gameOverText, setGameOverText] = useState(null);
  const [duelState, setDuelState] = useState(null);
  const [duelIntro, setDuelIntro] = useState(null);
  const [cardReveal, setCardReveal] = useState(null);
  const [ante, setAnte] = useState(null);

  const logRef = useRef([]);
  const waiterRef = useRef(null);
  const duelWaiterRef = useRef(null);
  const deckWaiterRef = useRef(null);
  const duelOutcomeRef = useRef(null);
  const revealWaiterRef = useRef(null);
  const anteAppliedRef = useRef(null);   // welches Duell wurde schon verrechnet?
  const digitBufRef = useRef('');        // Ziffernpuffer für Testtasten
  const metrics = useCmpStageMetrics();

  const commitStage = useCallback((next) => { stageRef.current = next; setStage(next); }, []);

  // ── Speicherstand-Zugriff ──────────────────────────────────────
  const mutate = useCallback((fn) => {
    const next = JSON.parse(JSON.stringify(stateRef.current));
    fn(next);
    stateRef.current = next;
    setState(next);
    cmpSave(next);
  }, []);

  // ── Laden ──────────────────────────────────────────────────────
  const bootstrap = useCallback(async (keepState) => {
    try {
      const st = await cmpLoadStory();
      setStory(st);
      if (!st.world) { setLoadError('No world file found — one file in public/campaign/scenes/ must call world({...}).'); return; }
      if (keepState && stateRef.current) return;
      const { state: saved } = await api('/campaign/state');
      let s = saved && saved.v ? saved : cmpNewState(st.world);
      s = await cmpSyncStartDeck(s, st.world, (name) => {
        notify('Starting deck changed to "' + name + '" — campaign deck and collection rebuilt.', 'success');
      });
      // Unterbrochenes Duell (Seite neu geladen): Ergebnis verfällt,
      // die Story macht am Ort der Szene weiter.
      if (s.pendingDuel) delete s.pendingDuel;
      stateRef.current = s;
      setState(s);
      cmpSave(s);
      const loc = st.world.locations[s.location] || {};
      commitStage({ bg: loc.background || null, actors: [] });
    } catch (err) {
      console.error('[Kampagne] Start fehlgeschlagen:', err);
      setLoadError(err.message || String(err));
    }
  }, [commitStage, notify]);

  useEffect(() => { bootstrap(false); }, [bootstrap]);

  // Sprites des aktuellen Orts vorab messen, damit sie beim ersten
  // Zeichnen schon die richtige Größe haben.
  useEffect(() => {
    if (!story || !story.world) return;
    const urls = [];
    for (const loc of Object.values(story.world.locations)) {
      for (const o of (loc.objects || [])) if (o.sprite) urls.push(cmpSpriteUrl(o.sprite));
    }
    for (const c of Object.values(story.world.cast || {})) if (c.sprite) urls.push(cmpSpriteUrl(c.sprite));
    Promise.all(urls.map(cmpMeasureImage)).then(() => setStage(s => ({ ...s })));
  }, [story]);

  // ── Musik ──────────────────────────────────────────────────────
  const music = useCallback((name) => {
    if (!setBgmMode) return;
    if (!name) { setBgmMode('menu'); return; }
    const known = ['menu', 'battle', 'shop', 'tutorial', 'win', 'defeat', 'puzzle'];
    if (known.indexOf(name) >= 0) { setBgmMode(name); return; }
    setBgmMode('campaign:' + String(name).replace(/^bgm_/, '').replace(/\.(ogg|mp3|wav)$/i, ''));
  }, [setBgmMode]);

  useEffect(() => {
    if (!story || !story.world || duelState) return;
    const loc = (state && story.world.locations[state.location]) || {};
    music(loc.music || story.world.music || 'menu');
  }, [story, state && state.location, duelState]);

  // ── Bausteine für den Interpreter ──────────────────────────────
  const sleep = (ms) => new Promise(res => setTimeout(res, ms));

  const say = useCallback((l) => {
    const world = stateRef.current && story ? story.world : null;
    const castEntry = (world && world.cast && l.speaker) ? world.cast[l.speaker] : null;
    const shown = {
      speaker: l.name || (castEntry ? castEntry.name : (l.speaker || null)),
      text: l.text,
      think: l.think,
      side: l.side || (castEntry && castEntry.side) || 'left',
      speed: l.speed,
      color: l.color || (castEntry && castEntry.color) || null,
      portrait: l.portrait !== undefined ? l.portrait
        : (castEntry ? (castEntry.portrait || null) : (l.speaker || null)),
    };
    logRef.current.push({ speaker: shown.speaker, text: shown.text });
    if (logRef.current.length > 300) logRef.current.shift();
    setLine(shown);
    return new Promise(res => { waiterRef.current = () => { setLine(null); res(); }; });
  }, [story]);

  const choose = useCallback((c) => {
    setChoice(c);
    return new Promise(res => { waiterRef.current = (idx) => { setChoice(null); res(idx); }; });
  }, []);

  const addTime = useCallback((min) => {
    if (!min) return;
    mutate(s => {
      s.minutes += min;
      while (s.minutes >= 1440) { s.minutes -= 1440; s.day += 1; }
    });
    setClockBump(true);
    setTimeout(() => setClockBump(false), 700);
  }, [mutate]);

  // Zeigt jede gewonnene Karte einzeln groß in der Mitte. Gibt ein
  // Versprechen zurück, das erst nach der letzten Karte einlöst —
  // die Szene läuft also erst danach weiter.
  const revealCards = useCallback((pairs) => {
    const list = [];
    for (const [name, n] of pairs) for (let i = 0; i < Math.max(0, n); i++) list.push(name);
    if (!list.length) return Promise.resolve();
    cmpSfx('card', { volume: 0.85, dedupe: 0 });
    setCardReveal({ names: list, idx: 0 });
    return new Promise(res => { revealWaiterRef.current = res; });
  }, []);

  const advanceReveal = useCallback(() => {
    setCardReveal(cur => {
      if (!cur) return null;
      if (cur.idx + 1 < cur.names.length) return { ...cur, idx: cur.idx + 1 };
      const w = revealWaiterRef.current; revealWaiterRef.current = null;
      if (w) setTimeout(w, 0);
      return null;
    });
  }, []);

  // Jede Karte steht 2,4 s, ein Klick springt weiter.
  useEffect(() => {
    if (!cardReveal) return;
    const t = setTimeout(advanceReveal, 2400);
    return () => clearTimeout(t);
  }, [cardReveal, advanceReveal]);

  const actorKey = (id) => 'a_' + id;

  const io = useMemo(() => ({
    state: () => stateRef.current,
    mutate,
    sleep,
    say,
    choose,
    addTime,
    setBg: (bg) => commitStage({ ...stageRef.current, bg: bg || null }),
    clearActors: () => commitStage({ ...stageRef.current, actors: [] }),
    enter: (id, opt) => {
      const cast = (story && story.world.cast && story.world.cast[id]) || {};
      const unit = (story && story.world.assets && story.world.assets.spriteUnit) || 10;
      const actor = {
        key: actorKey(id), id,
        sprite: opt.sprite || cast.sprite || id,
        x: opt.x != null ? opt.x : 50,
        y: opt.y != null ? opt.y : 100,
        h: opt.h || cast.h || null,
        flip: opt.flip != null ? opt.flip : !!cast.flip,
        unit, entering: true,
      };
      cmpMeasureImage(cmpSpriteUrl(actor.sprite)).then(() => setStage(s => ({ ...s })));
      const actors = stageRef.current.actors.filter(a => a.key !== actor.key).concat([actor]);
      commitStage({ ...stageRef.current, actors });
      setTimeout(() => setStage(s => ({ ...s, actors: s.actors.map(a => a.key === actor.key ? { ...a, entering: false } : a) })), 380);
    },
    exit: (id, opt) => {
      const key = actorKey(id);
      commitStage({ ...stageRef.current, actors: stageRef.current.actors.map(a => a.key === key ? { ...a, exiting: true } : a) });
      setTimeout(() => {
        const actors = stageRef.current.actors.filter(a => a.key !== key);
        commitStage({ ...stageRef.current, actors });
      }, (opt && opt.ms) || 380);
    },
    move: (id, opt) => {
      const key = actorKey(id);
      commitStage({
        ...stageRef.current,
        actors: stageRef.current.actors.map(a => a.key === key
          ? { ...a, x: opt.x != null ? opt.x : a.x, y: opt.y != null ? opt.y : a.y, ms: opt.ms || 600 } : a),
      });
    },
    face: (id, opt) => {
      const key = actorKey(id);
      commitStage({ ...stageRef.current, actors: stageRef.current.actors.map(a => a.key === key ? { ...a, flip: !!opt.flip } : a) });
    },
    dim: (id, opt) => {
      const key = actorKey(id);
      commitStage({ ...stageRef.current, actors: stageRef.current.actors.map(a => a.key === key ? { ...a, dim: opt.dim !== false } : a) });
    },
    music,
    fx: async (kind, ms) => {
      // Standardklang je Effekt; ein ausdrückliches `sfx` am Schritt
      // läuft zusätzlich und kann ihn damit ergänzen.
      if (kind === 'shake') cmpSfx('shake');
      else if (kind === 'flash') cmpSfx('flash', { volume: 0.6 });
      setFx(kind);
      await sleep(ms || 500);
      setFx(null);
    },
    revealCards,
    applyReward: async (r) => {
      mutate(s => {
        if (r.coins) s.coins = Math.max(0, (s.coins || 0) + r.coins);
        for (const [k, v] of Object.entries(r.items || {})) s.items[k] = Math.max(0, (s.items[k] || 0) + v);
        for (const [k, v] of Object.entries(r.cards || {})) s.collection[k] = Math.max(0, (s.collection[k] || 0) + v);
        for (const f of (r.flags || [])) s.flags[f] = true;
        if (r.time) s.minutes += r.time;
      });
      const gained = Object.entries(r.cards || {}).filter(([, n]) => n > 0);
      if (gained.length) await revealCards(gained);
    },
    gameOver: async (text) => {
      setLine(null); setChoice(null);
      cmpSfx('gameOver', { volume: 0.9 });
      setGameOverText(text || 'This is where that road ends.');
      await new Promise(res => { waiterRef.current = res; });
      setGameOverText(null);
      rolledBackRef.current = true;
      const cp = checkpointRef.current;
      if (cp) {
        const restored = JSON.parse(JSON.stringify(cp));
        stateRef.current = restored;
        setState(restored);
        cmpSave(restored);
        const loc = story.world.locations[restored.location] || {};
        commitStage({ bg: loc.background || null, actors: [] });
      }
    },
    deckEdit: () => { cmpSfx('open'); setDeckOpen(true); return new Promise(res => { deckWaiterRef.current = res; }); },
    duel: async (step) => {
      const cast = (story && story.world.cast && story.world.cast[step.opponent]) || {};
      const name = step.opponentName || step.name || cast.name || 'Opponent';
      // Portrait: ausdrückliche Angabe schlägt den Eintrag aus `cast`.
      const portrait = step.portrait !== undefined ? step.portrait : (cast.portrait || null);

      // ── DECK-PRÜFUNG VOR DEM DUELL ──
      // Nach einem verlorenen Ante fehlt eine Karte: das Deck ist
      // unvollständig und der Server würde das Duell ohnehin abweisen.
      // Statt einer Fehlermeldung mitten in der Szene bekommt der
      // Spieler hier den Editor — wer nicht in Ordnung bringt, gibt
      // das Duell kampflos ab.
      const legal = () => (typeof isDeckLegal === 'function'
        ? isDeckLegal(stateRef.current.deck).legal
        : true);
      if (!legal()) {
        await say({ text: 'Your deck is not tournament legal. You cannot duel until you fix it.' });
        await new Promise(res => { cmpSfx('open'); setDeckOpen(true); deckWaiterRef.current = res; });
        if (!legal()) {
          await say({ text: 'You forfeit the duel.' });
          return false;
        }
      }

      mutate(s => { s.pendingDuel = { id: step.duel }; });
      duelOutcomeRef.current = null;
      setAnte(null);
      anteAppliedRef.current = null;
      setDuelIntro({ name, portrait, ante: !!step.ante, key: Date.now() });
      cmpSfx('duelStart', { volume: 0.9, dedupe: 0 });
      // Erst wenn die Blenden zu sind, wird das Duell angefordert —
      // der Schnitt aufs Spielfeld passiert dann hinter der Blende.
      setTimeout(() => {
        socket.emit('start_campaign_duel', {
          duelId: step.duel,
          opponent: step.opponent || step.duel,
          opponentName: name,
          opponentAvatar: portrait ? cmpAvatarUrl(portrait) : null,
          ante: !!step.ante,
        });
      }, 800);
      setTimeout(() => setDuelIntro(null), 2100);
      return new Promise(res => { duelWaiterRef.current = res; });
    },
    playScene: (id, nested) => playSceneRef.current(id, nested),
    goTo: async (id, cost) => { await travelRef.current(id, cost, true); },
  }), [mutate, say, choose, addTime, commitStage, story, music]);

  const runner = useMemo(() => cmpMakeRunner(io), [io]);

  // ── Ereignisse und Ankünfte ────────────────────────────────────
  const pickEvent = useCallback(() => {
    const s = stateRef.current;
    if (!s || !story) return null;
    for (const ev of (story.world.events || [])) {
      if (!ev || !ev.scene) continue;
      if (ev.once !== false && s.eventsDone[ev.id || ev.scene]) continue;
      if (ev.at && ev.at !== s.location) continue;
      if (ev.day != null && ev.day !== s.day) continue;
      if (ev.from != null && s.minutes < cmpTime(ev.from)) continue;
      if (ev.to != null && s.minutes >= cmpTime(ev.to)) continue;
      if (!cmpCond(s, ev.when)) continue;
      return ev;
    }
    return null;
  }, [story]);

  const playSceneRef = useRef(null);
  const travelRef = useRef(null);
  const arriveRef = useRef(async () => {});

  const afterScene = useCallback(async () => {
    // Tageswechsel: nach der eingestellten Uhrzeit ist Schluss.
    const de = story && story.world.dayEnd;
    const s = stateRef.current;
    if (de && s && s.minutes >= cmpTime(de.at, 1439)) {
      if (de.scene && story.scenes[de.scene]) {
        // Die Szene setzt Tag und Uhrzeit selbst (siehe 'schlafen').
        await playSceneRef.current(de.scene, true);
      } else {
        mutate(st => { st.day += 1; st.minutes = cmpTime(de.wake, 7 * 60); });
      }
      if (de.location) { mutate(st => { st.location = de.location; }); }
      const loc = story.world.locations[stateRef.current.location] || {};
      commitStage({ bg: loc.background || null, actors: [] });
    }
    const ev = pickEvent();
    if (ev) {
      mutate(st => { st.eventsDone[ev.id || ev.scene] = true; });
      await playSceneRef.current(ev.scene, true);
    }
  }, [story, pickEvent, mutate, commitStage]);

  const playScene = useCallback(async (id, nested) => {
    if (!story) return null;
    const sc = story.scenes[id];
    if (!sc) { notify('Scene "' + id + '" does not exist.', 'error'); return null; }
    if (sc.once && stateRef.current.scenesDone[id]) return null;
    if (!cmpCond(stateRef.current, sc.when)) return null;
    if (!nested) {
      checkpointRef.current = JSON.parse(JSON.stringify(stateRef.current));
      rolledBackRef.current = false;
      setBusy(true);
      setPlacesOpen(false);
    }
    if (sc.background !== undefined) io.setBg(sc.background);
    if (sc.music !== undefined) music(sc.music);
    if (sc.clear) io.clearActors();
    let res = null;
    try {
      res = await runner.runSteps(sc.steps || []);
    } catch (err) {
      console.error('[Kampagne] Szene "' + id + '" abgebrochen:', err);
      notify('Error in scene "' + id + '": ' + err.message, 'error');
    }
    if (!rolledBackRef.current) {
      mutate(s => { s.scenesDone[id] = true; });
      if (sc.time) addTime(sc.time);
    }
    if (!nested) {
      setLine(null); setChoice(null);
      if (!rolledBackRef.current) await afterScene();
      const loc = story.world.locations[stateRef.current.location] || {};
      if (sc.keepStage !== true) commitStage({ bg: loc.background || null, actors: [] });
      setBusy(false);
    }
    return res;
  }, [story, runner, io, music, mutate, addTime, afterScene, notify, commitStage]);
  playSceneRef.current = playScene;

  const travel = useCallback(async (id, costOverride, fromScene) => {
    const s = stateRef.current;
    if (!story || !s || (id === s.location && !fromScene)) return;
    const loc = story.world.locations[id];
    if (!loc) { notify('Place "' + id + '" does not exist.', 'error'); return; }
    const cost = costOverride != null ? costOverride : cmpTravelCost(story.world, s, id);
    if (!fromScene) cmpSfx('travel', { volume: 0.55 });
    setPlacesOpen(false);
    mutate(st => {
      st.location = id;
      st.visited[id] = (st.visited[id] || 0) + 1;
      if (st.known.indexOf(id) < 0) st.known.push(id);
      st.minutes += cost;
      while (st.minutes >= 1440) { st.minutes -= 1440; st.day += 1; }
    });
    if (cost) { setClockBump(true); setTimeout(() => setClockBump(false), 700); }
    commitStage({ bg: loc.background || null, actors: [] });
    if (fromScene) return;
    await arriveRef.current();
  }, [story, mutate, commitStage, notify]);
  travelRef.current = travel;

  // Ankommen = zeitgebundene Ereignisse prüfen, dann die Ankunftsszene
  // des Ortes spielen. Steckt bewusst in einer eigenen Funktion: sie
  // läuft AUCH einmal beim Betreten des Story-Modus — sonst würde die
  // Eröffnungsszene nie starten, weil der Spieler beim Laden ja
  // nirgends "ankommt", sondern schon da ist.
  const arriveAt = useCallback(async () => {
    if (!story) return;
    setBusy(true);
    await afterScene();
    const loc = story.world.locations[stateRef.current.location] || {};
    const arrive = loc.onArrive;
    if (arrive) {
      const list = Array.isArray(arrive) ? arrive : [{ scene: arrive }];
      for (const a of list) {
        if (!cmpCond(stateRef.current, a.when)) continue;
        if (a.once !== false && stateRef.current.scenesDone[a.scene]) continue;
        await playSceneRef.current(a.scene, true);
        break;
      }
    }
    setLine(null); setChoice(null);
    const cur = story.world.locations[stateRef.current.location] || {};
    commitStage({ bg: cur.background || null, actors: [] });
    setBusy(false);
  }, [story, afterScene, commitStage]);
  arriveRef.current = arriveAt;

  const arrivedOnceRef = useRef(false);
  useEffect(() => {
    if (!story || !state || duelState || arrivedOnceRef.current) return;
    arrivedOnceRef.current = true;
    arriveAt();
  }, [story, state, duelState, arriveAt]);

  // ── Klick auf ein Objekt / eine Figur ──────────────────────────
  const interact = useCallback(async (obj) => {
    if (!obj || busy) return;
    // Figuren klingen anders als Gegenstände — man hört, WAS man trifft.
    cmpSfx(obj.sprite ? 'npc' : 'hotspot');
    setBusy(true);
    checkpointRef.current = JSON.parse(JSON.stringify(stateRef.current));
    setPlacesOpen(false);
    try {
      // Ein Objekt IST ein Schritt: alles, was eine Szene kann, kann
      // auch ein Klick auf einen Gegenstand (Text, Zeit, Flags, Duell …).
      await runner.runSteps(obj.steps ? obj.steps : [obj]);
    } catch (err) {
      console.error('[Kampagne] Interaktion abgebrochen:', err);
    }
    setLine(null); setChoice(null);
    await afterScene();
    const loc = story.world.locations[stateRef.current.location] || {};
    commitStage({ bg: loc.background || null, actors: stageRef.current.actors });
    setBusy(false);
  }, [busy, runner, afterScene, story, commitStage]);

  // ── Duell-Anbindung ────────────────────────────────────────────
  useEffect(() => {
    const onGameState = (gs) => { if (gs && gs.isCampaign) setDuelState(gs); };
    const onResult = (r) => { duelOutcomeRef.current = !!r.won; };
    const onError = (msg) => {
      notify('Duel: ' + msg, 'error');
      const w = duelWaiterRef.current; duelWaiterRef.current = null;
      if (w) w(false);
    };
    const onAntePrompt = ({ duelId, pool, fromDeck }) => {
      setAnte({ phase: 'pick', pool: pool || [], fromDeck: !!fromDeck, youWon: true, duelId });
    };
    // Die Karte wechselt HIER den Besitzer — einmal je Duell.
    const onAnteResult = ({ duelId, youWon, card }) => {
      if (!card) return;
      setAnte({ phase: 'result', card, youWon: !!youWon, duelId });
      if (anteAppliedRef.current === duelId) return;
      anteAppliedRef.current = duelId;
      mutate(s => cmpApplyAnte(s, card, youWon));
    };
    socket.on('game_state', onGameState);
    socket.on('campaign_duel_result', onResult);
    socket.on('campaign_ante_prompt', onAntePrompt);
    socket.on('campaign_ante_result', onAnteResult);
    socket.on('cpu_battle_error', onError);
    return () => {
      socket.off('game_state', onGameState);
      socket.off('campaign_duel_result', onResult);
      socket.off('campaign_ante_prompt', onAntePrompt);
      socket.off('campaign_ante_result', onAnteResult);
      socket.off('cpu_battle_error', onError);
    };
  }, [notify, mutate]);

  // Musik im Kampagnen-Duell: dasselbe Muster wie im Singleplayer —
  // gegnerspezifisches Thema, wenn der Server einen Slug liefert, sonst
  // das generische Kampfthema; nach dem Ergebnis Sieg/Niederlage.
  useEffect(() => {
    if (!duelState || !setBgmMode) return;
    const r = duelState.result;
    if (r && typeof r.winnerIdx === 'number') {
      setBgmMode(r.winnerIdx === duelState.myIndex ? 'win' : 'defeat');
      return;
    }
    setBgmMode(duelState.cpuBgm ? 'battle:' + duelState.cpuBgm : 'battle');
  }, [duelState, setBgmMode]);

  // ── TESTTASTEN (7.8.) ──
  // Nur im Kampagnen-Duell: 1 gewinnt sofort, 0 verliert sofort.
  useEffect(() => {
    if (!duelState || !duelState.isCampaign) return;
    const onKey = (e) => {
      if (e.key !== '1' && e.key !== '0') return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (duelState.result) return;
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      socket.emit('campaign_debug_end', { roomId: duelState.roomId, win: e.key === '1' });
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [duelState]);

  const leaveDuel = useCallback(() => {
    const gs = duelState;
    if (gs && gs.roomId) socket.emit('leave_game', { roomId: gs.roomId });
    let won = duelOutcomeRef.current;
    if (won == null && gs && gs.result) won = gs.result.winnerIdx === gs.myIndex;
    duelOutcomeRef.current = null;
    setDuelState(null);
    mutate(s => { delete s.pendingDuel; });
    const w = duelWaiterRef.current; duelWaiterRef.current = null;
    if (w) w(!!won);
  }, [duelState, mutate]);

  // ── Tastatur ───────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (duelState) return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      // ── TESTTASTE 1-1-1 ──
      // Dreimal die 1 leert ALLE Story-Flags. Damit werden alle
      // flag-gesteuerten Auftritte wieder spielbar (die Fährfiguren
      // etwa hängen an `*_ferry_done`), ohne den ganzen Speicherstand
      // wegzuwerfen — Uhr, Ort, Münzen, Sammlung und Deck bleiben.
      // Greift NICHT im Duell: dort belegt die 1 den Sofortsieg (der
      // Rücksprung oben verhindert das bereits).
      if (e.key >= '0' && e.key <= '9') {
        digitBufRef.current = (digitBufRef.current + e.key).slice(-3);
        if (digitBufRef.current === '111') {
          digitBufRef.current = '';
          e.preventDefault();
          const n = Object.keys((stateRef.current && stateRef.current.flags) || {}).length;
          mutate(st => { st.flags = {}; });
          cmpSfx('learn');
          notify(n ? ('All story flags cleared (' + n + ')') : 'No story flags were set', 'success');
        }
        return;
      }
      digitBufRef.current = '';
      if (e.key === 'F9') { e.preventDefault(); cmpSfx('open', { volume: 0.5 }); bootstrap(true).then(() => notify('Story reloaded', 'success')); }
      else if (e.key === 'F10') { e.preventDefault(); cmpSfx(devOpen ? 'close' : 'open', { volume: 0.5 }); setDevOpen(v => !v); }
      else if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        if (logOpen) { cmpSfx('close', { volume: 0.5 }); setLogOpen(false); }
        else if (deckOpen) { cmpSfx('close', { volume: 0.5 }); setDeckOpen(false); const w = deckWaiterRef.current; deckWaiterRef.current = null; if (w) w(); }
        else if (devOpen) { cmpSfx('close', { volume: 0.5 }); setDevOpen(false); }
        else if (!busy) { cmpSfx(menuOpen ? 'close' : 'open', { volume: 0.5 }); setMenuOpen(v => !v); }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [duelState, busy, logOpen, deckOpen, devOpen, menuOpen, bootstrap, notify, mutate]);

  // ── Anzeige ────────────────────────────────────────────────────
  // `renderBody` liefert NUR den wechselnden Teil (Spielfeld, Ladebild,
  // Fehlerbild oder Erkundung). Die Overlays stehen darunter an einer
  // festen Stelle im Baum — siehe die Begründung am Ende.
  const renderBody = () => {
  if (duelState) {
    const GameBoard = window.GameBoard;
    return (
      <GameBoard
        gameState={duelState}
        lobby={{ id: duelState.roomId }}
        onLeave={leaveDuel}
        decks={[]}
        sampleDecks={[]}
        selectedDeck={null}
        setSelectedDeck={() => {}}
      />
    );
  }

  if (loadError) {
    return (
      <div className="screen-center" style={{ flexDirection: 'column', gap: 16 }}>
        <div className="pixel-font" style={{ color: 'var(--danger)', fontSize: 14 }}>CAMPAIGN FAILED TO START</div>
        <div style={{ color: 'var(--text2)', maxWidth: 620, textAlign: 'center', fontSize: 13 }}>{loadError}</div>
        <button className="btn" onClick={() => setScreen('menu')}>← Main menu</button>
      </div>
    );
  }
  if (!story || !state) {
    return <div className="screen-center"><div className="pixel-font" style={{ color: 'var(--accent)', fontSize: 14 }}>LOADING CAMPAIGN…</div></div>;
  }

  const world = story.world;
  const loc = world.locations[state.location] || {};
  const objects = (loc.objects || []).filter(o => cmpCond(state, o.when));
  const actions = (loc.actions || []).filter(a => cmpCond(state, a.when));
  const spriteObjs = objects.filter(o => o.sprite);
  const hotspotObjs = objects.filter(o => !o.sprite);
  const unit = (world.assets && world.assets.spriteUnit) || 10;

  // Ortsfiguren werden als zusätzliche Darsteller gezeichnet — in einer
  // laufenden Szene aber nicht, dort führt das Skript Regie.
  const stageForRender = busy ? stage : {
    bg: stage.bg || loc.background,
    actors: (stage.actors || []).concat(spriteObjs.map(o => ({
      key: 'obj_' + o.id, sprite: o.sprite,
      x: o.x != null ? o.x : 50, y: o.y != null ? o.y : 100,
      h: o.h || null, flip: !!o.flip, unit,
      clickable: true, label: o.label || null, hotspot: o,
    }))),
  };

  return (
    <div className="cmp-root">
      <CampaignStage
        stage={stageForRender}
        metrics={metrics}
        hotspots={busy ? [] : hotspotObjs}
        onHotspot={interact}
        showHotspots={showHotspots}
        fx={fx}
      />

      <CampaignClock day={state.day} minutes={state.minutes} bump={clockBump} />

      <div className="cmp-hud">
        <div className="cmp-coins" title="Campaign currency — usable in the story only">
          <img src="/data/sc.png" alt="" /> {state.coins || 0}
        </div>
        {(typeof isDeckLegal === 'function' && state.deck && !isDeckLegal(state.deck).legal) && (
          <div className="cmp-deck-warn" title="Rebuild your deck at the desk in your room">
            ⚠ DECK INCOMPLETE
          </div>
        )}
        {Object.keys(state.items).length > 0 && (
          <div className="cmp-items">
            {Object.entries(state.items).map(([k, v]) => (
              <span key={k} className="cmp-item">{k}{v > 1 ? ' ×' + v : ''}</span>
            ))}
          </div>
        )}
      </div>

      {!busy && <div className="cmp-locname">{loc.name || state.location}</div>}

      {/* ── AKTIONEN ──
          Ortsgebundene Handlungen OHNE Koordinaten. Anders als die
          Klickflächen auf dem Bild hängen sie nicht daran, ob die
          Fläche zufällig über dem passenden Bilddetail liegt — für
          alles, was kein sichtbares Objekt ist (schlafen, Deck bauen,
          sich umsehen), ist das der verlässlichere Weg. */}
      {!busy && actions.length > 0 && (
        <div className="cmp-actions">
          {actions.map((a, i) => (
            <button key={a.id || i} className="cmp-action" onClick={() => interact(a)}>
              {a.label || 'Do something'}
            </button>
          ))}
        </div>
      )}

      {!busy && (
        <CampaignPlaces
          open={placesOpen}
          onToggle={() => { cmpSfx(placesOpen ? 'close' : 'open', { volume: 0.5 }); setPlacesOpen(v => !v); }}
          world={world}
          state={state}
          onTravel={(id) => travel(id)}
        />
      )}

      <CampaignDialogue
        line={line}
        metrics={metrics}
        unit={(world.assets && world.assets.avatarUnit) || 10}
        onAdvance={() => { const w = waiterRef.current; waiterRef.current = null; if (w) w(); }}
        onLog={() => { cmpSfx('open', { volume: 0.5 }); setLogOpen(true); }}
      />

      <CampaignChoice
        choice={choice}
        onPick={(i) => { const w = waiterRef.current; waiterRef.current = null; if (w) w(i); }}
      />

      {gameOverText && (
        <div className="cmp-gameover" onClick={() => { const w = waiterRef.current; waiterRef.current = null; if (w) w(); }}>
          <div className="cmp-gameover-title">GAME OVER</div>
          <div className="cmp-gameover-text">{gameOverText}</div>
          <div className="cmp-gameover-hint">Click to return to your last checkpoint</div>
        </div>
      )}

      {logOpen && (
        <div className="cmp-modal-overlay" onClick={() => setLogOpen(false)}>
          <div className="cmp-modal cmp-log" onClick={e => e.stopPropagation()}>
            <div className="cmp-modal-head"><span>HISTORY</span><button className="btn" onClick={() => setLogOpen(false)}>✕</button></div>
            <div className="cmp-log-list">
              {logRef.current.slice(-120).map((l, i) => (
                <div key={i} className="cmp-log-line">
                  {l.speaker && <b>{l.speaker}: </b>}{l.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {deckOpen && (
        <CampaignDeckEditor
          state={state}
          onClose={() => { cmpSfx('close', { volume: 0.5 }); setDeckOpen(false); const w = deckWaiterRef.current; deckWaiterRef.current = null; if (w) w(); }}
          onSave={(deck) => {
            cmpSfx('deckSave');
            mutate(s => { s.deck = deck; });
            setDeckOpen(false);
            notify('Campaign deck saved', 'success');
            const w = deckWaiterRef.current; deckWaiterRef.current = null; if (w) w();
          }}
        />
      )}

      {menuOpen && (
        <div className="cmp-modal-overlay" onClick={() => setMenuOpen(false)}>
          <div className="cmp-modal cmp-menu" onClick={e => e.stopPropagation()}>
            <div className="cmp-modal-head"><span>CAMPAIGN</span></div>
            <button className="btn" onClick={() => setMenuOpen(false)}>Resume</button>
            <button className="btn" onClick={() => { setMenuOpen(false); setLogOpen(true); }}>History</button>
            <button className="btn" onClick={() => { setMenuOpen(false); setDevOpen(true); }}>Dev tools (F10)</button>
            <button className="btn btn-danger" onClick={() => { cmpSave(stateRef.current); setScreen('menu'); }}>Main menu</button>
          </div>
        </div>
      )}

      {devOpen && (
        <CampaignDevPanel
          story={story}
          state={state}
          showHotspots={showHotspots}
          onToggleHotspots={() => setShowHotspots(v => !v)}
          onJump={(id) => travel(id, 0)}
          onScene={(id) => { setDevOpen(false); playScene(id, false); }}
          onTime={(m) => mutate(s => { s.minutes = m; })}
          onFlag={(f) => mutate(s => { if (s.flags[f]) delete s.flags[f]; else s.flags[f] = true; })}
          onClearFlags={() => {
            const n = Object.keys(stateRef.current.flags || {}).length;
            mutate(s => { s.flags = {}; });
            cmpSfx('learn');
            notify(n ? ('All story flags cleared (' + n + ')') : 'No story flags were set', 'success');
          }}
          onResetDeck={async () => {
            const draft = JSON.parse(JSON.stringify(stateRef.current));
            delete draft.startDeckSig;
            const next = await cmpSyncStartDeck(draft, story.world, () => {});
            stateRef.current = next; setState(next); cmpSave(next);
            cmpSfx('deckSave');
            notify('Campaign deck and collection reset to the starting deck', 'success');
          }}
          onClearHistory={() => {
            // Szenen mit `once` und einmalige Ereignisse wieder freigeben.
            mutate(s => { s.scenesDone = {}; s.eventsDone = {}; s.duels = {}; });
            cmpSfx('learn');
            notify('Scene history cleared — once-scenes and events can fire again', 'success');
          }}
          onReload={() => bootstrap(true).then(() => notify('Story reloaded', 'success'))}
          onReset={async () => {
            await api('/campaign/reset', { method: 'POST' });
            stateRef.current = null;
            setState(null);
            setDevOpen(false);
            bootstrap(false);
          }}
          onClose={() => setDevOpen(false)}
        />
      )}

      {busy && <div className="cmp-scene-guard" />}
    </div>
  );
  };

  // Übergang und Karten-Auftritt hängen AUSSERHALB von `renderBody` an
  // einer festen Position im Baum. Vorher standen sie in zwei Zweigen —
  // beim Wechsel von der Erkundung aufs Spielfeld baute React sie neu
  // auf, und die Blenden-Animation lief dadurch ein ZWEITES Mal.
  return (
    <>
      {renderBody()}
      <CampaignAnte
        ante={ante}
        onPick={(name) => { if (duelState) socket.emit('campaign_ante_pick', { roomId: duelState.roomId, cardName: name }); }}
        onClose={() => setAnte(null)}
      />
      <CampaignCardReveal reveal={cardReveal} onAdvance={advanceReveal} />
      <CampaignDuelIntro
        intro={duelIntro}
        unit={(story && story.world && story.world.assets && story.world.assets.avatarUnit) || 10}
      />
    </>
  );
}

window.CampaignScreen = CampaignScreen;
window.CampaignDeckEditor = CampaignDeckEditor;
