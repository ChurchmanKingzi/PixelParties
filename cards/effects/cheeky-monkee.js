// ═══════════════════════════════════════════
//  CARD EFFECT: "Cheeky Monkee"
//  Creature (Normal, Lv1, 20 HP, Summoning Magic)
//
//  "Once per turn, when you gain 4 or more Gold through an effect, you
//   may immediately pay that Gold to choose a target and deal 80 damage
//   to it."
//
//  ── Ausloeser ──
//  `afterResourceGain` — NACH der Buchung, damit das gerade gewonnene
//  Gold wirklich bezahlbar ist und die Anzeige beim Prompt schon den
//  neuen Stand zeigt (Als Vorgabe 8.8.). Was als Ausloeser zaehlt, steht
//  in `_monkee-shared.js` (eigener Gewinn, kein Rundeneinkommen, >= 4).
//
//  ── "pay that Gold" ──
//  Als Ruling: der GESAMTE gerade gewonnene Betrag, nicht zwingend 4.
//  Wer 12 auf einmal bekommt, zahlt 12.
//
//  ── "Once per turn" ──
//  SOFT, pro INSTANZ (Unterscheidung aus v249: der Wortlaut "Once per
//  turn" ohne "you can only ... per turn" ist die weiche Form). Zwei
//  Cheeky Monkees duerfen also je einmal feuern. Gezaehlt wird ueber
//  einen Rundenstempel auf der Instanz, NICHT ueber `onTurnStart` —
//  ein eingefrorener oder gestunter Monkee wuerde den sonst nie
//  zuruecksetzen (Als Regel 4.8.).
//
//  "a target" = jedes beliebige Ziel, Freund wie Feind, Held wie
//  Kreatur (Als Ruling 4.8.).
// ═══════════════════════════════════════════

const { monkeeGoldTrigger, goldSourceVerbraucht, verbraucheGoldSource,
  investHoptUsed, markInvestHopt, payInvestCounters, heroesWithInvest,
} = require('./_monkee-shared');

const CARD_NAME = 'Cheeky Monkee';
const DAMAGE = 80;

