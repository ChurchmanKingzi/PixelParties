// ═══════════════════════════════════════════
//  Shared helpers for the Monia family (v668).
//
//  Aufstieg „Cool Rescuer Monia" → „Monia Bot, the Foretold Rescuer of
//  Coolness": sie muss „Cool Tech Jetpack" tragen. Die Bereitschaft
//  pflegt der Basisheld ueber den sync-getriebenen Vertrag
//  `refreshAscensionReadiness` (Dajan-Muster) — das Jetpack kommt fast
//  nie ueber den normalen Spielweg (es wirft sich sofort ab), sondern
//  ueber Cool Repair, das seine eigenen Zonen-Hooks feuert; ein
//  sync-Refresh deckt alle Wege. Die Bedingung steht nur hier.
// ═══════════════════════════════════════════

const BASE_MONIA    = 'Cool Rescuer Monia';
const ASCEND_TARGET = 'Monia Bot, the Foretold Rescuer of Coolness';
const JETPACK_NAME  = 'Cool Tech Jetpack';

function findBaseMonia(engine, pi, heroIdx) {
  let hero = engine.gs.players[pi]?.heroes?.[heroIdx];
  let actualOwner = pi;
  if (!hero || hero.name !== BASE_MONIA) {
    hero = null;
    for (let p = 0; p < engine.playerCount(); p++) {
      const h = engine.gs.players[p]?.heroes?.[heroIdx];
      if (h?.name === BASE_MONIA) { hero = h; actualOwner = p; break; }
    }
  }
  return hero ? { hero, actualOwner } : null;
}

/** Nach EFFEKTIVER Identitaet (Copy Device legt fremde Namen als Override). */
function hasEquipped(engine, owner, heroIdx, name, excludeInstId) {
  return engine.cardInstances.some(c =>
    c.id !== excludeInstId && c.owner === owner && c.zone === 'support'
    && c.heroIdx === heroIdx && (c.counters?._effectOverride || c.name) === name);
}

function moniaAscensionMet(engine, pi, heroIdx, excludeInstId) {
  const found = findBaseMonia(engine, pi, heroIdx);
  if (!found || found.hero.hp <= 0) return false;
  return hasEquipped(engine, found.actualOwner, heroIdx, JETPACK_NAME, excludeInstId);
}

function checkMoniaAscension(engine, pi, heroIdx, excludeInstId) {
  const found = findBaseMonia(engine, pi, heroIdx);
  if (!found) return;
  const { hero } = found;
  if (moniaAscensionMet(engine, pi, heroIdx, excludeInstId)) {
    if (hero.ascensionReady && hero.ascensionTarget === ASCEND_TARGET) return;
    hero.ascensionReady   = true;
    hero.ascensionTarget  = ASCEND_TARGET;
    hero.ascensionTargets = [ASCEND_TARGET];
  } else if (hero.ascensionReady) {
    delete hero.ascensionReady;
    delete hero.ascensionTarget;
    delete hero.ascensionTargets;
  }
}

