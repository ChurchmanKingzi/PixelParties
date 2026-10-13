'use strict';
// A06-rebelliokai-28 · Gorinthian War Counselor: der Schadensschutz hängt am eigenen Merker, nicht an der tatsächlichen Betäubung
// Kartentext: „…you may once per turn choose a target, except this Creature, and Stun it for 2 turns. Any damage targets Stunned by this effect
//   would take becomes 0."
// Skriptkopf (gorinthian-war-counselor.js): „Laeuft der Stun aus, ist auch der Schutz vorbei – beides endet zusammen." Gemeint ist: der Schutz gilt
//   nur für Ziele, die DIESER Effekt tatsächlich betäubt hat und solange sie betäubt sind.
// Beobachtung: Für Helden stempelt `onCreatureEffect` den Merker `hero._gorinthianStun` unbedingt (Rückgabe von `addHeroStatus` wird nicht
//   geprüft; für Kreaturen wird `applied` geprüft). Zudem endet der Schutz nicht, wenn die Betäubung vorzeitig entfernt wird (Coffee, Cure,
//   Elixir of Recovery … → `cleanseHeroStatuses`).
//   (a) Gegner-Held mit `negative_status_immune` (Betäubung wird abgewehrt) ist trotzdem bis Zug+2 gegen jeden Schaden geschützt.
//   (b) Betäubung wird geheilt → der Held bleibt schadensimmun.
// Erwartung: kein Schutz ohne Betäubung durch diesen Effekt – Probeschaden 10 trifft in beiden Fällen.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const GOR = 'Gorinthian War Counselor', CYK = 'Cykyran War Counselor';
  const src0 = { name: 'Own Source', owner: 0, heroIdx: 0 };
  const setup = async () => {
    const t = await H.fresh({});
    t.put(0, 0, 0, GOR).turnPlayed = t.gs.turn - 1; t.put(0, 0, 1, CYK).turnPlayed = t.gs.turn - 1;
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    t.gs.currentPhase = 2; t.resetActions(0);
    return t;
  };
  const dmg = async (t) => { const b = t.hp(1, 0); await t.run(() => t.engine.actionDealDamage(src0, t.hero(1, 0), 10, 'creature')); return b - t.hp(1, 0); };
  let t, r, d;
  // Kontrolle
  t = await setup(); r = await t.activateCreature(0, 0, 0); d = await dmg(t);
  R.check('Kontrolle: betäubt (' + !!t.hero(1, 0).statuses.stunned + ') und Schaden 0', !!t.hero(1, 0).statuses.stunned && d === 0, { r, d });
  // (a) Betäubung abgewehrt
  t = await setup(); t.hero(1, 0).buffs = { negative_status_immune: true };
  r = await t.activateCreature(0, 0, 0); d = await dmg(t);
  R.check('(a) Betäubung abgewehrt → Held nimmt Schaden (10)', d === 10 || !!t.hero(1, 0).statuses.stunned, { r, stunned: !!t.hero(1, 0).statuses.stunned, marker: t.hero(1, 0)._gorinthianStun, d });
  // (b) Betäubung geheilt
  t = await setup(); r = await t.activateCreature(0, 0, 0);
  await t.run(() => t.engine.cleanseHeroStatuses(t.hero(1, 0), 1, 0, ['stunned'], 'Test'));
  d = await dmg(t);
  R.check('(b) Betäubung geheilt → Held nimmt Schaden (10)', d === 10 || !!t.hero(1, 0).statuses.stunned, { stunned: !!t.hero(1, 0).statuses.stunned, marker: t.hero(1, 0)._gorinthianStun, d });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
