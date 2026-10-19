'use strict';
// W4-F2 · Tribut-Kreaturen, Ergänzung zu F1: (a) Abbruch der Kostenwahl vor dem Fenster = nichts bezahlt, Karte bleibt auf der Hand, Off Duty bleibt ungespielt;
//   (b) Wurf auf einen BELEGTEN Platz (Blue-Ice Dragon, Foresta, Egg of God, Dragon Pilot: Opfer macht den Platz frei) — Kontrolle (landet im freigeopferten Platz) und Off Duty
//   (Opfer bleibt bezahlt, Kreatur landet nicht).
// Aufruf: node docs/niche-tests/repro/W4-kosten/F2-tribut-abbruch-und-belegter-platz.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const D = H.INERT.creature;
const alt = (t) => { for (const c of t.inst(c => c.zone === 'support' && c.owner === 0)) c.turnPlayed = 0; };
const auf = (t, name, seat = 0) => t.inst(c => c.zone === 'support' && c.owner === seat && c.name === name).length;
async function bau(name, negieren, voll, n) {
  const t = await H.fresh({ hand: [[name], negieren ? ['Off Duty'] : []] });
  if (negieren) t.grantFor(1, 0, 'Off Duty');
  t.put(0, 0, 0, D); t.put(0, 0, 1, D); if (voll) t.put(0, 0, 2, D);
  alt(t);
  t.policy.confirm = true;
  // W19a (Al, 19.10.2026): beim Wurf auf einen belegten Platz ist der Insasse der Zielzone Pflicht-Opfer (wird nicht mehr gefragt) - gewählt werden nur die weiteren n-1.
  t.targetFn = (v) => v.filter(x => !x.ineligible).slice(0, voll ? n - 1 : n).map(x => x.id);
  return t;
}
(async () => {
  const R = H.runner();
  // (a) Abbruch der Kostenwahl
  for (const [name, n] of [['Blue-Ice Dragon', 2], ['Foresta, the Guard', 2], ['The Egg of God', 1], ['Steam Dwarf Dragon Pilot', 2]]) {
    const t = await bau(name, true, false, n);
    t.targetFn = () => null;   // Mensch: Abbrechen-Knopf
    const r = await t.play(0, name, { hero: 0, slot: 2 });
    R.check(`${name}: (a) Abbruch der Opferwahl: Karte bleibt auf der Hand`, t.pile(0, 'hand').includes(name), { r, hand: t.pile(0, 'hand') });
    R.check(`${name}: (a) Abbruch: nichts bezahlt, Off Duty nicht verbraucht`, auf(t, D) === 2 && t.pile(1, 'hand').includes('Off Duty') && auf(t, name) === 0, { dummies: auf(t, D), offDuty: t.pile(1, 'hand') });
    R.check(`${name}: (a) keine Engine-Fehler / Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  {
    const t = await H.fresh({ hand: [['500 Piranhas in a Monster Suit'], ['Off Duty']] });
    t.grantFor(1, 0, 'Off Duty'); t.put(1, 0, 0, D); t.policy.confirm = true;
    t.targetFn = () => null;
    const r = await t.play(0, '500 Piranhas in a Monster Suit', { hero: 0 });
    R.check('500 Piranhas: (a) Abbruch: Karte bleibt auf der Hand, Gegner-Kreatur lebt, Off Duty nicht verbraucht', t.pile(0, 'hand').includes('500 Piranhas in a Monster Suit') && auf(t, D, 1) === 1 && t.pile(1, 'hand').includes('Off Duty'), { r, hand: t.pile(0, 'hand') });
    R.check('500 Piranhas: (a) keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  // (b) belegter Platz: alle drei Zonen des Helden voll, Wurf auf Zone 2
  for (const [name, n] of [['Blue-Ice Dragon', 2], ['Foresta, the Guard', 2], ['The Egg of God', 1], ['Steam Dwarf Dragon Pilot', 2]]) {
    {
      const t = await bau(name, false, true, n);
      const r = await t.play(0, name, { hero: 0, slot: 2 });
      R.check(`${name}: (b) Kontrolle (belegter Platz): ${n} Opfer, Kreatur auf dem Brett`, auf(t, D) === 3 - n && auf(t, name) === 1, { r, dummies: auf(t, D), da: auf(t, name) });
      R.check(`${name}: (b) Kontrolle: keine Engine-Fehler / Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
    {
      const t = await bau(name, true, true, n);
      const r = await t.play(0, name, { hero: 0, slot: 2 });
      R.check(`${name}: (b) Off Duty: ${n} Opfer bleiben bezahlt, Kreatur landet nicht`, auf(t, D) === 3 - n && auf(t, name) === 0 && !t.pile(1, 'hand').includes('Off Duty'), { r, dummies: auf(t, D), da: auf(t, name), offDuty: t.pile(1, 'hand') });
      R.check(`${name}: (b) Off Duty: keine Engine-Fehler / Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
  }
  R.finish();
})();
