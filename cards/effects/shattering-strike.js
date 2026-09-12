// ═══════════════════════════════════════════
//  CARD EFFECT: "Shattering Strike"
//  Attack (Normal, Lv2, Fighting)
//
//  „Choose a Creature your opponent controls and deal damage equal to
//   the attacker's Attack stat to it. If that damage defeats the
//   Creature, choose another Creature your opponent controls and deal
//   the same damage to it, if possible. If that damage defeats that
//   target, this effect occurs again."
//
//  • Betrag = ATK-Stat des Nutzers (`hero.atk`, inkl. Fighting-Boni —
//    „Attack stat", nicht „base ATK" wie bei Strong Ox Headbutt).
//  • Erster Treffer: normales Angriffs-Targeting (`ctx.promptDamageTarget`,
//    Seite 'enemy', nur Kreaturen) und `_fireAttackDeclare` — Glass
//    Sword & Co. duerfen den Betrag aendern. DIESER Betrag ist „the
//    same damage" fuer alle Folgetreffer.
//  • Kette: wird die Kreatur besiegt (Instanz nicht mehr in der Support
//    Zone), naechste gegnerische Kreatur waehlen und denselben Betrag
//    zufuegen — solange sie besiegt wird und es noch eine gibt. Die
//    Folgetreffer sind kein neuer Angriff (kein Declare, kein Surprise-
//    Fenster mehr), nur Schaden ueber `actionDealCreatureDamage`.
//  • Animation `shattering_strike`: kleinerer Hammer als Magic Hammer,
//    mit aufwirbelnder Erde (braune Brocken + Staubring), eigener Klang.
// ═══════════════════════════════════════════

const CARD_NAME = 'Shattering Strike';

function oppCreatureTargets(engine, pi) {
  const oppIdx = pi === 0 ? 1 : 0;
  return engine.getCreatureTargets(oppIdx).filter(t => t.cardInstance && t.cardInstance.zone === 'support');
}

async function smash(engine, attackSource, target, amount) {
  const inst = target.cardInstance || engine.cardInstances.find(c =>
    c.owner === target.owner && c.zone === 'support' && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx);
  if (!inst) return false;
  engine._broadcastEvent('play_zone_animation', {
    type: 'shattering_strike', owner: target.owner, heroIdx: target.heroIdx, zoneSlot: target.slotIdx,
  });
  await engine._delay(520);
  await engine.actionDealCreatureDamage(attackSource, inst, amount, 'attack', { sourceOwner: attackSource.owner, canBeNegated: true });
  await engine._delay(300);
  return !engine.cardInstances.includes(inst) || inst.zone !== 'support';
}

module.exports = {
  // v856 (Als Befund): ohne eine gegnerische Creature ist die Karte
  // wirkungslos — der Kartentext verlangt sie als Ziel. Der Vertrag
  // wird zentral ausgewertet (`hasRequiredTargetKind` in _engine.js):
  // Handkarte grau UND Server-Riegel.
  requiresTargetKind: 'oppCreature',

  requiresTarget: true,

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      const hero = ps?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;
      if (oppCreatureTargets(engine, pi).length === 0) { gs._spellCancelled = true; return; }
      const atk = hero.atk || 0;

      const target = await ctx.promptDamageTarget({
        side: 'enemy',
        types: ['creature'],
        damageType: 'attack',
        baseDamage: atk,
        title: CARD_NAME,
        description: `Choose an opponent's Creature — deal ${atk} damage (your Attack stat). If that defeats it, strike another one with the same damage.`,
        confirmLabel: `🔨 Shatter! (${atk})`,
        confirmClass: 'btn-danger',
        cancellable: true,
      });
      if (!target) return;
      const attackSource = { name: CARD_NAME, owner: pi, heroIdx, controller: pi };
      const amount = await engine._fireAttackDeclare(attackSource, target, atk);

      let hits = 0, defeats = 0;
      let defeated = await smash(engine, attackSource, target, amount);
      hits++;
      const struck = new Set([target.id]);
      while (defeated) {
        defeats++;
        const rest = oppCreatureTargets(engine, pi).filter(t => !struck.has(t.id));
        if (rest.length === 0) break;                          // „if possible"
        let next = rest[0];
        if (rest.length > 1) {
          const wahl = await engine.promptEffectTarget(pi, rest, {
            title: CARD_NAME,
            description: `The Creature was defeated! Choose another opponent's Creature to deal ${amount} damage to.`,
            confirmLabel: `🔨 Shatter again! (${amount})`,
            confirmClass: 'btn-danger',
            cancellable: false,
            maxTotal: 1,
          });
          const id = Array.isArray(wahl) ? wahl[0] : wahl;
          next = rest.find(t => t.id === id) || next;
        }
        struck.add(next.id);
        engine.log('shattering_strike_chain', { player: ps.username, hero: hero.name, target: next.cardName, damage: amount });
        defeated = await smash(engine, attackSource, next, amount);
        hits++;
      }
      engine.log('shattering_strike_done', { player: ps.username, hero: hero.name, hits, defeats: defeated ? defeats + 1 : defeats, damage: amount });
      engine.sync();
    },
  },
};
