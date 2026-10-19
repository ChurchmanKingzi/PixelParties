'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  H03-heroes-11 · Rafflesia: Kettenzauber-Anspruch auch für eine Reaktion im Action Phase des GEGNERS
//
//  Karte: Rafflesia, the Poison Princess (`cards/effects/rafflesia-the-poison-princess.js`, `hooks.afterSpellResolved`)
//  Kartentext: „Once per turn, **during your Action Phase**, when this Hero uses a Decay or Support Spell, it may immediately use a Spell of the other
//  Spell School from your hand as an additional Action."
//  Aufbau: Rafflesia (Decay 2 / Support 2 / Magic Arts 2) auf Sitz 0, auf der Hand „Spectral Armor" (Support+Magic Arts, Reaction) und „Venom Infusion" (Decay).
//  Sitz 1 ist am Zug (Action Phase) und wirkt „Fireball" auf Rafflesia; Rafflesia reagiert mit Spectral Armor.
//  Erwartung: Das ist NICHT „your Action Phase" (die des Gegners) – kein Zusatzaktions-Anspruch, kein HOPT-Verbrauch, keine „may chain"-Ansage.
//  Beobachtung (✗): Der Hook prüft nur `gs.currentPhase !== 3`, nicht `gs.activePlayer`. Rafflesia bekommt im Gegnerzug den Anspruch
//  (`rafflesia_chain_decay_…`, Ansage „may chain into a Decay Spell!"), das HOPT `rafflesia_chain` ist gestempelt. Folge klein: Anspruch und Ansage verfallen
//  mit dem nächsten Zugbeginn; wirken kann Rafflesia im Gegnerzug mit einer Handkarte ohnehin nur per Reaktion.
//  Aufruf: node docs/niche-tests/repro/H03-heroes/11-rafflesia-reaktion-im-gegnerzug.js   (✗ = Fehler tritt auf)
// ═══════════════════════════════════════════════════════════════════════════
const H = require('../../lib/h.js');
const RAFFLESIA = 'Rafflesia, the Poison Princess';
(async () => {
  const R = H.runner();
  const t = await H.fresh({ heroes: [[RAFFLESIA, 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'], null], hp: 800, active: 1, hand: [['Spectral Armor', 'Venom Infusion'], ['Fireball']] });
  await t.run(() => t.engine.runHooks('onGameStart', {}));
  t.setAbilities(0, 0, [['Decay Magic', 'Decay Magic'], ['Support Magic', 'Support Magic'], ['Magic Arts', 'Magic Arts']]);
  t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
  t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 0 && x.heroIdx === 0).id];
  const r = await t.play(1, 'Fireball', { hero: 0 });
  R.check('Aufbau: Rafflesia hat mit Spectral Armor reagiert (Karte in der Ablage)', r === true && t.pile(0, 'discardPile').includes('Spectral Armor'), { r, abl: t.pile(0, 'discardPile') });
  // W16f: nach dem Fix hält der Anspruch die Phase nicht mehr fest (`_preventPhaseAdvance`), Fireball beendet die Action Phase des Gegners regulär – gemessen wird nur, dass der Gegner am Zug ist.
  R.check('der Gegner ist am Zug (activePlayer 1)', t.gs.activePlayer === 1, [t.gs.activePlayer, t.gs.currentPhase]);
  const claim = t.engine.findAdditionalActionForCategory(0, 'spell', 0, 0);
  R.check('kein Zusatzaktions-Anspruch im Gegnerzug', !claim, claim && Object.keys(claim).length);
  R.check('HOPT „rafflesia_chain" nicht verbrannt', !Object.keys(t.gs.hoptUsed || {}).some(k => /rafflesia/.test(k)), Object.keys(t.gs.hoptUsed || {}));
  R.check('keine „may chain"-Ansage an die Spieler', !t.evs('hero_announcement').some(e => /chain/.test(e.text || '')), t.evs('hero_announcement'));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
