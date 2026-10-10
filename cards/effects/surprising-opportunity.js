// ═══════════════════════════════════════════
//  CARD EFFECT: "Surprising Opportunity"
//  Spell (Reaction, Lv1, Decay Magic + Magic Arts)
//
//  „Play this card immediately when a Hero (yours or your opponent's) is
//   defeated. Choose up to 2 cards from that Hero's Support Zones and add
//   them to your hand before the Hero is defeated."
//
//  ── FENSTER: `isHeroDefeatWindowReaction` (v1490) ───────────────────────
//  „before the Hero is defeated" heißt: Ausrüstungen und Anhängsel liegen noch im Feld. Das alte Hand-Fenster
//  `isHeroDefeatedReaction` (Cheat Chair) läuft erst NACH dem Todes-Aufräumen und steht nur dem Besitzer offen — hier
//  braucht es ein Fenster ganz VORN im Besiegen-Ablauf, das BEIDEN Seiten angeboten wird (Besitzer des fallenden Helden
//  zuerst). Die Engine ruft `heroDefeatWindowCondition` / `heroDefeatWindowResolve`; Wirker, Kosten, Flug, Log und
//  Abschluss-Hooks erledigt der gemeinsame Hand-Reaktions-Helfer.
//
//  ── WAS GEWÄHLT WERDEN DARF ─────────────────────────────────────────────
//  „cards from that Hero's Support Zones": alles, was in den Support Zones dieses Helden liegt — Kreaturen, Ausrüstung,
//  Anhängsel, Heldenkarten als Ausrüstung. Ausgenommen sind Dinge, die keine Karte sind oder nicht fortgenommen werden
//  dürfen: Token (Biomancy, Pollution …), unbewegliche Karten (`immovable`, Divine Gift of Coolness), die unsichtbare
//  Trägerin eines gewonnenen Heldeneffekts, verdeckte Karten und Cardinal Beasts. Karten, die ein Effekt „nicht wählbar"
//  macht (Great Wall of Deri, Thicket), fallen für den Wirker heraus — die Zielwahl graut sie aus.
//
//  ── „YOUR HAND" ─────────────────────────────────────────────────────────
//  Die Karten landen in der Hand des SPIELERS, der Surprising Opportunity gespielt hat (`opts.toPlayer` der Engine) —
//  auch wenn sie am Helden des Gegners lagen. Fremde Karten bleiben dabei Eigentum ihres Besitzers (die Herkunfts-
//  Markierung der Hand sorgt dafür, dass sie später in SEINER Ablage landen — wie bei gestohlenen Handkarten).
//
//  Die Rückkehr-Hooks (`onCardsReturnedToHand`: Teppes, Siphem, Blood Moon …) feuern nur, wenn die Karten von den
//  EIGENEN Helden kommen — deren Text lautet „from your Heroes' Support Zones".
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  `play_zone_animation` `surprising_opportunity` (Client: ANIM_REGISTRY, Pixelart): ein Fragezeichen springt über dem
//  fallenden Helden auf, goldene Funken stieben aus seinen Support Zones. Danach fliegen die gewählten Karten (Flug der
//  Engine) in die Hand. Klang in ZONE_ANIM_SFX.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { isCardinalBeastByName } = require('./_cardinal-shared');

const CARD_NAME = 'Surprising Opportunity';
const MAX_KARTEN = 2;
const BILD_MS = 1000;        // Länge der Animation (deckt sich mit `surprising_opportunity` im Client)
const FLUG_PAUSE_MS = 380;   // Abstand zwischen zwei fliegenden Karten

/** Darf diese Brettkarte überhaupt in die Hand genommen werden? (Karte, sichtbar, beweglich) */
function nimmbar(engine, inst) {
  if (!inst || inst.zone !== 'support' || inst.faceDown) return false;
  const c = inst.counters || {};
  if (c.immovable || c._gainedEffectOnly || c._cardinalImmune) return false;
  if (isCardinalBeastByName(inst.name)) return false;
  const roh = engine._getCardDB()[inst.name];
  const cd = engine.getEffectiveCardData(inst) || roh;
  if (!cd) return false;
  // Token sind keine Karten: nie auf die Hand (Pollution, Biomancy — dessen Token liegen unter dem Namen einer Potion mit
  // `_cardDataOverride.cardType = 'Creature/Token'` —, Mummy, Puppet …). Beide Lesarten prüfen: wirksame UND rohe Daten.
  if (hasCardType(cd, 'Token') || hasCardType(roh, 'Token') || c._effectOverride === 'Biomancy Token') return false;
  return true;
}

/** Wählbar für den Wirker `pi`? (zusätzlich: kein „cannot be chosen"-Schutz) */
function waehlbar(engine, pi, inst) {
  if (!nimmbar(engine, inst)) return false;
  if (inst.counters?.untargetable_all) return false;
  const ktrl = inst.controller ?? inst.owner;
  if (ktrl !== pi && typeof engine._isSideNondamageShielded === 'function' && engine._isSideNondamageShielded(ktrl)) return false;
  return true;
}

/** Alle wählbaren Karten in den Support Zones des fallenden Helden, in Zonenreihenfolge. */
function kandidaten(engine, pi, info) {
  const seite = info.heroOwner, hi = info.heroIdx;
  return engine.cardInstances
    .filter(c => c.zone === 'support' && c.heroIdx === hi && engine.physicalSide(c) === seite && waehlbar(engine, pi, c))
    .sort((a, b) => (a.zoneSlot ?? 0) - (b.zoneSlot ?? 0));
}

