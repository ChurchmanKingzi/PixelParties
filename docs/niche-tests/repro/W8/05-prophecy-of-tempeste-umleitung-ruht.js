'use strict';
// W8/05 · Welle 8 (Al, 14.10.2026, Frage 2 aus Welle 7) hatte entschieden: „Die Umleitung soll bei Freeze/Stun NICHT weiterlaufen."
// ★ ÜBERHOLT / ZURÜCKGENOMMEN in Welle 27 (W27a, Al, 21.10.2026): „Nein, nimm das Ruling zurück. Das neue allgemeine Ruling lautet
// 'Attachments liegen bei Frozen/Stunned nicht still'." Dieses Repro prüft jetzt die NEUE Regel: Prophecy of Tempeste leitet bei Frost/
// Betäubung/Negation des Wirts GENAUSO um wie ohne Status (Held- UND Kreaturenschaden, Rückfrage, Wirt nimmt ≤ 100); der 100-Deckel gilt immer.
// Aufruf: node docs/niche-tests/repro/W8/05-prophecy-of-tempeste-umleitung-ruht.js   (Exit 1 = Fehler tritt auf)
const H = require('../../lib/h.js');
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const ZUSTAENDE = [[null, null], ['gefroren', (t) => t.heroStatus(0, 0, 'frozen')], ['betäubt', (t) => t.heroStatus(0, 0, 'stunned')],
  ['negiert (hart)', (t) => t.heroStatus(0, 0, 'negated')], ['negiert (Effekt)', (t) => t.heroStatus(0, 0, 'negated', { appliedTurn: 0, effectOnly: true })]];

async function szene(set) {
  const t = await H.fresh({ hand: [['Prophecy of Tempeste'], []], hp: 800 });
  t.grantFor(0, 0, 'Prophecy of Tempeste');
  t.targetFn = (valid) => [(valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 0) || valid[0]).id];
  await t.play(0, 'Prophecy of Tempeste', { hero: 0, noGrant: true });
  t.policy.confirm = true;                                     // „Redirect!" bestätigen
  if (set) set(t);
  t.reset();
  return t;
}

(async () => {
  const R = H.runner();

  for (const [name, set] of ZUSTAENDE) {
    // (a) Heldenschaden an einen ANDEREN eigenen Helden (Held 1)
    {
      const t = await szene(set);
      await t.run(() => t.engine.actionDealDamage({ name: 'T', owner: 1, heroIdx: 0 }, t.hero(0, 1), 60, 'normal'));
      await wait(900);
      const umgeleitet = t.hp(0, 1) === 800 && t.hp(0, 0) === 740;
      const direkt = t.hp(0, 1) === 740 && t.hp(0, 0) === 800;
      void direkt;
      R.check(`Prophecy (${name || 'ohne Status'}), Held: Schaden wird auf den Wirt umgeleitet (W27a: Anhänge liegen nicht still)`,
        umgeleitet, { held1: t.hp(0, 1), wirt: t.hp(0, 0) });
      R.check(`Prophecy (${name || 'ohne Status'}), Held: Rückfrage erschien`, t.prompts.length >= 1, t.prompts.length);
      R.check(`Prophecy (${name || 'ohne Status'}), Held: keine Engine-Fehler`, t.errors.length === 0, t.errors);
    }
    // (b) Schaden an eine eigene KREATUR
    {
      const t = await szene(set);
      const c = t.put(0, 1, 0, H.INERT.creature);
      await t.run(() => t.engine.actionDealCreatureDamage({ name: 'T', owner: 1, heroIdx: 0 }, c, 60, 'spell'));
      await wait(900);
      const umgeleitet = t.hp(0, 0) === 740 && (c.counters.currentHp ?? 200) === 200;
      const direkt = t.hp(0, 0) === 800 && (c.counters.currentHp ?? 200) === 140;
      void direkt;
      R.check(`Prophecy (${name || 'ohne Status'}), Kreatur: Schaden wird auf den Wirt umgeleitet (W27a)`,
        umgeleitet, { wirt: t.hp(0, 0), kreatur: c.counters.currentHp });
      R.check(`Prophecy (${name || 'ohne Status'}), Kreatur: keine Engine-Fehler`, t.errors.length === 0, t.errors);
    }
    // (c) der Deckel gegen den Wirt gilt immer (W7a)
    {
      const t = await szene(set);
      await t.engine.actionDealDamage({ name: 'T', owner: 1 }, t.hero(0, 0), 300, 'normal');
      R.check(`Prophecy (${name || 'ohne Status'}): Deckel 100 gilt`, 800 - t.hp(0, 0) === 100, 800 - t.hp(0, 0));
    }
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
