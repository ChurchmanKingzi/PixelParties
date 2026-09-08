// ═══════════════════════════════════════════
//  CARD EFFECT: "Heragas, the Monster Slayer"
//  Hero · 450 HP · 100 ATK · Starting Abilities: Fighting, Hunting
//
//  "You may once per turn choose a Creature that was summoned before
//   the end of your last turn and deal damage equal to its max HP to
//   it. This is treated as an Attack. Whenever this Hero defeats a
//   Creature, draw 1 card."
//
//  ── UMSETZUNG ─────────────────────────────────────────────────────
//  • „summoned before the end of your last turn": die GEMEINSAME
//    Zeitmarke aus `_turn-end-recency-shared` — Ralzish liest sie mit
//    umgekehrtem Vorzeichen. `turnPlayed <= tick` ist erlaubt;
//    vorplatzierte Creatures (turnPlayed 0) sind immer erlaubt.
//  • „deal damage equal to its max HP": `counters.maxHp ?? cd.hp` —
//    dieselbe Lesart wie der Overkill-Wächter im Schadens-Batch.
//  • „treated as an Attack": Schadenstyp `'attack'` mit der
//    Heldenquelle `{ name, owner, heroIdx }` (Brackle-Bauart). Damit
//    reagieren Arrows, Reflexionen und — vor allem — Hunting, das
//    genau diese Quelle als „dieser Held besiegt" liest.
//  • „choose a Creature": JEDE Creature auf dem Brett, auch eigene
//    (Kartentext sagt nicht „opponent's"). ← LESART, Al kann sie
//    einschraenken.
//  • „Whenever this Hero defeats a Creature, draw 1 card": kein HOPT,
//    jede Creature (auch eigene), jeder Weg (Schaden UND Zerstoerung
//    — Als Ruling 1.9. zu Hunting gilt hier genauso). Gehoert in
//    `onCreatureDeath`, NICHT ins Anspruchsfenster: dort ist der Tod
//    noch nicht vollzogen. Zieht auch dann, wenn Hunting den Kadaver
//    beansprucht — die Creature ist trotzdem besiegt.
//  • Der Effekt selbst ist HOPT ueber den Hero-Effekt-Mechanismus
//    des Servers („you may once per turn"); `true` verbraucht ihn,
//    `false` (abgebrochen / nichts waehlbar) laesst ihn stehen.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { summonedBeforeLastTurnEnd, stampTurnEnd } = require('./_turn-end-recency-shared');

const CARD_NAME = 'Heragas, the Monster Slayer';

function maxHpOf(engine, inst) {
  const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
  return inst.counters?.maxHp ?? cd?.hp ?? 0;
}

/** Alle waehlbaren Creatures (Brett, aufgedeckt, alt genug). */
function eligibleCreatures(engine, pi) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  const cardDB = engine._getCardDB();
  const out = [];
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support' || inst.faceDown) continue;
    if (inst.counters?.treatAsEquip) continue;
    const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    if (!summonedBeforeLastTurnEnd(inst, ps, gs)) continue;
    out.push(inst);
  }
  return out;
}

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,
  // Nur die Zeitmarken-Buchfuehrung im onTurnEnd laeuft auch durch
  // Frozen / Stunned / Negated — keine Macht, nur die richtige Marke.
  // (Der Server sperrt das Aktivieren des Effekts unter CC ohnehin;
  // das Ziehen beim Besiegen laeuft dann ebenfalls nicht — wer
  // negiert ist, besiegt nichts.)
  bypassStatusFilter: true,

  // CPU: der Effekt ist ein garantierter Kill — nutzen, sobald ein
  // GEGNERISCHES Ziel alt genug ist. Ohne diesen Riegel wuerde der
  // Pilot den Effekt auch mit nur eigenen Zielen anfangen und im
  // Picker abbrechen (Ralzish-Lehre).
  cpuShouldUseHeroEffect(engine, pi) {
    try {
      const opp = pi === 0 ? 1 : 0;
      return eligibleCreatures(engine, pi).some(i => (i.controller ?? i.owner) === opp);
    } catch { return true; }
  },

  canActivateHeroEffect(ctx) {
    const hero = ctx.attachedHero;
    if (!hero?.name || hero.hp <= 0) return false;
    return eligibleCreatures(ctx._engine, ctx.cardOwner).length > 0;
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const hero = gs.players[pi]?.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;

    const erlaubt = new Set(eligibleCreatures(engine, pi).map(i => i.id));
    if (erlaubt.size === 0) return false;

    // Ziel-Picker mit Angriffs-Semantik (Taunt, Untargetable, Truth-
    // Seeing Eye …) — die Frische-Regel als `condition` obendrauf.
    const target = await ctx.promptDamageTarget({
      side: 'any',
      types: ['creature'],
      damageType: 'attack',
      title: CARD_NAME,
      description: 'Choose a Creature summoned before the end of your last turn. Heragas deals damage equal to its max HP to it (treated as an Attack).',
      confirmLabel: '🗡️ Slay!',
      confirmClass: 'btn-danger',
      cancellable: true,
      condition: (t) => !!t.cardInstance && erlaubt.has(t.cardInstance.id),
    });
    if (!target?.cardInstance) return false;   // abgebrochen — HOPT bleibt
    const inst = target.cardInstance;

    // Betrag JETZT einfrieren — der Kartentext meint die max HP im
    // Moment des Angriffs.
    const betrag = maxHpOf(engine, inst);
    if (betrag <= 0) return false;

    // Angriffsstoss des Helden auf die Zone (Ralzish-Bauart), dann
    // der Treffer.
    engine._broadcastEvent('play_ram_animation', {
      sourceOwner: pi, sourceHeroIdx: heroIdx,
      targetOwner: inst.controller ?? inst.owner,
      targetHeroIdx: inst.heroIdx >= 0 ? inst.heroIdx : 0,
      targetZoneSlot: inst.zoneSlot,
      cardName: hero.name, duration: 900,
    });
    await engine._delay(300);

    const source = { name: CARD_NAME, owner: pi, heroIdx };
    await engine.actionDealCreatureDamage(source, inst, betrag, 'attack',
      { sourceOwner: pi, canBeNegated: true });

    engine.log('heragas_slay', {
      player: gs.players[pi].username, creature: inst.name, damage: betrag,
    });
    return true;
  },

  hooks: {
    onTurnEnd: async (ctx) => { stampTurnEnd(ctx); },

    // „Whenever this Hero defeats a Creature, draw 1 card."
    onCreatureDeath: async (ctx) => {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const hi = ctx.cardHeroIdx;
      const quelle = ctx.source;
      if (!quelle || quelle.owner !== pi || quelle.heroIdx !== hi) return;
      await engine.showTriggeredEffect(CARD_NAME);   // Regel: aktivierter Effekt zeigt seine Karte
      await engine.actionDrawCards(pi, 1, { source: CARD_NAME });
      engine.log('heragas_draw', {
        player: engine.gs.players[pi]?.username, creature: ctx.creature?.name,
      });
    },
  },
};
