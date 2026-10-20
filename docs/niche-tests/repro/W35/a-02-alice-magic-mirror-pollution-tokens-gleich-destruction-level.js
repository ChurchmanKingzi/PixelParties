'use strict';
// W35a · Frage 2 · Al, 22.10.2026 (Antwort auf W34a-Rückfrage 2): „Nein, X, wobei X das Ability-Level ist, ist korrekt – das ist ja laut neuem Ruling offiziell das Level des Spells."
//  → Ist-Zustand BLEIBT (dieses Repro sichert ihn ab, Exit 0 auch auf der Basis): Magic Mirror („Place a number of Pollution Tokens equal to the negated Spell's level") legt gegen Alice
//    („Treated as a Destruction Magic Spell") so viele Pollution Tokens, wie ihr DESTRUCTION-MAGIC-LEVEL (Ability-Level) beträgt – 0, 1, 2 und 3 geprüft –, NICHT „keine Tokens".
//    Maßgeblich ist das Level des wirkenden Helden (Alice selbst), nicht das eines anderen Helden; die Tokens landen in den freien Support Zones des Spiegel-Besitzers; der Effekt wird
//    negiert (kein Schaden), der Spiegel ist aufgebraucht, es gibt keine Kopie (Alice hat keine Spell-Karte).
//  · Gegenprobe: gegen einen ECHTEN Spell (Fireball, Stufe 1) legt Magic Mirror dessen Kartenstufe (Spell-Level), hier unabhängig vom Ability-Level des Helden.
// Aufruf: node docs/niche-tests/repro/W35/a-02-alice-magic-mirror-pollution-tokens-gleich-destruction-level.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const ALICE = 'Alice, the Puppeteer Girl';
const ps = (t, s) => t.gs.players[s];
const posHero = (valid, owner, idx) => valid.find(v => v.type === 'hero' && v.owner === owner && v.heroIdx === idx);
const poll = (t, s) => t.engine.cardInstances.filter(c => /Pollution/.test(c.name) && c.zone === 'support' && t.engine.physicalSide(c) === s).length;
const gefragt = (t, pi, n) => t.prompts.filter(p => p.pi === pi && p.d.title === n).length;

async function szene(me, op, D, extra = {}) {
  const t = await H.fresh({ hand: [[], []], deckSize: 30, hp: 800, active: me });
  t.setHero(me, 0, ALICE, 800);
  for (let i = 0; i < 3; i++) { const c = t.put(me, 1, i, H.INERT.creature); c.turnPlayed = 1; }
  t.setAbilities(me, 0, [Array(D).fill('Destruction Magic'), [], []]);
  if (extra.andererHeld) t.setAbilities(me, 1, [Array(3).fill('Destruction Magic'), [], []]);   // ein anderer Held mit hohem Level darf NICHT zählen
  t.putSurprise(op, 0, 'Magic Mirror'); t.grantFor(op, 0, 'Magic Mirror');
  t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
  t.targetFn = (v) => [posHero(v, op, 0).id];
  const hp0 = t.hp(op, 0);
  await t.activateHero(me, 0, {});
  return { t, schaden: hp0 - t.hp(op, 0) };
}

(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section(`Sitz ${me}: Magic Mirror × Alice – Pollution Tokens = Destruction-Magic-Level (0 bis 3)`);
    for (const D of [0, 1, 2, 3]) {
      const r = await szene(me, op, D);
      R.check(`Destruction ${D}: Magic Mirror wird angeboten, Alice richtet keinen Schaden an, der Spiegel ist aufgebraucht`, gefragt(r.t, op, 'Magic Mirror') >= 1 && r.schaden === 0 && ps(r.t, op).surpriseZones[0].length === 0, { g: gefragt(r.t, op, 'Magic Mirror'), s: r.schaden });
      R.check(`Destruction ${D}: genau ${D} Pollution Token(s) beim Spiegel-Besitzer, keine beim Wirker`, poll(r.t, op) === D && poll(r.t, me) === 0, { op: poll(r.t, op), me: poll(r.t, me) });
      R.check('keine Kopie: Alices Besitzer verliert nichts (800 HP)', r.t.hp(me, 0) === 800, r.t.hp(me, 0));
      R.check('sauber', sauber(r.t), { e: r.t.errors, a: r.t.audit() });
    }
    { const r = await szene(me, op, 1, { andererHeld: true });
      R.check('Destruction 1 bei Alice, Destruction 3 bei einem ANDEREN Helden: es zählt Alices Level → 1 Token', poll(r.t, op) === 1, { op: poll(r.t, op) });
      R.check('sauber', sauber(r.t), { e: r.t.errors, a: r.t.audit() }); }

    R.section(`Sitz ${me}: Gegenprobe – echter Spell (Fireball): Magic Mirror legt die Kartenstufe des Spells`);
    { const hand = [[], []]; hand[me] = ['Fireball'];
      const t = await H.fresh({ hand, deckSize: 30, hp: 800, active: me });
      t.putSurprise(op, 0, 'Magic Mirror'); t.grantFor(op, 0, 'Magic Mirror');
      t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
      t.targetFn = (v) => [(posHero(v, op, 0) || v.find(x => x.type === 'hero')).id];   // die Kopie des Spiegels zielt zurück auf den Wirker
      const stufe = H.DB['Fireball'].level;
      await t.play(me, 'Fireball', { hero: 0 });
      R.check(`Fireball (Stufe ${stufe}) wird gespiegelt: ${stufe} Pollution Token(s) beim Spiegel-Besitzer`, gefragt(t, op, 'Magic Mirror') >= 1 && poll(t, op) === stufe, { g: gefragt(t, op, 'Magic Mirror'), p: poll(t, op), stufe });
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }
  }
  R.finish();
})();
