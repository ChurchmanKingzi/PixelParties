'use strict';
// Z7c-A1b · Selbstopfer des Wirkers als KOSTE: opfert sich der Wirker von Divine Gift of Sacrifice selbst (Kosten, VOR der Kette), darf die Karte in einer Kette nicht
// wegen „Wirker handlungsunfähig" fizzeln (v1328-Regel) — sonst ginge die Wirkung verloren, obwohl die Karte nicht negiert wurde.
// Prüft die Engine-Regel `_kettenWirkerFizzelt` direkt (ein echtes Kettenglied ohne Negation lässt sich in der Harness nicht ohne passende Reaktionskarte bilden).
// Kontrolle: ohne die Opfer-Marke fizzelt dieselbe Karte bei besiegtem Wirker ('defeated'); andere Karten/andere Helden sind von der Ausnahme nicht betroffen.
// Aufruf: node docs/niche-tests/repro/Z7c/A1b-selbstopfer-wirker-fizzelt-nicht.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Divine Gift of Sacrifice'], []] });
  const e = t.engine;
  t.gs.players[0].heroes[0].hp = 0;
  const glied = (extra = {}) => ({ isInitialCard: true, cardName: 'Divine Gift of Sacrifice', owner: 0, heroIdx: 0, ...extra });
  R.check('Kontrolle: besiegter Wirker ohne Marke ⇒ Fizzle (defeated)', e._kettenWirkerFizzelt(glied()) === 'defeated', e._kettenWirkerFizzelt(glied()));
  t.gs._kostenOpferWirker = { pi: 0, heroIdx: 0, cardName: 'Divine Gift of Sacrifice' };
  R.check('mit Opfer-Marke (Selbstopfer als Kosten) ⇒ kein Fizzle', e._kettenWirkerFizzelt(glied()) === null, e._kettenWirkerFizzelt(glied()));
  R.check('Marke gilt nicht für einen anderen Wirker-Helden (Held 1 besiegt)', (() => { t.gs.players[0].heroes[1].hp = 0; return e._kettenWirkerFizzelt(glied({ heroIdx: 1 })); })() === 'defeated');
  R.check('Marke gilt nicht für eine andere Karte', e._kettenWirkerFizzelt(glied({ cardName: 'Fireball' })) === 'defeated', e._kettenWirkerFizzelt(glied({ cardName: 'Fireball' })));
  R.check('Marke gilt nicht für ein Reaktionsglied (nicht Initialkarte)', e._kettenWirkerFizzelt({ isInitialCard: false, cardName: 'Divine Gift of Sacrifice', owner: 0, casterHeroIdx: 0 }) === 'defeated');
  R.finish();
})();