/** Jedes Ziel auf dem Brett: Helden und Kreaturen beider Seiten. */
function alleBrettZiele(engine) {
  const { hasCardType } = require('./_hooks');
  const ziele = [];
  for (let pi = 0; pi < 2; pi++) {
    const heroes = engine.gs.players[pi]?.heroes || [];
    for (let hi = 0; hi < heroes.length; hi++) {
      const hero = heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      ziele.push({ id: `hero-${pi}-${hi}`, type: 'hero', owner: pi, heroIdx: hi, cardName: hero.name });
    }
  }
  const db = engine._getCardDB ? engine._getCardDB() : {};
  for (const inst of (engine.cardInstances || [])) {
    if (inst.zone !== 'support' || inst.faceDown) continue;
    if (!hasCardType(db[inst.name], 'Creature')) continue;
    ziele.push({
      id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`, type: 'equip',
      owner: inst.owner, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
      cardName: inst.name, cardInstance: inst,
    });
  }
  return ziele;
}

module.exports = {
  requiresTarget: true,
  // ^ Blinded-Gating, siehe cards/effects/_hooks.js.
  activeIn: ['support'],

  // v345: OHNE dieses Flag bietet die Engine den Effekt gar nicht an —
  // `creatureEffectScriptAllows` steigt bei `!script.creatureEffect`
  // sofort aus, und `getActivatableCreatures` schickt die Karte dann nie
  // als aktivierbar an den Client. Criminal Monkee hatte es schon, die
  // anderen drei nicht: die Zweitfaehigkeiten aus v343 waren deshalb
  // unausloesbar.
  creatureEffect: true,

  hooks: {
    afterResourceGain: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;
      if (ctx.card?.zone !== 'support') return;

      const betrag = monkeeGoldTrigger(ctx, pi);
      if (!betrag) return;
      // Hat schon ein anderer Monkee diese Goldquelle genommen? Dann ist
      // sie weg (Als Ruling 8.8.).
      if (goldSourceVerbraucht(ctx)) return;

      const inst = ctx.card;
      const counters = inst.counters || (inst.counters = {});
      if (counters._cheekyMonkeeTurn === gs.turn) return;

      // "pay that Gold" — ohne Deckung gar nicht erst fragen.
      if ((ps.gold || 0) < betrag) return;

      const bestaetigt = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: CARD_NAME,
        message: `You gained ${betrag} Gold. Pay ${betrag} Gold to deal ${DAMAGE} damage to a target?`,
        showCard: CARD_NAME,
        confirmLabel: `🐒 Pay ${betrag} Gold!`,
        cancelLabel: 'No',
        cancellable: true,
        gerrymanderEligible: true,
      });
      if (!bestaetigt || bestaetigt.cancelled) return;

      // Stempel VOR der Zahlung: das Bezahlen feuert `afterResourceSpend`,
      // was weitere Monkee-Effekte anstossen kann — ohne den Stempel
      // koennte dieser Monkee dabei erneut hereinlaufen.
      counters._cheekyMonkeeTurn = gs.turn;

      const bezahlt = await engine.actionSpendGold(pi, betrag);
      if (!bezahlt) return;
      // Die Quelle ist jetzt verbraucht — kein weiterer Monkee reagiert
      // auf dieses Gewinn-Ereignis.
      verbraucheGoldSource(ctx);

      const target = await ctx.promptDamageTarget({
        side: 'any', types: ['hero', 'creature'],
        damageType: 'creature',
        baseDamage: DAMAGE,
        title: CARD_NAME,
        description: `Deal ${DAMAGE} damage to a target.`,
        confirmLabel: `💥 ${DAMAGE} Damage!`,
        confirmClass: 'btn-danger',
        cancellable: false,
      });
      if (!target) return;

      engine._broadcastEvent('play_zone_animation', {
        type: 'explosion', owner: target.owner,
        heroIdx: target.heroIdx,
        zoneSlot: target.type === 'hero' ? -1 : target.slotIdx,
      });
      await engine._delay(300);

      if (target.type === 'hero') {
        const h = gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (h?.name && h.hp > 0) await ctx.dealDamage(h, DAMAGE, 'creature');
      } else if (target.cardInstance) {
        await engine.actionDealCreatureDamage(
          ctx.card, target.cardInstance, DAMAGE, 'creature',
          { sourceOwner: pi, canBeNegated: true },
        );
      }

      engine.log('cheeky_monkee', {
        player: ps.username, goldPaid: betrag, damage: DAMAGE,
        target: target.cardName || target.type,
      });
      engine.sync();
    },
  },

  // ══ ZWEITE FAEHIGKEIT (v343): Invest Counter als Kosten ══
  // 4 Invest Counter → 80 Schaden auf ein beliebiges Ziel auf dem Brett.
  // Die Zaehler kommen von Logan, the Investment Monkee — das ist die
  // Klammer, die ihn in den Archetyp einbindet. Alles Gemeinsame
  // (Kandidatensuche, Auswahl, Abbuchen, Einmal-pro-Zug je Instanz)
  // steht in `_monkee-shared.js`.
  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    if (ctx.card?.zone !== 'support') return false;
    if (investHoptUsed(engine.gs, ctx.card)) return false;
    if (heroesWithInvest(engine.gs.players[ctx.cardOwner], 4).length === 0) return false;
    return true;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    if (ctx.card?.zone !== 'support') return false;
    if (investHoptUsed(engine.gs, ctx.card)) return false;
    // v346: Zielwahl VOR der Zahlung und abbrechbar — wie bei Resilient
    // Monkee. Wer abbricht, hat nichts ausgegeben und seine
    // Einmal-pro-Zug-Nutzung noch.
    const ziele = alleBrettZiele(engine);
    if (ziele.length === 0) return false;
    const wahl = await engine.promptEffectTarget(pi, ziele, {
      title: CARD_NAME,
      description: 'Choose a target for 80 damage.',
      confirmLabel: '💥 80 Damage!',
      cancellable: true,
      selectCount: 1,
      minSelect: 1,
    });
    const id = Array.isArray(wahl) ? wahl[0] : wahl;
    if (!id) return false;                            // abgebrochen
    const ziel = ziele.find(t => t.id === id);
    if (!ziel) return false;

    if (!await payInvestCounters(engine, pi, 4, CARD_NAME)) return false;
    markInvestHopt(engine.gs, ctx.card);
    // v349 (Als Vorgabe, Muster Book of Doom): der Karten-Auftritt kommt
    // ERST jetzt — Ziel steht, Kosten sind bezahlt. Der Server hat ihn
    // nur angemeldet; wir loesen ihn aus, bevor die Bananen fallen.
    engine.announceActiveEffect();
    const quelle = ctx.card;
    // v347: kleiner Bananenregen — dieselbe Animation wie bei Logan,
    // nur mit weniger Bananen (`count`). Vor dem Schaden, damit erst
    // die Bananen fallen und dann die Zahl erscheint.
    engine._broadcastEvent('play_zone_animation', {
      type: 'golden_banana_rain',
      count: 6,
      owner: ziel.owner,
      heroIdx: ziel.heroIdx,
      zoneSlot: ziel.type === 'hero' ? -1 : ziel.slotIdx,
    });
    await engine._delay(380);
    if (ziel.type === 'hero') {
      const held = engine.gs.players[ziel.owner]?.heroes?.[ziel.heroIdx];
      if (held && held.hp > 0) await engine.actionDealDamage(quelle, held, 80, 'creature');
    } else if (ziel.cardInstance) {
      await engine.actionDealCreatureDamage(quelle, ziel.cardInstance, 80, 'creature',
        { sourceOwner: pi, canBeNegated: true });
    }
    engine.log('cheeky_monkee_invest_damage', {
      player: engine.gs.players[pi]?.username, target: ziel.cardName, damage: 80,
    });
    engine.sync();
    return true;
  },
};
