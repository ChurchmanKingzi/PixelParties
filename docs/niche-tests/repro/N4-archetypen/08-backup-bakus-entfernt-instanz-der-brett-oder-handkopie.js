'use strict';
// N4-archetypen-08 · Rebelliokai Backup Bakus: die Rückkehr aus der Ablage räumt die Instanz einer ANDEREN Bakus-Kopie (Brett/Hand) ab
// Kartentext (Rebelliokai Backup Bakus): „Once per turn, when you discard a "Rebelliokai" Creature, except "Rebelliokai Backup Bakus", you may add this card from your discard pile to
//   your hand, and if you do, draw 1 card. You can only return 1 "Rebelliokai Backup Bakus" per turn with this effect."
// Aufbau: Bakus in der Ablage UND eine zweite Bakus auf dem Brett (a) bzw. auf der Hand (b); Sitz 0 wirft eine andere Rebelliokai-Kreatur (Kind Kitsune) per Effekt ab; Rückkehr bestätigt.
// Erwartung: Die Ablage-Kopie wandert auf die Hand (+1 Karte); Brett-/Hand-Kopie bleiben mit ihrer Instanz unberührt (Zustand sauber: jede Karte in einer Zone hat genau eine Instanz).
// Beobachtet: `onDiscard` in rebelliokai-backup-bakus.js hat `activeIn: ['hand','support','discard','deleted','deck']`; die Auslösung läuft über den ZUERST gefundenen Hörer und räumt am Ende
//   `engine._untrackCard(ctx.card.id)` – bei einer Brettkopie ist das die Brett-Instanz (Zone behält den Namen, Instanz fehlt: „0 Instanzen" im Audit, Karte nicht mehr bedienbar), bei einer
//   Handkopie die Hand-Instanz (zwei Namen auf der Hand, nur eine Instanz).
const H = require('../../lib/h.js');
const B = 'Rebelliokai Backup Bakus';
const X = 'Rebelliokai Kind Kitsune';
async function lauf(ort) {
  const t = await H.fresh({ hand: [[X, 'ZZ Filler', ort === 'hand' ? B : 'ZZ Filler'], ['ZZ Filler']], deckSize: 30 });
  t.setDiscard(0, [B]);
  if (ort === 'brett') { const b = t.put(0, 0, 0, B); b.turnPlayed = 1; }
  t.script.push({ match: d => d.type === 'confirm' && /Backup Bakus/.test(d.title || ''), answer: () => ({ confirmed: true }) });
  t.gs.activePlayer = 0; t.phase(3);
  await t.run(() => t.engine.actionDiscardHandCard(0, X, 0, { source: 'Test-Effekt', selfInflicted: true }));
  return t;
}
(async () => {
  const R = H.runner();
  let t = await lauf('keine');
  R.check('Gegenprobe (nur Ablage-Kopie): Bakus kehrt zurück, Zustand sauber', t.pile(0, 'hand').includes(B) && t.audit().length === 0, { hand: t.pile(0, 'hand'), a: t.audit() });
  t = await lauf('brett');
  R.check('Aufbau (a): Ablage-Kopie ist zurückgekehrt', t.pile(0, 'hand').includes(B) && t.pile(0, 'discardPile').indexOf(B) < 0, t.pile(0, 'hand'));
  R.check('(a) die Bakus auf dem Brett behält ihre Instanz (Audit sauber)', t.audit().length === 0, t.audit());
  t = await lauf('hand');
  const namen = t.pile(0, 'hand').filter(n => n === B).length;
  const inst = t.inst(c => c.zone === 'hand' && c.owner === 0 && c.name === B).length;
  R.check('Aufbau (b): zwei Bakus auf der Hand', namen === 2, namen);
  R.check('(b) jede Bakus auf der Hand hat eine Instanz (2 Namen ↔ 2 Instanzen)', inst === namen, { namen, inst });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
