'use strict';
// W26a · Entscheidung Al (21.10.2026, N5-04, Frage 2 „nur in Reaktion auf Reactions"): Cute Camera („Play this card immediately when your opponent plays a Reaction Spell or
// Artifact in reaction to your card or effect. Negate that reaction. …") wird NUR angeboten, wenn der Gegner gerade eine Reaktion auf MEINE Karte/MEINEN Effekt gespielt hat.
// Fenster ohne bekannte Quelle (Verursacher unbekannt) oder mit Quelle des Gegners selbst: kein Angebot. Hier: Held-besiegt-Fenster „nach" (Looting, Reaction Spell, braucht keine Quelle) + der Hook direkt.
// Aufruf: node docs/niche-tests/repro/W26/a-02-cute-camera-nur-bei-bekannter-gegnerreaktion-auf-meine-karte.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const KAM = 'Cute Camera';
const istKamera = (d) => d.type === 'confirm' && d.title === KAM && d._kameraHandFenster;
(async () => {
  const R = H.runner();
  for (const seat of [0, 1]) {
    const opp = 1 - seat;
    R.section(`Kamerabesitzer Sitz ${seat}`);
    // (a) Tod-Fenster: Held des Gegners wird besiegt; Quelle = meine Karte / seine eigene / unbekannt
    for (const [label, quelle, kameraSoll] of [
      ['Quelle = meine Karte (bekannt)', { name: 'Fireball', owner: seat, heroIdx: 0, controller: seat, counters: {} }, true],
      ['Quelle = eigene Karte des Gegners', { name: 'Fireball', owner: opp, heroIdx: 0, controller: opp, counters: {} }, false],
      ['Quelle unbekannt (nur Name, kein Besitzer)', { name: 'Unbekannte Quelle' }, false],
      ['keine Quelle', null, false],
    ]) {
      const hand = [[], []]; hand[seat] = [KAM]; hand[opp] = ['Looting'];
      const t = await H.fresh({ active: seat, hand, discard: [['Club of Gobbo'], []] });
      t.grantFor(opp, 1, 'Looting');
      t.policy.confirm = true;
      t.script.push({ match: istKamera, answer: () => ({ confirmed: true }) });
      await t.run(() => t.engine.actionDefeatHero(quelle, t.hero(opp, 0), {}));
      const ceGespielt = t.pile(opp, 'discardPile').includes('Looting');
      const angeboten = t.prompts.some(p => p.pi === seat && p.d.title === KAM && p.d._kameraHandFenster);
      R.check(`${label}: Gegner spielt Looting (Fenster ist offen)`, ceGespielt, { abl: t.pile(opp, 'discardPile'), prompts: t.prompts.map(p => p.pi + ':' + p.d.title) });
      R.check(`${label}: Cute Camera ${kameraSoll ? 'wird angeboten' : 'wird NICHT angeboten'}`, angeboten === kameraSoll, { prompts: t.prompts.map(p => p.pi + ':' + p.d.title) });
      R.check(`${label}: Kamera ${kameraSoll ? 'gespielt (Ablage)' : 'bleibt auf der Hand'}`, t.pile(seat, 'hand').includes(KAM) === !kameraSoll, { hand: t.pile(seat, 'hand') });
      R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
    // (b) der Hook direkt: Quelle bekannt/unbekannt/Gegner
    for (const [label, extra, soll] of [['sourceOwner = Kamerabesitzer', { sourceOwner: seat }, true], ['sourceOwner = Gegner', { sourceOwner: opp }, false], ['sourceOwner fehlt', {}, false]]) {
      const hand = [[], []]; hand[seat] = [KAM];
      const t = await H.fresh({ active: seat, hand });
      t.policy.confirm = true;
      t.script.push({ match: istKamera, answer: () => ({ confirmed: true }) });
      const neg = await t.run(() => t.engine._reaktionGespielt(opp, 'MOE Shield', 'Spell', extra));
      const angeboten = t.prompts.some(p => p.pi === seat && p.d.title === KAM && p.d._kameraHandFenster);
      R.check(`Hook ${label}: Kamera ${soll ? 'angeboten' : 'nicht angeboten'}`, angeboten === soll, { prompts: t.prompts.map(p => p.pi + ':' + p.d.title) });
      R.check(`Hook ${label}: Reaktion ${soll ? 'negiert' : 'nicht negiert'}`, (neg === true) === soll, { neg });
      R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
  }
  R.finish();
})();
