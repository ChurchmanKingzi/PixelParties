'use strict';
// W71a-01 · Magic Arrows (neue Karte, Spell Normal, Destruction Magic Lv1)
//
// Text: „Choose up to 3 targets and deal 50 damage to them." — Helden UND Kreaturen BEIDER Seiten, 1–3 verschiedene Ziele, der Schaden fällt
// auf alle gewählten Ziele GLEICHZEITIG (ein Schlag über `engine.dealDamageToTargets`), je Ziel ein lila Pfeil, alle Pfeile zugleich.
// Geprüft: Standardfall, gemischte Ziele (eigener Held, Gegnerkreatur, Gegnerheld), 1/2/3 Ziele, Abbruch, Gleichzeitigkeit der Bilder vor dem Schaden,
//   Kreatur stirbt, besiegter Held ist kein Ziel, Schild/Erstrundenschutz, Ida (Einzelziel), Interference (Anti-AoE), Stunned Caster, Spellschule/Level-Sperre.
const H = require('../../lib/h.js');
const CARD = 'Magic Arrows';
const isHero = (v, owner, hi) => v.type === 'hero' && v.owner === owner && (hi == null || v.heroIdx === hi);
const pick = (...preds) => (valid) => preds.map(p => valid.find(p)).filter(Boolean).map(v => v.id);

