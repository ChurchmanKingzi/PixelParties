'use strict';
// W10a · Q30 (A05-10) · Al, 15.10.2026: „nein, nur, wenn der On-Summon-Effekt wirklich feuert und nicht fizzelt; Cloudy etwa *müsste* eigentlich fizzeln.“
//   Sandy Blob: „… when the on-summon effect of a Creature you control activates …“
// Erwartet: Cloudy Slime / Shadowy Slime ohne Kandidat fizzeln sichtbar (card_reveal mit fizzled) und lösen den Blob NICHT aus;
//   mit Kandidat (Lv-0-Kreatur auf der Hand bzw. in der Ablage) wirkt der Effekt und der Blob feuert wie bisher (Regression).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const blobFenster = (t) => t.targets.filter(x => x.config && x.config.title === 'Sandy Blob').length;
  const fizzles = (t, n) => t.evs('card_reveal').filter(d => d && d.fizzled && d.cardName === n).length;
  const mk = async (hand, discard) => {
    const t = await H.fresh({ hand: [hand, []], discard: [discard || [], []] });
    t.setAbilities(0, 0, [['Summoning Magic'], [], []]);
    t.put(0, 0, 2, 'Sandy Blob').turnPlayed = 1;
    t.put(1, 0, 0, H.INERT.big);
    t.targetFn = (valid) => [valid[0].id];
    return t;
  };
  let t;
  // Cloudy Slime
  t = await mk(['Cloudy Slime']);
  await t.play(0, 'Cloudy Slime', { hero: 0, slot: 0 });
  R.check('Cloudy ohne Kandidat: kein Blob-Fenster', blobFenster(t) === 0, blobFenster(t));
  R.check('Cloudy ohne Kandidat: sichtbares Fizzeln', fizzles(t, 'Cloudy Slime') >= 1, t.evs('card_reveal'));
  R.check('Cloudy ohne Kandidat: keine Engine-Fehler', t.errors.length === 0, t.errors);
  t = await mk(['Cloudy Slime', 'Mischief Militia - Heli Troopers']);
  t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
  t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => ({ cardName: 'Mischief Militia - Heli Troopers' }) });
  t.script.push({ match: d => d.type === 'zonePick', answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });
  await t.play(0, 'Cloudy Slime', { hero: 0, slot: 0 });
  R.check('Cloudy MIT Kandidat: Effekt wirkt (Heli Troopers liegt auf dem Brett)', !!t.find('Mischief Militia - Heli Troopers', 'support'), t.pile(0, 'hand'));
  R.check('Cloudy MIT Kandidat: Blob-Fenster öffnet sich (Regression)', blobFenster(t) >= 1, blobFenster(t));
  // Shadowy Slime
  t = await mk(['Shadowy Slime']);
  await t.play(0, 'Shadowy Slime', { hero: 0, slot: 0 });
  R.check('Shadowy ohne Kandidat in der Ablage: kein Blob-Fenster', blobFenster(t) === 0, blobFenster(t));
  R.check('Shadowy ohne Kandidat: keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
