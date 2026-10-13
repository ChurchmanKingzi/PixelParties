// A08-30 · Waflav-Formen („Choose any target on the board"): die Zielliste führt eine seitenfremd beschworene Kreatur unter dem falschen Brett (Besitzer statt Brettseite), IDs kollidieren
//
// Kartentexte: Flamebathed/Swampborne/Thunderstruck: „On Ascension: Choose any target on the board and Burn/Poison/Stun it." (gemeinsam `_waflav-shared.js collectBoardTargets`)
// Aufbau: Sitz 0 hat „ZZ Dummy" (Held 0 / Slot 0) und spielt Plant Golem (Besitzer 0, Kontrolleur 1, steht auf Seite 1 / Held 0 / Slot 0). Waflav steigt zu Swampborne auf; die Zielwahl wird geöffnet.
// Erwartung: Der Golem steht in der Liste mit seiner Brettseite (owner 1, id `equip-1-0-0`) wie bei Bakhm (Messung: `equip-1-0-0`) und anderen Sammlern; alle IDs sind eindeutig.
// Beobachtet: Der Golem trägt `owner: 0` und die ID `equip-0-0-0` – dieselbe ID wie die Dummy auf Seite 0. Die Oberfläche zeichnet das Ziel an der Dummy (bzw. einem leeren Platz), und
//   `targets.find(t => t.id === pick[0])` liefert immer den ersten Eintrag; der Golem lässt sich nicht gezielt wählen.
// Ursache: `_waflav-shared.js` ~Z. 436-445: `id: equip-${inst.owner}-…`, `owner: inst.owner` statt der Brettseite (`engine.physicalSide(inst)`).
// Aufruf: node docs/niche-tests/repro/A08-pacman/30-waflav-zielliste-seitenfremde-kreatur.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const F = H.INERT.filler, D = H.INERT.creature;
  const WAF = 'Waflav, the Metamorphing Monstrosity';
  const t = await H.fresh({ heroes: [[WAF, 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], null], gold: [100, 100], hand: [[], []], deck: [Array(30).fill(F), Array(30).fill(F)] });
  t.hero(0, 0)._evolutionCounters = 3;
  const own = t.put(0, 0, 0, D); own.turnPlayed = 1;
  t.grantFor(0, 1, 'Plant Golem');
  await t.play(0, 'Plant Golem', { hero: 1, slot: 1 });
  const g = t.inst(x => x.name === 'Plant Golem' && x.zone === 'support')[0];
  R.check('Aufbau: Golem steht auf Seite 1 (Besitzer 0)', g && t.engine.physicalSide(g) === 1 && g.owner === 0, g && [g.owner, g.controller, t.engine.physicalSide(g)]);
  let liste = null;
  t.targetFn = (v) => { liste = v.filter(x => x.type === 'equip'); return [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 2).id]; };
  t.gs.activePlayer = 0; t.phase(2);
  t.engine.handZugangSync(0, 'Swampborne Waflav');
  await t.run(() => t.engine.performAscension(0, 0, 'Swampborne Waflav', t.pile(0, 'hand').indexOf('Swampborne Waflav'), {}));
  R.note('Zielliste', JSON.stringify((liste || []).map(x => ({ id: x.id, owner: x.owner, card: x.cardName }))));
  const eintragGolem = (liste || []).find(x => x.cardName === 'Plant Golem');
  R.check('Golem erscheint mit der Brettseite 1', eintragGolem && eintragGolem.owner === 1, eintragGolem && eintragGolem.owner);
  const ids = (liste || []).map(x => x.id);
  R.check('IDs der Kreaturen sind eindeutig', new Set(ids).size === ids.length, ids);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
