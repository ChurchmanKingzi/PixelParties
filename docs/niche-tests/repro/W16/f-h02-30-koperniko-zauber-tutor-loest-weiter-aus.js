// W16f · H02-heroes-30 Gegenprobe: ein ZAUBER, der genau 1 Karte aus dem Deck auf die Hand holt (Brilliant Idea), löst Kopernikos Zusatzsuche weiter aus;
// eine Altbuchung von Hell Fox (Kreatur, früherer Zug) tut es nicht.
const H = require('../../lib/h.js');
const KO = 'Koperniko, the Stargazer';
(async () => {
  const R = H.runner();
  const t = await H.fresh({ heroes: [[KO, 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'], null], hand: [['Brilliant Idea'], []], deck: [['Fireball', 'Explosion', 'Pyroblast', 'Heal', 'Rockfall', 'Burning Finger'], []] });
  t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => ({ cardName: d.cards[0].name }) });
  const kop = () => t.prompts.filter(p => p.d.title === KO).length;
  const r = await t.play(0, 'Brilliant Idea', { hero: 0 });
  R.check('Brilliant Idea gespielt', r === true, r);
  R.check('Koperniko bietet die Zusatzsuche an', kop() >= 1, t.prompts.map(p => p.d.title));
  R.check('Hand: 2 Karten aus dem Deck (Brilliant Idea selbst ist verbraucht)', t.pile(0, 'hand').length === 2, t.pile(0, 'hand'));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.check('Zustand sauber', t.audit().length === 0, t.audit());
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
