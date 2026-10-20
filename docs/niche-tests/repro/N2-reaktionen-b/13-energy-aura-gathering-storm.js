'use strict';
// N2-13 · Energy Aura gegen Gathering Storm: Aura bleibt bis Zugende liegen, Ziehen verspätet, und sie wehrt auch den ZWEITEN gleichnamigen Spell ab
// Kartentext (Energy Aura): „Negate the next time the Hero this card is attached to would be affected by a Spell, and if you do, send this attached card to your discard pile and draw 2 cards."
// Kartentext (Gathering Storm): „… at the start of each of their turns [the opponent chooses 3 targets] … Deal 70 damage to those targets." (Spell mit Untertyp Attachment, Schaden als Quelle „Gathering Storm")
// Skript energy-aura.js: abgeräumt wird NACH der Auflösung des Spells (`afterSpellResolved`); fällt dieser Haken aus, erst `onTurnEnd`/`onTurnStart` (Kopfkommentar „Rückfall"). `heroSpellWardBlocks`
//   (_engine.js ~7490) blockt, solange derselbe Spell-NAME läuft (`counters._wardSpentOn === spell`).
// Gathering Storm tickt im Zugbeginn-Hook und löst nie `afterSpellResolved` aus → die verbrauchte Aura
//   (1) liegt den ganzen Zug über weiter am Helden (Karte sollte sofort in die Ablage, 2 Karten sofort gezogen),
//   (2) blockt jeden weiteren Gathering-Storm-Tick desselben Zugbeginns (anderer Gathering Storm = anderer Spell, die Aura gilt nur für „the next time"),
//   (3) die zwei Karten kommen erst am Zugende.
// Erwartung: nach dem ersten Treffer liegt die Aura in der Ablage, die Hand ist um 2 größer; ein zweiter Gathering Storm trifft den Helden (70 Schaden).
const H = require('../../lib/h.js');
const sup = (t, s, h) => t.gs.players[s].supportZones[h].map(z => z[0] || '');
(async () => {
  const R = H.runner();
  for (const [sturm, opfer] of [[0, 1], [1, 0]]) {
    for (const zwei of [false, true]) {
      R.section(`Sitz ${sturm} hat ${zwei ? 'ZWEI' : 'EINEN'} Gathering Storm, Sitz ${opfer} trägt Energy Aura an Held 0`);
      const t = await H.fresh({ hand: [0, 1].map(i => i === sturm ? ['Gathering Storm', 'Gathering Storm'] : ['Energy Aura']), deckSize: 30, active: sturm });
      t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
      t.targetFn = (v) => [v.find(y => y.type === 'hero' && y.owner === sturm && y.heroIdx === 0).id];
      await t.play(sturm, 'Gathering Storm', { hero: 0 });
      if (zwei) { t.targetFn = (v) => [v.find(y => y.type === 'hero' && y.owner === sturm && y.heroIdx === 1).id]; await t.play(sturm, 'Gathering Storm', { hero: 1 }); }
      t.targetFn = (v) => [v.find(y => y.type === 'hero' && y.owner === opfer && y.heroIdx === 0).id];
      await t.play(opfer, 'Energy Aura', { hero: 0 });
      R.check('Aufbau: Aura liegt am Helden 0', sup(t, opfer, 0).includes('Energy Aura'), sup(t, opfer, 0));
      t.gs.activePlayer = sturm;
      t.targetFn = (v, cfg) => (cfg && cfg.title === 'Gathering Storm') ? v.slice(0, 3).map(x => x.id) : [v[0].id];
      t.reset();
      const hand0 = t.pile(opfer, 'hand').length;
      await t.endTurn();    // Zugbeginn des Opfers: Gathering-Storm-Tick(s)
      const nachTick = { hp0: t.hp(opfer, 0), hp1: t.hp(opfer, 1), sup: sup(t, opfer, 0), hand: t.pile(opfer, 'hand').length };
      R.note('nach dem Tick', { ...nachTick, handVorher: hand0 });
      R.check('Aura ist nach dem Treffer sofort in der Ablage', !nachTick.sup.includes('Energy Aura') && t.pile(opfer, 'discardPile').includes('Energy Aura'), nachTick.sup);
      R.check('„draw 2 cards" sofort: Hand +2 (zusätzlich zur Ziehkarte des Zuges)', nachTick.hand >= hand0 + 3, nachTick.hand - hand0);
      if (zwei) R.check('der zweite Gathering Storm trifft Held 0 (Aura galt nur für „the next time")', nachTick.hp0 === 730, nachTick.hp0);
      R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
