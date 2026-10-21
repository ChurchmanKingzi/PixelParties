'use strict';
// W38/a-00 · Layn, Defender of Deri × Surprise-Kreaturen (Pure Advantage Camel & Co.): wieder verdeckt gesetzte und erneut beschworene Kreatur
// Meldung von Al (22.10.2026, aus einer alten Version): „Creatures bekamen manchmal nur max, aber keine aktuellen HP … Setzt man [eine Surprise Creature] und beschwört sie erneut
//   (z. B. Pure Advantage Camel), haben sie z. B. 40/140 HP – der max-Boost ist noch da, aber die aktuellen HP entsprechen dem alten Max-Wert."
// Kartentext Layn: „Increase the current and max HP of any Creature you summon by 100." Pure Advantage Camel: „… You may once per turn move this Creature you control into the
//   corresponding Hero's Surprise Zone face-down." Sie verlässt das Brett und tritt beim nächsten Auslösen FRISCH wieder an (`_resetCreatureForSurpriseZone`).
// Erwartet: jedes Mal, wenn die Kreatur (neu) aufs Brett kommt, steht sie bei Basis-HP + 100 (aktuell UND max); nach dem Zurücksetzen gibt es keinen Rest-Boost.
// Aufruf: node docs/niche-tests/repro/W38/a-00-layn-surprise-kreatur-erneut-beschworen.js   (Exit 1 = Fehler tritt auf)
const H = require('../../lib/h.js');
const LD = 'Layn, Defender of Deri';
const CAMEL = 'Pure Advantage Camel';
const wait = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const R = H.runner();
  const base = H.DB[CAMEL].hp;
  for (const seat of [0, 1]) {
    R.section(`Camel Sitz ${seat}: auslösen -> wieder verdeckt setzen -> erneut auslösen`);
    const heroes = [[LD, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], [LD, H.BLANK_HEROES[1], H.BLANK_HEROES[2]]];
    const t = await H.fresh({ heroes, deck: [Array(20).fill(H.INERT.filler), Array(20).fill(H.INERT.filler)] });
    const opp = 1 - seat;
    t.grantFor(seat, 0, CAMEL);
    t.putSurprise(seat, 0, CAMEL);
    t.put(opp, 0, 0, H.INERT.big);
    t.policy.confirm = true;
    const trigger = async () => {   // Gegner zieht außerhalb seiner Resource Phase
      t.gs.activePlayer = opp; t.phase(3);
      await t.run(() => t.engine.actionDrawCards(opp, 1));
      await t.run(() => t.engine._flushSurpriseDrawChecks());
      await wait(250);
    };
    const camel = () => t.engine.cardInstances.find(c => c.name === CAMEL && c.zone === 'support');
    const hp = (c) => ({ cur: c.counters.currentHp ?? c.counters.maxHp ?? H.DB[CAMEL].hp, max: c.counters.maxHp ?? H.DB[CAMEL].hp });

    await trigger();
    let c = camel();
    R.check('1. Auslösen: Camel liegt auf dem Brett', !!c);
    if (c) R.check(`1. Auslösen: ${base + 100}/${base + 100} HP (Layn +100)`, c.counters.currentHp === base + 100 && c.counters.maxHp === base + 100, c.counters);

    // Wieder verdeckt setzen (eigener Effekt, einmal pro Zug)
    t.gs.activePlayer = seat; t.phase('ACTION');
    await t.run(() => t.engine.surpriseCreatureReset({ card: c, cardHeroOwner: seat, cardHeroIdx: c.heroIdx, cardController: seat, _engine: t.engine }));   // Effekt „move this Creature … face-down“
    await wait(300);
    c = camel();
    R.check('2. wieder verdeckt gesetzt: nicht mehr auf dem Brett', !c, c && c.zone);
    const sz = t.engine.cardInstances.find(x => x.name === CAMEL);
    R.check('2. wieder verdeckt gesetzt: kein Rest-Boost (maxHp-Zähler und Layn-Marke weg)', !!sz && sz.counters._laynBonus == null && (sz.counters.maxHp == null || sz.counters.maxHp === base), sz && sz.counters);

    await trigger();
    c = camel();
    R.check('3. erneut ausgelöst: Camel liegt wieder auf dem Brett', !!c);
    if (c) {
      R.check(`3. erneut ausgelöst: wieder ${base + 100}/${base + 100} HP (nicht ${base}/${base + 100})`, hp(c).cur === base + 100 && hp(c).max === base + 100, hp(c));
      R.check('3. nie mehr als +100 (kein Doppel-Boost)', hp(c).max <= base + 100, hp(c));
      R.check('3. beide Zähler gesetzt (die Anzeige liest `currentHp` und `maxHp` getrennt)', c.counters.currentHp === base + 100 && c.counters.maxHp === base + 100, c.counters);
    }
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
