'use strict';
// W34a · Punkt 3 (Nachtrag) · Al, 22.10.2026: „Ja, die zählen!" – auch die heldengebundenen Zähler/Sperren zählen Effekte, die als Attack/Spell zählen:
//  · Mirjam („This Hero can never use more than 1 Attack per turn"): zählt über `onActionUsed` (nur Aktionen) – der als Attack zählende Effekt meldet sich über den neuen Hook `onEffectCountedAsArt`;
//    ihre `canPlayCard`-Sperre gilt für einen weiteren Effekt (Pseudo-Karte des Typs Attack) ebenso wie für eine Attack-Karte, und umgekehrt zählt eine gespielte Attack für den Effekt.
//  · Idej Sword - Muras („must be the only Attack the equipped Hero uses this turn": liest `heroesAttackedThisTurn`) und Idej Sword - Kogarasu („only 1 Spell per turn") sperren über `canPlayCard`
//    auch die als Attack/Spell zählenden Effekte des Trägers.
//  · Gegenprobe: Helden ohne diese Karten werden nicht berührt.
// Aufruf: node docs/niche-tests/repro/W34/a-05-mirjam-und-idej-schwerter-teilen-die-zaehler-der-als-attack-spell-zaehlenden-effekte.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const MIRJAM = 'Mirjam, the Fallen Cute Angel', NOBU = 'Idej Lord Nobunakin', DAIYO = 'Idej Lord Daiyo';
const posHero = (valid, owner, idx) => valid.find(v => v.type === 'hero' && v.owner === owner && v.heroIdx === idx);
const ps = (t, s) => t.gs.players[s];

async function basis(me, op, extra = {}) {
  const hand = [[], []]; hand[me] = extra.hand || [];
  const t = await H.fresh({ hand, deckSize: 30, hp: 800, active: me });
  for (let hi = 0; hi < 3; hi++) { t.hero(me, hi).atk = 100; t.hero(me, hi).baseAtk = 100; t.hero(op, hi).atk = 100; t.hero(op, hi).baseAtk = 100; }
  t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
  return t;
}
/** Sword in a Bottle mit dem Angreifer `att`; liefert den Schaden am Gegner-Helden 0. */
async function schwertFlasche(t, me, op, att) {
  t.targetFn = (v) => { const a = posHero(v, me, att); return a && !a.ineligible ? [a.id, posHero(v, op, 0).id] : null; };   // nicht angriffsfähig → gar nicht als Angreifer wählbar (Abbruch)
  const hp = t.hp(op, 0);
  const r = await t.play(me, 'Sword in a Bottle', { hero: 0, keepActions: true });
  return { r, schaden: hp - t.hp(op, 0) };
}
/** Javelin Throw (der gewählte Held trägt ein Artefakt) auf den Gegner-Helden 0. */
async function wurf(t, me, op, att) {
  t.targetFn = (v) => { if (!v.some(x => x.owner === op)) return [posHero(v, me, att).id]; return [posHero(v, op, 0).id]; };
  const hp = t.hp(op, 0);
  const r = await t.play(me, 'Javelin Throw', { hero: att, keepActions: true });
  return { r, schaden: hp - t.hp(op, 0) };
}

