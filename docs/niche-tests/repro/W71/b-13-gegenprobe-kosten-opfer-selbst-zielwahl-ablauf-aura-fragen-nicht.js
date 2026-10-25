'use strict';
// W71b-13 · Cool Rescuer Monia: GEGENPROBE — was KEIN „Effekt auf eine Kreatur" ist, öffnet kein Fenster (dokumentierte Auslegung, Fragen an Al im Bericht)
//
//   · Opfer / Tribut als KOSTEN des Kontrolleurs (Ruling 1.8.: „Monia darf Opfer nicht beschützen"; auch Dark Deepsea Gods Tribut-Rückgabe, `kosten: true`)
//   · Selbst-Effekte: die Kreatur betrifft sich durch ihren EIGENEN Text (Wendy, Moonlight Butterfly, Creepy Villager, Cute Cats; `selbst: true`)
//   · reines Anvisieren / Abbruch der Zielwahl (kein Effekt)
//   · natürliches Auslaufen (Buff-Dauer, Rückgabe gestohlener Kreaturen am Zugende)
//   · dauerhafte Auren („while equipped": The Sun Sword)
// Dazu die Gegenprobe zum Gegenstück: derselbe Weg OHNE die Ausnahme-Marke fragt sehr wohl.
// Aufruf: node docs/niche-tests/repro/W71/b-13-….js   (Exit 0 = korrekt)
const S = require('../../lib/monia-sweep.js');
const { H } = S;
const { returnSupportCreatureToHand } = require('../../../../cards/effects/_deepsea-shared.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(2); });

(async () => {
  const R = H.runner();
  for (const m of [0, 1]) {
    const o = 1 - m;
    const frisch = async (extra = {}) => { const sc = await S.szene({ m, ...extra }); S.skript(sc.t, 'ja', m); return sc; };
    const meine = (t) => t.engine.cardInstances.filter(c => c.zone === 'support' && c.name === 'ZZ Dummy Big' && (c.controller ?? c.owner) === m);

    R.section(`Monia Sitz ${m} · Bounce-Primitiv: ohne Marke fragt, mit „kosten" / „selbst" nicht`);
    {
      const { t } = await frisch(); const k = meine(t);
      const r1 = await t.run(() => returnSupportCreatureToHand(t.engine, k[0], 'Probe', { sourceOwner: o }));
      R.check('ohne Marke: Monia fragt (angenommen → Kreatur bleibt)', S.angebote(t).length === 1 && r1.returned === false && k[0].zone === 'support', { n: S.angebote(t).length, r: r1 });
      t.reset(); S.skript(t, 'ja', m);
      const r2 = await t.run(() => returnSupportCreatureToHand(t.engine, k[1], 'Dark Deepsea God', { sourceOwner: m, kosten: true }));
      R.check('kosten: true (Tribut) → kein Angebot, Kreatur zurück auf die Hand', S.angebote(t).length === 0 && r2.returned === true, { n: S.angebote(t).length, r: r2 });
      const sc2 = await frisch(); const k2 = meine(sc2.t);
      const r3 = await sc2.t.run(() => returnSupportCreatureToHand(sc2.t.engine, k2[0], 'Wendy, the Shy Girl', { sourceOwner: m, selbst: true }));
      R.check('selbst: true (eigener Text) → kein Angebot', S.angebote(sc2.t).length === 0 && r3.returned === true, { n: S.angebote(sc2.t).length, r: r3 });
    }

    R.section(`Monia Sitz ${m} · Opfer (isSacrifice) und Selbst-Zerstörung: kein Angebot`);
    {
      const { t } = await frisch(); const k = meine(t);
      await t.run(() => t.engine.actionDestroyCard({ name: 'Sacrificial Dagger', owner: m, heroIdx: 0 }, k[0], { isSacrifice: true }));
      R.check('Opfer-Zerstörung (isSacrifice) → kein Angebot, Kreatur weg', S.angebote(t).length === 0 && k[0].zone !== 'support', { n: S.angebote(t).length, z: k[0].zone });
      await t.run(() => t.engine.actionDestroyCard(k[1], k[1], {}));
      R.check('Selbst-Zerstörung (Quelle = die Kreatur) → kein Angebot', S.angebote(t).length === 0 && k[1].zone !== 'support', { n: S.angebote(t).length, z: k[1].zone });
      const ok = await t.run(() => t.engine.kreaturBetroffen(k[1], 'destroy', 'Probe', { isSacrifice: true }));
      R.check('kreaturBetroffen mit isSacrifice → true ohne Fenster', ok === true && S.angebote(t).length === 0, ok);
    }

    R.section(`Monia Sitz ${m} · reines Anvisieren: Zielwahl abgebrochen → kein Angebot, nichts verändert`);
    {
      const { t } = await frisch({ handO: ['Fireball'] });
      t.policy.cancelTargets = true;
      const vor = S.schnappschuss(t); const ids = Object.keys(vor);
      await t.play(o, 'Fireball', { hero: 0 });
      R.check('Fireball nach Abbruch der Zielwahl: kein Angebot, keine Kreatur verändert', S.angebote(t).length === 0 && S.unterschied(vor, S.schnappschuss(t), ids).length === 0, { n: S.angebote(t).length });
    }

    R.section(`Monia Sitz ${m} · natürliches Auslaufen: Buff-Ende und Rückgabe am Zugende fragen nicht`);
    {
      const { t } = await frisch({ handO: ['Cloud Pillow'] });
      S.skript(t, 'nein', m);
      t.targetFn = (valid) => { const k = valid.find(v => v.type === 'equip' && v.owner === o); return k ? [k.id] : undefined; };
      await t.play(o, 'Cloud Pillow', { hero: 0 });
      await S.ende(t, o);
      const n0 = S.angebote(t).length;
      const ziel = t.engine.cardInstances.find(c => c.zone === 'support' && c.counters.buffs && c.counters.buffs.cloudy);
      await t.endTurn(); await t.endTurn(); await t.endTurn();
      R.check('Cloud Pillow beim Spielen: ein Angebot; das Auslaufen des Buffs über die Zugwechsel: keines mehr', n0 === 1 && S.angebote(t).length === 1 && ziel && !ziel.counters.buffs?.cloudy, { n0, n: S.angebote(t).length, buff: ziel && ziel.counters.buffs });
    }
    {
      const { t } = await frisch();
      const stolen = t.engine.cardInstances.find(c => c.zone === 'support' && (c.controller ?? c.owner) === o);
      t.engine.actionStealCreature(m, stolen, { sourceName: 'Probe' });   // synchroner Rohweg (Spy/Aligning Goals-Muster): keine Frage
      t.reset(); S.skript(t, 'ja', m);
      await t.endTurn(); await t.endTurn();
      R.check('Rückgabe einer gestohlenen Kreatur am Zugende: kein Angebot', S.angebote(t).length === 0, S.angebote(t).length);
    }

    R.section(`Monia Sitz ${m} · dauerhafte Aura: The Sun Sword (Ausrüstung) fragt nicht`);
    {
      const { t } = await frisch({ handO: ['The Sun Sword'] });
      await t.play(o, 'The Sun Sword', { hero: 0 });
      R.check('The Sun Sword wird ausgerüstet: kein Angebot', S.angebote(t).length === 0, S.angebote(t).length);
    }
  }
  R.finish();
})().catch(e => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(2); });
