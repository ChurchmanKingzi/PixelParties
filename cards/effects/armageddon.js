const { isSeat } = require('./_opp');   // N-Spieler: gültiger Sitzindex
// ═══════════════════════════════════════════
//  CARD EFFECT: „Armageddon"
//  Spell (Normal, Destruction Magic Lv3)
//
//  "Deal 50 damage to all targets, including the user. If all Heroes
//   are defeated after this Spell has resolved, the player controlling
//   the most Creatures wins the game. If this results in a draw, you
//   lose the game. You cannot deal any other damage to targets your
//   opponent controls this turn. Immediately end your turn afterwards."
//
//  ── ① „ALL TARGETS, INCLUDING THE USER" ──────────────────────────
//  Wirklich ALLES: beide Seiten, Helden UND Kreaturen, der eigene
//  Wirker eingeschlossen. Die Karte kennt keine Freunde.
//
//  Grundschaden 50, plus 100 je „Ifrit" auf dem Brett —
//  ★ ueber BEIDE Seiten gezaehlt („any player activates" steht auf
//  Ifrit, der Aufschlag gehoert also nicht einer Seite). Der Betrag
//  kommt aus Ifrits eigenem `armageddonBonus`, damit die Zahl an EINER
//  Stelle steht.
//
//  Ausgenommen sind nur, was sich ausdruecklich ausnimmt:
//    • Ifrit selbst (`immuneToSourceNames`, v1100),
//    • Damus, solange er mindestens eine Ifrit kontrolliert.
//
//  ── ② DIE SIEGBEDINGUNG GREIFT NUR BEI TOTALER AUSLOESCHUNG ──────
//  ★ Al 14.9. ausdruecklich: „Armageddons unique Zielbedingung ist nur
//  fuer wenn WIRKLICH ALLE sterben. Sind nur die Heroes EINES Spielers
//  tot, gewinnt ganz normal der andere."
//
//  Das ist der Fall, der beim Bauen schiefgeht: „if all Heroes are
//  defeated" heisst ALLE auf BEIDEN Seiten. Bleibt auch nur ein Held
//  stehen — typischerweise Damus hinter seiner Ifrit —, laeuft die
//  normale Niederlage-Regel, und die Karte sagt dazu nichts.
//
//  Bei totaler Ausloeschung entscheidet die Zahl der Kreaturen;
//  Gleichstand heisst ausdruecklich: DER WIRKER VERLIERT.
//
//  ── ③ „NO OTHER DAMAGE … THIS TURN" ──────────────────────────────
//  `ps.damageLocked`, gesetzt NACH dem eigenen Schlag
//  (Memory-Blast-Lehre, v1091) — sonst loeschte die Karte ihren eigenen
//  Schaden.
//
//  ── ④ „IMMEDIATELY END YOUR TURN" ────────────────────────────────
//  Zuletzt, und nur wenn das Spiel ueberhaupt weitergeht.
//
//  ── ⑤ CPU-DECK-REGELN (Al, fuer das kommende Structure Deck) ──────
//  `cpuMeta.forcePlay` (siehe unten), zwei harte Regeln:
//    • AUSLOESCHUNG: Richtet Armageddon mit seinem Gesamtschaden (50 + 100
//      je Ifrit auf dem Brett) genug an, um ALLE Helden der Gegnerseite zu
//      toeten, wird es IMMER gewirkt. Ob das stimmt, misst ein Trockenlauf
//      des echten Schlags im Sandkasten (`vorschauSimuliert`): sichtbare
//      Schadensminderung (Tempeste …) rechnet so die Engine selbst ein;
//      Verdecktes (Gegnerhand, Surprises) bleibt draussen.
//    • ZWEI SCHLAEGE: Toetet es den Helden mit den meisten HP in zwei
//      Schlaegen (2 × Schaden >= HP), wird es mit extrem hoher Wahrschein-
//      lichkeit gewirkt (Vorgabe 0,97, ersetzbar durch einen gelernten Wert
//      im Profil: `ruleParams["armageddon.zweiHitWahrscheinlichkeit"]`).
//  Beide gelten NICHT, wenn der Schlag die CPU selbst verlieren liesse
//  (alle eigenen Helden tot und nicht mehr Kreaturen als der Gegner —
//  Gleichstand heisst: der Wirker verliert). „IMMER" meint „immer, wenn es
//  die Gegnerseite ausloescht", nicht „auch wenn es die Partie kostet".
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');
const { hasCardType } = require('./_hooks');
const { IFRIT, ARMAGEDDON, ifritsOf, damusEffektWirkt, damusPlatzierungOffen } = require('./_apocalypse-shared');

