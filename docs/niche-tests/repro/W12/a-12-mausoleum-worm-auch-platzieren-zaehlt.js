'use strict';
// W12a · Rückfrage 12 (Mausoleum Worm und Place-Effekte) · Al, 15.10.2026: „Ja, auch Place-Effekte sind davon limitiert/zählen ins Limit."
//   Mausoleum Worm: „You can only play 1 'Mausoleum Worm' per turn."
// Erwartet: Das Limit begrenzt auch Effekte, die einen Wurm aufs Brett PLATZIEREN (The Master's Key, Glorious Rebirth, jede Platzierung über `actionPlaceCreature`):
//   (a) ein Wurm, den ein Place-Effekt aufs Brett bringt, zählt ins Limit (kein Ablage-Angebot danach, kein zweiter Wurm von der Hand),
//   (b) nach dem ersten Wurm dieses Zuges sind weitere Place-Effekte gesperrt/nicht wählbar (der Effekt ist nicht spielbar oder platziert nichts, der Wurm bleibt, wo er ist),
//   (c) im nächsten eigenen Zug ist alles wieder frei, der Gegner hat sein eigenes Limit.
// Umsetzung: Skript-Vertrag `playLimitKey` an der Karte, Engine `_stempelEintrittsLimit` / `_eintrittsLimitErreicht` (`safePlaceInSupport`, `actionPlaceCreature`).
const H = require('../../lib/h.js');
const W = 'Mausoleum Worm', KEY = "The Master's Key";
const wuermer = (t) => t.inst(c => c.name === W && c.zone === 'support').length;
const zone = (t) => t.script.push({ match: d => d.type === 'zonePick', answer: d => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });
const toeteHeld = async (t, seat, hi) => { t.hero(seat, hi).hp = 50; await t.run(() => t.engine.actionDealDamage({ name: 'Fireball', owner: 1 - seat }, t.hero(seat, hi), 100, 'spell')); };
const key = (t) => t.script.push({ match: d => d.type === 'cardGallery' && d.title === KEY, answer: () => ({ cardName: W }) });
(async () => {
  const R = H.runner();

  R.section("(a) The Master's Key platziert den Wurm zuerst -> er zählt ins Limit (kein Ablage-Angebot nach einem Heldentod)");
  {
    const t = await H.fresh({ hand: [[KEY, W], []], discard: [[W], []], deckSize: 30, gold: 100 });
    zone(t); key(t);
    const r = await t.play(0, KEY, { hero: 0 });
    R.check("Key spielbar, Wurm von der Hand platziert", r === true && wuermer(t) === 1, { r, w: wuermer(t) });
    await toeteHeld(t, 0, 1);
    R.check('kein Ablage-Angebot des zweiten Wurms', t.prompts.filter(x => x.d.title === W).length === 0, t.prompts.map(x => x.d.title));
    R.check('weiterhin genau ein Wurm auf dem Brett, einer bleibt in der Ablage', wuermer(t) === 1 && t.gs.players[0].discardPile.includes(W), [wuermer(t), t.gs.players[0].discardPile]);
    R.check('die Engine meldet den Wurm als nicht beschwörbar/platzierbar', t.engine.isCreatureSummonable(W, 0, 2) === false && t.engine._eintrittsLimitErreicht(W, 0) === true);
    R.check('(a) keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }

  R.section('(b1) Wurm aus der Ablage zuerst -> The Master\'s Key ist nicht spielbar (Wurm nicht wählbar)');
  {
    const t = await H.fresh({ hand: [[KEY, W], []], discard: [[W], []], deckSize: 30, gold: 100 });
    zone(t); key(t);
    await toeteHeld(t, 0, 1);
    R.check('erster Wurm aus der Ablage platziert', wuermer(t) === 1, wuermer(t));
    const r = await t.play(0, KEY, { hero: 0 });
    R.check('Key abgelehnt, Wurm bleibt auf der Hand', r === false && t.gs.players[0].hand.includes(W) && wuermer(t) === 1, { r, hand: t.gs.players[0].hand, w: wuermer(t) });
    R.check('(b1) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('(b2) Wurm von der Hand zuerst -> Glorious Rebirth (Place vom Coolness Stack) ist nicht spielbar');
  {
    const t = await H.fresh({ hand: [[W, 'Glorious Rebirth'], []], deckSize: 30, gold: 100 });
    zone(t);
    t.setAbilities(0, 2, [Array(3).fill('Summoning Magic'), [], []]);
    t.putArea(0, 'Wowhalla, the Hall of the Cool');
    t.gs.players[0].coolnessStack.push(W); t.engine._trackCard(W, 0, 'coolnessStack');
    const r1 = await t.play(0, W, { hero: 2, slot: 0, noGrant: true });
    t.grantFor(0, 1, 'Glorious Rebirth');
    const r2 = await t.play(0, 'Glorious Rebirth', { hero: 1 });
    R.check('erster Wurm von der Hand gespielt', r1 === true && wuermer(t) === 1, { r1, w: wuermer(t) });
    R.check('Glorious Rebirth nicht spielbar, der Wurm bleibt oben auf dem Coolness Stack', r2 === false && t.gs.players[0].coolnessStack.includes(W) && wuermer(t) === 1, { r2, stack: t.gs.players[0].coolnessStack, w: wuermer(t) });
    R.check('(b2) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('(b3) Gegenprobe: ohne vorigen Wurm platziert Glorious Rebirth den Wurm vom Stack');
  {
    const t = await H.fresh({ hand: [['Glorious Rebirth'], []], deckSize: 30, gold: 100 });
    zone(t);
    t.putArea(0, 'Wowhalla, the Hall of the Cool');
    t.gs.players[0].coolnessStack.push(W); t.engine._trackCard(W, 0, 'coolnessStack');
    const r = await t.play(0, 'Glorious Rebirth', { hero: 1 });
    R.check('Wurm vom Coolness Stack platziert', r === true && wuermer(t) === 1 && !t.gs.players[0].coolnessStack.includes(W), { r, w: wuermer(t), stack: t.gs.players[0].coolnessStack });
    R.check('der Eintritt zählt: ein zweiter Wurm von der Hand ist jetzt gesperrt', t.engine._eintrittsLimitErreicht(W, 0) === true);
    R.check('(b3) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('(b4) jede Platzierung über actionPlaceCreature wird verweigert, sobald der erste Wurm des Zuges da ist');
  {
    const t = await H.fresh({ hand: [[W], []], discard: [[W], []], deckSize: 30, gold: 100 });
    t.setAbilities(0, 2, [Array(3).fill('Summoning Magic'), [], []]);
    const r1 = await t.play(0, W, { hero: 2, slot: 0, noGrant: true });
    const res = await t.run(() => t.engine.actionPlaceCreature(W, 0, 1, 0, { source: 'discard', sourceName: 'Test-Effekt' }));
    R.check('erster Wurm von der Hand', r1 === true && wuermer(t) === 1, { r1, w: wuermer(t) });
    R.check('Platzierung aus der Ablage verweigert (null), die Kopie bleibt in der Ablage', !res && wuermer(t) === 1 && t.gs.players[0].discardPile.includes(W), { res: !!res, w: wuermer(t), disc: t.gs.players[0].discardPile });
    R.check('Log nennt das Limit', t.lg('placement_blocked').some(l => l.reason === 'play_limit'), t.lg('placement_blocked'));
    R.check('(b4) keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });

    R.section('(c) nächster eigener Zug: wieder erlaubt; der Gegner hat sein eigenes Limit');
    await t.endTurn(); await t.endTurn();
    const res2 = await t.run(() => t.engine.actionPlaceCreature(W, 0, 1, 0, { source: 'discard', sourceName: 'Test-Effekt' }));
    R.check('im nächsten eigenen Zug platzierbar', !!res2 && wuermer(t) === 2, { res2: !!res2, w: wuermer(t) });
    R.check('Limit des Gegners unberührt', t.engine._eintrittsLimitErreicht(W, 1) === false);
    R.check('(c) keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
