'use strict';
// N1-09 · Decisive Defeat: eine zweite (befristete) Negierung überschreibt den Statuseintrag der Karte – die Karte wird dann mit dem kürzeren Status verworfen
//         (und umgekehrt löscht das Abfallen der Karte eine noch laufende fremde Negierung)
// Kartentext: „While this card is attached to a Hero, that Hero's effect is negated. This counts as a negative status effect."
// Aufbau: Sitz 0 legt Decisive Defeat an Held 1:0 (Status `negated` mit `permanent`/`_fromAttachment`). Danach bekommt der Held eine befristete Negierung
//   einer anderen Quelle (`addHeroStatus('negated', {duration: 1})` – so wirken Null, Crusader's Hookshot, Locke, Sparky Slime).
// Erwartet: Solange die Karte am Helden liegt, bleibt er negiert. Die befristete Negierung läuft für sich ab; Decisive Defeat bleibt angelegt (es wurde nicht geheilt).
//   Teil 2 (umgekehrt): trägt der Held schon eine befristete Negierung (Dauer 3) und kommt Decisive Defeat dazu, bleibt nach dem Zerstören der Karte die laufende Negierung bestehen.
// Beobachtet: Der Eintrag der Karte wird durch die befristete Negierung ERSETZT; läuft sie ab, wird auch die Karte verworfen (Ablage von Sitz 0) – ohne Heilung.
//   Teil 2: das Zerstören von Decisive Defeat löscht den `negated`-Eintrag ganz, die fremde Negierung ist weg, obwohl sie noch Züge hätte.
// Gegenprobe: Decisive Defeat allein bleibt über mehrere Zugwechsel angelegt und der Held negiert.
const H = require('../../lib/h.js');
const heroPick = (s, h) => (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === s && x.heroIdx === h); return v ? [v.id] : undefined; };
const aufbau = async () => {
  const t = await H.fresh({ hand: [['Decisive Defeat'], []] });
  t.setAbilities(0, 0, [['Decay Magic', 'Decay Magic'], [], []]);
  t.targetFn = heroPick(1, 0);
  await t.play(0, 'Decisive Defeat', { hero: 0 });
  return t;
};
const liegt = (t) => t.gs.players[1].supportZones[0].some(z => z.includes('Decisive Defeat'));
(async () => {
  const R = H.runner();
  // Gegenprobe: allein
  {
    const t = await aufbau();
    for (let i = 0; i < 4; i++) await t.endTurn();
    R.check('Gegenprobe: Decisive Defeat liegt nach 4 Zugwechseln noch, Held negiert', liegt(t) && !!t.hero(1, 0).statuses.negated, { liegt: liegt(t), st: t.hero(1, 0).statuses });
  }
  // Teil 1
  {
    const t = await aufbau();
    await t.run(() => t.engine.addHeroStatus(1, 0, 'negated', { duration: 1, appliedBy: 0, source: 'Null' }));
    R.check('Teil 1: Karte liegt nach der zweiten Negierung noch', liegt(t));
    for (let i = 0; i < 4; i++) await t.endTurn();
    R.check('Teil 1: nach Ablauf der befristeten Negierung liegt Decisive Defeat noch am Helden (nicht geheilt)', liegt(t), { disc0: t.pile(0, 'discardPile') });
    R.check('Teil 1: der Held ist weiter negiert (die Karte liegt ja an)', !!t.hero(1, 0).statuses.negated, t.hero(1, 0).statuses);
    R.check('Teil 1: keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  // Teil 2
  {
    const t = await H.fresh({ hand: [['Decisive Defeat'], []] });
    t.setAbilities(0, 0, [['Decay Magic', 'Decay Magic'], [], []]);
    t.targetFn = heroPick(1, 0);
    await t.run(() => t.engine.addHeroStatus(1, 0, 'negated', { duration: 3, appliedBy: 0, source: 'Null' }));
    await t.play(0, 'Decisive Defeat', { hero: 0 });
    const dd = t.find('Decisive Defeat', 'support');
    await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 0, heroIdx: 0 }, dd));
    R.check('Teil 2: die fremde Negierung (Dauer 3) läuft nach dem Abfallen von Decisive Defeat weiter', !!t.hero(1, 0).statuses.negated, t.hero(1, 0).statuses);
  }
  R.finish();
})();