const CARD_NAME = ARMAGEDDON;
const GRUNDSCHADEN = 50;

/**
 * ★ Der Schadensaufschlag, an EINER Stelle.
 * Jede Ifrit auf dem Brett — egal wessen — bringt ihren eigenen Bonus
 * mit („any player activates").
 */
function schaden(engine) {
  let summe = GRUNDSCHADEN;
  for (let pi = 0; pi < engine.playerCount(); pi++) {
    for (const inst of ifritsOf(engine, pi)) {
      summe += loadCardEffect(inst.name)?.armageddonBonus || 0;
    }
  }
  return summe;
}

/** Ist dieser Held gegen Armageddon gefeit? */
/** Kreaturen, die `p` gerade kontrolliert. */
function zaehleKreaturen(engine, p) {
  // ★ GEZAEHLT WIRD AUS DEN ZONEN, nicht aus `cardInstances`.
  // Die Instanzliste wird waehrend eines Schadens-Batches neu
  // aufgebaut; eine Kreatur konnte dann noch `zone === 'support'`
  // tragen und trotzdem nicht mehr in der Liste stehen. Die Zaehlung
  // stand dadurch immer auf 0:0 — und weil Gleichstand „du verlierst"
  // heisst, verlor der Wirker jedes Mal. Die Zonen sind der
  // massgebliche Brettzustand.
  // Kontrolle statt Seite (Styx 28.9.): seitenfremde Kreaturen (ueber
  // einen geliehenen Helden beschworen) zaehlen fuer ihren KONTROLLEUR.
  // Die Instanz dient nur zur Bestimmung des Kontrolleurs; fehlt sie
  // (Batch-Umbau, s.o.), gilt die Seite.
  let n = 0;
  for (let seite = 0; seite < engine.playerCount(); seite++) {
    const ps = engine.gs.players[seite];
    (ps?.supportZones || []).forEach((zonen, hi) => (zonen || []).forEach((slot, si) => {
      const name = (slot || [])[0];
      if (!name) return;
      const inst = engine.cardInstances.find(c => c.zone === 'support'
        && c.owner === seite && c.heroIdx === hi && c.zoneSlot === si);
      const cd = (inst ? engine.getEffectiveCardData(inst) : null) || engine._getCardDB()[name] || {};   // wirksame Daten (Als Sweep 9.10.)
      if (!hasCardType(cd, 'Creature') && !hasCardType(cd, 'Token')) return;
      if ((inst ? (inst.controller ?? inst.owner) : seite) === p) n++;
    }));
  }
  return n;
}

/**
 * ★ `getEffectiveCardData` liefert ein UEBERSCHREIBUNGS-Objekt, das
 * `cardType` nicht enthalten muss. Wer nur daraus liest, findet NIE
 * eine Kreatur — die Zaehlung stand dadurch immer auf 0:0 und der
 * Wirker verlor jedes Mal. Deshalb die Datenbank als Grundlage und die
 * Ueberschreibung nur obendrauf.
 */
