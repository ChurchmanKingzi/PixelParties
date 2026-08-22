// ═══════════════════════════════════════════
//  CARD EFFECT: "Future Tech Weathercock"
//  Artifact (Equipment, Cost 5)
//
//  "Equip this card to a Hero you control. When the equipped Hero would
//   be affected by an Attack or Spell that also affects at least 1 other
//   target, you may shuffle 1 \"Future Tech Weathercock\" from your
//   discard pile back into your deck to negate all effects that Attack
//   or Spell would have on the equipped Hero."
//
//  ── Escape Devices Zwilling, mit anderem Preis ──
//  Beide wehren „alle Effekte auf EINEM Helden" ab, aber die
//  Bedingungen sind gegenläufig:
//   • Escape Device: JEDES Ziel-Ereignis, Stufe ≤ Kopien in der Ablage,
//     bezahlt mit Gold und 1× je Held und Zug.
//   • Weathercock: NUR bei Flächeneffekten (mindestens ein weiteres
//     Ziel), keine Stufengrenze — bezahlt damit, dass eine Kopie die
//     Ablage VERLÄSST. Der Archetyp gibt hier also etwas zurück, statt
//     etwas anzuhäufen: jeder Einsatz schwächt alle anderen Karten des
//     Decks ein Stück.
//
//  ── Technisch dieselbe Maschine ──
//  `engine.grantEffectImmunity(owner, heroIdx, sourceCard)` (v543):
//  Schaden UND Status prallen an diesem Helden ab, die Karte trifft
//  alle anderen Ziele normal und läuft sichtbar durch.
//
//  ── Der Kartentyp-Filter (Als Vorgabe 21.8.) ──
//  Nur echte Attack- oder Spell-KARTEN, und Heldeneffekte, die
//  ausdrücklich als Attack oder Spell gelten (Alice, the Puppeteer Girl
//  → `destruction_spell`). Dieselbe Prüfung wie bei Invisibility Cloak;
//  Weathercock liest keine Stufe und kann sie deshalb übernehmen.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { zaehleInAblage } = require('./_future-tech-shared');

const CARD_NAME = 'Future Tech Weathercock';
/** Flugdauer Ablage → Deck, bevor die Karte umgebucht wird. */
const FLUG_MS = 520;

/**
 * Der Held, an dem DIESE Ausrüstung hängt — oder -1.
 *
 * ★ Zuerst über die INSTANZ, die das Reaktionsfenster mitreicht
 * (`opts.inst` / `opts.heroIdx`, ab v575). Der Namensscan darunter ist
 * nur noch der Rückfall für Aufrufer ohne Instanz.
 *
 * Grund: eine Karte mit GELIEHENER IDENTITÄT (Future Tech Copy Device
 * als Weathercock) liegt unter IHREM Namen in der Zone, nicht unter
 * diesem hier — der Namensscan fand sie nie, und die Karte konnte
 * ihren eigenen Wirtshelden nicht bestimmen. Al hat richtig vermutet,
 * dass an Weathercock selbst nichts kaputt ist; kaputt war die
 * Selbstsuche unter fremdem Namen.
 */
function ausgeruesteterHeld(gs, pi, opts) {
  if (opts?.inst && opts.inst.zone === 'support') return opts.inst.heroIdx;
  if (typeof opts?.heroIdx === 'number' && opts.heroIdx >= 0) return opts.heroIdx;
  const ps = gs.players[pi];
  if (!ps) return -1;
  for (let hi = 0; hi < (ps.supportZones || []).length; hi++) {
    for (const slot of (ps.supportZones[hi] || [])) {
      if (Array.isArray(slot) ? slot.includes(CARD_NAME) : slot === CARD_NAME) return hi;
    }
  }
  return -1;
}

