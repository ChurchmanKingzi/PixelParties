'use strict';
// W17d · S02-15 (Teil 2): Randfälle für einen vom Gegner kontrollierten Helden MEINER Spalte als Love-Shot-Ziel.
// (1) Gefroren oder tot ⇒ wird nicht angeboten (wie bei Gegnerhelden). Ohne passende Schule des Helden ⇒ nichts zu spielen (`love_shot_no_action`), Hand unverändert.
// (2) Abbruch der Kartenwahl ⇒ Fireball bleibt in der Hand, Kontrollmarken des Gegners unverändert.
// (3) Zusatzaktion: `getHeroPlayableCards(…, { charmedIgnoresActionCost: true }).own` überspringt die Aktionsprüfung (Love Shot als Zusatzaktion: bereits gehandelt),
//     ohne die Option bleibt die Liste unverändert (Karten brauchen dann Zusatz-/inhärente Aktion).
// Ein Spiel je Prozess: Fall A (Sperren), B (Abbruch), C (Zusatzaktion) laufen als Kindprozesse (Argument).
const H = require('../../lib/h.js');
const FALL = process.argv[2];
const ab = { 0: { 2: [['Destruction Magic', 'Destruction Magic'], [], []] } };
const marken = (h) => JSON.stringify({ by: h.charmedBy, from: h.charmedFromOwner, perma: h.permaControlBy, st: h.statuses?.charmed ?? null });
if (!FALL) {
  let bad = 0;
  for (const f of ['A', 'B', 'C']) {
    const c = require('child_process').spawnSync(process.execPath, [__filename, f], { stdio: 'inherit' });
    if (c.status) bad++;
  }
  process.stdout.write(`\nGesamt: ${bad} Fall/Fälle mit ✗\n`);
  process.exit(bad ? 1 : 0);
} else if (FALL === 'A') {
  (async () => {
    const R = H.runner();
    const t = await H.fresh({ hand: [['Love Shot', 'Fireball'], []], deckSize: 30, abilities: ab });
    await t.engine.actionTakeHeroPermanently(1, 0, 2);
    await t.engine.actionTakeHeroPermanently(1, 0, 1);
    t.heroStatus(0, 2, 'frozen');
    t.gs.players[0].heroes[1].hp = 0;
    let offered = null;
    t.targetFn = (valid, cfg) => { if (/Love Shot/.test((cfg && cfg.title) || '')) offered = valid.map(v => `${v.owner}:${v.heroIdx}`); return null; };
    const r = await t.play(0, 'Love Shot', { hero: 0 });
    t.say('->', r, JSON.stringify(offered));
    R.check('A: Love Shot gespielt', r === true, r);
    R.check('A: gefrorener (0:2) und toter (0:1) kontrollierter Held nicht angeboten', !!offered && !offered.includes('0:2') && !offered.includes('0:1'), offered);
    R.check('A: Gegnerhelden weiter angeboten', !!offered && offered.includes('1:0') && offered.includes('1:1') && offered.includes('1:2'), offered);
    R.check('A: keine Engine-Fehler', t.errors.length === 0, t.errors);
    R.finish();
  })();
} else if (FALL === 'B') {
  (async () => {
    const R = H.runner();
    const t = await H.fresh({ hand: [['Love Shot', 'Fireball'], []], deckSize: 30, abilities: ab });
    await t.engine.actionTakeHeroPermanently(1, 0, 2);
    const h2 = t.gs.players[0].heroes[2];
    const vorher = marken(h2);
    t.targetFn = (valid, cfg) => (/Love Shot/.test((cfg && cfg.title) || '') ? ['hero-0-2'] : null);
    t.script.push({ match: d => d.type === 'handPick' && /Love Shot/.test(d.title || ''), once: true, answer: () => ({ cancelled: true, selectedCards: [] }) });
    const r = await t.play(0, 'Love Shot', { hero: 0 });
    R.check('B: Love Shot gespielt', r === true, r);
    R.check('B: Fireball nach Abbruch noch auf der Hand', t.pile(0, 'hand').includes('Fireball') && !t.pile(0, 'discardPile').includes('Fireball'), [t.pile(0, 'hand'), t.pile(0, 'discardPile')]);
    R.check('B: Kontrollmarken von Held 0:2 unverändert', marken(h2) === vorher, [vorher, marken(h2)]);
    R.check('B: Gegnerheld 1:0 unversehrt', t.hp(1, 0) === 800, t.hp(1, 0));
    R.check('B: keine Engine-Fehler', t.errors.length === 0, t.errors);
    R.check('B: Zustand sauber', t.audit().length === 0, t.audit());
    R.finish();
  })();
} else if (FALL === 'C') {
  (async () => {
    const R = H.runner();
    // C1: Held 0:2 ohne Schule (nur Held 0:0 hat sie nicht, Love Shot-Wirker bekommt Magic Arts) ⇒ Auswahl leer
    const t = await H.fresh({ hand: [['Love Shot', 'Fireball'], []], deckSize: 30 });
    await t.engine.actionTakeHeroPermanently(1, 0, 2);
    let offered = null, eligible = 'nie gefragt';
    t.targetFn = (valid, cfg) => { if (/Love Shot/.test((cfg && cfg.title) || '')) { offered = valid.map(v => `${v.owner}:${v.heroIdx}`); return ['hero-0-2']; } return null; };
    t.script.push({ match: d => d.type === 'handPick', once: true, answer: (d) => { eligible = d.eligibleIndices; return { cancelled: true, selectedCards: [] }; } });
    const r = await t.play(0, 'Love Shot', { hero: 0 });
    R.check('C1: Love Shot gespielt', r === true, r);
    R.check('C1: Held 0:2 ohne Destruction Magic wird angeboten, aber keine Karte der Hand ist über ihn spielbar (keine Kartenwahl)', eligible === 'nie gefragt', eligible);
    R.check('C1: love_shot_no_action im Log', t.lg('love_shot_no_action').length === 1, t.logs.map(l => l.type));
    R.check('C1: Fireball unverändert auf der Hand', t.pile(0, 'hand').includes('Fireball'), t.pile(0, 'hand'));
    // C2: Zusatzaktions-Option wirkt auf die Liste `own` (Hero hat gehandelt) — mit Schule
    t.setAbilities?.(0, 2, [['Destruction Magic', 'Destruction Magic'], [], []]);
    if (!t.gs.players[0].abilityZones[2][0].length) t.grantFor(0, 2, 'Fireball');
    t.gs.activePlayer = 0; t.phase(3);
    t.gs.players[0].heroesActedThisTurn = [0];
    t.gs.players[0]._actionsPlayedThisPhase = 1;
    // W20a (Al, 20.10.): Love Shot stempelt `charmedBy = pi` am Zielhelden, bevor es die Liste erhebt (der Kontrolleur wirkt) — hier nachgestellt; ohne Stempel wirkt der Besitzer nicht.
    t.gs.players[0].heroes[2].charmedBy = 0;
    const ohne = t.engine.getHeroPlayableCards(0).own[2] || [];
    const mit = t.engine.getHeroPlayableCards(0, { charmedIgnoresActionCost: true }).own[2] || [];
    t.say('own[2] ohne/mit Option', JSON.stringify(ohne), JSON.stringify(mit));
    R.check('C2: ohne Option braucht Fireball eine Zusatz-/inhärente Aktion (Liste leer)', !ohne.includes('Fireball'), ohne);
    R.check('C2: mit charmedIgnoresActionCost ist Fireball über 0:2 spielbar', mit.includes('Fireball'), mit);
    R.check('C2: keine Engine-Fehler', t.errors.length === 0, t.errors);
    R.finish();
  })();
}