function istKreatur(engine, inst) {
  const basis = engine._getCardDB()[inst.name] || {};
  const ueber = engine.getEffectiveCardData(inst) || {};
  const cdE = ueber.cardType ? ueber : basis;
  return hasCardType(cdE, 'Creature') || hasCardType(cdE, 'Token');   // 'Creature/Token', 'Spell/Creature', Artifact Creatures (Als Sweep 9.10.)
}

function heldGefeit(engine, pi, heroIdx) {
  // Genau DIESER Held muss Damus' Effekt tragen (als Damus oder als
  // gewonnener Effekt, Pseudonia) — nicht „irgendein Damus auf der Seite".
  if (!damusEffektWirkt(engine, pi, heroIdx)) return false;
  const hero = engine.gs.players[pi]?.heroes?.[heroIdx];
  // „While you control at least 1 «Ifrit» Creature." — „you" = Kontrolleur (Styx 28.9.)
  return ifritsOf(engine, engine.heroSideOf(pi, hero)).length > 0;
}

/**
 * ★ Die Zielliste des Schlags — EINE Stelle fuer die echte Karte (`onPlay`)
 * und die CPU-Vorschau (Trockenlauf), damit beide nie auseinanderlaufen.
 * Alles auf dem Brett, beide Seiten: lebende Helden (ausser Damus hinter
 * seiner Ifrit) und alle offenen Kreaturen. Ifrit selbst faengt der
 * Schadensweg ab (`immuneToSourceNames`) — hier nicht doppelt filtern, sonst
 * liefe die Regel an zwei Stellen auseinander.
 */
function sammleZiele(engine) {
  const gs = engine.gs;
  const helden = [];
  const kreaturen = [];
  for (let p = 0; p < engine.playerCount(); p++) {
    const sp = gs.players[p];
    for (let hi = 0; hi < (sp?.heroes || []).length; hi++) {
      const hero = sp.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (heldGefeit(engine, p, hi)) continue;     // Damus hinter Ifrit
      helden.push({ hero, p, hi });
    }
  }
  for (const inst of (engine.cardInstances || [])) {
    if (inst.zone !== 'support' || inst.faceDown) continue;
    if (!istKreatur(engine, inst)) continue;
    kreaturen.push(inst);
  }
  const ziele = [
    ...helden.map(h => ({ type: 'hero', owner: h.p, heroIdx: h.hi })),
    ...kreaturen.map(inst => ({ type: 'creature', inst })),
  ];
  return { helden, kreaturen, ziele };
}

// ─── CPU-Deck-Regeln ──────────────────────────────────────────────────

/** Rangfolge unter erzwungenen Karten (groesser = frueher; Ifrit-Rueckfall = 1). */
const RANG_AUSLOESCHUNG = 3;
const RANG_ZWEI_HIT = 2;

/**
 * Vorgabe der Zwei-Schlaege-Regel. Eine Setzung, kein gelernter Wert: das
 * Profil des Decks ersetzt sie ueber `ruleParams[REGEL_ZWEI_HIT]`
 * (`_deck-profile.ruleParam`) — dort ist die Naht fuer spaeteres Lernen.
 */
const REGEL_ZWEI_HIT = 'armageddon.zweiHitWahrscheinlichkeit';
const ZWEI_HIT_WAHRSCHEINLICHKEIT = 0.97;

