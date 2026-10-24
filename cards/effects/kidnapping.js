'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Kidnapping"
//  Spell (Normal, Decay Magic Lv2)
//
//  „Choose a Creature your opponent controls and add it to your hand. If your opponent controls at least 2 Creatures when you play this card, this counts as an
//   additional Action."
//
//  ── ABLAUF ──────────────────────────────────────────────────────────────
//  1. Spielbar nur, wenn der Gegner mindestens eine Kreatur kontrolliert (`requiresTargetKind: 'oppCreature'`), der Wirker Karten auf die Hand bekommen darf
//     (Hand-Sperre: `blockedByHandLock`), der Gegner keinen Erstrunden-Schutz hat (`blockedByFirstTurnProtection`) und kein gegnerischer Boris wirkt
//     (`stealsOpponentCards`: „bringt gegnerische Karten auf die eigene Hand").
//  2. Zielwahl (`promptEffectTarget`, abbrechbar — dann wird die Karte nicht verbraucht): nur Kreaturen, die der GEGNER KONTROLLIERT (wo auch immer sie liegen, auch auf der
//     eigenen Brettseite, wenn er sie übernommen hat). Schutz vor Auswahl (Untargetable, Stealth, Board of Kings, Great Wall of Deri) und die Fenster der Zielwahl
//     (Reaktionen, Surprises) macht der Zielwähler selbst; das Truth-Seeing Eye des Wirkers hebt die Auswahlsperren auf (Muster Alluring Light). Wird der Zauber in der Zielwahl
//     negiert, ist er verbraucht (kein Abbruch). Festgesetzte (`immovable`) und verdeckte Karten sind keine Ziele.
//  3. Animation `kidnap_sack` (Pixelart): ein Sack fällt auf die Kreatur, wird zugebunden, zappelt und löst sich auf — dann fliegt die Kreatur über
//     `_sparkfly-shared.stealBoardCardToHand` von ihrer Zone auf die Hand des Wirkers (Hand-Sperre, Omni-Immunität [Cardinal Beasts: der Zauber verpufft],
//     Schutz „chosen by an opponent's card" [`beforeCreatureAffected`, Winged Skeleton], Defending the Gate, Tokens [verschwinden], Besitzer bleibt der PERMANENTE
//     Besitzer: stirbt sie später, geht sie in dessen Ablage).
//
//  ── ZUSATZAKTION ────────────────────────────────────────────────────────
//  „If your opponent controls at least 2 Creatures when you play this card, this counts as an additional Action." → `inherentAction` als FUNKTION (Vertrag
//  „Counts as an additional Action"): wird VOR dem Spielen gelesen, also zählt der Stand beim Ausspielen. Kein `spellPlayCondition` dafür — mit weniger als zwei
//  Gegnerkreaturen bleibt die Karte spielbar und kostet eine normale Aktion. Gezählt werden Kreaturen (und Token) in den Support Zonen, die der Gegner
//  kontrolliert und die aufgedeckt sind (`_istKreaturenInstanz`, Kontrolle statt Brettseite). In der Main Phase ist sie nur mit dieser Bedingung spielbar.
//
//  ── ANNAHMEN ────────────────────────────────────────────────────────────
//  „Your opponent" = `engine.opponentOf(pi)` (im Skill Test mit mehreren Gegnern der Fokus-Gegner), wie bei Capture Net.
//  Boris sperrt die Karte ganz (statt nur seine Seite auszublenden): sie holt ausschließlich Gegnerkarten.
//
//  ── CPU ─────────────────────────────────────────────────────────────────
//  Die CPU nimmt die wertvollste wählbare Kreatur (Stufe, HP, ATK).
// ═══════════════════════════════════════════

const { stealBoardCardToHand } = require('./_sparkfly-shared');

const CARD_NAME = 'Kidnapping';
const SACK_MS = 1350;            // Länge von `kidnap_sack` (deckt sich mit dem Client)
const SACK_VOR_MS = 1150;        // bis der Sack sich aufgelöst hat und der Flug der Kreatur beginnen darf

/** Kreaturen (und Token), die `oi` kontrolliert, aufgedeckt, in Support Zonen. */
function kontrollierteKreaturen(engine, oi) {
  return engine.cardInstances.filter(inst =>
    inst.zone === 'support' && !inst.faceDown && !inst.counters?.treatAsEquip
    && engine.kontrolleurVon(inst) === oi && engine._istKreaturenInstanz(inst));
}

/** Zielliste: die Kreaturen des Gegners, die man auf die Hand nehmen kann. Der Zielwähler graut Geschützte selbst aus. */
function kidnapZiele(engine, oi) {
  const out = [];
  for (const t of (engine.getCreatureTargets(oi) || [])) {
    const inst = t.cardInstance;
    if (!inst || inst.faceDown || inst.counters?.immovable) continue;
    if (!engine._istKreaturenInstanz(inst)) continue;             // Puppets & Co. (nur „wählbar als Kreatur") sind keine Kreaturen zum Mitnehmen
    out.push(t);
  }
  return out;
}

/** Grober Wert einer Kreatur für die CPU. */
function kreaturWert(engine, t) {
  const inst = t.cardInstance;
  const cd = (inst ? engine.getEffectiveCardData(inst) : null) || engine._getCardDB()[t.cardName] || {};
  return (cd.level || 0) * 2 + (cd.hp || 0) / 60 + (cd.atk || 0) / 40;
}