/** CPU: der Wert einer Karte für die eigene Hand — teurer und höher im Level ist besser; Ausrüstung vor Kreaturen. */
function kartenWert(engine, pi, inst) {
  const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name] || {};
  let w = (cd.cost || 0) + 40 * (cd.level || 0);
  if (hasCardType(cd, 'Artifact')) w += 20;
  else if (hasCardType(cd, 'Hero') || hasCardType(cd, 'Ascended Hero')) w += 60;
  try {
    const hand = engine._cpuEstimateHandValue?.(pi, inst.name);
    if (Number.isFinite(hand)) w += hand;
  } catch { /* Bewertung ist Beiwerk */ }
  return w;
}

/** Die Auswahl: Mensch klickt bis zu zwei Karten an, die CPU nimmt die wertvollsten. */
async function waehle(engine, pi, info, liste) {
  const maschine = engine.isCpuPlayer(pi) || engine._inMctsSim || engine._fastMode;
  if (maschine) {
    return [...liste].sort((a, b) => kartenWert(engine, pi, b) - kartenWert(engine, pi, a)).slice(0, MAX_KARTEN);
  }
  const ziele = liste.map(inst => {
    const seite = engine.physicalSide(inst);
    return {
      id: `equip-${seite}-${inst.heroIdx}-${inst.zoneSlot}`,
      type: 'equip', owner: seite, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
      cardName: inst.name, cardInstance: inst,
    };
  });
  const ids = await engine.promptEffectTarget(pi, ziele, {
    title: CARD_NAME,
    description: `Click up to ${MAX_KARTEN} cards in ${info.hero?.name || 'the Hero'}'s Support Zones to add them to your hand.`,
    confirmLabel: '✨ Take!',
    confirmClass: 'btn-success',
    cancellable: true,                 // up to 2: auch null Karten sind erlaubt
    cancelLabel: 'Take nothing',
    goldSelect: true,
    maxTotal: Math.min(MAX_KARTEN, ziele.length),
    minRequired: 1,
    previewCardName: CARD_NAME,
  });
  if (!Array.isArray(ids)) return [];
  const gewaehlt = [];
  for (const id of ids) {
    const z = ziele.find(t => t.id === id);
    if (z?.cardInstance && !gewaehlt.includes(z.cardInstance)) gewaehlt.push(z.cardInstance);
  }
  return gewaehlt.slice(0, MAX_KARTEN);
}

module.exports = {
  // Reaction-Karte: nie aktiv aus der Hand spielbar.
  canActivate: () => false,
  neverPlayable: true,
  activeIn: ['hand'],

  isHeroDefeatWindowReaction: true,

  /** Angeboten, solange am fallenden Helden mindestens eine Karte zu holen ist. */
  heroDefeatWindowCondition(gs, pi, engine, info) {
    return kandidaten(engine, pi, info).length > 0;
  },

  async heroDefeatWindowResolve(engine, pi, info) {
    const gs = engine.gs;
    const liste = kandidaten(engine, pi, info);
    if (liste.length === 0) return;

    engine._broadcastEvent('play_zone_animation', {
      type: 'surprising_opportunity', owner: info.heroOwner, heroIdx: info.heroIdx, zoneSlot: -1,
    });
    await engine._delay(BILD_MS * 0.5);          // erst das Fragezeichen, dann die Auswahl

    const gewaehlt = await waehle(engine, pi, info, liste);
    if (gewaehlt.length === 0) return;

    const namen = [], insts = [], heroIdxs = [], slots = [];
    for (const inst of gewaehlt) {
      if (inst.zone !== 'support') continue;       // zwischenzeitlich weg (Kette)
      const name = inst.name, slot = inst.zoneSlot, hi = inst.heroIdx;
      await engine.actionMoveCard(inst, 'hand', -1, -1, {
        source: CARD_NAME, sourceOwner: pi, toPlayer: pi, _bypassDeadHeroFilter: true,
      });
      if (inst.zone !== 'hand') continue;          // blockiert (Immunität o. ä.)
      namen.push(name); insts.push(inst); heroIdxs.push(hi); slots.push(slot);
      engine.sync();
      await engine._delay(FLUG_PAUSE_MS);
    }
    if (namen.length === 0) return;

    engine.log('surprising_opportunity', {
      player: gs.players[pi]?.username, hero: info.hero?.name, cards: namen,
    });

    // Rückkehr-Hooks (Teppes, Siphem, Blood Moon …): nur für Karten von den EIGENEN Helden.
    if (info.heroOwner === pi) {
      await engine.runHooks('onCardsReturnedToHand', {
        ownerIdx: pi, returnedCards: [...namen], returnedInsts: [...insts],
        fromHeroIdxs: heroIdxs, fromZoneSlots: slots,
        by: CARD_NAME, _skipReactionCheck: true,
      });
    }
    engine.sync();
  },

  /** CPU: immer — jede Karte, die sie holt, ist Gewinn, und am fallenden Helden liegt sie sonst bald in der Ablage. */
  cpuMeta: {
    reactionHeuristic() { return true; },
  },
};
