// A08-04 · Hand-Geschenk: bei zwei gleichnamigen Handkarten wird die FALSCHE Instanz (und damit der falsche „originalOwner") verschoben
//
// Kartentext Crystal Well: „… Both players may once per turn add a card from their hand that is originally owned by them to their
//   opponent's hand to draw a card."; Mary Crestmas: „… force your opponent to discard a card originally owned by you from their hand …"
//   → „originally owned" ist Spielzustand; er hängt an der einzelnen Handkarte.
//
// Aufbau: Sitz 1 schenkt Sitz 0 einen Filler (Sitz 0 hat selbst schon einen). Hand Sitz 0: [eigener Filler (orig 0), geschenkter Filler (orig 1)].
//   Sitz 0 schenkt den Filler an Index 1 – den GESCHENKTEN – per Chatty Town Guard zurück.
// Erwartung: Der Filler, der bei Sitz 1 ankommt, trägt originalOwner 1 (er war dessen Karte); Sitz 0 behält seinen eigenen (orig 0).
// Beobachtet: `actionTransferCardToOppHand` sucht die Instanz mit dem ERSTEN Namens-Treffer (`_engine.js:25346` `matches[0]`), nicht mit der Position
//   `handIdx`. Es wandert die eigene Karte (orig 0); Sitz 1 hält danach einen Filler mit orig 0, Sitz 0 einen mit orig 1. Crystal Wells
//   Eignungsprüfung (`_isOriginallyOwnedHandSlot`) rechnet dagegen nach Rang (k-te Karte dieses Namens) – beide Stellen widersprechen sich.
// Aufruf: node docs/niche-tests/repro/A08-pacman/04-geschenk-vertauscht-originalbesitzer-bei-gleichem-namen.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const F = H.INERT.filler;
  const t = await H.fresh({ hand: [[], []], deck: [[F, F, F, F, F], [F, F, F, F, F]] });
  for (const s of [0, 1]) { const g = t.put(s, 0, 0, 'Chatty Town Guard'); g.turnPlayed = 1; }
  t.engine.handZugangSync(0, F);          // eigener Filler Sitz 0 (orig 0)
  t.engine.handZugangSync(1, F);          // eigener Filler Sitz 1 (orig 1)
  const origs = (seat) => t.inst(c => c.zone === 'hand' && c.owner === seat && c.name === F).map(c => c.originalOwner);
  // 1) Sitz 1 → Sitz 0
  t.script.push({ match: d => d.type === 'pickHandCard', once: true, answer: () => ({ cardName: F, handIndex: 0 }) });
  t.gs.activePlayer = 1; t.phase(2);
  await t.activateCreature(1, 0, 0);
  R.check('Aufbau: Sitz 0 hält [orig 0, orig 1]', JSON.stringify(origs(0)) === '[0,1]', origs(0));
  // 2) Sitz 0 → Sitz 1, Handindex 1 (der geschenkte Filler)
  t.script.push({ match: d => d.type === 'pickHandCard', once: true, answer: () => ({ cardName: F, handIndex: 1 }) });
  t.gs.activePlayer = 0; t.phase(2);
  await t.activateCreature(0, 0, 0);
  R.check('Sitz 1 hat den Filler mit originalOwner 1 zurückbekommen', JSON.stringify(origs(1)) === '[1]', origs(1));
  R.check('Sitz 0 behält den Filler mit originalOwner 0', JSON.stringify(origs(0)) === '[0]', origs(0));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