module.exports = {
  // „At least 2 Creatures when you play this card" → Zusatzaktion (Funktion, je Held; Stand beim Ausspielen).
  inherentAction: (gs, pi, heroIdx, engine) => {
    const eng = engine || gs._engineRef;
    if (!eng) return false;
    return kontrollierteKreaturen(eng, eng.opponentOf(pi)).length >= 2;
  },

  requiresTargetKind: 'oppCreature',       // ohne gegnerische Kreatur wirkungslos → unspielbar
  requiresTarget: true,                    // wählt ein Ziel (Blinded-Sperre)
  blockedByHandLock: true,                 // einziger Nutzen = Karte auf die Hand (Hand-Sperre; die Such-Sperre gilt hier nicht: Add aus dem Brett)
  blockedByFirstTurnProtection: true,      // trifft nur die Gegnerseite
  stealsOpponentCards: true,               // Boris: „cannot add any cards originally owned by you to their hand"

  spellPlayCondition(gs, pi, engine) {
    const eng = engine || gs._engineRef;
    if (!eng) return true;
    if (eng.handZugangGesperrt?.(pi)) return false;
    return kidnapZiele(eng, eng.opponentOf(pi)).length > 0;
  },

  cpuMeta: { optionalInherent: true },     // auch als normale Aktion in der Action Phase spielbar

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const oi = engine.opponentOf(pi);
      const ps = gs.players[pi];
      if (!ps) return;
      if (engine.handZugangGesperrt?.(pi)) { gs._spellCancelled = true; return; }
      const ziele = kidnapZiele(engine, oi);
      if (ziele.length === 0) { gs._spellCancelled = true; return; }

      // ── 1. Zielwahl ──
      const mitAuge = engine._sourceIgnoresTargetingRestrictions?.(ctx.card);
      delete gs._zielNegiertDurchSchutz;
      const wahl = await engine.promptEffectTarget(pi, ziele, {
        ...(mitAuge ? { ignoreUntargetable: true, _truthSeeingEye: true } : {}),
        chooserHeroIdx: ctx.cardHeroIdx,
        title: CARD_NAME,
        description: 'Choose a Creature your opponent controls. It is added to your hand.',
        confirmLabel: '🎒 Kidnap!',
        confirmClass: 'btn-info',
        maxSelect: 1, maxTotal: 1,
        exclusiveTypes: true, maxPerType: { equip: 1 },
        cancellable: true,
      });
      const id = Array.isArray(wahl) ? wahl[0] : wahl;
      const ziel = id ? ziele.find(t => t.id === id) : null;
      if (!ziel) {
        // Von einer Reaktion in der Zielwahl negiert: der Zauber ist gespielt und verbraucht. Sonst echter Abbruch → die Karte bleibt auf der Hand.
        if (gs._spellNegatedByEffect || gs._zielNegiertDurchSchutz) { delete gs._zielNegiertDurchSchutz; engine.sync(); return; }
        gs._spellCancelled = true;
        return;
      }
      delete gs._zielNegiertDurchSchutz;

      // Zwischen Wahl und Auflösung kann sich etwas geändert haben (Reaktionsfenster): die lebende Instanz neu auflösen.
      const inst = ziel.cardInstance && engine.cardInstances.find(c => c.id === ziel.cardInstance.id && c.zone === 'support');
      if (!inst || engine.kontrolleurVon(inst) !== oi || engine.handZugangGesperrt?.(pi)) {
        engine.log('kidnapping_fizzle', { player: ps.username, creature: ziel.cardName });
        engine.sync();
        return;
      }
      const name = inst.name;
      const seite = engine.physicalSide(inst);

      // ── 2. Der Sack fällt, dann fliegt die Kreatur auf die Hand ──
      engine._broadcastEvent('play_zone_animation', {
        type: 'kidnap_sack', zoneType: 'board', owner: pi, heroIdx: -1, zoneSlot: -1, duration: SACK_MS,
        targets: [{ owner: seite, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot, cardName: name }],
        originOwner: ctx.cardHeroOwner ?? pi, originHeroIdx: ctx.cardHeroIdx, originZoneSlot: -1,
      });
      engine.sync();
      await engine._delay(SACK_VOR_MS);

      // Während des Sacks nochmals prüfen: die Kreatur muss noch dort liegen.
      const noch = engine.cardInstances.find(c => c.id === inst.id && c.zone === 'support');
      if (!noch) { engine.log('kidnapping_fizzle', { player: ps.username, creature: name }); engine.sync(); return; }
      const moved = await stealBoardCardToHand(engine, pi, noch, CARD_NAME);

      // Kein Warten auf den Flug Zone → Hand (24.10., Al): der Zauber darf sofort in die Ablage; die fliegende Kopie räumt den Handplatz selbst frei, wenn sie landet (Client `onPileTransfer`).
      engine.log(moved ? 'kidnapping' : 'kidnapping_blocked', {
        player: ps.username, opponent: gs.players[oi]?.username, creature: name,
      });
      engine.sync();
    },
  },

  /** CPU: die wertvollste wählbare Kreatur nehmen. */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'effectTarget' || promptData?.config?.title !== CARD_NAME) return undefined;
    const frei = (promptData.validTargets || []).filter(t => !t.ineligible);
    if (frei.length === 0) return [];
    let best = frei[0], bestV = -Infinity;
    for (const t of frei) { const v = kreaturWert(engine, t); if (v > bestV) { bestV = v; best = t; } }
    return [best.id];
  },
};
