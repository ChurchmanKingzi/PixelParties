'use strict';
// W63b-04 · Sofort-Guss („as an additional Action", `performImmediateAction`): ein Zauber, der seine fortwirkende Wirkung an die Karteninstanz hängt (`gs._spellKeepInstance`), behält sie auch hier
//
// Befund (Nebenfund der Inya-Untersuchung, gleiche Klasse): der Spielweg `doPlaySpell` zont die Instanz solcher Zauber (Anti Magic Zone, Calm Diatribe, Weapon Unleashing, Mission) in die Ablage um
//   und verbraucht die Marke; `_castSpellImmediately` (Zusatzaktionen: Coffee, Elixir of Rage, Junshi, Friedhelm, Hu …) räumte die Instanz IMMER ab und ließ die Marke stehen → Anti Magic Zone als
//   Sofort-Guss negierte später beschworene Kreaturen nie (Kartentext: „… the effects of all Creatures are negated until the end of your opponent's next turn"), die stehengebliebene Marke hielt
//   die Instanz des NÄCHSTEN gespielten Zaubers grundlos fest.
// Aufbau (je Sitz): Anti Magic Zone auf der Hand, als Sofort-Guss gewirkt (Held 0 neutral bzw. Inya, Token überlebt); der Gegner beschwört im Fenster eine Kreatur.
// Erwartet: die neue Kreatur ist negiert; keine stehengebliebene Marke; die Karte liegt in der Ablage bzw. (Inya) als Buddy auf dem Brett.
// Exit 0 = korrekt.
const H = require('../../lib/h.js');
const IN = 'Card Game Player Inya', AMZ = 'Anti Magic Zone';

async function lauf(seat, inya) {
  const opp = 1 - seat;
  const eigene = [inya ? IN : H.BLANK_HEROES[0], H.BLANK_HEROES[1], H.BLANK_HEROES[2]];
  const heroes = seat === 0 ? [eigene, null] : [null, eigene];
  const hand = [[], []]; hand[seat] = [AMZ];
  const t = await H.fresh({ heroes, hand, turn: 5, active: seat, deckSize: 20 });
  t.grantFor(seat, 0, AMZ);
  t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
  t.script.push({ match: d => d.type === 'heroAction', answer: () => ({ cardName: AMZ, handIndex: 0, heroIdx: 0 }) });
  const r = await t.run(() => t.engine.performImmediateAction(seat, 0, { title: 'Test' }));
  const out = { gespielt: !!(r && r.played) };
  await t.endTurn();
  await t.play(opp, H.INERT.creature, { hero: 1, slot: 1 });
  const neu = t.inst(c => c.zone === 'support' && c.owner === opp && c.heroIdx === 1 && c.zoneSlot === 1)[0];
  out.imFenster = !!(neu && t.engine.isCreatureEffectSuppressed(neu));
  out.markeStehtNicht = !t.gs._spellKeepInstance && !t.gs._spellBecameToken;
  out.fehler = t.errors.length;
  return { out, t };
}

(async () => {
  const R = H.runner();
  for (const seat of [0, 1]) {
    R.section(`── Sitz ${seat} ──`);
    const soll = { gespielt: true, imFenster: true, markeStehtNicht: true, fehler: 0 };
    const a = await lauf(seat, false);
    R.check(`[S${seat}] Sofort-Guss Anti Magic Zone ohne Inya: später beschworene Kreatur negiert, keine Restmarke`, JSON.stringify(a.out) === JSON.stringify(soll), a.out);
    R.check(`[S${seat}] ... Karte in der Ablage, Wirkungsträger liegt in der Ablage`, a.t.gs.players[seat].discardPile.includes(AMZ) && a.t.inst(c => c.name === AMZ && c.zone === 'discard').length === 1, { ablage: a.t.gs.players[seat].discardPile });
    const b = await lauf(seat, true);
    R.check(`[S${seat}] Sofort-Guss Anti Magic Zone mit Inya (Token überlebt): gleiche Wirkung`, JSON.stringify(b.out) === JSON.stringify(soll), b.out);
    R.check(`[S${seat}] ... Buddy auf dem Brett, kein Geist, Wirkungsträger in der Ablage`, b.t.inst(c => c.counters && c.counters._fantasyBuddyToken && c.zone === 'support').length === 1 && b.t.inst(c => c.name === AMZ && c.zone === 'hand' && c.heroIdx >= 0).length === 0 && b.t.inst(c => c.name === AMZ && c.zone === 'discard').length === 1, b.t.inst(c => c.name === AMZ).map(c => c.zone));
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