/** Wie viele Kreaturen von `p` stehen NACH einem Schlag mit `dmg` noch? (nur lesen) */
function kreaturenNachSchlag(engine, p, dmg) {
  let n = 0;
  for (let seite = 0; seite < engine.playerCount(); seite++) {
    const ps = engine.gs.players[seite];
    (ps?.supportZones || []).forEach((zonen, hi) => (zonen || []).forEach((slot, si) => {
      const name = (slot || [])[0];
      if (!name) return;
      const inst = engine.cardInstances.find(c => c.zone === 'support'
        && c.owner === seite && c.heroIdx === hi && c.zoneSlot === si);
      const basis = engine._getCardDB()[name] || {};
      const kreatur = inst ? istKreatur(engine, inst)
        : (hasCardType(basis, 'Creature') || hasCardType(basis, 'Token'));
      if (!kreatur) return;
      if (((inst ? (inst.controller ?? inst.owner) : seite)) !== p) return;
      // Verdeckte Karten trifft Armageddon nicht (siehe onPlay).
      const gefeit = !!inst?.faceDown
        || (loadCardEffect(name)?.immuneToSourceNames || []).some(x => ARMAGEDDON.includes(x) || x.includes(ARMAGEDDON));
      const hp = (inst ? engine.getEffectiveCardData(inst)?.hp : null) ?? basis.hp ?? Infinity;
      const rest = hp - (inst?.counters?.damageTaken || 0);
      if (gefeit || rest > dmg) n++;
    }));
  }
  return n;
}

/**
 * Ergebnis einer Vorschau (beide Wege liefern dieselbe Form):
 *   dmg                 Gesamtschaden des Schlags (50 + 100 je Ifrit)
 *   helden[]            { eigen, hp, wirkung, tot } je LEBENDEM Helden —
 *                       `wirkung` = Schaden, der pro Schlag wirklich ankommt
 *                       (nach Minderung); bei Tod mindestens die HP
 *   kreaturen           { meine, seine } nach dem Schlag, oder null (dann rechnet
 *                       `kreaturenNachSchlag` bei Bedarf)
 *   quelle              'sandkasten' | 'rechnung'
 */

/**
 * ★ VORSCHAU PER TROCKENLAUF (der genaue Weg).
 *
 * Fuehrt den echten Schlag (`dealDamageToTargets` mit denselben Zielen und
 * Optionen wie `onPlay`) im Sandkasten der Suche aus und liest ab, was mit
 * jedem Helden passiert. Damit rechnet die ENGINE selbst jede SICHTBARE
 * Schadensaenderung ein — Tempeste (−100 auf ihre anderen Helden, ihr
 * eigener Schaden unreduzierbar), Resistance & Co., Schilde, Status,
 * Immunitaeten, Todesaufschub — ohne dass dieser Code sie kennt.
 *
 * VERDECKTES bleibt draussen (Al: nur, was die CPU SEHEN kann): im
 * Sandkasten haben die Gegner weder Surprises noch Handkarten, es gibt also
 * keine Reaktion, die die CPU nicht kennen koennte. Danach stellt
 * `dryRun` alles wieder her.
 *
 * Liefert `null`, wenn kein Trockenlauf moeglich ist oder er scheitert.
 */
async function vorschauSimuliert(engine, pi, heroIdx, helpers) {
  if (typeof helpers?.dryRun !== 'function') return null;
  const dmg = schaden(engine);
  let out;
  try {
  out = await helpers.dryRun(engine, async () => {
    const gs = engine.gs;
    for (let p = 0; p < engine.playerCount(); p++) {
      if (p === pi) continue;
      const sp = gs.players[p];
      if (!sp) continue;
      sp.hand = [];
      sp.surpriseZones = (sp.surpriseZones || []).map(() => []);
    }
    const { ziele } = sammleZiele(engine);
    // Auch Damus hinter seiner Ifrit gehoert in die Ergebnisliste (er ist nur kein Ziel).
    const vorher = [];
    for (let p = 0; p < engine.playerCount(); p++) {
      (gs.players[p]?.heroes || []).forEach((hero, hi) => {
        if (hero?.name && hero.hp > 0) vorher.push({ p, hi, hero, hp: hero.hp });
      });
    }
    gs._deferGameOverCheck = (gs._deferGameOverCheck || 0) + 1;
    try {
      await engine.dealDamageToTargets(
        { name: CARD_NAME, owner: pi, controller: pi, heroIdx },
        ziele,
        { damage: dmg, damageType: 'destruction_spell', sourceName: CARD_NAME, istFlaeche: true, hitDelay: 0, bilderGespielt: true },
      );
    } finally {
      gs._deferGameOverCheck = Math.max(0, (gs._deferGameOverCheck || 1) - 1);
    }
    const ergebnis = vorher.map(({ p, hi, hero, hp }) => {
      const jetzt = Math.max(0, hero.hp);
      const tot = jetzt <= 0;
      return {
        eigen: engine.heroSideOf(p, hero) === pi,
        hp, tot,
        wirkung: tot ? Math.max(hp, hp - jetzt) : hp - jetzt,
      };
    });
    return {
      helden: ergebnis,
      kreaturen: {
        meine: zaehleKreaturen(engine, pi),
        seine: zaehleKreaturen(engine, engine.opponentOf(pi)),
      },
    };
  });
  } catch {
    // Schon der Snapshot kann am Ueberlast-Schutz der Suche scheitern — dann Handrechnung.
    return null;
  }
  if (!out || !Array.isArray(out.helden)) return null;
  return { dmg, helden: out.helden, kreaturen: out.kreaturen, quelle: 'sandkasten' };
}