// ═══════════════════════════════════════════
//  ★ W58a (Al, 22.10.2026) — „Whenever 1 or more Creatures either player controls would be affected by a card or effect, you may
//  discard 2 cards to negate any effects that card or effect has on all Creatures." Die Einmal-pro-Zug-Sperre (`monia-protect`) ist weg.
//
//  Statt der Zugsperre gilt: JEDE Karte / JEDER Effekt, der mindestens eine Kreatur betreffen wuerde, oeffnet das Angebot erneut
//  (jede Annahme kostet erneut die Karten) — aber je Karte/Effekt nur EIN Angebot je Kontrolleur, auch wenn der Effekt mehrere Kreaturen
//  trifft oder in mehreren Schadensstapeln ablaeuft (Kettenblitz, Mehrfachziele, Statuswirkung auf jede Kreatur einzeln).
//
//  ★ W77a (Al, 26.10.2026) — BEIDE SEITEN AUF EINMAL: das Angebot ist EIN Angebot je Karte/Effekt (nicht je Seite). Annahme negiert ALLE Wirkungen
//  der Karte/des Effekts auf ALLE Kreaturen beider Spieler („… on all Creatures"); Ablehnung gilt fuer den ganzen Effekt (keine zweite Frage fuer die
//  andere Seite). Nicht-Kreaturen-Ziele (Helden, Karten, Gold …) laufen unveraendert weiter.
//  ★ W77a (Al, Balancing): die Kosten sind 2 Handkarten (`KOSTEN`), gewaehlt NACH der Annahme (abbrechbarer `handPick`, Abbruch = Angebot abgelehnt,
//  nichts bezahlt), als EIN Batzen bestaetigt und nacheinander abgeworfen; Boris darf den Abwurf ignorieren (die Negation gilt trotzdem).
//
//  Buchfuehrung `gs._moniaAngebote` = [{ key, pi, seite }] fuer die LAUFENDE Aufloesung:
//    · `key`   Name der ausloesenden Karte/des Effekts (`quellName`), '' wenn unbekannt,
//    · `pi`    Kontrolleur der Monia, der gefragt wurde,
//    · `seite` ALLE_SEITEN (angenommen — schuetzt alle Kreaturen beider Seiten) bzw. null (abgelehnt — nicht noch einmal fragen).
//  Sie endet mit der Aufloesung — dieselben Stellen wie die Schildmarke `_moniaShieldActive` (`engine.endeEffektImmunitaeten`, Monias
//  `afterSpellResolved`/`onTurnStart`). Die naechste Aktion/der naechste Effekt fragt also wieder.
// ═══════════════════════════════════════════

/** Abwurfkosten des Angebots (W77a, Balancing: vorher 1 Karte). */
const KOSTEN = 2;
/** Wert von `seite` bei einem angenommenen Angebot: der Schild gilt fuer beide Seiten zugleich. */
const ALLE_SEITEN = 'alle';

/** Name der Karte/des Effekts aus einer Quelle (String, Instanz oder { name | cardName }); sonst ''. */
function quellName(q) {
  if (!q) return '';
  if (typeof q === 'string') return q;
  return q.cardName || q.name || '';
}

/** Das angenommene Angebot dieser Aufloesung fuer diese Karte/diesen Effekt (egal welcher Kontrolleur), sonst undefined. */
function angenommenesAngebot(gs, key) {
  return (gs?._moniaAngebote || []).find(a => a.key === key && a.seite != null);
}

/**
 * Hat dieser Kontrolleur das Angebot fuer diese Karte/diesen Effekt in dieser Aufloesung schon abgelehnt?
 * ★ W77a: eine Ablehnung gilt fuer den GANZEN Effekt (beide Seiten) — W71b hatte sie noch je Seite gefuehrt.
 */
function angebotAbgelehnt(gs, key, pi) {
  return (gs?._moniaAngebote || []).some(a => a.key === key && a.pi === pi && a.seite == null);
}

/** Angebot festhalten: `angenommen` (true → `ALLE_SEITEN`) oder abgelehnt (`false`/`null`). */
function angebotMerken(gs, key, pi, angenommen) {
  if (!gs) return;
  if (!Array.isArray(gs._moniaAngebote)) gs._moniaAngebote = [];
  gs._moniaAngebote.push({ key, pi, seite: angenommen ? ALLE_SEITEN : null });
}

/**
 * Ende der Aufloesung: Schildmarke und Angebote fallen.
 * ★ W80a (Al, 26.10.2026): ein Zweitwurf der Zusatzziel-Helden (Bartas, Grisgar, Andras: "you may choose a second target for the Spell to hit afterwards") ist derselbe Spell,
 * der erneut schlaegt — also derselbe Effekt. Monias `afterSpellResolved` (Reihenfolge der Zuhoerer ist nicht festgelegt) raeumt die Angebote noch VOR dem Zweitwurf ab; mit
 * `fuerZweitwurf` legt es den Stand vorher beiseite (`gs._moniaZweitwurf`), und der Zweitwurf holt ihn mit `zweitwurfFortsetzen` zurueck: ein angenommenes Angebot negiert auch den
 * Zweitwurf (keine zweite Zahlung), ein abgelehntes gilt auch fuer ihn (keine neue Frage). Das Beiseitegelegte endet mit der Aufloesung (`engine.endeEffektImmunitaeten`).
 */
