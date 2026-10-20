'use strict';
// W24b · N2-09 Gold Trap und der Einkommens-Zuschlag. Ruling Q76 (Welle 11): Grundeinkommen unberührt, Zuschläge (Wealth) sind Effekt-Gold.
// Fälle: (a) Wealth → Gold Trap gefragt, Zuschlag (4) an den Fallensteller, Grundeinkommen (4) beim Wirt; (b) Gold Trap abgelehnt → Wirt bekommt alles;
// (c) ohne Wealth bleibt Gold Trap verdeckt (R01-01), Wirt bekommt 4.
const H = require('../../lib/h.js');
const gefragt = (t, n) => t.prompts.filter(p => p.d.title === n).length;
(async () => {
  const R = H.runner();
  for (const [wirt, gegner] of [[0, 1], [1, 0]]) {
    for (const fall of ['annehmen', 'ablehnen', 'ohne Wealth']) {
      R.section(`Sitz ${wirt} Zugbeginn, Sitz ${gegner} hält Gold Trap — ${fall}`);
      const abilities = fall === 'ohne Wealth' ? undefined : { [wirt]: { 0: [['Wealth']] } };
      const t = await H.fresh({ gold: [100, 100], deckSize: 30, abilities, active: gegner });
      t.putSurprise(gegner, 0, 'Gold Trap'); t.grantFor(gegner, 0, 'Gold Trap');
      t.script.push({ match: d => d.type === 'confirm', answer: () => (fall === 'ablehnen' ? null : { confirmed: true }) });
      t.reset();
      await t.endTurn();
      const g = t.gs.players;
      if (fall === 'annehmen') {
        R.check('Gold Trap wurde gefragt', gefragt(t, 'Gold Trap') >= 1, gefragt(t, 'Gold Trap'));
        R.check('Wirt 104 (nur Grundeinkommen), Fallensteller 104 (Zuschlag)', g[wirt].gold === 104 && g[gegner].gold === 104, [g[0].gold, g[1].gold]);
      } else if (fall === 'ablehnen') {
        R.check('Wirt bekommt Grundeinkommen + Zuschlag (108), Fallensteller 100', g[wirt].gold === 108 && g[gegner].gold === 100, [g[0].gold, g[1].gold]);
      } else {
        R.check('Gold Trap bleibt verdeckt, Wirt 104', gefragt(t, 'Gold Trap') === 0 && g[wirt].gold === 104 && g[gegner].gold === 100, [gefragt(t, 'Gold Trap'), g[0].gold, g[1].gold]);
      }
      R.check('keine Engine-Fehler, Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
