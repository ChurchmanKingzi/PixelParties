'use strict';
// W75 · Audit P4a · die drei Spirits × Darion (geteilte Equip-Zone)
// Kartentexte: „This Creature can only be summoned by a Hero equipped with "Super-Killing Knife, the Tool of Liquidation" / "Earth-Shattering Hammer, Relic of Deri" /
//   "Forbidden Grimoire of a Forgotten Sorceress"." — Knife zusaetzlich: „While this Creature remains on the board, any Hero or Creature that is defeated is deleted. When a Hero is deleted by this
//   effect, delete all cards in its Ability Zones."
// Darion: „All Artifacts equipped to this Hero share 1 Support Zone."
// Erwartet: Traegt Darion die geforderte Ausruestung IRGENDWO in seinem Stapel (unten / Mitte / oben, auch neben einer gleichnamigen Kopie anderer Karten), darf er den Spirit beschwoeren;
//   ohne sie nicht. Faellt Darion mit liegendem Knife-Spirit, wird er geloescht: Stapel (inkl. doppelter Namen) leer, Instanzen und Namen konsistent, die Karten in der Ablage.
// Aufruf: node docs/niche-tests/repro/W75/h-P4a-06-spirits-darion-stapel.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler;
const KNIFE = 'Super-Killing Knife, the Tool of Liquidation', HAMMER = 'Earth-Shattering Hammer, Relic of Deri', GRIM = 'Forbidden Grimoire of a Forgotten Sorceress';
const SP = { knife: 'Spirit of the Super-Killing Knife', hammer: 'Spirit of the Relic Hammer', grim: 'Spirit of the Forbidden Grimoire' };
function stapel(t, seite, hi, slot, namen) {
  const ps = t.gs.players[seite]; ps.supportZones[hi][slot] = [];
  return namen.map(n => { ps.supportZones[hi][slot].push(n); const i = t.engine._trackCard(n, seite, 'support', hi, slot); i.turnPlayed = 1; return i; });
}
(async () => {
  const R = H.runner();

  R.section('Beschwoerungssperre: die geforderte Karte liegt unten / in der Mitte / oben im Stapel');
  for (const [key, equip] of [['knife', KNIFE], ['hammer', HAMMER], ['grim', GRIM]]) {
    for (const pos of [0, 1, 2]) {
      const t = await H.fresh({ active: 0, heroes: [[D, null, null], [F, null, null]], hand: [[F], [F]], gold: 500 });
      const namen = ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown']; namen[pos] = equip;
      stapel(t, 0, 0, 0, namen);
      const script = H.loadCardEffect(SP[key]);
      const cd = H.DB[SP[key]];
      const ok = script.canPlayWithHero(t.gs, 0, 0, cd, t.engine);
      R.check(SP[key] + ': Darion mit ' + equip.split(',')[0] + ' an Stapelplatz ' + pos + ' darf beschwoeren', ok === true, ok);
    }
    const t = await H.fresh({ active: 0, heroes: [[D, null, null], [F, null, null]], hand: [[F], [F]], gold: 500 });
    stapel(t, 0, 0, 0, ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown']);
    const ok = H.loadCardEffect(SP[key]).canPlayWithHero(t.gs, 0, 0, H.DB[SP[key]], t.engine);
    R.check(SP[key] + ': ohne die Ausruestung im Stapel nicht beschwoerbar', ok === false, ok);
  }

  R.section('Knife-Spirit steht, Darion faellt: Stapel mit doppeltem Namen wird sauber abgebaut');
  for (const stapelModus of [true, false]) {
    const t = await H.fresh({ active: 0, heroes: [[D, 'Tushu, the Knowledge Keeper', null], [F, null, null]], hand: [[F], [F]], gold: 500, deck: [Array(15).fill(F), Array(15).fill(F)] });
    const sp = t.put(0, 1, 0, SP.knife); sp.turnPlayed = 1;
    if (stapelModus) stapel(t, 0, 0, 1, ['Club of Gobbo', KNIFE, 'Club of Gobbo', 'Cute Crown']);
    else { t.put(0, 0, 0, 'Club of Gobbo'); t.put(0, 0, 1, KNIFE); t.put(0, 0, 2, 'Cute Crown'); }
    t.gs.players[0].abilityZones[0][0] = ['Fighting']; t.engine._trackCard('Fighting', 0, 'ability', 0, 0);
    const hero = t.gs.players[0].heroes[0];
    const res = await t.run(() => t.engine.actionDealDamage({ name: 'test', owner: 1, heroIdx: 0 }, hero, 99999, 'attack'));
    await t.drain();
    const z = t.gs.players[0].supportZones[0];
    R.note(stapelModus ? 'stapel' : 'einzeln', JSON.stringify({ hero: t.gs.players[0].heroes[0].name, z, ablage: t.pile(0, 'discardPile'), geloescht: t.pile(0, 'deletedPile') }));
    R.check((stapelModus ? 'Stapel' : 'einzeln') + ': Darion bzw. der Held ist geloescht', !t.gs.players[0].heroes[0].name || t.gs.players[0].heroes[0].hp <= 0, t.gs.players[0].heroes[0]);
    R.check((stapelModus ? 'Stapel' : 'einzeln') + ': keine Ausruestung bleibt zurueck', z.every(s => s.length === 0), z);
    R.check((stapelModus ? 'Stapel' : 'einzeln') + ': alle vier Ausruestungen in der Ablage (inkl. doppelter Club)', ['Club of Gobbo', KNIFE, 'Cute Crown'].every(n => t.pile(0, 'discardPile').includes(n)) && t.pile(0, 'discardPile').filter(n => n === 'Club of Gobbo').length === (stapelModus ? 2 : 1), t.pile(0, 'discardPile'));
    R.check((stapelModus ? 'Stapel' : 'einzeln') + ': Ability-Karte geloescht', t.pile(0, 'deletedPile').includes('Fighting'), t.pile(0, 'deletedPile'));
    R.check((stapelModus ? 'Stapel' : 'einzeln') + ': sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
