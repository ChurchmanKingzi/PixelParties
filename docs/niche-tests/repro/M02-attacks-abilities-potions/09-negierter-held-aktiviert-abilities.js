'use strict';
// M02-09 · Ein NEGIERTER Held kann die aktiven Effekte seiner Abilities weiter aktivieren
// Regel (Engine): negierte Helden verlieren ihre Held- und Ability-Effekte – `_isHeroEffectSilenced` (_engine.js ~6447: stunned/webbed/frozen/negated/mummified),
//   `heroMeetsLevelReq` („Hard Negation blanks ability zones"), und der Heldeneffekt-Weg `doActivateHeroEffect` (server.js ~10732) sperrt „Stunned / negated".
// Erwartung: ein negierter Held kann Pillage / Thieving / Trade (freie Ability-Aktivierungen) nicht aktivieren – wie ein gefrorener/betäubter.
// Beobachtet: `doActivateFreeAbility` (server.js ~9525) und `getFreeActivatableAbilities` (_engine.js ~42470) prüfen nur stunned/webbed/frozen, NICHT negated.
//   Alle drei Aktivierungen laufen und wirken (Gegnerdeck −1, +9 Gold). Betrifft jede aktive Ability (hier Pillage, Thieving, Trade getestet).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  async function lauf(status) {
    const t = await H.fresh({ hand: [[], []], deck: [Array(10).fill('ZZ Dummy'), Array(10).fill('ZZ Dummy')], hp: 800 });
    t.setAbilities(0, 0, [['Pillage'], ['Thieving'], ['Trade']]);
    if (status) t.heroStatus(0, 0, status);
    const gold0 = t.gs.players[0].gold;
    const act = (zi) => { const sc = H.loadCardEffect(t.gs.players[0].abilityZones[0][zi][0]); t.gs.activePlayer = 0; t.phase(2); return t.run(() => t.host.doActivateFreeAbility(t.room, 0, { heroIdx: 0, zoneIdx: zi })); };
    t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
    const r1 = await act(0), r2 = await act(1), r3 = await act(2);
    return { r1, r2, r3, oppDeck: t.pile(1, 'mainDeck').length, gold: t.gs.players[0].gold - gold0 };
  }
  const normal = await lauf(null);
  R.check('Kontrolle: unversehrter Held aktiviert alle drei (Gegnerdeck 9, +9 Gold)', normal.r1 && normal.r2 && normal.r3 && normal.oppDeck === 9 && normal.gold === 9, normal);
  for (const st of ['frozen', 'stunned']) {
    const o = await lauf(st);
    R.check(`Kontrolle: ${st}er Held aktiviert nichts`, !o.r1 && !o.r2 && !o.r3 && o.oppDeck === 10 && o.gold === 0, o);
  }
  const neg = await lauf('negated');
  R.check('negierter Held kann seine Abilities NICHT aktivieren (Gegnerdeck 10, +0 Gold)', !neg.r1 && !neg.r2 && !neg.r3 && neg.oppDeck === 10 && neg.gold === 0, neg);
  R.finish();
})();
