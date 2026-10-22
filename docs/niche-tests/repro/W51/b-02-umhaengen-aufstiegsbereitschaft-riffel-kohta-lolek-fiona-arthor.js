'use strict';
// W51b · Weitere vom selben Fehler betroffene Karten (systematischer Sweep, Differenz „umgehängt" gegen „direkt dort angelegt"):
// Riffel, Kohta, Lolek und Fiona pflegen ihre Aufstiegs-Bereitschaft (`hero.ascensionReady`) über Enter/Leave ihrer Support Zones. Beim UMHÄNGEN per Slippery Fridge /
// Inheritance Ceremony sahen sie weder Abgang noch Ankunft: der Quellheld blieb „bereit", obwohl ihm das Equip fehlte, der Zielheld wurde nicht bereit, obwohl er es jetzt trug.
// Arthor (Kontrolle): seine beiden Equips melden sich selbst — war schon richtig, darf nicht kaputtgehen.
// Lösung: `onEquipLost` / `onEquipGained` (isMove) über `equipZustandHooks`. Beide Sitze, Fridge und Ceremony. Exit 0 = korrekt.
const U = require('../../lib/umhaengen.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const bereit = (t, s, hi) => !!t.hero(s, hi).ascensionReady;

const FAMILIEN = [
  { name: 'Riffel', held: 'Future Tech Gunslinger Riffel', teile: ['Ancient Tech Infinite Energy Core', 'Future Tech Gun'] },
  { name: 'Kohta', held: 'Kohta, the Silent Observer', teile: ['Super-Killing Knife, the Tool of Liquidation', 'Summoning Instructions'] },
  { name: 'Lolek', held: 'Lolek, the Shard Knight', teile: ['Diver Helmet', 'Shattered Trident, Treasure of the Deepsea'] },
  { name: 'Arthor (Kontrolle)', held: 'Arthor, the King of Blackport', teile: ['Legendary Sword of a Barbarian King', 'Summoning Circle'] },
];

(async () => {
  const R = U.H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section('Sitz ' + me + ' (Gegner Sitz ' + op + ')');
    for (const fam of FAMILIEN) {
      const [X, Y] = fam.teile;
      for (const via of ['fridge', 'ceremony']) {
        const kopf = `${fam.name}/${via}`;
        const neu = async () => U.fresh(me, { hand: [], heroes: { [me]: [fam.held] } });
        // (1) Quelle: beide Teile am Helden → bereit; Y wird umgehängt → NICHT mehr bereit; zurück → wieder bereit
        { const t = await neu(); await U.lege(t, me, X, 0); await U.lege(t, me, Y, 0);
          R.check(`${kopf}: Ausgang — beide Teile am Helden → bereit`, bereit(t, me, 0) && U.wo(t, me, X).join() === '0' && U.wo(t, me, Y).join() === '0', { b: bereit(t, me, 0), x: U.wo(t, me, X), y: U.wo(t, me, Y), e: t.errors });
          t.reset();
          const r = await U.bewege(t, me, via, { name: Y, nach: 1 });
          R.check(`${kopf}: ${Y} liegt jetzt an Held 1`, r === true && U.wo(t, me, Y).join() === '1', { r, y: U.wo(t, me, Y) });
          R.check(`${kopf}: Quellheld NICHT mehr aufstiegsbereit (Teil fehlt)`, !bereit(t, me, 0), { b: t.hero(me, 0) });
          R.check(`${kopf}: sauber`, U.sauber(t), { e: t.errors, a: t.audit() });
          t.resetActions(me); t.gs.hoptUsed = {}; t.reset();
          await U.bewege(t, me, via, { name: Y, nach: 0, von: 1 });
          R.check(`${kopf}: zurück an den Helden → wieder bereit`, bereit(t, me, 0) && U.wo(t, me, Y).join() === '0', { b: bereit(t, me, 0), y: U.wo(t, me, Y) }); }
        // (2) Ziel: X am Helden, Y an Held 1; Y wird auf den Helden umgehängt → bereit
        { const t = await neu(); await U.lege(t, me, X, 0); await U.lege(t, me, Y, 1);
          R.check(`${kopf}: Ausgang — nur ein Teil am Helden → nicht bereit`, !bereit(t, me, 0), { b: t.hero(me, 0) });
          t.reset();
          const r = await U.bewege(t, me, via, { name: Y, nach: 0, von: 1 });
          R.check(`${kopf}: ${Y} liegt jetzt am Helden`, r === true && U.wo(t, me, Y).join() === '0', { r, y: U.wo(t, me, Y) });
          R.check(`${kopf}: Zielheld jetzt aufstiegsbereit`, bereit(t, me, 0), { b: t.hero(me, 0) });
          R.check(`${kopf}: sauber`, U.sauber(t), { e: t.errors, a: t.audit() }); }
      }
      // (3) Gegenprobe: normales Zerstören eines Teils nimmt die Bereitschaft wie bisher
      { const t = await U.fresh(me, { hand: [], heroes: { [me]: [fam.held] } });
        await U.lege(t, me, X, 0); await U.lege(t, me, Y, 0);
        const inst = t.inst(c => c.name === Y && c.zone === 'support')[0];
        await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: op }, inst, {}));
        R.check(`${fam.name}: Gegenprobe — normales Zerstören von ${Y} nimmt die Bereitschaft`, !bereit(t, me, 0), { b: t.hero(me, 0) }); }
    }

    // ── Fiona: Grimoire + ein als Equip angelegter HELD (Initiation Ritual-Muster: `treatAsEquip`) ──
    for (const via of ['fridge', 'ceremony']) {
      const GRIM = 'Forbidden Grimoire of a Forgotten Sorceress', HELD = 'Atta, Speaker of Desires';
      const kopf = `Fiona/${via}`;
      const aufbau = async (heldAm) => {
        const t = await U.fresh(me, { hand: [], heroes: { [me]: ['Fiona, the Princess of Blackport'] } });
        await U.lege(t, me, GRIM, 0);
        const inst = t.put(me, heldAm, 2, HELD, { counters: { treatAsEquip: true } });
        await t.engine.runHooks('onCardEnterZone', { enteringCard: inst, toZone: 'support', toHeroIdx: heldAm, _skipReactionCheck: true });
        return t;
      };
      { const t = await aufbau(0);
        R.check(`${kopf}: Ausgang — Grimoire + angelegter Held → bereit`, bereit(t, me, 0), { b: t.hero(me, 0) });
        t.reset();
        const r = await U.bewege(t, me, via, { name: HELD, nach: 1 });
        R.check(`${kopf}: der angelegte Held liegt jetzt an Held 1`, r === true && U.wo(t, me, HELD).join() === '1', { r, w: U.wo(t, me, HELD) });
        R.check(`${kopf}: Quell-Fiona nicht mehr bereit`, !bereit(t, me, 0), { b: t.hero(me, 0) });
        R.check(`${kopf}: sauber`, U.sauber(t), { e: t.errors, a: t.audit() }); }
      { const t = await aufbau(1);
        R.check(`${kopf}: Ausgang — angelegter Held liegt woanders → nicht bereit`, !bereit(t, me, 0), { b: t.hero(me, 0) });
        t.reset();
        const r = await U.bewege(t, me, via, { name: HELD, nach: 0, von: 1 });
        R.check(`${kopf}: Ziel-Fiona jetzt bereit`, r === true && U.wo(t, me, HELD).join() === '0' && bereit(t, me, 0), { r, b: t.hero(me, 0), w: U.wo(t, me, HELD) }); }
    }

    // ── Gegner-Fridge: der Aufstiegs-Held des GEGNERS (Sitz `op`) verliert die Bereitschaft, mein gleicher Held (anderer Sitz, gleicher Platz) behält sie ──
    { const [X, Y] = FAMILIEN[0].teile; const held = FAMILIEN[0].held;
      const t = await U.fresh(me, { hand: [], heroes: { [me]: [held], [op]: [held] } });
      await U.lege(t, me, X, 0); await U.lege(t, me, Y, 0); await U.lege(t, op, X, 0); await U.lege(t, op, Y, 0);
      R.check('Riffel gegen Riffel: Ausgang — beide bereit', bereit(t, me, 0) && bereit(t, op, 0), { me: bereit(t, me, 0), op: bereit(t, op, 0) });
      t.reset();
      await U.bewege(t, me, 'fridge', { name: Y, nach: 1, besitzer: op });
      R.check('Riffel gegen Riffel: Fridge auf den Gegner → nur der Gegner-Riffel verliert die Bereitschaft', !bereit(t, op, 0) && bereit(t, me, 0), { me: bereit(t, me, 0), op: bereit(t, op, 0), w: U.wo(t, op, Y) }); }
  }
  R.finish();
})();
