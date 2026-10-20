'use strict';
// W20c · Frage 2 · Al, 20.10.2026 (Bestätigung): Controlled Attack („Choose a Hero your opponent controls. You may use that Hero's Abilities and active effect this turn as if you controlled it.
// This counts as an additional Action.“) — „Soll der Besitzer dieses Helden währenddessen weiter Zauber und Attacken mit ihm wirken?“ — „Ja, der Hero selbst bleibt ja bei seinem Besitzer.“
//
// Ist-Zustand bestätigt: die Marke `controlledBy` verschiebt NUR Abilities und aktiven Heldeneffekt zum Controlled-Attack-Spieler, NICHT die Kontrolle über den Helden (`heroSideOf` ignoriert sie):
//   • der BESITZER wirkt weiter Zauber, Attacken UND Kreaturen mit dem Helden (W20a/W20c gelten nur für Charme/Golden Apple/Love Shot/Styx/Paraseed … = `charmedBy`/`permaControlBy`);
//   • der Controlled-Attack-Spieler nutzt Abilities und aktiven Effekt, wirkt aber keine Zauber/Attacken und beschwört nichts mit dem Helden;
//   • Reaktionen (W20c Frage 1) wirkt weiter der Besitzer, nicht der Controlled-Attack-Spieler.
// Aufbau: Sitz 1 wirkt Controlled Attack auf den Helden 0:0 (Tharx, the Never-Losing General — aktiver Effekt: „Draw as many cards as you control Creatures that were not summoned this turn“; Destruction Magic 2, Fighting 2). Exit 0 = korrekt.
const H = require('../../lib/h.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const THARX = 'Tharx, the Never-Losing General';
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;

(async () => {
  const R = H.runner();
  const aufbau = async () => {
    const t = await H.fresh({
      heroes: [[THARX, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null],
      hand: [['Fireball', 'Attack', 'ZZ Dummy', 'ZZ Dummy'], ['Controlled Attack', 'Fireball', 'Attack', 'ZZ Dummy']],
      deckSize: 30, active: 1, gold: [100, 100],
      abilities: { 0: { 0: [['Destruction Magic', 'Destruction Magic'], ['Fighting', 'Fighting'], []] } },
    });
    t.targetFn = (valid) => { const h = valid.find(x => x.id === 'hero-0-0'); return [(h || valid[0]).id]; };
    t.put(1, 1, 0, 'ZZ Dummy').turnPlayed = 1; t.put(1, 2, 0, 'ZZ Dummy').turnPlayed = 1;   // zwei ältere Kreaturen des Controlled-Attack-Spielers
    t.put(0, 1, 2, 'ZZ Dummy').turnPlayed = 1;   // eine ältere Kreatur des Besitzers (Tharx' Bereitschaft liest die Kreaturen seines Besitzers)
    const r = await t.play(1, 'Controlled Attack', { hero: 0 });
    return { t, r };
  };

  R.section('Controlled Attack: Sitz 1 steuert Abilities und aktiven Effekt des Helden 0:0');
  const { t, r } = await aufbau();
  const hero = t.gs.players[0].heroes[0];
  R.check('Controlled Attack gespielt, Marke controlledBy = 1 am Helden 0:0', r === true && hero.controlledBy === 1, [r, hero.controlledBy]);
  R.check('Kontrolle über den Helden bleibt beim Besitzer: heroSideOf(0, Held) = 0, kein charmedBy/permaControlBy', t.engine.heroSideOf(0, hero) === 0 && hero.charmedBy == null && hero.permaControlBy == null, [t.engine.heroSideOf(0, hero), hero.charmedBy, hero.permaControlBy]);

  R.section('Controlled-Attack-Spieler (Sitz 1): Abilities/Effekt ja — Zauber, Attacken, Kreaturen mit dem Helden nein');
  {
    const h1 = t.pile(1, 'hand');
    const sp = t.engine.validateActionPlay(1, 'Fireball', h1.indexOf('Fireball'), 0, ['Spell'], { charmedOwner: 0 });
    R.check('Fireball mit 0:0 (charmedOwner 0) wird abgelehnt', sp === null, !!sp);
    const at = t.engine.validateActionPlay(1, 'Attack', h1.indexOf('Attack'), 0, ['Attack'], { charmedOwner: 0 });
    R.check('„Attack“ mit 0:0 (charmedOwner 0) wird abgelehnt', at === null, !!at);
    const kr = t.engine.validateActionPlay(1, 'ZZ Dummy', h1.indexOf('ZZ Dummy'), 0, ['Creature'], { charmedOwner: 0 });
    R.check('Kreatur mit 0:0 (charmedOwner 0) wird abgelehnt', kr === null, !!kr);
    const ch = t.engine.getHeroPlayableCards(1).charmed || {};
    R.check('Spielbarkeitsliste des Controlled-Attack-Spielers enthält keine Karte über 0:0', !(ch[0] || []).length, ch);
    const ab = t.engine.getActivatableAbilities(1).filter(e => e.charmedOwner === 0 && e.heroIdx === 0);
    R.check('Abilities des Helden 0:0 stehen dem Sitz 1 zur Aktivierung bereit (Liste mit charmedOwner 0, falls aktivierbare Abilities vorhanden)', Array.isArray(ab), ab);
    // Aktiver Heldeneffekt „as if you controlled it“: die Liste des Controlled-Attack-Spielers enthält den Heldeneffekt von 0:0 (Eintrag mit `charmedOwner` = Brettseite 0)
    t.phase(2); t.resetActions(1);
    const he = t.engine.getActiveHeroEffects(1).filter(e => e.charmedOwner === 0 && e.heroIdx === 0);
    R.check('aktiver Effekt von Tharx steht dem Sitz 1 zur Aktivierung bereit (Eintrag mit charmedOwner 0)', he.length === 1 && he[0].heroName === THARX, he);
    R.check('keine Engine-Fehler, Zustand sauber', sauber(t), { e: t.errors, a: t.audit() });
  }

  R.section('Besitzer (Sitz 0) wirkt WEITER Zauber, Attacken und Kreaturen mit dem Helden 0:0');
  {
    t.gs.activePlayer = 0; t.phase(3); t.resetActions(0); t.reset();
    R.check('0:0 steht noch unter Controlled Attack (Marke bleibt bis Zugende)', t.gs.players[0].heroes[0].controlledBy === 1, t.gs.players[0].heroes[0].controlledBy);
    const own = t.engine.getHeroPlayableCards(0).own[0] || [];
    R.check('Spielbarkeitsliste des Besitzers für 0:0 enthält Fireball, Attack und die Kreatur', ['Fireball', 'Attack', 'ZZ Dummy'].every(n => own.includes(n)), own);
    t.targetFn = (valid) => { const h = valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 1); return [(h || valid[0]).id]; };
    const hp = t.hp(1, 1);
    const rF = await t.play(0, 'Fireball', { hero: 0, noGrant: true });
    R.check('Besitzer wirkt Fireball mit 0:0 (−150 auf 1:1)', rF === true && t.hp(1, 1) === hp - 150, [rF, hp, t.hp(1, 1)]);
    t.resetActions(0);
    const hp2 = t.hp(1, 1);
    const rA = await t.play(0, 'Attack', { hero: 0, noGrant: true });
    R.check('Besitzer spielt „Attack“ mit 0:0 (Schaden auf 1:1)', rA === true && t.hp(1, 1) < hp2, [rA, hp2, t.hp(1, 1)]);
    t.resetActions(0);
    const rK = await t.play(0, 'ZZ Dummy', { hero: 0, slot: 1, noGrant: true });
    R.check('Besitzer beschwört eine Kreatur mit 0:0', rK === true && (t.gs.players[0].supportZones[0][1] || []).includes('ZZ Dummy'), [rK, t.gs.players[0].supportZones[0]]);
    R.check('keine Engine-Fehler, Zustand sauber', sauber(t), { e: t.errors, a: t.audit() });
  }

  R.section('Reaktionen über den Helden wirkt weiter der Besitzer (nicht der Controlled-Attack-Spieler)');
  {
    const u = await H.fresh({ hand: [['Cure'], ['Cure', 'Controlled Attack']], deckSize: 30, active: 1, abilities: { 0: { 0: [['Support Magic'], [], []] } } });
    u.targetFn = (valid) => { const h = valid.find(x => x.id === 'hero-0-0'); return [(h || valid[0]).id]; };
    await u.play(1, 'Controlled Attack', { hero: 0 });
    u.setAbilities(1, 1, [['Support Magic'], [], []]);
    const bes = u.engine.reaktionsWirkerFuer(0, 'Cure', null, { spellInHand: true }).map(x => `${x.seite}:${x.heroIdx}`);
    const ctl = u.engine.reaktionsWirkerFuer(1, 'Cure', null, { spellInHand: true }).map(x => `${x.seite}:${x.heroIdx}`);
    R.check('Besitzer (Sitz 0): Wirker für Cure = sein Held 0:0', bes.includes('0:0'), bes);
    R.check('Controlled-Attack-Spieler (Sitz 1): 0:0 ist KEIN Wirker (nur sein eigener Held 1:1)', !ctl.includes('0:0') && ctl.includes('1:1'), ctl);
  }
  R.finish();
})().catch(e => { process.stdout.write('AUSNAHME ' + (e && e.stack) + '\n'); process.exit(1); });
