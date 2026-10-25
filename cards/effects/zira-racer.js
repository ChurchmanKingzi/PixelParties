'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Zira Racer"
//  Creature (Normal, Lv1, 50 HP, Summoning Magic)
//
//  „You may once per turn discard a level 3 or lower Creature to choose a target and deal damage equal to 70 times the discarded card's level to it."
//
//  ── ABLAUF ──────────────────────────────────────────────────────────────
//  `onCreatureEffect` (engine-HOPT je Instanz, bei nicht-`false`-Rückgabe; keine Aktion), Vorlage: Assault Eagle / Slave Trader.
//    ① KOSTEN („discard a level 3 or lower Creature"): eine Creature-Karte der HAND mit Level ≤ 3 anklicken (`forceDiscardCancellable`, abbrechbar — Abbruch verbraucht
//       nichts, „you MAY"). Karten ohne Level-Angabe taugen nicht. Boris („darf Abwurf-Kosten ignorieren") wirkt wie bei jedem Abwurf-Preis: die Karte bleibt, der Effekt
//       läuft mit ihrem Level.
//    ② ZIEL („choose a target"): ein beliebiges Ziel auf dem Brett — Helden und Kreaturen beider Seiten, auch die eigenen und Zira Racer selbst. Pflichtwahl: der Abwurf
//       ist schon bezahlt. Gewählt wird über `ctx.promptMultiTarget` (alle Zielschutz-, Umleit- und Negier-Regeln gelten).
//    ③ SCHADEN: 70 × Level der abgeworfenen Karte (Lv0 = 0, Lv1 = 70, Lv2 = 140, Lv3 = 210), Typ `creature`. Ein Level-0-Abwurf ist erlaubt, richtet aber nichts an — dann
//       entfällt die Zielwahl (kein Schaden zu verteilen).
//  Der Level ist der aufgedruckte Level der Karte (`cards.json`). Das Abwerfen kann nicht „verhindert" werden — wer es mit Reaktionen unterläuft, zahlt trotzdem.
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  Zira Racer RAMMT sein Ziel: die Karte rast aus ihrer Zone in das Ziel (`engine.rammeBisKontakt`, dieselbe Ramm-Animation wie Heragas/Johanna), der Schaden fällt im Moment der
//  Berührung. Im Aufprall läuft die Pixelart `zira_impact` (ANIM_REGISTRY, Brett-Animation am Ziel) — ihre WUCHT wächst mit dem Level der abgeworfenen Karte (= mit dem Schaden):
//    Lv1 (70)  Funkenstern: Blitz, ein Stossring, acht Strahlen, wenige Splitter.
//    Lv2 (140) mehr Strahlen, zwei Stossringe, mehr Splitter, Staubwolke, Bildschirmwackeln.
//    Lv3 (210) Riss im Boden, drei Stossringe, Kreuzblitz, viele Splitter, Staub, starkes Bildschirmwackeln (`play_screen_shake` heavy).
//  Der Klang wächst mit (ZONE_ANIM_SFX, `wucht`). Logs `zira_racer`.
//
//  ── Abwurf ohne Verzögerung ─────────────────────────────────────────────
//  Der Abwurf ruft `actionDiscardHandCard` mit `_noGlow: true`: ohne das lässt die Engine ZUERST die Quelle 500 ms aufleuchten (`effectSourceGlow`), und der Klick auf die Handkarte zeigte
//  seine Wirkung erst eine halbe Sekunde später. Die Karte fliegt jetzt sofort in die Ablage.
//
//  ── CPU ─────────────────────────────────────────────────────────────────
//  Wirft die Creature mit dem höchsten Level (≤ 3) ab und trifft den gegnerischen Helden mit den wenigsten HP (Kill zuerst), sonst die schwächste Kreatur.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Zira Racer';
const MAX_LEVEL = 3;
const DAMAGE_PER_LEVEL = 70;
const RAM_MS = 1000;          // Dauer der Ramm-Animation (Aufprall bei 12 %, danach der Rückflug)
const IMPACT_MS = 900;       // Länge von `zira_impact` im Client
const IMPACT_VOR_MS = 20;    // Der Aufprall wird kurz nach dem Rammen gesendet: Einbau-Versatz des Clients (100 ms) + 20 ms ≈ Berührung (12 % von RAM_MS)
const SHAKE_VOR_MS = 80;     // Bildschirmwackeln ab Level 2: kurz vor der Berührung gesendet
const NACH_MS = 360;         // der Rückflug darf zu Ende laufen, bevor der nächste Schritt kommt

