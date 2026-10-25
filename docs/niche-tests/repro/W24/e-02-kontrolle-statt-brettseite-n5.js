'use strict';
// W24e · N5-01 / N5-03 / N5-08 (Kontrolle statt Brettseite) – Ergänzungen zu den Befund-Repros:
//  Treacherous Crystal: eine Kreatur der Gegenseite, die der Aktivierer SELBST kontrolliert, wird nicht „übernommen" (er kontrolliert sie schon);
//  Gigantisaur „1 pro Held": ein geliehener (gecharmter) Gegnerheld mit Gigantisaur des Gegners in seiner Zone sperrt die zweite, die erste ist erlaubt;
//  Controlled Attack: der vom Wirker kontrollierte Gegnerheld (Charme) ist KEIN Ziel.
// Aufruf: node docs/niche-tests/repro/W24/e-02-kontrolle-statt-brettseite-n5.js   (Exit 0 = korrekt)
const fs = require('fs'), path = require('path');
const H = require('../../lib/h.js');
const ROOT = path.resolve(__dirname, '../../../..');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function ladeTrigger() {
  const src = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const i = src.indexOf('async function doTriggerTreacherousCrystal(room, pi) {');
  let depth = 0, k = src.indexOf('{', i);
  for (; k < src.length; k++) { if (src[k] === '{') depth++; else if (src[k] === '}') { depth--; if (depth === 0) break; } }
  const fn = new Function('require', 'opponentOfGs', 'roomPlayerCount', 'sendGameState', 'sendSpectatorGameState', src.slice(i, k + 1) + '\nreturn doTriggerTreacherousCrystal;');
  return fn((p) => require(p.startsWith('./') ? path.join(ROOT, p) : p), (gs, pi) => (pi === 0 ? 1 : 0), () => 2, () => {}, () => {});
}
(async () => {
  const R = H.runner();
  const trig = ladeTrigger();
  for (const seat of [0, 1]) {
    const opp = 1 - seat;
    R.section(`Sitz ${seat}`);
    {   // Treacherous Crystal: Halter = opp, Aktivierer = seat
      const hand = [[], []]; hand[opp] = ['Treacherous Crystal'];
      const t = await H.fresh({ active: seat, hand });
      const meine = t.put(seat, 0, 0, H.INERT.creature);                                                          // gehört dem Aktivierer, steht bei ihm
      const seitenfremdMeine = t.put(opp, 0, 0, H.INERT.creature, { controller: seat, counters: { crossSideControlled: seat } });   // steht beim Halter, kontrolliert vom Aktivierer
      const halters = t.put(opp, 0, 1, H.INERT.creature);
      t.gs.activePlayer = seat;
      await trig(t.room, seat);
      await sleep(100);
      R.check('Kreatur des Halters wird übernommen', halters.controller === seat, { c: halters.controller });
      R.check('eigene Kreatur des Aktivierers bleibt unverändert (kein stolenBy)', meine.controller === seat && meine.stolenBy == null, { c: meine.controller, s: meine.stolenBy });
      R.check('seitenfremde, schon vom Aktivierer kontrollierte Kreatur wird nicht „gestohlen"', seitenfremdMeine.controller === seat && seitenfremdMeine.stolenBy == null, { c: seitenfremdMeine.controller, s: seitenfremdMeine.stolenBy });
      R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
    {   // Gigantisaur auf einem gecharmten Gegnerheld
      const hand = [[], []]; hand[seat] = ['Gigantisaur Triceras'];
      const t = await H.fresh({ active: seat, hand });
      await t.run(() => t.engine.actionStealHero(seat, opp, 0));
      await sleep(250);
      // Beschwörbarkeit der Zone des geliehenen Gegnerhelden 0 (Seite = opp, Beschwörer = seat) – direkt über den Beschwörbarkeits-Prüfer.
      const frei = t.engine.isCreatureSummonable('Gigantisaur Triceras', opp, 0, { beschwoerer: seat });
      t.put(opp, 0, 0, 'Gigantisaur Raptoren');                                  // steht in der Zone des (geliehenen) Gegnerhelden 0, kontrolliert vom Gegner
      const belegt = t.engine.isCreatureSummonable('Gigantisaur Triceras', opp, 0, { beschwoerer: seat });
      const andererHeld = t.engine.isCreatureSummonable('Gigantisaur Triceras', opp, 1, { beschwoerer: seat });
      R.check('Gegenprobe: geliehener Gegnerheld ohne Gigantisaur in der Zone: beschwörbar', frei === true, { frei });
      R.check('geliehener Gegnerheld mit Gigantisaur in seiner Zone: zweite Gigantisaur gesperrt', belegt === false, { belegt });
      R.check('anderer Gegnerheld (Zone leer): weiter beschwörbar', andererHeld === true, { andererHeld });
      R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
    {   // Controlled Attack: vom Wirker kontrollierter Gegnerheld ist kein Ziel
      const hand = [[], []]; hand[seat] = ['Controlled Attack'];
      const t = await H.fresh({ active: seat, hand });
      await t.run(() => t.engine.actionStealHero(seat, opp, 2));
      await sleep(250);
      let ang = null;
      t.targetFn = (v) => { ang = v.map(x => `${x.owner}:${x.heroIdx}`); return [v[0].id]; };
      await t.play(seat, 'Controlled Attack', { hero: 0 });
      R.check('vom Wirker gecharmter Gegnerheld 2 wird nicht angeboten, die anderen Gegnerhelden schon', ang && !ang.includes(`${opp}:2`) && ang.includes(`${opp}:0`) && ang.includes(`${opp}:1`), ang);
      R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
  }
  R.finish();
})();
