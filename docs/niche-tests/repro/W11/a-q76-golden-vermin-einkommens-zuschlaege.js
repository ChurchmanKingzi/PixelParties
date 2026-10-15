'use strict';
// W11a · Q76 (C03-09, Golden Vermin) · Al, 15.10.2026: „Nein, das normale Einkommen sollte unberührt sein. Aber andere Einkommensquellen in der Resource Phase,
//   etwa Wealth oder Semi, dürfen ihn triggern!"
//   Vermin: „Up to 5 times per turn, when you would gain Gold through an effect, you may draw 1 card instead."
//   Wealth: „Gain 4/8/12 additional Gold …"; Treasure Huntress Semi: „You gain 6 additional Gold during your Resource Phase."
// Erwartet:
//   * Allein: keine Rückfrage, die 4 Gold Grundeinkommen kommen an.
//   * Mit Wealth (1): eine Rückfrage über 4 Gold (der Zuschlag). Ja: Grundeinkommen 4 bleibt, der Zuschlag entfällt, +1 Karte. Nein: 8 Gold.
//   * Mit Wealth + Semi: je Quelle eine Rückfrage (4 und 6); beide bejaht: 4 Gold, +2 Karten.
//   * Das Grundeinkommen selbst wird nie angeboten (keine Rückfrage über 4 bzw. 8/10 Gold gesamt).
const H = require('../../lib/h.js');
const SEMI = 'Treasure Huntress Semi';
(async () => {
  const R = H.runner();
  const lauf = async ({ wealth, semi, antwort }) => {
    const t = await H.fresh({ deckSize: 30 });
    t.put(0, 0, 0, 'Golden Vermin').turnPlayed = 1;
    if (wealth) t.setAbilities(0, 0, [['Wealth'], [], []]);
    if (semi) t.setHero(0, 1, SEMI, 800);
    t.policy.confirm = antwort;
    if (antwort === false) t.script.push({ match: d => d.type === 'confirm' && d.title === 'Golden Vermin', answer: () => null });
    await t.endTurn();
    t.reset();
    const g0 = t.gs.players[0].gold, h0 = t.gs.players[0].hand.length;
    await t.endTurn();
    const msgs = t.prompts.filter(p => p.d.title === 'Golden Vermin').map(p => p.d.message);
    return { dg: t.gs.players[0].gold - g0, dh: t.gs.players[0].hand.length - h0, msgs, err: t.errors.length, audit: t.audit().length };
  };
  let r = await lauf({ antwort: true });
  R.check('allein: keine Vermin-Rückfrage, 4 Gold', r.msgs.length === 0 && r.dg === 4, r);
  r = await lauf({ wealth: true, antwort: true });
  R.check('Wealth: genau eine Rückfrage über den Zuschlag (4 Gold)', r.msgs.length === 1 && /gaining 4 Gold/.test(r.msgs[0]), r.msgs);
  R.check('Wealth + Ja: Grundeinkommen 4 bleibt, Zuschlag entfällt, +1 Karte zusätzlich zum Ziehen', r.dg === 4 && r.dh === 2, r);
  R.check('Wealth + Ja: keine Engine-Fehler / Zustand sauber', r.err === 0 && r.audit === 0, r);
  r = await lauf({ wealth: true, antwort: false });
  R.check('Wealth + Nein: 4 + 4 = 8 Gold, nur die reguläre Karte', r.dg === 8 && r.dh === 1, r);
  r = await lauf({ semi: true, antwort: true });
  R.check('Semi: eine Rückfrage über 6 Gold; Ja: 4 Gold, +1 Karte', r.msgs.length === 1 && /gaining 6 Gold/.test(r.msgs[0]) && r.dg === 4 && r.dh === 2, r);
  r = await lauf({ wealth: true, semi: true, antwort: true });
  R.check('Wealth + Semi: zwei Rückfragen (je Quelle), beide Ja: 4 Gold, +2 Karten', r.msgs.length === 2 && r.dg === 4 && r.dh === 3, r);
  r = await lauf({ wealth: true, semi: true, antwort: false });
  R.check('Wealth + Semi, beide Nein: 4 + 4 + 6 = 14 Gold', r.dg === 14 && r.dh === 1, r);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
