// ═══════════════════════════════════════════════════════════════════
//  GETEILTES MODUL — KETTENBLITZ (v1333)
//
//  „Your opponent has to choose 3 targets they control consecutively.
//   The first … takes X, the second Y, the third Z."
//  Drei Karten tragen diesen Satz: Chain Lightning (Spell), Cardinal
//  Beast Qinglong (Creature-Effekt), Bottled Lightning (Potion). Jede
//  hatte ihre eigene Kopie der Trefferschleife — und keine kannte die
//  Regel, dass JEDER EINZELNE TREFFER als Wahl dieses Ziels durch die
//  Quelle gilt (Als Regel 24.9.: Empty Armor reagierte nicht auf Chain
//  Lightning, Frost Rune dagegen schon). Die Schleife liegt jetzt hier.
//
//  Je Treffer:
//    1. Unterbrochen? Wurde die Quelle unterwegs negiert (Frost Rune am
//       vorigen Ziel …), springt der Blitz nicht weiter.
//    2. Umleitung: `engine.trefferAlsWahl` oeffnet die Umleitungsfenster
//       fuer genau dieses Ziel (Empty Armor & Co.). Der Blitz springt
//       danach zum NEUEN Ziel, und die Kette laeuft von dort weiter.
//    3. Blitz-Bild vom vorigen Glied zum Ziel, dann der Schaden.
//    4. Negiert ein Treffer die Quelle (Surprise-Negation im Schadens-
//       pfad), endet die Kette sofort.
//  Die Flaechenklammer (`beginAoeStrike` / `endMultiHit`) umschliesst
//  die ganze Kette — EINE Quelle ueber mehrere Ziele (Anti-AoE).
// ═══════════════════════════════════════════════════════════════════

/**
 * @param {object} engine
 * @param {object} cfg
 * @param {object} cfg.quelle      { name, owner, heroIdx } — Schadensquelle
 * @param {string} cfg.zone        Zone der Quelle fuer die Quellenart
 *                                 ('hand' Spell/Potion, 'support' Creature)
 * @param {Array}  cfg.ziele       die gewaehlten Ziele in Reihenfolge
 * @param {Array}  cfg.alleZiele   alle legalen Ziele (fuer Umleitungen)
 * @param {number[]} cfg.schaden   Schaden je Treffer
 * @param {string} cfg.typ         Schadenstyp
 * @param {object} cfg.start       { owner, heroIdx, zoneSlot } — Ursprung des
 *                                 ersten Blitzes; ohne Angabe das erste Ziel selbst
 * @returns {Promise<number>} Zahl der ausgeteilten Treffer
 */
async function kettenblitz(engine, cfg) {
  const gs = engine.gs;
  const { quelle, ziele, schaden, typ } = cfg;
  const pi = quelle.owner;
  const quelleMitArt = { ...quelle, controller: pi, zone: cfg.zone || 'hand' };
  const alle = Array.isArray(cfg.alleZiele) ? cfg.alleZiele : ziele;

  await engine.beginAoeStrike(ziele.length, {
    creatures: ziele
      .map((t, i) => ({ inst: t.cardInstance, amount: schaden[i] }))
      .filter(k => k.inst),
    source: quelle, type: typ, sourceOwner: pi,
  });

  let treffer = 0;
  try {
    let vorher = cfg.start || null;
    for (let step = 0; step < ziele.length; step++) {
      // 1) Unterbrochen?
      if (step > 0 && (gs._spellNegatedByEffect || engine._isEffectSourceNegated?.(quelle))) {
        engine.log('chain_lightning_interrupted', { player: gs.players[pi]?.username, afterStep: step, source: quelle.name });
        break;
      }
      // 2) Umleitung — der Treffer gilt als Wahl dieses Ziels.
      let tgt = ziele[step];
      const neu = await engine.trefferAlsWahl(tgt, alle, quelleMitArt, { title: quelle.name });
      if (!neu) {
        engine.log('chain_lightning_interrupted', { player: gs.players[pi]?.username, afterStep: step, source: quelle.name });
        break;
      }
      tgt = neu;
      const dmg = schaden[step];
      const tgtZoneSlot = tgt.type === 'hero' ? -1 : tgt.slotIdx;

      // 3) Blitz vom vorigen Glied (oder dem Ursprung) zum Ziel.
      const von = vorher || { owner: tgt.owner, heroIdx: tgt.heroIdx, zoneSlot: tgtZoneSlot };
      engine._broadcastEvent('qinglong_lightning', {
        srcOwner: von.owner, srcHeroIdx: von.heroIdx, srcZoneSlot: von.zoneSlot,
        tgtOwner: tgt.owner, tgtHeroIdx: tgt.heroIdx, tgtZoneSlot, step,
      });
      await engine._delay(400);

      // 4) Schaden; Negation der Quelle beendet die Kette.
      let negiert = false;
      if (tgt.type === 'hero') {
        const hero = gs.players[tgt.owner]?.heroes?.[tgt.heroIdx];
        if (hero && hero.hp > 0) {
          const r = await engine.actionDealDamage(quelle, hero, dmg, typ);
          negiert = !!(r?.surpriseNegated || r?.effectNegated);
        }
      } else {
        const inst = tgt.cardInstance || engine.cardInstances.find(c =>
          c.zone === 'support' && c.owner === tgt.owner && c.heroIdx === tgt.heroIdx && c.zoneSlot === tgt.slotIdx);
        if (inst) {
          await engine.actionDealCreatureDamage(quelle, inst, dmg, typ, { sourceOwner: pi, canBeNegated: true });
        }
      }
      treffer++;
      engine.sync();
      if (negiert) {
        engine.log('chain_lightning_interrupted', { player: gs.players[pi]?.username, afterStep: step + 1, source: quelle.name });
        break;
      }
      await engine._delay(10);
      vorher = { owner: tgt.owner, heroIdx: tgt.heroIdx, zoneSlot: tgtZoneSlot };
    }
  } finally {
    await engine.endMultiHit();
  }
  return treffer;
}

module.exports = { kettenblitz };
