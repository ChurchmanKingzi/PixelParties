'use strict';
// N3-05 · Duigno, the Flaming Phoenix: die Zweitaktion bleibt einlösbar, nachdem Duigno das Brett verlassen hat
// Kartentext: „While you control this Creature, you may perform a second Action during each of your Action Phases, …"
// Erwartet: Verlässt Duigno (zerstört) die Action Phase, bevor die zweite Aktion genommen wurde, ist sie weg – „while you control this Creature".
// Beobachtet: Der Zuschlag (`counters.aaGrants` an der Duigno-INSTANZ) bleibt bestehen; die Engine sucht Anbieter in `engine.cardInstances` – auch die tote Instanz in der Ablage zählt
//   (`_zusatzAnbieterVon` prüft bei Zonen außer hero/ability/support nur die Kontrolle). `_second-action-shared.js` `onCardLeaveZone` (Z. ~318) räumt nur das Abzeichen.
// Ursache: cards/effects/_second-action-shared.js `onCardLeaveZone` müsste `expireAdditionalActionType` für die Zuschläge des Abgängers aufrufen (bzw. `_zusatzAnbieterVon` Zone prüfen).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  async function lauf(modus) {
    const t = await H.fresh({ hand: [['Fireball', 'Fireball'], []], deck: [Array(20).fill(H.INERT.creature), Array(20).fill(H.INERT.creature)] });
    t.setAbilities(0, 0, [['Destruction Magic', 'Destruction Magic', 'Destruction Magic'], [], []]);
    const d = modus === 'ohne' ? null : t.put(0, 1, 0, 'Duigno, the Flaming Phoenix');
    await t.endTurn(); await t.endTurn();                                   // echter Zugwechsel: Sitz 0 ist wieder dran, Duigno stempelt den Zuschlag zu Beginn der Action Phase
    await t.run(() => t.engine.advanceToPhase(0, 3, { manual: true }));
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    if (modus === 'vor') await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: 1, controller: 1 }, d));
    const hp0 = t.hp(1, 0);
    const r1 = await t.play(0, 'Fireball', { hero: 0, keepActions: true, phase: 3, noGrant: true });
    const hp1 = t.hp(1, 0);
    if (modus === 'nach') await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: 1, controller: 1 }, d));
    const r2 = await t.play(0, 'Fireball', { hero: 0, keepActions: true, phase: 3, noGrant: true });
    const hp2 = t.hp(1, 0);
    return { r1, schaden1: hp0 - hp1, r2, schaden2: hp1 - hp2, duignoDa: !!t.find('Duigno, the Flaming Phoenix', 'support'), errors: t.errors };
  }
  const o = await lauf('ohne');
  R.check('Gegenprobe: ohne Duigno nur EINE Aktion (zweiter Fireball wirkt nicht)', o.schaden1 === 150 && o.schaden2 === 0, o);
  const m = await lauf('mit');
  R.check('Gegenprobe: mit lebendem Duigno zwei Aktionen (beide Fireballs wirken)', m.schaden1 === 150 && m.schaden2 === 150 && m.duignoDa, m);
  const v = await lauf('vor');
  R.check('Duigno stirbt VOR der ersten Aktion → nur eine Aktion', v.schaden1 === 150 && v.schaden2 === 0, v);
  const n = await lauf('nach');
  R.check('Duigno stirbt NACH der ersten Aktion → keine zweite Aktion mehr', n.schaden1 === 150 && n.schaden2 === 0, n);
  R.check('keine Engine-Fehler', [o, m, v, n].every(x => x.errors.length === 0));
  R.finish();
})();
