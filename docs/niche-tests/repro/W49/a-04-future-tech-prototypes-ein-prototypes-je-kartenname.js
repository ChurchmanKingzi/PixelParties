'use strict';
// W49a · Punkt 4 · Al, 22.10.2026: Future Tech Prototypes bekommt den Satz „You can only copy any card's name with 1 "Future Tech Prototypes" per turn."
// Al (Klarstellung): „Man darf trotzdem beliebig viele Prototypes aktivieren – nur eben maximal einen pro Kartennamen."
// Regel: jede Kopie in der Ablage darf weiter einmal pro Zug umbenennen (erster Satz); pro Zug und Spieler darf jeder Kartenname nur von EINEM Prototypes kopiert
//   werden (Stempel `ft-prototypes-name:<Spieler>:<Name>`). Ein abgebrochener/abgelehnter Wunsch verbraucht weder den Instanz- noch den Namensstempel. Der Namenswähler
//   bietet bereits kopierte Namen nicht mehr an. Nächster Zug: alles wieder frei. Kartentext in data/cards.json wörtlich.
// Beide Sitze; zwei (und drei) Kopien in der Ablage. Exit 0 = korrekt.
const fs = require('fs');
const path = require('path');
const H = require('../../lib/h.js');
const { zaehleInAblage } = require('../../../../cards/effects/_future-tech-shared.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const PR = 'Future Tech Prototypes', GUN = 'Future Tech Gun', FB = 'Fireball';
(async () => {
  const R = H.runner();
  const karten = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', '..', 'data', 'cards.json'), 'utf8'));
  const k = (Array.isArray(karten) ? karten : (karten.cards || Object.values(karten))).find(c => c.name === PR);
  R.check('Kartentext wörtlich', k && k.effect === 'While this card is in your discard pile, you may once per turn change its name to that of any other card until the end of this turn. You can only copy any card\'s name with 1 "Future Tech Prototypes" per turn.', k && k.effect);

  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section('Sitz ' + me);
    const t = await H.fresh({ discard: me === 0 ? [[PR, PR, PR], []] : [[], [PR, PR, PR]], ...(me ? { active: 1 } : {}) });
    t.gs.activePlayer = me; t.gs.currentPhase = 2;
    const kopien = () => t.engine.getActivatableDiscardCards(me).filter(x => x.cardName === PR);
    const inst = (i) => t.engine.cardInstances.find(c => c.id === kopien()[i].instId);
    let gesehen = null;
    const wuensche = (name) => t.script.push({ match: d => d.type === 'cardNamePicker', answer: (d) => { gesehen = d.cardNames; return name === null ? { cancelled: true } : { cardName: name }; }, once: true });
    const aktiv = async (i, name) => { wuensche(name); return t.run(() => H.loadCardEffect(PR).onDiscardEffect(t.engine, me, inst(i))); };

    R.check('drei Kopien aktivierbar', kopien().length === 3, kopien().length);
    // Kopie 1 → Future Tech Gun
    const instA = kopien()[0].instId;
    R.check('Kopie 1 → „Future Tech Gun"', (await aktiv(0, GUN)) === true && zaehleInAblage(t.gs, me, GUN) === 1, zaehleInAblage(t.gs, me, GUN));
    R.check('der Namenswähler bot „Future Tech Gun" noch an', Array.isArray(gesehen) && gesehen.includes(GUN));
    // Kopie 2 darf mit einem ANDEREN Namen (mehrere Prototypes im selben Zug sind erlaubt)
    const inst2 = kopien().find(x => x.instId !== instA);
    R.check('Kopien 2 und 3 sind weiter aktivierbar (Kopie 1 hat ihren Zug-Stempel verbraucht)', kopien().length === 2 && !kopien().some(x => x.instId === instA), kopien().map(x => x.instId));
    // Kopie 2 → derselbe Name: geblockt, kostet nichts
    const vorGun = zaehleInAblage(t.gs, me, GUN);
    const r2 = await aktiv(0, GUN);
    R.check('Kopie 2 → „Future Tech Gun" (schon kopiert): geblockt', r2 === false && zaehleInAblage(t.gs, me, GUN) === vorGun, { r2, gun: zaehleInAblage(t.gs, me, GUN) });
    R.check('der Namenswähler bietet „Future Tech Gun" nicht mehr an', Array.isArray(gesehen) && !gesehen.includes(GUN) && gesehen.includes(FB), gesehen && gesehen.length);
    R.check('der abgelehnte Wunsch verbrauchte Kopie 2 nicht (weiter aktivierbar)', kopien().some(x => x.instId === inst2.instId), kopien().map(x => x.instId));
    // Abbruch verbraucht nichts
    const rC = await aktiv(0, null);
    R.check('Abbruch im Namenswähler: nichts verbraucht', rC === false && kopien().length === 2, { rC, n: kopien().length });
    // Kopie 2 → anderer Name (Fireball)
    R.check('Kopie 2 → „Fireball" geht', (await aktiv(0, FB)) === true && zaehleInAblage(t.gs, me, FB) === 1, zaehleInAblage(t.gs, me, FB));
    // Kopie 3 → Fireball geblockt, → Gun geblockt, → dritter Name frei
    R.check('Kopie 3 → „Fireball" (schon kopiert): geblockt', (await aktiv(0, FB)) === false && zaehleInAblage(t.gs, me, FB) === 1);
    R.check('Kopie 3 → „Future Tech Gun" (schon kopiert): geblockt', (await aktiv(0, GUN)) === false);
    R.check('Kopie 3 → „Attack" geht', (await aktiv(0, 'Attack')) === true && zaehleInAblage(t.gs, me, 'Attack') === 1);
    R.check('alle drei Kopien haben ihren Instanz-Stempel verbraucht (jede nur einmal pro Zug)', kopien().length === 0, kopien().length);
    R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });

    // Nächster eigener Zug: Aliase abgelaufen, Stempel frei — dieselben Namen sind wieder kopierbar
    await t.endTurn(); await t.endTurn();
    t.gs.activePlayer = me; t.gs.currentPhase = 2;
    R.check('nächster Zug: Aliase abgelaufen', zaehleInAblage(t.gs, me, GUN) === 0 && zaehleInAblage(t.gs, me, FB) === 0, { gun: zaehleInAblage(t.gs, me, GUN), fb: zaehleInAblage(t.gs, me, FB) });
    R.check('nächster Zug: alle drei Kopien wieder aktivierbar', kopien().length === 3, kopien().length);
    R.check('nächster Zug: „Future Tech Gun" wieder kopierbar', (await aktiv(0, GUN)) === true && zaehleInAblage(t.gs, me, GUN) === 1);
    R.check('nächster Zug: derselbe Name sofort wieder geblockt', (await aktiv(0, GUN)) === false);
    R.check('keine Engine-Fehler / Zustand sauber (Folgezug)', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
