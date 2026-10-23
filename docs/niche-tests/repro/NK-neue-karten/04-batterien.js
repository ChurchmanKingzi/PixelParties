'use strict';
// NK-04 · Breite Batterien für die neuen Karten (23.10.2026): Dauerfeuer (lib/barrage.js: 20 Ereignisse mit der Karte in ihrer natürlichen Zone,
// beide Seiten) und Kaltstart (lib/coldplay.js: die Karte in 10 Zuständen über den echten Spielweg — volles Brett, Nein auf alles, Abbruch jeder
// Zielwahl, letztes Ziel, Gegner leer, ich leer, Gegner fast tot, Deck 1, Gold 0, Gegner nur 1 Held).
// Erwartung: keine Ausnahmen, keine verschluckten Engine-Fehler (gegen die Baseline ohne die Karte), keine Hänger, sauberer Zustand,
// keine verschwundene Karte; bei Abbruch jeder Zielwahl bleibt der Zustand unverändert.
const H = require('../../lib/h.js');
const { barrage, sig } = require('../../lib/barrage.js');
const { coldplay, VARIANTS } = require('../../lib/coldplay.js');
(async () => {
  const R = H.runner();
  const KARTEN = ['Shimmering Dragonegg', 'Black-Thorn Dragon', 'Liquid Luck', 'Great Vanguard Demon'];

  R.section('Dauerfeuer (20 Ereignisse, beide Seiten, Brett/Hand/Ablage/Deck)');
  const basis = await barrage({ name: null });
  const basisFehler = new Set(basis.errors.map(sig));
  R.note('Baseline ohne Karte: Fehlersignaturen', [...basisFehler]);
  for (const name of KARTEN) {
    for (const side of [0, 1]) {
      for (const variant of ['', 'boardOnly']) {
        const r = await barrage({ name, side, variant });
        const neu = r.errors.map(sig).filter(x => !basisFehler.has(x));
        const tag = `${name} (Sitz ${side}${variant ? ', ' + variant : ''})`;
        R.check(`${tag}: keine neuen Engine-Fehler`, neu.length === 0, neu.slice(0, 3));
        R.check(`${tag}: keine Ausnahmen, keine Hänger`, r.threw.length === 0 && r.hung.length === 0, { threw: r.threw.slice(0, 3), hung: r.hung });
        R.check(`${tag}: Zustand sauber`, r.audit.length === 0, r.audit.slice(0, 3));
      }
    }
  }

  R.section('Kaltstart (10 Zustände über den echten Spielweg)');
  for (const name of KARTEN) {
    for (const v of VARIANTS) {
      const r = await coldplay(name, v);
      const tag = `${name} / ${v.id}`;
      const ok = !r.harness && r.result !== 'threw' && r.result !== 'hung' && r.result !== 'runaway' && (r.errors || []).length === 0 && (r.audit || []).length === 0;
      R.check(`${tag}: Spielweg ohne Ausnahme/Hänger/Fehler, Zustand sauber`, ok, { result: r.result, errors: r.errors, audit: r.audit, harness: r.harness });
      R.check(`${tag}: keine Karte verschwunden`, (r.lost || []).length === 0 || (r.lost || []).every(x => /^(ZZ|Icy|Flaming|Shimmering|Black-Thorn|Great Vanguard)/.test(x)), r.lost);
      if (v.cancel && r.targetPrompts > 0) R.check(`${tag}: Abbruch lässt den Zustand unverändert`, r.cancelUnchanged !== false, r.cancelDiff);
    }
  }
  R.finish();
})();
