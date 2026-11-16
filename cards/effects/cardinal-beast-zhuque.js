// ═══════════════════════════════════════════
//  CARD EFFECT: "Cardinal Beast Zhuque"
//  Creature (Lv5, 500HP) — Unaffected by all cards and effects.
//  Once per turn: Choose a target and Burn it.
//  If Hero, also burn all Creatures in its
//  Support Zones.
//
//  ★ Spielgestalter-Entscheidung 16.11.2026: „Nein, nicht gewollt. Bitte entsprechend dem Text fixen!" — der Text sagt „choose a target" (NICHT
//  „your opponent controls", anders als Baihu): Zhuque darf JEDEN Helden und jede Kreatur beider Seiten wählen (auch eigene). Was nicht gewählt
//  werden kann (schon brennend, tot, Stealth/Taunt-Schutz …), bleibt ausgegraut sichtbar. Unter Blinded wählt der Effekt damit nur eigene Ziele
//  (Engine-Picker `markiereBlindGesperrte`; kein `blindedEigeneZiele`-Vertrag mehr nötig).
// ═══════════════════════════════════════════

const { _checkCardinalWin, _setCardinalImmune } = require('./_cardinal-shared');
const { hasCardType } = require('./_hooks');
const { ausgegrauteRestkarten } = require('./_target-dim-shared');

/**
 * Alle wählbaren Ziele („a target" = Held oder Kreatur, Al 25.10.2026) beider Seiten, die noch nicht brennen. Ziel-IDs/`owner` = Brettseite
 * (`physicalSide`), nicht Besitz/Kontrolle (Styx 28.9.: seitenfremd beschworene Kreaturen).
 */
function sammleZiele(engine) {
  const gs = engine.gs;
  const cardDB = engine._getCardDB();
  const targets = [];
  for (let seite = 0; seite < (gs.players || []).length; seite++) {
    const heroes = gs.players[seite]?.heroes || [];
    for (let hi = 0; hi < heroes.length; hi++) {
      const hero = heroes[hi];
      if (!hero?.name || hero.hp <= 0 || hero.statuses?.burned) continue;
      targets.push({ id: `hero-${seite}-${hi}`, type: 'hero', owner: seite, heroIdx: hi, cardName: hero.name });
    }
  }
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support' || inst.faceDown) continue;
    if (inst.counters.burned) continue;
    // Wirksame Daten (Tokens/Biomancy Token — Als AoE-Report): Ausruestung ist kein Ziel (Al, 25.10.2026).
    const cd = engine.getEffectiveCardData?.(inst) || inst.counters?._cardDataOverride || cardDB[inst.name];
    if (!cd || !engine.isChoosableAsCreature(inst, cd)) continue;
    if ((inst.counters?.currentHp ?? cd.hp ?? 0) <= 0) continue;
    targets.push({
      id: `equip-${engine.physicalSide(inst)}-${inst.heroIdx}-${inst.zoneSlot}`,
      type: 'equip', owner: engine.physicalSide(inst), heroIdx: inst.heroIdx,
      slotIdx: inst.zoneSlot, cardName: inst.name, cardInstance: inst,
    });
  }
  return targets;
}

/** Steht das Ziel `t` unter der Kontrolle des Gegners von `pi`? (Held: Kontrolle des Helden; Kreatur: Kontrolleur der Instanz.) */
function istGegnerZiel(engine, t, pi) {
  const oi = engine.opponentOf(pi);
  if (t.type === 'hero') return engine.kontrolleurVonHeld(t.owner, t.heroIdx) === oi;
  const inst = t.cardInstance;
  return !!inst && (inst.controller ?? inst.owner) === oi;
}

