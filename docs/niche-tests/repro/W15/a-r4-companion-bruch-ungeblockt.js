'use strict';
// W15a · R4 (Rückfrage 4 aus W14a) · Al, 16.10.2026: „Soll ein Companion-Bruch (Bonded Companion geht, Held wird besiegt) von Resistance NICHT geblockt werden?" — „Nicht geblockt ist korrekt."
// Erwartet: Verlässt ein Bonded Companion das Brett (zerstört, auf die Hand zurück …), wird sein Held besiegt — auch mit Resistance Lv3 (Eigenfolge der Bindung, kein Effekt gegen den Helden).
//   Gegenprobe: ein echter Insta-Kill gegen denselben Resistance-Helden prallt dagegen ab (a-q6). Exit 0 = korrekt.
const H = require('../../lib/h.js');
const wait = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const R = H.runner();
  const RES = (lv) => Array(lv).fill('Resistance');
  const NAMEN = ['Bonded Companion Humby', 'Bonded Companion Mellvy', 'Bonded Companion Orphy', 'Bonded Companion Thuly'];

  R.section('Companion geht vom Brett — der Resistance-Held wird trotzdem besiegt');
  for (const nm of NAMEN) {
    for (const [weg, aktion] of [
      ['zerstört', (t, c) => t.engine.actionDestroyCard({ name: 'x', owner: 1, heroIdx: 0 }, c)],
      ['auf die Hand zurück', (t, c) => t.engine.actionMoveCard(c, 'hand', -1, -1, { source: 'Test', sourceOwner: 0 })],
    ]) {
      for (const [label, lv, soll] of [['Resistance Lv3', 3, false], ['ohne Resistance (Kontrolle)', 0, false]]) {
        const t = await H.fresh({ hp: 500 });
        if (lv) t.setAbilities(0, 0, [RES(lv), [], []]);
        const c = t.put(0, 0, 0, nm); c.turnPlayed = 1;
        await t.run(() => aktion(t, c));
        await wait(150);
        const lebt = t.hero(0, 0).hp > 0;
        R.check(`${nm.replace('Bonded Companion ', '')} ${weg}, ${label}: Held 0 wird besiegt (Bindung bricht)`, lebt === soll, { hp: t.hp(0, 0) });
        R.check(`${nm.replace('Bonded Companion ', '')} ${weg}, ${label}: die anderen Helden unberührt, keine Engine-Fehler`, t.hp(0, 1) === 500 && t.hp(0, 2) === 500 && t.errors.length === 0, { e: t.errors, h1: t.hp(0, 1) });
      }
    }
  }

  R.section('Gegenprobe: ein echter Insta-Kill gegen denselben Resistance-Helden prallt ab');
  {
    const t = await H.fresh({ hp: 500 });
    t.setAbilities(0, 0, [RES(3), [], []]);
    t.put(0, 0, 0, 'Bonded Companion Humby').turnPlayed = 1;
    await t.run(() => t.engine.actionDefeatHero({ name: 'Test Source', owner: 1, controller: 1, heroIdx: 0 }, t.hero(0, 0), { reason: 'Test' }));
    R.check('Insta-Kill ohne Schaden: Resistance blockt, Held lebt', t.hero(0, 0).hp > 0, t.hp(0, 0));
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
