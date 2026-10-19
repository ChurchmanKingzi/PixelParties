'use strict';
// W18b-1 · Anti Magic Zone: Helden, die im Fenster NEU ins Spiel kommen, bekommen die Zauber-Sperre automatisch
// Kartentext: „No target can use any Spells and the effects of all Creatures are negated until the end of your opponent's next turn."
// Al (19.10.2026): „Wiederbelebte (oder z.B. via Teleport Powder zurückkehrende) Heroes bekommen automatisch den Status/Debuff und können nicht casten!"
// Erwartung: (A) im Fenster wiederbelebter Held hat magic_silenced und kann keinen Zauber spielen; (B) per Teleportation Powder entfernter und im
//   Fenster zurückkehrender Held hat magic_silenced; (C) nach Ablauf des Fensters kommt ein wiederbelebter Held OHNE Sperre zurück;
//   (D) Extra Life im Fenster: der Held kommt gesperrt zurück; (E) die Sperre endet mit der Zone (nach echtem Zugwechsel).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const sil = (t, s, h) => !!t.gs.players[s].heroes[h].statuses?.magic_silenced;

  R.section('(A) Wiederbelebung im Fenster');
  {
    const t = await H.fresh({ hand: [['Anti Magic Zone'], ['Fireball']] });
    t.gs.players[1].heroes[2].hp = 0;
    await t.play(0, 'Anti Magic Zone', { hero: 0 });
    await t.endTurn();
    const ok = await t.run(() => t.engine.actionReviveHero(1, 2, 100));
    R.check('Held 2 (Sitz 1) wiederbelebt', ok === true && t.hp(1, 2) === 100, { ok, hp: t.hp(1, 2) });
    R.check('wiederbelebter Held hat magic_silenced', sil(t, 1, 2), t.gs.players[1].heroes[2].statuses);
    t.grantFor(1, 2, 'Fireball');
    const r = await t.play(1, 'Fireball', { hero: 2 });
    R.check('wiederbelebter Held kann keinen Zauber spielen', r === false || t.hp(0, 0) === 800 && t.pile(1, 'hand').includes('Fireball'),
      { r, hp0: t.hp(0, 0), hand: t.pile(1, 'hand') });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('(B) Rückkehr per Teleportation Powder im Fenster');
  {
    const t = await H.fresh({ hand: [['Teleportation Powder'], ['Anti Magic Zone']] });
    t.targetFn = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 1); return v ? [v.id] : null; };
    await t.play(0, 'Teleportation Powder', { hero: 0 });
    R.check('Held 1 (Sitz 1) ist entfernt', !t.gs.players[1].heroes[1].name, t.gs.players[1].heroes[1]);
    await t.endTurn();                                   // Zug 6 (Sitz 1)
    await t.play(1, 'Anti Magic Zone', { hero: 0 });     // Fenster bis Beginn von Sitz 1 in Zug 8
    await t.endTurn();                                   // Zug 7 (Sitz 0): Rückkehr am Zugbeginn
    R.check('Held 1 ist zurück', !!t.gs.players[1].heroes[1].name && t.hp(1, 1) > 0, t.gs.players[1].heroes[1].name);
    R.check('Rückkehrer hat magic_silenced', sil(t, 1, 1), t.gs.players[1].heroes[1].statuses);
    await t.endTurn();                                   // Zug 8: Fenster zu Ende
    R.check('(E) Sperre endet mit der Zone', !sil(t, 1, 1), t.gs.players[1].heroes[1].statuses);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('(C) nach Ablauf des Fensters: keine Sperre');
  {
    const t = await H.fresh({ hand: [['Anti Magic Zone'], []] });
    t.gs.players[1].heroes[2].hp = 0;
    await t.play(0, 'Anti Magic Zone', { hero: 0 });
    await t.endTurn(); await t.endTurn(); await t.endTurn();   // Zug 8: Fenster (bis Beginn von Sitz 0 in Zug 7) längst vorbei
    await t.run(() => t.engine.actionReviveHero(1, 2, 100));
    R.check('Held nach Ablauf ohne magic_silenced', !sil(t, 1, 2), t.gs.players[1].heroes[2].statuses);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('(D) Extra Life im Fenster');
  {
    const t = await H.fresh({ hand: [['Anti Magic Zone'], []] });
    await t.play(0, 'Anti Magic Zone', { hero: 0 });
    t.gs.players[1].heroes[0]._extraLife = { by: 'Trial of Coolness' };
    await t.run(() => t.engine.actionDefeatHero({ name: 'Test', owner: 0 }, t.gs.players[1].heroes[0], { reason: 'test' }));
    R.check('Held lebt durch Extra Life', t.hp(1, 0) > 0, t.hp(1, 0));
    R.check('Extra-Life-Rückkehrer hat magic_silenced', sil(t, 1, 0), t.gs.players[1].heroes[0].statuses);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
