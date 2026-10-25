'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Nasty Prank"  (W75b)
//  Spell (Reaction, Lv0, Magic Arts)
//
//  „Play this card immediately when an opponent's Hero performs an Attack or Spell. That Hero cannot perform another Attack/Spell with that name until the end of your opponent's
//   next turn. If the user has at least Magic Arts 1, that Hero cannot perform another Attack/Spell with that name for the rest of the game instead. This counts as a negative status
//   effect."
//
//  ── FENSTER: `isSpellPerformedReaction` (neu, 25.10.) ──────────────────
//  Hand-Fenster NACH der Auflösung (`engine._checkSpellPerformedHandReactions`, gerufen hinter `afterSpellResolved` im Spielweg `doPlaySpell` und im Sofort-Guss): „immediately when an
//  opponent's Hero performs an Attack or Spell" — aber erst, wenn die Attack/der Spell NICHT MEHR abgebrochen werden kann (Al, 25.10.): negierte, abgebrochene oder verpuffte Karten
//  öffnen das Fenster nie. Bis 24.10. hing die Karte als Kettenglied OBEN auf der Attack/dem Spell (Bauform Shamanic Curse) — dort konnte die Karte noch negiert werden, der Streich aber schon
//  gewirkt haben. Jetzt keine Kette: Reverse Trap & Co. greifen über das Reaktionsfenster der gespielten Karte (`_reaktionGespielt`). Bedingung (`spellPerformedCondition`): der Ausführende ist
//  ein HELD des Gegners (ein Effekt, der nur als Attack/Spell ZÄHLT, hat keine Karte und keinen Namen, der sich sperren ließe; eine Kreatur als Wirkerin zählt nicht) und mindestens ein eigener
//  Held kann die Karte wirken. Die Karte negiert nichts — der Attack/Spell ist längst ausgeführt; gesperrt wird erst das NÄCHSTE Mal („another").
//
//  ── DER STATUS `pranked` („Pranked", 🤡) ────────────────────────────────
//  Ein Statuseintrag je Held mit `names` = { [Kartenname]: { expiresAtTurn, expiresForPlayer, permanent, opponent } } — jeder Name läuft für sich ab. Mehrere Streiche mit verschiedenen
//  Namen liegen nebeneinander; derselbe Name wird erneuert (eine dauerhafte Sperre bleibt dauerhaft, sonst gilt die spätere Frist). Gesperrt wird in `validateActionPlay`, in den Hand-
//  Grau-Schleifen, im Reaktions-/Surprise-Gate und in `heroKannZaubern` (`engine.heroPranked`), jeweils für Attacks UND Spells gleichen Namens — auch als Reaktion oder Surprise.
//  Negativ und heilbar (Juice, Beer, Cure …): geheilt fallen alle Namen weg.
//  „until the end of your opponent's next turn": der nächste Zug des Gegners (Besitzers des Helden) NACH dem laufenden, Ablauf zu Beginn des Zuges danach (Disruption-Ray-Auslegung):
//  Streich im Zug des Gegners (T) → Ablauf zu Beginn von T+3; Streich im eigenen Zug (der Gegner reagiert mit einem Spell) → T+2.
//  „If the user has at least Magic Arts 1": der WIRKER dieser Karte (Magic Arts auf SEINER Seite, `effectiveSchoolLevelForCaster`) → Sperre für den Rest des Spiels (`permanent`).
//
//  ── Bild und Klang ─────────────────────────────────────────────────────
//  `play_zone_animation` `prank_bucket` (Client: ANIM_REGISTRY, Pixelart): ein Wassereimer fällt auf den Helden, kippt aus und durchnässt ihn. Klang in ZONE_ANIM_SFX.
// ═══════════════════════════════════════════

const { baseCardName } = require('./_hooks');

const CARD_NAME = 'Nasty Prank';
const ANIM_MS = 1500;
const AUFSCHLAG_MS = 760;   // bis der Eimer auf dem Helden aufschlägt (deckt sich mit `prank_bucket` im Client)

module.exports = {
  // Reaction-Karte: nie aktiv aus der Hand spielbar.
  canActivate: () => false,
  neverPlayable: true,
  activeIn: ['hand'],

  isSpellPerformedReaction: true,

  spellPerformedCondition(gs, pi, engine, info) {
    if (!info || info.performerOwner === pi) return false;
    if (info.cardType !== 'Attack' && info.cardType !== 'Spell') return false;
    const hero = gs.players[info.heroOwner]?.heroes?.[info.heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;                   // „an opponent's HERO performs": der Wirker muss ein Held sein (und noch stehen)
    return true;
  },

  async spellPerformedResolve(engine, pi, info, opts = {}) {
    const gs = engine.gs;
    const cardName = baseCardName(info.spellName || '');
    const hSeite = info.heroOwner;
    const hi = info.heroIdx;
    const hero = gs.players[hSeite]?.heroes?.[hi];
    if (!hero?.name || hero.hp <= 0 || !cardName) return;

    // „If the user has at least Magic Arts 1" — der Nutzer = der Wirker dieser Karte.
    const wHi = opts.casterIdx;
    const wSeite = opts.casterSeite ?? pi;
    const dauerhaft = Number.isInteger(wHi) && wHi >= 0 && engine.effectiveSchoolLevelForCaster('Magic Arts', pi, wHi, wSeite) >= 1;

    engine._broadcastEvent('play_zone_animation', { type: 'prank_bucket', owner: hSeite, heroIdx: hi, zoneSlot: -1, duration: ANIM_MS });
    await engine._delay(AUFSCHLAG_MS);

    // Frist: der nächste Zug des Gegners nach dem laufenden endet → Ablauf zu Beginn des Zuges danach (Kopf).
    const opp = info.performerOwner;
    const expiresAtTurn = gs.activePlayer === opp ? gs.turn + 3 : gs.turn + 2;
    const alt = hero.statuses?.pranked?.names || {};
    const names = {};
    for (const [k, v] of Object.entries(alt)) names[k] = { ...v };
    const vorher = names[cardName];
    if (dauerhaft || vorher?.permanent) names[cardName] = { permanent: true, opponent: opp, by: pi };
    else names[cardName] = { expiresAtTurn: Math.max(expiresAtTurn, vorher?.expiresAtTurn || 0), expiresForPlayer: pi, opponent: opp, by: pi };
    await engine.addHeroStatus(hSeite, hi, 'pranked', { names, appliedBy: pi, source: CARD_NAME });
    engine.log('nasty_prank', { player: gs.players[pi]?.username, hero: hero.name, card: cardName, permanent: !!names[cardName]?.permanent });
    await engine._delay(Math.max(0, ANIM_MS - AUFSCHLAG_MS - 200));
    engine.sync();
  },

  cpuMeta: {
    reactionHeuristic: () => true,
  },
};
