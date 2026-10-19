'use strict';
// H04-18 · True Fairy Crestina: der Vorrat bleibt beim BESITZER, obwohl der Dieb Crestina kontrolliert  [Stufe B]
//
// Kartentext: „While you control this Hero, you may play cards placed by this effect as if they were part of your hand."
//             „During your Resource Phase, you may skip drawing your card for the turn and instead search any card from your deck and place it next to you face-up."
// Erwartung: Wer Crestina kontrolliert (der Dieb), darf seine Vorratskarten spielen; der Besitzer, der sie nicht mehr kontrolliert, nicht.
// Beobachtet: `isCreationZoneUsable(pi)` (_engine.js ~Z. 19817) sucht Crestina nur in `ps.heroes` von pi (Brettseite = Besitzer).
//   - Besitzer spielt nach dem Diebstahl weiter aus seinem Vorrat (✗),
//   - der Dieb sucht in SEINER Resource Phase (verliert dafür den Zug), kann die Karte aber NIE spielen (✗) – sie liegt in seinem Vorrat fest.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const TF = 'True Fairy Crestina, the Primordial Goddess';
  const heroes = [[TF, 'Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker']];
  const tgt = (owner, hi) => (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === owner && x.heroIdx === hi); return v ? [v.id] : null; };
  const mk = async () => {
    const t = await H.fresh({ heroes, hand: [[], []], deck: [['Fireball', 'Icebolt', 'Heal', H.INERT.filler], ['Fireball', 'Heal', H.INERT.filler, H.INERT.filler, H.INERT.filler, H.INERT.filler]] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    return t;
  };
  // (a) Besitzer nach Diebstahl
  let t = await mk();
  t.gs.players[0].creationZone = ['Fireball']; t.engine._trackCard('Fireball', 0, 'creationZone', -1, 0);
  t.grantFor(0, 1, 'Fireball'); t.targetFn = tgt(1, 0);
  await t.run(() => t.engine.actionStealHero(1, 0, 0));
  t.gs.activePlayer = 0; t.gs.currentPhase = 3; t.gs.players[0]._actionsThisTurn = 0;
  const b = t.hp(1, 0);
  await t.run(() => t.host.doPlaySpell(t.room, 0, { cardName: 'Fireball', handIndex: 0, heroIdx: 1, fromCreation: true }));
  R.check('(a) Besitzer darf den Vorrat nicht mehr nutzen, solange Crestina gestohlen ist', t.hp(1, 0) === b, { schaden: b - t.hp(1, 0), controller: t.hero(0, 0).controller ?? t.hero(0, 0).charmedBy });
  // (b) Dieb sucht und spielt
  t = await mk();
  await t.run(() => t.engine.actionStealHero(1, 0, 0));
  t.script.push({ match: d => d.type === 'confirm' && d.title === TF, answer: () => ({ confirmed: true }) });
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === TF, answer: () => ({ cardName: 'Fireball' }) });
  t.gs.activePlayer = 1; t.gs.currentPhase = 1; t.gs._skipResourceDraw = false; t.gs._resourcePhaseLocked = false;
  await t.run(() => t.engine.runHooks('onPhaseStart', { phase: 'Resource', phaseIndex: 1 }));
  t.grantFor(1, 1, 'Fireball'); t.targetFn = tgt(0, 1);
  t.gs.currentPhase = 3; t.gs.players[1]._actionsThisTurn = 0;
  const b2 = t.hp(0, 1);
  // W16f: Messfehler behoben - der Vorrat wird VOR dem Ausspielen gelesen (nach erfolgreichem Spielen ist die Karte verbraucht, der Vorrat leer).
  const vorratVorSpiel = t.gs.players[1].creationZone.slice();
  const r = await t.run(() => t.host.doPlaySpell(t.room, 1, { cardName: 'Fireball', handIndex: 0, heroIdx: 1, fromCreation: true }));
  R.check('(b) Dieb hat gesucht (Vorrat belegt, Zug verzichtet)', vorratVorSpiel.length === 1 && t.gs._skipResourceDraw === true, vorratVorSpiel);
  R.check('(b) Dieb kann die gesuchte Vorratskarte spielen', r === true && t.hp(0, 1) < b2, { r, schaden: b2 - t.hp(0, 1), usable: t.engine.isCreationZoneUsable(1) });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
