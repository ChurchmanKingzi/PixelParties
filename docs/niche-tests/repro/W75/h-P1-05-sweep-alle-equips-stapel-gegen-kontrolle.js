'use strict';
// W75 · Darion (Audit P1) — Sweep ueber ALLE Equipment-Artifacts: derselbe Ablauf mit Darions Stapel [N0, X, N1] und mit denselben drei Karten getrennt bei einem normalen Helden (lib/darion-vergleich.js).
// Kartentext Darion: „All Artifacts equipped to this Hero share 1 Support Zone. Whenever this Hero defeats 1 or more targets, you may choose an equippable Artifact from your hand or deck and equip it to this Hero by paying half its Cost."
// Erwartet: Jede Handlung (X zerstoert / abgeworfen / auf die Hand / umgehaengt, Heldentod und Wiederbelebung, Angriff, Treffer, Zugende, Zauber des Gegners, Aktivierung, Kontrollwechsel) ergibt in beiden Aufbauten
//           denselben Zustand (Held-ATK/HP/Status/Buffs, Zaehler aller Equips, Haende/Ablagen/Geloescht, Gold, Fragen, Log). X liegt unten, in der Mitte und oben im Stapel.
// Aufruf: node docs/niche-tests/repro/W75/h-P1-05-sweep-alle-equips-stapel-gegen-kontrolle.js [Szenen,mit,Komma] [Karten,mit,Komma]   (Exit 0 = korrekt; ca. 4-5 Minuten)
const V = require('../../lib/darion-vergleich.js');
const cards = require('../../../../data/cards.json');
const { H } = V;
const SZENEN = (process.argv[2] && process.argv[2] !== '-' ? process.argv[2].split(',') : ['destroyX', 'destroyN0', 'discardX', 'bounceX', 'killHero', 'killRevive', 'transferX', 'hit', 'attack', 'attackCreature', 'endTurn', 'turnStart', 'activate', 'gegnerZauber', 'gegnerAttack', 'steal']);
const NUR = process.argv[3] ? process.argv[3].split(',') : null;
// Karten ohne Handweg werden direkt gelegt (Anlege-Ereignisse feuern trotzdem); Crusader's/Control Device haben eigene Tests (Cecilia / Gegnerseite).
const DIREKT = {
  'Cool Tech Jetpack': { vorab: { _viaCoolRepair: 1 } }, 'Secret Lab Entrance': { extra: ['inventing'] },
  'Lunatic Cycle - Crescent Moon': {}, 'Lunatic Cycle - Half Moon': {}, 'Lunatic Cycle - Gibbous Moon': {}, 'Lunatic Cycle - Full Moon': {},
  'Modnir, Hammer of Coolness': {}, 'Swellpnir, Mount of Coolness': {},
};
const eqs = cards.filter(c => c.cardType === 'Artifact' && (c.subtype || '').toLowerCase() === 'equipment' && !['Club of Gobbo', 'Cute Crown'].includes(c.name)).map(c => c.name);
(async () => {
  const R = H.runner();
  const bad = [];
  let ok = 0, skip = 0;
  // Zweiter Durchgang: zwei gleichnamige Kopien nebeneinander im Stapel (X, X2) gegen zwei Kopien an getrennten Plaetzen.
  const DOPPEL = ['destroyX', 'destroyX2', 'killHero', 'hit', 'attack', 'endTurn', 'gegnerZauber', 'activate', 'bounceX'];
  for (const durchgang of ['einzeln', 'doppel']) for (const X of eqs) {
    if (NUR && !NUR.includes(X)) continue;
    const direkt = DIREKT[X];
    if (V.OHNE_HANDWEG.has(X) && !direkt) { if (durchgang === 'einzeln') skip++; continue; }
    if (durchgang === 'doppel' && direkt) continue;
    for (const s of (durchgang === 'doppel' ? DOPPEL : [...SZENEN, ...((direkt && direkt.extra) || [])])) for (const pos of (durchgang === 'doppel' ? [0, 1] : [0, 1, 2])) {
      const o = { pos, ...(direkt ? { direkt: true, vorab: direkt.vorab } : {}), ...(durchgang === 'doppel' ? { doppel: true, nachbarn: ['Club of Gobbo'] } : {}) };
      let a, b;
      try { a = await V.lauf(X, 'darion', s, o); b = await V.lauf(X, 'kontrolle', s, o); }
      catch (e) { bad.push(`${X} [${s}/${pos}]: THREW ${e.message.slice(0, 120)}`); continue; }
      if (a.fehler || b.fehler) { if (a.fehler !== b.fehler) bad.push(`${X} [${s}/${pos}]: Aufbau ${a.fehler} / ${b.fehler}`); continue; }
      const d = V.unterschiede(a, b);
      if (d.length) bad.push(`${X} [${s}/${pos}]: ` + d.join(' || ').slice(0, 600)); else ok++;
    }
  }
  R.check(`${ok} Laeufe ohne Abweichung (Karten ohne Handweg und ohne Direktanlage uebersprungen: ${skip})`, bad.length === 0, bad.slice(0, 6));
  if (bad.length) for (const b of bad) process.stderr.write('   ' + b + '\n');
  R.finish();
})();
