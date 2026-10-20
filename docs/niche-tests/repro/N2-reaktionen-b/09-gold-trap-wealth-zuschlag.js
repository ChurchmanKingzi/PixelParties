'use strict';
// N2-09 · Gold Trap sieht den Einkommens-ZUSCHLAG (Wealth) nicht, Golden Vermin schon
// Kartentext (Gold Trap): „Activate this Surprise when your opponent would gain Gold through an effect. You gain that Gold instead. …"
// Kartentext (Golden Vermin): „Up to 5 times per turn, when you would gain Gold through an effect, you may draw 1 card instead."
// Kartentext (Wealth): „1) Gain 4 additional Gold at the beginning of each of your turns."
// Ruling Welle 11 (Q76, Al): „das normale Einkommen sollte unberührt sein. Aber andere Einkommensquellen in der Resource Phase, etwa Wealth oder Semi, dürfen ihn triggern!"
//   → Zuschläge sind Effekt-Gold (`onIncomeBonusGain`, Golden Vermin ersetzt sie); das Grund-Einkommen (4) bleibt unberührt.
// Erwartung: Gold Trap darf bei Wealth den ZUSCHLAG (4 Gold) abfangen (Grundeinkommen 4 bleibt beim Gegner) — wie Golden Vermin ihn ersetzt.
// Beobachtet: Gold Trap bleibt verdeckt, der Gegner erhält 108 (Grund + Zuschlag). Golden Vermin fragt beim Zuschlag.
// Ursache: _engine.js `actionGainGold` Z. ~25679: `hookCtx._isResourceGain ? null : _checkSurpriseOnResourceGain(…)` — das Fenster wird für die GANZE Resource-Phasen-Buchung übersprungen
//   (R01-01-Fix), der `onIncomeBonusGain`-Pfad (Z. ~25663) kennt die Surprise nicht.
const H = require('../../lib/h.js');
const gefragt = (t, n) => t.prompts.filter(p => p.d.title === n).length;
(async () => {
  const R = H.runner();
  for (const [wirt, gegner] of [[0, 1], [1, 0]]) {
    // wirt = Sitz, dessen Zug beginnt und der Wealth hat; gegner = Sitz mit Gold Trap
    R.section(`Sitz ${wirt} hat Wealth (Stufe 1); Sitz ${gegner} hält Gold Trap — Zugbeginn von Sitz ${wirt}`);
    {
      const abilities = { [wirt]: { 0: [['Wealth']] } };
      const t = await H.fresh({ gold: [100, 100], deckSize: 30, abilities, active: gegner });
      t.putSurprise(gegner, 0, 'Gold Trap'); t.grantFor(gegner, 0, 'Gold Trap');
      t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
      t.reset();
      await t.endTurn();
      R.check('Gold Trap wird gefragt (für den Zuschlag)', gefragt(t, 'Gold Trap') >= 1, t.prompts.map(p => p.d.title));
      R.check('Grundeinkommen (4) bleibt beim Wirt, der Zuschlag (4) geht an den Fallensteller', t.gs.players[wirt].gold === 104 && t.gs.players[gegner].gold === 104, [t.gs.players[0].gold, t.gs.players[1].gold]);
    }
    R.section(`Gegenprobe Sitz ${wirt}: Golden Vermin ersetzt denselben Zuschlag (Abfrage kommt)`);
    {
      const abilities = { [wirt]: { 0: [['Wealth']] } };
      const t = await H.fresh({ gold: [100, 100], deckSize: 30, abilities, active: gegner });
      t.put(wirt, 2, 0, 'Golden Vermin');
      t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
      t.reset();
      await t.endTurn();
      R.check('Golden Vermin wird gefragt', gefragt(t, 'Golden Vermin') >= 1, t.prompts.map(p => p.d.title));
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