(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    // ── Mirjam ──
    R.section(`Sitz ${me}: Mirjam – 1 Attack pro Zug zählt einen als Attack zählenden Effekt`);
    { const t = await basis(me, op, { hand: ['Sword in a Bottle', 'Javelin Throw'] });
      t.setHero(me, 1, MIRJAM, 800); t.put(me, 1, 0, H.INERT.artifact);
      R.check('Vorher: Mirjam kann angreifen (Hero-Prüfung), der andere Held ebenso', t.engine.heroKannAngreifen(me, 1, me) === true && t.engine.heroKannAngreifen(me, 0, me) === true, null);
      const a = await schwertFlasche(t, me, op, 1);
      R.check('Sword in a Bottle (Angreifer Mirjam) trifft', a.r === true && a.schaden > 0, a);
      R.check('Mirjams Zähler steht auf 1 (Hook onEffectCountedAsArt)', t.hero(me, 1)._mirjamAttacksUsed === 1 && t.hero(me, 1)._mirjamAttackTurn === t.gs.turn, { n: t.hero(me, 1)._mirjamAttacksUsed });
      R.check('Mirjam kann jetzt nicht mehr angreifen – der andere Held weiterhin', t.engine.heroKannAngreifen(me, 1, me) === false && t.engine.heroKannAngreifen(me, 0, me) === true, null);
      const b = await wurf(t, me, op, 1);
      R.check('ein zweiter als Attack zählender Effekt (Javelin Throw, Träger Mirjam) ist GEBLOCKT', b.schaden === 0 && b.r !== undefined, b);
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }
    { // Umgekehrt: eine gespielte Attack-Karte zählt für den Effekt (und der Effekt wird nicht doppelt gezählt)
      const t = await basis(me, op, { hand: ['Blow of the Venom Snake', 'Sword in a Bottle'] });
      t.setHero(me, 1, MIRJAM, 800); t.grantFor(me, 1, 'Blow of the Venom Snake');
      t.targetFn = (v) => [posHero(v, op, 0).id];
      const q = await t.play(me, 'Blow of the Venom Snake', { hero: 1 });
      R.check('Mirjam spielt Blow of the Venom Snake (erste Attack des Zuges; keine inhärente Aktion, damit Mirjams `onActionUsed` zählt)', q === true && t.hero(me, 1)._mirjamAttacksUsed === 1, { q, n: t.hero(me, 1)._mirjamAttacksUsed });
      const hp0 = t.hp(op, 0);
      const s = await schwertFlasche(t, me, op, 1);
      R.check('danach ist der als Attack zählende Effekt mit Mirjam als Angreifer GEBLOCKT (Hero-Prüfung), kein Schaden, Zähler bleibt 1', s.schaden === 0 && t.hero(me, 1)._mirjamAttacksUsed === 1, { s: s.schaden, n: t.hero(me, 1)._mirjamAttacksUsed });
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }
    { // Gegenprobe: der Effekt eines anderen Helden berührt Mirjams Zähler nicht
      const t = await basis(me, op, { hand: ['Sword in a Bottle'] });
      t.setHero(me, 1, MIRJAM, 800);
      const a = await schwertFlasche(t, me, op, 2);
      R.check('Gegenprobe: Angreifer Held 2 → Mirjams Zähler bleibt 0, Mirjam kann angreifen', a.schaden > 0 && (t.hero(me, 1)._mirjamAttacksUsed || 0) === 0 && t.engine.heroKannAngreifen(me, 1, me) === true, a);
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }

    // ── Idej Sword - Muras ──
    R.section(`Sitz ${me}: Idej Sword - Muras – „the only Attack the equipped Hero uses this turn"`);
    { const t = await basis(me, op, { hand: ['Sword in a Bottle'] });
      t.setHero(me, 1, NOBU, 800);
      const sw = t.put(me, 1, 0, 'Idej Sword - Muras'); sw.counters.treatAsEquip = 1;
      R.check('Vorher: der Träger kann angreifen', t.engine.heroKannAngreifen(me, 1, me) === true, null);
      const a = await schwertFlasche(t, me, op, 1);
      R.check('Sword in a Bottle (Angreifer: Träger) trifft', a.schaden > 0 && (ps(t, me).heroesAttackedThisTurn || []).includes(1), a);
      R.check('der Träger darf in diesem Zug keine weitere Attack mehr: als Attack zählende Effekte sind GEBLOCKT (heroesAttackedThisTurn)', t.engine.heroKannAngreifen(me, 1, me) === false && t.engine.heroKannAngreifen(me, 0, me) === true, null);
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }

    // ── Idej Sword - Kogarasu ──
    R.section(`Sitz ${me}: Idej Sword - Kogarasu – „can only use 1 Spell per turn" sperrt einen als Spell zählenden Effekt`);
    { const t = await basis(me, op);
      t.setHero(me, 0, DAIYO, 800);
      const sw = t.put(me, 0, 0, 'Idej Sword - Kogarasu'); sw.counters.treatAsEquip = 1;
      R.check('Vorher: der Träger kann zaubern (Hero-Prüfung für Spell-Effekte), ein Held ohne Schwert ebenso', t.engine.heroKannZaubern(me, 0, me, { name: 'X' }) === true && t.engine.heroKannZaubern(me, 1, me, { name: 'X' }) === true, null);
      t.hero(me, 0)._idejKogarasuSpellTurn = t.gs.turn;
      R.check('Nach dem 1. Spell des Zuges (Stempel des Schwerts) ist der Träger für Spell-Effekte GESPERRT – der andere Held nicht', t.engine.heroKannZaubern(me, 0, me, { name: 'X' }) === false && t.engine.heroKannZaubern(me, 1, me, { name: 'X' }) === true, null);
      R.check('Attack-Effekte sperrt Kogarasu nicht', t.engine.heroKannAngreifen(me, 0, me) === true, null);
      R.check('sauber', sauber(t), { e: t.errors, a: t.audit() }); }
  }
  R.finish();
})();
