'use strict';
// W25c · N5-06 Nachtrag (Al, Welle 25): „Ja, wenn alle anderen eigenen Heroes immun gegen Burn/Poison-Damage sind, inklusive weil sie etwa via Light Ball geschützt werden,
//   dann wird Chuck dafür anfällig!"
// Kartentext (Chuck): „This Hero takes no damage from any sources, unless all other Heroes you control are immune to that source of damage."
// Regel: Status-Immunität (Light Ball, Immunitäts-Anhängsel wie Petrification Break, Einzel-Immunität `poison_immune`/`burn_immune`, `negative_status_immune`) macht den Helden
//   „immun gegen Burn-/Gift-Schaden"; sind ALLE anderen lebenden eigenen Helden so geschützt, nimmt Chuck den Tick. Ein einziger nicht immuner anderer Held → Chuck bleibt geschützt.
// Exit 0 = Regel gilt.
const H = require('../../lib/h.js');
const CHUCK = 'Chuck, the Crazy Veteran';
const heroes = () => [[CHUCK, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], [H.BLANK_HEROES[0], H.BLANK_HEROES[1], H.BLANK_HEROES[2]]];
(async () => {
  const R = H.runner();
  // Tick-Schaden direkt (Quelle wie der Engine-Tick) auf Chuck
  async function tick(was, aufbau) {
    const t = await H.fresh({ heroes: heroes(), hp: 400 });
    aufbau(t);
    const hp0 = t.hp(0, 0);
    const [name, typ] = was === 'burn' ? ['Burn', 'fire'] : ['Poison', 'poison'];
    await t.run(() => t.engine.actionDealDamage({ name }, t.hero(0, 0), 50, typ));
    return { dmg: hp0 - t.hp(0, 0), t };
  }
  const tot = (t) => { t.gs.players[0].heroes[2].hp = 0; };
  for (const was of ['burn', 'poison']) {
    let r = await tick(was, (t) => { tot(t); });
    R.check(`${was}: Gegenprobe – Held 1 ungeschützt → Chuck bleibt geschützt (0)`, r.dmg === 0, r.dmg);
    r = await tick(was, (t) => { tot(t); t.put(0, 0, 0, 'Light Ball'); });
    R.check(`${was}: Light Ball an Chuck schützt Held 1 vor dem Status → alle anderen immun → Chuck nimmt 50`, r.dmg === 50, r.dmg);
    r = await tick(was, (t) => { t.put(0, 0, 0, 'Light Ball'); });
    R.check(`${was}: Held 2 lebt und ist durch Light Ball ebenfalls geschützt (Held 1 + 2 beide) → Chuck nimmt 50`, r.dmg === 50, r.dmg);
    r = await tick(was, (t) => { tot(t); t.put(0, 1, 0, 'Light Ball'); });
    R.check(`${was}: Light Ball am anderen Helden schützt diesen selbst nicht („all OTHER targets") → Chuck bleibt geschützt (0)`, r.dmg === 0, r.dmg);
    r = await tick(was, (t) => { tot(t); t.gs.players[0].heroes[1].buffs = { negative_status_immune: { source: 'Test' } }; });
    R.check(`${was}: Buff negative_status_immune an Held 1 → Chuck nimmt 50`, r.dmg === 50, r.dmg);
    r = await tick(was, (t) => { tot(t); t.put(0, 1, 0, 'Petrification Break'); });
    R.check(`${was}: Petrification Break (Immunitäts-Anhängsel) an Held 1 → Chuck nimmt 50`, r.dmg === 50, r.dmg);
    r = await tick(was, (t) => { tot(t); t.gs.players[0].heroes[1].statuses[was === 'burn' ? 'burn_immune' : 'poison_immune'] = { appliedTurn: 0 }; });
    R.check(`${was}: Einzel-Immunität (${was === 'burn' ? 'burn_immune' : 'poison_immune'}) an Held 1 → Chuck nimmt 50`, r.dmg === 50, r.dmg);
    r = await tick(was, (t) => { tot(t); t.put(0, 0, 0, 'Light Ball'); t.gs.players[0].heroes[2].hp = 400; t.gs.players[0].heroes[2].name = H.BLANK_HEROES[2]; });
    R.check(`${was}: ein lebender, durch Light Ball geschützter Held 2 + Held 1 → Chuck nimmt 50 (Kontrolle des Aufbaus)`, r.dmg === 50, r.dmg);
  }
  // Gegenprobe Quelle: Light Ball schützt NICHT vor Zauberschaden → Chuck bleibt gegen Fireball geschützt
  {
    const t = await H.fresh({ heroes: heroes(), hp: 400 });
    t.gs.players[0].heroes[2].hp = 0; t.put(0, 0, 0, 'Light Ball');
    const hp0 = t.hp(0, 0);
    await t.run(() => t.engine.actionDealDamage({ name: 'Fireball', owner: 1, controller: 1, heroIdx: 0 }, t.hero(0, 0), 150, 'spell'));
    R.check('Gegenprobe: Light Ball macht Held 1 nicht immun gegen Fireball → Chuck bleibt gegen den Zauber geschützt', hp0 === t.hp(0, 0), hp0 - t.hp(0, 0));
  }
  // Echter Tick: Chuck brennt/vergiftet, Light Ball an Chuck schützt Held 1, Held 2 tot → der Tick am Zugbeginn trifft
  for (const st of ['burned', 'poisoned']) {
    const t = await H.fresh({ heroes: heroes(), hp: 400 });
    t.gs.players[0].heroes[2].hp = 0; t.put(0, 0, 0, 'Light Ball');
    t.engine.addHeroStatus(0, 0, st, { duration: 3, appliedBy: 1 });
    t.reset();
    const hp0 = t.hp(0, 0);
    await t.endTurn(); await t.endTurn();
    R.check(`echter ${st}-Tick: alle anderen Helden status-immun → Chuck nimmt Schaden`, t.hp(0, 0) < hp0, { hp0, hp: t.hp(0, 0) });
    R.check(`keine Engine-Fehler (${st})`, t.errors.length === 0 && t.audit().length === 0, t.errors);
  }
  R.finish();
})();
