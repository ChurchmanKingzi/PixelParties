'use strict';
// W5b-B13 (zu H04-05) · Saya: der Zweitguss ist ein vollständiges erneutes Wirken – Entscheidung Al (Welle 5):
//   „Saya sagt, sie aktiviert die komplette Karte noch mal, oder? In dem Fall muss sie once per turn/per game-Einschränkungen beachten, ja!"
// Erwartung: Divine Gift of Creation (once per game), Guard Duty (once per game) und Refreshing Night (once per turn) werden NICHT ein zweites Mal angeboten;
//   Kontrolle: ein Zauber ohne Klausel (Healing Melody … hier: Heal) wird angeboten und gewirkt.
const H = require('../../lib/h.js');
const SAYA = 'Saya, the Plant Princess';
(async () => {
  const R = H.runner();
  const heroes = [[SAYA, 'Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker']];
  const sayaFragen = (t) => t.prompts.filter(p => p.d.type === 'confirm' && /Saya/.test(p.d.title || '')).length;
  {
    const t = await H.fresh({ heroes, hand: [['Refreshing Night'], []] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    t.setAbilities(0, 0, [['Support Magic', 'Support Magic', 'Support Magic'], [], []]);
    t.gs.players[0].heroes[1].hp = 300;                        // verwundet (Max 800)
    t.targetFn = (valid) => [valid.find(v => v.owner === 0 && v.heroIdx === 1).id];
    t.policy.confirm = true;
    const r = await t.play(0, 'Refreshing Night', { hero: 0, noGrant: true });
    R.check('Refreshing Night (einmal pro Zug): gespielt, geheilt (Vorbereitung)', r === true && t.hp(0, 1) === 400, { r, hp: t.hp(0, 1) });
    R.check('Refreshing Night (einmal pro Zug): Saya bietet KEINEN Zweitguss an', sayaFragen(t) === 0 && t.hp(0, 1) === 400, { fragen: sayaFragen(t), hp: t.hp(0, 1) });
    R.check('Refreshing Night: keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {
    const t = await H.fresh({ heroes, hand: [['Heal'], []] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    t.setAbilities(0, 0, [['Support Magic', 'Support Magic', 'Support Magic'], [], []]);
    t.gs.players[0].heroes[1].hp = 300;
    t.targetFn = (valid) => [valid.find(v => v.owner === 0 && v.heroIdx === 1).id];
    t.policy.confirm = true;
    await t.play(0, 'Heal', { hero: 0, noGrant: true });
    R.check('Kontrolle: Heal (ohne Einmal-Klausel) wird zweimal gewirkt – Saya fragt', sayaFragen(t) === 1, { fragen: sayaFragen(t) });
  }
  R.finish();
})();