module.exports = {
  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT,
  // laeuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  // Im normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: {
    impact: { type: 'flame_strike' }, impactMs: 260,
  },

  // ── CPU: Ziel-Intercept (Shield-of-Life-Klasse) ──────────────────
  // Cancellable Utility-Ziel ohne baseDamage fällt sonst auf den
  // Engine-Decline durch. Politik: Burn auf GEGNER-Held (brennt dessen Kreaturen mit), sonst
  // gegnerische Kreatur. Die Wahlliste enthält seit 16.11.2026 auch EIGENE Ziele (Text: „choose a
  // target") — die CPU brennt nie die eigenen; gibt es kein gegnerisches Ziel, lehnt sie ab.
  cpuResponse(engine, kind, payload) {
    if (kind !== 'effectTarget') return undefined;
    const vt = (payload?.validTargets || []).filter(t => t && !t.ineligible);
    if (vt.length === 0) return undefined;
    const pi = payload.playerIdx;
    const gegner = (t) => istGegnerZiel(engine, t, pi);
    const pick = vt.find(t => t.type === 'hero' && gegner(t)) || vt.find(t => gegner(t));
    return pick ? [pick.id] : [];
  },


  // Blinded (Spielgestalter-Entscheidung 16.11.2026): Zielwahl-Effekt; Zhuque wählt JEDES Ziel („choose a target") → unter Blinded nur eigene Ziele
  // (kein `blindedEigeneZiele`: die Engine nimmt die Näherung „eigener lebender Held/eigene Kreatur").
  requiresTarget: true,
  creatureEffect: true,

  // Cardinal Beasts are signature win-condition pieces — their once-per-
  // turn actives are FREE permanent control reductions on the opponent's
  // side (burn that never expires here, instant 1HP for Xuanwu's revives,
  // Qinglong's chain, Baihu's freeze). The eval can underweight a single
  // burn against the +3 commit threshold for `mctsGatedActivation`,
  // skipping the activation when it's clearly correct to fire it. Force-
  // commit whenever `canActivateCreatureEffect` returns true (which
  // already gates "is there a non-burned target?") so the CPU always
  // uses the active when possible.
  cpuMeta: { alwaysCommit: true },

  hooks: {
    onPlay: async (ctx) => { _setCardinalImmune(ctx); },
    onCardEnterZone: async (ctx) => {
      if (ctx.enteringCard?.name?.startsWith('Cardinal Beast')) await _checkCardinalWin(ctx);
    },
  },

  canActivateCreatureEffect(ctx) {
    // Must have 1+ non-burned target (Held oder Kreatur, beide Seiten — Spielgestalter-Entscheidung 16.11.2026).
    const engine = ctx._engine;
    const ziele = sammleZiele(engine);
    // CPU/MCTS brennt nie die eigenen Ziele (`cpuResponse`): ohne gegnerisches Ziel waere die Aktivierung (`alwaysCommit`) ein leerer Zug.
    if (engine.isCpuPlayer?.(ctx.cardOwner) || engine._inMctsSim) return ziele.some(t => istGegnerZiel(engine, t, ctx.cardOwner));
    return ziele.length > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    // Styx 28.9.: „you" = Kontrolleur (seitenfremd beschworen: cardOwner ≠ owner).
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;

    // Build targets: ALLE nicht brennenden Helden und Kreaturen beider Seiten (Text: „choose a target").
    const targets = sammleZiele(engine);
    const cardDB = engine._getCardDB();
    if (targets.length === 0) return false;

    // Unwählbares (schon brennend, tot, Ausrüstung …) bleibt ausgegraut sichtbar (CARD_API „Zielwahl graut Unwählbares aus").
    const selectedIds = await engine.promptEffectTarget(pi, [...targets, ...ausgegrauteRestkarten(engine, targets)], {
      title: 'Cardinal Beast Zhuque',
      description: 'Choose a target to Burn permanently.',
      confirmLabel: '🔥 Burn!',
      confirmClass: 'btn-danger',
      cancellable: true,
      maxTotal: 1,
    });
    if (!selectedIds || selectedIds.length === 0) return false;
    const picked = targets.find(t => t.id === selectedIds[0]);
    if (!picked) return false;

    // Flame animation
    engine._broadcastEvent('play_zone_animation', {
      type: 'flame_strike', owner: picked.owner,
      heroIdx: picked.heroIdx, zoneSlot: picked.type === 'hero' ? -1 : picked.slotIdx,
    });
    await engine._delay(400);

    if (picked.type === 'hero') {
      // ★ Als Ruling (Al 26.10.): „Burn all Creatures in its Support Zones as well" ist eine Gruppenwirkung (Held + Kreaturen = mehr als 1 Ziel) eines Kreatureneffekts
      // ohne Schaden → Reaktionsfenster der AoE-Prinzipien (Rook of Kings [B], Divine Gift of Rain, Castling, „hit by"-Surprises) VOR dem Brennen. Ohne Kreaturen in
      // den Support Zones des Helden bleibt es bei der Einzelwahl (kein zweites Fenster). Negiert eine Reaktion den Effekt, ist die Nutzung verbraucht.
      const mitKreaturen = [];
      for (const inst of engine.cardInstances) {
        if (engine.physicalSide(inst) !== picked.owner || inst.zone !== 'support' || inst.heroIdx !== picked.heroIdx || inst.faceDown) continue;
        const cd0 = inst.counters?._cardDataOverride || cardDB[inst.name];
        if (!cd0 || !hasCardType(cd0, 'Creature')) continue;
        mitKreaturen.push({ type: 'creature', owner: engine.physicalSide(inst), heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot, cardName: inst.name });
      }
      if (mitKreaturen.length > 0) {
        const sr = await engine.statusHitSurpriseWindow(ctx.card, [{ owner: picked.owner, heroIdx: picked.heroIdx }], 'creature', {
          ziele: [{ type: 'hero', owner: picked.owner, heroIdx: picked.heroIdx, cardName: picked.cardName }, ...mitKreaturen],
        });
        if (sr?.effectNegated) { engine.sync(); return true; }
      }
      const hero = gs.players[picked.owner]?.heroes?.[picked.heroIdx];
      if (hero && hero.hp > 0 && !hero.statuses?.burned) {
        await engine.addHeroStatus(picked.owner, picked.heroIdx, 'burned', { permanent: true, appliedBy: pi });
      }
      // Also burn all creatures in this hero's support zones. PHYSICAL
      // side identifies which player's board the slot is on — stolen
      // creatures stay on owner's side; cross-side-placed creatures
      // (Chilly Wizard) sit on the controller's side. Styx 28.9.:
      // `physicalSide` kennt auch seitenfremd beschworene Kreaturen.
      for (const inst of engine.cardInstances) {
        const physSide = engine.physicalSide(inst);
        if (physSide !== picked.owner || inst.zone !== 'support' || inst.heroIdx !== picked.heroIdx) continue;
        if (inst.faceDown) continue;
        const cd = inst.counters?._cardDataOverride || cardDB[inst.name]; // token-override-aware (Biomancy Token — Als AoE-Report)
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        engine._broadcastEvent('play_zone_animation', {
          type: 'flame_strike', owner: inst.owner,
          heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
        });
        const applied = await engine.applyCreatureStatus(inst, 'burned', {
          sourceOwner: pi,
          source: 'Cardinal Beast Zhuque',
        });
        if (applied) engine.log('creature_burned', { card: inst.name, owner: inst.owner, by: 'Cardinal Beast Zhuque' });
      }
    } else if (picked.cardInstance) {
      const applied = await engine.applyCreatureStatus(picked.cardInstance, 'burned', {
        sourceOwner: pi,
        source: 'Cardinal Beast Zhuque',
      });
      if (applied) engine.log('creature_burned', { card: picked.cardName, owner: picked.owner, by: 'Cardinal Beast Zhuque' });
    }

    engine.log('zhuque_burn', { player: gs.players[pi]?.username, target: picked.cardName });
    engine.sync();
    return true;
  },
};
