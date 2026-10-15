'use strict';
// W8/08 · Nachtrag 2 Welle 8 (Al, 15.10.2026, Bonded Companion Zonensperre): „Ja, die darf ruhen. Aber sobald der Freeze/Stun/Negate
// endet, muss der Companion mit exakt dem Hero gelinkt werden, in dessen Zone er ist! Ist dort kein oder ein toter Hero, bleibt er
// bei 0 HP und stirbt sofort." Aufbau: Companion wird still gesetzt, bei ruhender Zonensperre in eine andere Spalte verschoben,
// der Zustand endet -> HP-Pool/Abgang hängen am Helden der NEUEN Spalte; steht dort kein lebender Held, stirbt er sofort.
// Aufruf: node docs/niche-tests/repro/W8/08-bonded-companion-neu-verknuepfen.js   (Exit 1 = Fehler tritt auf)
const H = require('../../lib/h.js');
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const NAMEN = ['Bonded Companion Humby', 'Bonded Companion Mellvy', 'Bonded Companion Orphy', 'Bonded Companion Thuly'];
const ZUST = [['gefroren', 'frozen'], ['betäubt', 'stunned'], ['negiert', 'negated']];
async function still(t, c, st) {
  if (st === 'negated') await t.engine.actionNegateCreature(c, 'Test');
  else await t.engine.applyCreatureStatus(c, st, { sourceOwner: 1 });
}
async function ende(t, c, st) {   // der Zustand endet: Zähler weg + Statusende-Hook (Weg der Engine bei Heilung/Ablauf)
  delete c.counters[st]; if (st === 'negated') { delete c.counters.negatedCleansable; }
  await t.run(() => t.engine.runHooks('onStatusRemoved', { target: c, status: st, statusName: st }));
  await wait(150);
}

(async () => {
  const R = H.runner();
  for (const nm of NAMEN) for (const [zn, st] of ZUST) {
    const tag = `${nm.replace('Bonded Companion ', '')} ${zn}`;
    // (a) in die Spalte eines lebenden Helden verschoben -> dort verknüpft
    { const t = await H.fresh({ hp: 500 });
      const c = t.put(0, 0, 0, nm); c.turnPlayed = 1;
      await still(t, c, st);
      await t.run(() => t.engine.actionMoveCard(c, 'support', 1, 0, { source: 'Test', sourceOwner: 0 }));
      R.check(`${tag}: bei ruhender Zonensperre in Spalte 1 verschoben`, c.heroIdx === 1 && c.zoneSlot === 0, { h: c.heroIdx, s: c.zoneSlot });
      await ende(t, c, st);
      R.check(`${tag}: nach dem Ende lebt der Companion in Spalte 1`, c.zone === 'support' && c.heroIdx === 1 && !t.pile(0, 'discardPile').includes(nm), { zone: c.zone, ablage: t.pile(0, 'discardPile') });
      await t.run(() => t.engine.actionDealCreatureDamage({ name: 'x', owner: 1, heroIdx: 0 }, c, 100, 'spell'));
      R.check(`${tag}: Pool hängt jetzt am Helden der neuen Spalte (Held 1: 500 -> 400, Held 0 unberührt)`, t.hp(0, 1) === 400 && t.hp(0, 0) === 500, { h0: t.hp(0, 0), h1: t.hp(0, 1) });
      R.check(`${tag}: keine Engine-Fehler`, t.errors.length === 0, t.errors); }
    // (b) in eine Spalte mit TOTEM Helden verschoben -> stirbt sofort, besiegt niemanden
    { const t = await H.fresh({ hp: 500 });
      const c = t.put(0, 0, 0, nm); c.turnPlayed = 1;
      await still(t, c, st);
      t.hero(0, 2).hp = 0;
      await t.run(() => t.engine.actionMoveCard(c, 'support', 2, 0, { source: 'Test', sourceOwner: 0 }));
      const dort = c.heroIdx === 2;
      R.check(`${tag}: in die Spalte des toten Helden verschoben`, dort, { h: c.heroIdx });
      if (dort) {
        R.check(`${tag}: vor dem Ende noch auf dem Brett`, c.zone === 'support');
        await ende(t, c, st);
        R.check(`${tag}: toter Held in der Spalte -> stirbt sofort (Ablage)`, c.zone !== 'support' && t.pile(0, 'discardPile').includes(nm), { zone: c.zone, ablage: t.pile(0, 'discardPile') });
        R.check(`${tag}: der ursprüngliche Held 0 bleibt unberührt`, t.hp(0, 0) === 500, t.hp(0, 0));
      }
      R.check(`${tag}: keine Engine-Fehler`, t.errors.length === 0, t.errors); }
  }
  // (c) Kontrolle: bleibt in der eigenen Spalte -> nach dem Ende weiter mit dem eigenen Helden verknüpft; Abgang besiegt ihn
  for (const [zn, st] of ZUST) {
    const t = await H.fresh({ hp: 500 });
    const c = t.put(0, 0, 0, 'Bonded Companion Humby'); c.turnPlayed = 1;
    await still(t, c, st); await ende(t, c, st);
    R.check(`Humby ${zn}, Kontrolle: lebt weiter`, c.zone === 'support', c.zone);
    await t.run(() => t.engine.actionDealCreatureDamage({ name: 'x', owner: 1, heroIdx: 0 }, c, 100, 'spell'));
    R.check(`Humby ${zn}, Kontrolle: Pool wirkt wieder (Held 500 -> 400)`, t.hp(0, 0) === 400, t.hp(0, 0));
    await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 1, heroIdx: 0 }, c));
    await wait(200);
    R.check(`Humby ${zn}, Kontrolle: sein Abgang besiegt den verknüpften Helden wieder`, t.hp(0, 0) <= 0, t.hp(0, 0));
    R.check(`Humby ${zn}, Kontrolle: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  // (d) echter Ablauf: Frost endet durch Zugwechsel (leises Abklingen holt der Zug-/Phasenbeginn nach)
  { const t = await H.fresh({ hp: 500 });
    const c = t.put(0, 0, 0, 'Bonded Companion Orphy'); c.turnPlayed = 1;
    await t.engine.applyCreatureStatus(c, 'frozen', { sourceOwner: 1, duration: 1 });
    t.hero(0, 2).hp = 0;
    await t.run(() => t.engine.actionMoveCard(c, 'support', 2, 0, { source: 'Test', sourceOwner: 0 }));
    for (let i = 0; i < 4 && c.zone === 'support'; i++) { await t.endTurn(); await wait(200); }
    R.check('Orphy (echter Frostablauf): nach dem Abklingen gestorben', c.zone !== 'support' && t.pile(0, 'discardPile').includes('Bonded Companion Orphy'), { zone: c.zone });
    R.check('Orphy (echter Frostablauf): keine Engine-Fehler', t.errors.length === 0, t.errors); }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
