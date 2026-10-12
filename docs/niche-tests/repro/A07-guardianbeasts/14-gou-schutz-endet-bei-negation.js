'use strict';
// A07-14 · Guardian Beast Gou: der Schutz endet, sobald Gou negiert oder eingefroren wird (Text nennt nur „leaves the board")
//
// Kartentext Gou: „… Those targets take no damage until the beginning of your next turn. If this Creature leaves the board,
//   this effect ends prematurely."
// Erwartung: Der Schutz läuft bis zum Beginn des nächsten eigenen Zuges, solange Gou auf dem Brett BLEIBT – auch wenn sie
//   danach negiert/eingefroren wird (sie hat das Brett nicht verlassen).
// Beobachtet: Der Schutz hängt an den Hooks `beforeDamage`/`beforeCreatureDamageBatch` der Gou-Instanz (guardian-beast-gou.js
//   hooks); `runHooks` überspringt negierte/gefrorene/betäubte Kreaturen → der Schutz ist sofort weg, die Marke bleibt als Geist
//   im Buff stehen.
const H = require('../../lib/h.js');
const F = H.INERT.filler;

async function lauf(statusFn) {
  const t = await H.fresh({ discard: [Array(3).fill(F), []], deckSize: 20 });
  const gou = t.put(0, 0, 0, 'Guardian Beast Gou'); gou.turnPlayed = 1;
  const ziel = t.put(0, 0, 1, H.INERT.big); ziel.turnPlayed = 1;
  t.script.push({ match: d => d && d.type === 'cardGalleryMulti', once: true, answer: (d) => ({ selectedIndices: [0], selectedCards: [d.cards[0].name] }) });
  t.targetFn = (v) => [v.find(x => x.cardName === H.INERT.big && x.owner === 0).id];
  t.gs.activePlayer = 0; t.phase(2);
  await t.activateCreature(0, 0, 0);
  const vorher = ziel.counters.currentHp ?? 1000;
  await t.engine.actionDealCreatureDamage({ name: 'T', owner: 1, heroIdx: 0 }, ziel, 100, 'creature');
  const kontrolle = vorher - (ziel.counters.currentHp ?? 1000);
  await statusFn(t, gou);
  const v2 = ziel.counters.currentHp ?? 1000;
  await t.engine.actionDealCreatureDamage({ name: 'T', owner: 1, heroIdx: 0 }, ziel, 100, 'creature');
  return { t, kontrolle, verlust: v2 - (ziel.counters.currentHp ?? 1000) };
}

(async () => {
  const R = H.runner();
  let o = await lauf(async () => {});
  R.check('Kontrolle: geschützte Kreatur nimmt keinen Schaden', o.kontrolle === 0 && o.verlust === 0, o);
  o = await lauf(async (t, gou) => { await t.engine.actionNegateCreature(gou, 'T'); });
  R.check('Gou wird negiert (bleibt auf dem Brett): Schutz besteht weiter', o.verlust === 0, { verlust: o.verlust });
  o = await lauf(async (t, gou) => { await t.engine.applyCreatureStatus(gou, 'frozen', { sourceOwner: 1 }); });
  R.check('Gou wird eingefroren (bleibt auf dem Brett): Schutz besteht weiter', o.verlust === 0, { verlust: o.verlust });

  R.section('Kombination Mao -> Gou: Mao negiert Gou nach dem Re-Fire „bis zum nächsten eigenen Zug"');
  const t = await H.fresh({ heroes: [['Mao, the Vengeful Guardian', H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], discard: [Array(8).fill(F), []], deckSize: 20 });
  const gou = t.put(0, 0, 0, 'Guardian Beast Gou');                       // frisch beschworen (Mao verlangt „summoned this turn")
  const ziel = t.put(0, 0, 1, H.INERT.big); ziel.turnPlayed = 1;
  t.gs.activePlayer = 0; t.phase(2);
  t.script.push({ match: d => d && d.type === 'cardGalleryMulti', once: true, answer: (d) => { const idx = [0,1,2,3,4]; return { selectedIndices: idx, selectedCards: idx.map(i => d.cards[i].name) }; } });  // Mao-Kosten
  t.script.push({ match: d => d && d.type === 'cardGalleryMulti', once: true, answer: (d) => ({ selectedIndices: [0], selectedCards: [d.cards[0].name] }) });                               // Gou-Kosten
  t.targetFn = (v) => { const g = v.find(x => x.cardName === 'Guardian Beast Gou' && x.owner === 0); if (g && v.length < 4) return [g.id]; const z = v.find(x => x.cardName === H.INERT.big && x.owner === 0); return [z ? z.id : v[0].id]; };
  await t.activateHero(0, 0, {});
  const v0 = ziel.counters.currentHp ?? 1000;
  await t.engine.actionDealCreatureDamage({ name: 'T', owner: 1, heroIdx: 0 }, ziel, 100, 'creature');
  R.check('Mao hat Gou erfolgreich gefeuert (Ziel geschützt)', !!ziel.counters.buffs?.gou_protected || (ziel.counters.currentHp ?? 1000) === v0, { buffs: ziel.counters.buffs });
  R.check('der von Mao ausgelöste Gou-Schutz wirkt (0 Schaden), obwohl Gou danach negiert wurde', v0 - (ziel.counters.currentHp ?? 1000) === 0, { verlust: v0 - (ziel.counters.currentHp ?? 1000), gouNegiert: !!gou.counters.negated });
  R.finish();
})();
