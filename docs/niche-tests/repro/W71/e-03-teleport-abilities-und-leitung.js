'use strict';
// W71e-03 · Teleport: Ability-Boni wandern MIT dem Helden (Toughness: Max-HP, Fighting: ATK); Leitung (Auftritt erst nach der Wahl) auf beiden Sitzen.
const H = require('../../lib/h.js');
const W = require('../../lib/wire.js');
const CARD = 'Teleport';
const waehle = (t, a, b, seat = 0) => { t.targetFn = (valid) => [`hero-${seat}-${a}`, `hero-${seat}-${b}`].filter(id => valid.some(v => v.id === id)); };

(async () => {
  const R = H.runner();

  R.section('A · Toughness/Fighting-Boni bleiben beim Helden');
  {
    const t = await H.fresh({ hand: [['Toughness', 'Fighting', CARD], []] });
    const r1 = await t.play(0, 'Toughness', { hero: 0 });
    t.gs.players[0].abilityGivenThisTurn = [false, false, false];   // eine Ability je Held und Zug — für den Test freigeben
    const r2 = await t.play(0, 'Fighting', { hero: 0 });
    const h0 = t.gs.players[0].heroes[0];
    const hp0 = h0.maxHp, atk0 = h0.atk;
    R.check('Vorbedingung: Hero 0 hat Toughness/Fighting-Bonus (Max-HP/ATK über Basis)', r1 === true && r2 === true && (hp0 > 800 || atk0 > 40), [r1, r2, hp0, atk0, JSON.stringify(t.gs.players[0].abilityZones[0])]);
    waehle(t, 0, 2);
    await t.play(0, CARD, { hero: 1 });
    const hh = t.gs.players[0].heroes;
    R.check('Held (jetzt Platz 2) behält Max-HP und ATK', hh[2].maxHp === hp0 && hh[2].atk === atk0, [hh[2].maxHp, hh[2].atk, hp0, atk0]);
    R.check('der Held auf dem alten Platz hat die Basiswerte', hh[0].maxHp === 800, hh[0].maxHp);
    R.check('Abilities liegen bei Platz 2', t.gs.players[0].abilityZones[2].flat().length >= 2 && t.gs.players[0].abilityZones[0].flat().length === 0, JSON.stringify(t.gs.players[0].abilityZones));
    R.check('Ability-Instanzen: alle bei heroIdx 2', t.engine.cardInstances.filter(c => c.zone === 'ability' && c.owner === 0 && c.heroIdx === 0).length === 0);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
    R.check('Zustand sauber', t.audit().length === 0, t.audit());
  }

  R.section('B · Fähigkeit nach dem Tausch benutzbar (Ability-Zone folgt dem Helden)');
  {
    const t = await H.fresh({ hand: [[CARD, 'Fireball'], []], abilities: { 0: { 0: [['Destruction Magic', 'Destruction Magic'], [], []] } } });
    waehle(t, 0, 1);
    await t.play(0, CARD, { hero: 2 });
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    t.gs.turn += 2; t.gs.activePlayer = 0;
    const r = await t.play(0, 'Fireball', { hero: 1, noGrant: true });
    R.check('der Held mit Destruction Magic (jetzt Platz 1) kann Fireball wirken', r === true && t.hp(1, 0) === 650, [r, t.hp(1, 0)]);
    t.setHand(0, ['Fireball']);
    const r2 = await t.play(0, 'Fireball', { hero: 0, noGrant: true, active: 0 });
    R.check('der Held auf dem alten Platz 0 (ohne Schule) kann es NICHT', r2 === false, r2);
  }

  for (const seat of [0, 1]) {
    const opp = 1 - seat;
    const label = `[S${seat}] ${CARD}`;
    R.section(label + ' — Leitung');
    const mk = () => W.reicheSzene({ seat, karten: [CARD], board: async (t) => { t.grantFor(seat, 0, CARD); } });
    const answer = (e) => {
      if (e.kind === 'target') { const v = (e.valid || []).filter(x => !x.ineligible && x.type === 'hero' && x.owner === seat); return v.length >= 2 ? [v[0].id, v[1].id] : undefined; }
      return undefined;
    };
    const d = await W.durchlauf(mk, seat, CARD, { seat, hero: 2, maxCancel: 3, answer });
    W.pruefeDurchlauf(R, label, d, { seat, nCanc: 1, nEcht: 1 });
    const c = d.clean;
    R.check(`${label}: die Plätze wurden getauscht`, c.t.gs.players[seat].heroes[0].name !== W.INERT.creature && c.t.lg('teleport').length === 1, c.t.lg('teleport'));
  }

  R.finish();
})();
