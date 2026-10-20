'use strict';
// N5-11 · Piercer of Heavens: Zielwahl ohne Abbrechen-Knopf.
// Regel 23.9 (CARD_API „ZIELENDE KARTEN SIND IMMER ABBRECHBAR — MANDATORY"): „Jede Zielwahl hat einen Cancel-Button … Ausnahme ist nur, was nach dem Zusagepunkt kommt oder eine vom Kartentext
// erzwungene Pflichtwahl — dann steht der Grund als Kommentar `// pflichtwahl:` daneben." Piercer of Heavens („Choose a target and deal 250 damage to it …") ruft `ctx.promptDamageTarget({ … cancellable: false })`
// (piercer-of-heavens.js:62) ohne Zusagepunkt davor (keine Kosten) und ohne Begründung; der Wächter `scripts/check-target-cancel.js` führt die Stelle im Altbestand (Ratsche), geprüft/begründet wurde sie nie.
// Rockfall (gleiche Textform „Choose a target and deal 200 damage … cannot be reduced or negated") ist abbrechbar.
// Erwartet: die Zielwahl des Piercer meldet `cancellable: true`; ein Mensch kann den Zauber vor dem Commit zurücknehmen (Karte bleibt auf der Hand, Aktion zurück).
// Beobachtet: `config.cancellable === false` — der Mensch hat keinen Abbrechen-Knopf, der Zauber ist mit dem Ausspielen verbraucht.
// Aufruf: node docs/niche-tests/repro/N5-sonstige/11-piercer-of-heavens-zielwahl-nicht-abbrechbar.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const seat of [0, 1]) {
    const opp = 1 - seat;
    for (const spell of ['Rockfall', 'Piercer of Heavens']) {
      const hand = [[], []]; hand[seat] = [spell];
      const t = await H.fresh({ active: seat, hand });
      t.targetFn = (v) => { const x = v.find(y => y.type === 'hero' && y.owner === opp && y.heroIdx === 0); return x ? [x.id] : undefined; };
      await t.play(seat, spell, { hero: 0 });
      const cfg = t.targets[0] && t.targets[0].config;
      R.check(`Sitz ${seat} · ${spell}: die Zielwahl ist abbrechbar (config.cancellable === true)`, !!(cfg && cfg.cancellable === true), { cancellable: cfg && cfg.cancellable });
      R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
  }
  R.finish();
})();
