'use strict';
// W13c · Rückfrage 10 (Weakening Crystal bei Karian, Hand-Negierung) · Al, 15.10.2026: „Ja, auch dagegen ist Karian immun." (Umsetzung seit Welle 12 über `ignoresHaltStatuses` /
//   `engine.heroIgnoresHaltStatuses`; dieses Repro sichert alle Anlege-Zeitpunkte der Hand-Negierung ab).
// Kartentexte: Weakening Crystal: „While this card is in your hand, the effects of all your Heroes are negated. This counts as a negative status effect."
//   Karian: „… it is otherwise not affected by those effects. Other negative status effects don't affect this Hero."
// Erwartung: Karian trägt zu keinem Zeitpunkt `negated` und bleibt voll handlungsfähig, solange der Kristall auf der Hand liegt — bei Start auf der Hand, nach dem Ziehen, zu Beginn ihrer Runde, im
//   Gegnerzug — während die beiden anderen Helden negiert werden (Kontrolle); ohne Kristall / mit Kristall im Gegner-Hand ändert sich nichts; (Gegenprobe) ein Karian-fremder Held bleibt negiert.
//   Al-Korrektur: Karian ist NUR gegen den Crystal immun, NICHT gegen Petrification Break (dessen Buff wirkt auf sie wie auf jeden Helden, Teil (f)); A08-28 (Träger von Petrification Break gegen
//   den Crystal) bleibt unverändert offen. Exit 0 = korrekt.
const H = require('../../lib/h.js');
const KA = 'Grand Inquisitor Karian';
const WC = 'Weakening Crystal';
function frei(t, hi = 0) {
  const e = t.engine;
  return e.canHeroPerformAction(0, hi) && !e.isHeroIncapacitated(0, hi) && e._heroCanAct(0, hi) && !e._isHeroEffectSilenced(0, hi);
}
(async () => {
  const R = H.runner();
  const bauen = async (opts = {}) => {
    const t = await H.fresh({ heroes: [[KA, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], ...opts });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    return t;
  };
  { // (a) Kristall liegt auf der Hand, Anlage wie beim Eintritt
    const t = await bauen({ hand: [[WC], []] });
    t.engine._refreshWeakeningCrystalNegation({ reapply: true });
    R.check('(a) Karian nicht negiert', !t.hero(0, 0).statuses.negated, Object.keys(t.hero(0, 0).statuses));
    R.check('(a) Karian handlungsfähig', frei(t));
    R.check('(a) Kontrolle: beide anderen Helden negiert', !!t.hero(0, 1).statuses.negated && !!t.hero(0, 2).statuses.negated);
  }
  { // (b) Kristall wird gezogen (echter Weg)
    const t = await bauen({ deck: [[WC, ...Array(20).fill(H.INERT.filler)], []] });
    await t.run(() => t.engine.actionDrawCards(0, 1));
    R.check('(b) Kristall gezogen', t.pile(0, 'hand').includes(WC), t.pile(0, 'hand'));
    t.engine._refreshWeakeningCrystalNegation({ reapply: true });
    R.check('(b) Karian nach dem Ziehen nicht negiert und handlungsfähig', !t.hero(0, 0).statuses.negated && frei(t), Object.keys(t.hero(0, 0).statuses));
    R.check('(b) Kontrolle: Held 1 negiert', !!t.hero(0, 1).statuses.negated);
    R.check('(b) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  { // (c) Zugwechsel: zu Beginn ihrer Runde und im Gegnerzug neu angelegt
    const t = await bauen({ hand: [[WC], []] });
    t.engine._refreshWeakeningCrystalNegation({ reapply: true });
    await t.endTurn();                                              // Gegner am Zug
    R.check('(c) im Gegnerzug: Karian nicht negiert, handlungsfähig', !t.hero(0, 0).statuses.negated && frei(t), Object.keys(t.hero(0, 0).statuses));
    await t.endTurn();                                              // wieder Sitz 0
    R.check('(c) zu Beginn ihrer Runde: Karian nicht negiert, handlungsfähig', !t.hero(0, 0).statuses.negated && frei(t), Object.keys(t.hero(0, 0).statuses));
    R.check('(c) Kontrolle: Held 2 negiert', !!t.hero(0, 2).statuses.negated);
    R.check('(c) keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  { // (d) Karian kann mit dem Kristall auf der Hand wirklich handeln (Spell wirken)
    const t = await bauen({ hand: [[WC, 'Fireball'], []] });
    t.engine._refreshWeakeningCrystalNegation({ reapply: true });
    t.grantFor(0, 0, 'Fireball');
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    const h0 = t.hp(1, 0);
    const r = await t.play(0, 'Fireball', { hero: 0 });
    R.check('(d) Karian wirkt Fireball trotz Kristall auf der Hand', r === true && t.hp(1, 0) < h0, { r, dmg: h0 - t.hp(1, 0) });
  }
  { // (e) Gegenprobe: Kristall in der GEGNER-Hand wirkt nicht auf Sitz 0
    const t = await bauen({ hand: [[], [WC]] });
    t.engine._refreshWeakeningCrystalNegation({ reapply: true });
    R.check('(e) Gegner-Kristall negiert Sitz 0 nicht', !t.hero(0, 0).statuses.negated && !t.hero(0, 1).statuses.negated);
  }
  { // (f) Petrification Break wirkt auf Karian wie auf jeden anderen Helden (KEINE Karian-Ausnahme; Al-Korrektur: „Karian ist NICHT gegen den Buff von Petrification Break immun, ich sprach nur von Crystal")
    const PB = 'Petrification Break';
    const dmg = async (hi) => {
      const t = await bauen();
      t.put(0, hi, 0, PB).turnPlayed = 1;
      const wirkt = t.engine.heroHasStatusImmunityAttachment(0, hi) === true;
      const h0 = t.hp(0, hi);
      await t.run(() => t.engine.actionDealDamage({ name: 'T', owner: 1 }, t.hero(0, hi), 101, 'creature'));
      return { wirkt, schaden: h0 - t.hp(0, hi), errors: t.errors.length };
    };
    const ka = await dmg(0), rick = await dmg(1);
    R.check('(f) Petrification Break an Karian: Schutz-Anhängsel aktiv wie bei jedem Helden', ka.wirkt === true && rick.wirkt === true, { ka, rick });
    R.check('(f) Petrification Break an Karian: Schaden halbiert (aufgerundet) wie bei jedem anderen Helden', ka.schaden === 51 && rick.schaden === 51, { ka, rick });
    R.check('(f) keine Engine-Fehler', ka.errors === 0 && rick.errors === 0, { ka, rick });
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
