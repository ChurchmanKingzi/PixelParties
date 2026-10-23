'use strict';
// W64b-04 · Aktivierungen (Heldeneffekt, Area-Effekt, Kreatur-Effekt, freie/Aktions-Ability) mit stillem Effekt: der Auftritt kommt VOR dem ersten Effektschritt (Al, 23.10.2026)
//
// Vorher (W63d) kam der Auftritt einer Aktivierung erst mit der ersten sichtbaren Wirkung bzw. am Ende der Auflösung: der Gegner sah vorher den neuen Zustand (Gold, Hand, Brett) oder die Effekt-Protokollzeile
//   VOR der Zeile der Aktivierung. Jetzt: Effektschritt/Pflichtfrage/Pause/erstes Ereignis committen, `game_state` wartet bis dahin (Zustandspuffer).
// Szene: reiche Standard-Szene, MENSCH-Modus, Sitz 0 und (stichprobenweise) Sitz 1. Je Aktivierung ein Durchlauf + ein Abbruch an jeder abbrechbaren Stelle; Prüfung wie `W.pruefeDurchlauf` (Auftritt vor erstem
//   Effekt-Ereignis, -Zeile und Zustandswechsel für Gegner UND Zuschauer; Abbruch → nichts). Alle 20 waren im Ausgangszustand rot (Steam Dwarf Engineer: Abbruch der Galerie verriet die Aktivierung). Exit 0 = korrekt.
const W = require('../../lib/wire.js');
const HOPT0 = (t) => Object.keys(t.gs.hoptUsed || {}).length === 0;
// [Gruppe, Name, auch Sitz 1?, Mindestzahl echter Abbruchstellen (Standard 0)]
const AKT = [
  ['held', 'Cecilia, the Harrowing Crusader', true], ['held', 'Enigma, the Seller of Secrets', false], ['held', 'Omikron, the Faceless Illusionist', false], ['held', 'Logan, the Investment Monkee', false],
  ['area', 'Smuggler\'s Pier', true], ['area', 'Deepsea Castle', false],
  ['kreatur', 'Doctor Fester', false], ['kreatur', 'Elven Leader', true], ['kreatur', 'Gigantisaur Raptoren', false], ['kreatur', 'Inconspicuous Lawn Gnome', false],
  ['kreatur', 'Informant', false], ['kreatur', 'Populated Island Turtle', false], ['kreatur', 'Skeleton Mage', false], ['kreatur', 'Treasure Skeleton', false],
  ['kreatur', 'Steam Dwarf Engineer', true, 1],   // W64b: der Dampfstoß lief VOR der abbrechbaren Galerie (Abbruch verriet die Aktivierung) — jetzt danach
  ['frei', 'Alchemy', true], ['frei', 'Leadership', false], ['frei', 'Luck', false], ['frei', 'Premonition', false], ['aktion', 'Adventurousness', false],
];
(async () => {
  const R = W.runner();
  for (const [gruppe, name, auchSitz1, nEcht] of AKT) {
    for (const seat of auchSitz1 ? [0, 1] : [0]) {
      const label = `${gruppe} ${name}${seat ? ' (Sitz 1)' : ''}`;
      R.section(label);
      const mk = async () => W.reicheSzene({ seat });
      const callFn = (t) => {
        if (gruppe === 'held') { t.setHero(seat, 0, name, 800); return t.activateHero(seat, 0); }
        if (gruppe === 'area') { t.putArea(seat, name); t.gs.activePlayer = seat; t.phase(2); return t.engine.activateAreaEffect(seat, seat, name); }
        if (gruppe === 'kreatur') { t.put(seat, 0, 0, name).turnPlayed = 1; t.gs.activePlayer = seat; t.phase(2); return t.activateCreature(seat, 0, 0); }
        if (gruppe === 'frei') { t.setAbilities(seat, 0, [[name], [], []]); t.gs.activePlayer = seat; t.phase(2); return t.host.doActivateFreeAbility(t.room, seat, { heroIdx: 0, zoneIdx: 0 }); }
        t.setAbilities(seat, 0, [[name], [], []]); t.gs.activePlayer = seat; t.phase(3); return t.host.doActivateAbility(t.room, seat, { heroIdx: 0, zoneIdx: 0 });
      };
      const d = await W.durchlauf(mk, seat, name, { seat, hero: 0, maxCancel: 4, undoneFn: HOPT0, callFn, answer: (e) => (e.kind === 'generic' && e.d.type === 'cardNamePicker') ? { cardName: W.REICH.CRE[1] } : undefined });
      R.check(`${label}: aktiviert (der Gegner sieht den Auftritt)`, d.clean.r.appearances.length > 0, d.clean.r.result);
      W.pruefeDurchlauf(R, label, d, { seat, nEcht: nEcht || 0, oeffentlich: true });
    }
  }
  R.finish();
})();