/**
 * Vorschau per HANDRECHNUNG (Rueckfall, wenn kein Trockenlauf geht): Gesamt-
 * schaden gegen die aktuellen HP, Damus' Immunitaet und die Ziel-Immunitaeten
 * der CPU (`isTargetImmune`). Sie kennt KEINE Schadensminderung durch Karten —
 * der Sandkasten ist deshalb der Hauptweg.
 */
function vorschauRechnung(engine, pi, helpers) {
  const dmg = schaden(engine);
  const helden = [];
  for (let p = 0; p < engine.playerCount(); p++) {
    (engine.gs.players[p]?.heroes || []).forEach((hero, hi) => {
      if (!hero?.name || hero.hp <= 0) return;
      const immun = heldGefeit(engine, p, hi)
        || !!helpers?.isTargetImmune?.(engine, { type: 'hero', owner: p, heroIdx: hi });
      const tot = !immun && hero.hp <= dmg;
      helden.push({ eigen: engine.heroSideOf(p, hero) === pi, hp: hero.hp, tot, wirkung: immun ? 0 : (tot ? hero.hp : dmg) });
    });
  }
  return { dmg, helden, kreaturen: null, quelle: 'rechnung' };
}

/** Wuerde die CPU durch den Schlag die Partie verlieren? (Gleichstand = ja) */
function waereSelbstmord(engine, pi, v) {
  const eigene = v.helden.filter(h => h.eigen);
  const gegner = v.helden.filter(h => !h.eigen);
  const gegnerUeber = gegner.filter(h => !h.tot).length;
  const eigeneUeber = eigene.filter(h => !h.tot).length;
  if (gegnerUeber > 0) return eigeneUeber === 0;   // wir tot, sie nicht
  if (eigeneUeber > 0) return false;                // sie tot, wir nicht → Sieg
  // Totale Ausloeschung: die Kreaturen entscheiden, Gleichstand verliert der Wirker.
  const meine = v.kreaturen ? v.kreaturen.meine : kreaturenNachSchlag(engine, pi, v.dmg);
  const seine = v.kreaturen ? v.kreaturen.seine : kreaturenNachSchlag(engine, engine.opponentOf(pi), v.dmg);
  return !(meine > seine);
}

/**
 * Sind der oder die Gegner-Helden mit den MEISTEN HP in zwei Schlaegen tot?
 * Zweimal derselbe Schlag: 2 × (was wirklich ankommt) >= HP. Gleichstand bei den
 * HP: alle muessen es sein (vorsichtig). Wirkt ein Held gar nicht (gefeit,
 * voll gemindert), ist er nie zu toeten.
 */
