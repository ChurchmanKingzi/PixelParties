'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  H03-heroes-19 · Rescued Damsel Cecilia: das Extra-Leben wirkt auch bei negierter/gefrorener/betäubter Damsel
//
//  Karte: Rescued Damsel Cecilia (`cards/effects/rescued-damsel-cecilia.js`, generischer Marker `hero._extraLife`, Verbrauch in `_engine.js` ~9390–9720)
//  Kartentext: „The first time this Ascended Hero would be defeated, immediately revive it and heal its HP completely."
//  Engine-Konvention (B-querschnitt B-09, `_isHeroEffectSilenced`): gefrorene, betäubte und negierte Helden verlieren ihre Heldeneffekte (passive Wirkungen ruhen).
//  Beobachtung: Der Marker gehört zu Karten wie „Divine Gift of Sacrifice"/„Trial of Coolness" (dort ein Zustand am Helden). Bei Damsel ist er aber die gedruckte Heldenwirkung.
//  Ob eine stillgelegte Damsel den Marker nutzen darf, ist nicht entschieden: die Skriptdatei sagt dazu nichts; der Verbrauch (`_extraLife`) prüft keinen Status.
//  Aufbau: Damsel auf Held 0 (Spielstart-Hooks gefeuert, Extra-Leben gesetzt), Status negated/frozen/stunned mit Dauer 3, dann ein tödlicher Zauberschlag.
//  Beobachtung (✗ bei Lesart „ruhende Wirkung ⇒ kein Extra-Leben"): Die Damsel wird in allen drei Zuständen wiederbelebt (600/600) und das Extra-Leben ist verbraucht.
//  Aufruf: node docs/niche-tests/repro/H03-heroes/19-damsel-extraleben-bei-stilllegung.js
// ═══════════════════════════════════════════════════════════════════════════
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const fill = ['Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'];
  for (const st of [null, 'negated', 'frozen', 'stunned']) {
    const t = await H.fresh({ heroes: [['Rescued Damsel Cecilia', ...fill], null], hp: 300 });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    t.hero(0, 0).maxHp = 600; t.hero(0, 0).hp = 600;
    if (st) t.heroStatus(0, 0, st, { appliedTurn: t.gs.turn, duration: 3 });
    await t.run(() => t.engine.actionDealDamage({ name: 'ZZ', owner: 1, heroIdx: 0 }, t.hero(0, 0), 9999, 'spell'));
    const lebt = t.hp(0, 0) > 0;
    R.note(`Damsel ${st}: nach tödlichem Schlag`, { hp: t.hp(0, 0), extraLifeUebrig: !!t.hero(0, 0)._extraLife });
    if (!st) R.check('Kontrolle: unbeeinträchtigte Damsel wird wiederbelebt', lebt, t.hp(0, 0));
    else R.check(`Damsel ${st}: Frage – kein Extra-Leben bei ruhender Wirkung`, !lebt, t.hp(0, 0));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
