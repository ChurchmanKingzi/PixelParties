'use strict';
// W63d-05 · Aktivierungen (Heldeneffekt, Area-Effekt, freie Ability) mit abbrechbaren Fragen: der Auftritt kommt erst nach dem Commit (Al, 22.10.2026)
//
// Regel (CARD_API „Auftritt streamen — erst nach dem Commit"): auch eine AKTIVIERUNG zeigt sich dem Gegner erst, wenn sie nicht mehr abbrechbar ist.
// Vorher feuerte der Auftritt bei der ERSTEN bestätigten Antwort: bei mehrstufiger Wahl (Brackle: Opfer → Ziel; Garius; Lolek; Deepsea Castle; Slippery Ice) sah der Gegner die Karte, obwohl der Spieler in
//   der zweiten Stufe noch abbrechen konnte (Rundensperre zurück, nichts passiert). Teocuilatl und Crystal Well (Einzelfrage) sahen den Auftritt vor der Frage. Freie Abilities (Diplomacy, Necromancy,
//   Occultism): Auftritt vor der zweiten Stufe.
// Echte Abbruchstelle = Abbruch gibt die Aktivierung zurück (Rundensperre `hoptUsed` nicht verbraucht). Szene: reiche Standard-Szene; MENSCH-Modus. Exit 0 = korrekt.
const W = require('../../lib/wire.js');
const HOPT0 = (t) => Object.keys(t.gs.hoptUsed || {}).length === 0;
const HELDEN = ['Brackle, the Catapulting Turtle', 'Garius, the Great Reformer', 'Lolek, Mender of the Shattered Trident', 'Teocuilatl, the Embodiment of Gods'];
const AREAS = ['Crystal Well', 'Deepsea Castle', 'Slippery Ice'];
const FREI = ['Diplomacy', 'Necromancy', 'Occultism'];
(async () => {
  const R = W.runner();
  for (const hero of HELDEN) {
    R.section(`Heldeneffekt ${hero}`);
    const mk = async () => { const t = await W.reicheSzene({ seat: 0 }); t.setHero(0, 0, hero, 800); return t; };
    const d = await W.durchlauf(mk, 0, hero, { seat: 0, maxCancel: 4, undoneFn: HOPT0, callFn: (t) => t.activateHero(0, 0) });
    W.pruefeDurchlauf(R, `Held ${hero}`, d, { seat: 0, nCanc: 1, oeffentlich: true });
  }
  for (const area of AREAS) {
    R.section(`Area-Effekt ${area}`);
    const mk = async () => { const t = await W.reicheSzene({ seat: 0 }); t.putArea(0, area); return t; };
    const d = await W.durchlauf(mk, 0, area, { seat: 0, maxCancel: 4, undoneFn: HOPT0, callFn: (t) => { t.gs.activePlayer = 0; t.phase(2); return t.engine.activateAreaEffect(0, 0, area); } });
    W.pruefeDurchlauf(R, `Area ${area}`, d, { seat: 0, nCanc: 1, oeffentlich: true });
  }
  for (const ab of FREI) {
    R.section(`Freie Ability ${ab}`);
    const mk = async () => { const t = await W.reicheSzene({ seat: 0 }); t.setAbilities(0, 0, [[ab], [], []]); return t; };
    const d = await W.durchlauf(mk, 0, ab, { seat: 0, maxCancel: 4, undoneFn: HOPT0, callFn: (t) => { t.gs.activePlayer = 0; t.phase(2); return t.host.doActivateFreeAbility(t.room, 0, { heroIdx: 0, zoneIdx: 0 }); } });
    W.pruefeDurchlauf(R, `Ability ${ab}`, d, { seat: 0, nCanc: 1, oeffentlich: true });
  }
  R.finish();
})();