function tankInZweiSchlaegen(v) {
  const gegner = v.helden.filter(h => !h.eigen);
  if (gegner.length === 0) return false;
  const maxHp = Math.max(...gegner.map(h => h.hp));
  return gegner.filter(h => h.hp === maxHp).every(h => h.tot || (h.wirkung > 0 && 2 * h.wirkung >= h.hp));
}

/**
 * Kurzer Fingerabdruck der Lage, in der eine Vorschau gilt: HP, Status und
 * Ruestung der Helden, Brettkarten, Wirker. Aendert sich etwas davon (Ifrit
 * gelegt, Held verletzt), wird neu gerechnet.
 */
function lageSignatur(engine, pi, heroIdx) {
  const helden = engine.gs.players.map(ps => (ps?.heroes || []).map(h =>
    h?.name ? `${h.name}:${h.hp}:${Object.keys(h.statuses || {}).filter(k => h.statuses[k]).join('/')}:${(h.gainedEffectNames || []).length}` : '-').join(','));
  return `${engine.gs.turn}|${pi}|${heroIdx}|${helden.join(';')}|${(engine.cardInstances || []).length}`;
}

/** Einmaliger Wurf je (Zug, Spieler, Regel) — ohne Cache wuerfe jede Abfrage neu. */
function wurfJeZug(engine, pi, regel) {
  const key = `${engine.gs.turn || 0}:${pi}:${regel}`;
  if (!engine._regelWuerfe) engine._regelWuerfe = new Map();
  if (!engine._regelWuerfe.has(key)) engine._regelWuerfe.set(key, Math.random());
  return engine._regelWuerfe.get(key);
}