function angeboteBeenden(gs, opts = {}) {
  if (!gs) return;
  if (opts.fuerZweitwurf && (gs._moniaAngebote?.length || gs._moniaShieldActive != null)) {
    gs._moniaZweitwurf = {
      angebote: gs._moniaAngebote ? gs._moniaAngebote.map(a => ({ ...a })) : undefined,
      schild: gs._moniaShieldActive, schildQuelle: gs._moniaShieldSource,
      fenster: gs._kreaturFenster ? { ...gs._kreaturFenster } : undefined,
    };
  }
  else if (!opts.fuerZweitwurf) delete gs._moniaZweitwurf;
  delete gs._moniaShieldActive;
  delete gs._moniaShieldSource;
  delete gs._moniaAngebote;
  delete gs._kreaturFenster;   // W71b: Fenster-Buchführung von `engine.kreaturBetroffen`
}

/**
 * ★ W83a (Al 28.10.2026 — Monia × zweiter Cast): „Monia fragt bei einem zweiten Cast ein weiteres Mal separat, beide gelten als je eine Instanz, die einzeln geschützt werden muss."
 * Eine Wiederholung als EIGENER Cast (Saya, Idej Kunagi, Timeless King Zi, Chaos Magic, Love Shot; `_bartasSecondCast`/„cast a second time") ist für Monia ein neuer Effekt mit eigenem
 * Angebot (je 2 Karten): Angebote, Schild und Fenster-Buchführung des ersten Gusses fallen weg, bevor der zweite beginnt. Der Zweitwurf der Zusatzziel-Helden (Bartas, Grisgar, Andras)
 * ist dagegen derselbe Spell (W80a, `zweitwurfFortsetzen`) und ruft das hier NICHT. Wer einen Spell/eine Attack in einem eigenen Durchlauf (`onPlay`) wiederholt, ruft es VOR dem Wiederholungslauf.
 */
function neuerGuss(gs) {
  if (!gs) return;
  delete gs._moniaShieldActive;
  delete gs._moniaShieldSource;
  delete gs._moniaAngebote;
  delete gs._kreaturFenster;
}

/** Zweitwurf beginnt: die beiseitegelegten Angebote des Hauptwurfs gelten weiter (derselbe Effekt). Ohne beiseitegelegten Stand oder bei schon lebenden Angeboten tut es nichts. */
function zweitwurfFortsetzen(gs) {
  const z = gs?._moniaZweitwurf;
  if (!z) return;
  if (!gs._moniaAngebote && gs._moniaShieldActive == null) {
    if (z.angebote) gs._moniaAngebote = z.angebote.map(a => ({ ...a }));
    if (z.schild != null) gs._moniaShieldActive = z.schild;
    if (z.schildQuelle !== undefined) gs._moniaShieldSource = z.schildQuelle;
    if (z.fenster) gs._kreaturFenster = { ...z.fenster, ...(gs._kreaturFenster || {}) };
  }
}

// ── Kosten (W77a): 2 Handkarten ──────────────────────────────────────────

/** Handplaetze, die als Abwurfmaterial taugen: die ganze Hand ohne die gerade aufloesende Karte (Al: eine Karte zaehlt nie als Material fuer ihre eigenen Kosten). */
function kostenPlaetze(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  return engine._handIndizesOhneAufloesende(ps).filter(i => ps.hand[i] != null);
}

/** Kann Monias Kontrolleur die Kosten ueberhaupt zahlen? (Voraussetzung fuers Angebot.) */
function kostenZahlbar(engine, pi) {
  return kostenPlaetze(engine, pi).length >= KOSTEN;
}