/** Handplätze, deren Karte als Abwurf taugt: Creature mit Level ≤ 3. */
function kostenPlaetze(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const db = engine._getCardDB();
  const out = [];
  (ps.hand || []).forEach((name, i) => {
    const cd = db[name];
    if (!cd || !hasCardType(cd, 'Creature')) return;
    const lv = cd.level;
    if (lv === null || lv === undefined || !Number.isFinite(Number(lv)) || Number(lv) > MAX_LEVEL) return;
    out.push(i);
  });
  return out;
}

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
  activeIn: ['support'],
  creatureEffect: true,
  canSummon: () => true,

  /** Aktivierbar, solange eine taugliche Creature auf der Hand liegt. */
  canActivateCreatureEffect(ctx) {
    return kostenPlaetze(ctx._engine, ctx.cardOwner).length > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    const seite = ctx.cardHeroOwner ?? pi;
    const heroIdx = ctx.cardHeroIdx;
    if (!ps) return false;

    // ① Kosten: eine Creature (Level ≤ 3) aus der Hand abwerfen — abbrechbar.
    const eligibleIndices = kostenPlaetze(engine, pi);
    if (eligibleIndices.length === 0) return false;
    const wahl = await engine.promptGeneric(pi, {
      type: 'forceDiscardCancellable',
      costFor: CARD_NAME,
      title: CARD_NAME,
      description: `Discard a level ${MAX_LEVEL} or lower Creature to deal ${DAMAGE_PER_LEVEL} damage per level to a target.`,
      instruction: 'Click a highlighted Creature in your hand to discard it.',
      eligibleIndices,
      cancellable: true,
      cancelLabel: 'Cancel',
    });
    if (!wahl || wahl.cancelled || wahl.cardName == null) return false;
    if (!eligibleIndices.includes(wahl.handIndex) || ps.hand[wahl.handIndex] !== wahl.cardName) return false;
    const name = wahl.cardName;
    const level = Number(engine._getCardDB()[name]?.level) || 0;
    const schaden = DAMAGE_PER_LEVEL * level;

    if (!(await engine.borisVerzicht(pi, 1, { source: CARD_NAME }))) {
      // `_noGlow`: sonst leuchtet die Quelle 500 ms auf, bevor die gewählte Karte abgeworfen wird (zu langer Delay nach dem Klick).
      const ok = await engine.actionDiscardHandCard(pi, name, wahl.handIndex, { source: CARD_NAME, selfInflicted: true, _noGlow: true });
      if (!ok) return false;
    }

    // Lv0: nichts zu verteilen.
    if (schaden <= 0) {
      engine.log('zira_racer', { player: ps.username, discarded: name, level, damage: 0, target: null });
      engine.sync();
      return true;
    }

    // ② Ziel — Pflichtwahl (bezahlt ist bezahlt).
    // pflichtwahl: der Abwurf ist schon bezahlt, die Wahl des Ziels lässt sich nicht abbrechen.
    const gewaehlt = await ctx.promptMultiTarget({
      types: ['hero', 'creature'],
      side: 'any',
      min: 1,
      max: 1,
      baseDamage: schaden,
      damageType: 'creature',
      title: CARD_NAME,
      description: `Deal ${schaden} damage (${DAMAGE_PER_LEVEL} × level ${level} of ${name}) to a target.`,
      confirmLabel: `⚡ ${schaden}!`,
      confirmClass: 'btn-danger',
      cancellable: false,
      noSpellCancel: true,
    });
    const ziel = Array.isArray(gewaehlt) ? gewaehlt[0] : null;
    if (!ziel) { engine.sync(); return true; }

    // ③ Zira Racer rammt das Ziel; der Schaden fällt im Moment der Berührung, der Aufprall wächst mit Level und Schaden.
    const wucht = Math.max(1, Math.min(3, level));
    const zielSlot = ziel.type === 'hero' ? -1 : ziel.slotIdx;
    const rammen = engine.rammeBisKontakt({
      sourceOwner: seite, sourceHeroIdx: heroIdx, sourceZoneSlot: ctx.card?.zoneSlot,
      targetOwner: ziel.owner, targetHeroIdx: ziel.heroIdx, targetZoneSlot: zielSlot >= 0 ? zielSlot : undefined,
      cardName: CARD_NAME, duration: RAM_MS,
    });
    await engine._delay(IMPACT_VOR_MS);
    engine._broadcastEvent('play_zone_animation', {
      type: 'zira_impact', zoneType: 'board', owner: seite, heroIdx: -1, zoneSlot: -1, duration: IMPACT_MS, wucht, schaden,
      targets: [{ owner: ziel.owner, heroIdx: ziel.heroIdx, zoneSlot: zielSlot }],
      originOwner: seite, originHeroIdx: heroIdx, originZoneSlot: ctx.card?.zoneSlot ?? -1,
    });
    if (wucht >= 2) {
      await engine._delay(SHAKE_VOR_MS);       // das Wackeln setzt erst mit der Berührung ein, nicht schon beim Anlauf
      engine._broadcastEvent('play_screen_shake', { intensity: wucht >= 3 ? 'heavy' : 'normal' });
    }
    await rammen;

    const source = { name: CARD_NAME, owner: pi, heroIdx };
    if (ziel.type === 'hero') {
      const hero = gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
      if (hero && hero.hp > 0) await ctx.dealDamage(hero, schaden, 'creature');
    } else if (ziel.cardInstance && ziel.cardInstance.zone === 'support') {
      await engine.actionDealCreatureDamage(source, ziel.cardInstance, schaden, 'creature', { sourceOwner: pi, canBeNegated: true });
    }
    engine.log('zira_racer', { player: ps.username, discarded: name, level, damage: schaden, target: ziel.cardName });
    engine.sync();
    await engine._delay(NACH_MS);
    return true;
  },

  /** CPU: die Creature mit dem höchsten Level abwerfen; das Ziel mit dem meisten Nutzen (Kill vor Schwächling). */
  cpuResponse(engine, kind, payload) {
    if (kind === 'generic' && payload?.type === 'forceDiscardCancellable' && payload.costFor === CARD_NAME) {
      const pi = engine._cpuPlayerIdx;
      const hand = engine.gs.players[pi]?.hand || [];
      const db = engine._getCardDB();
      const idx = (payload.eligibleIndices || []).slice()
        .sort((a, b) => (Number(db[hand[b]]?.level) || 0) - (Number(db[hand[a]]?.level) || 0));
      if (idx.length === 0) return undefined;
      return { cardName: hand[idx[0]], handIndex: idx[0] };
    }
    if (kind !== 'effectTarget' || !engine.isPuzzle) return undefined;
    const { validTargets, config, playerIdx } = payload || {};
    if (config?.title !== CARD_NAME || !Array.isArray(validTargets)) return undefined;
    const hp = (t) => engine.gs.players[t.owner]?.heroes?.[t.heroIdx]?.hp ?? Infinity;
    const feinde = validTargets.filter(t => !t.ineligible && t.owner !== playerIdx);
    const helden = feinde.filter(t => t.type === 'hero').sort((a, b) => hp(a) - hp(b));
    const rest = feinde.filter(t => t.type !== 'hero');
    const wahl = helden[0] || rest[0];
    return wahl ? [wahl.id] : undefined;
  },

  _test: { kostenPlaetze, DAMAGE_PER_LEVEL, MAX_LEVEL, RAM_MS, IMPACT_MS },
};