module.exports = {
  /**
   * ★ CPU-Deck-Regeln (⑤ oben). Siehe `cpuMeta.forcePlay` in _cpu.js.
   * Rueckgabe: Rangzahl (Ausloeschung 3, zwei Schlaege 2) oder false.
   */
  cpuMeta: {
    async forcePlay(engine, pi, heroIdx, helpers) {
      // Sichtbare Schadensminderung (Tempeste …) zaehlt: erst der Trockenlauf, die
      // Handrechnung nur als Rueckfall. Ein Ergebnis je Lage genuegt — die Aktionsphase
      // fragt je Wirker-Kandidat einmal.
      const sig = lageSignatur(engine, pi, heroIdx);
      let v = engine._armageddonVorschau?.sig === sig ? engine._armageddonVorschau.v : null;
      if (!v) {
        v = (await vorschauSimuliert(engine, pi, heroIdx, helpers)) || vorschauRechnung(engine, pi, helpers);
        engine._armageddonVorschau = { sig, v };
      }
      if (!v.helden.some(h => !h.eigen)) return false;
      if (waereSelbstmord(engine, pi, v)) return false;
      // ① Gegnerseite komplett tot → IMMER.
      if (v.helden.filter(h => !h.eigen).every(h => h.tot)) return RANG_AUSLOESCHUNG;
      // ② Held mit den meisten HP in zwei Schlaegen tot → fast immer.
      // Steht Damus' Ifrit-Platzierung dieses Zuges noch aus, kommt sie zuerst:
      // Armageddon beendet den Zug, die „jede Runde eine Ifrit"-Regel waere
      // verletzt. (Ifrit macht den Schlag ausserdem 100 staerker.)
      if (damusPlatzierungOffen(engine, pi)) return false;
      if (!tankInZweiSchlaegen(v)) return false;
      const p = require('./_deck-profile').ruleParam(engine, pi, REGEL_ZWEI_HIT, ZWEI_HIT_WAHRSCHEINLICHKEIT);
      return wurfJeZug(engine, pi, REGEL_ZWEI_HIT) < p ? RANG_ZWEI_HIT : false;
    },
  },

  // ★★ v1181 — ENTKOPPELTE ZAUBERBILDER (Al 17.9.): Wird der Zauber
  // NEGIERT, laeuft sein Effekt-Rumpf nie — die Engine spielt dann diese
  // Bilder, damit der abgewehrte Zauber trotzdem zu sehen ist. Im
  // normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  // Negiert: dieselbe Feuerwelle wie im Effekt (Brett-Zone, volle Laufzeit), mittlere Wucht.
  async spellVisual(engine, info) {
    if (info.schonGezeigt?.zone?.has('armageddon')) return;   // der Effekt hat sein Bild schon gespielt
    const staerke = 0.6;
    engine._broadcastEvent('play_zone_animation', {
      type: 'armageddon', power: staerke, damage: 270,
      duration: Math.round(1800 + 1400 * staerke),
      zoneType: 'board', owner: info.heroOwner ?? info.owner ?? 0, heroIdx: -1, zoneSlot: -1,
      originOwner: info.heroOwner ?? info.owner ?? 0, originHeroIdx: info.heroIdx ?? 0,
    });
    await engine._delay(Math.round(650 + 450 * staerke));
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;

      const dmg = schaden(engine);
      const quelle = { name: CARD_NAME, owner: pi, controller: pi, heroIdx: ctx.cardHeroIdx };

      // ── ① Alles einsammeln, BEVOR etwas faellt ───────────────────
      const { helden, kreaturen, ziele } = sammleZiele(engine);

      // ★★ v1146 (Al 17.9.): eigene Animation — Feuerball vom Wirker,
      // der das ganze Brett einhuellt, Flammen und Feuerregen. Staerke
      // skaliert mit dem Schaden: 50 → Glimmen, ab 450 → volle Wucht.
      // Obere Ebene (kein `layer: 'background'`): das Feuer liegt UEBER
      // den Karten. Gewartet wird, bis die Welle das Brett erreicht hat.
      // Animation VOR dem Reaktionsfenster; bei Negation kein zweites Bild (`bilderGespielt`).
      const feuerwelle = async () => {
        const staerke = Math.max(0.1, Math.min(1, dmg / 450));
        engine._broadcastEvent('play_zone_animation', {
          type: 'armageddon', power: staerke, damage: dmg,
          duration: Math.round(1800 + 1400 * staerke),
          zoneType: 'board', owner: pi, heroIdx: -1, zoneSlot: -1,
          originOwner: pi, originHeroIdx: ctx.cardHeroIdx,
        });
        await engine._delay(Math.round(650 + 450 * staerke));
      };

      // ═══ ZWEI KLAMMERN UM DEN SCHLAG ════════════════════════════
      //
      // ★ (a) SPIELENDE-PRUEFUNG ANHALTEN (`_deferGameOverCheck`,
      // Bunny-Bombs-Vertrag). Trifft eine Karte das ganze Brett, darf
      // nicht der erste toedliche Treffer das Spiel entscheiden — sonst
      // haengt der Ausgang an der Reihenfolge, in der die Ziele
      // abgearbeitet werden. Genau darum geht es bei Armageddon.
      //
      // ★ (b) DEN VERLIERER EINES UNENTSCHIEDENS BENENNEN
      // (`_drawLoserIdx`). Die Engine kennt den Fall „beide Seiten
      // ausgeloescht" bereits und fragt diesen Hinweis. Armageddon setzt
      // ihn NICHT pauschal auf den Wirker, sondern nach der Kartenregel:
      // wer mehr Kreaturen kontrolliert, gewinnt — bei Gleichstand
      // verliert der Wirker.
      //
      // ★ (c) Ein einziger Flaechenschlag — AoE-Klammer (v1060).
      const zielzahl = helden.length + kreaturen.length;
      const vorherDrawLoser = gs._drawLoserIdx;
      gs._deferGameOverCheck = (gs._deferGameOverCheck || 0) + 1;
      // ★ GEZAEHLT WIRD HINTERHER — und zwar bewusst (Al 14.9.).
      //
      // Meine erste Fassung zog die Zaehlung VOR die Heldenschlaege, mit
      // der Begruendung, der Tod der letzten Heldenreihe raeume das
      // Brett mit ab. Das ist FALSCH: Kreaturen ueberleben den Tod ihres
      // Helden. Die leeren Zonen, die mich auf die Idee brachten, kamen
      // von einem eigenen Fehler in der Ifrit-Immunitaet.
      //
      // Und es ist nicht nur harmlos, sondern WICHTIG, hinterher zu
      // zaehlen: Armageddon toetet selbst Kreaturen. Wer vorher zaehlt,
      // zaehlt Kreaturen mit, die der Zauber gerade weggeraeumt hat —
      // „the player controlling the most Creatures" meint den Stand
      // NACH der Aufloesung.
      // ★★ Prinzip fuer jeden Flaechenschlag (Al 3.10.): markieren (Immunitaeten inklusive) → die
      // getroffenen Ziele reagieren (Helden-Surprises (nicht „chosen by"), Hand-Reaktionen — VOR dem
      // ersten Schaden; negiert eine, faellt ALLES weg) → alle Ziele nehmen Schaden → ERST DANN werden
      // die Tode ausgewertet. Das macht `dealDamageToTargets` (Klammer + Anti-AoE-Fenster inklusive).
      let res;
      try {
        await feuerwelle();   // Feuerwelle VOR dem Reaktionsfenster, genau einmal
        res = await engine.dealDamageToTargets({ ...quelle, cardInstance: ctx.card }, ziele, {
          damage: dmg, damageType: 'destruction_spell', sourceName: CARD_NAME,
          istFlaeche: true, hitDelay: 0,
          bilderGespielt: true,
        });
      } finally {
        gs._deferGameOverCheck = Math.max(0, (gs._deferGameOverCheck || 1) - 1);
      }
      if (res?.cancelled) { engine.sync(); return; }   // negiert: nichts geschieht, kein Zugende, keine Schadenssperre

      // ── Wer gewinnt, falls WIRKLICH alle Helden gefallen sind? ────
      // ★ Al 14.9.: die Sonderregel gilt NUR fuer die totale
      // Ausloeschung. Steht auch nur ein Held — typischerweise Damus
      // hinter seiner Ifrit —, entscheidet die normale Regel, und die
      // Engine kommt hier ohnehin nie in den Unentschieden-Zweig.
      const meine = zaehleKreaturen(engine, pi);
      const seine = zaehleKreaturen(engine, engine.opponentOf(pi));
      const oppIdx = engine.opponentOf(pi);
      // „the player controlling the MOST Creatures wins" / „if this
      // results in a DRAW, YOU lose" → bei Gleichstand ist der Wirker
      // der Verlierer.
      gs._drawLoserIdx = (meine > seine) ? oppIdx : pi;

      try {
        await engine.checkAllHeroesDead();
      } finally {
        if (isSeat(gs, vorherDrawLoser)) gs._drawLoserIdx = vorherDrawLoser;
        else delete gs._drawLoserIdx;
      }
      if (gs.result) { engine.sync(); return; }   // Spiel ist entschieden

      // ── ③ Keine weitere Schadensquelle diese Runde ───────────────
      ps.damageLocked = true;
      engine.log('armageddon', {
        player: ps.username, damage: dmg, targets: zielzahl,
        eigeneKreaturen: meine, fremdeKreaturen: seine,
      });
      engine.log('damage_locked', { player: ps.username, by: CARD_NAME });

      // ── ④ „Immediately end your turn afterwards." ────────────────
      // ★ `_terrorForceEndTurn` ist der kanonische Hebel der Engine,
      // einen Zug in die End Phase zu zwingen — trotz des Namens nicht
      // Terror-spezifisch, sondern der einzige vorhandene Weg.
      gs._terrorForceEndTurn = pi;
      gs._terrorForceEndSource = { name: CARD_NAME, owner: pi };
      engine.sync();
    },
  },
};
