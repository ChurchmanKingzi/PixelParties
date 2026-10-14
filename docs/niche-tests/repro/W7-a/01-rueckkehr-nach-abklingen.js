'use strict';
// W7-a/01 · Welle 7 (Al, 14.10.2026): „Freeze, Stun und Negated unterbrechen alle laufenden passiven Effekte" — und sie
// kehren zurück, sobald der Zustand abklingt. Geprüft: The Thing in the Ship (Sperre), Gigantisaur King Trex (Stufen-Stempel),
// Water Golem (Negierung des Ziels), Paraseed (Gift), Ghazma (Löschen besiegter Kreaturen).
// Aufruf: node docs/niche-tests/repro/W7-a/01-rueckkehr-nach-abklingen.js   (Exit 1 = Fehler tritt auf)
const H = require('../../lib/h.js');
const wait = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const R = H.runner();

  // ── The Thing in the Ship: gefroren -> keine Sperre; nach Abklingen wieder gesperrt ──
  {
    const t = await H.fresh({});
    const inst = t.put(1, 0, 0, 'The Thing in the Ship');
    R.check('Thing: Sperre aktiv', t.engine.abilityActivationBlocked() === true);
    await t.engine.applyCreatureStatus(inst, 'frozen', { sourceOwner: 0 });
    R.check('Thing gefroren: Sperre ruht', t.engine.abilityActivationBlocked() === false);
    for (let i = 0; i < 4 && t.engine.isCreatureEffectSuppressed(inst); i++) await t.endTurn();
    R.check('Thing: Frost abgeklungen', !t.engine.isCreatureEffectSuppressed(inst), inst.counters);
    R.check('Thing nach Abklingen: Sperre wieder aktiv', t.engine.abilityActivationBlocked() === true);
    R.check('Thing: keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  // ── King Trex: betäubt -> Spinor nicht spielbar; Stempel bleibt liegen und gilt nach Abklingen wieder ──
  {
    const t = await H.fresh({ hand: [['Gigantisaur Spinor'], []], deckSize: 10 });
    const cd = H.DB['Gigantisaur Spinor'];
    const trex = t.put(0, 0, 0, 'Gigantisaur King Trex'); trex.turnPlayed = 1;
    await t.engine.runHooks('onPlay', { _onlyCard: trex, playedCard: trex, zone: 'support', cardZone: 'support' });
    R.check('Trex: Spinor ohne Schule spielbar', t.engine.heroMeetsLevelReq(0, 1, cd) === true);
    await t.engine.applyCreatureStatus(trex, 'stunned', { sourceOwner: 1 });
    R.check('Trex betäubt: Spinor nicht spielbar', t.engine.heroMeetsLevelReq(0, 1, cd) === false);
    R.check('Trex betäubt: effektive Stufe wieder 3', t.engine.effectiveCardLevel(cd, 0, { heroIdx: 1 }) === 3, t.engine.effectiveCardLevel(cd, 0, { heroIdx: 1 }));
    for (let i = 0; i < 4 && t.engine.isCreatureEffectSuppressed(trex); i++) await t.endTurn();
    R.check('Trex nach Abklingen: Spinor wieder spielbar', t.engine.heroMeetsLevelReq(0, 1, cd) === true);
    R.check('Trex: keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  // ── Water Golem: gefroren -> Ziel nicht mehr negiert; nach Abklingen (Zugbeginn) wieder negiert ──
  {
    const t = await H.fresh({});
    t.grantFor(0, 0, 'Water Golem');
    t.putSurprise(0, 0, 'Water Golem');
    const gw = t.putSurprise(0, 1, 'Glass Wall');
    t.targetFn = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0); return v ? [v.id] : null; };
    await t.run(() => t.engine.actionMoveCard(gw, 'discard', -1, -1, { source: 'Test', sourceOwner: 1 }));
    const g = t.find('Water Golem', 'support');
    R.check('Golem: Ziel negiert', !!g && !!t.hero(1, 0).statuses.negated);
    await t.engine.applyCreatureStatus(g, 'frozen', { sourceOwner: 1 });
    await wait(100);
    R.check('Golem gefroren: Ziel nicht mehr negiert', !t.hero(1, 0).statuses.negated, Object.keys(t.hero(1, 0).statuses));
    for (let i = 0; i < 4 && t.engine.isCreatureEffectSuppressed(g); i++) await t.endTurn();
    await wait(100);
    R.check('Golem nach Abklingen: Ziel wieder negiert', !!t.hero(1, 0).statuses.negated, Object.keys(t.hero(1, 0).statuses));
    R.check('Golem: keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  // ── Paraseed: gefroren -> kein Gift; nach Abklingen wieder vergiftet; fremdes Gift bleibt ──
  {
    const { syncAllParaseedPoison } = require('../../../../cards/effects/_paraseed-shared.js');
    const t = await H.fresh({ hp: 800 });
    const p = t.put(1, 0, 0, 'Paraseed'); p.controller = 0; p.turnPlayed = 1;
    await t.run(() => syncAllParaseedPoison(t.engine));
    R.check('Paraseed: Wirt vergiftet', !!t.hero(1, 0).statuses.poisoned);
    await t.engine.applyCreatureStatus(p, 'frozen', { sourceOwner: 0 });
    await wait(100);
    R.check('Paraseed gefroren: Gift weg', !t.hero(1, 0).statuses.poisoned, t.hero(1, 0).statuses);
    for (let i = 0; i < 4 && t.engine.isCreatureEffectSuppressed(p); i++) await t.endTurn();
    await t.run(() => syncAllParaseedPoison(t.engine));
    R.check('Paraseed nach Abklingen: Wirt wieder vergiftet', !!t.hero(1, 0).statuses.poisoned, t.hero(1, 0).statuses);
    R.check('Paraseed: keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {
    // fremdes Gift (nicht von der Paraseed) bleibt, wenn die Paraseed stillgelegt wird
    const { syncAllParaseedPoison } = require('../../../../cards/effects/_paraseed-shared.js');
    const t = await H.fresh({ hp: 800 });
    await t.engine.addHeroStatus(1, 0, 'poisoned', { appliedBy: 0, duration: 5 });
    const p = t.put(1, 0, 0, 'Paraseed'); p.controller = 0; p.turnPlayed = 1;
    await t.engine.applyCreatureStatus(p, 'frozen', { sourceOwner: 0 });
    await t.run(() => syncAllParaseedPoison(t.engine));
    R.check('Paraseed gefroren: bereits vorhandenes fremdes Gift bleibt', !!t.hero(1, 0).statuses.poisoned && !t.hero(1, 0).statuses.poisoned._paraseed, t.hero(1, 0).statuses);
  }

  // ── Ghazma: gefroren -> Kreaturen werden nicht gelöscht; sonst gelöscht ──
  for (const st of [null, 'frozen', 'stunned', 'negated']) {
    const t = await H.fresh({ heroes: [['Ghazma, the Worm Feeder', H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null] });
    if (st) t.heroStatus(0, 0, st);
    const opfer = t.put(1, 0, 0, H.INERT.frail);
    await t.engine.actionDestroyCard({ name: 'T', owner: 0 }, opfer);
    const geloescht = t.pile(1, 'deletedPile').length > 0;
    R.check(`Ghazma ${st || 'gesund'}: ${st ? 'Kreatur landet in der Ablage' : 'Kreatur wird gelöscht'}`, st ? !geloescht && t.pile(1, 'discardPile').length > 0 : geloescht, { del: t.pile(1, 'deletedPile'), dis: t.pile(1, 'discardPile') });
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
