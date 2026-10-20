'use strict';
// W24a · N1-09 (Randfall): Held trägt Decisive Defeat UND eine darüberliegende fremde Negierung (`_fremd`).
//  a) Heilen (Cure) räumt beides ab: kein `negated`, Karte in der Ablage von Sitz 0, Zustand sauber.
//  b) Die fremde Negierung läuft am Zugende des Heldenseite ab, die Karte bleibt und der Held bleibt negiert; die Karte danach per Anti Magic entfernt → Held frei.
// Exit 0 = korrekt.
const H = require('../../lib/h.js');
const heroPick = (s, h) => (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === s && x.heroIdx === h); return v ? [v.id] : undefined; };
(async () => {
  const R = H.runner();
  const aufbau = async (hand1) => {
    const t = await H.fresh({ hand: [['Decisive Defeat'], hand1] });
    t.setAbilities(0, 0, [['Decay Magic', 'Decay Magic'], [], []]);
    t.targetFn = heroPick(1, 0);
    await t.play(0, 'Decisive Defeat', { hero: 0 });
    await t.run(() => t.engine.addHeroStatus(1, 0, 'negated', { duration: 1, appliedBy: 0, source: 'Null' }));
    return t;
  };
  const liegt = (t) => t.gs.players[1].supportZones[0].some(z => z.includes('Decisive Defeat'));
  {
    const t = await aufbau([]);
    R.check('a) Aufbau: Karte liegt, Held negiert, fremde Negierung darunter', liegt(t) && !!t.hero(1, 0).statuses.negated?._fremd, t.hero(1, 0).statuses);
    await t.run(() => t.engine.cleanseHeroStatuses(t.hero(1, 0), 1, 0, require('../../../../cards/effects/_hooks').getCleansableStatuses(), 'Cure'));
    await new Promise(r => setTimeout(r, 300));
    R.check('a) nach dem Heilen: kein negated mehr', !t.hero(1, 0).statuses.negated, t.hero(1, 0).statuses);
    R.check('a) Decisive Defeat in der Ablage von Sitz 0', !liegt(t) && t.pile(0, 'discardPile').includes('Decisive Defeat'), t.pile(0, 'discardPile'));
    R.check('a) keine Engine-Fehler', t.errors.length === 0, t.errors);
    R.check('a) Zustand sauber', t.audit().length === 0, t.audit());
  }
  {
    const t = await aufbau([]);
    await t.endTurn(); await t.endTurn();
    R.check('b) nach zwei Zugwechseln: fremde Negierung abgelaufen, Karte liegt, Held negiert', liegt(t) && !!t.hero(1, 0).statuses.negated && !t.hero(1, 0).statuses.negated._fremd, t.hero(1, 0).statuses);
    const dd = t.find('Decisive Defeat', 'support');
    await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 0, heroIdx: 0 }, dd));
    R.check('b) Karte zerstört → Held frei', !t.hero(1, 0).statuses.negated, t.hero(1, 0).statuses);
    R.check('b) keine Engine-Fehler', t.errors.length === 0, t.errors);
    R.check('b) Zustand sauber', t.audit().length === 0, t.audit());
  }
  R.finish();
})();