/**
 * Kartenwahl der Kosten NACH der Annahme: EIN Batzen (`handPick`, genau `KOSTEN` Karten, Bestaetigen), abbrechbar.
 * Liefert [{ handIndex, cardName }] oder null (Abbruch / ungueltige Antwort → das Angebot gilt als abgelehnt, nichts bezahlt).
 */
async function kostenWaehlen(engine, pi, heroName, cardName) {
  const ps = engine.gs.players[pi];
  const plaetze = kostenPlaetze(engine, pi);
  if (!ps || plaetze.length < KOSTEN) return null;
  const res = await engine.promptGeneric(pi, {
    type: 'handPick',
    costFor: cardName,
    costKind: 'protect',     // v1041 Lernkanal
    title: `${heroName} — Discard ${KOSTEN}`,
    description: `Choose ${KOSTEN} cards from your hand to discard and protect all Creatures.`,
    eligibleIndices: plaetze,
    minSelect: KOSTEN, maxSelect: KOSTEN,
    confirmLabel: `🗑️ Discard ${KOSTEN}`,
    cancellable: true,
    cpuDispatch: cardName,
    moniaKostenWahl: true,   // fuer cpuResponse (CPU waehlt die entbehrlichsten Karten)
    controllerIdx: pi,
  });
  const gewaehlt = res && !res.cancelled && Array.isArray(res.selectedCards) ? res.selectedCards : [];
  if (gewaehlt.length !== KOSTEN) return null;
  // Der Server glaubt dem Client nicht: verschiedene Plaetze, taugliche Karten, Name stimmt.
  const seen = new Set();
  const out = [];
  for (const g of gewaehlt) {
    if (!g || !Number.isInteger(g.handIndex) || seen.has(g.handIndex) || !plaetze.includes(g.handIndex) || ps.hand[g.handIndex] !== g.cardName) return null;
    seen.add(g.handIndex);
    out.push({ handIndex: g.handIndex, cardName: g.cardName });
  }
  return out.sort((x, y) => x.handIndex - y.handIndex);
}

/**
 * Zahlung der gewaehlten Karten: Boris (EINE Frage fuer den ganzen Stapel) darf den Abwurf ignorieren — die Negation gilt trotzdem (Kosten
 * uebersprungen negiert den Effekt nicht). Sonst nacheinander (links → rechts) in EINEM Abwurf-Vorgang (`withDiscardBatch`).
 * @returns {Promise<{ abgeworfen: number, erlassen: boolean }>}
 */
async function kostenZahlen(engine, pi, gewaehlt, cardName) {
  const ps = engine.gs.players[pi];
  if (!ps || !gewaehlt?.length) return { abgeworfen: 0, erlassen: false };
  if (await engine.borisVerzicht(pi, gewaehlt.length, { source: cardName })) return { abgeworfen: 0, erlassen: true };
  let abgeworfen = 0;
  await engine.withDiscardBatch(pi, { source: cardName }, async () => {
    for (const g of gewaehlt) {
      const gedacht = g.handIndex - abgeworfen;
      const idx = ps.hand[gedacht] === g.cardName ? gedacht : ps.hand.indexOf(g.cardName);
      if (idx < 0) continue;
      if (!(await engine.actionDiscardHandCard(pi, g.cardName, idx, { source: cardName, selfInflicted: true }))) break;
      abgeworfen++;
      engine.sync();
    }
  });
  return { abgeworfen, erlassen: false };
}

module.exports = {
  BASE_MONIA, ASCEND_TARGET, JETPACK_NAME, hasEquipped, moniaAscensionMet, checkMoniaAscension,
  quellName, angenommenesAngebot, angebotAbgelehnt, angebotMerken, angeboteBeenden, neuerGuss, zweitwurfFortsetzen,
  KOSTEN, ALLE_SEITEN, kostenPlaetze, kostenZahlbar, kostenWaehlen, kostenZahlen,
};
