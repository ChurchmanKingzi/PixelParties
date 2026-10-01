// ═══════════════════════════════════════════
//  CARD EFFECT: "Remote Detonator"
//  Artifact (Subtyp Reaction laut Datenbank, Kosten 0, PP MBS1)
//
//  „Delete as many copies of \"Sentient Bomb Golems\" you control as
//   possible to play this card. Choose a target and deal 200 damage times
//   the number of deleted copies to it."
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────
//  • Der Text nennt keinen Ausloeser, nur den Subtyp „Reaction" (wie bei
//    Heart of Cards, wo sich das als Datenbankfehler herausstellte) → die
//    Karte ist ueber `proactivePlay` aus der Hand spielbar und haengt sich
//    nicht in Reaktionsfenster. Sollte der Subtyp „Normal" gemeint sein,
//    genuegt die Korrektur in `cards.json`.
//  • „you control" + „copies": offene Golems AUF DEM BRETT unter meiner
//    Kontrolle (Hand/Deck sind nichts, was man „kontrolliert").
//    „as many as possible" = ALLE. Spielbar nur mit mindestens einem
//    Golem — mit null Kopien waere der Schaden 0.
//  • Reihenfolge: Zielwahl (abbrechbar) → bei Bestaetigung loescht
//    `resolve` ALLE Golems (Kosten) → Schaden = 200 × Anzahl. Ein Abbruch
//    der Zielwahl loescht also nichts. Die eigenen Golems sind keine Ziele.
//  • „deleted" = in den GELOESCHT-Stapel (`actionMoveCard`), nicht besiegt.
//  • Spielstart-Schutz: ein Held, der noch die Erstrunden-Schonung traegt,
//    ist wie bei Acid Vial kein Ziel.
// ═══════════════════════════════════════════

const CARD_NAME = 'Remote Detonator';
const GOLEM = 'Sentient Bomb Golems';
const PRO_GOLEM = 200;

/** Meine offenen Golems auf dem Brett. */
function meineGolems(engine, pi) {
  return engine.cardInstances.filter(c =>
    c.zone === 'support' && c.name === GOLEM && !c.faceDown
    && (c.controller ?? c.owner) === pi);
}

module.exports = {
  isTargetingArtifact: true,
  proactivePlay: true,

  canActivate(gs, pi, engine) {
    if (!engine) return false;
    return meineGolems(engine, pi).length > 0;
  },

  getValidTargets(gs, pi, engine) {
    if (!engine) return [];
    const eigene = new Set(meineGolems(engine, pi).map(c => c.id));
    const out = [];
    for (let p = 0; p < 2; p++) {
      if (gs.firstTurnProtectedPlayer !== p) out.push(...engine.getHeroTargets(p));
      out.push(...engine.getCreatureTargets(p).filter(t => !eigene.has(t.cardInstance?.id)));
    }
    return out;
  },

  /** Der Schaden haengt an der Zahl der Golems — die Anzeige liest sie live. */
  targetingConfig(gs, pi, cost, engine) {
    const n = engine ? meineGolems(engine, pi).length : 0;
    return {
      title: CARD_NAME,
      description: `Delete all ${n} of your "${GOLEM}" and deal ${PRO_GOLEM * n} damage to a target.`,
      confirmLabel: `💥 Detonate! (${PRO_GOLEM * n})`,
      confirmClass: 'btn-danger',
      cancellable: true,
      exclusiveTypes: true,
      maxPerType: { hero: 1, equip: 1 },
      baseDamage: PRO_GOLEM * n,
    };
  },

  validateSelection(selectedIds) {
    return !!selectedIds && selectedIds.length === 1;
  },

  async resolve(engine, pi, selectedIds, validTargets) {
    if (!selectedIds || selectedIds.length === 0) return { cancelled: true };
    const target = validTargets.find(t => t.id === selectedIds[0]);
    if (!target) return { cancelled: true };
    const gs = engine.gs;

    // Kosten: ALLE meine Golems loeschen (frisch gezaehlt).
    const golems = meineGolems(engine, pi);
    if (golems.length === 0) return { cancelled: true };
    const anzahl = golems.length;
    const schaden = PRO_GOLEM * anzahl;
    const quelle = { name: CARD_NAME, owner: pi, controller: pi, heroIdx: -1 };

    for (const g of golems) {
      engine._broadcastEvent('play_zone_animation', {
        type: 'explosion', owner: engine.physicalSide(g), heroIdx: g.heroIdx, zoneSlot: g.zoneSlot,
      });
    }
    await engine._delay(450);
    for (const g of golems) {
      await engine.actionMoveCard(g, 'deleted', -1, -1, { source: CARD_NAME, sourceOwner: pi });
    }
    engine.sync();

    // Wirkung: 200 × Anzahl auf das gewaehlte Ziel.
    const zoneSlot = target.type === 'hero' ? -1 : target.slotIdx;
    engine._broadcastEvent('play_zone_animation', {
      type: anzahl >= 2 ? 'mega_explosion' : 'explosion',
      owner: target.owner, heroIdx: target.heroIdx, zoneSlot,
    });
    await engine._delay(500);

    if (target.type === 'hero') {
      const hero = gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (hero && hero.hp > 0) await engine.actionDealDamage(quelle, hero, schaden, 'artifact');
    } else {
      const inst = target.cardInstance
        || engine.cardInstances.find(c => c.owner === target.owner && c.zone === 'support'
          && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx);
      if (inst && inst.zone === 'support') {
        await engine.actionDealCreatureDamage(quelle, inst, schaden, 'artifact',
          { sourceOwner: pi, canBeNegated: true });
      }
    }

    engine.log('remote_detonator', {
      player: gs.players[pi]?.username, deleted: anzahl, damage: schaden, target: target.cardName,
    });
    engine.sync();
    return true;
  },
};
