'use strict';
// W64a-02 · Elixir of Immortality × Alice-Teilung: die ursprüngliche Zone der Kreatur hat Vorrang (Kartenregel), danach geteilt vor frei (Al, 23.10.2026: „Ja.")
//
// Kartentext: „The next time a target you control is defeated, delete this card and revive and heal that target's HP for half their maximum instead (rounded up)."
// Reihenfolge der Landezone: (1) die Zone, in der die Kreatur stand — war sie ein Alice-Stapel, stapelt sich die Wiederbelebung wieder dazu; (2) fällt die Zone weg: eine geteilte Zone einer
// gleichnamigen Kreatur (Alice) VOR (3) der ersten freien Zone. Ohne Alice: alte Zone, sonst die erste freie. Beide Sitze. Exit 0 = korrekt.
const A = require('../../lib/alice-brett.js');
const { H, brett, zoneA, instIn, ohneStapel } = A;
const X = H.INERT.big, Y = H.INERT.creature, EL = 'Elixir of Immortality';

async function lauf(seat, o) {
  const t = await brett(seat, { zonen: o.zonen, extra: o.extra, leer: true, alice: o.alice, hand: [EL] });
  t.engine.cardInstances.filter(c => c.zone === 'support' && c.owner === seat).forEach(c => { c.turnPlayed = 1; });
  t.setHand(seat, [EL]);
  const rEl = await t.play(seat, EL, { hero: 0 });
  const opfer = o.opfer ? o.opfer(t) : t.engine.cardInstances.find(c => c.zone === 'support' && c.owner === seat && c.heroIdx === 0 && c.zoneSlot === 0 && c.name === X);
  if (o.vorTod) await o.vorTod(t, opfer);
  await t.run(() => t.engine.processCreatureDamageBatch([{ inst: opfer, amount: 99999, type: 'physical', source: { name: 'ZZ', owner: 1 - seat, heroIdx: 0, heroOwner: 1 - seat }, sourceOwner: 1 - seat, canBeNegated: true, isStatusDamage: false, animType: null }]));
  // Auslösung: Sammelpunkt nach der Aktion
  await t.run(() => t.engine.runHooks('onAnyActionResolved', { actionType: 'creature', playerIdx: seat, heroIdx: 0, _skipReactionCheck: true }));
  return { t, rEl };
}
const zone = (t, seat, h, z) => zoneA(t, seat, h, z);

(async () => {
  const R = H.runner();
  for (const seat of [0, 1]) {
    R.section(`── Sitz ${seat} ──`);
    // (1) Alice-Stapel [X, X]: eine stirbt → die Wiederbelebung kehrt in die ALTE (geteilte) Zone zurück
    {
      const { t, rEl } = await lauf(seat, { zonen: [[X, X], [Y], []], alice: true });
      R.check(`[S${seat}] Elixir gespielt`, rEl === true, { rEl });
      R.check(`[S${seat}] Alice + Stapel: die gestorbene Kopie wird wiederbelebt und liegt wieder in ihrer alten Zone (Stapel ×2), Elixir verbraucht`, zone(t, seat, 0, 0).length === 2 && instIn(t, seat, 0, 0, X) === 2 && !t.gs.players[seat].permanents.some(p => p.name === EL) && ohneStapel(t).length === 0 && t.errors.length === 0, { z: zone(t, seat, 0, 0), perm: t.gs.players[seat].permanents.map(p => p.name), audit: ohneStapel(t), errors: t.errors });
    }
    // (2) Einzel-Zone: Elixir bringt sie in dieselbe Zone zurück (Gegenprobe ohne Alice)
    for (const mitAlice of [true, false]) {
      const { t } = await lauf(seat, { zonen: [[X], [Y], []], alice: mitAlice });
      R.check(`[S${seat}] ${mitAlice ? 'mit' : 'ohne'} Alice, Einzel-Zone: Wiederbelebung in die ALTE Zone (Slot 0), nicht in die freie Zone 2`, zone(t, seat, 0, 0).join() === X && zone(t, seat, 0, 2).length === 0 && ohneStapel(t).length === 0, { z0: zone(t, seat, 0, 0), z2: zone(t, seat, 0, 2) });
    }
    // (3) Alte Zone fällt weg (der Held der alten Zone ist gefallen → dort wird nicht wiederbelebt): geteilt vor frei, ohne Alice die erste freie Zone
    for (const mitAlice of [true, false]) {
      const opfer = (t) => t.engine.cardInstances.find(c => c.zone === 'support' && c.owner === seat && c.heroIdx === 2 && c.zoneSlot === 0);
      const { t } = await lauf(seat, { zonen: [[X], [Y], []], extra: [[2, 0, [X]]], alice: mitAlice, opfer,
        vorTod: async (t2) => { t2.gs.players[seat].heroes[2].hp = 0; } });
      if (mitAlice) R.check(`[S${seat}] Alice, alter Held gefallen: die Wiederbelebung geht in die GETEILTE Zone der gleichnamigen Kreatur (Held 0, Slot 0 → ×2), nicht in die erste freie (Slot 2)`, zone(t, seat, 0, 0).length === 2 && zone(t, seat, 0, 2).length === 0 && instIn(t, seat, 0, 0, X) === 2 && ohneStapel(t).length === 0, { z0: zone(t, seat, 0, 0), z2: zone(t, seat, 0, 2), audit: ohneStapel(t) });
      else R.check(`[S${seat}] ohne Alice, alter Held gefallen: die Wiederbelebung geht in die erste freie Zone (Held 0, Slot 2)`, zone(t, seat, 0, 0).join() === X && zone(t, seat, 0, 2).join() === X && ohneStapel(t).length === 0, { z0: zone(t, seat, 0, 0), z2: zone(t, seat, 0, 2), audit: ohneStapel(t) });
    }
  }
  R.finish();
})().catch(e => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(2); });
