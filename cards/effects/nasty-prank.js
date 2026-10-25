'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Nasty Prank"  (W75b)
//  Spell (Reaction, Lv0, Magic Arts)
//
//  „Play this card immediately when an opponent's Hero performs an Attack or Spell. That Hero cannot perform another Attack/Spell with that name until the end of your opponent's
//   next turn. If the user has at least Magic Arts 1, that Hero cannot perform another Attack/Spell with that name for the rest of the game instead. This counts as a negative status
//   effect."
//
//  ── FENSTER ─────────────────────────────────────────────────────────────
//  Kettenfenster (`isReaction`, Bauform Shamanic Curse): das letzte Kettenglied ist ein Attack-/Spell-KARTE des Gegners, gespielt von einem HELDEN (`heroIdx ≥ 0`; ein Effekt, der nur
//  als Attack/Spell ZÄHLT [`zaehltAlsArt`: Alice …], hat keine Karte und keinen Namen, der sich sperren ließe). Die Karte negiert nichts — der laufende Attack/Spell wird ganz normal
//  ausgeführt; gesperrt wird erst das NÄCHSTE Mal („another").
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
  isReaction: true,
  canActivate: () => false,

  reactionCondition: (gs, pi, engine, chainCtx) => {
    if (!chainCtx?.chain || chainCtx.chain.length < 1) return false;
    const lastLink = chainCtx.chain[chainCtx.chain.length - 1];
    if (!lastLink || lastLink.owner === pi) return false;
    if (lastLink.cardType !== 'Attack' && lastLink.cardType !== 'Spell') return false;
    if (lastLink.zaehltAlsArt) return false;                         // kein gespielter Spell/Attack: nichts, was sich namentlich sperren ließe
    if (!(lastLink.heroIdx >= 0)) return false;                      // „an opponent's HERO performs": eine Kreatur als Wirkerin zählt nicht
    const hSeite = lastLink.casterOwner ?? lastLink.owner;
    const hero = gs.players[hSeite]?.heroes?.[lastLink.heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;

    const ps = gs.players[pi];
    if (!ps) return false;
    const cardData = engine._getCardDB()[CARD_NAME];
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const h = ps.heroes[hi];
      if (!h?.name || h.hp <= 0) continue;
      if (h.statuses?.frozen || h.statuses?.stunned) continue;
      if (engine.heroMeetsLevelReq(pi, hi, cardData)) return true;
    }
    return !!engine.fremderHeldKannStufe(pi, CARD_NAME);              // W20c: auch ein übernommener Held wirkt
  },

  resolve: async (engine, pi, selectedIds, validTargets, chain, myIndex) => {
    if (!chain || myIndex === undefined) return;
    const gs = engine.gs;
    const target = chain[myIndex - 1];
    const eigen = chain[myIndex];
    if (!target) return;
    const cardName = baseCardName(target.cardName || '');
    const hSeite = target.casterOwner ?? target.owner;
    const hi = target.heroIdx;
    const hero = gs.players[hSeite]?.heroes?.[hi];
    if (!hero?.name || hero.hp <= 0 || !cardName) return;

    // „If the user has at least Magic Arts 1" — der Nutzer = der Wirker dieser Karte.
    const wHi = eigen?.casterHeroIdx ?? eigen?.heroIdx;
    const wSeite = eigen?.casterOwner ?? pi;
    const dauerhaft = Number.isInteger(wHi) && wHi >= 0 && engine.effectiveSchoolLevelForCaster('Magic Arts', pi, wHi, wSeite) >= 1;

    engine._broadcastEvent('play_zone_animation', { type: 'prank_bucket', owner: hSeite, heroIdx: hi, zoneSlot: -1, duration: ANIM_MS });
    await engine._delay(AUFSCHLAG_MS);

    // Frist: der nächste Zug des Gegners nach dem laufenden endet → Ablauf zu Beginn des Zuges danach (Kopf).
    const opp = target.owner;
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
