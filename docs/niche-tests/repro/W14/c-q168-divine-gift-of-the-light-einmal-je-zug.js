'use strict';
// W14c · Q168 (S02-04) Divine Gift of The Light: „the first time every turn a Hero uses a Support Magic Spell …" = EINMAL PRO ZUG, nicht einmal je Held (Al 16.10.2026)
// Erwartet: Zwei nicht heilende Support-Zauber im selben Zug (zwei verschiedene Helden) → nur EIN Heilfenster; im nächsten eigenen Zug geht es wieder auf.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Divine Gift of The Light'], []] });
  await t.play(0, 'Divine Gift of The Light', { hero: 0 });
  t.heroStatus(0, 0, 'burned'); t.heroStatus(0, 1, 'burned');
  t.reset();
  t.targetFn = (valid) => [valid[0].id];
  // W16g: die Statuswahl von Divine Zeal ist abbrechbar (S02-16); die Harness-Standardantwort auf abbrechbare Abfragen ist „abbrechen“ — ausdrücklich alle Status wählen.
  t.script.push({ match: d => d.type === 'statusSelect', answer: (d) => ({ selectedStatuses: (d.statuses || []).map(s => s.key) }) });
  const n = () => t.targets.filter(x => x.config && x.config.title === 'Divine Gift of The Light').length;
  await t.play(0, 'Divine Zeal', { hero: 0 });
  const nach1 = n();
  t.heroStatus(0, 0, 'burned'); t.heroStatus(0, 1, 'burned');
  await t.play(0, 'Divine Zeal', { hero: 1 });
  const nach2 = n();
  await t.play(0, 'Divine Zeal', { hero: 0 });
  const nach3 = n();
  R.check('erstes Support-Spell des Zuges öffnet das Heilfenster', nach1 === 1, { nach1 });
  R.check('zweiter Held, selber Zug: kein weiteres Fenster', nach2 === 1, { nach1, nach2 });
  R.check('derselbe Held noch einmal, selber Zug: kein weiteres Fenster', nach3 === 1, { nach3 });
  // nächster Zug des Besitzers: das Fenster geht wieder auf
  await t.endTurn(); await t.endTurn();
  t.heroStatus(0, 0, 'burned');
  await t.play(0, 'Divine Zeal', { hero: 0 });
  R.check('im nächsten eigenen Zug geht das Fenster wieder auf', n() === 2, { n: n() });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
