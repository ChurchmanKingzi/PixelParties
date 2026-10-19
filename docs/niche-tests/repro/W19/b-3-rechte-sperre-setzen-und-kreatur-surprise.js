'use strict';
// W19b · Held unter fremder Kontrolle — Auslegung (c) und Abgrenzungen zu (a).
// Al (19.10.2026): „Manche Kontrolleffekte können explizit ausschließen, mit dem Hero Attacks/Spells auszuführen!" Die Rechte-Struktur `kontrollRechteVon` kennt dafür
//   jetzt die beiden optionalen Rechte `zauber` und `attacken` (Stempel `hero._kontrollRechte.zauber/attacken === false`; ohne Stempel erlaubt; heute stempelt
//   noch keine Karte so). Ist ein Recht gesperrt, darf NIEMAND den Helden dafür nutzen — weder der Kontrolleur (Liste `charmed`) noch der Besitzer
//   (Liste `own`, `doPlaySpell`, Surprise-Aktivierung).
// Abgrenzungen: (b) der Besitzer SETZT an seinem abgegebenen Helden weiterhin keine Surprise (Ruling 29.9.); (c) eine KREATUR-Surprise in der Zone des abgegebenen
//   Helden folgt dem bestehenden Recht `beschwoeren` der Übernahme (wie das Beschwören): erlaubt → Besitzer und Kontrolleur dürfen, gesperrt → niemand.
const H = require('../../lib/h.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const R = H.runner();
  R.section('Rechte-Sperre zauber/attacken: niemand nutzt den Helden dafür');
  {
    const t = await H.fresh({ hand: [['Fireball', 'Attack'], ['Fireball', 'Attack']], deckSize: 30, active: 0, gold: [100, 100],
      abilities: { 0: { 0: [['Destruction Magic', 'Destruction Magic'], [], []] } } });
    t.putSurprise(0, 0, 'Gold Trap'); t.grantFor(0, 0, 'Gold Trap');
    await t.engine.actionTakeHeroPermanently(1, 0, 0); await sleep(300);
    const h0 = t.gs.players[0].heroes[0];
    // Ausgangslage: beide Rechte frei → Besitzer und Kontrolleur dürfen
    const kr0 = t.engine.kontrollRechte(0, 0);
    R.check('Ausgangslage: zauber/attacken frei (Übernahme ohne Stempel)', kr0.zauber === true && kr0.attacken === true, kr0);
    R.check('Ausgangslage: Besitzer sieht Fireball und Attack für Held 0:0', JSON.stringify(t.engine.getHeroPlayableCards(0).own[0]) === JSON.stringify(['Fireball', 'Attack']), t.engine.getHeroPlayableCards(0).own[0]);
    R.check('Ausgangslage: Kontrolleur sieht Fireball und Attack über den übernommenen Helden', JSON.stringify(t.engine.getHeroPlayableCards(1).charmed?.[0]) === JSON.stringify(['Fireball', 'Attack']), t.engine.getHeroPlayableCards(1).charmed);
    R.check('Ausgangslage: Gold Trap (Spell-Surprise) ist für Besitzer UND Kontrolleur aktivierbar',
      t.engine._canHeroActivateSurprise(0, 0, 'Gold Trap', { reaktor: 0 }) && t.engine._canHeroActivateSurprise(0, 0, 'Gold Trap', { reaktor: 1 }), null);
    // nur Zauber gesperrt
    h0._kontrollRechte = { beschwoeren: true, ausruesten: true, abilities: true, zauber: false };
    R.check('zauber=false: Rechte-Struktur meldet zauber false, attacken true', t.engine.kontrollRechte(0, 0).zauber === false && t.engine.kontrollRechte(0, 0).attacken === true, t.engine.kontrollRechte(0, 0));
    R.check('zauber=false: Besitzer-Liste ohne Fireball, mit Attack', JSON.stringify(t.engine.getHeroPlayableCards(0).own[0]) === JSON.stringify(['Attack']), t.engine.getHeroPlayableCards(0).own[0]);
    R.check('zauber=false: Kontrolleur-Liste ohne Fireball, mit Attack', JSON.stringify(t.engine.getHeroPlayableCards(1).charmed?.[0]) === JSON.stringify(['Attack']), t.engine.getHeroPlayableCards(1).charmed);
    R.check('zauber=false: weder Besitzer noch Kontrolleur aktivieren die Spell-Surprise Gold Trap',
      !t.engine._canHeroActivateSurprise(0, 0, 'Gold Trap', { reaktor: 0 }) && !t.engine._canHeroActivateSurprise(0, 0, 'Gold Trap', { reaktor: 1 }), null);
    t.targetFn = (valid) => [valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 1).id];
    const hp0 = t.hp(1, 1);
    const rF = await t.play(0, 'Fireball', { hero: 0, noGrant: true });
    R.check('zauber=false: Fireball über Held 0:0 wird abgelehnt, Karte bleibt auf der Hand, kein Schaden', rF === false && t.hp(1, 1) === hp0 && t.pile(0, 'hand').includes('Fireball'), [rF, t.hp(1, 1), t.pile(0, 'hand')]);
    const rA = await t.play(0, 'Attack', { hero: 0, noGrant: true });
    R.check('zauber=false: „Attack" über Held 0:0 geht weiter durch', rA === true && t.hp(1, 1) < hp0, [rA, hp0, t.hp(1, 1)]);
    R.check('keine Engine-Fehler, Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.section('Rechte-Sperre attacken (Zauber frei)');
  {
    const t = await H.fresh({ hand: [['Fireball', 'Attack'], []], deckSize: 30, abilities: { 0: { 0: [['Destruction Magic', 'Destruction Magic'], [], []] } } });
    await t.engine.actionTakeHeroPermanently(1, 0, 0); await sleep(300);
    t.gs.players[0].heroes[0]._kontrollRechte = { beschwoeren: true, ausruesten: true, abilities: true, attacken: false };
    t.targetFn = (valid) => [valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 1).id];
    R.check('attacken=false: Besitzer-Liste mit Fireball, ohne Attack', JSON.stringify(t.engine.getHeroPlayableCards(0).own[0]) === JSON.stringify(['Fireball']), t.engine.getHeroPlayableCards(0).own[0]);
    const hp1 = t.hp(1, 1);
    const rA2 = await t.play(0, 'Attack', { hero: 0, noGrant: true });
    R.check('attacken=false: „Attack" über Held 0:0 wird abgelehnt', rA2 === false && t.hp(1, 1) === hp1, [rA2, hp1, t.hp(1, 1)]);
    const rF2 = await t.play(0, 'Fireball', { hero: 0, noGrant: true });
    R.check('attacken=false: Fireball über Held 0:0 geht durch (−150)', rF2 === true && t.hp(1, 1) === hp1 - 150, [rF2, hp1, t.hp(1, 1)]);
    R.check('keine Engine-Fehler, Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.section('Rechte-Sperre auch bei temporärer Übernahme (Charme-Art)');
  {
    const t = await H.fresh({ hand: [['Fireball'], ['Fireball']], deckSize: 30, abilities: { 0: { 0: [['Destruction Magic', 'Destruction Magic'], [], []] } } });
    await t.engine.actionStealHero(1, 0, 0); await sleep(300);
    const h0 = t.gs.players[0].heroes[0];
    R.check('temporär: Besitzer sieht Fireball für 0:0', JSON.stringify(t.engine.getHeroPlayableCards(0).own[0]) === JSON.stringify(['Fireball']), t.engine.getHeroPlayableCards(0).own[0]);
    h0._kontrollRechte = { beschwoeren: false, ausruesten: false, abilities: false, zauber: false, attacken: false };
    R.check('temporär, alles gesperrt: Besitzer-Liste für 0:0 leer', (t.engine.getHeroPlayableCards(0).own[0] || []).length === 0, t.engine.getHeroPlayableCards(0).own[0]);
    R.check('temporär, alles gesperrt: Kontrolleur-Liste für 0:0 leer', ((t.engine.getHeroPlayableCards(1).charmed || {})[0] || []).length === 0, t.engine.getHeroPlayableCards(1).charmed);
  }
  R.section('Setzen bleibt verboten; Kreatur-Surprise folgt dem Recht „beschwoeren“ der Übernahme');
  {
    const t = await H.fresh({ hand: [['Gold Trap', 'Cactus Creature'], []], deckSize: 30 });
    t.putSurprise(0, 0, 'Cactus Creature'); t.grantFor(0, 0, 'Cactus Creature'); t.grantFor(0, 0, 'Gold Trap'); t.grantFor(0, 1, 'Gold Trap');
    R.check('Normalspiel: Kreatur-Surprise ist für den Besitzer aktivierbar', t.engine._canHeroActivateSurprise(0, 0, 'Cactus Creature', { reaktor: 0 }) === true, null);
    await t.engine.actionTakeHeroPermanently(1, 0, 0); await sleep(300);
    R.check('abgegeben mit Recht beschwoeren (Paraseed-Art): Besitzer und Kontrolleur dürfen die Kreatur-Surprise auslösen',
      t.engine._canHeroActivateSurprise(0, 0, 'Cactus Creature', { reaktor: 0 }) === true && t.engine._canHeroActivateSurprise(0, 0, 'Cactus Creature', { reaktor: 1 }) === true, null);
    const rSet = await t.play(0, 'Gold Trap', { hero: 0 });
    R.check('Besitzer setzt an den abgegebenen Helden 0:0 nichts (abgelehnt, Karte bleibt auf der Hand)', rSet === false && t.pile(0, 'hand').includes('Gold Trap') && t.gs.players[0].surpriseZones[0].length === 1, [rSet, t.pile(0, 'hand'), t.gs.players[0].surpriseZones]);
    const rSet1 = await t.play(0, 'Gold Trap', { hero: 1 });
    R.check('am nicht abgegebenen Helden 0:1 setzt er normal', rSet1 === true && t.gs.players[0].surpriseZones[1].includes('Gold Trap'), [rSet1, t.gs.players[0].surpriseZones]);
    R.check('keine Engine-Fehler, Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.section('Charme-Lv3-Art: Übernahme ohne Recht beschwoeren');
  {
    const t2 = await H.fresh({ hand: [[], []], deckSize: 30 });
    t2.putSurprise(0, 0, 'Cactus Creature'); t2.grantFor(0, 0, 'Cactus Creature');
    await t2.engine.actionStealHero(1, 0, 0); await sleep(300);
    t2.gs.players[0].heroes[0]._kontrollRechte = { beschwoeren: false, ausruesten: false, abilities: false };   // Charme Lv3: „It and its Support Zones are unaffected“
    R.check('Übernahme ohne Recht beschwoeren (Charme-Lv3-Art): weder Besitzer noch Kontrolleur lösen die Kreatur-Surprise aus',
      t2.engine._canHeroActivateSurprise(0, 0, 'Cactus Creature', { reaktor: 0 }) === false && t2.engine._canHeroActivateSurprise(0, 0, 'Cactus Creature', { reaktor: 1 }) === false, null);
  }
  R.finish();
})().catch(e => { process.stdout.write('AUSNAHME ' + (e && e.stack) + '\n'); process.exit(1); });
