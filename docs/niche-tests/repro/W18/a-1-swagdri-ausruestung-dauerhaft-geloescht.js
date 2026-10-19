'use strict';
// W18a · Punkt 1 · Al, 19.10.2026 (A04-30 Swagdri): „Ja, deleten." Die Klausel „delete the Artifact if it would be sent to the discard pile"
//   gilt DAUERHAFT: eine von Swagdri ausgespielte Ausrüstung wird gelöscht (Gelöscht-Stapel ihres Besitzers), wann immer sie in die Ablage ginge
//   (zerstört, verschoben, Träger stirbt, Kosten/Opfer …). Gegenproben: Ausrüstung ohne Swagdri → Ablage; auf die Hand zurückgeholt und normal
//   gespielt → wieder normal (Ablage); fremde Zerstörung (Gegner) → gelöscht beim Besitzer (Sitz 0).
// Erwartet: Exit 0 = korrekt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const SG = 'Swagdri, Forger of Coolness', CR = 'Cute Crown', W = 'Wowhalla, the Hall of the Cool';
  const bau = async () => {
    const t = await H.fresh({ deck: [Array(8).fill(H.INERT.creature), Array(8).fill(H.INERT.creature)] });
    t.putArea(0, W);
    const ps = t.gs.players[0]; ps.coolnessStack.push(CR); t.engine._trackCard(CR, 0, 'coolnessStack');
    const sw = t.put(0, 1, 0, SG); sw.turnPlayed = 0;
    t.targetFn = (v) => { const e = v.find(x => x.type === 'hero' && x.owner === 0 && x.heroIdx === 0); return e ? [e.id] : null; };
    t.gs.activePlayer = 0; t.phase(2);
    await t.activateCreature(0, 1, 0);
    return t;
  };
  const stapel = (t, s, n) => ({ abl: t.pile(s, 'discardPile').filter(x => x === n).length, del: t.pile(s, 'deletedPile').filter(x => x === n).length });
  const sauber = (t, was) => R.check(`${was}: keine Engine-Fehler / Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  const wege = {
    'actionMoveCard -> discard': (t, inst) => t.run(() => t.engine.actionMoveCard(inst, 'discard')),
    'actionDestroyCard (Gegner)': (t, inst) => t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: 1 }, inst)),
    'actionDestroyCard (eigene Quelle)': (t, inst) => t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: 0 }, inst)),
    'Träger stirbt': (t) => t.run(() => t.engine.actionDealDamage({ name: 'T', owner: 1 }, t.hero(0, 0), 5000, 'creature')),
  };
  R.section('Swagdri-Ausrüstung verlässt das Brett → gelöscht');
  for (const [n, fn] of Object.entries(wege)) {
    const t = await bau();
    const crown = t.find(CR, 'support');
    R.check(n + ': Vorbedingung – Crown über Swagdri ausgerüstet', !!crown);
    await fn(t, crown);
    const s = stapel(t, 0, CR);
    R.check(n + ': genau 1x im Gelöscht-Stapel von Sitz 0, nicht in der Ablage', s.del === 1 && s.abl === 0, s);
    R.check(n + ': nicht in der Ablage/Gelöscht des Gegners', stapel(t, 1, CR).abl === 0 && stapel(t, 1, CR).del === 0);
    sauber(t, n);
  }

  R.section('Gegenprobe: Crown ohne Swagdri geht in die Ablage');
  for (const [n, fn] of Object.entries(wege)) {
    const t = await H.fresh();
    t.put(0, 0, 0, CR);
    const crown = t.find(CR, 'support');
    await fn(t, crown);
    const s = stapel(t, 0, CR);
    R.check(n + ': normale Crown liegt in der Ablage, nicht gelöscht', s.abl === 1 && s.del === 0, s);
    sauber(t, 'Gegenprobe ' + n);
  }

  R.section('Rückkehr auf die Hand beendet die Klausel (erneutes normales Ausspielen)');
  {
    const t = await bau();
    const crown = t.find(CR, 'support');
    await t.run(() => t.engine.actionMoveCard(crown, 'hand'));
    R.check('Crown zurück auf der Hand von Sitz 0', t.pile(0, 'hand').includes(CR), t.pile(0, 'hand'));
    await t.play(0, CR);
    const c2 = t.find(CR, 'support');
    R.check('normal erneut ausgerüstet', !!c2);
    await t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: 1 }, c2));
    const s = stapel(t, 0, CR);
    R.check('nun normal: Ablage, nicht gelöscht', s.abl === 1 && s.del === 0, s);
    sauber(t, 'Hand-Rückkehr');
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