module.exports = {
  activeIn: ['support'],

  // Mischt eine Kopie aus der ABLAGE ins eigene Deck zurück — damit
  // greift Distracting Crystal (Als Ruling 16.8.: der Kristall deckt
  // Hand und Ablage ab).
  //
  // ★ Die Flag ALLEIN wäre hier Deko gewesen: alle sieben Stellen, die
  //   sie lesen, sind Aktivierungstore für Abilities, Heldeneffekte
  //   und den Artefakt-Spielweg — eine ausgerüstete Reaktion läuft
  //   durch keines davon (nachgemessen 22.8.). Deshalb steht die
  //   Prüfung unten zusätzlich in `postTargetCondition`, sonst
  //   behauptete die Karte eine Sperre, die niemand durchsetzt.
  shufflesFromHandOrDiscardIntoDeck: true,

  // ★ `isEquippedPostTargetReaction`, NICHT `isPostTargetReaction`
  //   (Als Befund 21.8.: „Weathercock wird nicht aktiviert").
  //   `_checkPostTargetHandReactions` durchsucht — dem Namen nach — nur
  //   die HAND. Eine Ausruestung auf dem Brett wurde deshalb nie
  //   angeboten. Das eigene Flag laesst die Handkarten unberuehrt und
  //   oeffnet einen zweiten Durchgang ueber die Support-Zonen.
  isEquippedPostTargetReaction: true,

  postTargetCondition(gs, pi, engine, targetedHeroes, sourceCard, opts) {
    // Bezahlt wird mit einer Kopie AUS der Ablage — ohne geht nichts.
    if (zaehleInAblage(gs, pi, CARD_NAME) <= 0) return false;
    // Distracting Crystal sperrt das Zurückmischen (siehe die Flag oben).
    if (require('./_crystals-shared').shuffleIntoDeckBlocked(engine, pi)) return false;

    const heroIdx = ausgeruesteterHeld(gs, pi, opts);
    if (heroIdx < 0) return false;

    // Der ausgerüstete Held muss unter den Zielen sein …
    const treffer = (targetedHeroes || []).some(t =>
      t.owner === pi && t.type === 'hero' && t.heroIdx === heroIdx);
    if (!treffer) return false;
    // … UND mindestens ein weiteres Ziel („that also affects at least
    // 1 other target") — egal wem es gehört.
    if ((targetedHeroes || []).length < 2) return false;

    // Kartentyp-Filter wie bei Invisibility Cloak.
    const srcData = sourceCard?.name ? engine._getCardDB()[sourceCard.name] : null;
    if (!srcData) return false;
    const istAngriffOderZauber =
      hasCardType(srcData, 'Attack') || hasCardType(srcData, 'Spell');
    const dmgType = opts?.damageType;
    const typPasstUeberSchaden = dmgType === 'attack' || /_spell$/.test(dmgType || '');
    return istAngriffOderZauber || typPasstUeberSchaden;
  },

  async postTargetResolve(engine, pi, targetedHeroes, sourceCard, opts) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    const heroIdx = ausgeruesteterHeld(gs, pi, opts);
    if (heroIdx < 0 || !ps) return {};

    // ── Preis zahlen: eine Kopie zurück ins Deck ──
    const idx = (ps.discardPile || []).lastIndexOf(CARD_NAME);
    if (idx < 0) return {};

    // (Der Auftritt links am Feld kommt vom Reaktionsfenster selbst —
    // der Ausruestungs-Durchgang sendet ihn fuer JEDE Karte, die er
    // anbietet. Hier waere er doppelt.)

    // ★ Sichtbarer Flug Ablage → Deck (Als Regel: JEDE Bewegung
    // zwischen Stapeln wird animiert). VOR der Umbuchung senden, damit
    // der Client die Karte noch in der Ablage findet, von der sie
    // startet.
    engine._broadcastEvent('play_pile_transfer', {
      owner: pi, cardName: CARD_NAME, from: 'discard', to: 'deck',
    });
    await engine._delay(FLUG_MS);

    ps.discardPile.splice(idx, 1);
    ps.mainDeck.push(CARD_NAME);
    engine.shuffleDeck(pi, 'main');       // sendet auch die Misch-Animation

    engine._broadcastEvent('play_zone_animation', {
      type: 'shield_bubble', owner: pi, heroIdx, zoneSlot: -1,
    });
    await engine._delay(420);

    engine.grantEffectImmunity(pi, heroIdx, sourceCard);
    engine.log('ft_weathercock', {
      player: ps.username, hero: ps.heroes?.[heroIdx]?.name,
      negated: sourceCard?.name || 'an Attack or Spell',
    });
    engine.sync();
    return {};
  },
};
