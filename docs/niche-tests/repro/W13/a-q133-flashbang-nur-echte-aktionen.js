'use strict';
// W13a · Q133 (M01-01, Flashbang: Tränke und Normal-Artefakte beenden den Zug) · Al, 15.10.2026:
//   „Nein, absolut nicht. Nur Attacks, Spells, Creatures (inklusive 'place') sowie Effekte wie Adventurousness oder Zi, die explizit eine Action
//    kosten (also auch nicht JEDER aktive Hero-Effekt!)."
// Erwartet: Flashbang beendet den Zug des Betroffenen NUR bei Attacks, Spells, Creatures (auch Platzierungen aus der Hand) und Effekten, die ausdrücklich
//   eine Action kosten (Adventurousness, Zi u. ä.). Tränke, Normal-Artefakte und aktive Heldeneffekte OHNE Action-Kosten zählen nicht.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const ZI = 'Timeless King Zi';
  async function lauf(handOpp, aufbau, aktion, opts = {}) {
    const t = await H.fresh({ hand: [['Flashbang'], handOpp], gold: 100, ...(opts.fresh || {}) });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    if (aufbau) aufbau(t);
    await t.play(0, 'Flashbang');
    await t.endTurn();
    const ok = t.gs.activePlayer === 1;
    const turn = t.gs.turn;
    await aktion(t);
    return { t, ok, beendet: t.gs.activePlayer !== 1 || t.gs.turn !== turn };
  }

  R.section('zählen NICHT: Trank, Normal-Artefakt, aktiver Heldeneffekt ohne Action-Kosten');
  for (const [name, hand, aufbau, aktion] of [
    ['Elixir of Strength (Trank)', ['Elixir of Strength'], null, (t) => t.play(1, 'Elixir of Strength', { hero: 0 })],
    ['Cloud Pillow (Normal-Artefakt)', ['Cloud Pillow'], null, (t) => t.play(1, 'Cloud Pillow')],
  ]) {
    const x = await lauf(hand, aufbau, aktion);
    R.check(`${name}: Vorbedingung Sitz 1 am Zug`, x.ok);
    R.check(`${name}: der Zug läuft weiter`, !x.beendet, { active: x.t.gs.activePlayer, phase: x.t.gs.currentPhase });
    R.check(`${name}: keine Engine-Fehler`, x.t.errors.length === 0, x.t.errors);
  }
  {
    // aktiver Heldeneffekt ohne Action-Kosten: Heinz (wirft gleiche Karten ab und zieht), Main Phase 1
    let r;
    const x = await lauf(['Heal', 'Heal', 'Heal'], null, async (t) => {
      t.policy.confirm = true;
      t.script.push({ match: d => /Heinz|Visionary/.test(d.title || ''), answer: (d) => (d.cards ? { selectedCards: d.cards.slice(0, 3).map(c => c.name || c) } : { confirmed: true }) });
      r = await t.activateHero(1, 0, { effect: 'Visionary Genius Heinz', phase: 2 });
    }, { fresh: { heroes: [null, ['Visionary Genius Heinz', 'Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker']], deck: [Array(10).fill(H.INERT.filler), Array(10).fill(H.INERT.filler)] } });
    R.check('Heinz-Effekt wurde ausgeführt (Aufbau)', r === true, r);
    R.check('Heldeneffekt ohne Action-Kosten (Heinz): der Zug läuft weiter', !x.beendet, { active: x.t.gs.activePlayer, phase: x.t.gs.currentPhase });
    R.check('Heinz: keine Engine-Fehler', x.t.errors.length === 0, x.t.errors);
  }

  R.section('zählen: Attack, Spell, Creature, Ability mit Action-Kosten (Adventurousness), Heldeneffekt mit Action-Kosten (Zi)');
  {
    const x = await lauf(['Attack'], (t) => t.grantFor(1, 0, 'Attack'), (t) => { t.targetFn = (v) => [v.find(q => q.type === 'hero' && q.owner === 0).id]; return t.play(1, 'Attack', { hero: 0 }); });
    R.check('Attack beendet den Zug', x.beendet, x.t.gs.activePlayer);
  }
  {
    const x = await lauf(['Haste'], (t) => t.grantFor(1, 0, 'Haste'), (t) => t.play(1, 'Haste', { hero: 0 }));
    R.check('Spell beendet den Zug', x.beendet, x.t.gs.activePlayer);
  }
  {
    const x = await lauf([H.INERT.creature], null, (t) => t.play(1, H.INERT.creature, { hero: 0, slot: 0 }));
    R.check('Creature beendet den Zug', x.beendet, x.t.gs.activePlayer);
  }
  {
    const x = await lauf([], (t) => { t.setAbilities(1, 0, [['Adventurousness'], [], []]); }, (t) => t.activateAbility(1, 0, 0, { phase: 3 }));
    R.check('Adventurousness (Ability mit Action-Kosten) beendet den Zug', x.beendet, x.t.gs.activePlayer);
  }
  {
    let r;
    const x = await lauf([], null, async (t) => {
      t.script.push({ match: d => d.type === 'cardGalleryMulti' && d.title === ZI, answer: () => ({ selectedCards: ['Haste', 'Heal', 'Fireball'] }), once: true });
      t.script.push({ match: d => d.type === 'birthdayPresentPick', answer: () => ({ cardName: 'Haste' }), once: true });
      r = await t.activateHero(1, 0, { effect: ZI, phase: 3 });
    }, { fresh: { heroes: [null, [ZI, 'Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker']], deck: [Array(10).fill(H.INERT.filler), [H.INERT.filler, 'Haste', 'Heal', 'Fireball', ...Array(12).fill(H.INERT.filler)]] } });
    R.check('Zi-Effekt wurde ausgeführt (Aufbau)', r === true, r);
    R.check('Zi (Heldeneffekt mit Action-Kosten) beendet den Zug', x.beendet, x.t.gs.activePlayer);
    R.check('Zi: keine Engine-Fehler', x.t.errors.length === 0, x.t.errors);
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