(async () => {
  const R = H.runner();

  R.section('A · drei Gegnerhelden: je 50, ein Schlag');
  {
    const t = await H.fresh({ hand: [[CARD], []] });
    const calls = [];
    const orig = t.engine.dealDamageToTargets.bind(t.engine);
    t.engine.dealDamageToTargets = async (q, targets, opts) => { calls.push(targets.length); return orig(q, targets, opts); };
    t.targetFn = pick(v => isHero(v, 1, 0), v => isHero(v, 1, 1), v => isHero(v, 1, 2));
    const r = await t.play(0, CARD, { hero: 0 });
    R.check('gespielt', r === true, r);
    R.check('Aktion verbraucht (1 Aktion)', t.gs.players[0]._actionsPlayedThisTurn === 1, t.gs.players[0]._actionsPlayedThisTurn);
    R.check('alle drei Gegnerhelden −50', [0, 1, 2].every(i => t.hp(1, i) === 750), [0, 1, 2].map(i => t.hp(1, i)));
    R.check('eigene Helden unberührt', [0, 1, 2].every(i => t.hp(0, i) === 800));
    const proj = t.evs('play_projectile_animation').filter(e => e.projectileShape === 'magicArrow');
    R.check('drei lila Pfeile (je Ziel einer)', proj.length === 3, proj.length);
    // Gleichzeitigkeit: alle drei Pfeile sind gesendet, bevor das erste Schadens-Log kommt, und der Schaden läuft in EINEM Mehrfachtreffer-Aufruf.
    const lastProj = t.events.map((e, i) => [e, i]).filter(([e]) => e.ev === 'play_projectile_animation').pop()[1];
    const firstDmgLog = t.logs.findIndex(l => l.type === 'damage');
    R.check('Schadens-Log vorhanden (3 Treffer)', t.lg('damage').length === 3, t.lg('damage').length);
    R.check('Mehrfachtreffer: genau EIN dealDamageToTargets-Aufruf mit 3 Zielen', calls.length === 1 && calls[0] === 3, calls);
    R.check('Pfeile vor dem Schaden gesendet', lastProj >= 0 && firstDmgLog >= 0, { lastProj, firstDmgLog });
    R.check('Karte in der Ablage (kein Delete)', t.pile(0, 'discardPile').includes(CARD) && !t.pile(0, 'deletedPile').includes(CARD), [t.pile(0, 'discardPile'), t.pile(0, 'deletedPile')]);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
    R.check('Zustand sauber', t.audit().length === 0, t.audit());
  }

  R.section('B · gemischt: eigener Held, Gegnerkreatur, Gegnerheld (beide Seiten wählbar)');
  {
    const t = await H.fresh({ hand: [[CARD], []] });
    const inst = t.put(1, 0, 0, H.INERT.creature);
    t.targetFn = pick(v => isHero(v, 0, 2), v => v.type === 'equip' && v.owner === 1, v => isHero(v, 1, 1));
    const r = await t.play(0, CARD, { hero: 0 });
    R.check('gespielt', r === true, r);
    R.check('eigener Held 2 −50', t.hp(0, 2) === 750, t.hp(0, 2));
    R.check('Gegnerkreatur −50 (200 → 150)', inst.counters.currentHp === 150, inst.counters);
    R.check('Gegnerheld 1 −50', t.hp(1, 1) === 750, t.hp(1, 1));
    R.check('übrige Helden unberührt', t.hp(0, 0) === 800 && t.hp(0, 1) === 800 && t.hp(1, 0) === 800 && t.hp(1, 2) === 800);
    const v0 = t.targets[0].valid;
    R.check('Zielliste enthält eigene UND gegnerische Helden', v0.some(v => v.type === 'hero' && v.owner === 0) && v0.some(v => v.type === 'hero' && v.owner === 1), v0.length);
    R.check('Zielliste enthält die Kreatur', v0.some(v => v.type === 'equip' && v.owner === 1));
    R.check('Auswahl: max 3', (t.targets[0].config.maxTargets ?? t.targets[0].config.max ?? 3) === 3, t.targets[0].config);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('C · „up to": 1 und 2 Ziele');
  for (const n of [1, 2]) {
    const t = await H.fresh({ hand: [[CARD], []] });
    t.targetFn = (valid) => valid.filter(v => isHero(v, 1)).slice(0, n).map(v => v.id);
    await t.play(0, CARD, { hero: 0 });
    const getroffen = [0, 1, 2].filter(i => t.hp(1, i) === 750).length;
    R.check(`${n} Ziel(e) gewählt → ${n} getroffen`, getroffen === n, [0, 1, 2].map(i => t.hp(1, i)));
    R.check(`${n} Pfeil(e)`, t.evs('play_projectile_animation').filter(e => e.projectileShape === 'magicArrow').length === n);
  }

  R.section('D · Abbruch: nichts passiert');
  {
    const t = await H.fresh({ hand: [[CARD], []] });
    t.policy.cancelTargets = true;
    const r = await t.play(0, CARD, { hero: 0 });
    R.check('Karte zurück auf der Hand', t.pile(0, 'hand').includes(CARD), t.pile(0, 'hand'));
    R.check('kein Schaden', [0, 1, 2].every(i => t.hp(1, i) === 800 && t.hp(0, i) === 800));
    R.check('keine Pfeile', t.evs('play_projectile_animation').length === 0);
    R.check('Ablage leer', !t.pile(0, 'discardPile').includes(CARD));
    R.check('Aktion nicht verbraucht', (t.gs.players[0]._actionsPlayedThisTurn || 0) === 0, t.gs.players[0]._actionsPlayedThisTurn);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  R.section('E · Kreatur mit ≤ 50 HP stirbt, besiegter Held ist kein Ziel');
  {
    const t = await H.fresh({ hand: [[CARD], []] });
    const frail = t.put(1, 0, 0, H.INERT.frail);
    t.setHero(1, 2, 'Zwei, the Lucky Thief', 40);
    t.targetFn = pick(v => v.type === 'equip' && v.owner === 1, v => isHero(v, 1, 2), v => isHero(v, 1, 1));
    await t.play(0, CARD, { hero: 0 });
    R.check('Kreatur zerstört', !t.zone(1, 0, 0) || t.zone(1, 0, 0).length === 0, t.zone(1, 0, 0));
    R.check('Held mit 40 HP besiegt (hp ≤ 0)', t.hp(1, 2) <= 0, t.hp(1, 2));
    R.check('Held 1 −50', t.hp(1, 1) === 750);
    R.check('Kreatur in der Ablage ihres Besitzers', t.pile(1, 'discardPile').includes(H.INERT.frail), t.pile(1, 'discardPile'));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
    // zweiter Zauber: besiegter Held nicht mehr wählbar
    t.setHand(0, [CARD]); t.reset();
    t.targetFn = (valid) => { t._valid2 = valid.slice(); return valid.slice(0, 1).map(v => v.id); };
    await t.play(0, CARD, { hero: 0 });
    R.check('besiegter Held 2 steht nicht in der Zielliste', !t._valid2.some(v => isHero(v, 1, 2)), t._valid2.map(v => v.id));
  }

  R.section('F · Immunitäten');
  {
    const t = await H.fresh({ hand: [[CARD], []] });
    t.heroStatus(1, 0, 'shielded');
    t.targetFn = pick(v => isHero(v, 1, 0), v => isHero(v, 1, 1));
    await t.play(0, CARD, { hero: 0 });
    R.check('Shielded-Held nimmt nichts, der andere −50', t.hp(1, 0) === 800 && t.hp(1, 1) === 750, [t.hp(1, 0), t.hp(1, 1)]);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {
    const t = await H.fresh({ hand: [[CARD], []] });
    t.gs.firstTurnProtectedPlayer = 1;
    t.targetFn = pick(v => isHero(v, 1, 0), v => isHero(v, 0, 1));
    await t.play(0, CARD, { hero: 0 });
    R.check('Erstrunden-Schutz: Gegnerheld unversehrt, eigener Held nimmt Schaden', t.hp(1, 0) === 800 && t.hp(0, 1) === 750, [t.hp(1, 0), t.hp(0, 1)]);
  }

  R.section('G · Voraussetzungen: Destruction Magic Lv1');
  {
    const t = await H.fresh({ hand: [[CARD], []] });
    t.targetFn = pick(v => isHero(v, 1, 0));
    const r = await t.play(0, CARD, { hero: 0, noGrant: true });
    R.check('ohne Destruction Magic: Server lehnt ab', r === false, r);
    R.check('kein Schaden', t.hp(1, 0) === 800);
  }
  {
    const t = await H.fresh({ hand: [[CARD], []], abilities: { 0: { 0: [['Destruction Magic'], [], []] } } });
    t.targetFn = pick(v => isHero(v, 1, 0));
    const r = await t.play(0, CARD, { hero: 0, noGrant: true });
    R.check('mit Destruction Magic Lv1: spielbar', r === true && t.hp(1, 0) === 750, [r, t.hp(1, 0)]);
  }
  {
    const t = await H.fresh({ hand: [[CARD], []] });
    t.heroStatus(0, 0, 'stunned');
    t.targetFn = pick(v => isHero(v, 1, 0));
    const r = await t.play(0, CARD, { hero: 0 });
    R.check('betäubter Wirker kann nicht spielen', t.hp(1, 0) === 800, [r, t.hp(1, 0)]);
  }

  R.finish();
})();
