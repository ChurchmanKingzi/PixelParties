'use strict';
// A04-cute-30 (B) · Swagdri: eine so ausgerüstete Ausrüstung wird beim späteren Weggang NICHT gelöscht, sondern abgelegt
//
// Kartentext (Swagdri): "… you may immediately play it without paying its Cost as if it was part of your hand. If you do, delete the Artifact if it would be sent to the discard pile."
// Erwartung: Cute Crown (Equipment), über Swagdri ausgerüstet, landet beim Verlassen des Bretts im GELÖSCHT-Stapel (die Absicht steht im Skript: `placed.inst._swagdriRouteToDelete = true`).
// Beobachtet: bei Zerstörung (`actionDestroyCard`), Verschieben in die Ablage (`actionMoveCard`) und Tod des Trägers liegt die Crown in der ABLAGE; die Marke wird nirgends gelesen.
// Gegenprobe: ein Nicht-Equipment-Artifact (Golden Bananas, -03) wird gelöscht ✓.
// Ursache: `swagdri-forger-of-coolness.js:169` setzt `_swagdriRouteToDelete`, `grep -rn _swagdriRouteToDelete cards/effects` findet keinen Leser (kein Hook, keine Engine-Stelle).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const SG = 'Swagdri, Forger of Coolness', CR = 'Cute Crown', W = 'Wowhalla, the Hall of the Cool';
  const wege = {
    'actionMoveCard -> discard': (t, inst) => t.run(() => t.engine.actionMoveCard(inst, 'discard')),
    'actionDestroyCard': (t, inst) => t.run(() => t.engine.actionDestroyCard({ name: 'T', owner: 1 }, inst)),
    'Träger stirbt': (t) => t.run(() => t.engine.actionDealDamage({ name: 'T', owner: 1 }, t.hero(0, 0), 5000, 'creature')),
  };
  for (const [n, fn] of Object.entries(wege)) {
    const t = await H.fresh({ deck: [Array(8).fill(H.INERT.creature), Array(8).fill(H.INERT.creature)] });
    t.putArea(0, W);
    const ps = t.gs.players[0]; ps.coolnessStack.push(CR); t.engine._trackCard(CR, 0, 'coolnessStack');
    const sw = t.put(0, 1, 0, SG); sw.turnPlayed = 0;
    t.targetFn = (v) => { const e = v.find(x => x.type === 'hero' && x.owner === 0 && x.heroIdx === 0); return e ? [e.id] : null; };
    t.gs.activePlayer = 0; t.phase(2);
    await t.activateCreature(0, 1, 0);
    const crown = t.find(CR, 'support');
    R.check(n + ': Vorbedingung – Crown über Swagdri ausgerüstet', !!crown);
    await fn(t, crown);
    R.check(n + ': Cute Crown liegt im Gelöscht-Stapel (nicht in der Ablage)', t.pile(0, 'deletedPile').includes(CR) && !t.pile(0, 'discardPile').includes(CR), { abl: t.pile(0, 'discardPile').slice(), del: t.pile(0, 'deletedPile').slice() });
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
